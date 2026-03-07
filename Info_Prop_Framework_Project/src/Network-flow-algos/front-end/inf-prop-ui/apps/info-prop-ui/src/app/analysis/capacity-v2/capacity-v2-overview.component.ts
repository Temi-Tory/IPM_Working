import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CapacityV2Store } from './capacity-v2.store';
import { CapacityV2DeterministicEntity } from './capacity-v2.models';

@Component({
  selector: 'app-capacity-v2-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './capacity-v2-overview.component.html',
  styleUrl: './capacity-v2-overview.component.scss'
})
export class CapacityV2OverviewComponent {
  readonly store = inject(CapacityV2Store);
  readonly navigate = output<string>();

  countBottlenecks(detail: CapacityV2DeterministicEntity): number {
    return (detail.bottlenecks.saturatedEdges?.length || 0) + 
           (detail.bottlenecks.saturatedNodes?.length || 0);
  }

  getBottleneckStatus(detail: CapacityV2DeterministicEntity): string {
    const count = this.countBottlenecks(detail);
    if (count === 0) return 'Excellent - No saturated components';
    if (count <= 2) return 'Good - Few bottlenecks detected';
    if (count <= 5) return 'Fair - Multiple bottlenecks present';
    return 'Poor - Many bottlenecks require attention';
  }

  getValidationStatus(detail: CapacityV2DeterministicEntity): string {
    if (detail.validation.allChecksPassed) {
      return 'All constraints satisfied';
    }
    const issues = detail.validation.errors.length + detail.validation.warnings.length;
    return `${issues} issue(s) detected`;
  }

  getUtilizationStatus(utilization: number): string {
    if (utilization < 0.3) return 'Low capacity usage';
    if (utilization < 0.6) return 'Moderate capacity usage';
    if (utilization < 0.8) return 'High capacity usage';
    return 'Near maximum capacity';
  }

  getPerformanceStatus(timeMs: number): string {
    if (timeMs < 100) return 'Very fast';
    if (timeMs < 500) return 'Fast';
    if (timeMs < 2000) return 'Moderate';
    return 'Slow (consider optimization)';
  }

  getHealthClass(metric: string, detail: CapacityV2DeterministicEntity): string {
    switch (metric) {
      case 'bottlenecks': {
        const bottleneckCount = this.countBottlenecks(detail);
        if (bottleneckCount === 0) return 'status-good';
        if (bottleneckCount <= 2) return 'status-ok';
        return 'status-warning';
      }

      case 'validation':
        return detail.validation.allChecksPassed ? 'status-good' : 'status-error';

      case 'efficiency':
        if (detail.comparative.efficiencyLoss < 0.05) return 'status-good';
        if (detail.comparative.efficiencyLoss < 0.15) return 'status-ok';
        return 'status-warning';

      default:
        return 'status-info';
    }
  }

  navigateToInputs(): void {
    this.navigate.emit('inputs');
  }
}
