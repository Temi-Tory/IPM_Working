import { formatNumber } from '@inf-prop/shared/ui';

export type Edge = [number, number];

/** `12 → 7` — a directed edge for display. */
export function edgeLabel(edge: Edge): string {
  return `${edge[0]} → ${edge[1]}`;
}

/** Stable track-by key for an edge in a template `@for`. */
export function edgeKey(edge: Edge): string {
  return `${edge[0]}-${edge[1]}`;
}

/** A number for display, honest about infinity (unbounded flow). */
export function num(value: number, maxFractionDigits = 2): string {
  return formatNumber(value, { maxFractionDigits });
}

/** Utilisation of an edge as a 0–100 figure; 0 when capacity is not positive. */
export function utilisationPercent(flow: number, capacity: number): number {
  if (!Number.isFinite(flow) || !Number.isFinite(capacity) || capacity <= 0) {
    return 0;
  }
  return (flow / capacity) * 100;
}
