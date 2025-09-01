import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatSortModule } from '@angular/material/sort';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisService } from '../../shared/services/diamond-analysis.service';
import {
  ScenarioInfo,
  DiamondAnalysisResult,
  DiamondSummary,
  ConvergenceInsight,
  JoinNodeAnalysis,
  DiamondPattern
} from '../../shared/models/network-analysis.models';

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatSortModule,
    MatExpansionModule,
    FormsModule
  ],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent implements OnInit {
  private analysisStateService = inject(AnalysisStateService);
  private diamondAnalysisService = inject(DiamondAnalysisService);

  // State Management
  currentScenario = signal<string>('');
  selectedTab = signal<number>(0);
  
  // Data Processing - Computed Properties
  availableScenarios = computed(() => {
    // Get scenarios from parsed data
    const parsedData = this.analysisStateService.parsedData();
    if (!parsedData) return [];
    
    const scenarios: ScenarioInfo[] = [];
    
    // Extract scenarios from parsed data structure
    if (parsedData.float) scenarios.push({
      name: 'float',
      dataType: 'float',
      displayName: 'Float Analysis',
      path: 'float'
    });
    if (parsedData.interval) scenarios.push({
      name: 'interval',
      dataType: 'interval',
      displayName: 'Interval Analysis',
      path: 'interval'
    });
    if (parsedData.pbox) scenarios.push({
      name: 'pbox',
      dataType: 'pbox',
      displayName: 'P-Box Analysis',
      path: 'pbox'
    });
    
    return scenarios;
  });

  // Get multi-scenario diamond results or fallback to single analysis
  multiScenarioResults = computed(() => this.analysisStateService.multiScenarioDiamondResults());
  
  // Get current diamond analysis data - either from multi-scenario or single analysis
  currentDiamondResults = computed(() => {
    const multiResults = this.multiScenarioResults();
    const currentScenario = this.currentScenario();
    
    // Try multi-scenario first
    if (multiResults && currentScenario) {
      return multiResults.scenarios.get(currentScenario) || null;
    }
    
    // Fallback to single diamond analysis
    const diamondAnalysis = this.analysisStateService.diamondAnalysis();
    return diamondAnalysis?.diamond_analysis || null;
  });

  diamondSummary = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing diamond summary for scenario:', scenario);
    return this.processDiamondSummary();
  });
  
  convergenceInsights = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing convergence insights for scenario:', scenario);
    return this.analyzeConvergencePatterns();
  });
  
  coverageMetrics = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing coverage metrics for scenario:', scenario);
    return this.calculateNetworkCoverage();
  });
  
  joinNodeAnalysis = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing join node analysis for scenario:', scenario);
    return this.analyzeJoinNodes();
  });

  // Diamond patterns computed property for reactive updates
  diamondPatterns = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing diamond patterns for scenario:', scenario);
    return this.getDiamondPatterns();
  });

  // UI State
  isLoading = computed(() => this.analysisStateService.isLoading());
  error = computed(() => this.analysisStateService.error());

  // Table configuration
  displayedColumns: string[] = ['nodeCount', 'isRoot', 'complexity', 'actions'];
  
  ngOnInit(): void {
    // Initialize with first available scenario
    const scenarios = this.availableScenarios();
    if (scenarios.length > 0 && !this.currentScenario()) {
      this.setCurrentScenario(scenarios[0].name);
    }
    
    // Load multi-scenario diamond analysis if we have scenarios but no multi-scenario data
    if (scenarios.length > 0 && !this.multiScenarioResults()) {
      this.loadMultiScenarioDiamondAnalysis();
    }
  }

  // Scenario Management
  setCurrentScenario(scenarioName: string): void {
    console.log('🔄 Changing diamond analysis scenario from', this.currentScenario(), 'to', scenarioName);
    this.currentScenario.set(scenarioName);
    this.analysisStateService.setCurrentDiamondScenario(scenarioName);
    
    // Force recomputation by accessing computed properties
    const summary = this.diamondSummary();
    const patterns = this.diamondPatterns();
    const coverage = this.coverageMetrics();
    const insights = this.convergenceInsights();
    const joinAnalysis = this.joinNodeAnalysis();
    
    console.log('✅ Scenario change complete. New data:', {
      scenario: scenarioName,
      summaryExists: !!summary,
      patternsCount: patterns?.length || 0,
      coveragePercentage: coverage?.percentage || 0
    });
  }

  // Load multi-scenario diamond analysis
  private loadMultiScenarioDiamondAnalysis(): void {
    const networkPath = this.analysisStateService.currentNetworkPath();
    if (networkPath) {
      console.log('🔄 Loading multi-scenario diamond analysis for:', networkPath);
      this.analysisStateService.loadMultiScenarioDiamondAnalysis(networkPath).subscribe({
        next: () => {
          console.log('✅ Multi-scenario diamond analysis loaded successfully');
        },
        error: (error) => {
          console.error('❌ Failed to load multi-scenario diamond analysis:', error);
        }
      });
    }
  }

  getScenarioDisplayName(scenario: ScenarioInfo): string {
    return scenario.displayName || `${scenario.name} (${scenario.dataType.toUpperCase()})`;
  }

  getDataTypeColor(dataType: string): string {
    switch (dataType) {
      case 'float': return 'primary';
      case 'interval': return 'accent';
      case 'pbox': return 'warn';
      default: return 'primary';
    }
  }

  // Tab Management
  onTabChange(index: number): void {
    this.selectedTab.set(index);
  }

  // Data Processing Methods
  private processDiamondSummary(): DiamondSummary | null {
    const results = this.currentDiamondResults();
    if (!results) return null;

    return this.diamondAnalysisService.processDiamondSummary(results);
  }

  private analyzeConvergencePatterns(): ConvergenceInsight[] {
    const results = this.currentDiamondResults();
    if (!results) return [];

    return this.diamondAnalysisService.analyzeConvergencePatterns(results);
  }

  private calculateNetworkCoverage(): { covered: number; total: number; percentage: number } {
    const results = this.currentDiamondResults();
    if (!results || !results.raw_unique_diamonds) {
      return { covered: 0, total: 0, percentage: 0 };
    }

    const uniqueDiamonds = results.raw_unique_diamonds;
    const totalNodesInDiamonds = Object.values(uniqueDiamonds)
      .reduce((sum: number, diamond: any) => sum + (diamond.node_count || 0), 0);
    
    // Approximate total network size (this would ideally come from network structure)
    const approximateNetworkSize = totalNodesInDiamonds + 50; // Rough estimate
    
    return {
      covered: totalNodesInDiamonds,
      total: approximateNetworkSize,
      percentage: approximateNetworkSize > 0 ? (totalNodesInDiamonds / approximateNetworkSize) * 100 : 0
    };
  }

  private analyzeJoinNodes(): JoinNodeAnalysis[] {
    const results = this.currentDiamondResults();
    if (!results) return [];

    return this.diamondAnalysisService.analyzeJoinNodes(results);
  }

  // Diamond Pattern Processing
  getDiamondPatterns(): DiamondPattern[] {
    const results = this.currentDiamondResults();
    if (!results || !results.raw_unique_diamonds) return [];

    return Object.entries(results.raw_unique_diamonds).map(([hash, diamond]: [string, any]) => ({
      id: hash,
      nodeCount: diamond.node_count || 0,
      isRoot: diamond.is_root_diamond || false,
      complexity: this.calculateComplexity(diamond),
      joinNodes: diamond.sub_join_nodes || [],
      sourceNodes: diamond.sub_sources || [],
      forkNodes: diamond.sub_fork_nodes || [],
      subDiamonds: [] // TODO: Extract sub-diamonds if available
    }));
  }

  private calculateComplexity(diamond: any): number {
    // Simple complexity metric based on node count and structure
    const baseComplexity = diamond.node_count;
    const structuralComplexity = diamond.sub_iteration_sets_count || 1;
    return baseComplexity * structuralComplexity;
  }

  // UI Helper Methods
  formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(0)}ms`;
    }
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  // Action Methods
  openDiamondDetails(pattern: DiamondPattern): void {
    // TODO: Open diamond details modal
    console.log('Opening diamond details for:', pattern);
  }

  exportDiamondData(): void {
    // TODO: Export diamond analysis data
    console.log('Exporting diamond data...');
  }

  refreshAnalysis(): void {
    console.log('🔄 Refreshing diamond analysis...');
    this.loadMultiScenarioDiamondAnalysis();
  }

  viewDiamondDetails(pattern: DiamondPattern): void {
    // Alias for openDiamondDetails to match template usage
    this.openDiamondDetails(pattern);
  }
}