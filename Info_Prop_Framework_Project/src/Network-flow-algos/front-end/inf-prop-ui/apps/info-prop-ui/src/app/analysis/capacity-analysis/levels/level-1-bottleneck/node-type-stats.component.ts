import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Level1Story } from '../../state/capacity-story.models';

/**
 * Node Type Stats Component (Level 1)
 * Displays chip breakdown of node types with icons and stats
 * Shows: count + average utilization per node type
 */
@Component({
  selector: 'app-node-type-stats',
  standalone: true,
  imports: [CommonModule, MatChipsModule, MatIconModule, MatTooltipModule],
  templateUrl: './node-type-stats.component.html',
  styleUrls: ['./node-type-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeTypeStatsComponent {
  @Input() stats: Array<{ type: string; count: number; avgUtilization: number; icon: string }> = [];

  /**
   * Get color for node type
   */
  getTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      Source: '#66BB6A', // Green
      Sink: '#EF5350', // Red
      Fork: '#29B6F6', // Blue
      Join: '#AB47BC', // Purple
      Regular: '#FFA726', // Orange
    };
    return colorMap[type] || '#90CAF9';
  }

  /**
   * Get icon for node type (fallback)
   */
  getTypeIcon(icon: string): string {
    return icon || 'device_hub';
  }

  /**
   * Format utilization percentage
   */
  formatUtilization(util: number): string {
    return (util * 100).toFixed(0) + '%';
  }
}
