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
   * @deprecated Use uploadAndAnalyze instead for better validation and error handling
   */
  uploadAndAnalyzeNetwork(request: NetworkAnalysisRequest): Observable<NetworkAnalysisResponse> {
    return this.uploadAndAnalyze(request);
  }

  /**
   * Upload files with progress tracking
   */
  uploadWithProgress(request: NetworkAnalysisRequest): Observable<any> {
    // Validate request first
    const validation = this.validateRequest(request);
    if (!validation.isValid) {
      return throwError(() => new Error(`Validation failed: ${validation.errors.join(', ')}`));
    }

    // Build form data using the same method as uploadAndAnalyze
    const formData = this.buildFormData(request);

    // Return observable with progress tracking
    return this.http.post(`${this.baseUrl}${this.endpoints.upload}`, formData, {
      observe: 'events',
      reportProgress: true
    });
  }

  /**
   * Validate request configuration before sending
   */
  private validateRequest(request: NetworkAnalysisRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!request.networkName || request.networkName.trim().length === 0) {
      errors.push('Network name is required');
    }

    if (!request.files.edges) {
      errors.push('Edges file is required');
    }

    // Check analysis-specific requirements
    if (request.analysesToRun.exactInference && !request.files.inference) {
      errors.push('Exact inference requires nodepriors and linkprobabilities files');
    }

    if (request.analysesToRun.flowAnalysis && !request.files.capacity) {
      errors.push('Flow analysis requires capacity file');
    }

    if (request.analysesToRun.criticalPathAnalysis && !request.files.criticalPath) {
      errors.push('Critical path analysis requires CPM inputs file');
    }

    // Validate inference data type
    if (request.files.inference || request.analysesToRun.exactInference) {
      const dataType = request.files.inference?.dataType || request.analysesToRun.inferenceDataType;
      if (!dataType || !['float', 'interval', 'pbox'].includes(dataType)) {
        errors.push('Valid inference data type is required for inference analysis');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Build FormData object with proper field validation
   */
  private buildFormData(request: NetworkAnalysisRequest): FormData {
    const formData = new FormData();
    
    // Add network name
    formData.append('networkName', request.networkName.trim());
    
    // Add required edges file
    formData.append('edges', request.files.edges);
    
    // Determine and add inference data type
    const inferenceDataType = request.files.inference?.dataType || 
                             request.analysesToRun.inferenceDataType || 
                             'float';
    formData.append('inference_data_type', inferenceDataType);
    
    // Add optional files - always include if available
    if (request.files.inference) {
      formData.append('nodepriors', request.files.inference.nodepriors);
      formData.append('linkprobabilities', request.files.inference.linkprobabilities);
    }
    
    if (request.files.capacity) {
      formData.append('capacities', request.files.capacity.capacities);
    }
    
    if (request.files.criticalPath) {
      formData.append('cpmInputs', request.files.criticalPath.cpmInputs);
    }
    
    // Add analysis configuration as individual boolean form fields
    formData.append('basicStructure', request.analysesToRun.basicStructure.toString());
    formData.append('diamondAnalysis', request.analysesToRun.diamondAnalysis.toString());
    formData.append('exactInference', request.analysesToRun.exactInference.toString());
    formData.append('flowAnalysis', request.analysesToRun.flowAnalysis.toString());
    formData.append('criticalPathAnalysis', request.analysesToRun.criticalPathAnalysis.toString());

    return formData;
  }

  /**
   * Enhanced upload method with validation
   */
  uploadAndAnalyze(request: NetworkAnalysisRequest): Observable<NetworkAnalysisResponse> {
    // Validate request first
    const validation = this.validateRequest(request);
    if (!validation.isValid) {
      return throwError(() => ({
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        network_name: request.networkName || 'Unknown',
        timestamp: new Date().toISOString(),
        analysis_config: {
          exactInference: request.analysesToRun.exactInference,
          flowAnalysis: request.analysesToRun.flowAnalysis,
          diamondAnalysis: request.analysesToRun.diamondAnalysis,
          inference_data_type: 'float' as 'float' | 'interval' | 'pbox',
          inferenceDataType: 'float' as 'float' | 'interval' | 'pbox',
          networkName: request.networkName || 'Unknown',
          criticalPathAnalysis: request.analysesToRun.criticalPathAnalysis,
          basicStructure: request.analysesToRun.basicStructure
        },
        results: {
          network_structure: {
            source_nodes: [],
            total_nodes: 0,
            total_edges: 0,
            fork_nodes: [],
            sink_nodes: [],
            join_nodes: [],
            iteration_sets_count: 0
          }
        }
      } as NetworkAnalysisResponse));
    }

    // Build form data
    const formData = this.buildFormData(request);

    // Send request
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
          const inferenceDataType = request.files.inference?.dataType || 
                                   request.analysesToRun.inferenceDataType || 
                                   'float';
          return throwError(() => ({
            success: false,
            error: error.message || 'Network analysis failed',
            network_name: request.networkName,
            timestamp: new Date().toISOString(),
            analysis_config: {
              exactInference: request.analysesToRun.exactInference,
              flowAnalysis: request.analysesToRun.flowAnalysis,
              diamondAnalysis: request.analysesToRun.diamondAnalysis,
              inference_data_type: inferenceDataType as 'float' | 'interval' | 'pbox',
              inferenceDataType: inferenceDataType as 'float' | 'interval' | 'pbox',
              networkName: request.networkName,
              criticalPathAnalysis: request.analysesToRun.criticalPathAnalysis,
              basicStructure: request.analysesToRun.basicStructure
            },
            results: {
              network_structure: {
                source_nodes: [],
                total_nodes: 0,
                total_edges: 0,
                fork_nodes: [],
                sink_nodes: [],
                join_nodes: [],
                iteration_sets_count: 0
              }
            }
          } as NetworkAnalysisResponse));
        })
      );
  }
}