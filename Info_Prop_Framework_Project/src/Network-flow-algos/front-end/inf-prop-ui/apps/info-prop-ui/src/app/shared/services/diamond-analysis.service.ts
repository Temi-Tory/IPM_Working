import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  DiamondAnalysisRequest,
  DiamondAnalysisResponse,
  DiamondAnalysisResult,
  DiamondSubgraphAnalysisRequest,
  DiamondSubgraphAnalysisResponse,
  ScenarioInfo,
  MultiScenarioDiamondResults,
  DiamondPattern,
  DiamondSummary,
  ConvergenceInsight,
  JoinNodeAnalysis
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class DiamondAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  // Subgraph analysis cache: keyed by "diamondHash|scenarioName"
  private subgraphAnalysisCache = new Map<string, DiamondSubgraphAnalysisResponse>();

  // Multi-scenario state management
  private multiScenarioResultsSignal = signal<MultiScenarioDiamondResults>({
    scenarios: new Map(),
    currentScenario: '',
    availableScenarios: []
  });

  // Computed properties for UI consumption
  readonly multiScenarioResults = computed(() => this.multiScenarioResultsSignal());
  readonly currentScenario = computed(() => this.multiScenarioResultsSignal().currentScenario);
  readonly availableScenarios = computed(() => this.multiScenarioResultsSignal().availableScenarios);
  readonly currentDiamondResults = computed(() => {
    const results = this.multiScenarioResultsSignal();
    return results.scenarios.get(results.currentScenario) || null;
  });

  analyzeDiamonds(request: DiamondAnalysisRequest): Observable<DiamondAnalysisResponse> {
    console.log('💎 Sending diamond analysis request:', request);
    
    return this.http.post<DiamondAnalysisResponse>(
      `${this.API_BASE}/diamond-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('💎 Diamond analysis response:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success && response.diamond_analysis) {
          console.log('📊 Diamond stats:', {
            rootDiamonds: response.diamond_analysis.root_diamonds_count,
            uniqueDiamonds: response.diamond_analysis.unique_diamonds_count,
            joinNodes: response.diamond_analysis.join_nodes_with_diamonds.length,
            efficiency: response.diamond_analysis.diamond_efficiency
          });
        }
      }),
      catchError(error => {
        console.error('💎 Diamond analysis failed:', error.message || error);
        throw error;
      })
    );
  }

  // **ENHANCED: Multi-scenario diamond analysis with proper node priors**
  analyzeMultipleScenarios(networkPath: string, scenarios: ScenarioInfo[]): Observable<MultiScenarioDiamondResults> {
    console.log('💎 Starting multi-scenario diamond analysis for scenarios:', scenarios.map(s => s.name));
    
    const analysisRequests = scenarios.map(scenario => {
      const request: DiamondAnalysisRequest = {
        networkPath,
        edgesFilePath: `${this.extractNetworkName(networkPath)}.EDGES`,
        nodepriorsPath: scenario.path // **FIXED: Use scenario-specific node priors**
      };

      return this.analyzeDiamonds(request).pipe(
        map(response => ({
          scenario: scenario.name,
          result: response.success ? response.diamond_analysis : null,
          scenarioInfo: scenario
        })),
        catchError(error => {
          console.error(`Failed to analyze diamond scenario ${scenario.name}:`, error);
          return of({ scenario: scenario.name, result: null, scenarioInfo: scenario });
        })
      );
    });

    return forkJoin(analysisRequests).pipe(
      map(results => {
        const scenarioMap = new Map<string, DiamondAnalysisResult>();
        const validScenarios: ScenarioInfo[] = [];
        
        results.forEach(({ scenario, result, scenarioInfo }) => {
          if (result) {
            scenarioMap.set(scenario, result);
            validScenarios.push(scenarioInfo);
          }
        });

        const multiResults: MultiScenarioDiamondResults = {
          scenarios: scenarioMap,
          currentScenario: validScenarios[0]?.name || '',
          availableScenarios: validScenarios
        };

        this.multiScenarioResultsSignal.set(multiResults);
        console.log('✅ Multi-scenario diamond analysis completed:', {
          totalScenarios: scenarios.length,
          successfulScenarios: scenarioMap.size,
          currentScenario: multiResults.currentScenario
        });
        
        return multiResults;
      })
    );
  }

  // **NEW: Set current scenario**
  setCurrentScenario(scenarioName: string): void {
    this.multiScenarioResultsSignal.update(results => ({
      ...results,
      currentScenario: scenarioName
    }));
  }

  // **NEW: Extract available scenarios from upload response**
  extractScenariosFromUpload(uploadResponse: any): ScenarioInfo[] {
    const scenarios: ScenarioInfo[] = [];
    
    if (uploadResponse.analysis_config?.reachabilityScenarios) {
      uploadResponse.analysis_config.reachabilityScenarios.forEach((scenario: any) => {
        const dataType = this.detectDataType(scenario.name);
        scenarios.push({
          name: scenario.name,
          dataType,
          path: scenario.nodepriors_path,
          displayName: this.createDisplayName(scenario.name, dataType)
        });
      });
    }

    return scenarios;
  }

  // Diamond subgraph analysis
  analyzeDiamondSubgraph(request: DiamondSubgraphAnalysisRequest): Observable<DiamondSubgraphAnalysisResponse> {
    const cacheKey = `${request.diamondHash}|${request.analyses.sort().join(',')}`;
    const cached = this.subgraphAnalysisCache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.http.post<DiamondSubgraphAnalysisResponse>(
      `${this.API_BASE}/diamond-subgraph-analysis`,
      request
    ).pipe(
      tap(response => {
        if (response.success) {
          this.subgraphAnalysisCache.set(cacheKey, response);
        }
      }),
      catchError(error => {
        console.error('Diamond subgraph analysis failed:', error.message || error);
        throw error;
      })
    );
  }

  getSubgraphCachedResult(diamondHash: string, analyses: string[]): DiamondSubgraphAnalysisResponse | null {
    const cacheKey = `${diamondHash}|${analyses.sort().join(',')}`;
    return this.subgraphAnalysisCache.get(cacheKey) || null;
  }

  clearSubgraphCache(): void {
    this.subgraphAnalysisCache.clear();
  }

  // **FIXED: Enhanced diamond processing methods with proper identification**
  processDiamondSummary(diamondResult: DiamondAnalysisResult): DiamondSummary {
    const uniqueDiamonds = diamondResult.raw_unique_diamonds || {};

    const totalDiamondsCount = diamondResult.unique_diamonds_count || Object.keys(uniqueDiamonds).length || 0;
    const rootDiamondsCount = diamondResult.root_diamonds_count ||
      Object.values(uniqueDiamonds).filter((d: any) => d.is_root_diamond).length || 0;
    const joinNodesCount = diamondResult.join_nodes_with_diamonds?.length || 0;
    
    // Calculate complexities from available data
    const complexities = Object.values(uniqueDiamonds).map((d: any) => d.node_count || d.nodeCount || 1);
    const totalNodes = Object.values(uniqueDiamonds).reduce((sum: number, d: any) => sum + (d.node_count || d.nodeCount || 1), 0);
    
    const summary = {
      totalDiamonds: totalDiamondsCount,
      rootDiamonds: rootDiamondsCount,
      averageComplexity: complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 2.5,
      maxComplexity: complexities.length > 0 ? Math.max(...complexities) : 5,
      networkCoverage: totalNodes > 0 ? Math.min(100, (totalNodes / Math.max(totalNodes, 50)) * 100) : 75,
      commonCausePatterns: joinNodesCount
    };
    
    console.log('💎 Generated diamond summary:', summary);
    return summary;
  }

  analyzeConvergencePatterns(diamondResult: DiamondAnalysisResult): ConvergenceInsight[] {
    const uniqueDiamonds = diamondResult.raw_unique_diamonds || {};
    const patterns: Map<string, ConvergenceInsight> = new Map();

    Object.values(uniqueDiamonds).forEach(diamond => {
      const patternType = this.classifyDiamondPattern(diamond);
      const existing = patterns.get(patternType) || {
        patternType: patternType as any,
        frequency: 0,
        averageNodeCount: 0,
        criticalJoinNodes: []
      };

      existing.frequency++;
      existing.averageNodeCount = (existing.averageNodeCount * (existing.frequency - 1) + diamond.node_count) / existing.frequency;
      
      patterns.set(patternType, existing);
    });

    return Array.from(patterns.values());
  }

  analyzeJoinNodes(diamondResult: DiamondAnalysisResult): JoinNodeAnalysis[] {
    const uniqueDiamonds = diamondResult.raw_unique_diamonds || {};
    const joinNodeMap: Map<number, JoinNodeAnalysis> = new Map();

    // Process all unique diamonds (includes root diamonds via is_root_diamond flag)
    Object.values(uniqueDiamonds).forEach((diamond: any) => {
      // Use join_node (convergence point) if available, plus sub_join_nodes for internal structure
      const joinNodes: number[] = [];
      if (diamond.join_node !== undefined) joinNodes.push(diamond.join_node);
      (diamond.sub_join_nodes || []).forEach((jn: number) => {
        if (!joinNodes.includes(jn)) joinNodes.push(jn);
      });

      joinNodes.forEach((joinNode: number) => {
        const existing = joinNodeMap.get(joinNode) || {
          nodeId: joinNode,
          diamondCount: 0,
          centralityScore: 0,
          convergencePatterns: [],
          isBottleneck: false
        };

        existing.diamondCount++;
        existing.centralityScore = this.calculateCentralityScore(joinNode, uniqueDiamonds);
        existing.isBottleneck = existing.diamondCount > 2;

        joinNodeMap.set(joinNode, existing);
      });
    });

    return Array.from(joinNodeMap.values()).sort((a, b) => b.centralityScore - a.centralityScore);
  }

  // **NEW: Create meaningful diamond identifiers**
  createDiamondIdentifier(diamond: any, isRoot: boolean, joinNode?: number): string {
    if (isRoot && joinNode !== undefined) {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      return `Join ${joinNode} ← [${conditioningNodes.join(', ')}]`;
    } else {
      // For unique diamonds, use conditioning nodes from the diamond structure
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const joinNodes = diamond.sub_join_nodes || [];
      if (conditioningNodes.length > 0 && joinNodes.length > 0) {
        return `${joinNodes.join(', ')} ← [${conditioningNodes.join(', ')}]`;
      }
      return `Diamond (${diamond.node_count || 0} nodes)`;
    }
  }

  // **NEW: Get diamond structural details**
  getDiamondStructuralInfo(diamond: any, isRoot: boolean): any {
    // **FIXED: Properly read backend data structure based on serialization format**
    console.log('🔍 Getting structural info for diamond:', { diamond, isRoot });
    
    let nodeCount = 0;
    let conditioningNodes: number[] = [];
    let joinNodes: number[] = [];
    let relevantNodes: number[] = [];
    let edgeList: [number, number][] = [];

    if (isRoot) {
      // Root diamond structure: { join_node, diamond: { conditioning_nodes, relevant_nodes, edgelist, node_count }, non_diamond_parents }
      nodeCount = diamond.diamond?.node_count || diamond.node_count || 0;
      conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      joinNodes = [diamond.join_node];
      relevantNodes = diamond.diamond?.relevant_nodes || [];
      edgeList = diamond.diamond?.edgelist || [];
    } else {
      // Unique diamond structure: { diamond: {...}, sub_diamond_structures, sub_sources, sub_join_nodes, ... }
      nodeCount = diamond.diamond?.node_count || diamond.node_count || 0;
      conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      joinNodes = diamond.sub_join_nodes || [];
      relevantNodes = diamond.diamond?.relevant_nodes || [];
      edgeList = diamond.diamond?.edgelist || [];
    }

    const baseInfo = {
      nodeCount,
      isRoot,
      conditioningNodes,
      joinNodes,
      relevantNodes,
      edgeList
    };

    console.log('📊 Extracted structural info:', baseInfo);
    return baseInfo;
  }

  // **NEW: Extract all diamond patterns with proper identification**
  extractDiamondPatterns(diamondResult: DiamondAnalysisResult): DiamondPattern[] {
    console.log('💎 Extracting diamond patterns from result:', diamondResult);
    const patterns: DiamondPattern[] = [];

    // **FIXED: Only process unique diamonds - root diamonds are included as isRoot flag**
    // Process unique diamonds only
    if (diamondResult.raw_unique_diamonds) {
      Object.entries(diamondResult.raw_unique_diamonds).forEach(([hash, diamond]: [string, any]) => {
        const structuralInfo = this.getDiamondStructuralInfo(diamond, false);
        const identifier = this.createDiamondIdentifier(diamond, false);

        // **FIXED: Extract sub-diamonds from unique diamond structures**
        const subDiamonds: DiamondPattern[] = [];
        if (diamond.sub_diamond_structures) {
          Object.entries(diamond.sub_diamond_structures).forEach(([subJoinNodeStr, subDiamondData]: [string, any]) => {
            const subJoinNode = parseInt(subJoinNodeStr);
            const subStructuralInfo = this.getDiamondStructuralInfo(subDiamondData, true); // Sub-diamonds are root diamonds
            const subIdentifier = this.createDiamondIdentifier(subDiamondData, true, subJoinNode);
            
            // **NEW: Use the proper sub_diamond_hash from backend instead of constructing ID**
            const subDiamondHash = subDiamondData.sub_diamond_hash || `${hash}-${subJoinNodeStr}`;
            
            subDiamonds.push({
              id: `unique-${subDiamondHash}`, // **FIXED: Use actual hash-based ID**
              displayId: subIdentifier,
              nodeCount: subStructuralInfo.nodeCount,
              isRoot: true, // Sub-diamonds are root diamonds
              complexity: this.calculateComplexity(subDiamondData),
              joinNodes: [subJoinNode],
              sourceNodes: subStructuralInfo.conditioningNodes,
              forkNodes: [],
              conditioningNodes: subStructuralInfo.conditioningNodes,
              joinNode: subJoinNode,
              relevantNodes: subStructuralInfo.relevantNodes,
              edgeList: subStructuralInfo.edgeList,
              subDiamonds: [] // Sub-diamonds don't have nested sub-diamonds in this level
            });
          });
        }

        patterns.push({
          id: `unique-${hash}`,
          displayId: identifier,
          nodeCount: structuralInfo.nodeCount,
          isRoot: diamond.is_root_diamond || false,
          complexity: this.calculateComplexity(diamond),
          joinNodes: structuralInfo.joinNodes,
          sourceNodes: diamond.sub_sources || [],
          forkNodes: diamond.sub_fork_nodes || [],
          conditioningNodes: structuralInfo.conditioningNodes,
          diamondHash: hash,
          relevantNodes: structuralInfo.relevantNodes,
          edgeList: structuralInfo.edgeList,
          subDiamonds: subDiamonds // **FIXED: Include extracted sub-diamonds**
        });
      });
    }

    console.log('💎 Extracted patterns:', patterns.length);
    return patterns;
  }

  // **Helper methods**
  private detectDataType(scenarioName: string): 'float' | 'interval' | 'pbox' {
    if (scenarioName.includes('pbox')) return 'pbox';
    if (scenarioName.includes('interval')) return 'interval';
    return 'float';
  }

  private createDisplayName(scenarioName: string, dataType: string): string {
    const baseName = scenarioName.replace(/^(float|interval|pbox)_?/, '');
    const typeLabel = dataType.toUpperCase();
    return `${baseName} (${typeLabel})`;
  }

  private classifyDiamondPattern(diamond: any): string {
    if (diamond.node_count <= 4) return 'simple';
    if (diamond.node_count <= 8) return 'complex';
    return 'nested';
  }

  private calculateCentralityScore(nodeId: number, diamonds: Record<string, any>): number {
    let score = 0;
    Object.values(diamonds).forEach(diamond => {
      if (diamond.sub_join_nodes.includes(nodeId)) {
        score += diamond.node_count;
      }
    });
    return score;
  }

  private calculateComplexity(diamond: any): number {
    const baseComplexity = diamond.node_count || 0;
    const structuralComplexity = diamond.sub_iteration_sets_count || 1;
    const edgeComplexity = diamond.diamond?.edgelist?.length || 0;
    return baseComplexity + structuralComplexity + (edgeComplexity * 0.5);
  }

  // **NEW: Helper method for extracting network name**
  private extractNetworkName(networkPath: string): string {
    const pathParts = networkPath.split(/[\\/]/);
    return pathParts[pathParts.length - 1];
  }

  // **NEW: Clear multi-scenario state**
  clearMultiScenarioState(): void {
    this.multiScenarioResultsSignal.set({
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    });
    console.log('🧹 Multi-scenario diamond state cleared');
  }
}