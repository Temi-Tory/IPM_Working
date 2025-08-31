import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    );
  }
}