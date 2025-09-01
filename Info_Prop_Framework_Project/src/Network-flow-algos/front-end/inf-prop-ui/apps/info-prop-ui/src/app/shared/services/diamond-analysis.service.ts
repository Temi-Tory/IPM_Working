import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  DiamondAnalysisRequest,
  DiamondAnalysisResponse
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class DiamondAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  analyzeDiamonds(request: DiamondAnalysisRequest): Observable<DiamondAnalysisResponse> {
    return this.http.post<DiamondAnalysisResponse>(
      `${this.API_BASE}/diamond-analysis`,
      request
    ).pipe(
      tap(response => {
        console.log('💎 DIAMOND ANALYSIS RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('💎 DIAMOND ANALYSIS KEYS:', Object.keys(response));
        if (response.diamond_analysis) {
          console.log('💎 DIAMOND ANALYSIS DATA KEYS:', Object.keys(response.diamond_analysis));
          if (response.diamond_analysis.raw_unique_diamonds) {
            console.log('💎 RAW UNIQUE DIAMONDS KEYS:', Object.keys(response.diamond_analysis.raw_unique_diamonds));
          }
        }
      })
    );
  }
}