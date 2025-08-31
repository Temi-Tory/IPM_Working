import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    );
  }
}