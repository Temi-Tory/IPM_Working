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
    return this.http.post<ReachabilityAnalysisResponse>(
      `${this.API_BASE}/reachability-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('🔗 REACHABILITY ANALYSIS RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('🔗 REACHABILITY ANALYSIS KEYS:', Object.keys(response));
        if ((response as any).reachability_analysis) {
          console.log('🔗 REACHABILITY ANALYSIS DATA KEYS:', Object.keys((response as any).reachability_analysis));
        }
      })
    );
  }
}