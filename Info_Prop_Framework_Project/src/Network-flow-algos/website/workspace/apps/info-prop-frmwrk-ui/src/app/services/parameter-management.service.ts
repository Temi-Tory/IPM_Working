/**
 * ParameterManagementService - Specialized Parameter State Management
 * 
 * Handles all parameter-related operations including tracking, validation,
 * staleness detection, and coordination with other services through events.
 * 
 * Extracted from GraphStateService as part of the service architecture refactoring.
 */

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, filter, map, distinctUntilChanged, debounceTime, startWith, pairwise } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { MessageBusService } from './message-bus.service';
import { 
  ParameterManagementContract,
  GlobalParameters,
  ParameterValidationResult,
  ParameterValidationError,
  ParameterValidationWarning,
  ParameterChangeNotification,
  ParameterChange,
  ServiceOperationResult,
  ServiceStatus,
  ServiceMetrics
} from '../shared/models/service-contracts.interface';

import {
  ParameterChangeEvent,
  ParameterValidationEvent,
  AnalysisCompleteEvent,
  GraphStateChangeEvent,
  ServiceEvent,
  EventPriority,
  SERVICE_EVENT_TYPES
} from '../shared/models/service-events.interface';

import { GraphStructure } from '../shared/models/graph-structure-interface';

/**
 * Internal parameter state interface
 */
interface ParameterState {
  readonly nodePriors: { [nodeId: string]: number };
  readonly edgeProbabilities: { [edgeKey: string]: number };
  readonly globalParameters: GlobalParameters;
  readonly lastModified: Date | null;
  readonly isStale: boolean;
  readonly lastAnalysisTimestamp: Date | null;
}

/**
 * Parameter change tracking interface
 */
interface ParameterChangeTracker {
  readonly nodeChanges: Map<string, { previous: number; current: number; timestamp: Date }>;
  readonly edgeChanges: Map<string, { previous: number; current: number; timestamp: Date }>;
  readonly globalChanges: Map<string, { previous: any; current: any; timestamp: Date }>;
}

@Injectable({
  providedIn: 'root'
})
export class ParameterManagementService implements ParameterManagementContract, OnDestroy {
  // Service metadata
  readonly serviceName = 'ParameterManagementService';
  readonly version = '1.0.0';

  // Core dependencies
  private readonly messageBusService = inject(MessageBusService);
  
  // Reactive state management
  private readonly parametersLastModified = signal<Date | null>(null);
  private readonly lastAnalysisTimestamp = signal<Date | null>(null);
  private readonly parameterState = signal<ParameterState>(this.initializeParameterState());
  
  // Change tracking
  private readonly changeTracker: ParameterChangeTracker = {
    nodeChanges: new Map(),
    edgeChanges: new Map(),
    globalChanges: new Map()
  };

  // Validation state
  private readonly validationResult = signal<ParameterValidationResult>(this.createValidValidationResult());
  
  // Service state
  private readonly serviceMetrics = signal<ServiceMetrics>({
    operationsPerformed: 0,
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0
  });

  // Internal subjects for reactive streams
  private readonly parameterChange$ = new Subject<ParameterChangeNotification>();
  private readonly validationChange$ = new Subject<ParameterValidationResult>();
  private readonly destroy$ = new Subject<void>();

  // Computed signals for reactive UI
  readonly isAnalysisStale = computed(() => {
    const parametersModified = this.parametersLastModified();
    const analysisRun = this.lastAnalysisTimestamp();
    
    // No analysis stale if no parameters have been modified
    if (!parametersModified) return false;
    
    // Analysis is stale if no analysis has been run yet
    if (!analysisRun) return true;
    
    // Analysis is stale if parameters were modified after last analysis
    return parametersModified > analysisRun;
  });

  readonly globalParameters = computed(() => this.parameterState().globalParameters);
  readonly nodePriors = computed(() => this.parameterState().nodePriors);
  readonly edgeProbabilities = computed(() => this.parameterState().edgeProbabilities);
  readonly lastModified = computed(() => this.parametersLastModified());
  readonly validationStatus = computed(() => this.validationResult());

  constructor() {
    this.initializeEventSubscriptions();
    this.initializeParameterValidation();
    this.logInfo('ParameterManagementService initialized');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.logInfo('ParameterManagementService destroyed');
  }

  // ParameterManagementContract Implementation

  getNodePriors(): { [nodeId: string]: number } {
    return { ...this.parameterState().nodePriors };
  }

