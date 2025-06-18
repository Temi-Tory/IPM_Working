/**
 * GraphServiceOrchestrator - Unified Service Coordination Layer
 * 
 * This orchestrator coordinates all specialized services (GraphStateManagementService,
 * ParameterManagementService, AnalysisService, VisualizationService) while maintaining
 * backward compatibility with the original GraphStateService API.
 * 
 * Key responsibilities:
 * 1. Service lifecycle management and dependency injection
 * 2. API delegation to appropriate specialized services
 * 3. Signal aggregation from all services
 * 4. Cross-service coordination via MessageBusService
 * 5. Backward compatibility preservation
 * 6. Unified error handling and service health monitoring
 */

import { Injectable, inject, signal, computed, OnDestroy } from "@angular/core";
import { takeUntil, Subject, Observable, combineLatest, map, startWith, catchError, of } from "rxjs";

// Service Dependencies
import { GraphStateManagementService } from "./graph-state-management.service";
import { ParameterManagementService } from "./parameter-management.service";
import { AnalysisService } from "./analysis.service";
import { VisualizationService } from "./visualization.service";
import { MessageBusService } from "./message-bus.service";
import { SpinnerService, SpinnerConfig } from "../shared/spinner/spinner-service/spinner-service";

// Core Types
import { GraphState, GraphStructure } from "../shared/models/graph-structure-interface";
import { FullAnalysisResponse, StructureAnalysisResponse, DiamondAnalysisResponse } from "../shared/models/main-sever-interface";
import { ServiceEvent, EventPriority, SERVICE_EVENT_TYPES } from "../shared/models/service-events.interface";
import { ServiceOperationResult, ServiceStatus, BaseService } from "../shared/models/service-contracts.interface";

@Injectable({
  providedIn: 'root'
})
export class GraphServiceOrchestrator implements OnDestroy {
  // Service Dependencies
  private readonly graphStateService = inject(GraphStateManagementService);
  private readonly parameterService = inject(ParameterManagementService);
  private readonly analysisService = inject(AnalysisService);
  private readonly visualizationService = inject(VisualizationService);
  private readonly messageBusService = inject(MessageBusService);
  private readonly spinnerService = inject(SpinnerService);

  // Lifecycle management
  private readonly destroy$ = new Subject<void>();
  private readonly serviceHealthSignal = signal<{ [serviceName: string]: ServiceStatus }>({});

  // Service coordination state
  private readonly orchestratorState = signal({
    isInitialized: false,
    servicesOnline: 0,
    totalServices: 4,
    lastError: null as string | null,
    lastActivity: new Date()
  });

