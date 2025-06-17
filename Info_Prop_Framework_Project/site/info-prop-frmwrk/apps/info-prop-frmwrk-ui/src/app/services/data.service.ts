import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export interface NetworkData {
  nodes: number[];
  edges: [number, number][];
  sourceNodes: number[];
  sinkNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  nodeCount: number;
  edgeCount: number;
  iterationSets?: number[][];
  ancestors?: Record<number, number[]>;
  descendants?: Record<number, number[]>;
  maxIterationDepth?: number;
  graphDensity?: number;
  nodeTypeDistribution?: Record<string, number>;
}

export interface DiamondData {
  diamondClassifications?: unknown[];
  diamondStructures?: unknown;
}

export interface ReachabilityResults {
  results: Array<{ node: number; probability: number }>;
  monteCarloResults?: Array<{
    node: number;
    algorithmValue: number;
    monteCarloValue: number;
    difference: number;
  }>;
}

export interface AnalysisProgress {
  tier1Complete: boolean;
  tier2Complete: boolean;
  tier3Complete: boolean;
  currentTier: number;
  lastAnalysisTime?: Date;
}

export interface ParameterOverrides {
  useGlobalNodePrior: boolean;
  globalNodePrior: number;
  useGlobalEdgeProb: boolean;
  globalEdgeProb: number;
  useIndividualOverrides: boolean;
  individualNodePriors: { [nodeId: string]: number };
  individualEdgeProbabilities: { [edgeKey: string]: number };
}

export interface AnalysisCache {
  fileHash: string;
  parameterHash: string;
  timestamp: Date;
  structureResults?: unknown;
  diamondResults?: DiamondData;
  reachabilityResults?: ReachabilityResults;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  // Current file state
  private currentFileSubject = new BehaviorSubject<File | null>(null);
  public currentFile$ = this.currentFileSubject.asObservable();

  // Network data state
  private networkDataSubject = new BehaviorSubject<NetworkData | null>(null);
  public networkData$ = this.networkDataSubject.asObservable();

  // Diamond analysis data
  private diamondDataSubject = new BehaviorSubject<DiamondData | null>(null);
  public diamondData$ = this.diamondDataSubject.asObservable();

  // Reachability results
  private reachabilityResultsSubject = new BehaviorSubject<ReachabilityResults | null>(null);
  public reachabilityResults$ = this.reachabilityResultsSubject.asObservable();

  // Analysis progress tracking
  private analysisProgressSubject = new BehaviorSubject<AnalysisProgress>({
    tier1Complete: false,
    tier2Complete: false,
    tier3Complete: false,
    currentTier: 0
  });
  public analysisProgress$ = this.analysisProgressSubject.asObservable();

  // Parameter overrides
  private parameterOverridesSubject = new BehaviorSubject<ParameterOverrides>({
    useGlobalNodePrior: false,
    globalNodePrior: 1.0,
    useGlobalEdgeProb: false,
    globalEdgeProb: 0.9,
    useIndividualOverrides: false,
    individualNodePriors: {},
    individualEdgeProbabilities: {}
  });
  public parameterOverrides$ = this.parameterOverridesSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Error state
  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // Analysis cache
  private analysisCache = new Map<string, AnalysisCache>();

  // Original data from CSV (for parameter override comparisons)
  private originalDataSubject = new BehaviorSubject<unknown>(null);
  public originalData$ = this.originalDataSubject.asObservable();

  constructor() {
    // Load cached state from localStorage on startup
    this.loadPersistedState();
    
    // Auto-save important state changes
    this.setupStatePersistence();
  }

  // File management
  setCurrentFile(file: File | null): void {
    this.currentFileSubject.next(file);
    if (!file) {
      this.clearAnalysisData();
    } else {
      // Reset analysis progress when new file is loaded
      this.resetAnalysisProgress();
    }
  }

  getCurrentFile(): File | null {
    return this.currentFileSubject.value;
  }

  // Network data management
  setNetworkData(data: NetworkData | null): void {
    this.networkDataSubject.next(data);
    if (data) {
      this.updateAnalysisProgress({ tier1Complete: true, currentTier: 1 });
    }
  }

  getNetworkData(): NetworkData | null {
    return this.networkDataSubject.value;
  }

  // Diamond data management
  setDiamondData(data: DiamondData | null): void {
    this.diamondDataSubject.next(data);
    if (data) {
      this.updateAnalysisProgress({ tier2Complete: true, currentTier: 2 });
    }
  }

  getDiamondData(): DiamondData | null {
    return this.diamondDataSubject.value;
  }

  // Reachability results management
  setReachabilityResults(results: ReachabilityResults | null): void {
    this.reachabilityResultsSubject.next(results);
    if (results) {
      this.updateAnalysisProgress({ tier3Complete: true, currentTier: 3 });
    }
  }

  getReachabilityResults(): ReachabilityResults | null {
    return this.reachabilityResultsSubject.value;
  }

  // Analysis progress management
  updateAnalysisProgress(updates: Partial<AnalysisProgress>): void {
    const current = this.analysisProgressSubject.value;
    const updated = {
      ...current,
      ...updates,
      lastAnalysisTime: new Date()
    };
    this.analysisProgressSubject.next(updated);
  }

  resetAnalysisProgress(): void {
    this.analysisProgressSubject.next({
      tier1Complete: false,
      tier2Complete: false,
      tier3Complete: false,
      currentTier: 0
    });
  }

  getAnalysisProgress(): AnalysisProgress {
    return this.analysisProgressSubject.value;
  }

  // Parameter override management
  setParameterOverrides(overrides: Partial<ParameterOverrides>): void {
    const current = this.parameterOverridesSubject.value;
    const updated = { ...current, ...overrides };
    this.parameterOverridesSubject.next(updated);
    
    // Clear cached results that depend on parameters
    this.invalidateParameterDependentCache();
  }

