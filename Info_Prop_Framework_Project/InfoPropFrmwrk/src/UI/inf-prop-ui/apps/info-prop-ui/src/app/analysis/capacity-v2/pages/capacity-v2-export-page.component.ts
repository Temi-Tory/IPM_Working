import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CapacityV2Interval } from '../capacity-v2.models';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CapacityV2Store } from '../capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-export-page',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule
  ],
  templateUrl: './capacity-v2-export-page.component.html',
  styleUrl: './capacity-v2-export-page.component.scss'
})
export class CapacityV2ExportPageComponent {
  readonly store = inject(CapacityV2Store);
  selectedFormat = 'json';

  exportData(): void {
    const result = this.store.result();
    if (!result) return;

    let dataStr: string;
    let fileName: string;
    let mimeType: string;

    switch (this.selectedFormat) {
      case 'json':
        dataStr = JSON.stringify(result, null, 2);
        fileName = 'capacity-analysis.json';
        mimeType = 'application/json';
        break;
      case 'csv':
        dataStr = this.convertToCSV(result);
        fileName = 'capacity-analysis.csv';
        mimeType = 'text/csv';
        break;
      case 'txt':
        dataStr = this.convertToText(result);
        fileName = 'capacity-analysis.txt';
        mimeType = 'text/plain';
        break;
      default:
        return;
    }

    this.downloadFile(dataStr, fileName, mimeType);
  }

  getThroughputValue(throughput: number | CapacityV2Interval): number {
    return typeof throughput === 'number' ? throughput : throughput.max;
  }

  private convertToCSV(_result: unknown): string {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return '';

    let csv = 'Category,Item,Value\n';
    csv += `Summary,Max Flow,${this.getThroughputValue(detail.summary.throughput)}\n`;
    csv += `Summary,Utilization,${detail.summary.utilization}\n`;
    
    detail.bottlenecks.saturatedEdges.forEach((edge, i) => {
      csv += `Bottleneck,Saturated Edge ${i + 1},${edge[0]} -> ${edge[1]}\n`;
    });
    
    return csv;
  }

  private convertToText(_result: unknown): string {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return '';

    let text = '=== CAPACITY ANALYSIS REPORT ===\n\n';
    text += `Max Flow: ${this.getThroughputValue(detail.summary.throughput)}\n`;
    text += `Utilization: ${(detail.summary.utilization * 100).toFixed(2)}%\n\n`;
    
    text += '=== BOTTLENECKS ===\n';
    detail.bottlenecks.saturatedEdges.forEach((edge, i) => {
      text += `${i + 1}. ${edge[0]} -> ${edge[1]}\n`;
    });
    
    return text;
  }

  private downloadFile(data: string, filename: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  copyToClipboard(): void {
    const result = this.store.result();
    if (!result) return;

    const dataStr = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(dataStr).then(() => {
      console.log('Copied to clipboard');
    });
  }
}
