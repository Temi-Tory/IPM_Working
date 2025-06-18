import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, Subject, firstValueFrom, takeUntil, catchError, of } from 'rxjs';
import { 
  AnalysisServiceContract, 
  CancellableOperation, 
  ServiceOperationResult,
  AnalysisOptions,
  FullAnalysisParameters,
  ExportOptions,
  StructureAnalysisResult,
  DiamondAnalysisResult,
  FullAnalysisResult,
  DotExportResult,
  AnalysisProgress,
  AnalysisHistoryEntry,
  AnalysisStartedNotification,
  AnalysisCompleteNotification,
  BaseService,
  ServiceStatus,
  ServiceMetrics
} from '../shared/models/service-contracts.interface';
import {
  ServiceEvent,
  AnalysisStartedEvent,
  AnalysisCompleteEvent,
  AnalysisProgressEvent,
  GraphStateChangeEvent,
  ParameterChangeEvent,
  ComputationRequestEvent,
  ComputationResultEvent,
  EventPriority,
  SERVICE_EVENT_TYPES
} from '../shared/models/service-events.interface';
import { MessageBusService } from './message-bus.service';
import { MainServerService } from './main-server-service';
import { SpinnerService, SpinnerConfig } from '../shared/spinner/spinner-service/spinner-service';
import { AnalysisResult, FullAnalysisResponse, StructureAnalysisResponse, DiamondAnalysisResponse, NetworkData } from '../shared/models/main-sever-interface';
import { GraphStructure } from '../shared/models/graph-structure-interface';

@Injectable({
  providedIn: 'root'
})
export class AnalysisService implements AnalysisServiceContract {
  private messageBus = inject(MessageBusService);
  private mainServerService = inject(MainServerService);
  private spinnerService = inject(SpinnerService);

  // Service identification
  readonly serviceName = 'AnalysisService';
  readonly version = '1.0.0';

  // Internal state signals
  private _lastResults = signal<AnalysisResult[] | null>(null);
  private _lastAnalysisType = signal<'structure' | 'diamond' | 'full' | null>(null);
  private _lastAnalysisRun = signal<Date | null>(null);
  private _analysisHistory = signal<AnalysisHistoryEntry[]>([]);
  private _currentProgress = signal<AnalysisProgress | null>(null);
  private _isAnalysisRunning = signal<boolean>(false);
  private _operationMetrics = signal<ServiceMetrics>({
    operationsPerformed: 0,
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0
  });

  // Current state from other services
  private _currentCsvContent = signal<string>('');
  private _currentStructure = signal<GraphStructure | null>(null);
  private _isGraphLoaded = signal<boolean>(false);

  // Analysis operation subjects
  private analysisStartedSubject = new Subject<AnalysisStartedNotification>();
  private analysisCompleteSubject = new Subject<AnalysisCompleteNotification>();
  private analysisProgressSubject = new Subject<AnalysisProgress>();

  // Active operations tracking
  private activeOperations = new Map<string, Subject<void>>();

  // Public computed signals
  readonly lastResults = computed(() => this._lastResults());
  readonly lastAnalysisType = computed(() => this._lastAnalysisType());
  readonly lastAnalysisRun = computed(() => this._lastAnalysisRun());

  constructor() {
    this.subscribeToEvents();
  }

  // BaseService interface implementation
  isHealthy(): boolean {
    const metrics = this._operationMetrics();
    return metrics.errorRate < 0.1; // Less than 10% error rate
  }

  getStatus(): ServiceStatus {
    const metrics = this._operationMetrics();
    return {
      service: this.serviceName,
      status: this.isHealthy() ? 'online' : 'degraded',
      health: Math.max(0, 100 - (metrics.errorRate * 100)),
      lastActivity: this._lastAnalysisRun() || new Date(),
      metrics
    };
  }

  // AnalysisServiceContract implementation
  runStructureAnalysis(options?: AnalysisOptions): CancellableOperation<StructureAnalysisResult> {
    const operationId = this.generateOperationId();
    const cancellationSubject = new Subject<void>();
    this.activeOperations.set(operationId, cancellationSubject);

    const resultPromise = this.executeStructureAnalysis(cancellationSubject.asObservable(), options);

    return {
      result: resultPromise,
      cancel: () => {
        cancellationSubject.next();
        cancellationSubject.complete();
        this.activeOperations.delete(operationId);
      }
    };
  }

