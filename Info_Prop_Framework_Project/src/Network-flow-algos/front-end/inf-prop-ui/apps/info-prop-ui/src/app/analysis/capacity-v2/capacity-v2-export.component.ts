import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { CapacityV2Store } from './capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-export',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './capacity-v2-export.component.html',
  styleUrl: './capacity-v2-export.component.scss'
})
export class CapacityV2ExportComponent {
  readonly store = inject(CapacityV2Store);
  readonly feedback = signal('');

  exportJson(): void {
    const payload = this.store.getExportPayload();
    if (!payload) {
      this.feedback.set('No results available for JSON export.');
      return;
    }

    this.downloadBlob('capacity-v2-results.json', JSON.stringify(payload, null, 2), 'application/json');
    this.feedback.set('JSON export generated.');
  }

  exportCsv(): void {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) {
      this.feedback.set('No results available for CSV export.');
      return;
    }

    const lines: string[] = [];
    lines.push('Section,Key,Value');
    lines.push(`Summary,MaxFlow,${typeof detail.summary.throughput === 'number' ? detail.summary.throughput : ''}`);
    lines.push(`Summary,Utilization,${detail.summary.utilization}`);
    lines.push(`Summary,ComputationTimeMs,${detail.summary.computationTimeMs}`);

    detail.nodeFlows.forEach((node) => {
      lines.push(`NodeFlow,${node.nodeId},${node.flow}`);
    });

    detail.edgeFlows.forEach((edge) => {
      lines.push(`EdgeFlow,${edge.from}->${edge.to},${edge.flow}`);
    });

    detail.upgrades.edgePriorities.forEach((rec) => {
      lines.push(`EdgeUpgrade,${rec.edge[0]}->${rec.edge[1]},${rec.priorityScore}`);
    });

    detail.upgrades.nodePriorities.forEach((rec) => {
      lines.push(`NodeUpgrade,${rec.node},${rec.priorityScore}`);
    });

    this.downloadBlob('capacity-v2-results.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    this.feedback.set('CSV export generated.');
  }

  exportPdf(): void {
    const summary = this.store.summary();
    const detail = this.store.activeDeterministicDetail();
    if (!summary || !detail) {
      this.feedback.set('No results available for PDF export.');
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      this.feedback.set('PDF export blocked by browser popup settings.');
      return;
    }

    const throughputText =
      typeof summary.throughput === 'number'
        ? summary.throughput.toFixed(3)
        : `${summary.throughput.min.toFixed(3)} - ${summary.throughput.max.toFixed(3)}`;

    popup.document.write(`
      <html>
        <head><title>Capacity v2 Report</title></head>
        <body>
          <h1>Capacity v2 Report</h1>
          <h2>SUMMARY</h2>
          <p>Throughput: ${throughputText}</p>
          <p>Utilization: ${summary.utilization}</p>
          <p>Computation Time (ms): ${summary.computationTimeMs}</p>
          <h2>BOTTLENECK ANALYSIS</h2>
          <p>Min-cut capacity: ${detail.bottlenecks.minCutCapacity}</p>
          <p>Bottleneck type: ${detail.bottlenecks.bottleneckType}</p>
          <h2>UPGRADE PRIORITIES</h2>
          <p>Primary bottleneck: ${detail.upgrades.primaryBottleneck}</p>
          <p>Recommended action: ${detail.upgrades.recommendedAction}</p>
          <h2>SPOF-STYLE CONSTRAINTS</h2>
          <p>Constraint count: ${detail.criticalPaths.singlePointsOfFailure.length}</p>
          <h2>COMPARATIVE ANALYSIS</h2>
          <p>Realistic max flow: ${detail.comparative.realisticMaxFlow}</p>
          <p>Classical max flow: ${detail.comparative.classicalMaxFlow}</p>
          <h2>FLOW DISTRIBUTION</h2>
          <p>Node flow entries: ${detail.nodeFlows.length}</p>
          <p>Edge flow entries: ${detail.edgeFlows.length}</p>
          <h2>VALIDATION</h2>
          <p>All checks passed: ${detail.validation.allChecksPassed}</p>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();

    this.feedback.set('PDF report print dialog opened.');
  }

  async copySummary(): Promise<void> {
    const summary = this.store.summary();
    const detail = this.store.activeDeterministicDetail();
    const validation = this.store.validation();
    if (!summary || !detail || !validation) {
      this.feedback.set('No results available to copy.');
      return;
    }

    const throughput =
      typeof summary.throughput === 'number'
        ? summary.throughput.toFixed(3)
        : `${summary.throughput.min.toFixed(3)} - ${summary.throughput.max.toFixed(3)}`;

    const text = [
      `Throughput: ${throughput}`,
      `Utilization: ${summary.utilization.toFixed(3)}`,
      `Primary bottleneck: ${detail.upgrades.primaryBottleneck}`,
      `Validation: ${validation.allChecksPassed ? 'all checks passed' : 'issues present'}`
    ].join('\n');

    await navigator.clipboard.writeText(text);
    this.feedback.set('Summary copied to clipboard.');
  }

  private downloadBlob(fileName: string, content: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
