import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { NetworkStateService } from './network-state.service';
import type { DiamondStructure } from '../models/diamond.models';

// Analysis types and interfaces
export interface AnalysisResults {
  id: string;
  type: AnalysisType;
  timestamp: Date;
  results: {
    reachabilityProbabilities?: Record<number, number>;
    diamondStructures?: DiamondStructure[];
    criticalPaths?: Path[];
    monteCarloResults?: MonteCarloResults;
    networkMetrics?: NetworkMetrics;
  };
  executionTime: number;
  parameters: AnalysisParameters;
}

export interface AnalysisParameters {
  analysisType: AnalysisType;
  iterations?: number;
  confidenceLevel?: number;
  targetNodes?: number[];
  sourceNodes?: number[];
  globalNodePrior?: number;
  globalEdgeProb?: number;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  nodeOverrides?: Record<number, number>;
  edgeOverrides?: Record<string, number>;
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: Date;
  results: AnalysisResults;
  parameters: AnalysisParameters;
  networkSnapshot: string; // JSON snapshot of network at time of analysis
}

// DiamondStructure is now imported from models

export interface Path {
  id: string;
  nodes: number[];
  edges: string[];
  probability: number;
}

export interface MonteCarloResults {
  iterations: number;
  successRate: number;
  confidenceInterval: [number, number];
  convergenceData: number[];
}

export interface NetworkMetrics {
  density: number;
  averagePathLength: number;
  clusteringCoefficient: number;
  centralityMeasures: Record<number, number>;
}

export type AnalysisType = 
  | 'reachability' 
  | 'diamond-detection' 
  | 'monte-carlo' 
  | 'critical-path' 
  | 'network-metrics';

export type AnalysisStatus = 'idle' | 'running' | 'completed' | 'error';

/**
 * Analysis State Service using Angular 20 Native Signals
 * Manages all analysis-related state and operations
 */
@Injectable({ providedIn: 'root' })
export class AnalysisStateService {
  // Private signals for internal state
  private _currentAnalysis = signal<AnalysisResults | null>(null);
  private _analysisHistory = signal<AnalysisHistoryItem[]>([]);
  private _isRunning = signal(false);
  private _analysisStatus = signal<AnalysisStatus>('idle');
  private _parameters = signal<AnalysisParameters>({
    analysisType: 'reachability',
    iterations: 10000,
    confidenceLevel: 0.95
  });
  private _error = signal<string | null>(null);
  private _progress = signal<number>(0);

  // Public readonly signals
  readonly currentAnalysis = this._currentAnalysis.asReadonly();
  readonly analysisHistory = this._analysisHistory.asReadonly();
  readonly isRunning = this._isRunning.asReadonly();
  readonly analysisStatus = this._analysisStatus.asReadonly();
  readonly parameters = this._parameters.asReadonly();
  readonly error = this._error.asReadonly();
  readonly progress = this._progress.asReadonly();

  // Computed signals
  readonly hasResults = computed(() => this._currentAnalysis() !== null);
  readonly analysisCount = computed(() => this._analysisHistory().length);
  readonly canRunAnalysis = computed(() => 
    !this.isRunning() && 
    this.networkState.canAnalyze() &&
    this._analysisStatus() !== 'running'
  );
  readonly lastAnalysisTime = computed(() => {
    const current = this._currentAnalysis();
    return current?.timestamp || null;
  });
  readonly analysisResultsSummary = computed(() => {
    const current = this._currentAnalysis();
    if (!current) return null;

    return {
      type: current.type,
      executionTime: current.executionTime,
      timestamp: current.timestamp,
      hasReachability: !!current.results.reachabilityProbabilities,
      hasDiamonds: !!current.results.diamondStructures,
      hasPaths: !!current.results.criticalPaths,
      hasMonteCarloResults: !!current.results.monteCarloResults,
      hasMetrics: !!current.results.networkMetrics
    };
  });

  // Parameter override signals
  private _parameterOverrides = signal<{
    global: {
      nodePrior?: number;
      edgeProb?: number;
      overrideNodePrior: boolean;
      overrideEdgeProb: boolean;
    };
    individual: {
      nodeOverrides: Record<number, number>;
      edgeOverrides: Record<string, number>;
    };
  }>({
    global: {
      overrideNodePrior: false,
      overrideEdgeProb: false
    },
    individual: {
      nodeOverrides: {},
      edgeOverrides: {}
    }
  });