  getEdgeProbabilities(): { [edgeKey: string]: number } {
    return { ...this.parameterState().edgeProbabilities };
  }

  getGlobalParameters(): GlobalParameters {
    return { ...this.parameterState().globalParameters };
  }

  validateParameters(): ParameterValidationResult {
    const currentState = this.parameterState();
    const validation = this.performParameterValidation(currentState);
    
    this.validationResult.set(validation);
    this.publishValidationEvent(validation);
    
    return validation;
  }

  updateNodePriors(updates: { [nodeId: string]: number }): ServiceOperationResult<void> {
    try {
      const currentState = this.parameterState();
      const previousPriors = { ...currentState.nodePriors };
      
      // Validate the updates
      const validation = this.validateNodePriorUpdates(updates);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Node prior validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Apply updates
      const updatedPriors = { ...previousPriors, ...updates };
      const newState: ParameterState = {
        ...currentState,
        nodePriors: updatedPriors,
        lastModified: new Date(),
        isStale: true
      };

      this.parameterState.set(newState);
      this.markParametersStale();

      // Track changes
      this.trackNodePriorChanges(updates, previousPriors);

      // Publish parameter change event
      this.publishParameterChangeEvent('node_prior', { nodeUpdates: updates });

      this.updateOperationMetrics();
      this.logDebug('Node priors updated', { updates, count: Object.keys(updates).length });

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating node priors';
      this.logError('Error updating node priors', { error: errorMessage, updates });
      return { success: false, error: errorMessage };
    }
  }

  updateEdgeProbabilities(updates: { [edgeKey: string]: number }): ServiceOperationResult<void> {
    try {
      const currentState = this.parameterState();
      const previousProbabilities = { ...currentState.edgeProbabilities };
      
      // Validate the updates
      const validation = this.validateEdgeProbabilityUpdates(updates);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Edge probability validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Apply updates
      const updatedProbabilities = { ...previousProbabilities, ...updates };
      const newState: ParameterState = {
        ...currentState,
        edgeProbabilities: updatedProbabilities,
        lastModified: new Date(),
        isStale: true
      };

      this.parameterState.set(newState);
      this.markParametersStale();

      // Track changes
      this.trackEdgeProbabilityChanges(updates, previousProbabilities);

      // Publish parameter change event
      this.publishParameterChangeEvent('edge_probability', { edgeUpdates: updates });

      this.updateOperationMetrics();
      this.logDebug('Edge probabilities updated', { updates, count: Object.keys(updates).length });

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating edge probabilities';
      this.logError('Error updating edge probabilities', { error: errorMessage, updates });
      return { success: false, error: errorMessage };
    }
  }

  updateGlobalParameters(updates: Partial<GlobalParameters>): ServiceOperationResult<void> {
    try {
      const currentState = this.parameterState();
      const previousGlobal = { ...currentState.globalParameters };
      
      // Validate the updates
      const validation = this.validateGlobalParameterUpdates(updates);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Global parameter validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Apply updates
      const updatedGlobal = { ...previousGlobal, ...updates };
      const newState: ParameterState = {
        ...currentState,
        globalParameters: updatedGlobal,
        lastModified: new Date(),
        isStale: true
      };

      this.parameterState.set(newState);
      this.markParametersStale();

      // Track changes
      this.trackGlobalParameterChanges(updates, previousGlobal);

      // Publish parameter change event
      this.publishParameterChangeEvent('global_config', { globalUpdates: updates });

      this.updateOperationMetrics();
      this.logDebug('Global parameters updated', { updates });

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating global parameters';
      this.logError('Error updating global parameters', { error: errorMessage, updates });
      return { success: false, error: errorMessage };
    }
  }

