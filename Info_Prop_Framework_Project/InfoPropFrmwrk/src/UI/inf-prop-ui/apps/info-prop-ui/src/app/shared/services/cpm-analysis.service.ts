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
      `${this.API_BASE}/cpm-analysis`,
      request
    ).pipe(
      tap(response => {
        // Only cache if response has actual data
        if (response.success && response.cpm_result) {
          this.cpmCache.set(cacheKey, response);
        }
      })
    );
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
        edgesFilePath: `${this.extractNetworkName(networkPath)}.EDGES`,
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