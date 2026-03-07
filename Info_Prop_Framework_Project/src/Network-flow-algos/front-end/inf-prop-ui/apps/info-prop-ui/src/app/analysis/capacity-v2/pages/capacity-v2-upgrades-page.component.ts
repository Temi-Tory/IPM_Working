import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CapacityV2Store } from '../capacity-v2.store';
import { CapacityV2UpgradeRecommendationEdge, CapacityV2UpgradeRecommendationNode } from '../capacity-v2.models';

type SortDirection = 'asc' | 'desc';
type EdgeSortField = 'edge' | 'priorityScore' | 'expectedFlowIncrease' | 'rationale';
type NodeSortField = 'node' | 'priorityScore' | 'expectedFlowIncrease' | 'rationale';

@Component({
  selector: 'app-capacity-v2-upgrades-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatCheckboxModule, MatIconModule, MatPaginatorModule],
  templateUrl: './capacity-v2-upgrades-page.component.html',
  styleUrl: './capacity-v2-upgrades-page.component.scss'
})
export class CapacityV2UpgradesPageComponent {
  readonly store = inject(CapacityV2Store);
  readonly showAllUpgrades = signal(false);
  readonly edgeSearchTerm = signal('');
  readonly nodeSearchTerm = signal('');
  readonly edgeSortField = signal<EdgeSortField>('priorityScore');
  readonly edgeSortDirection = signal<SortDirection>('desc');
  readonly nodeSortField = signal<NodeSortField>('priorityScore');
  readonly nodeSortDirection = signal<SortDirection>('desc');
  readonly edgePageIndex = signal(0);
  readonly edgePageSize = signal(10);
  readonly nodePageIndex = signal(0);
  readonly nodePageSize = signal(10);

  readonly filteredEdgeUpgrades = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const base = this.showAllUpgrades()
      ? detail.upgrades.edgePriorities
      : detail.upgrades.edgePriorities.filter((e: CapacityV2UpgradeRecommendationEdge) => this.isUpgradeNeeded(e));

    const term = this.edgeSearchTerm().trim().toLowerCase();
    if (!term) {
      return base;
    }

    return base.filter((item) => {
      const edgeLabel = this.asEdgeLabel(item.edge).toLowerCase();
      const rationale = item.rationale.toLowerCase();
      return edgeLabel.includes(term) || rationale.includes(term);
    });
  });

  readonly sortedEdgeUpgrades = computed(() => {
    const field = this.edgeSortField();
    const direction = this.edgeSortDirection();
    const factor = direction === 'asc' ? 1 : -1;

    return [...this.filteredEdgeUpgrades()].sort((a, b) => {
      const aValue = this.getEdgeSortValue(a, field);
      const bValue = this.getEdgeSortValue(b, field);
      return this.compareValues(aValue, bValue) * factor;
    });
  });

  readonly pagedEdgeUpgrades = computed(() => {
    const pageIndex = this.edgePageIndex();
    const pageSize = this.edgePageSize();
    const start = pageIndex * pageSize;
    return this.sortedEdgeUpgrades().slice(start, start + pageSize);
  });

  readonly filteredNodeUpgrades = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const base = this.showAllUpgrades()
      ? detail.upgrades.nodePriorities
      : detail.upgrades.nodePriorities.filter((n: CapacityV2UpgradeRecommendationNode) => this.isUpgradeNeeded(n));

    const term = this.nodeSearchTerm().trim().toLowerCase();
    if (!term) {
      return base;
    }

    return base.filter((item) => {
      const node = String(item.node).toLowerCase();
      const rationale = item.rationale.toLowerCase();
      return node.includes(term) || rationale.includes(term);
    });
  });

  readonly sortedNodeUpgrades = computed(() => {
    const field = this.nodeSortField();
    const direction = this.nodeSortDirection();
    const factor = direction === 'asc' ? 1 : -1;

    return [...this.filteredNodeUpgrades()].sort((a, b) => {
      const aValue = this.getNodeSortValue(a, field);
      const bValue = this.getNodeSortValue(b, field);
      return this.compareValues(aValue, bValue) * factor;
    });
  });

  readonly pagedNodeUpgrades = computed(() => {
    const pageIndex = this.nodePageIndex();
    const pageSize = this.nodePageSize();
    const start = pageIndex * pageSize;
    return this.sortedNodeUpgrades().slice(start, start + pageSize);
  });

  asEdgeLabel(edge: [number, number] | [string, string]): string {
    return `${edge[0]} → ${edge[1]}`;
  }

  onEdgeSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.edgeSearchTerm.set(value);
    this.edgePageIndex.set(0);
  }

  onNodeSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.nodeSearchTerm.set(value);
    this.nodePageIndex.set(0);
  }

  onShowAllToggle(checked: boolean): void {
    this.showAllUpgrades.set(checked);
    this.edgePageIndex.set(0);
    this.nodePageIndex.set(0);
  }

  onEdgeSort(field: EdgeSortField): void {
    if (this.edgeSortField() === field) {
      this.edgeSortDirection.set(this.edgeSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.edgeSortField.set(field);
    this.edgeSortDirection.set(field === 'rationale' || field === 'edge' ? 'asc' : 'desc');
    this.edgePageIndex.set(0);
  }

  onNodeSort(field: NodeSortField): void {
    if (this.nodeSortField() === field) {
      this.nodeSortDirection.set(this.nodeSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.nodeSortField.set(field);
    this.nodeSortDirection.set(field === 'rationale' || field === 'node' ? 'asc' : 'desc');
    this.nodePageIndex.set(0);
  }

  onEdgePageChange(event: PageEvent): void {
    this.edgePageIndex.set(event.pageIndex);
    this.edgePageSize.set(event.pageSize);
  }

  onNodePageChange(event: PageEvent): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  getEdgeSortIcon(field: EdgeSortField): string {
    if (this.edgeSortField() !== field) {
      return 'unfold_more';
    }

    return this.edgeSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getNodeSortIcon(field: NodeSortField): string {
    if (this.nodeSortField() !== field) {
      return 'unfold_more';
    }

    return this.nodeSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  private getEdgeSortValue(item: CapacityV2UpgradeRecommendationEdge, field: EdgeSortField): string | number {
    switch (field) {
      case 'edge':
        return this.asEdgeLabel(item.edge);
      case 'priorityScore':
        return item.priorityScore;
      case 'expectedFlowIncrease':
        return item.expectedFlowIncrease;
      case 'rationale':
        return item.rationale;
      default:
        return item.priorityScore;
    }
  }

  private getNodeSortValue(item: CapacityV2UpgradeRecommendationNode, field: NodeSortField): string | number {
    switch (field) {
      case 'node':
        return item.node;
      case 'priorityScore':
        return item.priorityScore;
      case 'expectedFlowIncrease':
        return item.expectedFlowIncrease;
      case 'rationale':
        return item.rationale;
      default:
        return item.priorityScore;
    }
  }

  private compareValues(a: string | number, b: string | number): number {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  }

  private isUpgradeNeeded(item: { expectedFlowIncrease: number; rationale: string }): boolean {
    if (item.expectedFlowIncrease > 0) {
      return true;
    }

    return !item.rationale.toLowerCase().includes('no immediate upgrade needed');
  }
}
