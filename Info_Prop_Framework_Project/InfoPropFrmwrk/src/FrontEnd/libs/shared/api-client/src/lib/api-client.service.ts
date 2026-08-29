import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';
import { API_CONFIG } from './api-config';
import { ApiError, isApiError } from './models/envelope';

/** Normalised error every caller in the app can rely on. */
export class ApiRequestError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly path: string,
    readonly body?: ApiError | unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * The one HTTP surface for the InfoProp server. Every feature lib calls the
 * server through this (or through a `shared/data-access` service that uses it) —
 * no feature lib constructs its own base URL or its own `HttpClient` wrapper.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.baseUrl}${p}`;
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(this.url(path)).pipe(this.guard(path));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body).pipe(this.guard(path));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body).pipe(this.guard(path));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path)).pipe(this.guard(path));
  }

  /** multipart/form-data — used by the upload flow only. */
  postForm<T>(path: string, form: FormData): Observable<T> {
    return this.http.post<T>(this.url(path), form).pipe(this.guard(path));
  }

  health(): Observable<{ status: string; server: string }> {
    return this.get('/health');
  }

  private guard<T>(path: string) {
    return (source: Observable<T>): Observable<T> => {
      const withTimeout =
        this.config.timeoutMs > 0
          ? source.pipe(timeout(this.config.timeoutMs))
          : source;
      return withTimeout.pipe(
        catchError((err: unknown) => throwError(() => this.normalise(err, path))),
      );
    };
  }

  private normalise(err: unknown, path: string): ApiRequestError {
    if (err instanceof TimeoutError) {
      return new ApiRequestError(
        `Request to ${path} timed out after ${this.config.timeoutMs}ms`,
        0,
        path,
      );
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      const message = isApiError(body)
        ? body.message
        : err.status === 0
          ? `Cannot reach the analysis server at ${this.config.baseUrl}. Is it running?`
          : `Request to ${path} failed (${err.status})`;
      return new ApiRequestError(message, err.status, path, body);
    }
    return new ApiRequestError(String(err), -1, path);
  }
}
