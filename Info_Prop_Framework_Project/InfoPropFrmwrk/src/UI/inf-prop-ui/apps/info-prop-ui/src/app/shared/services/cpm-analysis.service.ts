import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  CpmAnalysisRequest,
  CpmAnalysisResponse,
  ScenarioInfo,
  MultiScenarioCpmResults,
  CpmScenario
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class CpmAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';
  private readonly CRITICAL_PATH_ENDPOINT = '/critical-path-analysis';

  private http: HttpClient = inject(HttpClient);

  // Response cache: avoids duplicate /cpm-analysis calls when time and cost views both need the same data
  private cpmCache = new Map<string, CpmAnalysisResponse>();

  // Multi-scenario state management
  private multiScenarioResultsSignal = signal<MultiScenarioCpmResults>({
    scenarios: new Map(),
    currentScenario: '',
    availableScenarios: []
  });

  // **NEW: Computed properties for UI consumption**
  readonly multiScenarioResults = computed(() => this.multiScenarioResultsSignal());
  readonly currentScenario = computed(() => this.multiScenarioResultsSignal().currentScenario);
  readonly availableScenarios = computed(() => this.multiScenarioResultsSignal().availableScenarios);
  readonly currentCpmResults = computed(() => {
    const results = this.multiScenarioResultsSignal();
    return results.scenarios.get(results.currentScenario) || null;
  });

  analyzeCpm(request: CpmAnalysisRequest, bypassCache = false): Observable<CpmAnalysisResponse> {
    const cacheKey = `${request.networkPath}|${request.cpmPath}`;

    if (!bypassCache) {
      const cached = this.cpmCache.get(cacheKey);
      if (cached) {
        return of(cached);
      }
    } else {
      this.cpmCache.delete(cacheKey);
    }

    return this.http.post<CpmAnalysisResponse>(
      `${this.API_BASE}${this.CRITICAL_PATH_ENDPOINT}`,
      request
    ).pipe(
      map(response => this.normalizeCpmResponse(response)),
      tap(response => {
        // Only cache if response has actual data
        if (response.success && response.cpm_result) {
          this.cpmCache.set(cacheKey, response);
        }
      })
    );
  }

  private normalizeCpmResponse(response: CpmAnalysisResponse): CpmAnalysisResponse {
    const asAny = response as unknown as Record<string, any>;
    if (asAny['cpm_result']) {
      return response;
    }

    const critical = asAny['critical_path_result'] ?? {};
    const normalized: CpmAnalysisResponse = {
      ...response,
      cpm_result: {
        computation_time: Number(critical['computation_time']) || 0,
        time_result: critical['time_result'] ?? { critical_value: 0, critical_nodes: [], node_values: {} },
        cost_result: critical['cost_result'] ?? { critical_value: 0, critical_nodes: [], node_values: {} },
        input_data: critical['input_data'],
        node_durations_count: Number(critical['node_durations_count']) || 0,
        edge_delays_count: Number(critical['edge_delays_count']) || 0,
        node_costs_count: Number(critical['node_costs_count']) || 0,
        edge_costs_count: Number(critical['edge_costs_count']) || 0,
        input_files: critical['input_files'] ?? { cpm_path: asAny['cpm_path'] ?? '' }
      }
    };

    return normalized;
  }

  clearCache(): void {
    this.cpmCache.clear();
  }

  // **NEW: Multi-scenario CPM analysis**
  analyzeMultipleScenarios(networkPath: string, scenarios: ScenarioInfo[]): Observable<MultiScenarioCpmResults> {
    console.log('📊 Starting multi-scenario CPM analysis for scenarios:', scenarios.map(s => s.name));
    
    const analysisRequests = scenarios.map(scenario => {
      const request: CpmAnalysisRequest = {
        networkPath,
        cpmPath: scenario.path
      };

      return this.analyzeCpm(request).pipe(
        map(response => ({
          scenario: scenario.name,
          result: response.success ? response.cpm_result : null,
          scenarioInfo: scenario
        })),
        catchError(error => {
          console.error(`Failed to analyze CPM scenario ${scenario.name}:`, error);
          return of({ scenario: scenario.name, result: null, scenarioInfo: scenario });
        })
      );
    });

    return forkJoin(analysisRequests).pipe(
      map(results => {
        const scenarioMap = new Map<string, CpmScenario>();
        const validScenarios: ScenarioInfo[] = [];
        
        results.forEach(({ scenario, result, scenarioInfo }) => {
          if (result) {
            scenarioMap.set(scenario, result);
            validScenarios.push(scenarioInfo);
          }
        });

        const multiResults: MultiScenarioCpmResults = {
          scenarios: scenarioMap,
          currentScenario: validScenarios[0]?.name || '',
          availableScenarios: validScenarios
        };

        this.multiScenarioResultsSignal.set(multiResults);
        console.log('✅ Multi-scenario CPM analysis completed:', {
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
    console.log('🎯 Current CPM scenario set to:', scenarioName);
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
    this.cpmCache.clear();
  }
}