/**
 * Pure derivation of the schedule views from a `CriticalPathV2` pass result.
 * No Angular: everything here is unit-tested directly against mock responses in
 * the `models/schedule.ts` shape.
 *
 * The three `SchedulePassResult` variants are kept distinct end to end — a
 * conservative interval enclosure is never presented as an exact answer, and an
 * interval quantity is never flattened to a midpoint (rendering goes through
 * `<ipf-value>`).
 */
import {
  MarginName,
  NetworkStructure,
  ScheduleAccumulationResult,
  ScheduleMode,
  SchedulePassResult,
  SchedulePathResultFloat,
  ScheduleValue,
  isAccumulation,
  isIntervalPass,
} from '@inf-prop/shared/api-client';
import { ScenarioMetric } from '@inf-prop/shared/data-access';

export type NodeRole = 'source' | 'sink' | 'fork' | 'join' | 'interior';

/** How an activity relates to the critical path, honestly per variant. */
export type CriticalKind =
  | 'critical' // Float64: margin ~ 0
  | 'near-critical' // Float64 additive: 0 < slack < 10% of project value
  | 'necessary' // Interval: critical in every corner (certain)
  | 'possible' // Interval: critical in >= 1 corner (superset)
  | 'none';

export interface ActivityRow {
  nodeId: number;
  role: NodeRole;
  /** F — best value of a path reaching the node, inclusive */
  forward: ScheduleValue;
  /** best complete path constrained through the node */
  through: ScheduleValue | null;
  /**
   * The margin: the gap between the project value and the through-value
   * (`P - through_v`). A difference for the additive pairs, a ratio for
   * MaxScaling. Its zero set is the critical structure.
   */
  margin: ScheduleValue | null;
  /** R — best completion from the activity onwards, exclusive (Float64 path only) */
  reverseCompletion: number | null;
  /** classical schedule quantities — additive Float64 only. early start = F − duration,
   *  late finish = P − R; total float equals the slack. */
  earlyStart: number | null;
  lateStart: number | null;
  lateFinish: number | null;
  critical: CriticalKind;
}

export interface AccumulationRow {
  nodeId: number;
  role: NodeRole;
  /** F — the accumulated total reaching the activity */
  accumulated: number;
  /** the number of directed routes from the activity to the target;
   *  a value added here reaches the total once per route. Equals the
   *  sensitivity d(total)/d(value). */
  multiplicity: number;
  /** d(total)/d(value) — numerically the multiplicity */
  sensitivity: number;
  /** value × multiplicity — the activity's share of the total */
  contribution: number;
  /** allowance = headroom against a stated budget, divided by multiplicity.
   *  Present only when a budget was supplied. */
  allowance: number | null;
  /** 1-based rank by contribution, or null if outside the ranking */
  rank: number | null;
}

export interface PassSummary {
  kind: 'path' | 'accumulation';
  valueType: 'Float64' | 'Interval';
  mode: ScheduleMode;
  marginName: MarginName;
  method: string;
  methodLabel: string;
  /** non-empty explanation, present for conservative_enclosure */
  methodNote: string | null;
  /** the interval margins are a sound enclosure, not an exact float range */
  isConservative: boolean;
  /** exact interval floats (the domination split or exhaustive corner enumeration) */
  isExactInterval: boolean;
  /** path modes: extremal value of a complete chain */
  projectValue: ScheduleValue | null;
  criticalCount: number;
  nearCriticalCount: number;
  /** interval only */
  necessaryCount: number | null;
  possibleCount: number | null;
  cornerCount: number | null;
  /** classical ES/LF/LS present (additive Float64 only) */
  scheduleAvailable: boolean;
  /** accumulation only */
  total: number | null;
  target: number | null;
  topContributor: number | null;
}

const METHOD_LABELS: Record<string, string> = {
  exact_scalar: 'Exact',
  exact_domination_split: 'Exact — domination split',
  exact_corners_exhaustive: 'Exact — exhaustive corner enumeration',
  conservative_enclosure: 'Conservative — sound enclosure',
};

