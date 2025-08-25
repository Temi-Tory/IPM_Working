import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { 
  NetworkAnalysisRequest, 
  NetworkAnalysisResponse, 
  BackendHealthResponse 
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class NetworkBackendService {
  private readonly http = inject(HttpClient);
  
  // Backend server configuration
  private readonly baseUrl = 'http://localhost:8080';
  private readonly endpoints = {
    upload: '/upload',
    health: '/health'
  };

  /**
   * Check if the backend server is running and healthy
   */
  checkHealth(): Observable<BackendHealthResponse> {
    return this.http.get<BackendHealthResponse>(`${this.baseUrl}${this.endpoints.health}`)
      .pipe(
        catchError(error => throwError(() => ({
          status: 'error',
          error: 'Backend server unreachable',
          details: error
        })))
      );
  }

  /**
   * Upload network files and run analysis based on configuration
   */
  uploadAndAnalyzeNetwork(request: NetworkAnalysisRequest): Observable<NetworkAnalysisResponse> {
    const formData = new FormData();
    
    // Add files to form data
    formData.append('edges', request.files.edges, request.files.edges.name);
    
    if (request.files.nodeMapping) {
      formData.append('nodeMapping', request.files.nodeMapping, request.files.nodeMapping.name);
    }
    
    if (request.files.inference) {
      formData.append('nodepriors', request.files.inference.nodepriors, request.files.inference.nodepriors.name);
      formData.append('linkprobabilities', request.files.inference.linkprobabilities, request.files.inference.linkprobabilities.name);
    }
    
    if (request.files.capacity) {
      formData.append('capacities', request.files.capacity.capacities, request.files.capacity.capacities.name);
    }
    
    if (request.files.criticalPath) {
      formData.append('cpmInputs', request.files.criticalPath.cpmInputs, request.files.criticalPath.cpmInputs.name);
    }
    
    // Add analysis configuration as JSON
    const analysisConfig = {
      networkName: request.networkName,
      ...request.analysesToRun
    };
    
    formData.append('analysisConfig', new Blob([JSON.stringify(analysisConfig)], {
      type: 'application/json'
    }), 'config.json');

    // Note: Don't set Content-Type header manually for FormData - let browser handle it
    return this.http.post<NetworkAnalysisResponse>(`${this.baseUrl}${this.endpoints.upload}`, formData)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.error || 'Analysis failed');
          }
          return response;
        }),
        catchError(error => {
          console.error('Network analysis error:', error);
          return throwError(() => ({
            success: false,
            error: error.message || 'Network analysis failed',
            network_name: request.networkName,
            timestamp: new Date().toISOString()
          }));
        })
      );
  }

  /**
   * Upload files with progress tracking
   */
  uploadWithProgress(request: NetworkAnalysisRequest): Observable<any> {
    const formData = new FormData();
    
    // Add files to form data (same as above)
    formData.append('edges', request.files.edges, request.files.edges.name);
    
    if (request.files.nodeMapping) {
      formData.append('nodeMapping', request.files.nodeMapping, request.files.nodeMapping.name);
    }
    
    if (request.files.inference) {
      formData.append('nodepriors', request.files.inference.nodepriors, request.files.inference.nodepriors.name);
      formData.append('linkprobabilities', request.files.inference.linkprobabilities, request.files.inference.linkprobabilities.name);
    }
    
    if (request.files.capacity) {
      formData.append('capacities', request.files.capacity.capacities, request.files.capacity.capacities.name);
    }
    
    if (request.files.criticalPath) {
      formData.append('cpmInputs', request.files.criticalPath.cpmInputs, request.files.criticalPath.cpmInputs.name);
    }
    
    // Add analysis configuration
    const analysisConfig = {
      networkName: request.networkName,
      ...request.analysesToRun
    };
    
    formData.append('analysisConfig', new Blob([JSON.stringify(analysisConfig)], {
      type: 'application/json'
    }), 'config.json');

    // Return observable with progress tracking
    return this.http.post(`${this.baseUrl}${this.endpoints.upload}`, formData, {
      observe: 'events',
      reportProgress: true
    });
  }
}