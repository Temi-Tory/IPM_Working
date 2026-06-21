import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { mapFlowAnalysisResponseToDomain } from './flow-domain.adapter';
import { FlowAnalysisDomainResult } from './flow-domain.models';
import { FlowWorkbenchOptions } from './flow-workbench.models';

@Injectable({ providedIn: 'root' })
export class FlowWorkbenchService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://localhost:8080';

  analyze(
    networkPath: string,
    capacitiesPath: string,
    edgesFilePath: string,
    options: FlowWorkbenchOptions
  ): Observable<FlowAnalysisDomainResult> {
    const payload: Record<string, unknown> = {
      networkPath,
      capacitiesPath,
      edgesFilePath,
      analysisOptions: {
        algorithm: options.algorithm,
        tol: options.tol,
        kFailure: options.kFailure,
        cutLimit: options.cutLimit,
        pathLimit: options.pathLimit,
        combinationLimit: options.combinationLimit,
        maxDepth: options.maxDepth,
        targetFlow: options.targetFlow,
        includeNodeCapacities: options.includeNodeCapacities
      }
    };

    return this.http
      .post<Record<string, unknown>>(`${this.apiBase}/flow-analysis`, payload)
      .pipe(map((response) => mapFlowAnalysisResponseToDomain(response)));
  }
}
