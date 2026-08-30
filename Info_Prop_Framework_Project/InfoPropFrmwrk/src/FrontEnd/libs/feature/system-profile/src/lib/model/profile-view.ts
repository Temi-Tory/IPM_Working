import { ToolkitKind, ValueType } from '@inf-prop/shared/api-client';
import {
  MetricColumn,
  ScenarioOverlay,
  ScenarioRun,
  metricColumns,
} from '@inf-prop/shared/data-access';

/**
 * Pure, mechanical view helpers for the cross-scenario profile view.
 *
 * NOTHING in this file ranks, scores, flags, or judges a scenario. It groups,
 * de-duplicates, and reshapes values that the Reliability / Flow / Schedule
 * views already computed and wrote to `ScenarioCacheService`. Every number a
 * caller renders came straight from a `ScenarioRun` — this module only decides
 * where on the page it goes.
 *
 * `metricColumns` / `findMetric` / `numericDelta` are the toolkit-agnostic
 * primitives, shared with each toolkit's own in-page Compare tab — re-exported
 * here so existing imports keep working.
 */
export { metricColumns, findMetric, numericDelta } from '@inf-prop/shared/data-access';
export type { MetricColumn } from '@inf-prop/shared/data-access';

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

/** Distinct scenario NAMES across every run, regardless of toolkit — what
 *  "Scenarios" should count. A run count over-reports this: the same named
 *  scenario folder commonly carries inputs for more than one toolkit (e.g.
 *  `Degraded/` holding both a capacities file and a nodepriors/linkprobs
 *  pair), so one scenario run under each toolkit is still one scenario. */
export function distinctScenarioNames(runs: readonly ScenarioRun[]): string[] {
  return [...new Set(runs.map((r) => r.scenarioName))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** One scenario name's presence across the three toolkits — the most recent
 *  run recorded for each, if that toolkit has run this scenario at all. */
export interface ScenarioRosterRow {
  scenarioName: string;
  byToolkit: Partial<Record<ToolkitKind, { valueType: ValueType; ranAt: number }>>;
}

/**
 * The network's scenarios, one row each, with which toolkits have run them —
 * the chapter's "sets the scenarios of one network side by side" applied at
 * the scenario-name level rather than within one toolkit's own table, which
 * is the one thing the per-toolkit comparison tables below cannot show: that
 * "Degraded" has been tested under Flow but never under Reliability, say.
 * Structural only — a roster of what has been run, not a judgment of it.
 */
export function scenarioRoster(runs: readonly ScenarioRun[]): ScenarioRosterRow[] {
  const byName = new Map<string, ScenarioRosterRow>();
  for (const run of runs) {
    let row = byName.get(run.scenarioName);
    if (!row) {
      row = { scenarioName: run.scenarioName, byToolkit: {} };
      byName.set(run.scenarioName, row);
    }
    const existing = row.byToolkit[run.toolkit];
    if (!existing || run.ranAt > existing.ranAt) {
      row.byToolkit[run.toolkit] = { valueType: run.valueType, ranAt: run.ranAt };
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.scenarioName.localeCompare(b.scenarioName),
  );
}

export function totalComputationMs(runs: readonly ScenarioRun[]): number {
  return runs.reduce((sum, r) => sum + (r.computationTimeMs || 0), 0);
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
