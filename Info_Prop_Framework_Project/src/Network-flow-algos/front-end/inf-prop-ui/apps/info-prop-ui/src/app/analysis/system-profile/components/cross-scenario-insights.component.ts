import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  ScenarioMetricRow,
  AggregatedMetrics
} from '../../../shared/models/system-profile.models';

interface Insight {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'good';
}

interface InsightGroup {
  title: string;
  icon: string;
  insights: Insight[];
}

@Component({
  selector: 'app-cross-scenario-insights',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card class="insights-card">
      <mat-card-content>
        <h4 class="section-title">
          <mat-icon>psychology</mat-icon>
          Cross-Scenario Insights
        </h4>

        @if (insights().length === 0) {
          <div class="no-insights">
            <mat-icon>lightbulb_outline</mat-icon>
            <span>Run more scenarios to see cross-scenario observations</span>
          </div>
        } @else {
          @for (group of insights(); track group.title) {
            <div class="insight-group">
              <div class="group-header">
                <mat-icon>{{ group.icon }}</mat-icon>
                <span>{{ group.title }}</span>
              </div>
              <div class="insight-list">
                @for (insight of group.insights; track insight.text) {
                  <div class="insight-item" [class]="insight.severity">
                    <mat-icon class="insight-icon">{{ insight.icon }}</mat-icon>
                    <span class="insight-text">{{ insight.text }}</span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .insights-card {
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

    .no-insights {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      color: var(--text-secondary);
      font-style: italic;

      mat-icon { font-size: 24px; width: 24px; height: 24px; opacity: 0.5; }
    }

    .insight-group {
      margin-bottom: 16px;

      &:last-child { margin-bottom: 0; }
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .insight-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .insight-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      line-height: 1.4;
      border-left: 3px solid transparent;

      &.info {
        background: rgba(38, 139, 210, 0.08);
        border-left-color: #268bd2;
        .insight-icon { color: #268bd2; }
      }

      &.warning {
        background: rgba(181, 137, 0, 0.08);
        border-left-color: #b58900;
        .insight-icon { color: #b58900; }
      }

      &.good {
        background: rgba(133, 153, 0, 0.08);
        border-left-color: #859900;
        .insight-icon { color: #859900; }
      }
    }

    .insight-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .insight-text {
      color: var(--text-primary);
    }
  `]
})
export class CrossScenarioInsightsComponent {
  rows = input.required<ScenarioMetricRow[]>();
  aggregatedMetrics = input.required<AggregatedMetrics>();

  insights = computed((): InsightGroup[] => {
    const rows = this.rows();
    if (rows.length === 0) return [];

    const groups: InsightGroup[] = [];

    // ─── Coverage Summary ───
    const coverageInsights = this.generateCoverageInsights(rows);
    if (coverageInsights.length > 0) {
      groups.push({ title: 'Analysis Coverage', icon: 'inventory_2', insights: coverageInsights });
    }

    // ─── Reachability Insights ───
    const reachRows = rows.filter(r => r.analysisTypes.includes('reachability'));
    if (reachRows.length > 0) {
      const rInsights = this.generateReachabilityInsights(reachRows);
      if (rInsights.length > 0) {
        groups.push({ title: 'Reachability', icon: 'scatter_plot', insights: rInsights });
      }
    }

    // ─── Capacity Insights ───
    const capRows = rows.filter(r => r.analysisTypes.includes('capacity'));
    if (capRows.length > 0) {
      const cInsights = this.generateCapacityInsights(capRows);
      if (cInsights.length > 0) {
        groups.push({ title: 'Capacity', icon: 'speed', insights: cInsights });
      }
    }

    // ─── CPM Insights ───
    const cpmRows = rows.filter(r => r.analysisTypes.includes('cpm'));
    if (cpmRows.length > 0) {
      const tInsights = this.generateCpmInsights(cpmRows);
      if (tInsights.length > 0) {
        groups.push({ title: 'CPM Time / Cost', icon: 'timeline', insights: tInsights });
      }
    }

    return groups;
  });

  // ─── Coverage ───

  private generateCoverageInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];

    const dataTypeCounts: Record<string, number> = {};
    const analysisTypeCounts: Record<string, number> = {};

    for (const row of rows) {
      dataTypeCounts[row.dataType] = (dataTypeCounts[row.dataType] || 0) + 1;
      for (const at of row.analysisTypes) {
        analysisTypeCounts[at] = (analysisTypeCounts[at] || 0) + 1;
      }
    }

    const dtParts = Object.entries(dataTypeCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    const atParts = Object.entries(analysisTypeCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    insights.push({
      icon: 'inventory_2',
      text: `${rows.length} scenarios analysed: ${dtParts}`,
      severity: 'info'
    });

    if (Object.keys(analysisTypeCounts).length > 1) {
      insights.push({
        icon: 'category',
        text: `Analysis types: ${atParts}`,
        severity: 'info'
      });
    }

    return insights;
  }

  // ─── Reachability ───

  private generateReachabilityInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];

    const beliefValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['meanBelief'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (beliefValues.length >= 2) {
      const sorted = [...beliefValues].sort((a, b) => b.value - a.value);
      insights.push({
        icon: 'compare',
        text: `Mean belief: highest ${sorted[0].scenario} (${sorted[0].value.toPrecision(6)}), lowest ${sorted[sorted.length - 1].scenario} (${sorted[sorted.length - 1].value.toPrecision(6)})`,
        severity: sorted[sorted.length - 1].value < 0.5 ? 'warning' : 'info'
      });

      if (sorted.length >= 3) {
        const progression = sorted.map(v => `${v.value.toPrecision(6)} (${v.scenario})`).join(' > ');
        insights.push({
          icon: 'trending_down',
          text: `Belief ranking: ${progression}`,
          severity: 'info'
        });
      }
    } else if (beliefValues.length === 1) {
      insights.push({
        icon: 'analytics',
        text: `${beliefValues[0].scenario}: mean belief ${beliefValues[0].value.toPrecision(6)}`,
        severity: beliefValues[0].value >= 0.7 ? 'good' : beliefValues[0].value >= 0.4 ? 'info' : 'warning'
      });
    }

    // Belief spread
    const spreadValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['beliefSpread'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (spreadValues.length >= 1) {
      const maxSpread = spreadValues.reduce((a, b) => (a.value > b.value ? a : b));
      if (maxSpread.value > 0.3) {
        insights.push({
          icon: 'warning',
          text: `High uncertainty in ${maxSpread.scenario} (spread ${maxSpread.value.toPrecision(6)}) — beliefs vary widely across nodes`,
          severity: 'warning'
        });
      }
    }

    return insights;
  }

  // ─── Capacity ───

  private generateCapacityInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];

    const utilValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['networkUtilization'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (utilValues.length >= 2) {
      const sorted = [...utilValues].sort((a, b) => a.value - b.value);
      const progression = sorted.map(d => `${(d.value * 100).toFixed(1)}% (${d.scenario})`).join(' < ');
      insights.push({
        icon: 'speed',
        text: `Utilisation: ${progression}`,
        severity: sorted[sorted.length - 1].value > 0.9 ? 'warning' : 'info'
      });
    } else if (utilValues.length === 1) {
      insights.push({
        icon: 'speed',
        text: `${utilValues[0].scenario}: ${(utilValues[0].value * 100).toFixed(1)}% network utilisation`,
        severity: utilValues[0].value > 0.9 ? 'warning' : utilValues[0].value > 0.7 ? 'info' : 'good'
      });
    }

    // Bottleneck progression
    const bnValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['bottleneckCount'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (bnValues.length >= 2) {
      const sorted = [...bnValues].sort((a, b) => a.value - b.value);
      if (sorted[sorted.length - 1].value > 0) {
        const progression = sorted.map(d => `${d.value} (${d.scenario})`).join(' < ');
        insights.push({
          icon: 'block',
          text: `Bottleneck count: ${progression}`,
          severity: sorted[sorted.length - 1].value > 3 ? 'warning' : 'info'
        });
      } else {
        insights.push({
          icon: 'check_circle',
          text: 'No bottlenecks detected in any capacity scenario',
          severity: 'good'
        });
      }
    }

    return insights;
  }

  // ─── CPM ───

  private generateCpmInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];

    const durationValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['criticalPathDuration'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (durationValues.length >= 2) {
      const sorted = [...durationValues].sort((a, b) => a.value - b.value);
      const fastest = sorted[0];
      const slowest = sorted[sorted.length - 1];
      insights.push({
        icon: 'timer',
        text: `Critical path: shortest ${fastest.scenario} (${fastest.value.toFixed(1)}), longest ${slowest.scenario} (${slowest.value.toFixed(1)})`,
        severity: 'info'
      });

      if (fastest.value > 0) {
        const pctDiff = ((slowest.value - fastest.value) / fastest.value * 100).toFixed(0);
        insights.push({
          icon: 'trending_up',
          text: `${slowest.scenario} is ${pctDiff}% longer than ${fastest.scenario}`,
          severity: 'info'
        });
      }
    }

    // Slack comparison
    const slackValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['totalSlack'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (slackValues.length >= 2) {
      const sorted = [...slackValues].sort((a, b) => b.value - a.value);
      insights.push({
        icon: 'schedule',
        text: `Most scheduling flexibility: ${sorted[0].scenario} (slack ${sorted[0].value.toFixed(1)}), least: ${sorted[sorted.length - 1].scenario} (${sorted[sorted.length - 1].value.toFixed(1)})`,
        severity: sorted[sorted.length - 1].value <= 0 ? 'warning' : 'info'
      });
    }

    return insights;
  }
}
