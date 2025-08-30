import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  AnalysisRequest, 
  AnalysisResponse, 
  HealthResponse, 
  UploadResponse,
  NetworkStructure 
} from '../models/network-analysis.models';

@Injectable({ providedIn: 'root' })
export class NetworkBackendService {
  private readonly apiUrl = 'http://localhost:8080';
  private http = inject(HttpClient);

  checkHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.apiUrl}/health`)
      .pipe(
        catchError(error => {
          console.error('Health check failed:', error);
          return throwError(() => new Error('Backend server is not responding'));
        })
      );
  }

  analyzeNetwork(request: AnalysisRequest): Observable<AnalysisResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    
    return this.http.post<AnalysisResponse>(`${this.apiUrl}/analyze`, request, { headers })
      .pipe(
        catchError(error => {
          console.error('Network analysis failed:', error);
          return throwError(() => new Error(`Analysis failed: ${error.error?.message || error.message}`));
        })
      );
  }

  uploadNetworkFiles(files: FileList): Observable<UploadResponse> {
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData)
      .pipe(
        catchError(error => {
          console.error('File upload failed:', error);
          return throwError(() => new Error(`Upload failed: ${error.error?.message || error.message}`));
        })
      );
  }

  validateNetworkStructure(networkPath: string): Observable<any> {
    const request = {
      networkPath: networkPath,
      reachabilityScenarios: [],
      capacityScenarios: [],
      cpmScenarios: [],
      analysisConfig: {
        exactInference: false,
        diamondAnalysis: false,
        flowAnalysis: false,
        criticalPath: false
      }
    };

    return this.analyzeNetwork(request).pipe(
      map(response => response.results.network_structure),
      catchError(error => {
        console.error('Network validation failed:', error);
        return throwError(() => new Error(`Validation failed: ${error.message}`));
      })
    );
  }

  quickStructureAnalysis(networkPath: string): Observable<NetworkStructure> {
    const request: AnalysisRequest = {
      networkPath: networkPath,
      reachabilityScenarios: [],
      capacityScenarios: [],
      cpmScenarios: [],
      analysisConfig: {
        exactInference: false,
        diamondAnalysis: false,
        flowAnalysis: false,
        criticalPath: false
      }
    };

    return this.analyzeNetwork(request).pipe(
      map(response => response.results.network_structure)
    );
  }
}