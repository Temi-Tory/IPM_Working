import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { NetworkStateService } from './network-state.service';
import {
  DiamondStructure,
  DiamondClassification,
  DiamondDetectionResult,
  DiamondAnalysisConfig,
  DiamondAnalysisProgress,
  DiamondAnalysisStatus,
  DiamondType,
  NodeId
} from '../models/diamond.models';
// Removed unused imports

/**
 * Diamond State Management Service
 * 
 * Provides reactive state management for diamond detection, classification,
 * and analysis using Angular signals. Integrates with NetworkStateService
 * to automatically trigger diamond analysis when network changes occur.
 */
@Injectable({ providedIn: 'root' })
export class DiamondStateService {
  // Inject dependencies
  private readonly networkStateService = inject(NetworkStateService);

  // Private signals for internal state management
  private _diamonds = signal<DiamondStructure[]>([]);
  private _classifications = signal<DiamondClassification[]>([]);
  private _detectionStatus = signal<DiamondAnalysisStatus>(DiamondAnalysisStatus.PENDING);
  private _analysisProgress = signal<DiamondAnalysisProgress>({
    status: DiamondAnalysisStatus.PENDING,
    progress: 0,
    currentOperation: 'Waiting for network data',
    diamondsDetected: 0
  });
  private _lastDetectionResult = signal<DiamondDetectionResult | null>(null);
  private _analysisConfig = signal<DiamondAnalysisConfig>({
    maxDepth: 5,
    minNodes: 4,
    maxNodes: 50,
    detectOverlapping: true,
    performClassification: true,
    confidenceThreshold: 0.7,
    targetTypes: [DiamondType.SIMPLE, DiamondType.NESTED, DiamondType.OVERLAPPING],
    includePathAnalysis: true,
    timeout: 30000
  });
  private _error = signal<string | null>(null);
  private _isAnalyzing = signal(false);

  // Public readonly signals - external components can only read
  readonly diamonds = this._diamonds.asReadonly();
  readonly classifications = this._classifications.asReadonly();
  readonly detectionStatus = this._detectionStatus.asReadonly();
  readonly analysisProgress = this._analysisProgress.asReadonly();
  readonly lastDetectionResult = this._lastDetectionResult.asReadonly();
  readonly analysisConfig = this._analysisConfig.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAnalyzing = this._isAnalyzing.asReadonly();

  // Computed signals - automatically update when dependencies change
  readonly diamondCount = computed(() => this._diamonds().length);
  
  readonly classificationSummary = computed(() => {
    const classifications = this._classifications();
    const summary: Record<DiamondType, number> = {
      [DiamondType.SIMPLE]: 0,
      [DiamondType.NESTED]: 0,
      [DiamondType.OVERLAPPING]: 0,
      [DiamondType.CASCADE]: 0,
      [DiamondType.PARALLEL]: 0
    };
    
    classifications.forEach(classification => {
      summary[classification.type]++;
    });
    
    return summary;
  });

  readonly analysisStatus = computed(() => {
    const progress = this._analysisProgress();
    const isAnalyzing = this._isAnalyzing();
    const error = this._error();
    
    return {
      isComplete: progress.status === DiamondAnalysisStatus.COMPLETE,
      isInProgress: isAnalyzing,
      hasError: error !== null,
      progress: progress.progress,
      status: progress.status,
      currentOperation: progress.currentOperation
    };
  });

  readonly diamondStatistics = computed(() => {
    const diamonds = this._diamonds();
    const classifications = this._classifications();
    
    if (diamonds.length === 0) {
      return {
        totalDiamonds: 0,
        averageComplexity: 0,
        averageDepth: 0,
        averagePathCount: 0,
        maxPathCount: 0,
        minPathCount: 0,
        typeDistribution: this.classificationSummary()
      };
    }

    const complexities = classifications.map(c => c.complexity);
    const depths = classifications.map(c => c.depth);
    const pathCounts = diamonds.map(d => d.paths.length);

    return {
      totalDiamonds: diamonds.length,
      averageComplexity: complexities.reduce((a, b) => a + b, 0) / complexities.length,
      averageDepth: depths.reduce((a, b) => a + b, 0) / depths.length,
      averagePathCount: pathCounts.reduce((a, b) => a + b, 0) / pathCounts.length,
      maxPathCount: Math.max(...pathCounts),
      minPathCount: Math.min(...pathCounts),
      typeDistribution: this.classificationSummary()
    };
  });

