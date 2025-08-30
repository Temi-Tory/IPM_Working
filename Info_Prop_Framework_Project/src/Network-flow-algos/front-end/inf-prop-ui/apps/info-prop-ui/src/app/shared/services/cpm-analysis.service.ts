import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  CpmAnalysisRequest, 
  CpmAnalysisResponse 
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class CpmAnalysisService {
  private readonly API_BASE = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  analyzeCpm(request: CpmAnalysisRequest): Observable<CpmAnalysisResponse> {
    return this.http.post<CpmAnalysisResponse>(
      `${this.API_BASE}/cpm-analysis`,
      request
    );
  }
}