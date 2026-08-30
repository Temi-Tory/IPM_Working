import { MetricDirection, ScenarioMetric, ScenarioRun } from './scenario-cache.service';

/**
 * Pure, toolkit-agnostic helpers over `ScenarioRun[]` for laying scenarios side
 * by side — used both by System Profile's cross-toolkit view and by each
 * toolkit's own in-page "Compare" tab (already scoped to one toolkit and to
 * whichever scenarios the user checked). Nothing here ranks or scores a run;
 * it only finds and diffs labelled real outputs the producing track wrote to
 * `ScenarioCacheService`.
 */

/** A column in a comparison table: one distinct metric label. */
export interface MetricColumn {
  label: string;
  unit: string;
  /** the metric's own semantics, straight from the producing track — a display
   *  hint for sort direction, never a verdict on any run's value. */
  direction: MetricDirection;
}

/** Distinct metric labels across the given runs, in first-seen order. */
export function metricColumns(runs: readonly ScenarioRun[]): MetricColumn[] {
  const seen = new Map<string, MetricColumn>();
  for (const run of runs) {
    for (const m of run.metrics) {
      if (!seen.has(m.label)) {
        seen.set(m.label, {
          label: m.label,
          unit: m.unit ?? '',
          direction: m.direction ?? 'neutral',
        });
      }
    }
  }
  return [...seen.values()];
}

export function findMetric(
  run: ScenarioRun,
  label: string,
): ScenarioMetric | undefined {
  return run.metrics.find((m) => m.label === label);
}

/**
 * A plain numeric difference — ONLY when both values are plain numbers. An
 * interval is never flattened to a midpoint to produce a delta; callers show
 * the raw value in that case.
 */
export function numericDelta(
  value: ScenarioMetric['value'],
  baseline: ScenarioMetric['value'],
): number | null {
  if (typeof value === 'number' && typeof baseline === 'number') {
    return value - baseline;
  }
  return null;
}