/** The interval scheme in the chapter's words, for prose. */
export function intervalMethodPhrase(method: string): string {
  switch (method) {
    case 'exact_domination_split':
      return 'domination split';
    case 'exact_corners_exhaustive':
      return 'exhaustive corner enumeration';
    case 'conservative_enclosure':
      return 'sound enclosure';
    default:
      return method;
  }
}

export function rolesFromStructure(
  structure: NetworkStructure | null | undefined,
): Map<number, NodeRole> {
  const roles = new Map<number, NodeRole>();
  if (!structure) return roles;
  for (const n of structure.nodes) roles.set(n, 'interior');
  for (const n of structure.fork_nodes) roles.set(n, 'fork');
  for (const n of structure.join_nodes) roles.set(n, 'join');
  for (const n of structure.sink_nodes) roles.set(n, 'sink');
  for (const n of structure.source_nodes) roles.set(n, 'source');
  return roles;
}

export function roleLabel(role: NodeRole): string {
  return role[0].toUpperCase() + role.slice(1);
}

function sortedNodeIds(rec: Record<string, unknown>): number[] {
  return Object.keys(rec)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function activityRows(
  result: SchedulePassResult,
  roles: Map<number, NodeRole>,
): ActivityRow[] {
  if (isAccumulation(result)) return [];

  if (isIntervalPass(result)) {
    const necessary = new Set(result.necessarily_critical);
    const possible = new Set(result.possibly_critical);
    return sortedNodeIds(result.forward).map((id) => {
      const k = String(id);
      return {
        nodeId: id,
        role: roles.get(id) ?? 'interior',
        forward: result.forward[k],
        through: result.through[k] ?? null,
        margin: result.margin[k] ?? null,
        reverseCompletion: null,
        earlyStart: null,
        lateStart: null,
        lateFinish: null,
        critical: necessary.has(id)
          ? 'necessary'
          : possible.has(id)
            ? 'possible'
            : 'none',
      };
    });
  }

  const f = result as SchedulePathResultFloat;
  const critical = new Set(f.critical);
  const near = new Set(f.near_critical_nodes ?? []);
  return sortedNodeIds(f.forward).map((id) => {
    const k = String(id);
    return {
      nodeId: id,
      role: roles.get(id) ?? 'interior',
      forward: f.forward[k],
      through: f.through[k] ?? null,
      margin: f.margin[k] ?? null,
      reverseCompletion: f.reverse_completion[k] ?? null,
      earlyStart: f.early_start?.[k] ?? null,
      lateStart: f.late_start?.[k] ?? null,
      lateFinish: f.late_finish?.[k] ?? null,
      critical: critical.has(id)
        ? 'critical'
        : near.has(id)
          ? 'near-critical'
          : 'none',
    };
  });
}

export function accumulationRows(
  result: ScheduleAccumulationResult,
  roles: Map<number, NodeRole>,
): AccumulationRow[] {
  const rank = new Map<number, number>();
  result.ranking.forEach((id, i) => rank.set(id, i + 1));
  return sortedNodeIds(result.forward).map((id) => {
    const k = String(id);
    return {
      nodeId: id,
      role: roles.get(id) ?? 'interior',
      accumulated: result.forward[k] ?? 0,
      multiplicity: result.multiplicity[k] ?? 0,
      sensitivity: result.sensitivity[k] ?? 0,
      contribution: result.contribution[k] ?? 0,
      allowance: result.allowance?.[k] ?? null,
      rank: rank.get(id) ?? null,
    };
  });
}

export function passSummary(result: SchedulePassResult): PassSummary {
  const base: PassSummary = {
    kind: 'path',
    valueType: 'Float64',
    mode: 'longest_path',
    marginName: 'slack',
    method: result.method,
    methodLabel: METHOD_LABELS[result.method] ?? result.method,
    methodNote: null,
    isConservative: false,
    isExactInterval: false,
    projectValue: null,
    criticalCount: 0,
    nearCriticalCount: 0,
    necessaryCount: null,
    possibleCount: null,
    cornerCount: null,
    scheduleAvailable: false,
    total: null,
    target: null,
    topContributor: null,
  };

  if (isAccumulation(result)) {
    return {
      ...base,
      kind: 'accumulation',
      mode: 'accumulation',
      marginName: 'allowance',
      total: result.total,
      target: result.target,
      topContributor: result.ranking[0] ?? null,
    };
  }

  if (isIntervalPass(result)) {
    const note = result.method_note?.trim() ? result.method_note.trim() : null;
    return {
      ...base,
      valueType: 'Interval',
      mode: result.mode,
      marginName: result.margin_name,
      methodNote: note,
      isConservative: result.method === 'conservative_enclosure',
      isExactInterval: result.method !== 'conservative_enclosure',
      projectValue: result.project_value,
      criticalCount: result.necessarily_critical.length,
      necessaryCount: result.necessarily_critical.length,
      possibleCount: result.possibly_critical.length,
      cornerCount: result.corner_count,
    };
  }

  const f = result as SchedulePathResultFloat;
  return {
    ...base,
    mode: f.mode,
    marginName: f.margin_name,
    projectValue: f.project_value,
    criticalCount: f.critical.length,
    nearCriticalCount: f.near_critical_nodes?.length ?? 0,
    scheduleAvailable: f.schedule_available,
  };
}

export function criticalNodeIds(result: SchedulePassResult): number[] {
  if (isAccumulation(result)) return [];
  if (isIntervalPass(result)) return [...result.necessarily_critical];
  return [...(result as SchedulePathResultFloat).critical];
}

export function possiblyCriticalNodeIds(result: SchedulePassResult): number[] {
  return isIntervalPass(result) ? [...result.possibly_critical] : [];
}

/** The `Margin` column of the modes table (Critical Path chapter, Table 1). */
export function marginLabel(name: MarginName): string {
  switch (name) {
    case 'slack':
      return 'Slack';
    case 'margin':
      return 'Margin over optimum';
    case 'ratio_slack':
      return 'Ratio slack';
    case 'allowance':
      return 'Allowance';
  }
}

/** The mode names exactly as the chapter's modes table gives them. */
export function modeLabel(mode: ScheduleMode): string {
  switch (mode) {
    case 'longest_path':
      return 'LongestPath';
    case 'shortest_path':
      return 'ShortestPath';
    case 'max_scaling':
      return 'MaxScaling';
    case 'accumulation':
      return 'Accumulation';
  }
}

/** The operator pair (⊕ / ⊗) behind a mode, per the chapter's modes table. */
export function modeOperators(mode: ScheduleMode): string {
  switch (mode) {
    case 'longest_path':
      return 'max / +';
    case 'shortest_path':
      return 'min / +';
    case 'max_scaling':
      return 'max / ×';
    case 'accumulation':
      return 'sum / +';
  }
}

/** The chapter's name for the margin-zero structure of each order-based mode. */
export function criticalStructureLabel(
  mode: ScheduleMode,
  isInterval: boolean,
): string {
  if (isInterval) return 'Necessarily critical';
  switch (mode) {
    case 'longest_path':
      return 'Critical path';
    case 'shortest_path':
      return 'Optimal chain';
    case 'max_scaling':
      return 'Best route';
    case 'accumulation':
      return 'Ranking';
  }
}

export interface CriticalFilterOption {
  value: Exclude<CriticalKind, 'none'>;
  label: string;
  /** same number the stat tiles above the table already show for this tag
   *  (necessaryCount/possibleCount or criticalCount/nearCriticalCount) — read
   *  from there, not recomputed, so the two can never drift apart. */
  count: number;
}

/**
 * Activity-table filter options, dynamic per value type and carrying live
 * counts: a Float64 pass's Critical column can only ever say Critical /
 * Near-critical (never Necessarily/Possibly); an Interval pass's can only
 * ever say Necessarily / Possibly (never Critical/Near-critical). The filter
 * offers exactly the tags the column can actually show, each labelled with
 * the same count already on the stat tiles above.
 */
export function criticalFilterOptions(summary: PassSummary): CriticalFilterOption[] {
  if (summary.valueType === 'Interval') {
    return [
      { value: 'necessary', label: 'Necessarily critical', count: summary.necessaryCount ?? 0 },
      { value: 'possible', label: 'Possibly critical', count: summary.possibleCount ?? 0 },
    ];
  }
  return [
    { value: 'critical', label: 'Critical', count: summary.criticalCount },
    { value: 'near-critical', label: 'Near-critical', count: summary.nearCriticalCount },
  ];
}

/**
 * The chapter's noun for the forward value F_v — "the best value a chain of
 * dependencies can deliver into each node".
 */
export function forwardLabel(mode: ScheduleMode): string {
  switch (mode) {
    case 'longest_path':
    case 'shortest_path':
      return 'Completion';
    case 'max_scaling':
      return 'Success factor';
    case 'accumulation':
      return 'Accumulated total';
  }
}

/** What the project value P is, for the tile caption. */
export function projectValueCaption(mode: ScheduleMode): string {
  switch (mode) {
    case 'longest_path':
      return 'longest complete path — the critical path';
    case 'shortest_path':
      return 'shortest complete path';
    case 'max_scaling':
      return 'best end-to-end factor';
    case 'accumulation':
      return 'total reaching the target';
  }
}

/**
 * Labelled real outputs for the cross-scenario cache — read straight off the
 * response, never invented scores. `direction` is a fact about the metric
 * (a longer critical path is worse), not a verdict on the value.
 */
export function scenarioMetrics(
  timeResult: SchedulePassResult,
  costResult: SchedulePassResult | null,
): ScenarioMetric[] {
  const out: ScenarioMetric[] = [];

  if (isAccumulation(timeResult)) {
    out.push({
      label: 'Accumulated total',
      value: timeResult.total,
      direction: 'neutral',
    });
  } else {
    out.push({
      label: 'Critical path length',
      value: timeResult.project_value,
      direction: 'lower-better',
    });
    // Two separate metrics, not one collapsed count: an Interval pass's
    // necessarily-critical and possibly-critical sets are genuinely
    // different claims (certain vs. superset) and `criticalNodeIds` alone
    // only ever returns the necessarily-critical set — showing just its
    // length here silently dropped the possibly-critical count entirely
    // (e.g. "0" for a pass with 0 necessarily but 61 possibly critical).
    // Same counts the stat tiles above the activity table already show,
    // read from the same `passSummary`, never recomputed separately.
    const s = passSummary(timeResult);
    if (s.valueType === 'Interval') {
      out.push({
        label: 'Necessarily critical',
        value: s.necessaryCount ?? 0,
        direction: 'neutral',
      });
      out.push({
        label: 'Possibly critical',
        value: s.possibleCount ?? 0,
        direction: 'neutral',
      });
    } else {
      out.push({
        label: 'Critical activities',
        value: s.criticalCount,
        direction: 'neutral',
      });
      if (s.scheduleAvailable) {
        out.push({
          label: 'Near-critical activities',
          value: s.nearCriticalCount,
          direction: 'neutral',
        });
      }
    }
  }

  if (costResult) {
    if (isAccumulation(costResult)) {
      out.push({
        label: 'Accumulated cost',
        value: costResult.total,
        direction: 'neutral',
      });
    } else {
      out.push({
        label: 'Critical path cost',
        value: costResult.project_value,
        direction: 'lower-better',
      });
    }
  }

  return out;
}

/** Node-highlight sets for the Network Lens, all traceable to real outputs. */
export function scenarioOverlays(timeResult: SchedulePassResult): {
  focus: string;
  label: string;
  nodeIds: number[];
}[] {
  const critical = criticalNodeIds(timeResult);
  if (!critical.length) return [];
  return [{ focus: 'critical-path', label: 'Critical path', nodeIds: critical }];
}