  readonly parameterOverrides = this._parameterOverrides.asReadonly();
  readonly hasGlobalOverrides = computed(() => {
    const overrides = this._parameterOverrides();
    return overrides.global.overrideNodePrior || overrides.global.overrideEdgeProb;
  });
  readonly hasIndividualOverrides = computed(() => {
    const overrides = this._parameterOverrides();
    return Object.keys(overrides.individual.nodeOverrides).length > 0 ||
           Object.keys(overrides.individual.edgeOverrides).length > 0;
  });

  private networkState = inject(NetworkStateService);

  constructor() {
    // Effect: Auto-run analysis when network changes (if parameters are set)
    effect(() => {
      const network = this.networkState.networkData();
      const params = this._parameters();
      
      if (network && params && this.canRunAnalysis()) {
        // Only auto-run if explicitly enabled
        // this.runAnalysis();
      }
    });

    // Effect: Clear results when network changes
    effect(() => {
      const network = this.networkState.networkData();
      const currentResults = this._currentAnalysis();
      
      if (!network && currentResults) {
        this._currentAnalysis.set(null);
        this._analysisStatus.set('idle');
      }
    });

    // Effect: Error logging
    effect(() => {
      const error = this._error();
      if (error) {
        console.error('Analysis Error:', error);
      }
    });

    // Load analysis history from localStorage
    this.loadHistoryFromStorage();
  }

  // Analysis execution methods
  async runAnalysis(type?: AnalysisType): Promise<void> {
    if (!this.canRunAnalysis()) {
      console.warn('Cannot run analysis: conditions not met');
      return;
    }

    const analysisType = type || this._parameters().analysisType;
    const startTime = performance.now();

    this._isRunning.set(true);
    this._analysisStatus.set('running');
    this._error.set(null);
    this._progress.set(0);

    try {
      // Simulate analysis progress
      const progressInterval = setInterval(() => {
        this._progress.update(p => Math.min(p + 10, 90));
      }, 200);

      // Perform the actual analysis
      const results = await this.performAnalysis(analysisType);
      const executionTime = performance.now() - startTime;

      clearInterval(progressInterval);
      this._progress.set(100);

      const analysisResults: AnalysisResults = {
        id: crypto.randomUUID(),
        type: analysisType,
        timestamp: new Date(),
        results,
        executionTime,
        parameters: { ...this._parameters(), analysisType }
      };

      this._currentAnalysis.set(analysisResults);
      this._analysisStatus.set('completed');
      this.addToHistory(analysisResults);

      console.log(`Analysis completed: ${analysisType}`, {
        executionTime: `${executionTime.toFixed(2)}ms`,
        results
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown analysis error';
      this._error.set(errorMessage);
      this._analysisStatus.set('error');
      console.error('Analysis failed:', error);
    } finally {
      this._isRunning.set(false);
      setTimeout(() => this._progress.set(0), 2000); // Reset progress after delay
    }
  }

  // Parameter management methods
  setParameters(params: Partial<AnalysisParameters>): void {
    this._parameters.update(current => ({
      ...current,
      ...params
    }));
  }

  setGlobalOverrides(nodePrior?: number, edgeProb?: number): void {
    this._parameterOverrides.update(overrides => ({
      ...overrides,
      global: {
        nodePrior,
        edgeProb,
        overrideNodePrior: nodePrior !== undefined,
        overrideEdgeProb: edgeProb !== undefined
      }
    }));
  }

  setNodeOverride(nodeId: number, probability: number): void {
    this._parameterOverrides.update(overrides => ({
      ...overrides,
      individual: {
        ...overrides.individual,
        nodeOverrides: {
          ...overrides.individual.nodeOverrides,
          [nodeId]: probability
        }
      }
    }));
  }

  setEdgeOverride(edgeId: string, probability: number): void {
    this._parameterOverrides.update(overrides => ({
      ...overrides,
      individual: {
        ...overrides.individual,
        edgeOverrides: {
          ...overrides.individual.edgeOverrides,
          [edgeId]: probability
        }
      }
    }));
  }

  removeNodeOverride(nodeId: number): void {
    this._parameterOverrides.update(overrides => {
      const newNodeOverrides = { ...overrides.individual.nodeOverrides };
      delete newNodeOverrides[nodeId];
      
      return {
        ...overrides,
        individual: {
          ...overrides.individual,
          nodeOverrides: newNodeOverrides
        }
      };
    });
  }

  removeEdgeOverride(edgeId: string): void {
    this._parameterOverrides.update(overrides => {
      const newEdgeOverrides = { ...overrides.individual.edgeOverrides };
      delete newEdgeOverrides[edgeId];
      
      return {
        ...overrides,
        individual: {
          ...overrides.individual,
          edgeOverrides: newEdgeOverrides
        }
      };
    });
  }

  clearAllOverrides(): void {
    this._parameterOverrides.set({
      global: {
        overrideNodePrior: false,
        overrideEdgeProb: false
      },
      individual: {
        nodeOverrides: {},
        edgeOverrides: {}
      }
    });
  }

  // History management
  private addToHistory(results: AnalysisResults): void {
    const networkData = this.networkState.networkData();
    if (!networkData) return;

    const historyItem: AnalysisHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      results,
      parameters: results.parameters,
      networkSnapshot: JSON.stringify(networkData)
    };

    this._analysisHistory.update(history => {
      const newHistory = [historyItem, ...history];
      // Keep only last 50 analyses
      return newHistory.slice(0, 50);
    });

    this.saveHistoryToStorage();
  }

  clearHistory(): void {
    this._analysisHistory.set([]);
    this.clearHistoryFromStorage();
  }

  // Mock analysis implementation (replace with actual API calls)
  private async performAnalysis(type: AnalysisType): Promise<AnalysisResults['results']> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const networkData = this.networkState.networkData();
    if (!networkData) throw new Error('No network data available');

    // Mock results based on analysis type
    switch (type) {
      case 'reachability':
        return {
          reachabilityProbabilities: this.generateMockReachabilityResults(networkData)
        };
      
      case 'diamond-detection':
        return {
          diamondStructures: this.generateMockDiamondResults()
        };
      
      case 'monte-carlo':
        return {
          monteCarloResults: this.generateMockMonteCarloResults()
        };
      
      default:
        return {};
    }
  }

