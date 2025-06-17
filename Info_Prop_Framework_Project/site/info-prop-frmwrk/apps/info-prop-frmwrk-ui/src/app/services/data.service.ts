import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

export interface EdgeData {
  from: number;
  to: number;
  probability?: number;
}

export interface NetworkData {
  nodes: number[];
  edges: [number, number][];
  edgeList: EdgeData[]; // Added for visualization compatibility
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
  isolatedNodes?: number[];
  highIndegreeNodes?: Array<{node: number, degree: number}>;
  highOutdegreeNodes?: Array<{node: number, degree: number}>;
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

export interface VisualizationState {
  selectedLayout: string;
  colorScheme: string;
  nodeSize: number;
  edgeWidth: number;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  selectedNodes: Set<string>;
  selectedEdges: Set<string>;
  zoomLevel: number;
  panPosition: { x: number; y: number };
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  // Current file state
  private currentFileSubject = new BehaviorSubject<File | null>(null);
  public currentFile$ = this.currentFileSubject.asObservable();

  // Original data state (raw parsed data)
  private originalDataSubject = new BehaviorSubject<any>(null);
  public originalData$ = this.originalDataSubject.asObservable();

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

  // Visualization state
  private visualizationStateSubject = new BehaviorSubject<VisualizationState>({
    selectedLayout: 'dot',
    colorScheme: 'default',
    nodeSize: 50,
    edgeWidth: 2,
    showNodeLabels: true,
    showEdgeLabels: false,
    selectedNodes: new Set(),
    selectedEdges: new Set(),
    zoomLevel: 1,
    panPosition: { x: 0, y: 0 }
  });
  public visualizationState$ = this.visualizationStateSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Error state
  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // Analysis cache
  private analysisCache = new Map<string, AnalysisCache>();

  constructor() {
    // Initialize with any persisted state
    this.loadPersistedState();
  }

  // File management methods
  setCurrentFile(file: File): void {
    this.currentFileSubject.next(file);
    this.clearAnalysisResults();
    console.log('File set:', file.name);
  }

  getCurrentFile(): File | null {
    return this.currentFileSubject.value;
  }

  hasFile(): boolean {
    return this.currentFileSubject.value !== null;
  }

  clearCurrentFile(): void {
    this.currentFileSubject.next(null);
    this.clearAllData();
  }

  // Network data methods
  setNetworkData(data: any): void {
    // Transform the data to ensure compatibility
    const transformedData: NetworkData = {
      ...data,
      edgeList: this.createEdgeList(data.edges || []),
      // Ensure all required arrays exist
      sourceNodes: data.sourceNodes || [],
      sinkNodes: data.sinkNodes || [],
      forkNodes: data.forkNodes || [],
      joinNodes: data.joinNodes || [],
      nodes: data.nodes || [],
      edges: data.edges || [],
      nodeCount: data.nodeCount || 0,
      edgeCount: data.edgeCount || 0
    };

    this.networkDataSubject.next(transformedData);
    
    // Update analysis progress
    const currentProgress = this.analysisProgressSubject.value;
    this.analysisProgressSubject.next({
      ...currentProgress,
      tier1Complete: true,
      currentTier: Math.max(currentProgress.currentTier, 1),
      lastAnalysisTime: new Date()
    });
    
    console.log('Network data updated with', transformedData.nodeCount, 'nodes and', transformedData.edgeCount, 'edges');
  }

  private createEdgeList(edges: [number, number][]): EdgeData[] {
    return edges.map(([from, to]) => ({
      from,
      to,
      probability: 0.9 // Default probability, can be overridden later
    }));
  }

  getNetworkData(): NetworkData | null {
    return this.networkDataSubject.value;
  }

  // Original data methods
  setOriginalData(data: any): void {
    this.originalDataSubject.next(data);
    console.log('Original data updated');
  }

  getOriginalData(): any {
    return this.originalDataSubject.value;
  }