  constructor() {
    this.initializeServices();
    this.setupServiceCoordination();
    this.setupServiceHealthMonitoring();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY API - COMPUTED SIGNALS
  // ============================================================================

  // Core state properties
  readonly isGraphLoaded = computed(() => this.graphStateService.isGraphLoaded());
  readonly csvContent = computed(() => this.graphStateService.csvContent());
  readonly graphStructure = computed(() => this.graphStateService.graphStructure());
  readonly error = computed(() => {
    // Aggregate errors from all services
    const stateError = this.graphStateService.error();
    const orchestratorError = this.orchestratorState().lastError;
    
    return stateError || orchestratorError;
  });
  readonly loadedAt = computed(() => this.graphStateService.loadedAt());

  // Analysis properties
  readonly lastResults = computed(() => this.analysisService.lastResults());
  readonly lastAnalysisType = computed(() => this.analysisService.lastAnalysisType());
  readonly lastAnalysisRun = computed(() => this.analysisService.lastAnalysisRun());
  readonly isAnalysisStale = computed(() => {
    const parametersModified = this.parameterService.getLastModified();
    const analysisRun = this.analysisService.lastAnalysisRun();
    
    if (!parametersModified) return false;
    if (!analysisRun) return true;
    
    return parametersModified > analysisRun;
  });

  // Graph metrics (computed from graph structure)
  readonly nodeCount = computed(() => {
    const structure = this.graphStructure();
    if (!structure?.edgelist) return 0;
    return this.extractUniqueNodes(structure.edgelist).length;
  });
  
  readonly edgeCount = computed(() => this.graphStructure()?.edgelist?.length || 0);
  
  readonly hasDiamonds = computed(() => {
    const diamondClassifications = this.graphStructure()?.diamond_structures?.diamondClassifications;
    return Boolean(diamondClassifications && diamondClassifications.length > 0);
  });
  
  readonly sourceNodeCount = computed(() => this.graphStructure()?.source_nodes?.length || 0);
  readonly joinNodeCount = computed(() => this.graphStructure()?.join_nodes?.length || 0);
  readonly forkNodeCount = computed(() => this.graphStructure()?.fork_nodes?.length || 0);

  // Service health aggregation
  readonly isServiceHealthy = computed(() => {
    const state = this.orchestratorState();
    return state.isInitialized && state.servicesOnline === state.totalServices;
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY API - METHODS
  // ============================================================================

  /**
   * Load graph structure from CSV content
   * Delegates to AnalysisService with coordination
   */
  async loadGraphFromCsv(
    csvContent: string,
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isServiceHealthy()) {
      return { success: false, error: 'Services not ready. Please wait for initialization to complete.' };
    }

    try {
      // Clear previous state across all services
      this.clearState();
      
      // Update CSV content in state service
      this.graphStateService.updateCsvContent(csvContent);

      // Broadcast graph loading started
      this.messageBusService.publish({
        type: SERVICE_EVENT_TYPES.ANALYSIS_STARTED,
        source: 'GraphServiceOrchestrator',
        timestamp: new Date(),
        payload: {
          analysisType: 'structure',
          parameters: { csvContent }
        },
        priority: EventPriority.HIGH
      });

      // Delegate to analysis service
      const result = await this.analysisService.loadGraphFromCsv(csvContent, spinnerConfig);

      if (result.success) {
        // Update last activity timestamp
        this.orchestratorState.update(state => ({
          ...state,
          lastActivity: new Date(),
          lastError: null
        }));

        // Broadcast successful load
        const structure = this.graphStructure();
        if (structure) {
          this.messageBusService.publish({
            type: SERVICE_EVENT_TYPES.GRAPH_LOADED,
            source: 'GraphServiceOrchestrator',
            timestamp: new Date(),
            payload: {
              structure,
              csvContent,
              nodeCount: this.nodeCount(),
              edgeCount: this.edgeCount()
            },
            priority: EventPriority.HIGH
          });
        }
      } else {
        // Handle error
        this.orchestratorState.update(state => ({
          ...state,
          lastError: result.error || 'Graph loading failed'
        }));
      }

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load graph';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Run full analysis with current graph state
   * Coordinates between ParameterService and AnalysisService
   */
  async runFullAnalysis(
    basicParams: {
      nodePrior: number;
      edgeProb: number;
      overrideNodePrior: boolean;
      overrideEdgeProb: boolean;
    },
    advancedOptions?: {
      includeClassification?: boolean;
      enableMonteCarlo?: boolean;
      useIndividualOverrides?: boolean;
      individualNodePriors?: { [nodeId: string]: number };
      individualEdgeProbabilities?: { [edgeKey: string]: number };
    },
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; result?: FullAnalysisResponse; error?: string }> {
    
    if (!this.isGraphLoaded()) {
      return { success: false, error: 'No graph loaded. Please load CSV data first.' };
    }

    if (!this.isServiceHealthy()) {
      return { success: false, error: 'Services not ready for analysis.' };
    }

    try {
      // Update parameters in parameter service first
      this.parameterService.updateGlobalParameters({
        defaultNodePrior: basicParams.nodePrior,
        defaultEdgeProbability: basicParams.edgeProb,
        overrideNodePrior: basicParams.overrideNodePrior,
        overrideEdgeProbability: basicParams.overrideEdgeProb,
        enableMonteCarlo: advancedOptions?.enableMonteCarlo || false,
        includeClassification: advancedOptions?.includeClassification || false,
        useIndividualOverrides: advancedOptions?.useIndividualOverrides || false
      });

      // Update individual overrides if provided
      if (advancedOptions?.individualNodePriors) {
        this.parameterService.updateNodePriors(advancedOptions.individualNodePriors);
      }
      if (advancedOptions?.individualEdgeProbabilities) {
        this.parameterService.updateEdgeProbabilities(advancedOptions.individualEdgeProbabilities);
      }

      // Delegate to analysis service
      const operation = this.analysisService.runFullAnalysis({
        nodePrior: basicParams.nodePrior,
        edgeProb: basicParams.edgeProb,
        overrideNodePrior: basicParams.overrideNodePrior,
        overrideEdgeProb: basicParams.overrideEdgeProb,
        includeClassification: advancedOptions?.includeClassification,
        enableMonteCarlo: advancedOptions?.enableMonteCarlo,
        useIndividualOverrides: advancedOptions?.useIndividualOverrides,
        individualNodePriors: advancedOptions?.individualNodePriors,
        individualEdgeProbabilities: advancedOptions?.individualEdgeProbabilities
      });

      const operationResult = await operation.result;

      if (operationResult.success) {
        // Clear parameter staleness since analysis completed successfully
        this.parameterService.markParametersStale(); // Reset stale flag
        
        this.orchestratorState.update(state => ({
          ...state,
          lastActivity: new Date(),
          lastError: null
        }));

        return { success: true, result: operationResult.data as any };
      } else {
        this.orchestratorState.update(state => ({
          ...state,
          lastError: operationResult.error || 'Full analysis failed'
        }));

        return { success: false, error: operationResult.error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Full analysis failed';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Run structure analysis only
   * Delegates to AnalysisService
   */
  async runStructureAnalysis(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; result?: StructureAnalysisResponse; error?: string }> {
    
    if (!this.csvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    if (!this.isServiceHealthy()) {
      return { success: false, error: 'Services not ready for analysis.' };
    }

    try {
      const operation = this.analysisService.runStructureAnalysis();
      const operationResult = await operation.result;
      
      if (operationResult.success) {
        this.orchestratorState.update(state => ({
          ...state,
          lastActivity: new Date(),
          lastError: null
        }));

        return { success: true, result: operationResult.data as any };
      } else {
        this.orchestratorState.update(state => ({
          ...state,
          lastError: operationResult.error || 'Structure analysis failed'
        }));

        return { success: false, error: operationResult.error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Structure analysis failed';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Run diamond analysis only
   * Delegates to AnalysisService
   */
  async runDiamondAnalysis(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; result?: DiamondAnalysisResponse; error?: string }> {
    
    if (!this.csvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    if (!this.isServiceHealthy()) {
      return { success: false, error: 'Services not ready for analysis.' };
    }

    try {
      const operation = this.analysisService.runDiamondAnalysis();
      const operationResult = await operation.result;
      
      if (operationResult.success) {
        this.orchestratorState.update(state => ({
          ...state,
          lastActivity: new Date(),
          lastError: null
        }));

        return { success: true, result: operationResult.data as any };
      } else {
        this.orchestratorState.update(state => ({
          ...state,
          lastError: operationResult.error || 'Diamond analysis failed'
        }));

        return { success: false, error: operationResult.error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Diamond analysis failed';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Export current graph to DOT format
   * Delegates to AnalysisService
   */
  async exportToDot(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; dotString?: string; error?: string }> {
    
    const structure = this.graphStructure();
    if (!structure) {
      return { success: false, error: 'No graph structure available to export' };
    }

    if (!this.isServiceHealthy()) {
      return { success: false, error: 'Services not ready for export.' };
    }

    try {
      const operation = this.analysisService.exportToDot({ format: 'dot' });
      const operationResult = await operation.result;
      
      if (operationResult.success) {
        this.orchestratorState.update(state => ({
          ...state,
          lastActivity: new Date(),
          lastError: null
        }));

        return { success: true, dotString: operationResult.data?.dotString };
      } else {
        this.orchestratorState.update(state => ({
          ...state,
          lastError: operationResult.error || 'DOT export failed'
        }));

        return { success: false, error: operationResult.error };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'DOT export failed';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Clear all state across services
   */
  clearState(): void {
    try {
      // Clear state in all services
      this.graphStateService.clearState();
      this.parameterService.resetToDefaults();
      // Note: Analysis and Visualization service clearing handled via events

      // Broadcast clear event
      this.messageBusService.publish({
        type: SERVICE_EVENT_TYPES.GRAPH_CLEARED,
        source: 'GraphServiceOrchestrator',
        timestamp: new Date(),
        payload: {
          reason: 'user_action'
        },
        priority: EventPriority.NORMAL
      });

      this.orchestratorState.update(state => ({
        ...state,
        lastActivity: new Date(),
        lastError: null
      }));

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to clear state';
      this.orchestratorState.update(state => ({
        ...state,
        lastError: errorMsg
      }));
    }
  }

  /**
   * Update CSV content only
   * Delegates to GraphStateManagementService
   */
  updateCsvContent(csvContent: string): void {
    this.graphStateService.updateCsvContent(csvContent);
  }

  /**
   * Mark parameters as changed
   * Delegates to ParameterManagementService
   */
  markParametersChanged(): void {
    this.parameterService.markParametersStale();
  }

  /**
   * Clear parameters changed flag
   * Delegates to ParameterManagementService
   */
  clearParametersChanged(): void {
    // Parameter service doesn't have clearParametersStale, just reset the modified timestamp
    this.parameterService.markParametersStale();
  }

  /**
   * Get current complete state (for debugging)
   * Aggregates state from all services
   */
  getCurrentState(): GraphState {
    return this.graphStateService.getCurrentState();
  }

  // ============================================================================
  // ORCHESTRATOR-SPECIFIC PUBLIC API
  // ============================================================================

  /**
   * Get comprehensive service health status
   */
  getServiceHealth(): { [serviceName: string]: ServiceStatus } {
    return this.serviceHealthSignal();
  }

  /**
   * Get orchestrator status
   */
  getOrchestratorStatus() {
    return {
      ...this.orchestratorState(),
      serviceHealth: this.serviceHealthSignal(),
      isHealthy: this.isServiceHealthy()
    };
  }

  /**
   * Force service health check
   */
  async checkServiceHealth(): Promise<void> {
    const services = [
      { name: 'GraphStateManagement', service: this.graphStateService },
      { name: 'ParameterManagement', service: this.parameterService },
      { name: 'Analysis', service: this.analysisService },
      { name: 'Visualization', service: this.visualizationService }
    ];

    const healthStatuses: { [serviceName: string]: ServiceStatus } = {};
    let onlineCount = 0;

    for (const { name, service } of services) {
      try {
        const isHealthy = service.isHealthy();
        const status = service.getStatus();
        
        healthStatuses[name] = status;
        
        if (status.status === 'online') {
          onlineCount++;
        }
      } catch (error) {
        healthStatuses[name] = {
          service: name,
          status: 'offline',
          health: 0,
          lastActivity: new Date()
        };
      }
    }

    this.serviceHealthSignal.set(healthStatuses);
    this.orchestratorState.update(state => ({
      ...state,
      servicesOnline: onlineCount,
      isInitialized: onlineCount > 0
    }));
  }

  // ============================================================================
  // PRIVATE METHODS - SERVICE COORDINATION
  // ============================================================================

  private initializeServices(): void {
    // Services are automatically initialized via Angular DI
    // We just need to trigger health check
    setTimeout(() => {
      this.checkServiceHealth();
    }, 100);
  }

  private setupServiceCoordination(): void {
    // Listen for service events and coordinate responses
    this.messageBusService.subscribe(
      SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE,
      (event: ServiceEvent) => {
        // Coordinate state changes across services
        this.handleGraphStateChange(event);
      }
    );

    this.messageBusService.subscribe(
      SERVICE_EVENT_TYPES.PARAMETER_CHANGE,
      (event: ServiceEvent) => {
        // Coordinate parameter changes
        this.handleParameterChange(event);
      }
    );

    this.messageBusService.subscribe(
      SERVICE_EVENT_TYPES.ANALYSIS_COMPLETE,
      (event: ServiceEvent) => {
        // Coordinate post-analysis updates
        this.handleAnalysisComplete(event);
      }
    );

    this.messageBusService.subscribe(
      SERVICE_EVENT_TYPES.SERVICE_ERROR,
      (event: ServiceEvent) => {
        // Handle service errors
        this.handleServiceError(event);
      }
    );
  }

  private setupServiceHealthMonitoring(): void {
    // Periodic health check
    setInterval(() => {
      this.checkServiceHealth();
    }, 30000); // Check every 30 seconds

    // Monitor for service status events
    this.messageBusService.subscribe(
      SERVICE_EVENT_TYPES.SERVICE_STATUS,
      (event: ServiceEvent) => {
        if (event.type === 'SERVICE_STATUS') {
          this.updateServiceHealth(event.payload.service, event.payload);
        }
      }
    );
  }

  private handleGraphStateChange(event: ServiceEvent): void {
    // Update visualization service when graph state changes
    if (event.type === SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE) {
      const structure = this.graphStructure();
      if (structure) {
        this.visualizationService.updateVisualization({
          type: 'layout',
          animate: true
        });
      }
    }
  }

  private handleParameterChange(event: ServiceEvent): void {
    // Mark analysis as potentially stale
    if (event.type === SERVICE_EVENT_TYPES.PARAMETER_CHANGE) {
      this.orchestratorState.update(state => ({
        ...state,
        lastActivity: new Date()
      }));
    }
  }

  private handleAnalysisComplete(event: ServiceEvent): void {
    // Update visualization after successful analysis
    if (event.type === SERVICE_EVENT_TYPES.ANALYSIS_COMPLETE && event.payload.success) {
      this.visualizationService.updateVisualization({
        type: 'layout',
        animate: true,
        duration: 500
      });
    }
  }

  private handleServiceError(event: ServiceEvent): void {
    if (event.type === SERVICE_EVENT_TYPES.SERVICE_ERROR) {
      const errorMsg = typeof event.payload.error === 'string' 
        ? event.payload.error 
        : event.payload.error.message;
      
      this.orchestratorState.update(state => ({
        ...state,
        lastError: `${event.source}: ${errorMsg}`
      }));
    }
  }

  private updateServiceHealth(serviceName: string, status: any): void {
    this.serviceHealthSignal.update(current => ({
      ...current,
      [serviceName]: {
        service: serviceName,
        status: status.status,
        health: status.health,
        lastActivity: status.lastHeartbeat || new Date()
      }
    }));
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }
}