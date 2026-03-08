import { Component, inject, signal, computed, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SystemProfileService } from '../../shared/services/system-profile.service';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import {
  SystemProfileData,
  ScenarioMetricRow,
  PROFILE_METRICS
} from '../../shared/models/system-profile.models';

import { NetworkIdentityCardComponent } from './components/network-identity-card.component';
import { ScenarioStatusMatrixComponent } from './components/scenario-status-matrix.component';
import { MetricsHeatmapComponent } from './components/metrics-heatmap.component';
import { ScenarioCardComponent } from './components/scenario-card.component';
import { HotspotAlertsComponent } from './components/hotspot-alerts.component';
import { CrossScenarioInsightsComponent } from './components/cross-scenario-insights.component';

@Component({
  selector: 'app-system-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NetworkIdentityCardComponent,
    /* ScenarioStatusMatrixComponent, */
    MetricsHeatmapComponent,
    ScenarioCardComponent,
    HotspotAlertsComponent,
    CrossScenarioInsightsComponent
  ],
  templateUrl: './system-profile.component.html',
  styleUrl: './system-profile.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class SystemProfileComponent implements OnInit, OnDestroy {
  private profileService = inject(SystemProfileService);
  private analysisStateService = inject(AnalysisStateService);
  private router = inject(Router);

  // State
  profileData = signal<SystemProfileData | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Derived
  hasData = computed(() => this.profileData() !== null);
  networkInfo = computed(() => this.profileData()?.networkInfo);
  scenarioResults = computed(() => this.profileData()?.scenarioResults ?? new Map());
  metricRows = computed(() => this.profileData()?.metricRows ?? []);
  aggregatedMetrics = computed(() => this.profileData()?.aggregatedMetrics ?? {
    scenarioCount: 0,
    totalComputationTime: 0,
    averageComputationTime: 0,
    metricRanges: {}
  });
  hotspotAlerts = computed(() => this.profileData()?.hotspotAlerts ?? []);
  capacityOptimizations = computed(() => {
    return this.metricRows()
      .filter((row) => row.analysisTypes.includes('capacity'))
      .map((row) => {
        const utilization = this.toNumber(row.metrics['networkUtilization']);
        const efficiencyLoss = this.toNumber(row.metrics['efficiencyLoss']);
        const upgradePressure = this.toNumber(row.metrics['upgradePressure']);
        const captureRatio = this.toNumber(row.metrics['throughputCaptureRatio']);
        const spareCapacity = this.toNumber(row.metrics['totalSpareCapacity']);

        const score =
          (utilization != null ? utilization / 100 : 0) * 0.35 +
          (efficiencyLoss ?? 0) * 0.3 +
          (upgradePressure != null ? Math.min(upgradePressure / 8, 1) : 0) * 0.2 +
          (captureRatio != null ? (1 - captureRatio) : 0) * 0.15;

        return {
          scenario: row.scenario,
          utilization,
          efficiencyLoss,
          upgradePressure,
          captureRatio,
          spareCapacity,
          score,
          recommendation: this.buildCapacityRecommendation({
            utilization,
            efficiencyLoss,
            upgradePressure,
            captureRatio,
            spareCapacity
          })
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  });

  ngOnInit(): void {
    // Restore saved state if returning to this view
    const savedState = this.analysisStateService.restoreViewState('system-profile');
    if (savedState?.uiState?.profileData) {
      this.profileData.set(savedState.uiState.profileData);
      return;
    }

    this.generateProfile();
  }

  ngOnDestroy(): void {
    // Persist state for when user navigates back
    if (this.profileData()) {
      this.analysisStateService.saveViewState(
        'system-profile',
        new Map(),
        0,
        { profileData: this.profileData() }
      );
    }
  }

  generateProfile(): void {
    const networkPath = this.analysisStateService.currentNetworkPath();
    if (!networkPath) {
      this.error.set('No network loaded. Please upload a network first.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.profileService.generateSystemProfile(networkPath).subscribe({
      next: data => {
        this.profileData.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(`${err.message || err}`);
        this.isLoading.set(false);
      }
    });
  }

  onCellClicked(event: { scenario: string; metricKey: string; source: string }): void {
    const routeMap: Record<string, string> = {
      capacity: '/capacity-analysis',
      cpm: '/time-analysis',
      reachability: '/exact-inference',
      diamond: '/diamonds'
    };
    const route = routeMap[event.source] || '/structure';
    this.router.navigate([route], {
      queryParams: { scenario: event.scenario, highlight: event.metricKey }
    });
  }

  onScenarioClicked(scenario: string): void {
    // Scroll to the heatmap section — the scenario row will be visible
    const heatmapEl = document.querySelector('.heatmap-card');
    heatmapEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null) {
      return 'NA';
    }
    return `${(value * 100).toFixed(1)}%`;
  }

  formatNumber(value: number | null | undefined, digits = 1): string {
    if (value == null) {
      return 'NA';
    }
    return value.toFixed(digits);
  }

  private toNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private buildCapacityRecommendation(input: {
    utilization: number | null;
    efficiencyLoss: number | null;
    upgradePressure: number | null;
    captureRatio: number | null;
    spareCapacity: number | null;
  }): string {
    if ((input.utilization ?? 0) > 90 && (input.upgradePressure ?? 0) >= 3) {
      return 'Prioritize bottleneck upgrades first; saturation is high and upgrade demand is concentrated.';
    }
    if ((input.efficiencyLoss ?? 0) > 0.25) {
      return 'Review bottleneck topology and routing constraints to reduce efficiency loss.';
    }
    if ((input.captureRatio ?? 1) < 0.7) {
      return 'Improve source-to-target transfer by targeting constrained links and underperforming cut-sets.';
    }
    if ((input.spareCapacity ?? 0) < 1) {
      return 'Capacity headroom is low; add resilience margin on key edges/nodes.';
    }
    return 'Performance is stable; keep monitoring and apply incremental, low-cost optimizations.';
  }

}
