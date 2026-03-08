import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { CapacityV2Store } from '../capacity-v2.store';
import { CapacityV2DeterministicEntity } from '../capacity-v2.models';

interface ComparisonDetail {
  scenarioLabel: string;
  detail: CapacityV2DeterministicEntity | null;
}

@Component({
  selector: 'app-capacity-v2-comparison-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatListModule
  ],
  templateUrl: './capacity-v2-comparison-page.component.html',
  styleUrl: './capacity-v2-comparison-page.component.scss'
})
export class CapacityV2ComparisonPageComponent {
  readonly store = inject(CapacityV2Store);
  readonly selectedScenarios = signal<Set<string>>(new Set());

  readonly availableScenarios = computed(() => {
    return this.store.scenarioRunSnapshots().filter((snapshot) => snapshot.status === 'success');
  });

  readonly selectedDetails = computed<ComparisonDetail[]>(() => {
    const selected = this.selectedScenarios();
    const resultsMap = this.store.scenarioResults();

    return [...selected]
      .map((scenarioName) => {
        const snapshot = this.store
          .scenarioRunSnapshots()
          .find((s) => s.key === scenarioName);
        const result = resultsMap.get(scenarioName);

        let detail: CapacityV2DeterministicEntity | null = null;

        if (result && result.kind === 'deterministic' && result.deterministic) {
          detail = result.deterministic;
        } else if (result && result.kind === 'interval' && result.interval) {
          detail = result.interval.worstCase;
        }

        return {
          scenarioLabel: snapshot?.label ?? scenarioName,
          detail
        };
      })
      .filter((item) => item.detail !== null);
  });

  readonly canCompare = computed(() => this.selectedDetails().length >= 2);

  hasScenarioSelected(scenarioName: string): boolean {
    return this.selectedScenarios().has(scenarioName);
  }

  toggleScenarioSelection(scenarioName: string): void {
    const current = new Set(this.selectedScenarios());
    if (current.has(scenarioName)) {
      current.delete(scenarioName);
    } else {
      current.add(scenarioName);
    }
    this.selectedScenarios.set(current);
  }

  selectAll(): void {
    const all = new Set(this.availableScenarios().map((s) => s.key));
    this.selectedScenarios.set(all);
  }

  clearAll(): void {
    this.selectedScenarios.set(new Set());
  }

  getMaxFlow(detail: CapacityV2DeterministicEntity): number {
    const throughput = detail.summary?.throughput;
    return typeof throughput === 'number' ? throughput : throughput?.max ?? 0;
  }

  getComparativeMetric(
    detail: CapacityV2DeterministicEntity,
    metric: 'realistic' | 'classical' | 'efficiency' | 'utilization'
  ): number | null {
    switch (metric) {
      case 'realistic':
        return detail.comparative?.realisticMaxFlow ?? null;
      case 'classical':
        return detail.comparative?.classicalMaxFlow ?? null;
      case 'efficiency':
        return detail.comparative?.efficiencyLoss ?? null;
      case 'utilization':
        return detail.summary?.utilization ?? null;
      default:
        return null;
    }
  }

  getBottleneckSummary(detail: CapacityV2DeterministicEntity): string {
    const type = detail.bottlenecks?.bottleneckType ?? 'unknown';
    const minCut = detail.bottlenecks?.minCutCapacity ?? 0;
    const saturatedEdges = detail.bottlenecks?.saturatedEdges?.length ?? 0;
    const saturatedNodes = detail.bottlenecks?.saturatedNodes?.length ?? 0;

    return `${type} (min-cut: ${minCut.toFixed(1)}, ${saturatedEdges} edges, ${saturatedNodes} nodes)`;
  }
}
