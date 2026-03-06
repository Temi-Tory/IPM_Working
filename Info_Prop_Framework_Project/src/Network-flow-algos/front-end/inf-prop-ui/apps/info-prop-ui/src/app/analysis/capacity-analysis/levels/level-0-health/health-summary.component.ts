import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Level0Story } from '../../state/capacity-story.models';

/**
 * Health Summary Component (Level 0)
 * Answers: "Is this network healthy?"
 * 
 * Displays network health status with adaptive UI based on network size:
 * - Small networks: Show observations + metrics
 * - Large networks: Single summary card
 * - Medium: Adaptive intermediate
 */
@Component({
  selector: 'app-health-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './health-summary.component.html',
  styleUrls: ['./health-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthSummaryComponent {
  @Input() data!: Level0Story;
  protected readonly Math = Math;

  /**
   * Determine if we show detailed observations or compact summary
   */
  get showDetails(): boolean {
    return this.data.networkSize === 'small' || this.data.networkSize === 'medium';
  }

  /**
   * Get severity color for status display
   */
  get severityColor(): string {
    switch (this.data.severity) {
      case 'good':
        return '#66BB6A'; // Solarized green
      case 'warning':
        return '#FFA726'; // Solarized orange
      case 'critical':
        return '#EF5350'; // Solarized red
      default:
        return '#90CAF9'; // Solarized blue
    }
  }

  /**
   * Get severity icon
   */
  get severityIcon(): string {
    switch (this.data.severity) {
      case 'good':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Get severity label
   */
  get severityLabel(): string {
    return this.data.severity.charAt(0).toUpperCase() + this.data.severity.slice(1);
  }

  /**
   * Get status message
   */
  get statusMessage(): string {
    if (this.data.isHealthy) {
      return 'Network is operating normally';
    } else if (this.data.severity === 'critical') {
      return 'Network has critical bottlenecks requiring immediate attention';
    } else {
      return 'Network has warning-level utilization. Consider upgrades.';
    }
  }
}