  private generateMockReachabilityResults(networkData: { nodes: Array<{ id: number }> }): Record<number, number> {
    const results: Record<number, number> = {};
    networkData.nodes.forEach((node) => {
      results[node.id] = Math.random() * 0.8 + 0.1; // Random probability between 0.1 and 0.9
    });
    return results;
  }

  private generateMockDiamondResults(): DiamondStructure[] {
    // Mock diamond structure detection
    return [
      {
        id: 'diamond-1',
        nodes: [1, 2, 3, 4],
        source: 1,
        sink: 4,
        forks: [1],
        joins: [4],
        paths: [
          [1, 2, 4],
          [1, 3, 4]
        ],
        metadata: {
          type: 'simple',
          size: 4,
          depth: 2
        }
      }
    ];
  }

  private generateMockMonteCarloResults(): MonteCarloResults {
    return {
      iterations: this._parameters().iterations || 10000,
      successRate: Math.random() * 0.6 + 0.2,
      confidenceInterval: [0.3, 0.7],
      convergenceData: Array.from({ length: 100 }, () => Math.random() * 0.1 + 0.5)
    };
  }

  // Persistence methods
  private saveHistoryToStorage(): void {
    try {
      const history = this._analysisHistory();
      localStorage.setItem('analysis-history', JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save analysis history:', error);
    }
  }

  private loadHistoryFromStorage(): void {
    try {
      const saved = localStorage.getItem('analysis-history');
      if (saved) {
        const history = JSON.parse(saved);
        if (Array.isArray(history)) {
          this._analysisHistory.set(history);
        }
      }
    } catch (error) {
      console.warn('Failed to load analysis history:', error);
    }
  }

  private clearHistoryFromStorage(): void {
    try {
      localStorage.removeItem('analysis-history');
    } catch (error) {
      console.warn('Failed to clear analysis history:', error);
    }
  }
}