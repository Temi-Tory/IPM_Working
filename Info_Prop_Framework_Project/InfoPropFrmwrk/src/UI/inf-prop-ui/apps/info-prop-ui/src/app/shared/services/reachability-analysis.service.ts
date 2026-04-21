import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  ReachabilityAnalysisRequest,
  ReachabilityAnalysisResponse,
  ScenarioInfo,
  MultiScenarioReachabilityResults,
  ReachabilityScenario
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class ReachabilityAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';
  private readonly PROBABILITY_ENDPOINT = '/probability-propagation';

  private http: HttpClient = inject(HttpClient);

  // **NEW: Multi-scenario state management**
  private multiScenarioResultsSignal = signal<MultiScenarioReachabilityResults>({
    scenarios: new Map(),
    currentScenario: '',
    availableScenarios: []
  });

  // **NEW: Computed properties for UI consumption**
  readonly multiScenarioResults = computed(() => this.multiScenarioResultsSignal());
  readonly currentScenario = computed(() => this.multiScenarioResultsSignal().currentScenario);
  readonly availableScenarios = computed(() => this.multiScenarioResultsSignal().availableScenarios);
  readonly currentReachabilityResults = computed(() => {
    const results = this.multiScenarioResultsSignal();
    return results.scenarios.get(results.currentScenario) || null;
  });

  analyzeReachability(request: ReachabilityAnalysisRequest): Observable<ReachabilityAnalysisResponse> {
    console.log('🔍 REACHABILITY SERVICE DEBUG:');
    console.log('📋 Request object keys:', Object.keys(request));
    console.log('📋 Complete request object:', request);
    console.log('🔍 DETAILED REQUEST ANALYSIS:');
    console.log(`  networkPath: '${request.networkPath}' (type: ${typeof request.networkPath})`);
    console.log(`  edgesFilePath: '${request.edgesFilePath}' (type: ${typeof request.edgesFilePath})`);
    console.log(`  nodepriorsPath: '${request.nodepriorsPath}' (type: ${typeof request.nodepriorsPath})`);
    console.log(`  linkprobsPath: '${request.linkprobsPath}' (type: ${typeof request.linkprobsPath})`);
    console.log('🚀 Sending HTTP POST to:', `${this.API_BASE}${this.PROBABILITY_ENDPOINT}`);
    
    return this.http.post<ReachabilityAnalysisResponse>(
      `${this.API_BASE}${this.PROBABILITY_ENDPOINT}`,
      request
    ).pipe(
      map(response => this.normalizeReachabilityResponse(response)),
      tap(response => {
        console.log('🔗 Reachability analysis response:', response.success ? 'SUCCESS' : 'FAILED');
        if (!response.success) {
          console.error('❌ Reachability analysis failed:', response);
        }
        if (response.success && response.reachability_result) {
          console.log('📊 Reachability stats:', {
            computationTime: response.reachability_result.scenario_computation_time,
            hasExactInference: !!response.reachability_result.exact_inference,
            hasDiamondAnalysis: !!response.reachability_result.diamond_analysis,
            inputFiles: response.reachability_result.input_files
          });
        }
      })
    );
  }

  private normalizeReachabilityResponse(response: ReachabilityAnalysisResponse): ReachabilityAnalysisResponse {
    const asAny = response as unknown as Record<string, any>;

    if (asAny['reachability_result']) {
      return response;
    }

    const probabilityResult = asAny['probability_result'] ?? {};
    const scenarioComputationTime =
      Number(probabilityResult['scenario_computation_time']) ||
      Number(probabilityResult?.exact_inference?.computation_time) ||
      0;

    const normalized: ReachabilityAnalysisResponse = {
      ...response,
      reachability_result: {
        diamond_analysis: probabilityResult['diamond_analysis'],
        exact_inference: probabilityResult['exact_inference'],
        scenario_computation_time: scenarioComputationTime,
        input_files: {
          nodepriors_path: asAny['nodepriors_path'] ?? '',
          linkprobs_path: asAny['linkprobs_path'] ?? ''
        }
      }
    };

    return normalized;
  }

  // **NEW: Multi-scenario reachability analysis**
  analyzeMultipleScenarios(networkPath: string, scenarios: ScenarioInfo[]): Observable<MultiScenarioReachabilityResults> {
    console.log('🔍 Starting multi-scenario reachability analysis for scenarios:', scenarios.map(s => s.name));
    
    const analysisRequests = scenarios.map(scenario => {
      // Extract the corresponding link probabilities path
      const linkprobsPath = this.findCorrespondingLinkprobsPath(scenario, scenarios);
      
      const request: ReachabilityAnalysisRequest = {
        networkPath,
        edgesFilePath: `${networkPath}/${this.extractNetworkName(networkPath)}.EDGES`,
        nodepriorsPath: scenario.path,
        linkprobsPath: linkprobsPath,
        includeExactInference: true,
        includeDiamondAnalysis: true
      };

      return this.analyzeReachability(request).pipe(
        map(response => ({
          scenario: scenario.name,
          result: response.success ? response.reachability_result : null,
          scenarioInfo: scenario
        })),
        catchError(error => {
          console.error(`Failed to analyze scenario ${scenario.name}:`, error);
          return of({ scenario: scenario.name, result: null, scenarioInfo: scenario });
        })
      );
    });

    return forkJoin(analysisRequests).pipe(
      map(results => {
        const scenarioMap = new Map<string, ReachabilityScenario>();
        const validScenarios: ScenarioInfo[] = [];
        
        results.forEach(({ scenario, result, scenarioInfo }) => {
          if (result) {
            scenarioMap.set(scenario, result);
            validScenarios.push(scenarioInfo);
          }
        });

        const multiResults: MultiScenarioReachabilityResults = {
          scenarios: scenarioMap,
          currentScenario: validScenarios[0]?.name || '',
          availableScenarios: validScenarios
        };

        this.multiScenarioResultsSignal.set(multiResults);
        console.log('✅ Multi-scenario reachability analysis completed:', {
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
    console.log('🎯 Current reachability scenario set to:', scenarioName);
  }

  // **NEW: Helper methods**
  private extractNetworkName(networkPath: string): string {
    const pathParts = networkPath.split(/[\\/]/);
    return pathParts[pathParts.length - 1];
  }

  private findCorrespondingLinkprobsPath(nodepriorsScenario: ScenarioInfo, allScenarios: ScenarioInfo[]): string {
    // Find the corresponding linkprobs file for the same data type
    const linkprobsScenario = allScenarios.find(s =>
      s.dataType === nodepriorsScenario.dataType &&
      s.path.includes('linkprob')
    );
    
    if (linkprobsScenario) {
      return linkprobsScenario.path;
    }
    
    // Fallback: construct expected path
    const basePath = nodepriorsScenario.path.replace(/nodepriors?.*\.json$/i, '');
    return `${basePath}linkprobs.json`;
  }

  // **NEW: Clear multi-scenario state**
  clearMultiScenarioState(): void {
    this.multiScenarioResultsSignal.set({
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    });
    console.log('🧹 Multi-scenario reachability state cleared');
  }
}