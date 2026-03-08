import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CapacityV2Store } from '../capacity-v2.store';

interface ScenarioComparisonRow {
  scenarioName: string;
  scenarioLabel: string;
  status: string;
  bottleneckType: string | null;
  utilization: number | null;
  efficiencyLoss: number | null;
  primaryLimitation: string | null;
}

interface ComparisonDetail {
  scenarioLabel: string;
  detail: any | null;
}

@Component({
  selector: 'app-capacity-v2-performance-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatTabsModule,
    MatCheckboxModule
  ],
  templateUrl: './capacity-v2-performance-page.component.html',
  styleUrl: './capacity-v2-performance-page.component.scss'
})
export class CapacityV2PerformancePageComponent {
  readonly store = inject(CapacityV2Store);
  readonly selectedComparisonScenarios = signal<Set<string>>(new Set());

  readonly scenarioComparisons = computed<ScenarioComparisonRow[]>(() => {
    const snapshots = this.store.scenarioRunSnapshots();
    const resultsMap = this.store.scenarioResults();

    return snapshots.map((snapshot) => {
      const scenarioResult = resultsMap.get(snapshot.key);
      let bottleneckType: string | null = null;
      let utilization: number | null = null;
      let efficiencyLoss: number | null = null;
      let primaryLimitation: string | null = null;

      if (scenarioResult && scenarioResult.kind === 'deterministic' && scenarioResult.deterministic) {
        const detail = scenarioResult.deterministic;
        bottleneckType = detail.bottlenecks?.bottleneckType ?? null;
        utilization = detail.summary?.utilization ?? null;
        efficiencyLoss = detail.comparative?.efficiencyLoss ?? null;
        primaryLimitation = detail.comparative?.primaryLimitation ?? null;
      } else if (
        scenarioResult &&
        scenarioResult.kind === 'interval' &&
        scenarioResult.interval
      ) {
        const detail = scenarioResult.interval.worstCase;
        bottleneckType = detail.bottlenecks?.bottleneckType ?? null;
        utilization = detail.summary?.utilization ?? null;
        efficiencyLoss = detail.comparative?.efficiencyLoss ?? null;
        primaryLimitation = detail.comparative?.primaryLimitation ?? null;
      }

      return {
        scenarioName: snapshot.key,
        scenarioLabel: snapshot.label,
        status: snapshot.status,
        bottleneckType,
        utilization,
        efficiencyLoss,
        primaryLimitation
      };
    });
  });

  readonly availableComparisonScenarios = computed(() => {
    return this.store.scenarioRunSnapshots().filter((snapshot) => snapshot.status === 'success');
  });

  readonly comparisonDetails = computed<ComparisonDetail[]>(() => {
    const selected = this.selectedComparisonScenarios();
    const resultsMap = this.store.scenarioResults();

    return [...selected]
      .map((scenarioName) => {
        const snapshot = this.store
          .scenarioRunSnapshots()
          .find((s) => s.key === scenarioName);
        const result = resultsMap.get(scenarioName);

        let detail: any = null;

        if (result && result.kind === 'deterministic' && result.deterministic) {
          detail = result.deterministic;
        } else if (result && result.kind === 'interval' && result.interval) {
          detail = result.interval.worstCase;
        }

        return {
          scenarioLabel: snapshot?.label ?? scenarioName,
          detail
        };
      });
  });

  readonly canCompare = computed(() => this.selectedComparisonScenarios().size >= 2);

  hasMeaningfulEfficiencyLoss(value: number | null | undefined): boolean {
    return typeof value === 'number' && value > 0.0001;
  }

  toggleScenarioSelection(scenarioName: string): void {
    const current = this.selectedComparisonScenarios();
    const newSet = new Set(current);
    if (newSet.has(scenarioName)) {
      newSet.delete(scenarioName);
    } else {
      newSet.add(scenarioName);
    }
    this.selectedComparisonScenarios.set(newSet);
  }

  hasScenarioSelected(scenarioName: string): boolean {
    return this.selectedComparisonScenarios().has(scenarioName);
  }

  selectAll(): void {
    const all = new Set(this.availableComparisonScenarios().map((s) => s.key));
    this.selectedComparisonScenarios.set(all);
  }

  clearAll(): void {
    this.selectedComparisonScenarios.set(new Set());
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getBottleneckTypeClass(bottleneckType: string): string {
    const classMap: { [key: string]: string } = {
      'edge': 'bottleneck-edge',
      'node': 'bottleneck-node',
      'combined': 'bottleneck-combined'
    };
    return classMap[bottleneckType.toLowerCase()] || 'bottleneck-unknown';
  }

  getEfficiencyBadgeClass(efficiencyLoss: number): string {
    if (efficiencyLoss > 0.3) return 'efficiency-critical';
    if (efficiencyLoss > 0.1) return 'efficiency-warning';
    return 'efficiency-ok';
  }

  runRemaining(): void {
    // Run remaining scenarios
    this.store.runRemainingScenarios();
  }

  getThroughputValue(throughput: number | { max: number; min: number }): number {
    return typeof throughput === 'number' ? throughput : throughput.max;
  }
}
