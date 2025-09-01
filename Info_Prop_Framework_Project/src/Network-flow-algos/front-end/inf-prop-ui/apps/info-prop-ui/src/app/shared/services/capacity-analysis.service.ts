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
    return this.http.post<CapacityAnalysisResponse>(
      `${this.API_BASE}/capacity-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('⚡ CAPACITY ANALYSIS RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('⚡ CAPACITY ANALYSIS KEYS:', Object.keys(response));
        if ((response as any).capacity_analysis) {
          console.log('⚡ CAPACITY ANALYSIS DATA KEYS:', Object.keys((response as any).capacity_analysis));
        }
      })
    );
  }
}