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

interface SaturatedEdgeRow {
  edgeLabel: string;
  utilization: number;
}

interface UtilizationBand {
  label: string;
  count: number;
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
  readonly spofSearchTerm = signal('');
  readonly nearSortField = signal<NearSortField>('utilization');
  readonly nearSortDirection = signal<SortDirection>('desc');
  readonly nearPageIndex = signal(0);
  readonly nearPageSize = signal(10);

  readonly filteredSaturatedEdges = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as SaturatedEdgeRow[];

    const utilizationByEdge = new Map(detail.edgeFlows.map((edgeFlow) => [edgeFlow.edgeKey, edgeFlow.utilization]));
    const term = this.edgeSearchTerm().trim().toLowerCase();

    return detail.bottlenecks.saturatedEdges
      .map((edge) => {
        const edgeLabel = this.asEdgeLabel(edge);
        const edgeKey = `${edge[0]}->${edge[1]}`;
        return {
          edgeLabel,
          utilization: utilizationByEdge.get(edgeKey) ?? 1
        };
      })
      .filter((row) => !term || row.edgeLabel.toLowerCase().includes(term))
      .sort((a, b) => b.utilization - a.utilization || a.edgeLabel.localeCompare(b.edgeLabel, undefined, { sensitivity: 'base' }));
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

  readonly utilizationBands = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as UtilizationBand[];

    const allUtilization = [
      ...detail.edgeFlows.map((item) => item.utilization),
      ...detail.nodeFlows.map((item) => item.utilization)
    ];

    const buckets: UtilizationBand[] = [
      { label: '90–100%', count: 0 },
      { label: '75–89%', count: 0 },
      { label: '50–74%', count: 0 },
      { label: '<50%', count: 0 }
    ];

    for (const value of allUtilization) {
      if (value >= 0.9) {
        buckets[0].count += 1;
      } else if (value >= 0.75) {
        buckets[1].count += 1;
      } else if (value >= 0.5) {
        buckets[2].count += 1;
      } else {
        buckets[3].count += 1;
      }
    }

    return buckets;
  });

  readonly filteredSpofConstraints = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as string[];

    const term = this.spofSearchTerm().trim().toLowerCase();
    return [...detail.criticalPaths.singlePointsOfFailure]
      .filter((item) => !term || item.toLowerCase().includes(term))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  });

  getBottleneckTypeClass(type: string): string {
    const normalized = type.trim().toLowerCase();
    if (normalized.includes('node')) {
      return 'bottleneck-node';
    }

    if (normalized.includes('edge')) {
      return 'bottleneck-edge';
    }

    return 'bottleneck-mixed';
  }

  getUtilizationBandWidth(count: number): string {
    const total = this.utilizationBands().reduce((sum, band) => sum + band.count, 0);
    if (!total) {
      return '0%';
    }

    return `${(count / total) * 100}%`;
  }

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

  onSpofSearchChange(event: Event): void {
    this.spofSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
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
