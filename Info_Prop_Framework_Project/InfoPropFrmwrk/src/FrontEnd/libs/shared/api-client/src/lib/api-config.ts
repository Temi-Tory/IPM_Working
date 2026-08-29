import { InjectionToken, Provider } from '@angular/core';

/**
 * The single point of configuration for where the local analysis service lives.
 * Replaces the eight hardcoded `http://localhost:8080` strings the audit found
 * scattered across the old app's services. No feature lib may declare its own
 * base-URL constant — inject `API_CONFIG` (or use `ApiClient`) instead.
 */
export interface ApiConfig {
  /** Base URL of the InfoProp server, no trailing slash. */
  readonly baseUrl: string;
  /** Per-request timeout in ms (0 = no client-side timeout). */
  readonly timeoutMs: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  // Local-only by design: client and server share a machine, no traffic leaves it.
  baseUrl: 'http://localhost:8080',
  timeoutMs: 0,
};

export const API_CONFIG = new InjectionToken<ApiConfig>('INF_PROP_API_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_API_CONFIG,
});

/** Register a custom API config (e.g. a different port) in `app.config.ts`. */
export function provideApiConfig(config: Partial<ApiConfig>): Provider {
  return {
    provide: API_CONFIG,
    useValue: { ...DEFAULT_API_CONFIG, ...config },
  };
}
