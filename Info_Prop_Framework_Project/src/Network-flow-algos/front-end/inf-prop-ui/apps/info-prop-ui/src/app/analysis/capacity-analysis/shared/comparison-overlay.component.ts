import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ComparisonData {
  base: Record<string, unknown>;
  compare: Record<string, unknown>;
}

/**
 * Modal side panel showing before/after/delta for scenario comparison
 * Displays comparison for current level only
 */
@Component({
  selector: 'app-comparison-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparison-overlay.component.html',
  styleUrls: ['./comparison-overlay.component.scss']
})
export class ComparisonOverlayComponent {
  @Input() baseScenario = '';
  @Input() compareScenario = '';
  @Input() level: 0 | 1 | 2 | 3 = 0;
  @Input() data: ComparisonData | null = null;
  @Output() closeOverlay = new EventEmitter<void>();

  isOpen = signal(true);

  getKeys(): string[] {
    if (!this.data) return [];
    return Object.keys(this.data.base);
  }

  getBaseValue(key: string): unknown {
    return this.data?.base[key];
  }

  getCompareValue(key: string): unknown {
    return this.data?.compare[key];
  }

  formatValue(value: unknown): string {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '—';
    }
    return String(value);
  }

  getDelta(key: string): number {
    const base = this.getBaseValue(key);
    const compare = this.getCompareValue(key);
    if (typeof base === 'number' && typeof compare === 'number') {
      return compare - base;
    }
    return 0;
  }

  getDeltaClass(key: string): string {
    const delta = this.getDelta(key);
    if (delta > 0) return 'delta-increase';
    if (delta < 0) return 'delta-decrease';
    return 'delta-neutral';
  }

  close(): void {
    this.isOpen.set(false);
    this.closeOverlay.emit();
  }

  getLevelLabel(): string {
    const labels = ['Health Check', 'Bottlenecks', 'Flow Paths', 'Scenarios'];
    return labels[this.level] || '';
  }
}