  resetToDefaults(): ServiceOperationResult<void> {
    try {
      const defaultState = this.initializeParameterState();
      this.parameterState.set(defaultState);
      this.parametersLastModified.set(null);
      this.lastAnalysisTimestamp.set(null);
      
      // Clear change tracking
      this.changeTracker.nodeChanges.clear();
      this.changeTracker.edgeChanges.clear();
      this.changeTracker.globalChanges.clear();

      // Publish reset event
      this.publishParameterChangeEvent('global_config', { 
        globalUpdates: { reset: true },
        isStale: false 
      });

      this.logInfo('Parameters reset to defaults');
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error resetting parameters';
      this.logError('Error resetting parameters', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  markParametersStale(): void {
    this.parametersLastModified.set(new Date());
    this.logDebug('Parameters marked as stale');
  }

  isParameterSetStale(): boolean {
    return this.isAnalysisStale();
  }

  getLastModified(): Date | null {
    return this.parametersLastModified();
  }

  onParameterChange(): Observable<ParameterChangeNotification> {
    return this.parameterChange$.asObservable();
  }

  onValidationChange(): Observable<ParameterValidationResult> {
    return this.validationChange$.asObservable();
  }

  // BaseService Implementation

  isHealthy(): boolean {
    const metrics = this.serviceMetrics();
    return metrics.errorRate < 0.05; // Healthy if error rate < 5%
  }

  getStatus(): ServiceStatus {
    const metrics = this.serviceMetrics();
    const health = Math.max(0, Math.min(100, 100 - (metrics.errorRate * 100)));
    
    return {
      service: this.serviceName,
      status: this.isHealthy() ? 'online' : 'degraded',
      health,
      lastActivity: new Date(),
      metrics
    };
  }

  // Public coordination methods (extracted from original service)

  /**
   * Update parameters from analysis results
   * Extracted from original updateParametersFromAnalysis method
   */
  updateParametersFromAnalysis(analysisResults: any): ServiceOperationResult<void> {
    try {
      if (!analysisResults?.parameterModifications) {
        return { success: true }; // No modifications to process
      }

      const mods = analysisResults.parameterModifications;
      
      // Log modification statistics
      if (mods.totalNodesModified > 0 || mods.totalEdgesModified > 0) {
        this.logInfo('Analysis modified parameters', {
          nodesModified: mods.totalNodesModified,
          edgesModified: mods.totalEdgesModified,
          summary: mods.modificationSummary
        });

        // Trigger parameter-dependent state refresh
        this.refreshParameterDependentState();
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating parameters from analysis';
      this.logError('Error updating parameters from analysis', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Force refresh of parameter-dependent components
   * Extracted from original refreshParameterDependentState method
   */
  refreshParameterDependentState(): void {
    this.publishParameterChangeEvent('global_config', {
      globalUpdates: { refreshTimestamp: new Date() },
      isStale: this.isParameterSetStale()
    });

    this.logDebug('Parameter-dependent state refreshed');
  }

  /**
   * Update global parameters programmatically
   * Extracted and enhanced from original updateGlobalParameters method
   */
  updateGlobalParametersFromStructure(
    structure: GraphStructure,
    nodeUpdates?: { [nodeId: string]: number },
    edgeUpdates?: { [edgeKey: string]: number }
  ): ServiceOperationResult<void> {
    try {
      const currentState = this.parameterState();
      let hasChanges = false;

      let updatedState = { ...currentState };

      // Update node priors if provided
      if (nodeUpdates && Object.keys(nodeUpdates).length > 0) {
        updatedState = {
          ...updatedState,
          nodePriors: { ...updatedState.nodePriors, ...nodeUpdates }
        };
        hasChanges = true;
      }

      // Update edge probabilities if provided
      if (edgeUpdates && Object.keys(edgeUpdates).length > 0) {
        updatedState = {
          ...updatedState,
          edgeProbabilities: { ...updatedState.edgeProbabilities, ...edgeUpdates }
        };
        hasChanges = true;
      }

      if (hasChanges) {
        updatedState = {
          ...updatedState,
          lastModified: new Date(),
          isStale: true
        };
        
        this.parameterState.set(updatedState);
        this.markParametersStale();
        this.refreshParameterDependentState();

        this.logDebug('Global parameters updated from structure', {
          nodeUpdates: nodeUpdates ? Object.keys(nodeUpdates).length : 0,
          edgeUpdates: edgeUpdates ? Object.keys(edgeUpdates).length : 0
        });
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error updating global parameters from structure';
      this.logError('Error updating global parameters from structure', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  // Private methods

  private initializeParameterState(): ParameterState {
    return {
      nodePriors: {},
      edgeProbabilities: {},
      globalParameters: {
        defaultNodePrior: 0.5,
        defaultEdgeProbability: 0.5,
        overrideNodePrior: false,
        overrideEdgeProbability: false,
        enableMonteCarlo: false,
        includeClassification: true,
        useIndividualOverrides: false
      },
      lastModified: null,
      isStale: false,
      lastAnalysisTimestamp: null
    };
  }

  private createValidValidationResult(): ParameterValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      affectedNodes: [],
      affectedEdges: []
    };
  }

  private initializeEventSubscriptions(): void {
    // Subscribe to analysis complete events to update analysis timestamp
    this.messageBusService.subscribe<AnalysisCompleteEvent>(
      SERVICE_EVENT_TYPES.ANALYSIS_COMPLETE,
      (event) => this.handleAnalysisCompleteEvent(event),
      { priority: EventPriority.HIGH }
    );

    // Subscribe to graph state changes that might affect parameters
    this.messageBusService.subscribe<GraphStateChangeEvent>(
      SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE,
      (event) => this.handleGraphStateChangeEvent(event),
      { priority: EventPriority.NORMAL }
    );

    this.logDebug('Event subscriptions initialized');
  }

  private initializeParameterValidation(): void {
    // Set up automatic validation when parameters change
    toObservable(this.parameterState).pipe(
      takeUntil(this.destroy$),
      debounceTime(300), // Debounce validation for 300ms
      distinctUntilChanged((prev: ParameterState, curr: ParameterState) =>
        prev.lastModified?.getTime() === curr.lastModified?.getTime()
      )
    ).subscribe((state: ParameterState) => {
      const validation = this.performParameterValidation(state);
      if (validation.isValid !== this.validationResult().isValid ||
          validation.errors.length !== this.validationResult().errors.length) {
        this.validationResult.set(validation);
        this.validationChange$.next(validation);
      }
    });

    this.logDebug('Parameter validation initialized');
  }

  private handleAnalysisCompleteEvent(event: AnalysisCompleteEvent): void {
    if (event.payload.success) {
      this.lastAnalysisTimestamp.set(event.timestamp);
      this.logDebug('Analysis timestamp updated', { 
        analysisType: event.payload.analysisType,
        timestamp: event.timestamp 
      });
    }
  }

  private handleGraphStateChangeEvent(event: GraphStateChangeEvent): void {
    // Check if structure-related changes might affect parameters
    if (event.payload.changedFields.includes('structure')) {
      this.logDebug('Graph structure changed, validating parameters');
      this.validateParameters();
    }
  }

  private performParameterValidation(state: ParameterState): ParameterValidationResult {
    const errors: ParameterValidationError[] = [];
    const warnings: ParameterValidationWarning[] = [];
    const affectedNodes: number[] = [];
    const affectedEdges: string[] = [];

    // Validate node priors
    for (const [nodeId, prior] of Object.entries(state.nodePriors)) {
      if (prior < 0 || prior > 1) {
        errors.push({
          type: 'range',
          field: `nodePrior.${nodeId}`,
          value: prior,
          message: `Node prior for ${nodeId} must be between 0 and 1`,
          suggestion: 'Use a value between 0.0 and 1.0'
        });
        affectedNodes.push(parseInt(nodeId));
      }
    }

    // Validate edge probabilities
    for (const [edgeKey, probability] of Object.entries(state.edgeProbabilities)) {
      if (probability < 0 || probability > 1) {
        errors.push({
          type: 'range',
          field: `edgeProbability.${edgeKey}`,
          value: probability,
          message: `Edge probability for ${edgeKey} must be between 0 and 1`,
          suggestion: 'Use a value between 0.0 and 1.0'
        });
        affectedEdges.push(edgeKey);
      }
    }

    // Validate global parameters
    const global = state.globalParameters;
    if (global.defaultNodePrior < 0 || global.defaultNodePrior > 1) {
      errors.push({
        type: 'range',
        field: 'defaultNodePrior',
        value: global.defaultNodePrior,
        message: 'Default node prior must be between 0 and 1',
        suggestion: 'Use a value between 0.0 and 1.0'
      });
    }

    if (global.defaultEdgeProbability < 0 || global.defaultEdgeProbability > 1) {
      errors.push({
        type: 'range',
        field: 'defaultEdgeProbability',
        value: global.defaultEdgeProbability,
        message: 'Default edge probability must be between 0 and 1',
        suggestion: 'Use a value between 0.0 and 1.0'
      });
    }

    // Performance warnings
    if (Object.keys(state.nodePriors).length > 1000) {
      warnings.push({
        type: 'performance',
        field: 'nodePriors',
        message: 'Large number of individual node priors may impact performance',
        impact: 'medium'
      });
    }

    if (Object.keys(state.edgeProbabilities).length > 5000) {
      warnings.push({
        type: 'performance',
        field: 'edgeProbabilities',
        message: 'Large number of individual edge probabilities may impact performance',
        impact: 'high'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      affectedNodes: [...new Set(affectedNodes)],
      affectedEdges: [...new Set(affectedEdges)]
    };
  }

  private validateNodePriorUpdates(updates: { [nodeId: string]: number }): ParameterValidationResult {
    const errors: ParameterValidationError[] = [];
    const affectedNodes: number[] = [];

    for (const [nodeId, prior] of Object.entries(updates)) {
      if (typeof prior !== 'number' || isNaN(prior)) {
        errors.push({
          type: 'type',
          field: `nodePrior.${nodeId}`,
          value: prior,
          message: `Invalid node prior value for ${nodeId}: must be a number`
        });
      } else if (prior < 0 || prior > 1) {
        errors.push({
          type: 'range',
          field: `nodePrior.${nodeId}`,
          value: prior,
          message: `Node prior for ${nodeId} must be between 0 and 1`
        });
      }
      affectedNodes.push(parseInt(nodeId));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      affectedNodes: [...new Set(affectedNodes)],
      affectedEdges: []
    };
  }

  private validateEdgeProbabilityUpdates(updates: { [edgeKey: string]: number }): ParameterValidationResult {
    const errors: ParameterValidationError[] = [];
    const affectedEdges: string[] = [];

    for (const [edgeKey, probability] of Object.entries(updates)) {
      if (typeof probability !== 'number' || isNaN(probability)) {
        errors.push({
          type: 'type',
          field: `edgeProbability.${edgeKey}`,
          value: probability,
          message: `Invalid edge probability value for ${edgeKey}: must be a number`
        });
      } else if (probability < 0 || probability > 1) {
        errors.push({
          type: 'range',
          field: `edgeProbability.${edgeKey}`,
          value: probability,
          message: `Edge probability for ${edgeKey} must be between 0 and 1`
        });
      }
      affectedEdges.push(edgeKey);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      affectedNodes: [],
      affectedEdges: [...new Set(affectedEdges)]
    };
  }

  private validateGlobalParameterUpdates(updates: Partial<GlobalParameters>): ParameterValidationResult {
    const errors: ParameterValidationError[] = [];

    if (updates.defaultNodePrior !== undefined) {
      if (typeof updates.defaultNodePrior !== 'number' || isNaN(updates.defaultNodePrior)) {
        errors.push({
          type: 'type',
          field: 'defaultNodePrior',
          value: updates.defaultNodePrior,
          message: 'Default node prior must be a number'
        });
      } else if (updates.defaultNodePrior < 0 || updates.defaultNodePrior > 1) {
        errors.push({
          type: 'range',
          field: 'defaultNodePrior',
          value: updates.defaultNodePrior,
          message: 'Default node prior must be between 0 and 1'
        });
      }
    }

    if (updates.defaultEdgeProbability !== undefined) {
      if (typeof updates.defaultEdgeProbability !== 'number' || isNaN(updates.defaultEdgeProbability)) {
        errors.push({
          type: 'type',
          field: 'defaultEdgeProbability',
          value: updates.defaultEdgeProbability,
          message: 'Default edge probability must be a number'
        });
      } else if (updates.defaultEdgeProbability < 0 || updates.defaultEdgeProbability > 1) {
        errors.push({
          type: 'range',
          field: 'defaultEdgeProbability',
          value: updates.defaultEdgeProbability,
          message: 'Default edge probability must be between 0 and 1'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      affectedNodes: [],
      affectedEdges: []
    };
  }

  private trackNodePriorChanges(
    updates: { [nodeId: string]: number },
    previousPriors: { [nodeId: string]: number }
  ): void {
    const timestamp = new Date();
    for (const [nodeId, newValue] of Object.entries(updates)) {
      const previousValue = previousPriors[nodeId] || 0;
      this.changeTracker.nodeChanges.set(nodeId, {
        previous: previousValue,
        current: newValue,
        timestamp
      });
    }
  }

  private trackEdgeProbabilityChanges(
    updates: { [edgeKey: string]: number },
    previousProbabilities: { [edgeKey: string]: number }
  ): void {
    const timestamp = new Date();
    for (const [edgeKey, newValue] of Object.entries(updates)) {
      const previousValue = previousProbabilities[edgeKey] || 0;
      this.changeTracker.edgeChanges.set(edgeKey, {
        previous: previousValue,
        current: newValue,
        timestamp
      });
    }
  }

  private trackGlobalParameterChanges(
    updates: Partial<GlobalParameters>,
    previousGlobal: GlobalParameters
  ): void {
    const timestamp = new Date();
    for (const [key, newValue] of Object.entries(updates)) {
      const previousValue = (previousGlobal as any)[key];
      this.changeTracker.globalChanges.set(key, {
        previous: previousValue,
        current: newValue,
        timestamp
      });
    }
  }

  private async publishParameterChangeEvent(
    parameterType: 'node_prior' | 'edge_probability' | 'global_config',
    payload: {
      nodeUpdates?: { [nodeId: string]: number };
      edgeUpdates?: { [edgeKey: string]: number };
      globalUpdates?: { [key: string]: any };
      isStale?: boolean;
    }
  ): Promise<void> {
    const event: ParameterChangeEvent = {
      type: SERVICE_EVENT_TYPES.PARAMETER_CHANGE,
      source: this.serviceName,
      timestamp: new Date(),
      payload: {
        parameterType,
        nodeUpdates: payload.nodeUpdates,
        edgeUpdates: payload.edgeUpdates,
        globalUpdates: payload.globalUpdates,
        isStale: payload.isStale ?? this.isParameterSetStale()
      },
      priority: EventPriority.HIGH
    };

    await this.messageBusService.publish(event);

    // Also emit through internal subject
    const notification: ParameterChangeNotification = {
      parameterType,
      changes: this.buildParameterChanges(payload),
      timestamp: event.timestamp,
      isStale: event.payload.isStale
    };

    this.parameterChange$.next(notification);
  }

  private async publishValidationEvent(validation: ParameterValidationResult): Promise<void> {
    const event: ParameterValidationEvent = {
      type: SERVICE_EVENT_TYPES.PARAMETER_VALIDATION,
      source: this.serviceName,
      timestamp: new Date(),
      payload: {
        isValid: validation.isValid,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings.map(w => w.message),
        affectedNodes: validation.affectedNodes,
        affectedEdges: validation.affectedEdges
      },
      priority: validation.isValid ? EventPriority.NORMAL : EventPriority.HIGH
    };

    await this.messageBusService.publish(event);
  }

  private buildParameterChanges(payload: {
    nodeUpdates?: { [nodeId: string]: number };
    edgeUpdates?: { [edgeKey: string]: number };
    globalUpdates?: { [key: string]: any };
  }): ParameterChange[] {
    const changes: ParameterChange[] = [];

    // Build node changes
    if (payload.nodeUpdates) {
      for (const [nodeId, newValue] of Object.entries(payload.nodeUpdates)) {
        const changeInfo = this.changeTracker.nodeChanges.get(nodeId);
        changes.push({
          field: `nodePrior.${nodeId}`,
          previousValue: changeInfo?.previous || 0,
          newValue,
          affectedElements: [nodeId]
        });
      }
    }

    // Build edge changes
    if (payload.edgeUpdates) {
      for (const [edgeKey, newValue] of Object.entries(payload.edgeUpdates)) {
        const changeInfo = this.changeTracker.edgeChanges.get(edgeKey);
        changes.push({
          field: `edgeProbability.${edgeKey}`,
          previousValue: changeInfo?.previous || 0,
          newValue,
          affectedElements: [edgeKey]
        });
      }
    }

    // Build global changes
    if (payload.globalUpdates) {
      for (const [key, newValue] of Object.entries(payload.globalUpdates)) {
        const changeInfo = this.changeTracker.globalChanges.get(key);
        changes.push({
          field: `global.${key}`,
          previousValue: changeInfo?.previous,
          newValue,
          affectedElements: []
        });
      }
    }

    return changes;
  }

  private updateOperationMetrics(): void {
    const current = this.serviceMetrics();
    this.serviceMetrics.set({
      ...current,
      operationsPerformed: current.operationsPerformed + 1
    });
  }

  // Logging methods
  private logDebug(message: string, context?: any): void {
    console.debug(`[${this.serviceName}] ${message}`, context);
  }

  private logInfo(message: string, context?: any): void {
    console.info(`[${this.serviceName}] ${message}`, context);
  }

  private logWarn(message: string, context?: any): void {
    console.warn(`[${this.serviceName}] ${message}`, context);
  }

  private logError(message: string, context?: any): void {
    console.error(`[${this.serviceName}] ${message}`, context);
  }
}