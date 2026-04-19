import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ScenarioAnalysisResult } from '../../../shared/models/system-profile.models';

@Component({
  selector: 'app-scenario-status-matrix',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule, MatChipsModule],
  template: `
    <mat-card class="status-matrix-card">
      <mat-card-content>
        <h4 class="section-title">
          <mat-icon>list_alt</mat-icon>
          Scenario Status
          <span class="scenario-count">{{ scenarioEntries().length }} scenarios</span>
        </h4>

        <div class="status-table-wrapper">
          <table class="status-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Analysis</th>
                <th>Data Type</th>
                <th>Status</th>
                <th class="right-align">Time</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of scenarioEntries(); track entry.name) {
              <tr class="scenario-row" (click)="scenarioClicked.emit(entry.name)" tabindex="0">
                <td class="scenario-name">{{ entry.name }}</td>
                <td>
                  <span class="analysis-chip" [class]="entry.result.analysisType">
                    {{ analysisLabel(entry.result.analysisType) }}
                  </span>
                </td>
                <td>
                  <span class="data-type-chip" [class]="entry.result.dataType">
                    {{ entry.result.dataType }}
                  </span>
                </td>
                <td>
                  @switch (entry.result.status) {
                    @case ('complete') {
                      <mat-icon class="status-icon success" matTooltip="Complete">check_circle</mat-icon>
                    }
                    @case ('partial') {
                      <mat-icon class="status-icon warning" matTooltip="Partial results">warning</mat-icon>
                    }
                    @case ('failed') {
                      <mat-icon class="status-icon error" matTooltip="Failed">error</mat-icon>
                    }
                  }
                </td>
                <td class="right-align computation-time">
                  {{ formatTime(entry.result.computationTime) }}
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .status-matrix-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);

      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--primary-color); }
    }

    .scenario-count {
      margin-left: auto;
      font-size: 0.8rem;
      font-weight: 400;
      color: var(--text-secondary);
    }

    .status-table-wrapper {
      overflow-x: auto;
    }

    .status-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;

      th {
        text-align: left;
        padding: 8px 12px;
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid var(--outline-variant);

        &.right-align { text-align: right; }
      }

      td {
        padding: 10px 12px;
        color: var(--text-primary);
        border-bottom: 1px solid var(--outline-variant);

        &.right-align { text-align: right; }
      }
    }

    .scenario-row {
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover { background: rgba(var(--primary-color-rgb), 0.06); }
      &:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
    }

    .scenario-name {
      font-weight: 500;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }

    .analysis-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;

      &.reachability { background: rgba(42, 161, 152, 0.15); color: #2aa198; }
      &.capacity { background: rgba(38, 139, 210, 0.15); color: #268bd2; }
      &.cpm { background: rgba(181, 137, 0, 0.15); color: #b58900; }
    }

    .data-type-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 500;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;

      &.float { background: rgba(133, 153, 0, 0.12); color: #859900; }
      &.interval { background: rgba(108, 113, 196, 0.12); color: #6c71c4; }
      &.pbox { background: rgba(211, 54, 130, 0.12); color: #d33682; }
    }

    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;

      &.success { color: #859900; }
      &.warning { color: #b58900; }
      &.error { color: #dc322f; }
    }

    .computation-time {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
  `]
})
export class ScenarioStatusMatrixComponent {
  scenarioResults = input.required<Map<string, ScenarioAnalysisResult>>();
  scenarioClicked = output<string>();

  scenarioEntries() {
    const map = this.scenarioResults();
    return Array.from(map.entries()).map(([name, result]) => ({ name, result }));
  }

  analysisLabel(type: string): string {
    switch (type) {
      case 'reachability': return 'Reachability';
      case 'capacity': return 'Capacity';
      case 'cpm': return 'CPM';
      default: return type;
    }
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}
