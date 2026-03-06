/**
 * Capacity Analysis Shell Component
 * 
 * Progressive-Revelation UI: Navigates through 4 levels of analysis
 * Level 0: Health Check - Is the network sufficient?
 * Level 1: Bottleneck Explorer - Where are the constraints?
 * Level 2: Upgrade Planner - How to fix? (with what-if sliders)
 * Level 3: Engineer Deep-Dive - Full details & export
 * 
 * Supports scenario comparison overlay at each level.
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { CapacityAnalysisStateService } from '../state/capacity-analysis-state.service';

// Shared components
import { ScenarioSelectorComponent } from '../shared/scenario-selector.component';
import { ComparisonOverlayComponent } from '../shared/comparison-overlay.component';

// Level components
import { HealthSummaryComponent } from '../levels/level-0-health/health-summary.component';
import { BottleneckTableComponent } from '../levels/level-1-bottleneck/bottleneck-table.component';
import { NodeTypeStatsComponent } from '../levels/level-1-bottleneck/node-type-stats.component';
import { SourceSinkSummaryComponent } from '../levels/level-1-bottleneck/source-sink-summary.component';
import { BeforeAfterMetricsComponent } from '../levels/level-2-upgrade/before-after-metrics.component';
import { UpgradePlannerComponent } from '../levels/level-2-upgrade/upgrade-planner.component';
import { FullResultsTableComponent } from '../levels/level-3-engineer/full-results-table.component';
import { FlowDecompositionComponent } from '../levels/level-3-engineer/flow-decomposition.component';
import { ExportControlsComponent } from '../levels/level-3-engineer/export-controls.component';

@Component({
  selector: 'app-capacity-analysis-shell',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatCardModule,
    MatDividerModule,
    MatSlideToggleModule,
    // Shared
    ScenarioSelectorComponent,
    ComparisonOverlayComponent,
    // Levels
    HealthSummaryComponent,
    BottleneckTableComponent,
    NodeTypeStatsComponent,
    SourceSinkSummaryComponent,
    BeforeAfterMetricsComponent,
    UpgradePlannerComponent,
    FullResultsTableComponent,
    FlowDecompositionComponent,
    ExportControlsComponent,
  ],
  template: `
    <!-- Header with Title -->
    <mat-toolbar color="primary" class="toolbar">
      <span>Network Capacity Analysis</span>
      <span class="spacer"></span>
      @if (state.isLoading()) {
        <mat-spinner diameter="30" class="loading-spinner"></mat-spinner>
      }
    </mat-toolbar>

    <!-- Main Shell Container -->
    <div class="shell-container">
      <!-- Left Sidebar: Scenario & Level Navigation -->
      <aside class="sidebar">
        <!-- Scenario Selector -->
        <section class="scenario-section">
          <h3 class="sidebar-title">Scenario</h3>
          <app-scenario-selector
            [scenarios]="state.availableScenarios()"
            [currentScenario]="state.currentScenarioName()"
            [currentLevel]="state.currentLevel()"
            (scenarioChange)="onScenarioChange($event)"
            (levelChange)="onLevelChange($event)">
          </app-scenario-selector>
        </section>

        <mat-divider class="sidebar-divider"></mat-divider>

        <!-- Level Navigation Tabs -->
        <section class="levels-section">
          <h3 class="sidebar-title">Analysis Level</h3>
          <div class="level-tabs">
            <button 
              mat-button 
              class="level-tab"
              [class.active]="state.currentLevel() === 0"
              (click)="onLevelChange(0)">
              <mat-icon class="level-icon">healing</mat-icon>
              <span>Health Check</span>
              <span class="level-number">0</span>
            </button>
            <button 
              mat-button 
              class="level-tab"
              [class.active]="state.currentLevel() === 1"
              (click)="onLevelChange(1)">
              <mat-icon class="level-icon">warning</mat-icon>
              <span>Bottlenecks</span>
              <span class="level-number">1</span>
            </button>
            <button 
              mat-button 
              class="level-tab"
              [class.active]="state.currentLevel() === 2"
              (click)="onLevelChange(2)">
              <mat-icon class="level-icon">trending_up</mat-icon>
              <span>Upgrade Plan</span>
              <span class="level-number">2</span>
            </button>
            <button 
              mat-button 
              class="level-tab"
              [class.active]="state.currentLevel() === 3"
              (click)="onLevelChange(3)">
              <mat-icon class="level-icon">engineering</mat-icon>
              <span>Engineer Mode</span>
              <span class="level-number">3</span>
            </button>
          </div>
        </section>

        <mat-divider class="sidebar-divider"></mat-divider>

        <!-- Quick Actions -->
        <section class="actions-section">
          <h3 class="sidebar-title">Actions</h3>
          <button 
            mat-raised-button 
            color="accent"
            class="action-btn"
            [disabled]="!state.currentScenarioName()"
            (click)="onRunScenario()">
            <mat-icon>play_arrow</mat-icon>
            Run Analysis
          </button>
          @if (state.availableScenarios().length >= 2) {
            <button 
              mat-stroked-button 
              class="action-btn"
              [class.active]="state.uiState().comparisonScenario !== null"
              (click)="toggleComparison()">
              <mat-icon>compare_arrows</mat-icon>
              Compare Scenarios
            </button>
          }
          <button 
            mat-stroked-button 
            class="action-btn"
            (click)="onClearAll()">
            <mat-icon>clear_all</mat-icon>
            Clear All
          </button>
        </section>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        <!-- Error State -->
        @if (state.error()) {
          <mat-card class="error-card">
            <mat-card-header>
              <mat-icon class="error-icon">error_outline</mat-icon>
              <span class="error-title">Analysis Error</span>
            </mat-card-header>
            <mat-card-content>
              <p>{{ state.error() }}</p>
            </mat-card-content>
            <mat-card-actions>
              <button mat-button (click)="onClearAll()">Retry</button>
            </mat-card-actions>
          </mat-card>
        } @else if (state.currentStory()) {
          <!-- Level Breadcrumb -->
          <div class="level-breadcrumb">
            <span class="breadcrumb-label">Current Level:</span>
            @switch (state.currentLevel()) {
              @case (0) {
                <span class="breadcrumb-text">
                  <mat-icon>healing</mat-icon> Health Check - Is the network sufficient?
                </span>
              }
              @case (1) {
                <span class="breadcrumb-text">
                  <mat-icon>warning</mat-icon> Bottleneck Explorer - Where are the constraints?
                </span>
              }
              @case (2) {
                <span class="breadcrumb-text">
                  <mat-icon>trending_up</mat-icon> Upgrade Planner - How to fix?
                </span>
              }
              @case (3) {
                <span class="breadcrumb-text">
                  <mat-icon>engineering</mat-icon> Engineer Deep-Dive - Full details &amp; export
                </span>
              }
            }
          </div>

          <!-- Content: Render ONE Level at a Time -->
          <div class="level-content">
            @switch (state.currentLevel()) {
              <!-- LEVEL 0: Health Summary -->
              @case (0) {
                @if (state.level0Data()) {
                  <app-health-summary [data]="state.level0Data()!"></app-health-summary>
                }
              }
              <!-- LEVEL 1: Bottleneck Explorer -->
              @case (1) {
                @if (state.level1Data()) {
                  <section class="level-section">
                    <h2 class="section-title">Node & Edge Type Summary</h2>
                    <app-node-type-stats 
                      [stats]="state.level1Data()!.nodeTypeStats">
                    </app-node-type-stats>
                  </section>

                  <mat-divider></mat-divider>

                  <section class="level-section">
                    <h2 class="section-title">Bottleneck Table</h2>
                    <app-bottleneck-table
                      [nodes]="state.level1Data()!.bottleneckNodes"
                      [edges]="state.level1Data()!.bottleneckEdges"
                      [searchTerm]="state.uiState().searchTerm">
                    </app-bottleneck-table>
                  </section>

                  <mat-divider></mat-divider>

                  <section class="level-section">
                    <h2 class="section-title">Source &amp; Sink Analysis</h2>
                    <app-source-sink-summary
                      [sourceFlows]="state.level1Data()!.sourceFlowPaths"
                      [sinkSummary]="state.level1Data()!.sinkSummary">
                    </app-source-sink-summary>
                  </section>
                } @else {
                  <div class="empty-state">
                    <mat-icon>inbox</mat-icon>
                    <p>Run analysis to see bottleneck details</p>
                  </div>
                }
              }
              <!-- LEVEL 2: Upgrade Planner -->
              @case (2) {
                @if (state.level2Data()) {
                  <section class="level-section">
                    <h2 class="section-title">Before/After Metrics</h2>
                    <app-before-after-metrics
                      [currentMetrics]="state.level2Data()!.currentState"
                      [whatIfMetrics]="state.level2Data()!.whatIfResults ? {
                        networkUtilization: state.level2Data()!.whatIfResults!.projectedNetworkUtilization,
                        maxUtilization: state.level2Data()!.whatIfResults!.projectedMaxUtilization,
                        bottleneckCount: state.level2Data()!.whatIfResults!.projectedBottleneckCount
                      } : undefined">
                    </app-before-after-metrics>
                  </section>

                  <mat-divider></mat-divider>

                  <section class="level-section">
                    <h2 class="section-title">Upgrade Recommendations</h2>
                    <app-upgrade-planner
                      [recommendations]="state.level2Data()!.recommendations"
                      [currentState]="state.level2Data()!.currentState">
                    </app-upgrade-planner>
                  </section>
                } @else {
                  <div class="empty-state">
                    <mat-icon>inbox</mat-icon>
                    <p>Run analysis to see upgrade recommendations</p>
                  </div>
                }
              }
              <!-- LEVEL 3: Engineer Deep-Dive -->
              @case (3) {
                @if (state.level3Data()) {
                  <section class="level-section">
                    <h2 class="section-title">Complete Results Table</h2>
                    <app-full-results-table
                      [nodes]="state.level3Data()!.allNodes"
                      [edges]="state.level3Data()!.allEdges">
                    </app-full-results-table>
                  </section>

                  <mat-divider></mat-divider>

                  <section class="level-section">
                    <h2 class="section-title">Flow Decomposition</h2>
                    <app-flow-decomposition 
                      [decomposition]="state.level3Data()!.flowDecomposition">
                    </app-flow-decomposition>
                  </section>

                  <mat-divider></mat-divider>

                  <section class="level-section">
                    <h2 class="section-title">Export Data</h2>
                    <app-export-controls
                      [scenarioName]="state.currentScenarioName()"
                      [rawData]="state.level3Data()!.rawData">
                    </app-export-controls>
                  </section>
                } @else {
                  <div class="empty-state">
                    <mat-icon>inbox</mat-icon>
                    <p>Run analysis to see detailed results</p>
                  </div>
                }
              }
            }
          </div>
        } @else {
          <!-- Empty State: No Data -->
          <div class="empty-state large">
            <mat-icon>inbox</mat-icon>
            <h2>No Scenario Loaded</h2>
            <p>Select a scenario from the left sidebar and click "Run Analysis" to begin.</p>
          </div>
        }

        <!-- Comparison Overlay -->
        @if (state.uiState().comparisonScenario) {
          <app-comparison-overlay
            [level]="state.uiState().comparisonLevel || 0"
            [compareScenario]="state.uiState().comparisonScenario!"
            [baseScenario]="state.currentScenarioName()"
            (closeOverlay)="state.setComparison(null)">
          </app-comparison-overlay>
        }
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      background: var(--background-color);
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .loading-spinner {
      margin-right: 16px;
    }

    /* Shell Layout: Sidebar + Main */
    .shell-container {
      display: flex;
      height: calc(100vh - 64px);
      gap: 0;
    }

    /* Sidebar: 280px fixed width */
    .sidebar {
      width: 280px;
      background: var(--surface-color);
      border-right: 1px solid var(--border-color);
      padding: 16px;
      overflow-y: auto;
      flex-shrink: 0;
      box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
    }

    .sidebar-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 12px 0 8px 0;
      color: var(--text-secondary);
    }

    .sidebar-divider {
      margin: 16px 0;
    }

    /* Scenario Section */
    .scenario-section {
      margin-bottom: 12px;
    }

    /* Level Navigation Tabs */
    .levels-section {
      margin-bottom: 12px;
    }

    .level-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .level-tab {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
      height: 40px;
      padding: 0 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      background: var(--background-color);
      color: var(--text-secondary);
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .level-tab:hover {
      background: var(--surface-variant-light);
      color: var(--text-primary);
    }

    .level-tab.active {
      background: var(--primary-color-light);
      color: var(--primary-color);
      border: 1px solid var(--primary-color);
      font-weight: 600;
    }

    .level-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .level-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--background-color);
      font-size: 10px;
      font-weight: 700;
      margin-left: auto;
      flex-shrink: 0;
    }

    .level-tab.active .level-number {
      background: var(--primary-color);
      color: white;
    }

    /* Actions Section */
    .actions-section {
      margin-bottom: 12px;
    }

    .action-btn {
      width: 100%;
      margin-bottom: 8px;
      font-size: 12px;
      height: 36px;
    }

    .action-btn.active {
      background-color: var(--accent-color-light);
      color: var(--accent-color);
    }

    /* Main Content Area */
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px 40px;
      background: var(--background-color);
    }

    /* Level Breadcrumb */
    .level-breadcrumb {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--surface-color);
      border-left: 4px solid var(--primary-color);
      border-radius: 4px;
      font-size: 14px;
    }

    .breadcrumb-label {
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 110px;
    }

    .breadcrumb-text {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-primary);
      font-weight: 500;
    }

    .breadcrumb-text mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--primary-color);
    }

    /* Level Content Sections */
    .level-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .level-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;
      color: var(--text-secondary);
    }

    .empty-state.large {
      padding: 128px 24px;
      height: 100%;
      justify-content: center;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      opacity: 0.3;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 12px 0;
    }

    .empty-state p {
      font-size: 14px;
      max-width: 400px;
      margin-top: 8px;
    }

    /* Error Card */
    .error-card {
      background: var(--error-color-light);
      border-left: 4px solid var(--error-color);
      margin-bottom: 24px;
    }

    .error-card mat-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .error-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--error-color);
    }

    .error-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--error-color);
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .sidebar {
        width: 240px;
      }

      .main-content {
        padding: 24px 32px;
      }
    }

    @media (max-width: 768px) {
      .shell-container {
        flex-direction: column;
      }

      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        padding: 12px 16px;
        max-height: 200px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .main-content {
        padding: 16px;
      }

      .level-breadcrumb {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `,
})
export class CapacityAnalysisShellComponent implements OnInit, OnDestroy {
  protected state = inject(CapacityAnalysisStateService);

  ngOnInit(): void {
    this.state.loadScenarios();
  }

  ngOnDestroy(): void {
    // Save state on destroy
    const current = this.state.uiState();
    sessionStorage.setItem('capacity-analysis-state', JSON.stringify({
      currentScenario: this.state.currentScenarioName(),
      currentLevel: this.state.currentLevel(),
    }));
  }

  // ─── Level Navigation ──────────────────────────────────────────────────

  onLevelChange(level: 0 | 1 | 2 | 3): void {
    this.state.setLevel(level);
  }

  onScenarioChange(scenarioName: string): void {
    this.state.setScenario(scenarioName);
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  async onRunScenario(): Promise<void> {
    const scenario = this.state.currentScenarioName();
    if (scenario) {
      await this.state.computeScenario(scenario);
    }
  }

  toggleComparison(): void {
    const current = this.state.uiState();
    if (current.comparisonScenario) {
      this.state.setComparison(null);
    } else {
      const scenarios = this.state.availableScenarios();
      if (scenarios.length >= 2) {
        const baseIdx = scenarios.findIndex((s) => s.name === current.currentScenario);
        const compareIdx = baseIdx === 0 ? 1 : 0;
        this.state.setComparison(scenarios[compareIdx].name, current.currentLevel);
      }
    }
  }

  onClearAll(): void {
    // Clear scenario state (to be implemented in state service)
  }
}
