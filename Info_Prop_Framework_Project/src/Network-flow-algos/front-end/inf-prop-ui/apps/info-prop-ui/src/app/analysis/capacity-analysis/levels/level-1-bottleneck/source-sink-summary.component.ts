import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Level1Story } from '../../state/capacity-story.models';

interface SourceFlow {
  sourceId: number;
  targetSinks: Array<{
    sinkId: number;
    flowAmount: number;
    percentOfSourceOutput: number;
  }>;
  totalOutput: number;
  deliveryRatio: number;
}

interface SinkSummary {
  sinkId: number;
  inputFlow: number;
  inputCapacity: number;
  utilization: number;
  sourceContributions: Array<{ sourceId: number; flow: number; percent: number }>;
}

/**
 * Source-Sink Summary Component (Level 1)
 * Tells the narrative of how source flows propagate to sinks
 * Shows expandable cards for detailed path information
 */
@Component({
  selector: 'app-source-sink-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatExpansionModule, MatIconModule, MatTooltipModule, MatProgressBarModule],
  templateUrl: './source-sink-summary.component.html',
  styleUrls: ['./source-sink-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceSinkSummaryComponent {
  @Input() sourceFlows: SourceFlow[] = [];
  @Input() sinkSummary: SinkSummary[] = [];

  /**
   * Get status color based on utilization
   */
  getUtilizationColor(util: number): string {
    if (util >= 0.9) return '#EF5350'; // Critical
    if (util >= 0.8) return '#FFA726'; // Warning
    if (util >= 0.6) return '#FFD54F'; // Yellow
    return '#66BB6A'; // Green
  }

  /**
   * Format flow percentage with 1 decimal
   */
  formatPercent(percent: number): string {
    return (percent * 100).toFixed(1);
  }

  /**
   * Get story text for a source-to-sink path
   */
  getSourceStory(source: SourceFlow): string {
    if (source.targetSinks.length === 0) {
      return 'No output destinations';
    }

    const destinations = source.targetSinks.map((s) => `Sink ${s.sinkId} (${this.formatPercent(s.percentOfSourceOutput)}%)`);

    if (destinations.length === 1) {
      return `Sends entire output to ${destinations[0]}`;
    }

    return `Distributes output: ${destinations.join(', ')}`;
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(ratio: number): { icon: string; text: string; color: string } {
    if (ratio >= 0.99) return { icon: 'check_circle', text: 'All delivered', color: '#66BB6A' };
    if (ratio >= 0.95) return { icon: 'check_circle', text: 'Mostly delivered', color: '#FFA726' };
    return { icon: 'warning', text: 'Incomplete delivery', color: '#EF5350' };
  }
}
