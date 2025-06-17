// src/app/shared/spinner/spinner-service/graph-state.service.ts

import { Injectable, inject, signal, computed } from "@angular/core";
import { takeUntil, catchError, of, firstValueFrom } from "rxjs";
import { MainServerService } from "./main-server-service";
import { GraphState, GraphStructure } from "../shared/models/graph-structure-interface";
import { FullAnalysisResponse, StructureAnalysisResponse, DiamondAnalysisResponse, NetworkData } from "../shared/models/main-sever-interface";
import { SpinnerService, SpinnerConfig } from "../shared/spinner/spinner-service/spinner-service";

@Injectable({
  providedIn: 'root'
})
export class GraphStateService {
  private mainServerService = inject(MainServerService);
  private spinnerService = inject(SpinnerService);

  // State signals
  private state = signal<GraphState>({
    isLoaded: false,
    csvContent: '',
    structure: null,
    lastAnalysisResults: null,
    lastAnalysisType: null,
    error: null,
    loadedAt: null
  });

  // Public computed signals
  readonly isGraphLoaded = computed(() => this.state().isLoaded);
  readonly csvContent = computed(() => this.state().csvContent);
  readonly graphStructure = computed(() => this.state().structure);
  readonly lastResults = computed(() => this.state().lastAnalysisResults);
  readonly lastAnalysisType = computed(() => this.state().lastAnalysisType);
  readonly error = computed(() => this.state().error);
  readonly loadedAt = computed(() => this.state().loadedAt);

  // Computed graph properties - Fixed nodeCount calculation
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
  readonly sourceNodeCount = computed(() => this.state().structure?.source_nodes?.length || 0);
  readonly joinNodeCount = computed(() => this.state().structure?.join_nodes?.length || 0);
  readonly forkNodeCount = computed(() => this.state().structure?.fork_nodes?.length || 0);

