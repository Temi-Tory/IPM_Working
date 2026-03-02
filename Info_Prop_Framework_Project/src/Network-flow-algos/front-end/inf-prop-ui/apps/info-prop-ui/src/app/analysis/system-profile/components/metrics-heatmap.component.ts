import {
  Component, input, output, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import {
  ScenarioMetricRow,
  ProfileMetricDefinition,
  AggregatedMetrics,
  PROFILE_METRICS
} from '../../../shared/models/system-profile.models';

@Component({
  selector: 'app-metrics-heatmap',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatButtonToggleModule, MatSelectModule, MatTooltipModule, FormsModule
  ],
  template: `
    <mat-card class="heatmap-card">
      <mat-card-content>
        <div class="heatmap-header">
          <h4 class="section-title">
            <mat-icon>grid_on</mat-icon>
            Cross-Scenario Metrics
          </h4>
          <div class="heatmap-controls">
            <mat-button-toggle-group [value]="mode()" (change)="mode.set($event.value)">
              <mat-button-toggle value="absolute" matTooltip="Show raw metric values for each scenario">Absolute</mat-button-toggle>
              <mat-button-toggle value="difference" matTooltip="Show deltas relative to a baseline scenario">Difference</mat-button-toggle>
            </mat-button-toggle-group>
            @if (mode() === 'difference' && rows().length >= 2) {
              <mat-select class="baseline-select" [value]="baselineScenario()"
                          (selectionChange)="baselineScenario.set($event.value)"
                          placeholder="Baseline">
                @for (row of rows(); track row.scenario) {
                  <mat-option [value]="row.scenario">{{ row.scenario }}</mat-option>
                }
              </mat-select>
            }
          </div>
        </div>

        <!-- Heatmap table -->
        <div class="heatmap-table-wrapper">
          <table class="heatmap-table">
            <thead>
              <tr>
                <th class="scenario-col">Scenario</th>
                @for (col of visibleColumns(); track col.key) {
                  <th [matTooltip]="col.label + ' (' + col.unit + ')'">{{ col.shortLabel }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of displayRows(); track row.scenario) {
                <tr>
                  <td class="scenario-col">
                    <span class="scenario-name">{{ row.scenario }}</span>
                  </td>
                  @for (col of visibleColumns(); track col.key) {
                    <td class="metric-cell"
                        [style.background]="getCellColor(row, col)"
                        [matTooltip]="getCellTooltip(row, col)"
                        (click)="onCellClick(row, col)"
                        tabindex="0"
                        (keydown.enter)="onCellClick(row, col)">
                      {{ formatCellValue(row, col) }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .heatmap-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
    }

    .heatmap-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);

      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--primary-color); }
    }

    .heatmap-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .baseline-select {
      width: 180px;
    }

    .heatmap-table-wrapper {
      overflow-x: auto;
    }

    .heatmap-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        padding: 8px 12px;
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        border-bottom: 2px solid var(--outline-variant);
        text-align: center;
        white-space: nowrap;
      }

      td {
        padding: 8px 12px;
        text-align: center;
        border-bottom: 1px solid var(--outline-variant);
      }
    }

    .scenario-col {
      text-align: left !important;
      min-width: 120px;
    }

    .scenario-name {
      font-weight: 500;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.85rem;
      color: var(--text-primary);
    }

    .metric-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.8rem;
      cursor: pointer;
      transition: filter 0.15s ease;
      min-width: 75px;
      border-radius: 4px;
      margin: 2px;
      color: var(--text-primary);

      &:hover { filter: brightness(1.15); }
      &:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
    }

    @media (max-width: 900px) {
      .heatmap-header { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class MetricsHeatmapComponent {
  rows = input.required<ScenarioMetricRow[]>();
  aggregatedMetrics = input.required<AggregatedMetrics>();
  cellClicked = output<{ scenario: string; metricKey: string; source: string }>();

  mode = signal<'absolute' | 'difference'>('absolute');
  baselineScenario = signal<string>('');

  visibleColumns = computed(() => {
    const ranges = this.aggregatedMetrics().metricRanges;
    return PROFILE_METRICS.filter(m => ranges[m.key]);
  });

  displayRows = computed(() => {
    const rawRows = this.rows();
    if (this.mode() === 'absolute' || !this.baselineScenario()) return rawRows;

    const baseline = rawRows.find(r => r.scenario === this.baselineScenario());
    if (!baseline) return rawRows;

    return rawRows.map(row => {
      if (row.scenario === baseline.scenario) return row;
      const deltaMetrics: Record<string, number | string | null> = {};
      for (const [key, val] of Object.entries(row.metrics)) {
        const baseVal = baseline.metrics[key];
        if (typeof val === 'number' && typeof baseVal === 'number') {
          deltaMetrics[key] = val - baseVal;
        } else {
          deltaMetrics[key] = val;
        }
      }
      return { ...row, metrics: deltaMetrics };
    });
  });

  constructor() {
    // Set baseline to first scenario when rows change
    const checkBaseline = () => {
      if (!this.baselineScenario() && this.rows().length > 0) {
        this.baselineScenario.set(this.rows()[0].scenario);
      }
    };
    // Defer to next microtask to avoid signal read during construction
    Promise.resolve().then(checkBaseline);
  }

  private isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  getCellColor(row: ScenarioMetricRow, col: ProfileMetricDefinition): string {
    const val = row.metrics[col.key];
    if (typeof val !== 'number' || !isFinite(val)) return 'transparent';

    const isDark = this.isDarkMode();

    if (this.mode() === 'difference' && row.scenario !== this.baselineScenario()) {
      return this.getDivergingColor(val, col.higherIsBetter, isDark);
    }

    const range = this.aggregatedMetrics().metricRanges[col.key];
    if (!range || range.max === range.min) {
      return isDark ? 'rgba(38, 139, 210, 0.15)' : 'rgba(38, 139, 210, 0.1)';
    }

    const t = (val - range.min) / (range.max - range.min);
    const goodness = col.higherIsBetter ? t : 1 - t;
    return this.getHeatColor(goodness, isDark);
  }

  private getHeatColor(goodness: number, isDark: boolean): string {
    if (isDark) {
      const r = Math.round(180 - goodness * 140);
      const g = Math.round(40 + goodness * 140);
      const b = Math.round(40 + goodness * 20);
      return `rgba(${r}, ${g}, ${b}, 0.35)`;
    } else {
      const r = Math.round(230 - goodness * 100);
      const g = Math.round(130 + goodness * 100);
      const b = Math.round(130 + goodness * 20);
      return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }
  }

  private getDivergingColor(delta: number, higherIsBetter: boolean, isDark: boolean): string {
    const isGood = higherIsBetter ? delta > 0 : delta < 0;
    const isBad = higherIsBetter ? delta < 0 : delta > 0;

    if (isGood) {
      return isDark ? 'rgba(133, 153, 0, 0.35)' : 'rgba(133, 153, 0, 0.2)';
    }
    if (isBad) {
      return isDark ? 'rgba(220, 50, 47, 0.3)' : 'rgba(220, 50, 47, 0.15)';
    }
    return 'transparent';
  }

  formatCellValue(row: ScenarioMetricRow, col: ProfileMetricDefinition): string {
    const val = row.metrics[col.key];
    if (val == null) return '\u2014';
    if (typeof val === 'string') return val;

    const num = val as number;
    const isDelta = this.mode() === 'difference' && row.scenario !== this.baselineScenario();
    const prefix = isDelta && num > 0 ? '+' : '';

    switch (col.format) {
      case 'percent': return `${prefix}${num.toFixed(1)}%`;
      case 'integer': return `${prefix}${Math.round(num)}`;
      case 'probability': return `${prefix}${num.toPrecision(6)}`;
      case 'duration': return `${prefix}${num.toFixed(2)}s`;
      case 'number': return `${prefix}${num.toFixed(2)}`;
      default: return `${prefix}${num}`;
    }
  }

  getCellTooltip(row: ScenarioMetricRow, col: ProfileMetricDefinition): string {
    const val = row.metrics[col.key];
    if (val == null) return `${col.label}: No data for ${row.scenario}`;
    return `${col.label}: ${this.formatCellValue(row, col)} (${col.unit}) — Click to view in ${col.source} analysis`;
  }

  onCellClick(row: ScenarioMetricRow, col: ProfileMetricDefinition): void {
    this.cellClicked.emit({
      scenario: row.scenario,
      metricKey: col.key,
      source: col.source
    });
  }
}
