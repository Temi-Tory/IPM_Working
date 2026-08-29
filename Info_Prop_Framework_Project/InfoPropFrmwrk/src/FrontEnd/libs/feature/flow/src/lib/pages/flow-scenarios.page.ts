import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
} from '@inf-prop/shared/ui';
import { ScenarioMetric, ScenarioRun } from '@inf-prop/shared/data-access';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';
import { num } from '../flow-view.util';

const METRIC_COLUMNS = [
  'Maximum throughput',
  'Minimum-cut capacity',
  'Saturated edges',
  'Edges in every minimum cut',
  'Free-zone size',
  'Structural SPOF nodes',
  'Contributing path components',
] as const;

/** The metric the "best" highlight tracks (more throughput is better). */
const BEST_COLUMN = 'Maximum throughput';

/** Scenarios sub-view: the flow runs recorded this session, side by side. */
@Component({
  selector: 'ipf-flow-scenarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    @if (rows().length) {
      <ipf-card>
        <h2>Recorded flow runs</h2>
        <p class="muted">
          Every run of this network's capacities scenarios this session. These
          same runs feed the cross-toolkit System Profile.
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Ran</th>
                @for (col of columns; track col) {
                  <th class="n">{{ col }}</th>
                }
                <th class="n">Compute</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.run.id) {
                <tr [class.active]="row.isLatest">
                  <td>{{ row.run.scenarioName }}</td>
                  <td>{{ row.run.ranAt | date: 'short' }}</td>
                  @for (cell of row.cells; track cell.label) {
                    <td class="n" [class.best]="cell.isBest">{{ cell.text }}</td>
                  }
                  <td class="n">{{ compute(row.run) }}</td>
                  <td class="n">
                    @if (scenarioFor(row.run); as scenario) {
                      <button
                        type="button"
                        class="rerun"
                        [disabled]="store.isRunning()"
                        (click)="rerun(scenario.id)"
                      >
                        <ipf-icon name="refresh" [size]="14" />
                        Run again
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ipf-card>
    } @else {
      <ipf-empty-state
        icon="list"
        title="No runs recorded yet"
        message="Run a capacities scenario from Configure. Each run is recorded here and in System Profile for comparison."
      >
        <a slot="actions" routerLink="../config">Go to Configure</a>
      </ipf-empty-state>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--spacingVerticalXS, 4px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .muted {
        margin: 0 0 var(--spacingVerticalM, 12px);
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
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
        text-align: left;
        padding: 6px 10px;
        border-bottom: 1px solid var(--colorNeutralStroke2);
        white-space: nowrap;
      }
      th {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .n {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      tr.active td {
        background: var(--colorNeutralBackground2);
      }
      td.best {
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorPaletteGreenForeground1, #0e700e);
      }
      .rerun {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground2);
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        cursor: pointer;
      }
      .rerun:hover:not(:disabled) {
        color: var(--colorNeutralForeground1);
        border-color: var(--colorNeutralStroke1);
      }
      .rerun:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `,
  ],
})
export class FlowScenariosPage {
  protected readonly store = inject(FlowWorkbenchStore);
  protected readonly columns = METRIC_COLUMNS;

  protected readonly rows = computed(() => {
    const runs = this.store.recordedRuns();
    const latestId = runs[0]?.id;

    const bestThroughput = (() => {
      const values = runs
        .map((run) => numericMetric(run, BEST_COLUMN))
        .filter((v): v is number => v !== null && Number.isFinite(v));
      return values.length > 1 ? Math.max(...values) : null;
    })();

    return runs.map((run) => ({
      run,
      isLatest: run.id === latestId,
      cells: METRIC_COLUMNS.map((col) => {
        const value = numericMetric(run, col);
        return {
          label: col,
          text: value === null ? '—' : num(value),
          isBest:
            col === BEST_COLUMN &&
            value !== null &&
            bestThroughput === value,
        };
      }),
    }));
  });

  protected scenarioFor(run: ScenarioRun) {
    return (
      this.store.scenarios().find((s) => s.name === run.scenarioName) ?? null
    );
  }

  protected rerun(scenarioId: string): void {
    this.store.select(scenarioId);
    this.store.run();
  }

  protected compute(run: ScenarioRun): string {
    return run.computationTimeMs < 1000
      ? `${Math.round(run.computationTimeMs)} ms`
      : `${(run.computationTimeMs / 1000).toFixed(2)} s`;
  }
}

function numericMetric(run: ScenarioRun, label: string): number | null {
  const metric: ScenarioMetric | undefined = run.metrics.find(
    (m) => m.label === label,
  );
  if (!metric) return null;
  return typeof metric.value === 'number' ? metric.value : null;
}