  /**
   * Load graph structure from CSV content with spinner integration
   */
  async loadGraphFromCsv(
    csvContent: string,
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; error?: string }> {
    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Loading graph structure...',
      showCancelButton: true,
      ...spinnerConfig
    });

    try {
      // Clear previous state
      this.clearState();
      
      // Update CSV content immediately
      this.updateState({ csvContent });

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
        this.updateState({ error: errorMsg });
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

      // Build graph structure from results - Fixed type handling
      const structure = this.buildGraphStructure(structureResult, diamondResult ?? null);
      
      this.updateState({
        structure,
        isLoaded: true,
        lastAnalysisType: 'diamond',
        loadedAt: new Date(),
        error: null
      });

      return { success: true };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Failed to load graph';
      this.updateState({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.spinnerService.hide(spinnerId);
    }
  }

  /**
   * Run full analysis with current graph state
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

    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Running full analysis...',
      showCancelButton: true,
      ...spinnerConfig
    });

    try {
      const request = this.mainServerService.buildEnhancedRequest(
        this.csvContent(),
        basicParams,
        advancedOptions
      );

      const result = await firstValueFrom(
        this.mainServerService
          .analyzeEnhanced(request)
          .pipe(
            takeUntil(cancellationToken),
            catchError((analysisError: unknown) => {
              console.error('Full analysis failed:', analysisError);
              return of(null);
            })
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Full analysis failed';
        this.updateState({ error: errorMsg });
        return { success: false, error: errorMsg };
      }

      // Update state with results
      this.updateState({
        lastAnalysisResults: result.results,
        lastAnalysisType: 'full',
        error: null
      });

      // Update graph structure if parameter modifications were made
      if (result.parameterModifications) {
        this.updateParametersFromAnalysis(result);
      }

      return { success: true, result };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Full analysis failed';
      this.updateState({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.spinnerService.hide(spinnerId);
    }
  }

  /**
   * Run structure analysis only
   */
  async runStructureAnalysis(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; result?: StructureAnalysisResponse; error?: string }> {
    
    if (!this.csvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Analyzing structure...',
      showCancelButton: true,
      ...spinnerConfig
    });

    try {
      const result = await firstValueFrom(
        this.mainServerService
          .analyzeStructure({ csvContent: this.csvContent() })
          .pipe(
            takeUntil(cancellationToken),
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Structure analysis failed';
        this.updateState({ error: errorMsg });
        return { success: false, error: errorMsg };
      }

      // Update structure if not already loaded
      if (!this.isGraphLoaded()) {
        const structure = this.buildGraphStructure(result, null);
        this.updateState({
          structure,
          isLoaded: true,
          lastAnalysisType: 'structure',
          loadedAt: new Date()
        });
      }

      return { success: true, result };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Structure analysis failed';
      this.updateState({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.spinnerService.hide(spinnerId);
    }
  }

  /**
   * Run diamond analysis only
   */
  async runDiamondAnalysis(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; result?: DiamondAnalysisResponse; error?: string }> {
    
    if (!this.csvContent()) {
      return { success: false, error: 'No CSV content available' };
    }

    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Analyzing diamonds...',
      showCancelButton: true,
      ...spinnerConfig
    });

    try {
      const result = await firstValueFrom(
        this.mainServerService
          .analyzeDiamonds({ csvContent: this.csvContent() })
          .pipe(
            takeUntil(cancellationToken),
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'Diamond analysis failed';
        this.updateState({ error: errorMsg });
        return { success: false, error: errorMsg };
      }

      // Update diamond structures in current graph state - Fixed non-null assertion
      const currentStructure = this.graphStructure();
      if (currentStructure) {
        const updatedStructure = {
          ...currentStructure,
          diamond_structures: result.diamondData
        };
        this.updateState({
          structure: updatedStructure,
          lastAnalysisType: 'diamond'
        });
      }

      return { success: true, result };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'Diamond analysis failed';
      this.updateState({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.spinnerService.hide(spinnerId);
    }
  }

  /**
   * Export current graph to DOT format
   */
  async exportToDot(
    spinnerConfig?: SpinnerConfig
  ): Promise<{ success: boolean; dotString?: string; error?: string }> {
    
    const structure = this.graphStructure();
    if (!structure) {
      return { success: false, error: 'No graph structure available to export' };
    }

    const { id: spinnerId, cancellationToken } = this.spinnerService.show({
      message: 'Exporting to DOT format...',
      showCancelButton: true,
      ...spinnerConfig
    });

    try {
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
            catchError(() => of(null))
          )
      );

      if (!result?.success) {
        const errorMsg = result?.error || 'DOT export failed';
        this.updateState({ error: errorMsg });
        return { success: false, error: errorMsg };
      }

      return { success: true, dotString: result.dotString };

    } catch (analysisError: unknown) {
      const errorMsg = analysisError instanceof Error ? analysisError.message : 'DOT export failed';
      this.updateState({ error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.spinnerService.hide(spinnerId);
    }
  }

  /**
   * Clear all state
   */
  clearState(): void {
    this.state.set({
      isLoaded: false,
      csvContent: '',
      structure: null,
      lastAnalysisResults: null,
      lastAnalysisType: null,
      error: null,
      loadedAt: null
    });
  }

  /**
   * Update CSV content only
   */
  updateCsvContent(csvContent: string): void {
    this.updateState({ csvContent });
  }

  /**
   * Get current complete state (for debugging)
   */
  getCurrentState(): GraphState {
    return this.state();
  }

  // Private helper methods
  private updateState(partialState: Partial<GraphState>): void {
    this.state.update(current => ({ ...current, ...partialState }));
  }

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

  private updateParametersFromAnalysis(result: FullAnalysisResponse): void {
    // Log parameter modification statistics from analysis
    const structure = this.graphStructure();
    if (structure && result.parameterModifications) {
      console.log('Parameter modifications from analysis:', result.parameterModifications);
      
      // The API currently only returns modification counts, not the actual updated values
      // If the API is enhanced to return updated parameters, we would update the structure here
      
      // For now, we just log the modification statistics
      const mods = result.parameterModifications;
      if (mods.totalNodesModified > 0 || mods.totalEdgesModified > 0) {
        console.log(`Analysis modified ${mods.totalNodesModified} nodes and ${mods.totalEdgesModified} edges`);
        
        // Trigger a refresh to notify components that parameters may have changed
        this.refreshParameterDependentState();
      }
    }
  }

  /**
   * Force refresh of parameter-dependent components
   * Call this when parameters are updated globally
   */
  refreshParameterDependentState(): void {
    // Trigger a state update to notify all components that depend on parameters
    this.updateState({
      loadedAt: new Date() // Update timestamp to trigger reactivity
    });
  }

  /**
   * Update global parameters programmatically
   * This method allows components to update the global parameter state
   */
  updateGlobalParameters(
    nodeUpdates?: { [nodeId: string]: number },
    edgeUpdates?: { [edgeKey: string]: number }
  ): void {
    const structure = this.graphStructure();
    if (!structure) return;

    const updatedStructure: GraphStructure = {
      ...structure,
      node_priors: nodeUpdates
        ? { ...structure.node_priors, ...nodeUpdates }
        : structure.node_priors,
      edge_probabilities: edgeUpdates
        ? { ...structure.edge_probabilities, ...edgeUpdates }
        : structure.edge_probabilities
    };

    this.updateState({
      structure: updatedStructure
    });

    console.log('Global parameters updated:', { nodeUpdates, edgeUpdates });
    this.refreshParameterDependentState();
  }
}