  readonly canAnalyze = computed(() => {
    const networkLoaded = this.networkStateService.isNetworkLoaded();
    const isAnalyzing = this._isAnalyzing();
    const networkError = this.networkStateService.error();
    
    return networkLoaded && !isAnalyzing && !networkError;
  });

  readonly hasResults = computed(() => this._diamonds().length > 0);

  constructor() {
    console.log('💎 DiamondStateService: Initializing diamond state management');
    
    // Load any saved diamond data from localStorage
    this.loadFromLocalStorage();
    
    // Effect for auto-saving diamond data
    effect(() => {
      const diamonds = this._diamonds();
      const classifications = this._classifications();
      if (diamonds.length > 0) {
        this.saveToLocalStorage({ diamonds, classifications });
      }
    });

    // Effect to react to network changes and trigger diamond re-analysis
    effect(() => {
      const networkData = this.networkStateService.networkData();
      const canAnalyze = this.canAnalyze();
      
      if (networkData && canAnalyze) {
        console.log('💎 Network data changed, triggering diamond re-analysis');
        this.detectDiamonds();
      }
    });

    // Effect to update analysis progress
    effect(() => {
      const status = this._detectionStatus();
      const diamondCount = this._diamonds().length;
      
      this._analysisProgress.update(progress => ({
        ...progress,
        status,
        diamondsDetected: diamondCount,
        progress: status === DiamondAnalysisStatus.COMPLETE ? 100 : progress.progress
      }));
    });
  }

  // State management methods
  setAnalysisConfig(config: Partial<DiamondAnalysisConfig>): void {
    this._analysisConfig.update(current => ({ ...current, ...config }));
    console.log('💎 Diamond analysis configuration updated:', config);
  }

  setError(error: string | null): void {
    this._error.set(error);
    if (error) {
      this._detectionStatus.set(DiamondAnalysisStatus.ERROR);
      this._analysisProgress.update(progress => ({
        ...progress,
        status: DiamondAnalysisStatus.ERROR,
        currentOperation: `Error: ${error}`
      }));
    }
  }

  clearDiamondState(): void {
    this._diamonds.set([]);
    this._classifications.set([]);
    this._detectionStatus.set(DiamondAnalysisStatus.PENDING);
    this._lastDetectionResult.set(null);
    this._error.set(null);
    this._isAnalyzing.set(false);
    this._analysisProgress.set({
      status: DiamondAnalysisStatus.PENDING,
      progress: 0,
      currentOperation: 'State cleared',
      diamondsDetected: 0
    });
    this.clearLocalStorage();
    console.log('💎 Diamond state cleared');
  }

  // Diamond detection and analysis methods
  async detectDiamonds(): Promise<DiamondDetectionResult> {
    const networkData = this.networkStateService.networkData();
    if (!networkData) {
      throw new Error('No network data available for diamond detection');
    }

    if (this._isAnalyzing()) {
      console.warn('💎 Diamond analysis already in progress');
      return this._lastDetectionResult() || this.createEmptyResult();
    }

    this._isAnalyzing.set(true);
    this._error.set(null);
    this._detectionStatus.set(DiamondAnalysisStatus.DETECTING);
    
    const startTime = Date.now();
    
    try {
      // Update progress
      this.updateProgress(10, 'Initializing diamond detection');
      
      // Simulate diamond detection algorithm
      const detectedDiamonds = await this.performDiamondDetection(networkData);
      
      this.updateProgress(60, 'Classifying detected diamonds');
      
      // Perform classification if enabled
      const classifications = this._analysisConfig().performClassification 
        ? await this.classifyDiamonds(detectedDiamonds)
        : [];

      this.updateProgress(90, 'Finalizing results');

      const executionTime = Date.now() - startTime;
      const result: DiamondDetectionResult = {
        diamonds: detectedDiamonds,
        classifications,
        totalCount: detectedDiamonds.length,
        typeDistribution: this.calculateTypeDistribution(classifications),
        executionTime,
        status: DiamondAnalysisStatus.COMPLETE,
        analyzedAt: new Date()
      };

      // Update state
      this._diamonds.set(detectedDiamonds);
      this._classifications.set(classifications);
      this._lastDetectionResult.set(result);
      this._detectionStatus.set(DiamondAnalysisStatus.COMPLETE);
      
      this.updateProgress(100, 'Diamond analysis complete');
      
      console.log(`💎 Diamond detection completed: ${detectedDiamonds.length} diamonds found in ${executionTime}ms`);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during diamond detection';
      this.setError(errorMessage);
      throw error;
    } finally {
      this._isAnalyzing.set(false);
    }
  }

