import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RawCapacityResult } from '../../state/capacity-story.models';

/**
 * Export Controls Component (Level 3)
 * Provides buttons for exporting data in multiple formats
 * CSV, JSON (nodes/edges), and full scenario package
 */
@Component({
  selector: 'app-export-controls',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  templateUrl: './export-controls.component.html',
  styleUrls: ['./export-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportControlsComponent {
  @Input() scenarioName: string = 'scenario';
  @Input() rawData!: RawCapacityResult;
  readonly generatedAt = new Date();

  exportInProgress = false;

  /**
   * Export as CSV
   */
  exportAsCSV(): void {
    if (!this.rawData?.raw_capacity_result) return;

    const result = this.rawData.raw_capacity_result;
    const rows: string[] = ['Node Metrics'];
    rows.push('NodeID,Capacity,Flow,Utilization,Spare');

    // Add node metrics
    Object.entries(result.node_capacities || {}).forEach(([nodeId, capacity]) => {
      const flow = result.node_max_flows?.[nodeId] || 0;
      const spare = (capacity as number) - flow;
      const utilization = flow / (capacity as number);
      rows.push(`${nodeId},${capacity},${flow},${utilization},${spare}`);
    });

    // Add edge metrics
    rows.push('\nEdge Metrics');
    rows.push('EdgeID,Capacity,Flow,Utilization,Spare');
    Object.entries(result.edge_utilization || {}).forEach(([edgeId, metrics]) => {
      rows.push(
        `${edgeId},${metrics.capacity},${metrics.flow},${metrics.utilization},${metrics.spare}`
      );
    });

    const csv = rows.join('\n');
    this.downloadFile(csv, `${this.scenarioName}-metrics.csv`, 'text/csv');
  }

  /**
   * Export as JSON (nodes and edges only)
   */
  exportAsJSON(): void {
    if (!this.rawData?.raw_capacity_result) return;

    const result = this.rawData.raw_capacity_result;
    const exportData = {
      scenario: this.scenarioName,
      timestamp: new Date().toISOString(),
      computation_time: this.rawData.computation_time,
      network_utilization: this.rawData.network_utilization,
      nodes: result.node_capacities,
      edges: result.edge_utilization,
    };

    const json = JSON.stringify(exportData, null, 2);
    this.downloadFile(json, `${this.scenarioName}-metrics.json`, 'application/json');
  }

  /**
   * Export full scenario package (all data)
   */
  exportFullPackage(): void {
    if (!this.rawData) return;

    this.exportInProgress = true;

    // Simulate async export operation
    setTimeout(() => {
      const json = JSON.stringify(this.rawData, null, 2);
      this.downloadFile(json, `${this.scenarioName}-full-package.json`, 'application/json');
      this.exportInProgress = false;
    }, 500);
  }

  /**
   * Helper: Download file
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get file size estimate (for UI info)
   */
  getFileSize(): string {
    if (!this.rawData) return '0 KB';
    const size = JSON.stringify(this.rawData).length;
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
