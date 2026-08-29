/**
 * Value-form types — the single source of truth for how an uncertain value
 * crosses the wire. These mirror `AnalysisCommon.convert_values` in the Julia
 * server exactly: a deterministic value stays a number, an interval becomes a
 * typed bound-pair, a probability-box becomes a typed distributional summary.
 *
 * RULE (framework delivery commitment "value-form honesty at every boundary"):
 * never average, midpoint, or otherwise flatten an `IntervalData` or `PboxData`
 * into a single number for display or transport. Render the form you were given.
 */

export interface IntervalData {
  type: 'interval';
  lower: number;
  upper: number;
}

export interface PboxData {
  type: 'pbox';
  mean_lower: number;
  mean_upper: number;
  var_lower: number;
  var_upper: number;
  shape: string;
  name: string;
  bounded: boolean;
  discretization_size: number;
  bounds_summary: {
    left_min: number;
    left_max: number;
    right_min: number;
    right_max: number;
  };
}

/** A per-node/per-edge analysis output that may be any of the three forms. */
export type ValueForm = number | IntervalData | PboxData;

/** Belief `b(v)` from the reliability toolkit — spans all three forms. */
export type BeliefValue = ValueForm;

/**
 * The three epistemic states a value can be known in. Which of these a given
 * toolkit accepts is NOT uniform — see `TOOLKIT_VALUE_TYPES`.
 */
export type ValueType = 'float64' | 'interval' | 'pbox';

export type ToolkitKind = 'reliability' | 'flow' | 'schedule';

/**
 * The per-toolkit value-type asymmetry, stated once. A UI value-type selector
 * MUST derive its options from the toolkit about to run, never offer a global
 * fixed set of three.
 *
 *  - Reliability: Float64, Interval (exact), p-box (sound bounds) — all three.
 *  - Flow/Capacity: Float64 only. `CapacityAnalysisKit.jl` hard-rejects anything else.
 *  - Schedule/CPM: Float64 and Interval. Zero p-box support in `CriticalPathV2Module`.
 */
export const TOOLKIT_VALUE_TYPES: Record<ToolkitKind, readonly ValueType[]> = {
  reliability: ['float64', 'interval', 'pbox'],
  flow: ['float64'],
  schedule: ['float64', 'interval'],
} as const;

export function isIntervalData(v: unknown): v is IntervalData {
  return !!v && typeof v === 'object' && (v as IntervalData).type === 'interval';
}

export function isPboxData(v: unknown): v is PboxData {
  return !!v && typeof v === 'object' && (v as PboxData).type === 'pbox';
}

export function isDeterministic(v: unknown): v is number {
  return typeof v === 'number';
}

export function valueFormKind(v: ValueForm): ValueType {
  if (isIntervalData(v)) return 'interval';
  if (isPboxData(v)) return 'pbox';
  return 'float64';
}
