import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, map, catchError, throwError, tap } from 'rxjs';
import {
  NetworkUploadRequest,
  NetworkUploadResponse,
  NetworkGraph,
  DiamondAnalysisResult,
  ReachabilityQuery,
  ReachabilityResult,
  MonteCarloConfig,
  MonteCarloResult,
  ApiResponse,
  FileUploadProgress,
  ProbabilityType
} from '../models/network.models';
import { GlobalStateService } from './global-state.service';

/**
 * Service for communicating with the network analysis backend API
 * Handles all HTTP requests and integrates with global state management
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly globalState = inject(GlobalStateService);
  
  // API base URL - should be configurable via environment
  private readonly baseUrl = 'http://localhost:9090/api';

  /**
   * Upload network files and initialize analysis session
   */
  uploadNetwork(request: NetworkUploadRequest): Observable<NetworkUploadResponse> {
    const formData = new FormData();
    formData.append('network_file', request.networkFile);
    formData.append('probability_type', request.probabilityType);
    
    if (request.nodePriorsFile) {
      formData.append('node_priors_file', request.nodePriorsFile);
    }
    
    if (request.linkProbabilitiesFile) {
      formData.append('link_probabilities_file', request.linkProbabilitiesFile);
    }

    const httpRequest = new HttpRequest('POST', `${this.baseUrl}/processinput`, formData, {
      reportProgress: true
    });

    this.globalState.setUploading(true);
    this.globalState.setUploadProgress(null);

    return this.http.request<ApiResponse<NetworkUploadResponse>>(httpRequest).pipe(
      map(event => this.handleUploadProgress(event)),
      map(response => {
        if (response && 'data' in response) {
          const uploadResponse = response.data!;
          if (uploadResponse.success) {
            this.globalState.createSession(
              uploadResponse.sessionId,
              uploadResponse.networkId,
              request.probabilityType
            );
          }
          return uploadResponse;
        }
        throw new Error('Invalid response format');
      }),
      tap(() => {
        this.globalState.setUploading(false);
        this.globalState.setUploadProgress(null);
      }),
      catchError(error => {
        this.globalState.setUploading(false);
        this.globalState.setUploadProgress(null);
        this.globalState.setError(`Upload failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get complete network structure and details
   */
  getNetworkStructure(sessionId: string): Observable<NetworkGraph> {
    this.globalState.setLoading(true);
    
    return this.http.get<ApiResponse<NetworkGraph>>(`${this.baseUrl}/network/${sessionId}`).pipe(
      map(response => this.extractData(response)),
      tap(networkGraph => {
        this.globalState.setNetworkGraph(networkGraph);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Failed to load network structure: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform diamond processing and classification analysis
   */
  performDiamondProcessing(sessionId: string): Observable<DiamondAnalysisResult> {
    this.globalState.setLoading(true);
    
    return this.http.post<ApiResponse<DiamondAnalysisResult>>(
      `${this.baseUrl}/diamondprocessing`,
      { sessionId }
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.setDiamondAnalysis(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Diamond processing failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform diamond classification analysis
   */
  performDiamondClassification(sessionId: string): Observable<DiamondAnalysisResult> {
    this.globalState.setLoading(true);
    
    return this.http.post<ApiResponse<DiamondAnalysisResult>>(
      `${this.baseUrl}/diamondclassification`,
      { sessionId }
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.setDiamondAnalysis(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Diamond classification failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform reachability analysis with belief propagation
   */
  performReachabilityAnalysis(
    sessionId: string,
    query: ReachabilityQuery
  ): Observable<ReachabilityResult> {
    this.globalState.setLoading(true);
    
    return this.http.post<ApiResponse<ReachabilityResult>>(
      `${this.baseUrl}/reachabilitymodule`,
      { sessionId, ...query }
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.addReachabilityResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Reachability analysis failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform path enumeration between nodes
   */
  performPathEnumeration(
    sessionId: string,
    query: ReachabilityQuery
  ): Observable<ReachabilityResult> {
    this.globalState.setLoading(true);
    
    return this.http.post<ApiResponse<ReachabilityResult>>(
      `${this.baseUrl}/pathenum`,
      { sessionId, ...query }
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.addReachabilityResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Path enumeration failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform Monte Carlo validation analysis
   */
  performMonteCarloAnalysis(
    sessionId: string,
    config: MonteCarloConfig,
    query: ReachabilityQuery
  ): Observable<MonteCarloResult> {
    this.globalState.setLoading(true);
    
    const requestBody = {
      sessionId,
      config,
      query
    };
    
    return this.http.post<ApiResponse<MonteCarloResult>>(
      `${this.baseUrl}/montecarlo`,
      requestBody
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.addMonteCarloResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Monte Carlo analysis failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all available probability types from the server
   */
  getProbabilityTypes(): Observable<ProbabilityType[]> {
    return this.http.get<ApiResponse<ProbabilityType[]>>(`${this.baseUrl}/probability-types`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        console.warn('Failed to load probability types, using defaults:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Validate uploaded files before processing
   */
  validateFiles(files: {
    networkFile: File;
    nodePriorsFile?: File;
    linkProbabilitiesFile?: File;
  }): Observable<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const formData = new FormData();
    formData.append('network_file', files.networkFile);
    
    if (files.nodePriorsFile) {
      formData.append('node_priors_file', files.nodePriorsFile);
    }
    
    if (files.linkProbabilitiesFile) {
      formData.append('link_probabilities_file', files.linkProbabilitiesFile);
    }

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/validate`, formData).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Get session status and health check
   */
  getSessionStatus(sessionId: string): Observable<{ isActive: boolean; lastAccessed: string }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/session/${sessionId}/status`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete session and cleanup resources
   */
  deleteSession(sessionId: string): Observable<{ success: boolean }> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/session/${sessionId}`).pipe(
      map(response => this.extractData(response)),
      tap(() => {
        this.globalState.clearSession();
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Get server health and version information
   */
  getServerInfo(): Observable<{ version: string; status: string; timestamp: string }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/health`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  // Private helper methods

  private handleUploadProgress(event: HttpEvent<ApiResponse<NetworkUploadResponse>>): ApiResponse<NetworkUploadResponse> | null {
    switch (event.type) {
      case HttpEventType.UploadProgress:
        if (event.total) {
          const progress: FileUploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round(100 * event.loaded / event.total)
          };
          this.globalState.setUploadProgress(progress);
        }
        return null;

      case HttpEventType.Response:
        return event.body;

      default:
        return null;
    }
  }

  private extractData<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.error || response.message || 'API request failed');
    }
    
    if (response.data === undefined) {
      throw new Error('No data in API response');
    }
    
    return response.data;
  }

  /**
   * Create a reusable error handler for HTTP requests
   */
  private handleError(operation: string) {
    return (error: any): Observable<never> => {
      console.error(`${operation} failed:`, error);
      
      let errorMessage = `${operation} failed`;
      if (error.error?.message) {
        errorMessage += `: ${error.error.message}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      this.globalState.setError(errorMessage);
      return throwError(() => new Error(errorMessage));
    };
  }

  /**
   * Retry logic for failed requests
   */
  private retryRequest<T>(
    requestFn: () => Observable<T>,
    maxRetries = 3,
    delay = 1000
  ): Observable<T> {
    return requestFn().pipe(
      catchError((error) => {
        if (maxRetries > 0) {
          return new Observable<T>(subscriber => {
            setTimeout(() => {
              this.retryRequest(requestFn, maxRetries - 1, delay * 2)
                .subscribe(subscriber);
            }, delay);
          });
        }
        return throwError(() => error);
      })
    );
  }
}