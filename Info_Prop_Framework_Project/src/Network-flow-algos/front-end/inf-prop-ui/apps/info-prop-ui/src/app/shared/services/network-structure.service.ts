import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  NetworkStructureRequest, 
  NetworkStructureResponse 
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class NetworkStructureService {
  private readonly API_BASE = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  analyzeNetworkStructure(request: NetworkStructureRequest): Observable<NetworkStructureResponse> {
    return this.http.post<NetworkStructureResponse>(
      `${this.API_BASE}/network-structure`,
      request
    );
  }
}