  getParameterOverrides(): ParameterOverrides {
    return this.parameterOverridesSubject.value;
  }

  setIndividualNodePrior(nodeId: string, value: number): void {
    const current = this.parameterOverridesSubject.value;
    const updated = {
      ...current,
      individualNodePriors: {
        ...current.individualNodePriors,
        [nodeId]: value
      },
      useIndividualOverrides: true
    };
    this.parameterOverridesSubject.next(updated);
    this.invalidateParameterDependentCache();
  }

  setIndividualEdgeProbability(edgeKey: string, value: number): void {
    const current = this.parameterOverridesSubject.value;
    const updated = {
      ...current,
      individualEdgeProbabilities: {
        ...current.individualEdgeProbabilities,
        [edgeKey]: value
      },
      useIndividualOverrides: true
    };
    this.parameterOverridesSubject.next(updated);
    this.invalidateParameterDependentCache();
  }

  clearIndividualOverrides(): void {
    const current = this.parameterOverridesSubject.value;
    const updated = {
      ...current,
      useIndividualOverrides: false,
      individualNodePriors: {},
      individualEdgeProbabilities: {}
    };
    this.parameterOverridesSubject.next(updated);
    this.invalidateParameterDependentCache();
  }

  // Original data management
  setOriginalData(data: unknown): void {
    this.originalDataSubject.next(data);
  }

  getOriginalData(): unknown {
    return this.originalDataSubject.value;
  }

  // Loading state management
  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  // Error management
  setError(error: string | null): void {
    this.errorSubject.next(error);
    if (error) {
      this.setLoading(false);
    }
  }

  clearError(): void {
    this.setError(null);
  }

  // Cache management
  getCacheKey(file: File, parameters?: ParameterOverrides): string {
    const fileInfo = `${file.name}-${file.size}-${file.lastModified}`;
    const paramHash = parameters ? this.hashObject(parameters) : 'default';
    return `${fileInfo}-${paramHash}`;
  }

  getCachedResults(cacheKey: string): AnalysisCache | null {
    return this.analysisCache.get(cacheKey) || null;
  }

  setCachedResults(cacheKey: string, cache: Partial<AnalysisCache>): void {
    const existing = this.analysisCache.get(cacheKey) || {
      fileHash: '',
      parameterHash: '',
      timestamp: new Date()
    };
    
    this.analysisCache.set(cacheKey, {
      ...existing,
      ...cache,
      timestamp: new Date()
    });
  }

  invalidateCache(): void {
    this.analysisCache.clear();
  }

  invalidateParameterDependentCache(): void {
    // Remove cache entries that depend on parameters (Tier 2 and 3)
    for (const [key, cache] of this.analysisCache.entries()) {
      if (cache.diamondResults || cache.reachabilityResults) {
        this.analysisCache.delete(key);
      }
    }
  }

  // State management
  clearAnalysisData(): void {
    this.networkDataSubject.next(null);
    this.diamondDataSubject.next(null);
    this.reachabilityResultsSubject.next(null);
    this.originalDataSubject.next(null);
    this.resetAnalysisProgress();
    this.clearError();
  }

  clearAllData(): void {
    this.setCurrentFile(null);
    this.clearAnalysisData();
    this.parameterOverridesSubject.next({
      useGlobalNodePrior: false,
      globalNodePrior: 1.0,
      useGlobalEdgeProb: false,
      globalEdgeProb: 0.9,
      useIndividualOverrides: false,
      individualNodePriors: {},
      individualEdgeProbabilities: {}
    });
  }

  // Utility methods
  hasFile(): boolean {
    return this.getCurrentFile() !== null;
  }

  hasNetworkData(): boolean {
    return this.getNetworkData() !== null;
  }

  hasDiamondData(): boolean {
    return this.getDiamondData() !== null;
  }

  hasReachabilityResults(): boolean {
    return this.getReachabilityResults() !== null;
  }

  // Combined state observables for components
  getFullState$(): Observable<{
    file: File | null;
    networkData: NetworkData | null;
    diamondData: DiamondData | null;
    reachabilityResults: ReachabilityResults | null;
    analysisProgress: AnalysisProgress;
    parameterOverrides: ParameterOverrides;
    loading: boolean;
    error: string | null;
  }> {
    return combineLatest([
      this.currentFile$,
      this.networkData$,
      this.diamondData$,
      this.reachabilityResults$,
      this.analysisProgress$,
      this.parameterOverrides$,
      this.loading$,
      this.error$
    ]).pipe(
      map(([file, networkData, diamondData, reachabilityResults, analysisProgress, parameterOverrides, loading, error]) => ({
        file,
        networkData,
        diamondData,
        reachabilityResults,
        analysisProgress,
        parameterOverrides,
        loading,
        error
      }))
    );
  }

  // Private utility methods
  private hashObject(obj: object): string {
    return btoa(JSON.stringify(obj)).replace(/[/+=]/g, '');
  }

  private loadPersistedState(): void {
    try {
      const savedOverrides = localStorage.getItem('ipa-parameter-overrides');
      if (savedOverrides) {
        const overrides = JSON.parse(savedOverrides);
        this.parameterOverridesSubject.next(overrides);
      }
    } catch (e) {
      console.warn('Failed to load persisted state:', e);
    }
  }

  private setupStatePersistence(): void {
    // Save parameter overrides to localStorage when they change
    this.parameterOverrides$.subscribe(overrides => {
      try {
        localStorage.setItem('ipa-parameter-overrides', JSON.stringify(overrides));
      } catch (e) {
        console.warn('Failed to persist parameter overrides:', e);
      }
    });
  }
}