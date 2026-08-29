import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import {
  ApiClient,
  SessionItemResponse,
  SessionListResponse,
  SessionMetadata,
  SessionSummary,
  SessionUpdateRequest,
} from '@inf-prop/shared/api-client';

/**
 * Sessions are the server's file-based record: one folder per upload holding the
 * files plus a `session.json` of what has been computed. This service is the
 * thin client for `/sessions*` — list, open, update, delete. It holds no
 * derived analysis state; that lives in `NetworkContextService` and
 * `ScenarioCacheService`.
 */
@Injectable({ providedIn: 'root' })
export class NetworkSessionService {
  private readonly api = inject(ApiClient);

  private readonly _sessions = signal<SessionSummary[]>([]);
  private readonly _current = signal<SessionMetadata | null>(null);
  private readonly _loading = signal(false);

  readonly sessions = this._sessions.asReadonly();
  readonly current = this._current.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasCurrent = computed(() => this._current() !== null);

  list(): Observable<SessionSummary[]> {
    this._loading.set(true);
    return this.api.get<SessionListResponse>('/sessions').pipe(
      map((r) => r.sessions ?? []),
      tap({
        next: (s) => {
          this._sessions.set(s);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      }),
    );
  }

  open(sessionId: string): Observable<SessionMetadata> {
    this._loading.set(true);
    return this.api
      .get<SessionItemResponse>(`/sessions/${encodeURIComponent(sessionId)}`)
      .pipe(
        map((r) => r.session),
        tap({
          next: (s) => {
            this._current.set(s);
            this._loading.set(false);
          },
          error: () => this._loading.set(false),
        }),
      );
  }

  update(
    sessionId: string,
    patch: SessionUpdateRequest,
  ): Observable<SessionMetadata> {
    return this.api
      .put<SessionItemResponse>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        patch,
      )
      .pipe(
        map((r) => r.session),
        tap((s) => {
          if (this._current()?.session_id === sessionId) this._current.set(s);
        }),
      );
  }

  delete(sessionId: string): Observable<void> {
    return this.api
      .delete<{ success: boolean }>(
        `/sessions/${encodeURIComponent(sessionId)}`,
      )
      .pipe(
        map(() => void 0),
        tap(() => {
          this._sessions.update((list) =>
            list.filter((s) => s.session_id !== sessionId),
          );
          if (this._current()?.session_id === sessionId) this._current.set(null);
        }),
      );
  }

  setCurrent(session: SessionMetadata | null): void {
    this._current.set(session);
  }

  clearCurrent(): void {
    this._current.set(null);
  }
}
