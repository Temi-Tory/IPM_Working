import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Level3Story } from '../../state/capacity-story.models';

interface FlowDecompositionSource {
  nodeId: number;
  outputRate: number;
  flowDecomposition: Array<{
    pathToSink: string;
    flowAmount: number;
    percentOfSource: number;
  }>;
}

/**
 * Flow Decomposition Component (Level 3)
 * Shows narrative breakdown of how flow moves through network
 * Displays path trees with flow percentages at each hop
 */
@Component({
  selector: 'app-flow-decomposition',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatExpansionModule, MatTooltipModule],
  templateUrl: './flow-decomposition.component.html',
  styleUrls: ['./flow-decomposition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowDecompositionComponent {
  @Input() decomposition: { sources: FlowDecompositionSource[] } = { sources: [] };

  /**
   * Format percentage
   */
  formatPercent(percent: number): string {
    return (percent * 100).toFixed(1);
  }

  /**
   * Get contribution color
   */
  getContributionColor(percent: number): string {
    if (percent >= 0.5) return '#66BB6A'; // Green
    if (percent >= 0.3) return '#FFD54F'; // Yellow
    if (percent >= 0.1) return '#FFA726'; // Orange
    return '#BDBDBD'; // Gray
  }

  /**
   * Get path severity based on percentage
   */
  getPathSeverity(percent: number): 'primary' | 'accent' | 'warn' {
    if (percent >= 0.5) return 'primary';
    if (percent >= 0.2) return 'accent';
    return 'warn';
  }
}
