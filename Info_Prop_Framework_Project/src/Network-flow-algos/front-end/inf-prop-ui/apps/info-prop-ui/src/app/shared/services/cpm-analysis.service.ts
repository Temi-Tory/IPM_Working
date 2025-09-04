import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CpmAnalysisRequest,
  CpmAnalysisResponse
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class CpmAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  analyzeCpm(request: CpmAnalysisRequest): Observable<CpmAnalysisResponse> {
    console.log('📊 Sending CPM analysis request:', request);
    
    return this.http.post<CpmAnalysisResponse>(
      `${this.API_BASE}/cpm-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('📊 CPM analysis response:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success && response.cmp_result) {
          console.log('⏱️ CPM stats:', {
            timeCriticalValue: response.cmp_result.time_result.critical_value,
            costCriticalValue: response.cmp_result.cost_result.critical_value,
            timeCriticalNodes: response.cmp_result.time_result.critical_nodes.length,
            costCriticalNodes: response.cmp_result.cost_result.critical_nodes.length
          });
        }
      })
    );
  }
}