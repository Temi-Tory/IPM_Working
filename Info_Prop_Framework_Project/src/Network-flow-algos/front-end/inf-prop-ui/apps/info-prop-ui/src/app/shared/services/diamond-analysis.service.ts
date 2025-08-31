import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    );
  }
}