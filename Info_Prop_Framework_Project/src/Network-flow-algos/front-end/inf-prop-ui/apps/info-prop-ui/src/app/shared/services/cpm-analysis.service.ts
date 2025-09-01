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
    return this.http.post<CpmAnalysisResponse>(
      `${this.API_BASE}/cpm-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('📊 CPM ANALYSIS RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('📊 CPM ANALYSIS KEYS:', Object.keys(response));
        if ((response as any).cpm_analysis) {
          console.log('📊 CPM ANALYSIS DATA KEYS:', Object.keys((response as any).cpm_analysis));
        }
      })
    );
  }
}