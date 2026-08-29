import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  signal,
} from '@angular/core';
import { ValueType } from '@inf-prop/shared/api-client';
import { IconComponent, ValueDisplayComponent } from '@inf-prop/shared/ui';
import { BeliefRow, NodeRole } from '../reliability.types';
import { beliefLowerBound } from '../belief-rows';

type SortColumn = 'node' | 'belief';
type SortDir = 'asc' | 'desc';

const ROLE_LABEL: Record<NodeRole, string> = {
  source: 'Source',
  sink: 'Sink',
  fork: 'Fork',
  join: 'Join',
  regular: 'Regular',
};

/**
 * The per-node belief table. Every belief and prior renders through `<ipf-value>`
 * — a number stays a number, an interval a bound pair, a p-box a typed summary.
 * Nothing here is ever midpointed for display. Sorting by belief falls back to
 * the lower bound for interval / p-box scenarios, and the header says so.
 */
@Component({
  selector: 'ipf-belief-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IconComponent, ValueDisplayComponent],
  templateUrl: './belief-table.component.html',
  styleUrl: './belief-table.component.scss',
})
export class BeliefTableComponent {
  readonly rows = input.required<BeliefRow[]>();
  readonly valueType = input.required<ValueType>();

  protected readonly search = signal('');
  protected readonly diamondsOnly = signal(false);
  protected readonly roleFilter = signal<NodeRole | 'all'>('all');
  protected readonly sortColumn = signal<SortColumn>('node');
  protected readonly sortDir = signal<SortDir>('asc');

  protected readonly roleLabel = ROLE_LABEL;

  protected readonly beliefSortsByLowerBound = computed(
    () => this.valueType() !== 'float64',
  );

  protected readonly availableRoles = computed<NodeRole[]>(() => {
    const seen = new Set<NodeRole>();
    for (const r of this.rows()) for (const t of r.roleTags) seen.add(t);
    return (['source', 'sink', 'fork', 'join', 'regular'] as NodeRole[]).filter(
      (r) => seen.has(r),
    );
  });

  protected readonly view = computed<BeliefRow[]>(() => {
    const term = this.search().trim();
    const role = this.roleFilter();
    const diamondsOnly = this.diamondsOnly();
    let rows = this.rows().filter((r) => {
      if (term && !String(r.nodeId).includes(term)) return false;
      if (role !== 'all' && !r.roleTags.includes(role)) return false;
      if (diamondsOnly && !r.hasDiamond) return false;
      return true;
    });

    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const col = this.sortColumn();
    rows = [...rows].sort((a, b) => {
      if (col === 'node') return (a.nodeId - b.nodeId) * dir;
      const av = beliefLowerBound(a.belief);
      const bv = beliefLowerBound(b.belief);
      if (Number.isNaN(av) && Number.isNaN(bv)) return (a.nodeId - b.nodeId) * dir;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return (av - bv) * dir || (a.nodeId - b.nodeId) * dir;
    });
    return rows;
  });

  protected setSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDir.set(col === 'belief' ? 'desc' : 'asc');
    }
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected setRole(role: NodeRole | 'all'): void {
    this.roleFilter.set(role);
  }

  protected toggleDiamondsOnly(): void {
    this.diamondsOnly.set(!this.diamondsOnly());
  }

  protected ariaSort(col: SortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== col) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }
}
