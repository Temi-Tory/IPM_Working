import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  NetworkStructureRequest,
  NetworkStructureResponse
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class NetworkStructureService {
  private readonly API_BASE = 'http://localhost:8080';

  private http: HttpClient = inject(HttpClient);

  analyzeNetworkStructure(request: NetworkStructureRequest): Observable<NetworkStructureResponse> {
    return this.http.post<NetworkStructureResponse>(
      `${this.API_BASE}/network-structure`,
      request
    ).pipe(
      tap(response => {
        console.log('🏗️ NETWORK STRUCTURE RAW RESPONSE:', JSON.stringify(response, null, 2));
        console.log('🏗️ NETWORK STRUCTURE KEYS:', Object.keys(response));
        if (response.network_structure) {
          console.log('🏗️ NETWORK STRUCTURE DATA KEYS:', Object.keys(response.network_structure));
        }
      })
    );
  }
}