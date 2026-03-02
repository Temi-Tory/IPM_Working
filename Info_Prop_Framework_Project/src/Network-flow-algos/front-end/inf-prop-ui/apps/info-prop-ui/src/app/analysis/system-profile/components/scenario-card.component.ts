import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ScenarioMetricRow,
  AggregatedMetrics,
  ProfileMetricDefinition,
  PROFILE_METRICS
} from '../../../shared/models/system-profile.models';

@Component({
  selector: 'app-scenario-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  template: `
    <mat-card class="scenario-card">
      <mat-card-content>
        <!-- Header: scenario name + data type badge -->
        <div class="card-header">
          <span class="scenario-name">{{ row().scenario }}</span>
          <span class="data-type-badge" [class]="'badge-' + row().dataType">
            {{ row().dataType }}
          </span>
        </div>

        <!-- Analysis type chips -->
        <div class="analysis-chips">
          @for (type of row().analysisTypes; track type) {
            <span class="analysis-chip" [class]="'chip-' + type">{{ type }}</span>
          }
        </div>

        <!-- Metric bars -->
        <div class="metric-bars">
          @for (metric of activeMetrics(); track metric.def.key) {
            <div class="metric-row" [matTooltip]="metric.tooltip">
              <span class="metric-label">{{ metric.def.shortLabel }}</span>
              <div class="bar-track">
                <div class="bar-fill"
                     [style.width.%]="metric.barPercent"
                     [style.background]="metric.barColor">
                </div>
              </div>
              <span class="metric-value">{{ metric.displayValue }}</span>
            </div>
          }
        </div>

        @if (activeMetrics().length === 0) {
          <div class="no-metrics">No metrics available</div>
        }

        <!-- Computation time -->
        <div class="card-footer">
          <mat-icon>schedule</mat-icon>
          {{ formatTime(row().computationTime) }}
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .scenario-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        border-color: var(--primary-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .scenario-name {
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9rem;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .data-type-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      &.badge-float { background: rgba(38, 139, 210, 0.15); color: #268bd2; }
      &.badge-interval { background: rgba(133, 153, 0, 0.15); color: #859900; }
      &.badge-pbox { background: rgba(211, 54, 130, 0.15); color: #d33682; }
    }

    .analysis-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .analysis-chip {
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;

      &.chip-reachability { background: rgba(42, 161, 152, 0.15); color: #2aa198; }
      &.chip-capacity { background: rgba(181, 137, 0, 0.15); color: #b58900; }
      &.chip-cpm { background: rgba(108, 113, 196, 0.15); color: #6c71c4; }
    }

    .metric-bars {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .metric-row {
      display: grid;
      grid-template-columns: 70px 1fr 60px;
      align-items: center;
      gap: 8px;
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bar-track {
      height: 14px;
      background: var(--outline-variant);
      border-radius: 7px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 7px;
      transition: width 0.4s ease;
      min-width: 2px;
    }

    .metric-value {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-primary);
      text-align: right;
      white-space: nowrap;
    }

    .no-metrics {
      color: var(--text-secondary);
      font-size: 0.8rem;
      text-align: center;
      padding: 12px 0;
    }

    .card-footer {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 10px;
      font-size: 0.72rem;
      color: var(--text-secondary);

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }
  `]
})
export class ScenarioCardComponent {
  row = input.required<ScenarioMetricRow>();
  aggregatedMetrics = input.required<AggregatedMetrics>();

  activeMetrics = computed(() => {
    const r = this.row();
    const agg = this.aggregatedMetrics();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    return PROFILE_METRICS
      .filter(def => {
        const val = r.metrics[def.key];
        return val != null && typeof val === 'number' && isFinite(val);
      })
      .map(def => {
        const val = r.metrics[def.key] as number;
        const range = agg.metricRanges[def.key];

        let barPercent = 50;
        if (range && range.max !== range.min) {
          barPercent = ((val - range.min) / (range.max - range.min)) * 100;
        } else if (range) {
          barPercent = 50;
        }
        barPercent = Math.max(2, Math.min(100, barPercent));

        const goodness = def.higherIsBetter ? barPercent / 100 : 1 - barPercent / 100;
        const barColor = this.getBarColor(goodness, isDark);

        return {
          def,
          barPercent,
          barColor,
          displayValue: this.formatValue(val, def),
          tooltip: `${def.label}: ${this.formatValue(val, def)} (${def.unit})`
        };
      });
  });

  private getBarColor(goodness: number, isDark: boolean): string {
    // Green for good, yellow for neutral, red for bad
    if (goodness >= 0.65) {
      return isDark ? 'rgba(133, 153, 0, 0.7)' : 'rgba(133, 153, 0, 0.6)';
    } else if (goodness >= 0.35) {
      return isDark ? 'rgba(181, 137, 0, 0.65)' : 'rgba(181, 137, 0, 0.5)';
    } else {
      return isDark ? 'rgba(220, 50, 47, 0.6)' : 'rgba(220, 50, 47, 0.45)';
    }
  }

  private formatValue(val: number, def: ProfileMetricDefinition): string {
    switch (def.format) {
      case 'percent': return `${val.toFixed(1)}%`;
      case 'integer': return `${Math.round(val)}`;
      case 'probability': return val.toPrecision(6);
      case 'duration': return `${val.toFixed(2)}s`;
      case 'number': return val.toFixed(2);
      default: return `${val}`;
    }
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}
