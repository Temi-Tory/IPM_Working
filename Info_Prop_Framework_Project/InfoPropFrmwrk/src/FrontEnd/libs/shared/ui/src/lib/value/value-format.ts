import { IntervalData, PboxData, ValueForm } from '@inf-prop/shared/api-client';

/** Format a plain number for display. Keeps small probabilities readable. */
export function formatNumber(n: number, opts: { maxFractionDigits?: number } = {}): string {
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