  async classifyDiamonds(diamonds: DiamondStructure[]): Promise<DiamondClassification[]> {
    if (!this._analysisConfig().performClassification) {
      return [];
    }

    const classifications: DiamondClassification[] = [];
    
    for (let i = 0; i < diamonds.length; i++) {
      const diamond = diamonds[i];
      const classification = await this.classifyDiamond(diamond);
      classifications.push(classification);
      
      // Update progress during classification
      const progress = 60 + (30 * (i + 1) / diamonds.length);
      this.updateProgress(progress, `Classifying diamond ${i + 1} of ${diamonds.length}`);
    }
    
    return classifications;
  }

  async triggerReanalysis(): Promise<DiamondDetectionResult> {
    console.log('💎 Triggering diamond re-analysis');
    this.clearDiamondState();
    return this.detectDiamonds();
  }

  // Utility methods
  getDiamondById(diamondId: string): DiamondStructure | undefined {
    return this._diamonds().find(diamond => diamond.id === diamondId);
  }

  getClassificationById(diamondId: string): DiamondClassification | undefined {
    return this._classifications().find(classification => classification.diamondId === diamondId);
  }

  getDiamondsByType(type: DiamondType): DiamondStructure[] {
    const classifications = this._classifications();
    const diamondIds = classifications
      .filter(c => c.type === type)
      .map(c => c.diamondId);
    
    return this._diamonds().filter(d => diamondIds.includes(d.id));
  }

  // Private helper methods
  private async performDiamondDetection(networkData: unknown): Promise<DiamondStructure[]> {
    // Simulate diamond detection algorithm
    // In a real implementation, this would analyze the network structure
    // to identify diamond patterns based on the analysis configuration
    
    await this.delay(500); // Simulate processing time
    
    const config = this._analysisConfig();
    const diamonds: DiamondStructure[] = [];
    
    // Mock diamond detection based on network structure
    const networkDataTyped = networkData as Record<string, unknown>;
    const forkNodes = networkDataTyped['forkNodes'] as number[] | undefined;
    const joinNodesArray = networkDataTyped['joinNodes'] as number[] | undefined;
    
    if (forkNodes?.length && joinNodesArray?.length) {
      // Create sample diamonds based on fork and join nodes
      for (let i = 0; i < Math.min(forkNodes.length, 3); i++) {
        const forkNode = forkNodes[i];
        const filteredJoinNodes = joinNodesArray.filter((jn: number) => jn > forkNode);
        
        if (filteredJoinNodes.length > 0) {
          const joinNode = filteredJoinNodes[0];
          const diamond = this.createMockDiamond(i + 1, forkNode, joinNode, networkData);
          diamonds.push(diamond);
        }
      }
    }
    
    return diamonds.slice(0, config.maxNodes || 10);
  }

  private async classifyDiamond(diamond: DiamondStructure): Promise<DiamondClassification> {
    await this.delay(100); // Simulate classification time
    
    const config = this._analysisConfig();
    
    // Mock classification logic
    const pathCount = diamond.paths.length;
    const nodeCount = diamond.nodes.length;
    
    let type: DiamondType;
    let complexity: number;
    let depth: number;
    
    if (pathCount <= 2 && nodeCount <= 6) {
      type = DiamondType.SIMPLE;
      complexity = 20 + Math.random() * 30;
      depth = 0;
    } else if (nodeCount > 10) {
      type = DiamondType.NESTED;
      complexity = 60 + Math.random() * 30;
      depth = Math.floor(nodeCount / 5);
    } else {
      type = DiamondType.OVERLAPPING;
      complexity = 40 + Math.random() * 40;
      depth = 1;
    }
    
    const characteristics = this.generateCharacteristics(type, pathCount, nodeCount);
    const confidence = Math.max(config.confidenceThreshold || 0.7, 0.7 + Math.random() * 0.3);
    
    return {
      diamondId: diamond.id,
      type,
      complexity: Math.round(complexity),
      depth,
      characteristics,
      confidence,
      classifiedAt: new Date()
    };
  }

