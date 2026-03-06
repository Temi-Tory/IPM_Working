import { Component, Input } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

export type Severity = 'good' | 'warning' | 'critical';

/**
 * Displays a single metric in a colored card with severity indicator
 * Reusable across Level 0-2 for health metrics
 */
@Component({
  selector: 'app-metrics-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './metrics-card.component.html',
  styleUrls: ['./metrics-card.component.scss']
})
export class MetricsCardComponent {
  @Input() label: string = '';
  @Input() value: number = 0;
  @Input() unit: string = '';
  @Input() severity: Severity = 'good';

  getSeverityClass(): string {
    return `severity-${this.severity}`;
  }

  getIcon(): string {
    switch (this.severity) {
      case 'critical':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'good':
        return '✓';
      default:
        return '';
    }
  }
}
