import { AnalysisEnvelope } from './envelope';
import { IntervalData } from '../value-types';

/**
 * `POST /critical-path-analysis` (canonical) / `/cpm-analysis` (alias).
 *
 * Backed by `CriticalPathV2Module` (server-fixes track 05 rewired it; shape
 * below is CONFIRMED against the live endpoint and V2's validated test cases —
 * water Float64 project_value 45.0, KarlNetwork 53.5, accumulation total 480.0).
 *
 * Computes, for any quantity that accumulates along dependency paths (duration,
 * cost, risk, load), the extremal value a complete chain can produce (forward
 * pass) and the room each node carries before that value changes (margin).
 * Bypasses diamond decomposition entirely.
 *
 * VALUE TYPES: Float64 and Interval only. Zero p-box — the schedule
 * value-type selector offers exactly two options. Interval + accumulation is
 * rejected server-side with a 500 (no interval accumulation scheme in V2).
 */

export type ScheduleValueType = 'float64' | 'interval';

/** A shipped mode. Which one a run uses defaults from the CPM file's declared
 *  combination/propagation functions (every current file resolves to
 *  `longest_path`); it can be overridden per pass via the request. */
export type ScheduleMode =
  | 'longest_path'
  | 'shortest_path'
  | 'max_scaling'
  | 'accumulation';

export interface CriticalPathRequest {
  networkPath: string;
  edgesFilePath?: string;
  cpmPath: string;
  /** override the time-pass mode (optional) */
  mode?: ScheduleMode;
  /** override the cost-pass mode (optional) */
  costMode?: ScheduleMode;
}

/** A quantity that is either a plain number (Float64) or an interval. */
export type ScheduleValue = number | IntervalData;
/** Interval values on the wire: `{ type: 'interval', lower, upper }`. */
export type ScheduleIntervalValue = IntervalData;

/** margin semantics per mode: slack (longest), margin (shortest), ratio_slack
 *  (max_scaling), allowance (accumulation). */
export type MarginName = 'slack' | 'margin' | 'ratio_slack' | 'allowance';

/** ---- Float64 path modes: longest_path | shortest_path | max_scaling ---- */
export interface SchedulePathResultFloat {
  kind: 'path';
  mode: Exclude<ScheduleMode, 'accumulation'>;
  method: 'exact_scalar';
  margin_name: 'slack' | 'margin' | 'ratio_slack';
  value_type: 'Float64';
  project_value: number;
  /** F = earliest finish, per node id */
  forward: Record<string, number>;
  /** R = best completion to a sink, exclusive */
  reverse_completion: Record<string, number>;
  /** best complete path value through the node */
  through: Record<string, number>;
  /** margin; node is critical iff ~0 */
  margin: Record<string, number>;
  critical: number[];
  /** false for max_scaling (no additive schedule) */
  schedule_available: boolean;
  /** additive modes only (longest_path / shortest_path) */
  early_start?: Record<string, number>;
  late_finish?: Record<string, number>;
  late_start?: Record<string, number>;
  /** additive Float64 only: 0 < slack < 10% of project_value */
  near_critical_nodes?: number[];
}

/** ---- Interval path modes ---- */
export interface SchedulePathResultInterval {
  kind: 'path';
  mode: Exclude<ScheduleMode, 'accumulation'>;
  method:
    | 'exact_domination_split'
    | 'exact_corners_exhaustive'
    | 'conservative_enclosure';
  /** non-empty explanation when method === 'conservative_enclosure' */
  method_note: string;
  margin_name: 'slack' | 'margin' | 'ratio_slack';
  value_type: 'Interval';
  /** always exact corner-pair bounds regardless of method */
  project_value: IntervalData;
  forward: Record<string, IntervalData>;
  through: Record<string, IntervalData>;
  margin: Record<string, IntervalData>;
  /** critical in every corner (certain) */
  necessarily_critical: number[];
  /** critical in >= 1 corner (superset; loose under conservative_enclosure) */
  possibly_critical: number[];
  corner_count: number;
  /** interval scheme does not compute ES/LF/LS — always false, fields absent */
  schedule_available: false;
}

/** ---- Accumulation mode (Float64 only) ---- */
export interface ScheduleAccumulationResult {
  kind: 'accumulation';
  mode: 'accumulation';
  method: 'exact_scalar';
  margin_name: 'allowance';
  value_type: 'Float64';
  /** accumulated total reaching each node */
  forward: Record<string, number>;
  target: number;
  total: number;
  /** number of directed paths node -> target */
  multiplicity: Record<string, number>;
  /** d(total)/d(node value) = multiplicity */
  sensitivity: Record<string, number>;
  /** node value * multiplicity */
  contribution: Record<string, number>;
  /** present only if a budget is supplied (not currently wired) */
  allowance?: Record<string, number>;
  /** nodes by contribution, largest first */
  ranking: number[];
}

export type SchedulePassResult =
  | SchedulePathResultFloat
  | SchedulePathResultInterval
  | ScheduleAccumulationResult;

export interface CriticalPathResult {
  module_version: 'CriticalPathV2';
  value_type: 'Float64' | 'Interval';
  time_mode: ScheduleMode;
  /** null when the CPM file has no cost_analysis */
  cost_mode: ScheduleMode | null;
  computation_time: number;
  time_result: SchedulePassResult;
  /** null when the CPM file has no cost_analysis */
  cost_result: SchedulePassResult | null;
  input_files: { cpm_path: string };
}

export interface CriticalPathResponse extends AnalysisEnvelope {
  endpoint: 'critical-path-analysis' | 'cpm-analysis';
  edges_file_path: string;
  cpm_path: string;
  timestamp: string;
  critical_path_result: CriticalPathResult;
}

// helpers -------------------------------------------------------------------

export function isAccumulation(
  r: SchedulePassResult,
): r is ScheduleAccumulationResult {
  return r.kind === 'accumulation';
}

export function isIntervalPass(
  r: SchedulePassResult,
): r is SchedulePathResultInterval {
  return r.kind === 'path' && r.value_type === 'Interval';
}
