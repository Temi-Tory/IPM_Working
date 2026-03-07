import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CapacityV2Store } from './capacity-v2.store';
import { 
  CapacityV2FlowEdge, 
  CapacityV2FlowNode,
  CapacityV2UpgradeRecommendationEdge,
  CapacityV2UpgradeRecommendationNode,
  CapacityV2Interval
} from './capacity-v2.models';

@Component({
  selector: 'app-capacity-v2-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatTabsModule, MatChipsModule, MatCheckboxModule],
  templateUrl: './capacity-v2-tabs.component.html',
  styleUrl: './capacity-v2-tabs.component.scss'
})
export class CapacityV2TabsComponent {
  readonly store = inject(CapacityV2Store);
  showAllUpgrades = false;

  getThroughputPercentage(value: number, throughput: number | CapacityV2Interval): number {
    const throughputValue = typeof throughput === 'number' ? throughput : throughput.max;
    return throughputValue > 0 ? value / throughputValue : 0;
  }

  readonly uncertainComponents = computed(() => {
    const current = this.store.result();
    if (!current || current.kind !== 'interval') {
      return [];
    }

    return current.interval.componentsMostUncertain;
  });

  readonly filteredEdgeUpgrades = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];
    
    const upgrades = detail.upgrades.edgePriorities;

    if (this.showAllUpgrades) {
      return upgrades;
    }

    return upgrades.filter((edge: CapacityV2UpgradeRecommendationEdge) => 
      !edge.rationale.includes('No immediate upgrade needed')
    );
  });

  readonly filteredNodeUpgrades = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];
    
    const upgrades = detail.upgrades.nodePriorities;

    if (this.showAllUpgrades) {
      return upgrades;
    }

    return upgrades.filter((node: CapacityV2UpgradeRecommendationNode) => 
      !node.rationale.includes('No immediate upgrade needed')
    );
  });

  onShowAllUpgradesChange(): void {
    // Trigger computed signal recalculation by updating the property
    // (Angular will automatically recompute the signals)
  }

  nodeUtilization(node: CapacityV2FlowNode): number {
    return node.utilization > 0 ? node.utilization : 0;
  }

  edgeUtilization(edge: CapacityV2FlowEdge): number {
    return edge.utilization > 0 ? edge.utilization : 0;
  }

  asEdgeLabel(edge: [number, number]): string {
    return `${edge[0]} -> ${edge[1]}`;
  }
}
