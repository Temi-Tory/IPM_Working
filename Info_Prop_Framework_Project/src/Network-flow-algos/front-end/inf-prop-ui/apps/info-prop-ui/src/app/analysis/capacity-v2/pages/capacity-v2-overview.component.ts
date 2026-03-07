import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { CapacityV2Store } from '../capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-overview',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './capacity-v2-overview.component.html',
  styleUrl: './capacity-v2-overview.component.scss'
})
export class CapacityV2OverviewComponent {
  private readonly router = inject(Router);
  readonly store = inject(CapacityV2Store);

  navigateTo(route: string): void {
    this.router.navigate(['/capacity-analysis', route]);
  }

  getBottleneckCount(): number {
    const detail = this.store.activeDeterministicDetail();
    if (!detail) return 0;
    return detail.bottlenecks.saturatedEdges.length + detail.bottlenecks.saturatedNodes.length;
  }

  getNetworkHealth(): 'excellent' | 'good' | 'warning' | 'critical' {
    const summary = this.store.summary();
    if (!summary) return 'good';
    
    const util = summary.utilization;
    if (util >= 0.9) return 'critical';
    if (util >= 0.7) return 'warning';
    if (util >= 0.5) return 'good';
    return 'excellent';
  }

  getHealthIcon(): string {
    const health = this.getNetworkHealth();
    switch (health) {
      case 'excellent': return 'check_circle';
      case 'good': return 'thumb_up';
      case 'warning': return 'warning';
      case 'critical': return 'error';
    }
  }

  getHealthColor(): string {
    const health = this.getNetworkHealth();
    switch (health) {
      case 'excellent': return '#4caf50';
      case 'good': return '#8bc34a';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
    }
  }
}
