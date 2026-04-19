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
    console.log('🏗️ Sending network structure request:', request);
    
    return this.http.post<NetworkStructureResponse>(
      `${this.API_BASE}/network-structure`,
      request
    ).pipe(
      tap(response => {
        console.log('🏗️ Network structure response:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success && response.network_structure) {
          console.log('📊 Network stats:', {
            nodes: response.network_structure.total_nodes,
            edges: response.network_structure.total_edges,
            sources: response.network_structure.source_nodes.length,
            sinks: response.network_structure.sink_nodes.length
          });
        }
      })
    );
  }
}