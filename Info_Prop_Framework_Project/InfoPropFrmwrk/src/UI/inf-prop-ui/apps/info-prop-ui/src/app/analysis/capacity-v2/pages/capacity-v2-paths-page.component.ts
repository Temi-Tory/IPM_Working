import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CapacityV2Store } from '../capacity-v2.store';

type SortDirection = 'asc' | 'desc';
type PathSortField = 'path' | 'capacity' | 'flow';
type RedundancySortField = 'path' | 'count';

@Component({
  selector: 'app-capacity-v2-paths-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatPaginatorModule],
  templateUrl: './capacity-v2-paths-page.component.html',
  styleUrl: './capacity-v2-paths-page.component.scss'
})
export class CapacityV2PathsPageComponent {
  readonly store = inject(CapacityV2Store);
  readonly pathSearchTerm = signal('');
  readonly redundancySearchTerm = signal('');
  readonly spofSearchTerm = signal('');
  readonly pathSortField = signal<PathSortField>('flow');
  readonly pathSortDirection = signal<SortDirection>('desc');
  readonly redundancySortField = signal<RedundancySortField>('count');
  readonly redundancySortDirection = signal<SortDirection>('desc');
  readonly pathPageIndex = signal(0);
  readonly pathPageSize = signal(10);
  readonly redundancyPageIndex = signal(0);
  readonly redundancyPageSize = signal(10);

  readonly sortedCriticalPaths = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [];

    const term = this.pathSearchTerm().trim().toLowerCase();
    const filtered = detail.criticalPaths.criticalPaths.filter((item) => {
      const path = item.path.join(' → ').toLowerCase();
      return !term || path.includes(term);
    });

    const field = this.pathSortField();
    const factor = this.pathSortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (field === 'capacity') return (a.capacity - b.capacity) * factor;
      if (field === 'flow') return (a.flow - b.flow) * factor;
      return a.path.join(' → ').localeCompare(b.path.join(' → '), undefined, { sensitivity: 'base' }) * factor;
    });
  });

  readonly sortedRedundancyEntries = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as Array<{ key: string; value: number }>;

    const entries = this.getRedundancyEntries(detail.criticalPaths.pathRedundancy);
    const term = this.redundancySearchTerm().trim().toLowerCase();
    const filtered = entries.filter((entry) => !term || entry.key.toLowerCase().includes(term));

    const field = this.redundancySortField();
    const factor = this.redundancySortDirection() === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (field === 'count') return (a.value - b.value) * factor;
      return a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }) * factor;
    });
  });

  readonly filteredSpofList = computed(() => {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return [] as string[];

    const term = this.spofSearchTerm().trim().toLowerCase();
    return [...detail.criticalPaths.singlePointsOfFailure]
      .filter((item) => !term || item.toLowerCase().includes(term))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  });

  readonly pagedCriticalPaths = computed(() => {
    const pageIndex = this.pathPageIndex();
    const pageSize = this.pathPageSize();
    const start = pageIndex * pageSize;
    return this.sortedCriticalPaths().slice(start, start + pageSize);
  });

  readonly pagedRedundancyEntries = computed(() => {
    const pageIndex = this.redundancyPageIndex();
    const pageSize = this.redundancyPageSize();
    const start = pageIndex * pageSize;
    return this.sortedRedundancyEntries().slice(start, start + pageSize);
  });

  getRedundancyEntries(redundancy: Record<string, number>): Array<{key: string, value: number}> {
    return Object.entries(redundancy).map(([key, value]) => ({key, value}));
  }

  onPathSearchChange(event: Event): void {
    this.pathSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.pathPageIndex.set(0);
  }

  onRedundancySearchChange(event: Event): void {
    this.redundancySearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
    this.redundancyPageIndex.set(0);
  }

  onSpofSearchChange(event: Event): void {
    this.spofSearchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  onPathSort(field: PathSortField): void {
    if (this.pathSortField() === field) {
      this.pathSortDirection.set(this.pathSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.pathSortField.set(field);
    this.pathSortDirection.set(field === 'path' ? 'asc' : 'desc');
    this.pathPageIndex.set(0);
  }

  onRedundancySort(field: RedundancySortField): void {
    if (this.redundancySortField() === field) {
      this.redundancySortDirection.set(this.redundancySortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.redundancySortField.set(field);
    this.redundancySortDirection.set(field === 'path' ? 'asc' : 'desc');
    this.redundancyPageIndex.set(0);
  }

  onPathPageChange(event: PageEvent): void {
    this.pathPageIndex.set(event.pageIndex);
    this.pathPageSize.set(event.pageSize);
  }

  onRedundancyPageChange(event: PageEvent): void {
    this.redundancyPageIndex.set(event.pageIndex);
    this.redundancyPageSize.set(event.pageSize);
  }

  getPathSortIcon(field: PathSortField): string {
    if (this.pathSortField() !== field) return 'unfold_more';
    return this.pathSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getRedundancySortIcon(field: RedundancySortField): string {
    if (this.redundancySortField() !== field) return 'unfold_more';
    return this.redundancySortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
}
