import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { IntervalData } from '@inf-prop/shared/api-client';
import { formatNumber } from '../value/value-format';
import { ValueDisplayComponent } from '../value/value-display.component';

/**
 * The minimal shape this table needs from a `ScenarioRun` (defined in
 * `shared/data-access`). Declared locally rather than imported: `type:ui` may
 * only depend on `type:api-client` under the module-boundary rules, and a
 * `ScenarioRun` value satisfies this structurally — no cast needed at the call
 * site in `shared/data-access`-aware feature code.
 */
export interface ComparableMetric {
  label: string;
  value: number | IntervalData;
  unit?: string;
}

export interface ComparableRun {
  id: string;
  scenarioName: string;
  valueType: string;
  ranAt: number;
  metrics: ComparableMetric[];
}

function metricColumns(
  runs: readonly ComparableRun[],
): { label: string; unit: string }[] {
  const seen = new Map<string, { label: string; unit: string }>();
  for (const run of runs) {
    for (const m of run.metrics) {
      if (!seen.has(m.label)) seen.set(m.label, { label: m.label, unit: m.unit ?? '' });
    }
  }
  return [...seen.values()];
}

function findMetric(
  run: ComparableRun,
  label: string,
): ComparableMetric | undefined {
  return run.metrics.find((m) => m.label === label);
}

/**
 * A plain numeric difference — ONLY when both values are plain numbers. An
 * interval is never flattened to a midpoint to produce a delta; callers show
 * the raw value in that case.
 */
function numericDelta(
  value: ComparableMetric['value'],
  baseline: ComparableMetric['value'],
): number | null {
  if (typeof value === 'number' && typeof baseline === 'number') {
    return value - baseline;
  }
  return null;
}

/**
 * A set of scenario runs, laid out one row per run and one column per distinct
 * metric label — the shared table behind every "Compare" view (System
 * Profile's cross-toolkit page, and each toolkit's own in-page Compare tab).
 * Callers pass ONE toolkit's runs, already narrowed to whichever scenarios the
 * viewer picked; this component does no filtering of its own.
 *
 * Values keep their form via `<ipf-value>` — an interval stays a bound pair.
 * There is NO colouring by "goodness", no best/worst badge, no score: the
 * numbers are shown plainly. The only derived figure is an optional plain
 * difference against a chosen baseline row, and only for metrics that are
 * plain numbers in both rows — an interval is never midpointed to compute a
 * delta.
 */
@Component({
  selector: 'ipf-scenario-comparison-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ValueDisplayComponent],
  template: `
    @if (runs().length === 0) {
      <p class="empty">{{ emptyMessage() }}</p>
    } @else {
      @if (runs().length > 1) {
        <label class="baseline">
          <span>Compare to</span>
          <select [value]="baselineId() ?? ''" (change)="onBaseline($event)">
            <option value="">— none —</option>
            @for (r of runs(); track r.id) {
              <option [value]="r.id">{{ r.scenarioName }}</option>
            }
          </select>
        </label>
      }

      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="sticky">Scenario</th>
              <th>Value type</th>
              <th>Ran</th>
              @for (col of columns(); track col.label) {
                <th class="metric">
                  <span class="col-label">{{ col.label }}</span>
                  @if (col.unit) {
                    <span class="col-unit">{{ col.unit }}</span>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (run of runs(); track run.id) {
              <tr [class.is-baseline]="run.id === baselineId()">
                <td class="sticky">
                  <span class="scenario">{{ run.scenarioName }}</span>
                </td>
                <td><span class="vt">{{ run.valueType }}</span></td>
                <td class="muted">{{ ranAt(run) }}</td>
                @for (col of columns(); track col.label) {
                  <td class="metric">
                    @let m = findMetric(run, col.label);
                    @if (m) {
                      <ipf-value [value]="m.value" [showTag]="false" />
                      @let d = delta(run, col.label);
                      @if (d !== null) {
                        <span class="delta">{{ d }}</span>
                      }
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .empty {
        margin: 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .baseline {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .baseline select {
        font: inherit;
        padding: 3px 6px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
      }
      .scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fontSizeBase300, 14px);
      }
      th,
      td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid var(--colorNeutralStroke2);
        white-space: nowrap;
        vertical-align: top;
      }
      th {
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground2);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      th.metric,
      td.metric {
        text-align: right;
      }
      .col-label {
        display: block;
      }
      .col-unit {
        display: block;
        font-weight: var(--fontWeightRegular, 400);
        text-transform: none;
        letter-spacing: 0;
        color: var(--colorNeutralForeground3);
      }
      .sticky {
        position: sticky;
        left: 0;
        background: var(--colorNeutralBackground1);
      }
      .scenario {
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .vt {
        font-size: var(--fontSizeBase100, 10px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px 5px;
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
      }
      .muted {
        color: var(--colorNeutralForeground3);
      }
      tr.is-baseline .sticky {
        background: var(--colorNeutralBackground3);
      }
      .delta {
        display: block;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class ScenarioComparisonTableComponent {
  readonly runs = input.required<ComparableRun[]>();
  readonly emptyMessage = input('No scenarios selected.');

  protected readonly baselineId = signal<string | null>(null);

  protected readonly columns = computed(() => metricColumns(this.runs()));

  protected readonly findMetric = findMetric;

  protected ranAt(run: ComparableRun): string {
    return new Date(run.ranAt).toLocaleString();
  }

  protected onBaseline(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.baselineId.set(value === '' ? null : value);
  }

  /** Plain difference vs the chosen baseline, only for number/number pairs. */
  protected delta(run: ComparableRun, label: string): string | null {
    const baseId = this.baselineId();
    if (!baseId || baseId === run.id) return null;
    const base = this.runs().find((r) => r.id === baseId);
    if (!base) return null;
    const here = findMetric(run, label);
    const there = findMetric(base, label);
    if (!here || !there) return null;
    const d = numericDelta(here.value, there.value);
    if (d === null || d === 0) return d === 0 ? 'Δ 0' : null;
    const sign = d > 0 ? '+' : '';
    return `Δ ${sign}${formatNumber(d, { maxFractionDigits: 4 })}`;
  }
}
