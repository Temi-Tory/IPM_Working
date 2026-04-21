import { Component, inject, signal, computed, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { firstValueFrom } from 'rxjs';

import { SystemProfileService } from '../../shared/services/system-profile.service';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { AnalysisFileGroup } from '../../shared/models/network-analysis.models';
import {
  SystemProfileData,
  PROFILE_METRICS
} from '../../shared/models/system-profile.models';

import { MetricsHeatmapComponent } from './components/metricsheatmap.component';
import { HotspotAlertsComponent } from './components/hotspot-alerts.component';
import { CrossScenarioInsightsComponent } from './components/cross-scenario-insights.component';
import { NetworkLensComponent } from './components/network-lens.component';

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
    MatTabsModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatExpansionModule,
    MetricsHeatmapComponent,
    HotspotAlertsComponent,
    CrossScenarioInsightsComponent,
    NetworkLensComponent
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
  actionMessage = signal<string | null>(null);
  activeTabIndex = signal(0);
  selectedScenario = signal('');
  selectedGraphFocus = signal('capacity-bottlenecks');
  isRerunning = signal(false);

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
  scenarioNames = computed(() => this.metricRows().map(r => r.scenario));
  rerunnableGroups = computed(() => this.getRerunnableGroups());
  remainingRerunnableGroups = computed(() => this.getRemainingRerunnableGroups());
  rerunnableCount = computed(() => this.rerunnableGroups().length);
  remainingRerunnableCount = computed(() => this.remainingRerunnableGroups().length);
  graphFocusOptions = computed(() => {
    const scenario = this.scenarioResults().get(this.selectedScenario());
    if (!scenario) {
      return [] as Array<{ key: string; label: string; description: string }>;
    }

    const options: Array<{ key: string; label: string; description: string }> = [];

    if (scenario.capacityAnalysis) {
      const raw = scenario.capacityAnalysis.raw_capacity_result;
      const comp = scenario.capacityAnalysis.comparative_analysis;

      const hasBottlenecks = Object.keys(raw?.bottlenecks ?? {}).length > 0;
      const hasCriticalPaths = Object.keys(raw?.critical_paths ?? {}).length > 0;
      const hasUpgrades = (comp?.upgrade_priorities?.length ?? 0) > 0;

      if (hasBottlenecks) {
        options.push({
          key: 'capacity-bottlenecks',
          label: 'Capacity Bottlenecks',
          description: 'Saturated and bottleneck-related nodes from capacity analysis'
        });
      }
      if (hasUpgrades) {
        options.push({
          key: 'capacity-upgrades',
          label: 'Upgrade Priorities',
          description: 'Priority upgrade nodes from comparative capacity outputs'
        });
      }
      if (hasCriticalPaths) {
        options.push({
          key: 'capacity-critical-paths',
          label: 'Capacity Critical Paths',
          description: 'Nodes appearing in critical path sets in capacity outputs'
        });
      }
    }

    if (scenario.cpmAnalysis) {
      options.push({
        key: 'cpm-critical-nodes',
        label: 'CPM Critical Nodes',
        description: 'Critical nodes from time/cost critical-path computations'
      });
    }

    if (scenario.exactInference) {
      options.push({
        key: 'reachability-low-belief',
        label: 'Low Belief / High Uncertainty',
        description: 'Lowest-belief nodes from probability propagation belief outputs'
      });
    }

    if (scenario.diamondAnalysis) {
      options.push({
        key: 'diamond-structure',
        label: 'Diamond Structure Nodes',
        description: 'Conditioning and relevant nodes from root diamond structures'
      });
    }

    return options;
  });
  selectedGraphFocusLabel = computed(() => {
    const match = this.graphFocusOptions().find(o => o.key === this.selectedGraphFocus());
    return match?.label ?? 'Graph Focus';
  });
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
    if (savedState?.uiState) {
      if (savedState.uiState.profileData) {
        this.profileData.set(savedState.uiState.profileData);
      }
      if (typeof savedState.uiState.activeTabIndex === 'number') {
        this.activeTabIndex.set(savedState.uiState.activeTabIndex);
      }
      if (typeof savedState.uiState.selectedScenario === 'string') {
        this.selectedScenario.set(savedState.uiState.selectedScenario);
      }
      if (typeof savedState.uiState.selectedGraphFocus === 'string') {
        this.selectedGraphFocus.set(savedState.uiState.selectedGraphFocus);
      }
      if (savedState.uiState.profileData) {
        this.syncSelectionDefaults();
        return;
      }
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
        {
          profileData: this.profileData(),
          activeTabIndex: this.activeTabIndex(),
          selectedScenario: this.selectedScenario(),
          selectedGraphFocus: this.selectedGraphFocus()
        }
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
        this.syncSelectionDefaults();
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(`${err.message || err}`);
        this.isLoading.set(false);
      }
    });
  }

  async rerunAllAnalyses(): Promise<void> {
    await this.runAnalysisGroups(this.rerunnableGroups(), 'all available analyses');
  }

  async rerunRemainingAnalyses(): Promise<void> {
    await this.runAnalysisGroups(this.remainingRerunnableGroups(), 'remaining analyses');
  }

  onCellSelected(event: { scenario: string; metricKey: string; source: string }): void {
    this.selectedScenario.set(event.scenario);
    this.syncGraphFocusDefaults();
  }

  onScenarioSelectionChanged(scenario: string): void {
    this.selectedScenario.set(scenario);
    this.syncGraphFocusDefaults();
  }

  onGraphFocusChanged(graphFocus: string): void {
    this.selectedGraphFocus.set(graphFocus);
  }

  onNetworkLensNodeSelected(event: { nodeId: string; scenario: string; focus: string }): void {
    console.log(`[SystemProfile] Network lens node selected: ${event.nodeId} in scenario ${event.scenario}`);
    // Ensure the selected scenario is active
    this.selectedScenario.set(event.scenario);
    // You can optionally navigate to a detailed view or highlight related metrics
    this.actionMessage.set(`Selected node ${event.nodeId} in ${event.focus} context`);
    setTimeout(() => this.actionMessage.set(null), 3000);
  }

  onNetworkLensEdgeSelected(event: { source: string; target: string; scenario: string }): void {
    console.log(`[SystemProfile] Network lens edge selected: ${event.source}->${event.target} in scenario ${event.scenario}`);
    // Ensure the selected scenario is active
    this.selectedScenario.set(event.scenario);
    this.actionMessage.set(`Selected edge ${event.source}→${event.target}`);
    setTimeout(() => this.actionMessage.set(null), 3000);
  }

  onCellClicked(event: { scenario: string; metricKey: string; source: string }): void {
    this.onCellSelected(event);
    const routeMap: Record<string, string> = {
      capacity: '/capacity-analysis',
      cpm: '/time-analysis',
      reachability: '/probability-propagation',
      diamond: '/diamonds'
    };
    const route = routeMap[event.source] || '/structure';
    this.router.navigate([route], {
      queryParams: { scenario: event.scenario, highlight: event.metricKey }
    });
  }

  onTabIndexChanged(index: number): void {
    this.activeTabIndex.set(index);
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

  private syncSelectionDefaults(): void {
    const scenarios = this.scenarioNames();
    if (scenarios.length > 0 && !scenarios.includes(this.selectedScenario())) {
      this.selectedScenario.set(scenarios[0]);
    }
    this.syncGraphFocusDefaults();
  }

  private syncGraphFocusDefaults(): void {
    const options = this.graphFocusOptions();
    if (options.length > 0 && !options.some(o => o.key === this.selectedGraphFocus())) {
      this.selectedGraphFocus.set(options[0].key);
    }
  }

  private getRerunnableGroups(): AnalysisFileGroup[] {
    return this.analysisStateService
      .getAvailableAnalysisGroups()
      .filter(group =>
        group.canRunAnalysis &&
        (group.analysisType === 'network' ||
          group.analysisType === 'reachability' ||
          group.analysisType === 'capacity' ||
          group.analysisType === 'cpm')
      );
  }

  private getRemainingRerunnableGroups(): AnalysisFileGroup[] {
    return this.getRerunnableGroups().filter(group => !this.isGroupCompleted(group));
  }

  private isGroupCompleted(group: AnalysisFileGroup): boolean {
    if (group.analysisType === 'network') {
      return !!this.analysisStateService.networkData();
    }

    const scenarioName = group.scenarioName ?? '';
    if (!scenarioName) {
      return false;
    }

    if (group.analysisType === 'reachability') {
      return !!this.analysisStateService.multiScenarioReachabilityResults()?.scenarios?.has(scenarioName);
    }

    if (group.analysisType === 'capacity') {
      return !!this.analysisStateService.multiScenarioCapacityResults()?.scenarios?.has(scenarioName);
    }

    if (group.analysisType === 'cpm') {
      return !!this.analysisStateService.multiScenarioCpmResults()?.scenarios?.has(scenarioName);
    }

    return false;
  }

  private async runAnalysisGroups(groups: AnalysisFileGroup[], description: string): Promise<void> {
    if (groups.length === 0 || this.isRerunning()) {
      this.actionMessage.set(`No ${description} to run.`);
      this.generateProfile();
      return;
    }

    this.isRerunning.set(true);
    this.actionMessage.set(`Running ${groups.length} ${description}...`);
    this.error.set(null);

    const failures: string[] = [];

    for (const group of groups) {
      try {
        await firstValueFrom(this.analysisStateService.runAnalysisFromFileGroup(group));
      } catch {
        failures.push(`${group.analysisType}${group.scenarioName ? `:${group.scenarioName}` : ''}`);
      }
    }

    this.isRerunning.set(false);

    if (failures.length > 0) {
      this.actionMessage.set(`Completed with ${failures.length} issue(s): ${failures.join(', ')}`);
    } else {
      this.actionMessage.set(`Completed ${groups.length} ${description}.`);
    }

    this.generateProfile();
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
