import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiClient,
  CriticalPathRequest,
  CriticalPathResponse,
} from '@inf-prop/shared/api-client';

/**
 * Thin client for `POST /critical-path-analysis` (canonical; `/cpm-analysis` is
 * an alias). Backed by `CriticalPathV2Module` — V1's interval and sum-slack
 * outputs are not exposed by this path.
 *
 * The endpoint takes no value-type field: Float64 vs Interval is read from the
 * CPM file's own `data_type`. The response's `value_type` is authoritative.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleAnalysisService {
  private readonly api = inject(ApiClient);

  analyse(request: CriticalPathRequest): Observable<CriticalPathResponse> {
    return this.api.post<CriticalPathResponse>(
      '/critical-path-analysis',
      request,
    );
  }
}