  private createMockDiamond(index: number, forkNode: NodeId, joinNode: NodeId, networkData: unknown): DiamondStructure {
    const id = `diamond_${index}`;
    const networkDataTyped = networkData as Record<string, unknown>; // Type assertion for internal implementation
    const sourceNode = (networkDataTyped['sourceNodes'] as number[])?.[0] || 1;
    const networkNodes = networkDataTyped['nodes'] as Array<{ id: number }> | undefined;
    const sinkNode = networkNodes?.length ? Math.max(...networkNodes.map(n => n.id)) : 10;
    
    // Create paths through the diamond
    const intermediateNode = typeof forkNode === 'number' ? forkNode + 1 : `${forkNode}_1`;
    const paths = [
      [sourceNode, forkNode, joinNode, sinkNode],
      [sourceNode, forkNode, intermediateNode, joinNode, sinkNode]
    ];
    
    const diamondNodes = Array.from(new Set(paths.flat()));
    
    return {
      id,
      nodes: diamondNodes,
      source: sourceNode,
      sink: sinkNode,
      forks: [forkNode],
      joins: [joinNode],
      paths,
      metadata: {
        detectedAt: new Date().toISOString(),
        networkSize: ((networkData as Record<string, unknown>)['nodes'] as unknown[])?.length || 0
      }
    };
  }

  private generateCharacteristics(type: DiamondType, pathCount: number, nodeCount: number): string[] {
    const characteristics = [`${pathCount} parallel paths`, `${nodeCount} total nodes`];
    
    switch (type) {
      case DiamondType.SIMPLE:
        characteristics.push('Basic diamond structure', 'Single level');
        break;
      case DiamondType.NESTED:
        characteristics.push('Multi-level nesting', 'Complex structure');
        break;
      case DiamondType.OVERLAPPING:
        characteristics.push('Shared nodes', 'Interconnected paths');
        break;
      case DiamondType.CASCADE:
        characteristics.push('Sequential diamonds', 'Chained structure');
        break;
      case DiamondType.PARALLEL:
        characteristics.push('Independent paths', 'Parallel execution');
        break;
    }
    
    return characteristics;
  }

  private calculateTypeDistribution(classifications: DiamondClassification[]): Record<DiamondType, number> {
    const distribution: Record<DiamondType, number> = {
      [DiamondType.SIMPLE]: 0,
      [DiamondType.NESTED]: 0,
      [DiamondType.OVERLAPPING]: 0,
      [DiamondType.CASCADE]: 0,
      [DiamondType.PARALLEL]: 0
    };
    
    classifications.forEach(classification => {
      distribution[classification.type]++;
    });
    
    return distribution;
  }

  private updateProgress(progress: number, operation: string): void {
    this._analysisProgress.update(current => ({
      ...current,
      progress: Math.round(progress),
      currentOperation: operation
    }));
  }

  private createEmptyResult(): DiamondDetectionResult {
    return {
      diamonds: [],
      classifications: [],
      totalCount: 0,
      typeDistribution: {
        [DiamondType.SIMPLE]: 0,
        [DiamondType.NESTED]: 0,
        [DiamondType.OVERLAPPING]: 0,
        [DiamondType.CASCADE]: 0,
        [DiamondType.PARALLEL]: 0
      },
      executionTime: 0,
      status: DiamondAnalysisStatus.PENDING,
      analyzedAt: new Date()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Persistence methods
  private saveToLocalStorage(data: { diamonds: DiamondStructure[]; classifications: DiamondClassification[] }): void {
    try {
      const serialized = JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('diamond-analysis-data', serialized);
    } catch (error) {
      console.warn('💎 Failed to save diamond data to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('diamond-analysis-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.diamonds && parsed.classifications) {
          this._diamonds.set(parsed.diamonds);
          this._classifications.set(parsed.classifications);
          this._detectionStatus.set(DiamondAnalysisStatus.COMPLETE);
          console.log('💎 Diamond data loaded from localStorage');
        }
      }
    } catch (error) {
      console.warn('💎 Failed to load diamond data from localStorage:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem('diamond-analysis-data');
    } catch (error) {
      console.warn('💎 Failed to clear diamond localStorage:', error);
    }
  }
}