  // Diamond data methods
  setDiamondData(data: DiamondData): void {
    this.diamondDataSubject.next(data);
    
    // Update analysis progress
    const currentProgress = this.analysisProgressSubject.value;
    this.analysisProgressSubject.next({
      ...currentProgress,
      tier2Complete: true,
      currentTier: Math.max(currentProgress.currentTier, 2),
      lastAnalysisTime: new Date()
    });
    
    console.log('Diamond data updated');
  }

  getDiamondData(): DiamondData | null {
    return this.diamondDataSubject.value;
  }

  // Reachability methods
  setReachabilityResults(results: ReachabilityResults): void {
    this.reachabilityResultsSubject.next(results);
    
    // Update analysis progress
    const currentProgress = this.analysisProgressSubject.value;
    this.analysisProgressSubject.next({
      ...currentProgress,
      tier3Complete: true,
      currentTier: Math.max(currentProgress.currentTier, 3),
      lastAnalysisTime: new Date()
    });
    
    console.log('Reachability results updated with', results.results.length, 'node results');
  }

  getReachabilityResults(): ReachabilityResults | null {
    return this.reachabilityResultsSubject.value;
  }

  // Parameter override methods
  updateParameterOverrides(overrides: Partial<ParameterOverrides>): void {
    const current = this.parameterOverridesSubject.value;
    const updated = { ...current, ...overrides };
    this.parameterOverridesSubject.next(updated);
    
    // Invalidate cached results when parameters change
    this.invalidateAnalysisCache();
    
    console.log('Parameter overrides updated:', overrides);
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
    this.invalidateAnalysisCache();
  }

  setIndividualEdgeProbability(fromNode: number, toNode: number, value: number): void {
    const edgeKey = `${fromNode}-${toNode}`;
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
    this.invalidateAnalysisCache();
  }

  // Visualization state methods
  updateVisualizationState(state: Partial<VisualizationState>): void {
    const current = this.visualizationStateSubject.value;
    const updated = { ...current, ...state };
    this.visualizationStateSubject.next(updated);
    this.persistVisualizationState(updated);
  }

  getVisualizationState(): VisualizationState {
    return this.visualizationStateSubject.value;
  }

  // Loading and error state methods
  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  setError(error: string | null): void {
    this.errorSubject.next(error);
    if (error) {
      console.error('DataService Error:', error);
    }
  }

  clearError(): void {
    this.errorSubject.next(null);
  }

  // Analysis progress methods
  updateAnalysisProgress(progress: Partial<AnalysisProgress>): void {
    const current = this.analysisProgressSubject.value;
    const updated = { ...current, ...progress };
    this.analysisProgressSubject.next(updated);
  }

  getAnalysisProgress(): AnalysisProgress {
    return this.analysisProgressSubject.value;
  }

  resetAnalysisProgress(): void {
    this.analysisProgressSubject.next({
      tier1Complete: false,
      tier2Complete: false,
      tier3Complete: false,
      currentTier: 0
    });
  }

  // Cache management methods
  private generateCacheKey(fileHash: string, parameterHash: string): string {
    return `${fileHash}-${parameterHash}`;
  }

  private generateParameterHash(): string {
    const params = this.parameterOverridesSubject.value;
    return btoa(JSON.stringify(params)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  private generateFileHash(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const hash = btoa(content).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        resolve(hash);
      };
      reader.readAsText(file);
    });
  }

  async getCachedResults(file: File): Promise<AnalysisCache | null> {
    const fileHash = await this.generateFileHash(file);
    const parameterHash = this.generateParameterHash();
    const cacheKey = this.generateCacheKey(fileHash, parameterHash);
    
    const cached = this.analysisCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    return null;
  }

  async setCachedResults(file: File, results: Partial<AnalysisCache>): Promise<void> {
    const fileHash = await this.generateFileHash(file);
    const parameterHash = this.generateParameterHash();
    const cacheKey = this.generateCacheKey(fileHash, parameterHash);
    
    const cacheEntry: AnalysisCache = {
      fileHash,
      parameterHash,
      timestamp: new Date(),
      ...results
    };
    
    this.analysisCache.set(cacheKey, cacheEntry);
    console.log('Results cached for key:', cacheKey);
  }