  runDiamondAnalysis(options?: AnalysisOptions): CancellableOperation<DiamondAnalysisResult> {
    const operationId = this.generateOperationId();
    const cancellationSubject = new Subject<void>();
    this.activeOperations.set(operationId, cancellationSubject);

    const resultPromise = this.executeDiamondAnalysis(cancellationSubject.asObservable(), options);

    return {
      result: resultPromise,
      cancel: () => {
        cancellationSubject.next();
        cancellationSubject.complete();
        this.activeOperations.delete(operationId);
      }
    };
  }

  runFullAnalysis(parameters: FullAnalysisParameters): CancellableOperation<FullAnalysisResult> {
    const operationId = this.generateOperationId();
    const cancellationSubject = new Subject<void>();
    this.activeOperations.set(operationId, cancellationSubject);

    const resultPromise = this.executeFullAnalysis(parameters, cancellationSubject.asObservable());

    return {
      result: resultPromise,
      cancel: () => {
        cancellationSubject.next();
        cancellationSubject.complete();
        this.activeOperations.delete(operationId);
      }
    };
  }

  exportToDot(options?: ExportOptions): CancellableOperation<DotExportResult> {
    const operationId = this.generateOperationId();
    const cancellationSubject = new Subject<void>();
    this.activeOperations.set(operationId, cancellationSubject);

    const resultPromise = this.executeExportToDot(cancellationSubject.asObservable(), options);

    return {
      result: resultPromise,
      cancel: () => {
        cancellationSubject.next();
        cancellationSubject.complete();
        this.activeOperations.delete(operationId);
      }
    };
  }

  getLastAnalysisResults(): AnalysisResult[] | null {
    return this._lastResults();
  }

  getAnalysisHistory(): AnalysisHistoryEntry[] {
    return this._analysisHistory();
  }

  isAnalysisRunning(): boolean {
    return this._isAnalysisRunning();
  }

  getAnalysisProgress(): AnalysisProgress | null {
    return this._currentProgress();
  }

  onAnalysisStart(): Observable<AnalysisStartedNotification> {
    return this.analysisStartedSubject.asObservable();
  }

  onAnalysisComplete(): Observable<AnalysisCompleteNotification> {
    return this.analysisCompleteSubject.asObservable();
  }

  onAnalysisProgress(): Observable<AnalysisProgress> {
    return this.analysisProgressSubject.asObservable();
  }

