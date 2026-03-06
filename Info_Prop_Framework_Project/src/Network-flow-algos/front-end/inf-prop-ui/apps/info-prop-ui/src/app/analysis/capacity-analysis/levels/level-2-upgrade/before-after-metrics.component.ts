import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface CurrentState {
  networkUtilization: number;
  maxUtilization: number;
  bottleneckCount: number;
}

interface ProjectedState {
  networkUtilization?: number;
  maxUtilization?: number;
  bottleneckCount?: number;
}

/**
 * Before-After Metrics Component (Level 2)
 * Shows side-by-side comparison ofBefore/After upgrade metrics
 * Displays delta with color coding (green for improvements, red for degradations)
 */
@Component({
  selector: 'app-before-after-metrics',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule, MatProgressBarModule],
  templateUrl: './before-after-metrics.component.html',
  styleUrls: ['./before-after-metrics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeforeAfterMetricsComponent {
  @Input() currentMetrics!: CurrentState;
  @Input() whatIfMetrics?: ProjectedState;
  protected readonly Math = Math;

  /**
   * Check if we have what-if data
   */
  get hasWhatIf(): boolean {
    return !!this.whatIfMetrics && Object.keys(this.whatIfMetrics).length > 0;
  }

  /**
   * Calculate delta for max utilization
   */
  get utilDelta(): { value: number; percent: number; good: boolean } {
    if (!this.hasWhatIf) return { value: 0, percent: 0, good: false };

    const delta =
      (this.whatIfMetrics?.maxUtilization ?? this.currentMetrics.maxUtilization) -
      this.currentMetrics.maxUtilization;
    const percent = (delta / this.currentMetrics.maxUtilization) * 100;

    return {
      value: delta,
      percent,
      good: delta < 0, // Negative delta is good
    };
  }

  /**
   * Calculate delta for bottleneck count
   */
  get bottleneckDelta(): { value: number; good: boolean } {
    if (!this.hasWhatIf) return { value: 0, good: false };

    const delta = (this.whatIfMetrics?.bottleneckCount ?? this.currentMetrics.bottleneckCount) -
      this.currentMetrics.bottleneckCount;

    return {
      value: delta,
      good: delta <= 0, // Less bottlenecks = good
    };
  }

  /**
   * Get color for delta (green = good, red = bad)
   */
  getDeltaColor(isGood: boolean): string {
    return isGood ? '#66BB6A' : '#EF5350';
  }

  /**
   * Get delta icon
   */
  getDeltaIcon(isGood: boolean, value: number): string {
    if (value === 0) return 'remove';
    return isGood ? 'trending_down' : 'trending_up';
  }

  /**
   * Format metric value
   */
  formatUtilization(util: number | undefined): string {
    if (util === undefined) return '—';
    return (util * 100).toFixed(1);
  }

  /**
   * Format delta percentage
   */
  formatDeltaPercent(percent: number): string {
    return (percent > 0 ? '+' : '') + percent.toFixed(1) + '%';
  }
}
