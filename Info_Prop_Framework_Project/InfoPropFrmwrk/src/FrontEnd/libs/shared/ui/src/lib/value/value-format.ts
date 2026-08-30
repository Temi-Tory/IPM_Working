import { IntervalData, PboxData, ValueForm } from '@inf-prop/shared/api-client';

/**
 * Format a plain number for display. Keeps small probabilities readable.
 *
 * Accepts `number | string` because a server result can carry the same
 * "Inf"/"-Inf"/"NaN" string tokens the capacity/analysis JSON contract uses
 * on the way in (InputProcessingModule.jl) and, since `sanitize_for_json`,
 * on the way out too — JSON has no literal for a non-finite float. Without
 * this, `Number.isFinite("Inf")` is `false` (no coercion) but `"Inf" > 0`
 * coerces via `Number("Inf")`, which is `NaN` (JS only recognises the
 * spelling "Infinity") — both branches fail and it silently prints "NaN"
 * for what is actually an unbounded, correctly-computed result. Confirmed
 * against a live server value (Birnbaum importance on a Net3 edge directly
 * downstream of an unbounded reservoir capacity), 2026-08-30.
 */
export function formatNumber(
  n: number | string,
  opts: { maxFractionDigits?: number } = {},
): string {
  if (typeof n === 'string') {
    if (n === 'Inf') return '∞';
    if (n === '-Inf') return '-∞';
    if (n === 'NaN') return 'NaN';
    n = Number(n);
  }
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'NaN';
  const max = opts.maxFractionDigits ?? 4;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) {
    return n.toExponential(2);
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
  });
}

export function formatInterval(v: IntervalData, maxFractionDigits = 4): string {
  return `[${formatNumber(v.lower, { maxFractionDigits })}, ${formatNumber(v.upper, { maxFractionDigits })}]`;
}

export function intervalWidth(v: IntervalData): number {
  return v.upper - v.lower;
}

/** A short, honest one-line summary of a p-box: the mean's guaranteed range. */
export function formatPboxSummary(v: PboxData, maxFractionDigits = 4): string {
  const mean = `E ∈ [${formatNumber(v.mean_lower, { maxFractionDigits })}, ${formatNumber(v.mean_upper, { maxFractionDigits })}]`;
  return v.shape ? `${mean} · ${v.shape}` : mean;
}

export type ValueFormKindLabel = 'number' | 'interval' | 'p-box';

export function valueFormLabel(v: ValueForm): ValueFormKindLabel {
  if (typeof v === 'number') return 'number';
  return v.type === 'pbox' ? 'p-box' : 'interval';
}

/**
 * A single display string that never flattens. A number stays a number, an
 * interval stays a bound pair, a p-box stays a typed summary.
 */
export function formatValueForm(v: ValueForm, maxFractionDigits = 4): string {
  if (typeof v === 'number') return formatNumber(v, { maxFractionDigits });
  if (v.type === 'interval') return formatInterval(v, maxFractionDigits);
  return formatPboxSummary(v, maxFractionDigits);
}