  private isCacheValid(cache: AnalysisCache): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const age = Date.now() - cache.timestamp.getTime();
    return age < maxAge;
  }

  private invalidateAnalysisCache(): void {
    // Clear cache when parameters change
    this.analysisCache.clear();
    console.log('Analysis cache invalidated due to parameter changes');
  }

  // Data clearing methods
  private clearAnalysisResults(): void {
    this.originalDataSubject.next(null);
    this.networkDataSubject.next(null);
    this.diamondDataSubject.next(null);
    this.reachabilityResultsSubject.next(null);
    this.resetAnalysisProgress();
    this.clearError();
  }

   clearAllData(): void {
    this.clearAnalysisResults();
    this.parameterOverridesSubject.next({
      useGlobalNodePrior: false,
      globalNodePrior: 1.0,
      useGlobalEdgeProb: false,
      globalEdgeProb: 0.9,
      useIndividualOverrides: false,
      individualNodePriors: {},
      individualEdgeProbabilities: {}
    });
    this.analysisCache.clear();
  }

  // Persistence methods
  private loadPersistedState(): void {
    try {
      const savedVizState = localStorage.getItem('ipa-visualization-state');
      if (savedVizState) {
        const parsed = JSON.parse(savedVizState);
        // Reconstruct Sets from arrays
        if (parsed.selectedNodes) {
          parsed.selectedNodes = new Set(parsed.selectedNodes);
        }
        if (parsed.selectedEdges) {
          parsed.selectedEdges = new Set(parsed.selectedEdges);
        }
        this.visualizationStateSubject.next({ ...this.visualizationStateSubject.value, ...parsed });
      }

      const savedParams = localStorage.getItem('ipa-parameter-overrides');
      if (savedParams) {
        const parsed = JSON.parse(savedParams);
        this.parameterOverridesSubject.next({ ...this.parameterOverridesSubject.value, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
    }
  }

  private persistVisualizationState(state: VisualizationState): void {
    try {
      // Convert Sets to arrays for JSON serialization
      const serializable = {
        ...state,
        selectedNodes: Array.from(state.selectedNodes),
        selectedEdges: Array.from(state.selectedEdges)
      };
      localStorage.setItem('ipa-visualization-state', JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to persist visualization state:', error);
    }
  }

  persistParameterOverrides(): void {
    try {
      const state = this.parameterOverridesSubject.value;
      localStorage.setItem('ipa-parameter-overrides', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist parameter overrides:', error);
    }
  }

  // Utility methods
  isAnalysisComplete(tier: number): boolean {
    const progress = this.analysisProgressSubject.value;
    switch (tier) {
      case 1: return progress.tier1Complete;
      case 2: return progress.tier2Complete;
      case 3: return progress.tier3Complete;
      default: return false;
    }
  }

  canProgressToTier(tier: number): boolean {
    const progress = this.analysisProgressSubject.value;
    switch (tier) {
      case 1: return this.hasFile();
      case 2: return progress.tier1Complete;
      case 3: return progress.tier2Complete;
      default: return false;
    }
  }

  // Observable combinations for complex state queries
  get analysisState$(): Observable<{
    hasFile: boolean;
    networkData: NetworkData | null;
    diamondData: DiamondData | null;
    reachabilityResults: ReachabilityResults | null;
    progress: AnalysisProgress;
    isLoading: boolean;
    error: string | null;
  }> {
    return combineLatest([
      this.currentFile$,
      this.networkData$,
      this.diamondData$,
      this.reachabilityResults$,
      this.analysisProgress$,
      this.loading$,
      this.error$
    ]).pipe(
      map(([file, networkData, diamondData, reachabilityResults, progress, isLoading, error]) => ({
        hasFile: !!file,
        networkData,
        diamondData,
        reachabilityResults,
        progress,
        isLoading,
        error
      }))
    );
  }

  get canVisualize$(): Observable<boolean> {
    return this.networkData$.pipe(
      map(data => !!data && data.nodeCount > 0)
    );
  }
}