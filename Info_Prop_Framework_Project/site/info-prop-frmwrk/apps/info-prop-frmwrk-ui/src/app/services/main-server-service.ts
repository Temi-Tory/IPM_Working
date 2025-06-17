// src/app/services/main-server.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  StructureAnalysisRequest, 
  StructureAnalysisResponse, 
  DiamondAnalysisResponse, 
  EnhancedAnalysisRequest, 
  FullAnalysisResponse, 
  BasicAnalysisRequest, 
  DiamondSubsetAnalysisRequest, 
  DiamondSubsetAnalysisResponse, 
  DotExportRequest, 
  DotExportResponse,
  DiamondStructureData
} from '../shared/models/main-sever-interface';

@Injectable({
  providedIn: 'root'
})
export class MainServerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    })
  };

  // Tier 1: Structure-only Analysis
  analyzeStructure(request: StructureAnalysisRequest): Observable<StructureAnalysisResponse> {
    const url = `${this.baseUrl}/api/parse-structure`;
    return this.http.post<StructureAnalysisResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Tier 2: Diamond Analysis (structure + diamond classification)
  analyzeDiamonds(request: StructureAnalysisRequest): Observable<DiamondAnalysisResponse> {
    const url = `${this.baseUrl}/api/analyze-diamond`;
    return this.http.post<DiamondAnalysisResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Tier 3: Full Enhanced Analysis (with belief propagation)
  analyzeEnhanced(request: EnhancedAnalysisRequest): Observable<FullAnalysisResponse> {
    const url = `${this.baseUrl}/api/analyze-enhanced`;
    return this.http.post<FullAnalysisResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Basic Analysis (legacy endpoint)
  analyzeBasic(request: BasicAnalysisRequest): Observable<FullAnalysisResponse> {
    const url = `${this.baseUrl}/api/analyze`;
    return this.http.post<FullAnalysisResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Diamond Subset Analysis
  analyzeDiamondSubset(request: DiamondSubsetAnalysisRequest): Observable<DiamondSubsetAnalysisResponse> {
    const url = `${this.baseUrl}/api/analyze-diamond-subset`;
    return this.http.post<DiamondSubsetAnalysisResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Export DOT format
  exportDot(request: DotExportRequest): Observable<DotExportResponse> {
    const url = `${this.baseUrl}/api/export-dot`;
    return this.http.post<DotExportResponse>(url, request, this.httpOptions)
      .pipe(retry(1), catchError(this.handleError));
  }

  // Server health check
  checkServerHealth(): Observable<string> {
    return this.http.get(`${this.baseUrl}/`, { responseType: 'text' })
      .pipe(catchError(this.handleError));
  }

  // Helper: Build enhanced analysis request
  buildEnhancedRequest(
    csvContent: string,
    basicParams: {
      nodePrior: number;
      edgeProb: number;
      overrideNodePrior: boolean;
      overrideEdgeProb: boolean;
    },
    advancedOptions?: {
      includeClassification?: boolean;
      enableMonteCarlo?: boolean;
      useIndividualOverrides?: boolean;
      individualNodePriors?: { [nodeId: string]: number };
      individualEdgeProbabilities?: { [edgeKey: string]: number };
    }
  ): EnhancedAnalysisRequest {
    return {
      csvContent,
      ...basicParams,
      includeClassification: advancedOptions?.includeClassification ?? true,
      enableMonteCarlo: advancedOptions?.enableMonteCarlo ?? false,
      useIndividualOverrides: advancedOptions?.useIndividualOverrides ?? false,
      individualNodePriors: advancedOptions?.individualNodePriors ?? {},
      individualEdgeProbabilities: advancedOptions?.individualEdgeProbabilities ?? {}
    };
  }

  // Helper: Build diamond subset request - Updated with proper types
  buildDiamondSubsetRequest(
    diamondData: { joinNode: string; structure: DiamondStructureData },
    overrides?: {
      overrideNodePrior?: boolean;
      overrideEdgeProb?: boolean;
      nodePrior?: number;
      edgeProb?: number;
      useIndividualOverrides?: boolean;
      individualNodePriors?: { [nodeId: string]: number };
      individualEdgeProbabilities?: { [edgeKey: string]: number };
    }
  ): DiamondSubsetAnalysisRequest {
    return {
      diamondData,
      overrideNodePrior: overrides?.overrideNodePrior ?? false,
      overrideEdgeProb: overrides?.overrideEdgeProb ?? false,
      nodePrior: overrides?.nodePrior ?? 1.0,
      edgeProb: overrides?.edgeProb ?? 0.9,
      useIndividualOverrides: overrides?.useIndividualOverrides ?? false,
      individualNodePriors: overrides?.individualNodePriors ?? {},
      individualEdgeProbabilities: overrides?.individualEdgeProbabilities ?? {}
    };
  }

  // Updated error handling with proper types
  private handleError = (error: HttpErrorResponse | Error | unknown): Observable<never> => {
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof HttpErrorResponse) {
      // Server-side HTTP error
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check if the Julia server is running on localhost:8080';
      } else if (error.status === 500) {
        errorMessage = `Server Error: ${error.error?.error || 'Internal server error'}`;
      } else {
        errorMessage = `Server Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    } else if (error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.message}`;
    } else if (error instanceof Error) {
      // Generic Error object
      errorMessage = `Error: ${error.message}`;
    } else if (typeof error === 'string') {
      // String error
      errorMessage = error;
    } else {
      // Unknown error type
      errorMessage = 'An unexpected error occurred';
    }
    
    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  };
}