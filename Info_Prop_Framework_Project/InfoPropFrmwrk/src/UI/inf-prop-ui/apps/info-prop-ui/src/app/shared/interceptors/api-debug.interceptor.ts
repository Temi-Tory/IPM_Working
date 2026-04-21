import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

function newRequestId(): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `ui-${randomId}`;
}

function summarizeBody(body: unknown): unknown {
  if (body === null || body === undefined) {
    return body;
  }

  if (typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean') {
    return body;
  }

  if (body instanceof FormData) {
    const entries: string[] = [];
    body.forEach((value, key) => {
      entries.push(`${key}=${typeof value === 'string' ? value : value.name}`);
    });
    return { formData: entries };
  }

  return body;
}

function buildFrontendStack(): string {
  return new Error('Frontend HTTP diagnostic stack').stack ?? 'No frontend stack available';
}

export const apiDebugInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const requestId = req.headers.get('X-Client-Request-ID') ?? newRequestId();
  const startedAt = performance.now();
  const taggedRequest = req.clone({
    setHeaders: {
      'X-Client-Request-ID': requestId
    }
  });

  console.info('[API][REQUEST]', {
    requestId,
    method: taggedRequest.method,
    url: taggedRequest.urlWithParams,
    body: summarizeBody(taggedRequest.body)
  });

  return next(taggedRequest).pipe(
    tap((event) => {
      if ('status' in event) {
        console.info('[API][RESPONSE]', {
          requestId,
          method: taggedRequest.method,
          url: taggedRequest.urlWithParams,
          status: event.status,
          durationMs: Math.round(performance.now() - startedAt),
          responseRequestId: event.headers?.get('X-Request-ID') ?? null
        });
      }
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const payload = error.error as Record<string, unknown> | null;
        const debug = payload && typeof payload === 'object' && 'debug' in payload
          ? (payload['debug'] as Record<string, unknown>)
          : null;

        console.groupCollapsed(`[API][ERROR] ${taggedRequest.method} ${taggedRequest.urlWithParams}`);
        console.error('Request diagnostics', {
          requestId,
          method: taggedRequest.method,
          url: taggedRequest.urlWithParams,
          status: error.status,
          statusText: error.statusText,
          durationMs: Math.round(performance.now() - startedAt),
          clientStack: buildFrontendStack()
        });
        console.error('Server diagnostics', {
          serverRequestId: error.headers?.get('X-Request-ID') ?? payload?.['request_id'] ?? null,
          message: payload?.['message'] ?? error.message,
          error: payload?.['error'] ?? null,
          exceptionType: debug?.['exception_type'] ?? null,
          exceptionMessage: debug?.['exception_message'] ?? null,
          target: debug?.['target'] ?? null,
          stacktrace: debug?.['stacktrace'] ?? null
        });
        console.error('Raw error payload', payload ?? error.error);
        console.groupEnd();
      } else {
        console.error('[API][ERROR] Non-HTTP error from interceptor', {
          requestId,
          method: taggedRequest.method,
          url: taggedRequest.urlWithParams,
          error,
          clientStack: buildFrontendStack()
        });
      }

      return throwError(() => error);
    })
  );
};
