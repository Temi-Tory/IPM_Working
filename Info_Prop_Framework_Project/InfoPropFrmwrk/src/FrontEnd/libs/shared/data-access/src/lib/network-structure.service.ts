import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApiClient,
  NetworkStructure,
  NetworkStructureRequest,
  NetworkStructureResponse,
} from '@inf-prop/shared/api-client';

/**
 * `POST /network-structure` — live and current, matches the framework's model
 * (one upload becomes the one network every view reads). Omit `edgesFilePath`
 * to let the server reconstruct edges from the session's analysis-input files.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStructureService {
  private readonly api = inject(ApiClient);

  analyze(request: NetworkStructureRequest): Observable<NetworkStructureResponse> {
    return this.api.post<NetworkStructureResponse>(
      '/network-structure',
      request,
    );
  }

  structure(request: NetworkStructureRequest): Observable<NetworkStructure> {
    return this.analyze(request).pipe(map((r) => r.network_structure));
  }
}
