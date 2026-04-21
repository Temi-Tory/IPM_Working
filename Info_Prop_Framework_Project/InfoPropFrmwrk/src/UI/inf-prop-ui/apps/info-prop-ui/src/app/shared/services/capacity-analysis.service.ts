import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  CapacityAnalysisRequest,
  CapacityAnalysisResponse,
  ScenarioInfo,
  MultiScenarioCapacityResults,
  CapacityScenario
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class CapacityAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';
  private readonly FLOW_ENDPOINT = '/flow-analysis';

  private http: HttpClient = inject(HttpClient);

  // **NEW: Multi-scenario state management**
  private multiScenarioResultsSignal = signal<MultiScenarioCapacityResults>({
    scenarios: new Map(),
    currentScenario: '',
    availableScenarios: []
  });

  // **NEW: Computed properties for UI consumption**
  readonly multiScenarioResults = computed(() => this.multiScenarioResultsSignal());
  readonly currentScenario = computed(() => this.multiScenarioResultsSignal().currentScenario);
  readonly availableScenarios = computed(() => this.multiScenarioResultsSignal().availableScenarios);
  readonly currentCapacityResults = computed(() => {
    const results = this.multiScenarioResultsSignal();
    return results.scenarios.get(results.currentScenario) || null;
  });

  analyzeCapacity(request: CapacityAnalysisRequest): Observable<CapacityAnalysisResponse> {
    console.log('⚡ CAPACITY SERVICE DEBUG:');
    console.log('📋 Request object keys:', Object.keys(request));
    console.log('📋 Complete request object:', request);
    console.log('🔍 DETAILED REQUEST ANALYSIS:');
    console.log(`  networkPath: '${request.networkPath}' (type: ${typeof request.networkPath})`);
    console.log(`  edgesFilePath: '${request.edgesFilePath}' (type: ${typeof request.edgesFilePath})`);
    console.log(`  capacitiesPath: '${request.capacitiesPath}' (type: ${typeof request.capacitiesPath})`);
    console.log('🚀 Sending HTTP POST to:', `${this.API_BASE}${this.FLOW_ENDPOINT}`);
    
    return this.http.post<CapacityAnalysisResponse>(
      `${this.API_BASE}${this.FLOW_ENDPOINT}`,
      request
    ).pipe(
      map(response => this.normalizeCapacityResponse(response)),
      tap(response => {
        console.log('⚡ Capacity analysis response:', response.success ? 'SUCCESS' : 'FAILED');
        if (!response.success) {
          console.error('❌ Capacity analysis failed:', response);
        }
        if (response.success && response.capacity_result) {
          console.log('📊 Capacity stats:', {
            utilization: response.capacity_result.network_utilization,
            totalInput: response.capacity_result.total_source_input,
            totalOutput: response.capacity_result.total_target_output,
            activeSources: response.capacity_result.active_sources?.length || 0,
            computationTime: response.capacity_result.computation_time,
            inputFiles: response.capacity_result.input_files
          });
        }
      })
    );
  }

  private normalizeCapacityResponse(response: CapacityAnalysisResponse): CapacityAnalysisResponse {
    const asAny = response as unknown as Record<string, unknown>;
    const capacityResult = asAny['capacity_result'];
    if (!capacityResult || typeof capacityResult !== 'object') {
      return response;
    }

    const capacityRecord = capacityResult as Record<string, unknown>;

    if (capacityRecord['raw_capacity_result']) {
      return response;
    }

    const flow = (capacityRecord['flow'] as Record<string, unknown> | undefined) ?? {};
    const sinkFlow = Array.isArray(flow['sink_flow']) ? (flow['sink_flow'] as unknown[]) : [];
    const targetFlows = Object.fromEntries(
      sinkFlow.map((pair) => {
        const tuple = Array.isArray(pair) ? pair : [];
        return [String(tuple[0] ?? ''), Number(tuple[1] ?? 0)];
      })
    );
    const totalTargetOutput = Object.values(targetFlows).reduce((sum: number, v) => sum + Number(v || 0), 0);

    const failureImpact = (capacityRecord['failure_impact'] as Record<string, unknown> | undefined) ?? {};
    const minCutEdges = Array.isArray(failureImpact['min_cut_edges']) ? failureImpact['min_cut_edges'] : [];
    const inputRecord = (asAny['input'] as Record<string, unknown> | undefined) ?? {};
    const activeSources = Array.isArray(inputRecord['source_nodes']) ? inputRecord['source_nodes'].map((v) => Number(v)) : [];
    const targetNodes = Array.isArray(inputRecord['sink_nodes']) ? inputRecord['sink_nodes'].map((v) => Number(v)) : [];

    const normalized = {
      computation_time: Number(asAny['computation_time']) || 0,
      network_utilization: 0,
      total_source_input: totalTargetOutput,
      total_target_output: totalTargetOutput,
      target_flows: targetFlows,
      active_sources: activeSources,
      target_nodes: targetNodes,
      node_capacities_count: 0,
      edge_capacities_count: 0,
      input_files: {
        capacities_path: String(inputRecord['capacities_path'] ?? '')
      },
      raw_capacity_result: {
        node_max_flows: targetFlows,
        node_capacities: {},
        edge_capacities: {},
        source_rates: {},
        bottlenecks: {
          min_cut_edges: minCutEdges
        },
        critical_paths: {},
        network_utilization: 0,
        analysis_type: 'capacity-analysis-kit',
        computation_time: Number(asAny['computation_time']) || 0,
        convergence_info: {}
      }
    };

    return {
      ...response,
      capacity_result: normalized as unknown as CapacityScenario
    };
  }

  // **NEW: Multi-scenario capacity analysis**
  analyzeMultipleScenarios(networkPath: string, scenarios: ScenarioInfo[]): Observable<MultiScenarioCapacityResults> {
    console.log('⚡ Starting multi-scenario capacity analysis for scenarios:', scenarios.map(s => s.name));
    
    const analysisRequests = scenarios.map(scenario => {
      const request: CapacityAnalysisRequest = {
        networkPath,
        edgesFilePath: `${this.extractNetworkName(networkPath)}.EDGES`,
        capacitiesPath: scenario.path
      };

      return this.analyzeCapacity(request).pipe(
        map(response => ({
          scenario: scenario.name,
          result: response.success ? response.capacity_result : null,
          scenarioInfo: scenario
        })),
        catchError(error => {
          console.error(`Failed to analyze capacity scenario ${scenario.name}:`, error);
          return of({ scenario: scenario.name, result: null, scenarioInfo: scenario });
        })
      );
    });

    return forkJoin(analysisRequests).pipe(
      map(results => {
        const scenarioMap = new Map<string, CapacityScenario>();
        const validScenarios: ScenarioInfo[] = [];
        
        results.forEach(({ scenario, result, scenarioInfo }) => {
          if (result) {
            scenarioMap.set(scenario, result);
            validScenarios.push(scenarioInfo);
          }
        });

        const multiResults: MultiScenarioCapacityResults = {
          scenarios: scenarioMap,
          currentScenario: validScenarios[0]?.name || '',
          availableScenarios: validScenarios
        };

        this.multiScenarioResultsSignal.set(multiResults);
        console.log('✅ Multi-scenario capacity analysis completed:', {
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
    console.log('🎯 Current capacity scenario set to:', scenarioName);
  }

  // **NEW: Helper methods**
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
    console.log('🧹 Multi-scenario capacity state cleared');
  }
}