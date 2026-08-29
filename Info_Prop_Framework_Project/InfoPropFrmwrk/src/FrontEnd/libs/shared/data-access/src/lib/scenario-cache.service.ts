import { Injectable, computed, signal } from '@angular/core';
import { IntervalData, ToolkitKind, ValueType } from '@inf-prop/shared/api-client';

/**
 * ======================================================================
 *  FROZEN CONTRACT — the cross-scenario cache.
 * ----------------------------------------------------------------------
 *  Tracks 1 (reliability), 2 (flow), 3 (schedule) WRITE a `ScenarioRun`
 *  here after every successful analysis, via `record()`.
 *
 *  Track 4 (system-profile) READS `runs()` and juxtaposes them. It runs
 *  no analysis of its own — it only compares what the other tracks
 *  produced. Its empty-state is "no runs yet, go to Reliability / Flow /
 *  Schedule".
 *
 *  Design rules this contract enforces:
 *   - `metrics` are LABELLED REAL OUTPUTS the producing track read
 *     straight from the analysis response (e.g. "Max flow" = 42). They
 *     are never client-invented scores, weighted indices, or
 *     recommendations. `direction` is a fact about the metric's
 *     semantics (more flow is better; a longer critical path is worse) —
 *     a hint for arrow/sort direction, NOT a verdict on the value.
 *   - `raw` is the untouched analysis response envelope. Track 4 may
 *     interpret it per-toolkit for the Network Lens, but any derived
 *     number it shows must be traceable to a field in `raw`, not
 *     computed with invented weights.
 *   - No ranking / scoring / recommendation logic belongs in this
 *     service or in Track 4. If cross-scenario ranking is genuinely
 *     needed it must come from a real Julia endpoint.
 *
 *  Changing this contract is a shared/* change: flag it to every track.
 * ======================================================================
 */

export type MetricDirection = 'higher-better' | 'lower-better' | 'neutral';

export interface ScenarioMetric {
  /** e.g. "Max flow", "Mean belief", "Critical path length" */
  label: string;
  /** a real output value, kept in its form (never midpointed) */
  value: number | IntervalData;
  /** e.g. "units", "" — free text, optional */
  unit?: string;
  /** semantic direction of the metric itself; display hint only */
  direction?: MetricDirection;
}

/** Optional per-node / per-edge flags the producing track already computed,
 *  for the Network Lens to highlight. Always traceable to a real output. */
export interface ScenarioOverlay {
  /** short id, e.g. "bottlenecks", "critical-nodes", "low-belief" */
  focus: string;
  label: string;
  nodeIds?: number[];
  edges?: [number, number][];
  /** optional per-node value to colour by (kept in form) */
  nodeValues?: Record<string, number | IntervalData>;
}

export interface ScenarioRun {
  /** stable id: `${toolkit}:${networkPath}:${scenarioName}:${valueType}` */
  id: string;
  networkPath: string;
  networkName: string;
  toolkit: ToolkitKind;
  /** scenario folder name, or 'default' */
  scenarioName: string;
  valueType: ValueType;
  ranAt: number;
  computationTimeMs: number;
  inputFiles: Record<string, string>;
  /** labelled real outputs for the comparison heatmap */
  metrics: ScenarioMetric[];
  /** optional highlight sets for the Network Lens */
  overlays?: ScenarioOverlay[];
  /** untouched analysis response envelope */
  raw: unknown;
}

export function scenarioRunId(
  toolkit: ToolkitKind,
  networkPath: string,
  scenarioName: string,
  valueType: ValueType,
): string {
  return `${toolkit}:${networkPath}:${scenarioName}:${valueType}`;
}

@Injectable({ providedIn: 'root' })
export class ScenarioCacheService {
  private readonly _runs = signal<ScenarioRun[]>([]);

  readonly runs = this._runs.asReadonly();
  readonly count = computed(() => this._runs().length);
  readonly hasRuns = computed(() => this._runs().length > 0);

  /** Distinct networks that have at least one run. */
  readonly networks = computed(() => {
    const seen = new Map<string, string>();
    for (const r of this._runs()) seen.set(r.networkPath, r.networkName);
    return [...seen].map(([networkPath, networkName]) => ({
      networkPath,
      networkName,
    }));
  });

  /** Insert or replace a run (same id replaces). */
  record(run: ScenarioRun): void {
    this._runs.update((list) => {
      const next = list.filter((r) => r.id !== run.id);
      next.push(run);
      return next;
    });
  }

  runsForNetwork(networkPath: string): ScenarioRun[] {
    return this._runs().filter((r) => r.networkPath === networkPath);
  }

  runsForToolkit(toolkit: ToolkitKind): ScenarioRun[] {
    return this._runs().filter((r) => r.toolkit === toolkit);
  }

  remove(id: string): void {
    this._runs.update((list) => list.filter((r) => r.id !== id));
  }

  clear(): void {
    this._runs.set([]);
  }

  clearNetwork(networkPath: string): void {
    this._runs.update((list) =>
      list.filter((r) => r.networkPath !== networkPath),
    );
  }
}
