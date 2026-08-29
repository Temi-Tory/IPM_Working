import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  CardComponent,
  IconComponent,
  ValueDisplayComponent,
  formatNumber,
} from '@inf-prop/shared/ui';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import {
  MetricColumn,
  ToolkitGroup,
  directionHint,
  findMetric,
  groupByToolkit,
  numericDelta,
} from '../model/profile-view';

/**
 * The scenarios of one network set side by side: every cached scenario's real
 * outputs, one table per toolkit (their metrics differ). Values keep their form
 * via `<ipf-value>` — an interval stays a bound pair, honesty about the form of
 * a value being the common design rule. There is NO colouring by "goodness", no
 * best/worst badge, no score: the numbers are shown plainly and the reader
 * draws the conclusion, because the interface is a window, not a second
 * implementation.
 *
 * The only derived figure offered is an optional plain difference against a
 * baseline scenario, and only for metrics that are plain numbers in both rows —
 * an interval is never midpointed to compute a delta.
 */
@Component({
  selector: 'ipf-sp-metrics-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconComponent, ValueDisplayComponent],
  template: `
    @for (group of groups(); track group.toolkit) {
      <ipf-card class="group">
        <header class="group-head">
          <div class="title">
            <ipf-icon [name]="iconFor(group.toolkit)" [size]="18" />
            <h3>{{ group.label }}</h3>
            <span class="muted"
              >{{ group.runs.length }} scenario{{
                group.runs.length === 1 ? '' : 's'
              }}</span
            >
          </div>
          @if (group.runs.length > 1) {
            <label class="baseline">
              <span>Compare to</span>
              <select
                [value]="baselineId() ?? ''"
                (change)="onBaseline($event)"
              >
                <option value="">— none —</option>
                @for (r of group.runs; track r.id) {
                  <option [value]="r.id">{{ r.scenarioName }}</option>
                }
              </select>
            </label>
          }
        </header>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="sticky">Scenario</th>
                <th>Value type</th>
                <th>Ran</th>
                @for (col of group.columns; track col.label) {
                  <th class="metric" [title]="headerTitle(col)">
                    <span class="col-label">{{ col.label }}</span>
                    @if (col.unit) {
                      <span class="col-unit">{{ col.unit }}</span>
                    }
                    @if (hintFor(col)) {
                      <span class="col-dir">{{ hintFor(col) }}</span>
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (run of group.runs; track run.id) {
                <tr [class.is-baseline]="run.id === baselineId()">
                  <td class="sticky">
                    <span class="scenario">{{ run.scenarioName }}</span>
                  </td>
                  <td><span class="vt">{{ run.valueType }}</span></td>
                  <td class="muted">{{ ranAt(run) }}</td>
                  @for (col of group.columns; track col.label) {
                    <td class="metric">
                      @let m = metric(run, col.label);
                      @if (m) {
                        <ipf-value [value]="m.value" [showTag]="false" />
                        @let d = delta(group, run, col.label);
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
      </ipf-card>
    }

    @if (hasDirectionHints()) {
      <p class="legend">
        “higher is better” / “lower is better” describes what the metric
        measures, as declared by the toolkit that produced it. It is not a
        rating of any scenario.
      </p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .group {
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .group-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacingHorizontalM, 12px);
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      h3 {
        margin: 0;
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
      .baseline {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
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
      .col-unit,
      .col-dir {
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
      tr.is-baseline .sticky {
        background: var(--colorNeutralBackground3);
      }
      .delta {
        display: block;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        font-variant-numeric: tabular-nums;
      }
      .legend {
        margin: var(--spacingVerticalXS, 4px) 0 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        max-width: 72ch;
      }
    `,
  ],
})
export class MetricsComparisonComponent {
  readonly runs = input.required<ScenarioRun[]>();

  protected readonly baselineId = signal<string | null>(null);

  protected readonly groups = computed<ToolkitGroup[]>(() =>
    groupByToolkit(this.runs()),
  );

  protected readonly hasDirectionHints = computed(() =>
    this.groups().some((g) => g.columns.some((c) => c.direction !== 'neutral')),
  );

  protected iconFor(toolkit: string): 'reliability' | 'flow' | 'schedule' {
    return toolkit === 'flow'
      ? 'flow'
      : toolkit === 'schedule'
        ? 'schedule'
        : 'reliability';
  }

  protected hintFor(col: MetricColumn): string {
    return directionHint(col.direction);
  }

  protected headerTitle(col: MetricColumn): string {
    const hint = directionHint(col.direction);
    return hint ? `${col.label} — ${hint} (metric semantics, not a verdict)` : col.label;
  }

  protected metric(run: ScenarioRun, label: string) {
    return findMetric(run, label);
  }

  protected ranAt(run: ScenarioRun): string {
    return new Date(run.ranAt).toLocaleString();
  }

  protected onBaseline(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.baselineId.set(value === '' ? null : value);
  }

  /** Plain difference vs the chosen baseline, only for number/number pairs. */
  protected delta(
    group: ToolkitGroup,
    run: ScenarioRun,
    label: string,
  ): string | null {
    const baseId = this.baselineId();
    if (!baseId || baseId === run.id) return null;
    const base = group.runs.find((r) => r.id === baseId);
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
