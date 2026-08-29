import { ToolkitKind } from '@inf-prop/shared/api-client';
import {
  MetricDirection,
  ScenarioMetric,
  ScenarioOverlay,
  ScenarioRun,
} from '@inf-prop/shared/data-access';

/**
 * Pure, mechanical view helpers for the cross-scenario profile view.
 *
 * NOTHING in this file ranks, scores, flags, or judges a scenario. It groups,
 * de-duplicates, and reshapes values that the Reliability / Flow / Schedule
 * views already computed and wrote to `ScenarioCacheService`. Every number a
 * caller renders came straight from a `ScenarioRun` — this module only decides
 * where on the page it goes.
 */

export const TOOLKIT_LABEL: Record<ToolkitKind, string> = {
  reliability: 'Reliability',
  flow: 'Flow',
  schedule: 'Schedule',
};

export const TOOLKIT_ROUTE: Record<ToolkitKind, string> = {
  reliability: '/reliability',
  flow: '/flow',
  schedule: '/schedule',
};

const TOOLKIT_ORDER: readonly ToolkitKind[] = ['reliability', 'flow', 'schedule'];

/** A column in a per-toolkit comparison table: one distinct metric label. */
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

/** One toolkit's runs plus the columns needed to lay them side by side. */
export interface ToolkitGroup {
  toolkit: ToolkitKind;
  label: string;
  route: string;
  runs: ScenarioRun[];
  columns: MetricColumn[];
}

/** Scenario name, then value type, then run time — keeps the same scenario's
 *  value-type variants adjacent when a network carries many named scenarios. */
function compareRuns(a: ScenarioRun, b: ScenarioRun): number {
  return (
    a.scenarioName.localeCompare(b.scenarioName) ||
    a.valueType.localeCompare(b.valueType) ||
    a.ranAt - b.ranAt
  );
}

export function groupByToolkit(runs: readonly ScenarioRun[]): ToolkitGroup[] {
  const groups: ToolkitGroup[] = [];
  for (const toolkit of TOOLKIT_ORDER) {
    const tkRuns = runs
      .filter((r) => r.toolkit === toolkit)
      .sort(compareRuns);
    if (tkRuns.length === 0) continue;
    groups.push({
      toolkit,
      label: TOOLKIT_LABEL[toolkit],
      route: TOOLKIT_ROUTE[toolkit],
      runs: tkRuns,
      columns: metricColumns(tkRuns),
    });
  }
  return groups;
}

export function distinctToolkits(runs: readonly ScenarioRun[]): ToolkitKind[] {
  return TOOLKIT_ORDER.filter((t) => runs.some((r) => r.toolkit === t));
}

export function totalComputationMs(runs: readonly ScenarioRun[]): number {
  return runs.reduce((sum, r) => sum + (r.computationTimeMs || 0), 0);
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

/** A stable key for one overlay on one run. */
export function overlayKey(run: ScenarioRun, overlay: ScenarioOverlay): string {
  return `${run.id}::${overlay.focus}`;
}

/**
 * A result set an analysis itself produced (saturated edges, single points of
 * failure, critical-path nodes, diamond conditioning nodes, ...), tied back to
 * the run that produced it. This is the ONLY kind of set the profile view
 * shows — there is no client-side threshold anywhere that decides a value is
 * notable.
 */
export interface OverlayRef {
  key: string;
  run: ScenarioRun;
  overlay: ScenarioOverlay;
  nodeCount: number;
  edgeCount: number;
}

export function collectOverlays(runs: readonly ScenarioRun[]): OverlayRef[] {
  const refs: OverlayRef[] = [];
  for (const run of runs) {
    for (const overlay of run.overlays ?? []) {
      refs.push({
        key: overlayKey(run, overlay),
        run,
        overlay,
        nodeCount: overlay.nodeIds?.length ?? 0,
        edgeCount: overlay.edges?.length ?? 0,
      });
    }
  }
  // Same scenario's result sets stay together when a network carries many.
  return refs.sort(
    (a, b) =>
      a.run.scenarioName.localeCompare(b.run.scenarioName) ||
      a.run.valueType.localeCompare(b.run.valueType) ||
      a.overlay.label.localeCompare(b.overlay.label),
  );
}

export function directionHint(direction: MetricDirection): string {
  switch (direction) {
    case 'higher-better':
      return 'higher is better';
    case 'lower-better':
      return 'lower is better';
    default:
      return '';
  }
}
