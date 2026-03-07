import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { computed, signal } from '@angular/core';
import { CapacityV2Store } from '../capacity-v2.store';
import { CapacityV2FlowNode, CapacityV2FlowEdge } from '../capacity-v2.models';

type SortDirection = 'asc' | 'desc';
type NodeSortField = 'nodeId' | 'flow' | 'utilization';
type EdgeSortField = 'edgeKey' | 'flow' | 'utilization';
type TargetSortField = 'target' | 'flow' | 'percent';

@Component({
  selector: 'app-capacity-v2-flows-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTabsModule, MatIconModule, MatPaginatorModule],
  templateUrl: './capacity-v2-flows-page.component.html',
  styleUrl: './capacity-v2-flows-page.component.scss'
})
export class CapacityV2FlowsPageComponent {
  readonly store = inject(CapacityV2Store);
  readonly nodeSearchTerm = signal('');
  readonly edgeSearchTerm = signal('');
  readonly targetSearchTerm = signal('');
  readonly nodeSortField = signal<NodeSortField>('utilization');
  readonly nodeSortDirection = signal<SortDirection>('desc');
  readonly edgeSortField = signal<EdgeSortField>('utilization');
  readonly edgeSortDirection = signal<SortDirection>('desc');
  readonly targetSortField = signal<TargetSortField>('flow');
  readonly targetSortDirection = signal<SortDirection>('desc');
  readonly nodePageIndex = signal(0);
  readonly nodePageSize = signal(10);
  readonly edgePageIndex = signal(0);
  readonly edgePageSize = signal(10);
  readonly targetPageIndex = signal(0);
  readonly targetPageSize = signal(10);

  readonly sortedNodeFlows = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const term = this.nodeSearchTerm().trim().toLowerCase();
    const filtered = term
      ? detail.nodeFlows.filter((node) => String(node.nodeId).toLowerCase().includes(term))
      : detail.nodeFlows;

    const field = this.nodeSortField();
    const factor = this.nodeSortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => this.compareNode(a, b, field) * factor);
  });

  readonly sortedEdgeFlows = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const term = this.edgeSearchTerm().trim().toLowerCase();
    const filtered = term
      ? detail.edgeFlows.filter((edge) => `${edge.from} ${edge.to} ${edge.edgeKey}`.toLowerCase().includes(term))
      : detail.edgeFlows;

    const field = this.edgeSortField();
    const factor = this.edgeSortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => this.compareEdge(a, b, field) * factor);
  });

  readonly sortedTargetFlows = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const entries = this.getTargetFlowEntries(detail.targetFlows);
    const term = this.targetSearchTerm().trim().toLowerCase();
    const filtered = term ? entries.filter((entry) => entry.key.toLowerCase().includes(term)) : entries;

    const field = this.targetSortField();
    const factor = this.targetSortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (field === 'target') {
        return a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }) * factor;
      }

      if (field === 'percent') {
        return (this.getTargetFlowPercentage(a.value) - this.getTargetFlowPercentage(b.value)) * factor;
      }

      return (a.value - b.value) * factor;
    });
  });

  readonly pagedNodeFlows = computed(() => {
    const pageIndex = this.nodePageIndex();
    const pageSize = this.nodePageSize();
    const start = pageIndex * pageSize;
    return this.sortedNodeFlows().slice(start, start + pageSize);
  });

  readonly pagedEdgeFlows = computed(() => {
    const pageIndex = this.edgePageIndex();
    const pageSize = this.edgePageSize();
    const start = pageIndex * pageSize;
    return this.sortedEdgeFlows().slice(start, start + pageSize);
  });

  readonly pagedTargetFlows = computed(() => {
    const pageIndex = this.targetPageIndex();
    const pageSize = this.targetPageSize();
    const start = pageIndex * pageSize;
    return this.sortedTargetFlows().slice(start, start + pageSize);
  });

  nodeUtilization(node: CapacityV2FlowNode): number {
    if (!node.utilization) return 0;
    return node.utilization;
  }

  edgeUtilization(edge: CapacityV2FlowEdge): number {
    if (!edge.utilization) return 0;
    return edge.utilization;
  }

  getTargetFlowEntries(targetFlows: Record<string, number>): Array<{key: string, value: number}> {
    return Object.entries(targetFlows).map(([key, value]) => ({key, value}));
  }

  getTargetFlowPercentage(flow: number): number {
    const summary = this.store.summary();
    if (!summary) return 0;
    const throughput = typeof summary.throughput === 'number' ? summary.throughput : summary.throughput.max;
    return (flow / throughput) * 100;
  }

  onNodeSearchChange(event: Event): void {
    this.nodeSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.nodePageIndex.set(0);
  }

  onEdgeSearchChange(event: Event): void {
    this.edgeSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.edgePageIndex.set(0);
  }

  onTargetSearchChange(event: Event): void {
    this.targetSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.targetPageIndex.set(0);
  }

  onNodeSort(field: NodeSortField): void {
    if (this.nodeSortField() === field) {
      this.nodeSortDirection.set(this.nodeSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.nodeSortField.set(field);
    this.nodeSortDirection.set(field === 'nodeId' ? 'asc' : 'desc');
    this.nodePageIndex.set(0);
  }

  onEdgeSort(field: EdgeSortField): void {
    if (this.edgeSortField() === field) {
      this.edgeSortDirection.set(this.edgeSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.edgeSortField.set(field);
    this.edgeSortDirection.set(field === 'edgeKey' ? 'asc' : 'desc');
    this.edgePageIndex.set(0);
  }

  onTargetSort(field: TargetSortField): void {
    if (this.targetSortField() === field) {
      this.targetSortDirection.set(this.targetSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.targetSortField.set(field);
    this.targetSortDirection.set(field === 'target' ? 'asc' : 'desc');
    this.targetPageIndex.set(0);
  }

  onNodePageChange(event: PageEvent): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  onEdgePageChange(event: PageEvent): void {
    this.edgePageIndex.set(event.pageIndex);
    this.edgePageSize.set(event.pageSize);
  }

  onTargetPageChange(event: PageEvent): void {
    this.targetPageIndex.set(event.pageIndex);
    this.targetPageSize.set(event.pageSize);
  }

  getNodeSortIcon(field: NodeSortField): string {
    if (this.nodeSortField() !== field) return 'unfold_more';
    return this.nodeSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getEdgeSortIcon(field: EdgeSortField): string {
    if (this.edgeSortField() !== field) return 'unfold_more';
    return this.edgeSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getTargetSortIcon(field: TargetSortField): string {
    if (this.targetSortField() !== field) return 'unfold_more';
    return this.targetSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  private compareNode(a: CapacityV2FlowNode, b: CapacityV2FlowNode, field: NodeSortField): number {
    if (field === 'nodeId') {
      return String(a.nodeId).localeCompare(String(b.nodeId), undefined, { sensitivity: 'base' });
    }
    if (field === 'flow') return a.flow - b.flow;
    return this.nodeUtilization(a) - this.nodeUtilization(b);
  }

  private compareEdge(a: CapacityV2FlowEdge, b: CapacityV2FlowEdge, field: EdgeSortField): number {
    if (field === 'edgeKey') return a.edgeKey.localeCompare(b.edgeKey, undefined, { sensitivity: 'base' });
    if (field === 'flow') return a.flow - b.flow;
    return this.edgeUtilization(a) - this.edgeUtilization(b);
  }
}
