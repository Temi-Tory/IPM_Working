import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  ScenarioMetricRow,
  AggregatedMetrics,
  PROFILE_METRICS
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
  imports: [CommonModule, MatCardModule, MatIconModule, MatExpansionModule],
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
          <mat-accordion class="insights-accordion" multi="true">
            @for (group of insights(); track group.title) {
              <mat-expansion-panel class="insight-panel" [expanded]="group.title === 'Pareto & Trade-offs' || group.title === 'Scenario Stability'">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <div class="group-header">
                      <mat-icon>{{ group.icon }}</mat-icon>
                      <span>{{ group.title }}</span>
                    </div>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="insight-list">
                  @for (insight of group.insights; track insight.text) {
                    <div class="insight-item" [class]="insight.severity">
                      <mat-icon class="insight-icon">{{ insight.icon }}</mat-icon>
                      <span class="insight-text">{{ insight.text }}</span>
                    </div>
                  }
                </div>
              </mat-expansion-panel>
            }
          </mat-accordion>
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

    .insights-accordion {
      display: block;
    }

    .insight-panel {
      margin-bottom: 10px;
      background: color-mix(in srgb, var(--surface-container) 90%, transparent);
      border: 1px solid var(--outline-variant);
      border-radius: 8px;

      &:last-child { margin-bottom: 0; }
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 0;
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

    const gapInsights = this.generateCoverageGapInsights(rows);
    if (gapInsights.length > 0) {
      groups.push({ title: 'Coverage Gaps', icon: 'rule', insights: gapInsights });
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

    const paretoInsights = this.generateParetoInsights(rows);
    if (paretoInsights.length > 0) {
      groups.push({ title: 'Pareto & Trade-offs', icon: 'polyline', insights: paretoInsights });
    }

    const sensitivityInsights = this.generateDataTypeSensitivityInsights(rows);
    if (sensitivityInsights.length > 0) {
      groups.push({ title: 'Data Type Sensitivity', icon: 'tune', insights: sensitivityInsights });
    }

    const stabilityInsights = this.generateStabilityInsights(rows);
    if (stabilityInsights.length > 0) {
      groups.push({ title: 'Scenario Stability', icon: 'query_stats', insights: stabilityInsights });
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

  private generateCoverageGapInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];
    const requiredTypes = ['reachability', 'capacity', 'cpm'];

    for (const row of rows) {
      const missing = requiredTypes.filter(type => !row.analysisTypes.includes(type));
      if (missing.length > 0) {
        insights.push({
          icon: 'warning',
          text: `${row.scenario} missing: ${missing.join(', ')}`,
          severity: missing.length >= 2 ? 'warning' : 'info'
        });
      }
    }

    const sparseMetrics = rows
      .map(r => {
        const availableCount = Object.values(r.metrics).filter(v => typeof v === 'number').length;
        return { scenario: r.scenario, availableCount };
      })
      .sort((a, b) => a.availableCount - b.availableCount);

    if (sparseMetrics.length > 1) {
      const min = sparseMetrics[0];
      const max = sparseMetrics[sparseMetrics.length - 1];
      if (min.availableCount < max.availableCount) {
        insights.push({
          icon: 'table_view',
          text: `${min.scenario} has the sparsest metric coverage (${min.availableCount} numeric metrics)`,
          severity: min.availableCount < 4 ? 'warning' : 'info'
        });
      }
    }

    return insights.slice(0, 5);
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
        text: `Mean belief: highest ${sorted[0].scenario} (${sorted[0].value.toFixed(4)}), lowest ${sorted[sorted.length - 1].scenario} (${sorted[sorted.length - 1].value.toFixed(4)})`,
        severity: sorted[sorted.length - 1].value < 0.5 ? 'warning' : 'info'
      });

      if (sorted.length >= 3) {
        const progression = sorted.map(v => `${v.value.toFixed(4)} (${v.scenario})`).join(' > ');
        insights.push({
          icon: 'trending_down',
          text: `Belief ranking: ${progression}`,
          severity: 'info'
        });
      }
    } else if (beliefValues.length === 1) {
      insights.push({
        icon: 'analytics',
        text: `${beliefValues[0].scenario}: mean belief ${beliefValues[0].value.toFixed(4)}`,
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
          text: `High uncertainty in ${maxSpread.scenario} (spread ${maxSpread.value.toFixed(4)}) — beliefs vary widely across nodes`,
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
      const progression = sorted.map(d => `${d.value.toFixed(1)}% (${d.scenario})`).join(' < ');
      insights.push({
        icon: 'speed',
        text: `Utilisation: ${progression}`,
        severity: sorted[sorted.length - 1].value > 90 ? 'warning' : 'info'
      });
    } else if (utilValues.length === 1) {
      insights.push({
        icon: 'speed',
        text: `${utilValues[0].scenario}: ${utilValues[0].value.toFixed(1)}% network utilisation`,
        severity: utilValues[0].value > 90 ? 'warning' : utilValues[0].value > 70 ? 'info' : 'good'
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

    const captureValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['throughputCaptureRatio'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (captureValues.length >= 2) {
      const sorted = [...captureValues].sort((a, b) => b.value - a.value);
      insights.push({
        icon: 'call_received',
        text: `Flow capture: best ${sorted[0].scenario} (${(sorted[0].value * 100).toFixed(1)}%), worst ${sorted[sorted.length - 1].scenario} (${(sorted[sorted.length - 1].value * 100).toFixed(1)}%)`,
        severity: sorted[sorted.length - 1].value < 0.7 ? 'warning' : 'info'
      });
    }

    const effLossValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['efficiencyLoss'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (effLossValues.length >= 1) {
      const worst = effLossValues.reduce((a, b) => (a.value > b.value ? a : b));
      if (worst.value > 0.2) {
        insights.push({
          icon: 'warning',
          text: `Highest capacity efficiency loss: ${worst.scenario} (${(worst.value * 100).toFixed(1)}%)`,
          severity: worst.value > 0.35 ? 'warning' : 'info'
        });
      }
    }

    const upgradePressureValues = rows
      .map(r => ({ scenario: r.scenario, value: r.metrics['upgradePressure'] }))
      .filter((v): v is { scenario: string; value: number } => typeof v.value === 'number');

    if (upgradePressureValues.length >= 1) {
      const mostPressured = upgradePressureValues.reduce((a, b) => (a.value > b.value ? a : b));
      if (mostPressured.value > 0) {
        insights.push({
          icon: 'build',
          text: `Optimization hotspot: ${mostPressured.scenario} has ${mostPressured.value} prioritized upgrades`,
          severity: mostPressured.value >= 4 ? 'warning' : 'info'
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

  private generateParetoInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];

    const capRows = rows
      .map(row => ({
        scenario: row.scenario,
        throughput: row.metrics['capacityThroughput'],
        utilization: row.metrics['networkUtilization']
      }))
      .filter((row): row is { scenario: string; throughput: number; utilization: number } =>
        typeof row.throughput === 'number' && typeof row.utilization === 'number'
      );

    if (capRows.length >= 2) {
      const frontier = capRows.filter(candidate =>
        !capRows.some(other =>
          other.scenario !== candidate.scenario &&
          other.throughput >= candidate.throughput &&
          other.utilization <= candidate.utilization &&
          (other.throughput > candidate.throughput || other.utilization < candidate.utilization)
        )
      );

      insights.push({
        icon: 'timeline',
        text: `Throughput/utilisation Pareto frontier: ${frontier.map(s => s.scenario).join(', ')}`,
        severity: frontier.length <= 2 ? 'good' : 'info'
      });

      const bestThroughput = [...capRows].sort((a, b) => b.throughput - a.throughput)[0];
      const bestUtilization = [...capRows].sort((a, b) => a.utilization - b.utilization)[0];
      if (bestThroughput.scenario !== bestUtilization.scenario) {
        insights.push({
          icon: 'swap_horiz',
          text: `Trade-off: ${bestThroughput.scenario} maximizes throughput while ${bestUtilization.scenario} minimizes utilization`,
          severity: 'info'
        });
      }
    }

    const reachRows = rows
      .map(row => ({ scenario: row.scenario, belief: row.metrics['meanBelief'], time: row.metrics['computationTime'] }))
      .filter((row): row is { scenario: string; belief: number; time: number } =>
        typeof row.belief === 'number' && typeof row.time === 'number'
      );

    if (reachRows.length >= 2) {
      const bestBelief = [...reachRows].sort((a, b) => b.belief - a.belief)[0];
      const bestTime = [...reachRows].sort((a, b) => a.time - b.time)[0];
      if (bestBelief.scenario !== bestTime.scenario) {
        insights.push({
          icon: 'compare_arrows',
          text: `Belief/time trade-off: ${bestBelief.scenario} gives highest belief; ${bestTime.scenario} runs fastest`,
          severity: 'info'
        });
      }
    }

    return insights;
  }

  private generateDataTypeSensitivityInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];
    const metricCandidates = ['meanBelief', 'capacityThroughput', 'criticalPathDuration'];

    for (const metricKey of metricCandidates) {
      const winnersByType = new Map<string, string>();
      const higherIsBetter = PROFILE_METRICS.find(m => m.key === metricKey)?.higherIsBetter ?? true;

      const byType = new Map<string, Array<{ scenario: string; value: number }>>();
      for (const row of rows) {
        const val = row.metrics[metricKey];
        if (typeof val !== 'number') continue;
        if (!byType.has(row.dataType)) byType.set(row.dataType, []);
        byType.get(row.dataType)!.push({ scenario: row.scenario, value: val });
      }

      for (const [type, values] of byType.entries()) {
        if (values.length === 0) continue;
        const ordered = [...values].sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value);
        winnersByType.set(type, ordered[0].scenario);
      }

      if (winnersByType.size >= 2) {
        const winnerSet = new Set(winnersByType.values());
        if (winnerSet.size > 1) {
          const summary = Array.from(winnersByType.entries())
            .map(([type, scenario]) => `${type}: ${scenario}`)
            .join(' | ');
          insights.push({
            icon: 'science',
            text: `Data-type sensitivity on ${metricKey}: ${summary}`,
            severity: 'warning'
          });
        }
      }
    }

    return insights;
  }

  private generateStabilityInsights(rows: ScenarioMetricRow[]): Insight[] {
    const insights: Insight[] = [];
    const winCounts = new Map<string, number>();
    let evaluatedMetrics = 0;

    for (const metric of PROFILE_METRICS) {
      const values = rows
        .map(row => ({ scenario: row.scenario, value: row.metrics[metric.key] }))
        .filter((item): item is { scenario: string; value: number } => typeof item.value === 'number');

      if (values.length < 2) continue;
      evaluatedMetrics += 1;

      const ordered = [...values].sort((a, b) => metric.higherIsBetter ? b.value - a.value : a.value - b.value);
      const winner = ordered[0].scenario;
      winCounts.set(winner, (winCounts.get(winner) ?? 0) + 1);
    }

    if (winCounts.size > 0 && evaluatedMetrics > 0) {
      const ranked = Array.from(winCounts.entries()).sort((a, b) => b[1] - a[1]);
      const [topScenario, wins] = ranked[0];
      const stability = (wins / evaluatedMetrics) * 100;
      insights.push({
        icon: 'workspace_premium',
        text: `Most stable top performer: ${topScenario} leads ${wins}/${evaluatedMetrics} metrics (${stability.toFixed(0)}%)`,
        severity: stability >= 50 ? 'good' : 'info'
      });

      if (ranked.length > 1) {
        const spread = ranked.slice(0, 3).map(([scenario, count]) => `${scenario}(${count})`).join(', ');
        insights.push({
          icon: 'leaderboard',
          text: `Top-metric winners distribution: ${spread}`,
          severity: 'info'
        });
      }
    }

    return insights;
  }
}