  // Public methods for CSV loading (extracted from original service)
  async loadGraphFromCsv(
    csvContent: string,
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; error?: string }> {
    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Loading graph structure...',
      showCancelButton: true,
      ...spinnerConfig
    });

    const startTime = Date.now();
    const operationId = this.generateOperationId();

    try {
      // Publish analysis started event
      this.publishAnalysisStarted('structure', {});

      // Update internal state
      this._currentCsvContent.set(csvContent);
      this._isAnalysisRunning.set(true);

      // Run structure analysis first
      const structureResult = await firstValueFrom(
        this.mainServerService
          .analyzeStructure({ csvContent })
          .pipe(
            takeUntil(cancellationToken),
            catchError((analysisError: unknown) => {
              console.error('Structure analysis failed:', analysisError);
              return of(null);
            })
          )
      );

      if (!structureResult?.success) {
        const errorMsg = structureResult?.error || 'Structure analysis failed';
        this.publishAnalysisComplete('structure', false, Date.now() - startTime, errorMsg);
        return { success: false, error: errorMsg };
      }

      // Update spinner message
      this.spinnerService.updateConfig(spinnerId, { 
        message: 'Analyzing diamond structures...' 
      });

      // Run diamond analysis
      const diamondResult = await firstValueFrom(
        this.mainServerService
          .analyzeDiamonds({ csvContent })
          .pipe(
            takeUntil(cancellationToken),
            catchError((analysisError: unknown) => {
              console.error('Diamond analysis failed:', analysisError);
              return of(null);
            })
          )
      );

      // Build graph structure from results
      const structure = this.buildGraphStructure(structureResult, diamondResult ?? null);
      
      // Update internal state
      this._currentStructure.set(structure);
      this._isGraphLoaded.set(true);
      this._lastAnalysisType.set('diamond');
      this._lastAnalysisRun.set(new Date());

      // Publish graph loaded event
      this.messageBus.publish({
        type: 'GRAPH_LOADED',
        source: this.serviceName,
        timestamp: new Date(),
        payload: {
          structure,
          csvContent,
          nodeCount: this.extractUniqueNodes(structure.edgelist).length,
          edgeCount: structure.edgelist.length
        },
        priority: EventPriority.HIGH
      });

      // Publish analysis complete event
      this.publishAnalysisComplete('structure', true, Date.now() - startTime);

      // Add to history
      this.addToHistory('structure', Date.now() - startTime, true);

      return { success: true };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Failed to load graph';
      this.publishAnalysisComplete('structure', false, Date.now() - startTime, errorMsg);
      this.addToHistory('structure', Date.now() - startTime, false, errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this._isAnalysisRunning.set(false);
      this.spinnerService.hide(spinnerId);
      this.activeOperations.delete(operationId);
    }
  }

  // Private execution methods (extracted from original service)
  private async executeStructureAnalysis(
    cancellationToken: Observable<void>,
    options?: AnalysisOptions
  ): Promise<ServiceOperationResult<StructureAnalysisResult>> {
    const startTime = Date.now();
    
    if (!this._currentCsvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    const { id: spinnerId, cancellationToken: spinnerCancellation } = this.spinnerService.show({
      message: 'Analyzing structure...',
      showCancelButton: true
    });

    try {
      this.publishAnalysisStarted('structure', options);
      this._isAnalysisRunning.set(true);

      const result = await firstValueFrom(
        this.mainServerService
          .analyzeStructure({ csvContent: this._currentCsvContent() })
          .pipe(
            takeUntil(cancellationToken),
            takeUntil(spinnerCancellation),
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Structure analysis failed';
        this.publishAnalysisComplete('structure', false, Date.now() - startTime, errorMsg);
        return { success: false, error: errorMsg };
      }

      // Update structure if not already loaded
      if (!this._isGraphLoaded()) {
        const structure = this.buildGraphStructure(result, null);
        this._currentStructure.set(structure);
        this._isGraphLoaded.set(true);
        this._lastAnalysisType.set('structure');
        this._lastAnalysisRun.set(new Date());
      }

      const analysisResult: StructureAnalysisResult = {
        networkData: result.networkData,
        metrics: {
          nodeCount: result.networkData.nodeCount,
          edgeCount: result.networkData.edgeCount,
          sourceNodeCount: result.networkData.sourceNodes.length,
          sinkNodeCount: 0, // Calculated on server
          forkNodeCount: result.networkData.forkNodes.length,
          joinNodeCount: result.networkData.joinNodes.length,
          complexityScore: 0 // TODO: Implement complexity score calculation
        },
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime
        }
      };

      this.publishAnalysisComplete('structure', true, Date.now() - startTime);
      this.addToHistory('structure', Date.now() - startTime, true);

      return { 
        success: true, 
        data: analysisResult,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Structure analysis failed';
      this.publishAnalysisComplete('structure', false, Date.now() - startTime, errorMsg);
      this.addToHistory('structure', Date.now() - startTime, false, errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this._isAnalysisRunning.set(false);
      this.spinnerService.hide(spinnerId);
    }
  }

  private async executeDiamondAnalysis(
    cancellationToken: Observable<void>,
    options?: AnalysisOptions
  ): Promise<ServiceOperationResult<DiamondAnalysisResult>> {
    const startTime = Date.now();
    
    if (!this._currentCsvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    const { id: spinnerId, cancellationToken: spinnerCancellation } = this.spinnerService.show({
      message: 'Analyzing diamonds...',
      showCancelButton: true
    });

    try {
      this.publishAnalysisStarted('diamond', options);
      this._isAnalysisRunning.set(true);

      const result = await firstValueFrom(
        this.mainServerService
          .analyzeDiamonds({ csvContent: this._currentCsvContent() })
          .pipe(
            takeUntil(cancellationToken),
            takeUntil(spinnerCancellation),
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Diamond analysis failed';
        this.publishAnalysisComplete('diamond', false, Date.now() - startTime, errorMsg);
        return { success: false, error: errorMsg };
      }

      // Update diamond structures in current graph state
      const currentStructure = this._currentStructure();
      if (currentStructure) {
        const updatedStructure = {
          ...currentStructure,
          diamond_structures: result.diamondData
        };
        this._currentStructure.set(updatedStructure);
        this._lastAnalysisType.set('diamond');
        this._lastAnalysisRun.set(new Date());
      }

      const analysisResult: DiamondAnalysisResult = {
        diamondData: result.diamondData!,
        metrics: {
          diamondCount: result.diamondData?.diamondClassifications.length || 0,
          averageDiamondSize: result.diamondData ? this.calculateAverageDiamondSize(result.diamondData) : 0,
          maxDiamondSize: result.diamondData ? this.calculateMaxDiamondSize(result.diamondData) : 0,
          diamondDensity: result.diamondData ? this.calculateDiamondDensity(result.diamondData) : 0
        },
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime
        }
      };

      this.publishAnalysisComplete('diamond', true, Date.now() - startTime);
      this.addToHistory('diamond', Date.now() - startTime, true);

      return { 
        success: true, 
        data: analysisResult,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Diamond analysis failed';
      this.publishAnalysisComplete('diamond', false, Date.now() - startTime, errorMsg);
      this.addToHistory('diamond', Date.now() - startTime, false, errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this._isAnalysisRunning.set(false);
      this.spinnerService.hide(spinnerId);
    }
  }

  private async executeFullAnalysis(
    parameters: FullAnalysisParameters,
    cancellationToken: Observable<void>
  ): Promise<ServiceOperationResult<FullAnalysisResult>> {
    const startTime = Date.now();
    
    if (!this._isGraphLoaded()) {
      return { success: false, error: 'No graph loaded. Please load CSV data first.' };
    }

    const { id: spinnerId, cancellationToken: spinnerCancellation } = this.spinnerService.show({
      message: 'Running full analysis...',
      showCancelButton: true
    });

    try {
      this.publishAnalysisStarted('full', parameters);
      this._isAnalysisRunning.set(true);

      const request = this.mainServerService.buildEnhancedRequest(
        this._currentCsvContent(),
        {
          nodePrior: parameters.nodePrior,
          edgeProb: parameters.edgeProb,
          overrideNodePrior: parameters.overrideNodePrior,
          overrideEdgeProb: parameters.overrideEdgeProb
        },
        {
          includeClassification: parameters.includeClassification,
          enableMonteCarlo: parameters.enableMonteCarlo,
          useIndividualOverrides: parameters.useIndividualOverrides,
          individualNodePriors: parameters.individualNodePriors,
          individualEdgeProbabilities: parameters.individualEdgeProbabilities
        }
      );

      const result = await firstValueFrom(
        this.mainServerService
          .analyzeEnhanced(request)
          .pipe(
            takeUntil(cancellationToken),
            takeUntil(spinnerCancellation),
            catchError((analysisError: unknown) => {
              console.error('Full analysis failed:', analysisError);
              return of(null);
            })
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Full analysis failed';
        this.publishAnalysisComplete('full', false, Date.now() - startTime, errorMsg);
        return { success: false, error: errorMsg };
      }

      // Update state with results
      this._lastResults.set(result.results);
      this._lastAnalysisType.set('full');
      this._lastAnalysisRun.set(new Date());

      // Update graph structure if parameter modifications were made
      if (result.parameterModifications) {
        this.handleParameterModifications(result);
      }

      const analysisResult: FullAnalysisResult = {
        results: result.results,
        parameterModifications: result.parameterModifications ? {
          totalNodesModified: result.parameterModifications.totalNodesModified,
          totalEdgesModified: result.parameterModifications.totalEdgesModified,
          modificationSummary: `${result.parameterModifications.totalNodesModified} nodes, ${result.parameterModifications.totalEdgesModified} edges modified`
        } : undefined,
        metrics: {
          nodeCount: this._currentStructure()?.edgelist ? this.extractUniqueNodes(this._currentStructure()!.edgelist).length : 0,
          edgeCount: this._currentStructure()?.edgelist?.length || 0,
          sourceNodeCount: this._currentStructure()?.source_nodes?.length || 0,
          sinkNodeCount: 0,
          forkNodeCount: this._currentStructure()?.fork_nodes?.length || 0,
          joinNodeCount: this._currentStructure()?.join_nodes?.length || 0,
          complexityScore: 0,
          diamondCount: this._currentStructure()?.diamond_structures?.diamondClassifications?.length || 0,
          averageDiamondSize: 0,
          maxDiamondSize: 0,
          diamondDensity: 0,
          totalComputationTime: Date.now() - startTime,
          memoryPeakUsage: 0,
          iterationCount: 0,
          convergenceAchieved: true
        },
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime
        }
      };

      this.publishAnalysisComplete('full', true, Date.now() - startTime);
      this.addToHistory('full', Date.now() - startTime, true, undefined, parameters);

      return { 
        success: true, 
        data: analysisResult,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Full analysis failed';
      this.publishAnalysisComplete('full', false, Date.now() - startTime, errorMsg);
      this.addToHistory('full', Date.now() - startTime, false, errorMsg, parameters);
      return { success: false, error: errorMsg };
    } finally {
      this._isAnalysisRunning.set(false);
      this.spinnerService.hide(spinnerId);
    }
  }

  private async executeExportToDot(
    cancellationToken: Observable<void>,
    options?: ExportOptions
  ): Promise<ServiceOperationResult<DotExportResult>> {
    const startTime = Date.now();
    
    const structure = this._currentStructure();
    if (!structure) {
      return { success: false, error: 'No graph structure available to export' };
    }

    const { id: spinnerId, cancellationToken: spinnerCancellation } = this.spinnerService.show({
      message: 'Exporting to DOT format...',
      showCancelButton: true
    });

    try {
      this.publishAnalysisStarted('export', options);
      this._isAnalysisRunning.set(true);

      // Build network data for export
      const networkData: NetworkData = {
        nodes: this.extractUniqueNodes(structure.edgelist),
        edges: structure.edgelist,
        sourceNodes: structure.source_nodes,
        sinkNodes: [], // Will be calculated on server
        forkNodes: structure.fork_nodes,
        joinNodes: structure.join_nodes,
        iterationSets: structure.iteration_sets,
        nodeCount: this.extractUniqueNodes(structure.edgelist).length,
        edgeCount: structure.edgelist.length,
        ancestors: structure.ancestors,
        descendants: structure.descendants
      };

      const result = await firstValueFrom(
        this.mainServerService
          .exportDot({ networkData })
          .pipe(
            takeUntil(cancellationToken),
            takeUntil(spinnerCancellation),
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'DOT export failed';
        this.publishAnalysisComplete('export', false, Date.now() - startTime, errorMsg);
        return { success: false, error: errorMsg };
      }

      const exportResult: DotExportResult = {
        dotString: result.dotString,
        metadata: {
          format: 'dot',
          size: result.dotString.length
        },
        timing: {
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime
        }
      };

      this.publishAnalysisComplete('export', true, Date.now() - startTime);
      this.addToHistory('export', Date.now() - startTime, true);

      return { 
        success: true, 
        data: exportResult,
        metadata: {
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'DOT export failed';
      this.publishAnalysisComplete('export', false, Date.now() - startTime, errorMsg);
      this.addToHistory('export', Date.now() - startTime, false, errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this._isAnalysisRunning.set(false);
      this.spinnerService.hide(spinnerId);
    }
  }

  // Private helper methods
  private subscribeToEvents(): void {
    // Subscribe to graph state changes
    this.messageBus.subscribe<GraphStateChangeEvent>(
      SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE,
      (event) => {
        if (event.payload.changedFields.includes('csvContent')) {
          this._currentCsvContent.set(event.payload.newState.csvContent || '');
        }
        if (event.payload.changedFields.includes('structure')) {
          this._currentStructure.set(event.payload.newState.structure || null);
        }
        if (event.payload.changedFields.includes('isLoaded')) {
          this._isGraphLoaded.set(event.payload.newState.isLoaded || false);
        }
      }
    );

    // Subscribe to parameter changes
    this.messageBus.subscribe<ParameterChangeEvent>(
      SERVICE_EVENT_TYPES.PARAMETER_CHANGE,
      (event) => {
        // Mark analysis as potentially stale when parameters change
        console.log('Parameters changed, analysis may be stale');
      }
    );
  }

  private publishAnalysisStarted(analysisType: string, parameters?: any): void {
    const event: AnalysisStartedEvent = {
      type: 'ANALYSIS_STARTED',
      source: this.serviceName,
      timestamp: new Date(),
      payload: {
        analysisType: analysisType as any,
        parameters
      },
      priority: EventPriority.HIGH
    };

    this.messageBus.publish(event);
    
    const notification: AnalysisStartedNotification = {
      analysisType,
      parameters,
      timestamp: new Date()
    };
    
    this.analysisStartedSubject.next(notification);
  }

  private publishAnalysisComplete(analysisType: string, success: boolean, duration: number, error?: string): void {
    const event: AnalysisCompleteEvent = {
      type: 'ANALYSIS_COMPLETE',
      source: this.serviceName,
      timestamp: new Date(),
      payload: {
        analysisType: analysisType as any,
        success,
        duration,
        error
      },
      priority: EventPriority.HIGH
    };

    this.messageBus.publish(event);
    
    const notification: AnalysisCompleteNotification = {
      analysisType,
      success,
      duration,
      error,
      timestamp: new Date()
    };
    
    this.analysisCompleteSubject.next(notification);
  }

  private generateOperationId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(
    type: 'structure' | 'diamond' | 'full' | 'export',
    duration: number,
    success: boolean,
    error?: string,
    parameters?: any
  ): void {
    const entry: AnalysisHistoryEntry = {
      id: this.generateOperationId(),
      type,
      timestamp: new Date(),
      duration,
      success,
      parameters,
      error
    };

    this._analysisHistory.update(history => [entry, ...history.slice(0, 49)]); // Keep last 50 entries
  }

  // Helper methods extracted from original service
  private buildGraphStructure(
    structureResult: StructureAnalysisResponse,
    diamondResult: DiamondAnalysisResponse | null
  ): GraphStructure {
    const networkData = structureResult.networkData;
    
    return {
      edgelist: networkData.edges,
      iteration_sets: networkData.iterationSets,
      outgoing_index: this.buildIndexFromEdges(networkData.edges, 'outgoing'),
      incoming_index: this.buildIndexFromEdges(networkData.edges, 'incoming'),
      source_nodes: networkData.sourceNodes,
      descendants: networkData.descendants,
      ancestors: networkData.ancestors,
      join_nodes: networkData.joinNodes,
      fork_nodes: networkData.forkNodes,
      node_priors: structureResult.originalData.nodePriors,
      edge_probabilities: structureResult.originalData.edgeProbabilities,
      diamond_structures: diamondResult?.diamondData || null
    };
  }

  private buildIndexFromEdges(
    edges: [number, number][],
    type: 'outgoing' | 'incoming'
  ): { [key: number]: number[] } {
    const index: { [key: number]: number[] } = {};
    
    edges.forEach(([from, to]) => {
      const key = type === 'outgoing' ? from : to;
      const value = type === 'outgoing' ? to : from;
      
      if (!index[key]) {
        index[key] = [];
      }
      index[key].push(value);
    });
    
    return index;
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  private handleParameterModifications(result: FullAnalysisResponse): void {
    // Log parameter modification statistics from analysis
    const structure = this._currentStructure();
    if (structure && result.parameterModifications) {
      const mods = result.parameterModifications;
      if (mods.totalNodesModified > 0 || mods.totalEdgesModified > 0) {
        // Publish parameter change event to notify other services
        this.messageBus.publish({
          type: 'PARAMETER_CHANGE',
          source: this.serviceName,
          timestamp: new Date(),
          payload: {
            parameterType: 'global_config',
            isStale: false
          },
          priority: EventPriority.NORMAL
        });
      }
    }
  }

  // Diamond analysis helper methods
  private calculateAverageDiamondSize(diamondData: any): number {
    if (!diamondData?.diamondClassifications?.length) return 0;
    
    const totalSize = diamondData.diamondClassifications.reduce((sum: number, diamond: any) => {
      return sum + (diamond.nodes?.length || 0);
    }, 0);
    
    return totalSize / diamondData.diamondClassifications.length;
  }

  private calculateMaxDiamondSize(diamondData: any): number {
    if (!diamondData?.diamondClassifications?.length) return 0;
    
    return diamondData.diamondClassifications.reduce((max: number, diamond: any) => {
      const size = diamond.nodes?.length || 0;
      return Math.max(max, size);
    }, 0);
  }

  private calculateDiamondDensity(diamondData: any): number {
    if (!diamondData?.diamondClassifications?.length) return 0;
    
    const structure = this._currentStructure();
    if (!structure?.edgelist?.length) return 0;
    
    const totalNodes = this.extractUniqueNodes(structure.edgelist).length;
    const diamondNodes = new Set();
    
    diamondData.diamondClassifications.forEach((diamond: any) => {
      if (diamond.nodes) {
        diamond.nodes.forEach((node: number) => diamondNodes.add(node));
      }
    });
    
    return totalNodes > 0 ? diamondNodes.size / totalNodes : 0;
  }
}