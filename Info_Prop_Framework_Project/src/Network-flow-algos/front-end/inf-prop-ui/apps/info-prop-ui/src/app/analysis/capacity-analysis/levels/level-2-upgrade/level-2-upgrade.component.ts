import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Level2Story, UpgradeRecommendation } from '../../state/capacity-story.models';
import { UpgradePlannerComponent } from './upgrade-planner.component';
import { WhatIfSliderComponent } from './what-if-slider.component';
import { BeforeAfterMetricsComponent } from './before-after-metrics.component';

@Component({
  selector: 'app-level-2-upgrade',
  standalone: true,
  imports: [CommonModule, UpgradePlannerComponent, WhatIfSliderComponent, BeforeAfterMetricsComponent],
  template: `
    <div class="level-2-container">
      <app-before-after-metrics
        [currentMetrics]="data.currentState"
        [whatIfMetrics]="data.whatIfResults ? {
          networkUtilization: data.whatIfResults.projectedNetworkUtilization,
          maxUtilization: data.whatIfResults.projectedMaxUtilization,
          bottleneckCount: data.whatIfResults.projectedBottleneckCount
        } : undefined"
      ></app-before-after-metrics>

      <app-upgrade-planner
        [recommendations]="data.recommendations"
        [currentState]="data.currentState"
      ></app-upgrade-planner>

      @if (topRecommendation) {
        <app-what-if-slider
          [currentCapacity]="topRecommendation.currentCapacity"
          [nodeOrEdgeId]="topRecommendation.id"
          [targetType]="topRecommendation.target"
          (onCapacityChange)="onCapacityChange(topRecommendation)">
        </app-what-if-slider>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Level2UpgradeComponent {
  @Input() data!: Level2Story;
  @Output() upgradeSelect = new EventEmitter<UpgradeRecommendation>();

  get topRecommendation(): UpgradeRecommendation | null {
    return this.data?.recommendations?.[0] ?? null;
  }

  onCapacityChange(rec: UpgradeRecommendation): void {
    this.upgradeSelect.emit(rec);
  }
}
