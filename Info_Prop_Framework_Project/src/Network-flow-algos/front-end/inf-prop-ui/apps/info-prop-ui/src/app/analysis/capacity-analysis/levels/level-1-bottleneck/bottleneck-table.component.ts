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
import { NodeMetric, EdgeMetric } from '../../state/capacity-story.models';

interface TableData {
  id: string;
  type: 'node' | 'edge';
  capacity: number;
  flow: number;
  utilization: number;
  spare: number;
  isBottleneck: boolean;
  displayName: string;
}

/**
 * Bottleneck Table Component (Level 1)
 * Shows sortable, paginated table of bottleneck nodes and edges
 * Provides visual gradient via utilization heatmap
 */
@Component({
  selector: 'app-bottleneck-table',
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
  ],
  templateUrl: './bottleneck-table.component.html',
  styleUrls: ['./bottleneck-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottleneckTableComponent {
  @Input() nodes: NodeMetric[] = [];
  @Input() edges: EdgeMetric[] = [];
  @Input() searchTerm: string = '';

  @Output() sort = new EventEmitter<Sort>();
  @Output() pageChange = new EventEmitter<PageEvent>();

  displayedColumns: string[] = ['displayName', 'capacity', 'flow', 'utilization', 'spare', 'status'];
  pageSize = 25;
  currentSort: Sort = { active: 'utilization', direction: 'desc' };

  /**
   * Combine nodes and edges into unified table data
   */
  get tableData(): TableData[] {
    const data: TableData[] = [];

    // Add bottleneck nodes
    this.nodes
      .filter((n) => n.isBottleneck && this.matchesSearch(n.nodeId.toString()))
      .forEach((n) => {
        data.push({
          id: n.nodeId.toString(),
          type: 'node',
          capacity: n.capacity,
          flow: n.flow,
          utilization: n.utilization,
          spare: n.spare,
          isBottleneck: n.isBottleneck,
          displayName: `Node ${n.nodeId} (${n.nodeType})`,
        });
      });

    // Add bottleneck edges
    this.edges
      .filter((e) => e.isBottleneck && this.matchesSearch(e.edgeKey))
      .forEach((e) => {
        data.push({
          id: e.edgeKey,
          type: 'edge',
          capacity: e.capacity,
          flow: e.flow,
          utilization: e.utilization,
          spare: e.spare,
          isBottleneck: e.isBottleneck,
          displayName: `Edge ${e.from}→${e.to}`,
        });
      });

    // Sort
    return this.sortData(data, this.currentSort);
  }

  private matchesSearch(text: string): boolean {
    if (!this.searchTerm) return true;
    return text.toLowerCase().includes(this.searchTerm.toLowerCase());
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

  /**
   * Get utilization color gradient (red → yellow → green)
   */
  getUtilizationColor(util: number): string {
    if (util >= 0.9) return '#EF5350'; // Critical red
    if (util >= 0.8) return '#FFA726'; // Warning orange
    if (util >= 0.6) return '#FFD54F'; // Yellow
    return '#66BB6A'; // Green
  }

  /**
   * Get status icon and text
   */
  getStatusDisplay(row: TableData): { icon: string; text: string } {
    if (row.utilization >= 0.95) {
      return { icon: 'error', text: 'Critical' };
    }
    if (row.utilization >= 0.85) {
      return { icon: 'warning', text: 'Warning' };
    }
    return { icon: 'check_circle', text: 'Healthy' };
  }
}
