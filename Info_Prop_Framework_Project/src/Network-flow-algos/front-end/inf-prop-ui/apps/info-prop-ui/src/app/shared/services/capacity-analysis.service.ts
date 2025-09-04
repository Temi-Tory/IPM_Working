import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CapacityAnalysisRequest,
  CapacityAnalysisResponse
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class CapacityAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  analyzeCapacity(request: CapacityAnalysisRequest): Observable<CapacityAnalysisResponse> {
    console.log('⚡ Sending capacity analysis request:', request);
    
    return this.http.post<CapacityAnalysisResponse>(
      `${this.API_BASE}/capacity-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('⚡ Capacity analysis response:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success && response.capacity_result) {
          console.log('📊 Capacity stats:', {
            utilization: response.capacity_result.network_utilization,
            totalInput: response.capacity_result.total_source_input,
            totalOutput: response.capacity_result.total_target_output,
            activeSources: response.capacity_result.active_sources.length
          });
        }
      })
    );
  }
}