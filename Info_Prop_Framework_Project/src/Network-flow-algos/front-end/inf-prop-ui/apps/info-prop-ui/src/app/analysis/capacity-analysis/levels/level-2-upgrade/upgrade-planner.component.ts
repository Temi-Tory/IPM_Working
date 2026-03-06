import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UpgradeRecommendation } from '../../state/capacity-story.models';

interface CurrentState {
  networkUtilization: number;
  maxUtilization: number;
  bottleneckCount: number;
}

/**
 * Upgrade Planner Component (Level 2)
 * Shows ranked list of recommended upgrades
 * Each row shows target + current metrics + impact score
 */
@Component({
  selector: 'app-upgrade-planner',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressBarModule],
  templateUrl: './upgrade-planner.component.html',
  styleUrls: ['./upgrade-planner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradePlannerComponent {
  @Input() recommendations: UpgradeRecommendation[] = [];
  @Input() currentState!: CurrentState;

  /**
   * Get target display label
   */
  getTargetLabel(rec: UpgradeRecommendation): string {
    if (rec.target === 'node') {
      return `Node ${rec.id}`;
    } else {
      return `Edge ${rec.id}`;
    }
  }

  /**
   * Get target icon
   */
  getTargetIcon(rec: UpgradeRecommendation): string {
    return rec.target === 'node' ? 'device_hub' : 'compare_arrows';
  }

  /**
   * Get impact color (higher = greener)
   */
  getImpactColor(score: number): string {
    if (score >= 80) return '#66BB6A'; // Green
    if (score >= 60) return '#FFA726'; // Orange
    return '#FFD54F'; // Yellow
  }

  /**
   * Get priority badge
   */
  getPriorityBadge(index: number): { icon: string; text: string } {
    if (index === 0) return { icon: 'star', text: 'Priority 1' };
    if (index < 3) return { icon: 'trending_up', text: `Priority ${index + 1}` };
    return { icon: 'check', text: `Priority ${index + 1}` };
  }

  /**
   * Format capacity increase as percentage
   */
  formatIncreasePercent(percent: number): string {
    return (percent * 100).toFixed(1);
  }

  /**
   * Get expected benefit text
   */
  getBenefitText(rec: UpgradeRecommendation): string {
    if (rec.impactScore > 80) return 'High impact across network';
    if (rec.impactScore > 60) return 'Moderate benefit to downstream';
    return 'Limited network impact';
  }
}
