import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiClient,
  FlowAnalysisRequest,
  FlowAnalysisResponse,
} from '@inf-prop/shared/api-client';

/**
 * The one call this track makes: `POST /flow-analysis`. Live and current — no
 * server-fixes-track dependency. Float64 only; there is no interval/p-box
 * variant of this request or response.
 */
@Injectable({ providedIn: 'root' })
export class FlowAnalysisClient {
  private readonly api = inject(ApiClient);

  analyze(request: FlowAnalysisRequest): Observable<FlowAnalysisResponse> {
    return this.api.post<FlowAnalysisResponse>('/flow-analysis', request);
  }
}
