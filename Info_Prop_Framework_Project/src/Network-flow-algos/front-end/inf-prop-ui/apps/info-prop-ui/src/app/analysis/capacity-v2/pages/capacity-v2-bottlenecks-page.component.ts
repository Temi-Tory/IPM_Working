import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CapacityV2Store } from '../capacity-v2.store';

type SortDirection = 'asc' | 'desc';
type NearSortField = 'type' | 'component' | 'utilization';

interface NearSaturatedRow {
  type: 'Edge' | 'Node';
  component: string;
  utilization: number;
}

@Component({
  selector: 'app-capacity-v2-bottlenecks-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatPaginatorModule],
  templateUrl: './capacity-v2-bottlenecks-page.component.html',
  styleUrl: './capacity-v2-bottlenecks-page.component.scss'
})
export class CapacityV2BottlenecksPageComponent {
  readonly store = inject(CapacityV2Store);
  readonly edgeSearchTerm = signal('');
  readonly nodeSearchTerm = signal('');
  readonly nearSearchTerm = signal('');
  readonly nearSortField = signal<NearSortField>('utilization');
  readonly nearSortDirection = signal<SortDirection>('desc');
  readonly nearPageIndex = signal(0);
  readonly nearPageSize = signal(10);

  readonly filteredSaturatedEdges = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as string[];

    const term = this.edgeSearchTerm().trim().toLowerCase();
    const labels = detail.bottlenecks.saturatedEdges.map((edge) => this.asEdgeLabel(edge));

    return labels
      .filter((label) => !term || label.toLowerCase().includes(term))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  });

  readonly filteredSaturatedNodes = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as number[];

    const term = this.nodeSearchTerm().trim().toLowerCase();

    return [...detail.bottlenecks.saturatedNodes]
      .filter((node) => !term || String(node).toLowerCase().includes(term))
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
  });

  readonly filteredNearSaturated = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as NearSaturatedRow[];

    const rows: NearSaturatedRow[] = [
      ...detail.bottlenecks.nearSaturatedEdges.map((item) => ({
        type: 'Edge' as const,
        component: this.asEdgeLabel(item.edge),
        utilization: item.utilization
      })),
      ...detail.bottlenecks.nearSaturatedNodes.map((item) => ({
        type: 'Node' as const,
        component: String(item.node),
        utilization: item.utilization
      }))
    ];

    const term = this.nearSearchTerm().trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        !term ||
        row.type.toLowerCase().includes(term) ||
        row.component.toLowerCase().includes(term)
    );

    const field = this.nearSortField();
    const factor = this.nearSortDirection() === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      if (field === 'utilization') {
        return (a.utilization - b.utilization) * factor;
      }

      if (field === 'type') {
        return a.type.localeCompare(b.type, undefined, { sensitivity: 'base' }) * factor;
      }

      return a.component.localeCompare(b.component, undefined, { sensitivity: 'base' }) * factor;
    });
  });

  readonly pagedNearSaturated = computed(() => {
    const pageIndex = this.nearPageIndex();
    const pageSize = this.nearPageSize();
    const start = pageIndex * pageSize;
    return this.filteredNearSaturated().slice(start, start + pageSize);
  });

  asEdgeLabel(edge: [number, number] | [string, string]): string {
    return `${edge[0]} → ${edge[1]}`;
  }

  onEdgeSearchChange(event: Event): void {
    this.edgeSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  onNodeSearchChange(event: Event): void {
    this.nodeSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  onNearSearchChange(event: Event): void {
    this.nearSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.nearPageIndex.set(0);
  }

  onNearSort(field: NearSortField): void {
    if (this.nearSortField() === field) {
      this.nearSortDirection.set(this.nearSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.nearSortField.set(field);
    this.nearSortDirection.set(field === 'utilization' ? 'desc' : 'asc');
    this.nearPageIndex.set(0);
  }

  onNearPageChange(event: PageEvent): void {
    this.nearPageIndex.set(event.pageIndex);
    this.nearPageSize.set(event.pageSize);
  }

  getNearSortIcon(field: NearSortField): string {
    if (this.nearSortField() !== field) {
      return 'unfold_more';
    }

    return this.nearSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
}
