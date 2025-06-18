/**
 * GraphStateManagementService - Core State Management Service
 * 
 * Specialized service responsible for managing the central graph state,
 * providing reactive signals, and coordinating state changes through
 * the MessageBusService event system.
 */

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { MessageBusService } from './message-bus.service';
import { 
  GraphState, 
  GraphStructure 
} from '../shared/models/graph-structure-interface';
import {
  GraphStateManagementContract,
  ServiceOperationResult,
  ServiceStatus,
  ServiceMetrics,
  GraphStateSnapshot,
  GraphStateChangeNotification,
  GraphStructureChangeNotification
} from '../shared/models/service-contracts.interface';
import {
  GraphStateChangeEvent,
  GraphLoadedEvent,
  GraphClearedEvent,
  ComputationResultEvent,
  EventPriority,
  SERVICE_EVENT_TYPES
} from '../shared/models/service-events.interface';

@Injectable({
  providedIn: 'root'
})
export class GraphStateManagementService implements GraphStateManagementContract, OnDestroy {
  // Service metadata
  readonly serviceName = 'GraphStateManagementService';
  readonly version = '1.0.0';

  // Dependencies
  private readonly messageBus = inject(MessageBusService);
  private readonly destroy$ = new Subject<void>();

  // Core state signal
  private readonly state = signal<GraphState>({
    isLoaded: false,
    csvContent: '',
    structure: null,
    lastAnalysisResults: null,
    lastAnalysisType: null,
    error: null,
    loadedAt: null
  });

  // State history management
  private readonly stateHistory: GraphStateSnapshot[] = [];
  private readonly maxHistorySize = 50;
  private snapshotCounter = 0;

  // Service metrics (mutable for internal updates)
  private metricsData = {
    operationsPerformed: 0,
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0
  };

  // Public computed signals (maintaining API compatibility)
  readonly isGraphLoaded = computed(() => this.state().isLoaded);
  readonly csvContent = computed(() => this.state().csvContent);
  readonly graphStructure = computed(() => this.state().structure);
  readonly error = computed(() => this.state().error);
  readonly loadedAt = computed(() => this.state().loadedAt);

  // Additional computed properties for enhanced functionality
  readonly nodeCount = computed(() => {
    const structure = this.state().structure;
    if (!structure?.edgelist) return 0;
    return this.extractUniqueNodes(structure.edgelist).length;
  });

  readonly edgeCount = computed(() => this.state().structure?.edgelist?.length || 0);

  readonly hasDiamonds = computed(() => {
    const diamondClassifications = this.state().structure?.diamond_structures?.diamondClassifications;
    return Boolean(diamondClassifications && diamondClassifications.length > 0);
  });

  // State change observables
  private readonly stateChangeSubject = new Subject<GraphStateChangeNotification>();
  private readonly structureChangeSubject = new Subject<GraphStructureChangeNotification>();

  constructor() {
    this.initializeEventSubscriptions();
    this.initializeStateTracking();
    this.logInfo('GraphStateManagementService initialized');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.logInfo('GraphStateManagementService destroyed');
  }

  // GraphStateManagementContract Implementation

  getCurrentState(): GraphState {
    return this.state();
  }

  getGraphStructure(): GraphStructure | null {
    return this.state().structure;
  }

  isHealthy(): boolean {
    return this.metricsData.errorRate < 0.05; // Healthy if error rate < 5%
  }

  getStatus(): ServiceStatus {
    return {
      service: this.serviceName,
      status: this.isHealthy() ? 'online' : 'degraded',
      health: Math.round((1 - this.metricsData.errorRate) * 100),
      lastActivity: new Date(),
      metrics: this.metricsData
    };
  }

  getStateHistory(): GraphStateSnapshot[] {
    return [...this.stateHistory];
  }

