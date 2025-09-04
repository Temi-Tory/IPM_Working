import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ReachabilityAnalysisRequest,
  ReachabilityAnalysisResponse
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class ReachabilityAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  analyzeReachability(request: ReachabilityAnalysisRequest): Observable<ReachabilityAnalysisResponse> {
    console.log('🔗 Sending reachability analysis request:', request);
    
    return this.http.post<ReachabilityAnalysisResponse>(
      `${this.API_BASE}/reachability-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('🔗 Reachability analysis response:', response.success ? 'SUCCESS' : 'FAILED');
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
}