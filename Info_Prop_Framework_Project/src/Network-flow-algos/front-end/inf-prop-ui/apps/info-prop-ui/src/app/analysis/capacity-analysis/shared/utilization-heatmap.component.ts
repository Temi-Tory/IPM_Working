import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Displays utilization as a gradient heatmap bar
 * Green (healthy) → Yellow → Red (overused)
 * Reusable for node/edge tables across Level 1 & 3
 */
@Component({
  selector: 'app-utilization-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './utilization-heatmap.component.html',
  styleUrls: ['./utilization-heatmap.component.scss']
})
export class UtilizationHeatmapComponent {
  @Input() set utilization(value: number) {
    this.utilizationSignal.set(Math.max(0, Math.min(1, value)));
  }

  utilizationSignal = signal<number>(0);

  gradientColor = computed(() => {
    const util = this.utilizationSignal();
    if (util < 0.5) {
      // Green to yellow
      const ratio = util * 2;
      return this.interpolateColor('#2ecc71', '#f39c12', ratio);
    } else {
      // Yellow to red
      const ratio = (util - 0.5) * 2;
      return this.interpolateColor('#f39c12', '#e74c3c', ratio);
    }
  });

  percentageText = computed(() => `${Math.round(this.utilizationSignal() * 100)}%`);

  private interpolateColor(color1: string, color2: string, ratio: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
  }
}
