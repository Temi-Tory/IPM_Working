/**
 * VisualizationService - Specialized service for graph visualization and data transformation
 * 
 * Handles data transformation from analysis results to visualization-ready format,
 * graph metrics calculation, and coordination with visualization components.
 * 
 * Extracted from GraphStateService as part of architectural refactoring.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { MessageBusService } from './message-bus.service';
import { 
  VisualizationServiceContract, 
  ServiceOperationResult, 
  RenderMode, 
  ImageFormat,
  VisibleElements,
  VisualizationUpdate,
  ElementSelection,
  BaseService,
  ServiceStatus,
  ServiceMetrics
} from '../shared/models/service-contracts.interface';
import {
  VisualizationUpdateEvent,
  VisualizationStateEvent,
  ComputationResultEvent,
  GraphStateChangeEvent,
  EventPriority,
  SERVICE_EVENT_TYPES,
  ServiceEventListener
} from '../shared/models/service-events.interface';
import { GraphStructure } from '../shared/models/graph-structure-interface';
import { 
  StructureAnalysisResponse, 
  DiamondAnalysisResponse, 
  NetworkData 
} from '../shared/models/main-sever-interface';

@Injectable({
  providedIn: 'root'
})
export class VisualizationService implements VisualizationServiceContract {
  private readonly messageBus = inject(MessageBusService);

  // Service identification
  readonly serviceName = 'VisualizationService';
  readonly version = '1.0.0';

  // Internal state signals
  private readonly _isVisualizationReady = signal<boolean>(false);
  private readonly _currentRenderMode = signal<RenderMode>('force');
  private readonly _visibleElements = signal<VisibleElements>({
    nodes: [],
    edges: [],
    totalNodes: 0,
    totalEdges: 0
  });
  private readonly _selectedElements = signal<string[]>([]);
  private readonly _currentGraphStructure = signal<GraphStructure | null>(null);

  // Service health tracking
  private readonly _serviceHealth = signal<number>(100);
  private readonly _lastActivity = signal<Date>(new Date());
  private readonly _operationCount = signal<number>(0);
  private readonly _errorCount = signal<number>(0);

  // Public computed properties from contract
  readonly isVisualizationReady = computed(() => this._isVisualizationReady());
  readonly getCurrentRenderMode = computed(() => this._currentRenderMode());
  readonly getVisibleElements = computed(() => this._visibleElements());
  readonly getSelectedElements = computed(() => this._selectedElements());

  // Graph metrics - extracted from original service
  readonly nodeCount = computed(() => {
    const structure = this._currentGraphStructure();
    if (!structure?.edgelist) return 0;
    return this.extractUniqueNodes(structure.edgelist).length;
  });

  readonly edgeCount = computed(() => {
    const structure = this._currentGraphStructure();
    return structure?.edgelist?.length || 0;
  });

  readonly hasDiamonds = computed(() => {
    const structure = this._currentGraphStructure();
    const diamondClassifications = structure?.diamond_structures?.diamondClassifications;
    return Boolean(diamondClassifications && diamondClassifications.length > 0);
  });

  readonly sourceNodeCount = computed(() => {
    const structure = this._currentGraphStructure();
    return structure?.source_nodes?.length || 0;
  });

  readonly joinNodeCount = computed(() => {
    const structure = this._currentGraphStructure();
    return structure?.join_nodes?.length || 0;
  });

  readonly forkNodeCount = computed(() => {
    const structure = this._currentGraphStructure();
    return structure?.fork_nodes?.length || 0;
  });

  // Complex metrics calculation
  readonly complexityScore = computed(() => {
    const structure = this._currentGraphStructure();
    if (!structure) return 0;
    
    const nodes = this.nodeCount();
    const edges = this.edgeCount();
    const diamonds = this.hasDiamonds() ? 1 : 0;
    const forks = this.forkNodeCount();
    const joins = this.joinNodeCount();
    
    // Calculate complexity based on structure characteristics
    return Math.round(
      (nodes * 0.1) + 
      (edges * 0.15) + 
      (diamonds * 2.0) + 
      (forks * 0.5) + 
      (joins * 0.5)
    );
  });

  constructor() {
    this.setupEventListeners();
    this._lastActivity.set(new Date());
  }

  // Service contract implementation
  isHealthy(): boolean {
    return this._serviceHealth() > 50;
  }

  getStatus(): ServiceStatus {
    const health = this._serviceHealth();
    let status: 'online' | 'offline' | 'degraded' | 'maintenance';
    
    if (health > 80) status = 'online';
    else if (health > 50) status = 'degraded';
    else if (health > 0) status = 'maintenance';
    else status = 'offline';

    return {
      service: this.serviceName,
      status,
      health,
      lastActivity: this._lastActivity(),
      metrics: {
        operationsPerformed: this._operationCount(),
        averageResponseTime: 50, // Mock value
        errorRate: this._errorCount() / Math.max(1, this._operationCount()) * 100,
        cacheHitRate: 85, // Mock value
        memoryUsage: 256 // Mock value in MB
      }
    };
  }

  // Visualization operations
  updateVisualization(update: VisualizationUpdate): ServiceOperationResult<void> {
    try {
      this.incrementOperationCount();
      
      // Update visible elements based on update type
      if (update.type === 'filter' && (update.targetNodes || update.targetEdges)) {
        const currentVisible = this._visibleElements();
        this._visibleElements.set({
          ...currentVisible,
          nodes: update.targetNodes || currentVisible.nodes,
          edges: update.targetEdges || currentVisible.edges
        });
      }

      // Publish visualization update event
      this.publishVisualizationUpdate(update);

      return {
        success: true,
        metadata: {
          executionTime: 5,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update visualization failed'
      };
    }
  }

  highlightElements(elements: ElementSelection): ServiceOperationResult<void> {
    try {
      this.incrementOperationCount();
      
      const elementIds = [
        ...(elements.nodes?.map(String) || []),
        ...(elements.edges || [])
      ];
      
      this._selectedElements.set(elementIds);

      // Publish highlight update
      this.publishVisualizationUpdate({
        type: 'highlight',
        targetNodes: elements.nodes,
        targetEdges: elements.edges,
        properties: elements.style
      });

      return {
        success: true,
        metadata: {
          executionTime: 3,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Highlight elements failed'
      };
    }
  }

  clearHighlights(): ServiceOperationResult<void> {
    try {
      this.incrementOperationCount();
      this._selectedElements.set([]);
      
      this.publishVisualizationUpdate({
        type: 'selection',
        targetNodes: [],
        targetEdges: []
      });

      return {
        success: true,
        metadata: {
          executionTime: 2,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Clear highlights failed'
      };
    }
  }

  setRenderMode(mode: RenderMode): ServiceOperationResult<void> {
    try {
      this.incrementOperationCount();
      this._currentRenderMode.set(mode);
      
      this.publishVisualizationUpdate({
        type: 'layout',
        properties: { renderMode: mode }
      });

      return {
        success: true,
        metadata: {
          executionTime: 10,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Set render mode failed'
      };
    }
  }

  fitToView(): ServiceOperationResult<void> {
    try {
      this.incrementOperationCount();
      
      this.publishVisualizationUpdate({
        type: 'zoom',
        properties: { action: 'fit' },
        animate: true,
        duration: 500
      });

      return {
        success: true,
        metadata: {
          executionTime: 8,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fit to view failed'
      };
    }
  }

  exportVisualization(format: ImageFormat): ServiceOperationResult<string> {
    try {
      this.incrementOperationCount();
      
      // Mock export functionality - in real implementation would capture canvas/svg
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mockData = `data:image/${format};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
      
      return {
        success: true,
        data: mockData,
        metadata: {
          executionTime: 15,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export visualization failed'
      };
    }
  }

  // Event subscriptions (simplified - in full implementation would use proper observables)
  onVisualizationUpdate(): Observable<any> {
    return new Subject().asObservable();
  }

  onSelectionChange(): Observable<any> {
    return new Subject().asObservable();
  }

  onRenderComplete(): Observable<any> {
    return new Subject().asObservable();
  }

  /**
   * Complex method extracted from original GraphStateService
   * Transforms analysis results into GraphStructure format
   */
  buildGraphStructure(
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

  /**
   * Utility method extracted from original GraphStateService
   * Builds index mapping for graph traversal
   */
  buildIndexFromEdges(
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

  /**
   * Utility method extracted from original GraphStateService
   * Extracts unique node IDs from edge list
   */
  extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  /**
   * Export functionality extracted from original GraphStateService
   * Exports graph structure to DOT format
   */
  exportToDot(structure?: GraphStructure): ServiceOperationResult<string> {
    try {
      this.incrementOperationCount();
      
      const graphStructure = structure || this._currentGraphStructure();
      if (!graphStructure) {
        return {
          success: false,
          error: 'No graph structure available to export'
        };
      }

      // Build network data for export
      const networkData: NetworkData = {
        nodes: this.extractUniqueNodes(graphStructure.edgelist),
        edges: graphStructure.edgelist,
        sourceNodes: graphStructure.source_nodes,
        sinkNodes: [], // Will be calculated
        forkNodes: graphStructure.fork_nodes,
        joinNodes: graphStructure.join_nodes,
        iterationSets: graphStructure.iteration_sets,
        nodeCount: this.extractUniqueNodes(graphStructure.edgelist).length,
        edgeCount: graphStructure.edgelist.length,
        ancestors: graphStructure.ancestors,
        descendants: graphStructure.descendants
      };

      // Generate DOT string (simplified version)
      const dotString = this.generateDotString(networkData);

      return {
        success: true,
        data: dotString,
        metadata: {
          executionTime: 12,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.incrementErrorCount();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DOT export failed'
      };
    }
  }

  /**
   * Update current graph structure and trigger visualization updates
   */
  updateGraphStructure(structure: GraphStructure | null): void {
    this._currentGraphStructure.set(structure);
    
    if (structure) {
      const nodes = this.extractUniqueNodes(structure.edgelist);
      const edges = structure.edgelist.map(([from, to]) => `${from}-${to}`);
      
      this._visibleElements.set({
        nodes: nodes,
        edges: edges,
        totalNodes: nodes.length,
        totalEdges: structure.edgelist.length
      });
      
      this._isVisualizationReady.set(true);
    } else {
      this._visibleElements.set({
        nodes: [],
        edges: [],
        totalNodes: 0,
        totalEdges: 0
      });
      
      this._isVisualizationReady.set(false);
    }

    // Publish state change
    this.publishVisualizationState();
  }

  // Private helper methods
  private setupEventListeners(): void {
    // Subscribe to computation results
    this.messageBus.subscribe<ComputationResultEvent>(
      SERVICE_EVENT_TYPES.COMPUTATION_RESULT,
      this.handleComputationResult.bind(this)
    );

    // Subscribe to graph state changes
    this.messageBus.subscribe<GraphStateChangeEvent>(
      SERVICE_EVENT_TYPES.GRAPH_STATE_CHANGE,
      this.handleGraphStateChange.bind(this)
    );
  }

  private handleComputationResult: ServiceEventListener<ComputationResultEvent> = (event) => {
    if (event.payload.success && event.payload.results) {
      // Process analysis results and update visualization data
      this.processAnalysisResults(event.payload.results);
    }
    this._lastActivity.set(new Date());
  };

  private handleGraphStateChange: ServiceEventListener<GraphStateChangeEvent> = (event) => {
    // Update visualization based on graph state changes
    if (event.payload.newState.structure !== undefined) {
      this.updateGraphStructure(event.payload.newState.structure);
    }
    this._lastActivity.set(new Date());
  };

  private processAnalysisResults(results: any): void {
    // Transform analysis results for visualization
    // This would be expanded based on specific result types
    this.incrementOperationCount();
  }

  private publishVisualizationUpdate(update: VisualizationUpdate): void {
    const event: VisualizationUpdateEvent = {
      type: 'VISUALIZATION_UPDATE',
      timestamp: new Date(),
      source: this.serviceName,
      payload: {
        updateType: update.type,
        targetNodes: update.targetNodes,
        targetEdges: update.targetEdges,
        properties: update.properties
      },
      priority: EventPriority.NORMAL
    };

    this.messageBus.publish(event);
  }

  private publishVisualizationState(): void {
    const visibleElements = this._visibleElements();
    const event: VisualizationStateEvent = {
      type: 'VISUALIZATION_STATE',
      timestamp: new Date(),
      source: this.serviceName,
      payload: {
        isReady: this._isVisualizationReady(),
        renderMode: this._currentRenderMode() === 'layered' ? 'hierarchical' : this._currentRenderMode() as 'force' | 'hierarchical' | 'circular',
        visibleNodes: visibleElements.nodes,
        visibleEdges: visibleElements.edges,
        selectedElements: this._selectedElements()
      },
      priority: EventPriority.NORMAL
    };

    this.messageBus.publish(event);
  }

  private generateDotString(networkData: NetworkData): string {
    // Simplified DOT generation
    let dot = 'digraph G {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=circle];\n\n';

    // Add nodes
    networkData.nodes.forEach(node => {
      dot += `  ${node};\n`;
    });

    dot += '\n';

    // Add edges
    networkData.edges.forEach(([from, to]) => {
      dot += `  ${from} -> ${to};\n`;
    });

    dot += '}\n';
    return dot;
  }

  private incrementOperationCount(): void {
    this._operationCount.update(count => count + 1);
    this._lastActivity.set(new Date());
  }

  private incrementErrorCount(): void {
    this._errorCount.update(count => count + 1);
    this._serviceHealth.update(health => Math.max(0, health - 5));
  }
}