  updateState(updates: Partial<GraphState>): ServiceOperationResult<GraphState> {
    try {
      const startTime = Date.now();
      const previousState = this.state();
      
      // Create snapshot before update
      this.createStateSnapshot('Pre-update snapshot');
      
      // Update the state
      this.updateStateInternal(updates);
      const newState = this.state();
      
      // Determine what changed
      const changedFields = this.getChangedFields(previousState, newState);
      
      // Publish state change event
      this.publishStateChangeEvent(previousState, newState, changedFields);
      
      // Check for structure changes
      if (changedFields.includes('structure')) {
        this.publishStructureChangeEvent(previousState.structure, newState.structure);
      }
      
      // Update metrics
      this.updateMetrics(startTime);
      
      this.logDebug('State updated', { changedFields, updates });
      
      return { 
        success: true, 
        data: newState,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      return this.handleError('Failed to update state', error);
    }
  }

  clearState(): ServiceOperationResult<void> {
    try {
      const startTime = Date.now();
      
      // Create snapshot before clearing
      this.createStateSnapshot('Pre-clear snapshot');
      
      // Clear the state
      const clearedState: GraphState = {
        isLoaded: false,
        csvContent: '',
        structure: null,
        lastAnalysisResults: null,
        lastAnalysisType: null,
        error: null,
        loadedAt: null
      };
      
      this.state.set(clearedState);
      
      // Publish clear event
      this.publishGraphClearedEvent('user_action');
      
      // Update metrics
      this.updateMetrics(startTime);
      
      this.logInfo('State cleared');
      
      return { 
        success: true,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      return this.handleError('Failed to clear state', error);
    }
  }

  restoreState(snapshot: GraphStateSnapshot): ServiceOperationResult<GraphState> {
    try {
      const startTime = Date.now();
      const previousState = this.state();
      
      // Create snapshot before restore
      this.createStateSnapshot('Pre-restore snapshot');
      
      // Restore the state
      this.state.set(snapshot.state);
      const newState = this.state();
      
      // Determine what changed
      const changedFields = this.getChangedFields(previousState, newState);
      
      // Publish state change event
      this.publishStateChangeEvent(previousState, newState, changedFields);
      
      // Check for structure changes
      if (changedFields.includes('structure')) {
        this.publishStructureChangeEvent(previousState.structure, newState.structure);
      }
      
      // Update metrics
      this.updateMetrics(startTime);
      
      this.logInfo('State restored from snapshot', { snapshotId: snapshot.id });
      
      return { 
        success: true, 
        data: newState,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      return this.handleError('Failed to restore state', error);
    }
  }

  onStateChange(): Observable<GraphStateChangeNotification> {
    return this.stateChangeSubject.asObservable();
  }

  onStructureChange(): Observable<GraphStructureChangeNotification> {
    return this.structureChangeSubject.asObservable();
  }

  // Public methods for backward compatibility
  updateCsvContent(csvContent: string): void {
    this.updateState({ csvContent });
  }

  // Private methods

  private initializeEventSubscriptions(): void {
    // Subscribe to computation result events to update graph structure
    this.messageBus.subscribe(
      SERVICE_EVENT_TYPES.COMPUTATION_RESULT,
      (event: ComputationResultEvent) => {
        if (event.payload.success && event.payload.results) {
          this.handleComputationResult(event);
        }
      },
      { priority: EventPriority.HIGH }
    );
  }

  private initializeStateTracking(): void {
    // Create initial snapshot
    this.createStateSnapshot('Initial state');
  }

  private updateStateInternal(partialState: Partial<GraphState>): void {
    this.state.update(current => ({ ...current, ...partialState }));
  }

  private getChangedFields(previous: GraphState, current: GraphState): (keyof GraphState)[] {
    const changedFields: (keyof GraphState)[] = [];
    
    for (const key in current) {
      const typedKey = key as keyof GraphState;
      if (previous[typedKey] !== current[typedKey]) {
        changedFields.push(typedKey);
      }
    }
    
    return changedFields;
  }

  private createStateSnapshot(description?: string): void {
    const snapshot: GraphStateSnapshot = {
      id: `snapshot_${++this.snapshotCounter}_${Date.now()}`,
      timestamp: new Date(),
      state: { ...this.state() },
      description,
      tags: []
    };
    
    this.stateHistory.push(snapshot);
    
    // Maintain history size limit
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private async publishStateChangeEvent(
    previousState: GraphState, 
    newState: GraphState, 
    changedFields: (keyof GraphState)[]
  ): Promise<void> {
    const event: GraphStateChangeEvent = {
      type: SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE,
      timestamp: new Date(),
      source: this.serviceName,
      payload: {
        previousState,
        newState,
        changedFields
      },
      priority: EventPriority.HIGH
    };
    
    await this.messageBus.publish(event);
    
    // Also emit to local observable
    this.stateChangeSubject.next({
      previousState,
      newState,
      changedFields,
      timestamp: new Date()
    });
  }

  private async publishStructureChangeEvent(
    previousStructure: GraphStructure | null,
    newStructure: GraphStructure | null
  ): Promise<void> {
    let changeType: 'loaded' | 'cleared' | 'updated';
    
    if (!previousStructure && newStructure) {
      changeType = 'loaded';
    } else if (previousStructure && !newStructure) {
      changeType = 'cleared';
    } else {
      changeType = 'updated';
    }
    
    // Publish graph loaded event if structure was loaded
    if (changeType === 'loaded' && newStructure) {
      const loadedEvent: GraphLoadedEvent = {
        type: SERVICE_EVENT_TYPES.GRAPH_LOADED,
        timestamp: new Date(),
        source: this.serviceName,
        payload: {
          structure: newStructure,
          csvContent: this.csvContent(),
          nodeCount: this.nodeCount(),
          edgeCount: this.edgeCount()
        },
        priority: EventPriority.HIGH
      };
      
      await this.messageBus.publish(loadedEvent);
    }
    
    // Emit to local observable
    this.structureChangeSubject.next({
      previousStructure,
      newStructure,
      changeType,
      timestamp: new Date()
    });
  }

  private async publishGraphClearedEvent(reason: 'user_action' | 'error' | 'reload'): Promise<void> {
    const event: GraphClearedEvent = {
      type: SERVICE_EVENT_TYPES.GRAPH_CLEARED,
      timestamp: new Date(),
      source: this.serviceName,
      payload: { reason },
      priority: EventPriority.HIGH
    };
    
    await this.messageBus.publish(event);
  }

  private handleComputationResult(event: ComputationResultEvent): void {
    // Update state based on computation results
    // This allows other services to update the graph structure
    if (event.payload.results && event.payload.computationType === 'structure_analysis') {
      this.updateState({
        structure: event.payload.results,
        isLoaded: true,
        loadedAt: new Date(),
        error: null
      });
    }
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  private updateMetrics(startTime: number): void {
    const executionTime = Date.now() - startTime;
    this.metricsData.operationsPerformed++;
    
    // Update average response time
    const totalTime = this.metricsData.averageResponseTime * (this.metricsData.operationsPerformed - 1) + executionTime;
    this.metricsData.averageResponseTime = totalTime / this.metricsData.operationsPerformed;
  }

  private handleError(message: string, error: unknown): ServiceOperationResult<any> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullMessage = `${message}: ${errorMsg}`;
    
    // Update error metrics
    this.metricsData.errorRate = (this.metricsData.errorRate * this.metricsData.operationsPerformed + 1) / (this.metricsData.operationsPerformed + 1);
    this.metricsData.operationsPerformed++;
    
    // Update state with error
    this.updateStateInternal({ error: fullMessage });
    
    this.logError(fullMessage, { error });
    
    return { 
      success: false, 
      error: fullMessage,
      metadata: {
        executionTime: 0,
        timestamp: new Date()
      }
    };
  }

  // Logging methods
  private logDebug(message: string, context?: any): void {
    console.debug(`[${this.serviceName}] ${message}`, context);
  }

  private logInfo(message: string, context?: any): void {
    console.info(`[${this.serviceName}] ${message}`, context);
  }

  private logError(message: string, context?: any): void {
    console.error(`[${this.serviceName}] ${message}`, context);
  }
}