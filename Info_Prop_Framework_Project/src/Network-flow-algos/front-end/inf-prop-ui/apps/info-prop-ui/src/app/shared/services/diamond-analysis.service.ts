import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  DiamondAnalysisRequest,
  DiamondAnalysisResponse,
  DiamondAnalysisResult,
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
    return this.http.post<DiamondAnalysisResponse>(
      `${this.API_BASE}/diamond-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('💎 DIAMOND ANALYSIS RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('💎 DIAMOND ANALYSIS KEYS:', Object.keys(response));
        if (response.diamond_analysis) {
          console.log('💎 DIAMOND ANALYSIS DATA KEYS:', Object.keys(response.diamond_analysis));
          if (response.diamond_analysis.raw_unique_diamonds) {
            console.log('💎 RAW UNIQUE DIAMONDS KEYS:', Object.keys(response.diamond_analysis.raw_unique_diamonds));
          }
        }
      })
    );
  }

  // **NEW: Multi-scenario diamond analysis**
  analyzeMultipleScenarios(networkPath: string, scenarios: ScenarioInfo[]): Observable<MultiScenarioDiamondResults> {
    const analysisRequests = scenarios.map(scenario =>
      this.analyzeDiamonds({
        networkPath,
        useDefaultPriors: true
      }).pipe(
        map(response => ({ scenario: scenario.name, result: response.diamond_analysis })),
        catchError(error => {
          console.error(`Failed to analyze scenario ${scenario.name}:`, error);
          return of({ scenario: scenario.name, result: null });
        })
      )
    );

    return forkJoin(analysisRequests).pipe(
      map(results => {
        const scenarioMap = new Map<string, DiamondAnalysisResult>();
        results.forEach(({ scenario, result }) => {
          if (result) {
            scenarioMap.set(scenario, result);
          }
        });

        const multiResults: MultiScenarioDiamondResults = {
          scenarios: scenarioMap,
          currentScenario: scenarios[0]?.name || '',
          availableScenarios: scenarios
        };

        this.multiScenarioResultsSignal.set(multiResults);
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

  // **NEW: Data processing methods**
  processDiamondSummary(diamondResult: DiamondAnalysisResult): DiamondSummary {
    const uniqueDiamonds = diamondResult.raw_unique_diamonds || {};
    const rootDiamonds = diamondResult.raw_root_diamonds || {};
    
    const complexities = Object.values(uniqueDiamonds).map(d => d.node_count);
    const totalNodes = Object.values(uniqueDiamonds).reduce((sum, d) => sum + d.node_count, 0);
    
    return {
      totalDiamonds: diamondResult.unique_diamonds_count,
      rootDiamonds: diamondResult.root_diamonds_count,
      averageComplexity: complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0,
      maxComplexity: complexities.length > 0 ? Math.max(...complexities) : 0,
      networkCoverage: totalNodes > 0 ? (totalNodes / (totalNodes + 100)) * 100 : 0, // Approximate
      commonCausePatterns: diamondResult.join_nodes_with_diamonds.length
    };
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

    Object.values(uniqueDiamonds).forEach(diamond => {
      diamond.sub_join_nodes.forEach(joinNode => {
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

  // **NEW: Helper methods**
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
}