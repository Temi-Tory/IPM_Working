import { Injectable, signal, computed } from '@angular/core';
import { NetworkAnalysisResponse, AnalysisConfiguration, DetectedNetworkStructure } from '../models/network-analysis.models';

export interface AnalysisTabState {
  enabled: boolean;
  completed: boolean;
  hasData: boolean;
  error?: string;
}

export interface AnalysisStateSnapshot {
  networkName: string;
  uploadedAt: string;
  analysisCompletedAt: string;
  originalConfig: AnalysisConfiguration;
  networkStructure: DetectedNetworkStructure;
  analysisResults: NetworkAnalysisResponse;
  tabStates: {
    networkStructure: AnalysisTabState;
    diamondAnalysis: AnalysisTabState;
    exactInference: AnalysisTabState;
    flowAnalysis: AnalysisTabState;
    criticalPath: AnalysisTabState;
    systemProfile: AnalysisTabState;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisStateService {
  private currentState = signal<AnalysisStateSnapshot | null>(null);

  // Computed signals for individual tab states
  hasActiveAnalysis = computed(() => !!this.currentState());
  
  networkStructureTab = computed(() => this.currentState()?.tabStates.networkStructure || { enabled: false, completed: false, hasData: false });
  diamondAnalysisTab = computed(() => this.currentState()?.tabStates.diamondAnalysis || { enabled: false, completed: false, hasData: false });
  exactInferenceTab = computed(() => this.currentState()?.tabStates.exactInference || { enabled: false, completed: false, hasData: false });
  flowAnalysisTab = computed(() => this.currentState()?.tabStates.flowAnalysis || { enabled: false, completed: false, hasData: false });
  criticalPathTab = computed(() => this.currentState()?.tabStates.criticalPath || { enabled: false, completed: false, hasData: false });
  systemProfileTab = computed(() => this.currentState()?.tabStates.systemProfile || { enabled: false, completed: false, hasData: false });

  // Computed getters for analysis data
  networkData = computed(() => {
    const state = this.currentState();
    return state ? {
      structure: state.networkStructure,
      results: state.analysisResults.results?.network_structure
    } : null;
  });

  diamondData = computed(() => {
    const state = this.currentState();
    return state ? {
      structure: state.networkStructure,
      results: state.analysisResults.results?.diamond_analysis
    } : null;
  });

  exactInferenceData = computed(() => {
    const state = this.currentState();
    return state ? {
      structure: state.networkStructure,
      results: state.analysisResults.results?.exact_inference
    } : null;
  });

  flowAnalysisData = computed(() => {
    const state = this.currentState();
    return state ? {
      structure: state.networkStructure,
      results: state.analysisResults.results?.flow_analysis
    } : null;
  });

  criticalPathData = computed(() => {
    const state = this.currentState();
    return state ? {
      structure: state.networkStructure,
      results: state.analysisResults.results?.critical_path
    } : null;
  });

  constructor() {}

  updateAnalysisResults(
    networkStructure: DetectedNetworkStructure,
    originalConfig: AnalysisConfiguration,
    analysisResults: NetworkAnalysisResponse
  ): void {
    const tabStates = this.calculateTabStates(originalConfig, analysisResults);
    
    const snapshot: AnalysisStateSnapshot = {
      networkName: networkStructure.networkName,
      uploadedAt: new Date().toISOString(),
      analysisCompletedAt: analysisResults.timestamp,
      originalConfig,
      networkStructure,
      analysisResults,
      tabStates
    };

    this.currentState.set(snapshot);
  }

  private calculateTabStates(
    config: AnalysisConfiguration,
    results: NetworkAnalysisResponse
  ): AnalysisStateSnapshot['tabStates'] {
    
    const hasNetworkResults = !!(results.results?.network_structure);
    const hasInferenceResults = !!(results.results?.exact_inference);
    const hasFlowResults = !!(results.results?.flow_analysis);
    const hasCriticalPathResults = !!(results.results?.critical_path);
    const hasDiamondResults = !!(results.results?.diamond_analysis);
    
    const diamondsFound = results.results?.diamond_analysis?.unique_diamonds_count || 0;
    const hasDiamonds = diamondsFound > 0;

    return {
      // Network Structure - always enabled if we have basic results
      networkStructure: {
        enabled: hasNetworkResults,
        completed: hasNetworkResults,
        hasData: hasNetworkResults
      },

      // Diamond Analysis - enabled if diamonds were found
      diamondAnalysis: {
        enabled: hasDiamondResults && hasDiamonds,
        completed: hasDiamondResults && hasDiamonds,
        hasData: hasDiamondResults && hasDiamonds
      },

      // Exact Inference - enabled if inference was requested and completed
      exactInference: {
        enabled: config.exactInference && hasInferenceResults,
        completed: config.exactInference && hasInferenceResults,
        hasData: config.exactInference && hasInferenceResults
      },

      // Flow Analysis - enabled if flow analysis was requested and completed
      flowAnalysis: {
        enabled: config.flowAnalysis && hasFlowResults,
        completed: config.flowAnalysis && hasFlowResults,
        hasData: config.flowAnalysis && hasFlowResults
      },

      // Critical Path - enabled if CPM analysis was requested and completed
      criticalPath: {
        enabled: config.criticalPathAnalysis && hasCriticalPathResults,
        completed: config.criticalPathAnalysis && hasCriticalPathResults,
        hasData: config.criticalPathAnalysis && hasCriticalPathResults
      },

      // System Profile - enabled if any analysis completed successfully
      systemProfile: {
        enabled: hasNetworkResults || hasInferenceResults || hasFlowResults || hasCriticalPathResults,
        completed: true, // Always considered complete if enabled
        hasData: hasNetworkResults || hasInferenceResults || hasFlowResults || hasCriticalPathResults
      }
    };
  }

  clearAnalysisState(): void {
    this.currentState.set(null);
  }

  getCurrentSnapshot(): AnalysisStateSnapshot | null {
    return this.currentState();
  }

  // Helper methods for specific data access
  getNetworkStructureData(): any {
    return this.currentState()?.analysisResults.results?.network_structure;
  }

  getExactInferenceData(): any {
    return this.currentState()?.analysisResults.results?.exact_inference;
  }

  getDiamondAnalysisData(): any {
    return this.currentState()?.analysisResults.results?.diamond_analysis;
  }

  getFlowAnalysisData(): any {
    return this.currentState()?.analysisResults.results?.flow_analysis;
  }

  getCriticalPathData(): any {
    return this.currentState()?.analysisResults.results?.critical_path;
  }

  // Get original network files structure for visualization
  getNetworkStructure(): DetectedNetworkStructure | null {
    return this.currentState()?.networkStructure || null;
  }

  getAnalysisConfiguration(): AnalysisConfiguration | null {
    return this.currentState()?.originalConfig || null;
  }

  // Debug method
  getStateInfo(): any {
    const state = this.currentState();
    if (!state) return null;

    return {
      networkName: state.networkName,
      uploadedAt: state.uploadedAt,
      analysisCompletedAt: state.analysisCompletedAt,
      enabledTabs: Object.entries(state.tabStates)
        .filter(([_, tabState]) => tabState.enabled)
        .map(([tabName, _]) => tabName),
      completedAnalyses: Object.entries(state.tabStates)
        .filter(([_, tabState]) => tabState.completed)
        .map(([tabName, _]) => tabName),
      hasErrors: Object.values(state.tabStates).some(tab => tab.error)
    };
  }
}