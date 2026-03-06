import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { NodeMetric, EdgeMetric } from '../../state/capacity-story.models';

interface TableData {
  id: string;
  type: 'node' | 'edge';
  capacity: number;
  flow: number;
  utilization: number;
  spare: number;
  isBottleneck: boolean;
  status: string;
  displayName: string;
}

/**
 * Full Results Table Component (Level 3)
 * Shows complete paginated table of all nodes or edges
 * Fully sortable, filterable, with optional dense mode
 */
@Component({
  selector: 'app-full-results-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './full-results-table.component.html',
  styleUrls: ['./full-results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullResultsTableComponent {
  @Input() nodes: NodeMetric[] = [];
  @Input() edges: EdgeMetric[] = [];
  @Input() viewMode: 'node' | 'edge' = 'node';

  @Output() sort = new EventEmitter<Sort>();
  @Output() pageChange = new EventEmitter<PageEvent>();

  displayedColumns: string[] = ['displayName', 'capacity', 'flow', 'utilization', 'spare', 'status'];
  pageSize = 25;
  currentSort: Sort = { active: 'utilization', direction: 'desc' };
  searchFilter = '';
  denseModeEnabled = false;

  /**
   * Get data based on view mode
   */
  get tableData(): TableData[] {
    const data: TableData[] = [];

    if (this.viewMode === 'node') {
      this.nodes
        .filter((n) => this.matchesSearch(n.nodeId.toString()))
        .forEach((n) => {
          data.push({
            id: n.nodeId.toString(),
            type: 'node',
            capacity: n.capacity,
            flow: n.flow,
            utilization: n.utilization,
            spare: n.spare,
            isBottleneck: n.isBottleneck,
            status: n.isBottleneck ? 'Bottleneck' : 'Active',
            displayName: `Node ${n.nodeId} (${n.nodeType})`,
          });
        });
    } else {
      this.edges
        .filter((e) => this.matchesSearch(e.edgeKey))
        .forEach((e) => {
          data.push({
            id: e.edgeKey,
            type: 'edge',
            capacity: e.capacity,
            flow: e.flow,
            utilization: e.utilization,
            spare: e.spare,
            isBottleneck: e.isBottleneck,
            status: e.isBottleneck ? 'Bottleneck' : 'Active',
            displayName: `Edge ${e.from}→${e.to}`,
          });
        });
    }

    return this.sortData(data, this.currentSort);
  }

  private matchesSearch(text: string): boolean {
    if (!this.searchFilter) return true;
    return text.toLowerCase().includes(this.searchFilter.toLowerCase());
  }

  private sortData(data: TableData[], sort: Sort): TableData[] {
    if (!sort.active || sort.direction === '') return data;

    return data.sort((a: any, b: any) => {
      const aVal = a[sort.active];
      const bVal = b[sort.active];
      const isAsc = sort.direction === 'asc';

      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (isAsc ? 1 : -1);
    });
  }

  onSort(event: Sort): void {
    this.currentSort = event;
    this.sort.emit(event);
  }

  onPageChange(event: PageEvent): void {
    this.pageChange.emit(event);
  }

  toggleDenseMode(): void {
    this.denseModeEnabled = !this.denseModeEnabled;
  }

  /**
   * Get utilization color gradient
   */
  getUtilizationColor(util: number): string {
    if (util >= 0.95) return '#EF5350';
    if (util >= 0.85) return '#FFA726';
    if (util >= 0.7) return '#FFD54F';
    if (util >= 0.5) return '#66BB6A';
    return '#81C784';
  }

  /**
   * Get status icon
   */
  getStatusIcon(row: TableData): string {
    if (row.utilization >= 0.95) return 'error';
    if (row.utilization >= 0.85) return 'warning';
    if (row.isBottleneck) return 'info';
    return 'check_circle';
  }

  /**
   * Get status color
   */
  getStatusColor(row: TableData): string {
    if (row.utilization >= 0.95) return '#EF5350';
    if (row.utilization >= 0.85) return '#FFA726';
    return '#66BB6A';
  }

  /**
   * Export current view to CSV
   */
  exportToCSV(): void {
    const headers = ['ID', 'Capacity', 'Flow', 'Utilization %', 'Spare', 'Status'];
    const rows = this.tableData.map((row) => [
      row.displayName,
      row.capacity.toFixed(2),
      row.flow.toFixed(2),
      (row.utilization * 100).toFixed(1),
      row.spare.toFixed(2),
      row.status,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.viewMode}-metrics.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
