import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * What-If Slider Component (Level 2)
 * Allows user to adjust capacity and see projected impact
 * Emits (onCapacityChange) when slider changes
 */
@Component({
  selector: 'app-what-if-slider',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSliderModule, MatCardModule, MatIconModule, MatTooltipModule],
  templateUrl: './what-if-slider.component.html',
  styleUrls: ['./what-if-slider.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatIfSliderComponent {
  @Input() currentCapacity: number = 100;
  @Input() nodeOrEdgeId: string = '';
  @Input() targetType: 'node' | 'edge' = 'node';

  @Output() onCapacityChange = new EventEmitter<{ id: string; newCapacity: number }>();

  sliderValue: number = 100;
  minValue = 50;
  maxValue = 300;

  ngOnInit(): void {
    this.sliderValue = 100;
  }

  /**
   * Format slider value as percentage of current capacity
   */
  get newCapacity(): number {
    return (this.currentCapacity * this.sliderValue) / 100;
  }

  /**
   * Get percentage change label
   */
  get changePercent(): number {
    return this.sliderValue - 100;
  }

  /**
   * Get change color (red for decrease, green for increase)
   */
  get changeColor(): string {
    if (this.changePercent > 0) return '#66BB6A'; // Green
    if (this.changePercent < 0) return '#EF5350'; // Red
    return '#666666'; // Gray
  }

  /**
   * Handle slider change
   */
  onSliderChange(): void {
    this.onCapacityChange.emit({
      id: this.nodeOrEdgeId,
      newCapacity: this.newCapacity,
    });
  }

  /**
   * Get target label
   */
  get targetLabel(): string {
    return this.targetType === 'node' ? 'Node' : 'Edge';
  }

  /**
   * Get min readable value
   */
  get minReadable(): number {
    return (this.currentCapacity * this.minValue) / 100;
  }

  /**
   * Get max readable value
   */
  get maxReadable(): number {
    return (this.currentCapacity * this.maxValue) / 100;
  }
}
