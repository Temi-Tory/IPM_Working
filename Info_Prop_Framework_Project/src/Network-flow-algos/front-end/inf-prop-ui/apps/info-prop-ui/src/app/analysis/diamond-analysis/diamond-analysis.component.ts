import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkVisualizationComponent, NodeClickInfo } from '../network-visualization/network-visualization.component';

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatTabsModule,
    MatButtonModule,
    MatTooltipModule,
    NetworkVisualizationComponent
  ],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent implements OnInit {
  private analysisState = inject(AnalysisStateService);

  networkData = computed(() => this.analysisState.networkData());
  analysisResults = computed(() => this.analysisState.analysisResults());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  viewMode = signal<'dashboard' | 'visual'>('dashboard');
  selectedScenario = signal<string>('');
  selectedTabIndex = signal(0);
  
  // Node selection for info cards
  selectedNodeInfo = signal<NodeClickInfo | null>(null);
  
  displayedColumns: string[] = ['metric', 'value'];

  getDiamondAnalysis() {
    const results = this.analysisResults();
    if (!results?.results) return null;

    // Check for standalone diamond analysis
    if (results.results.diamond_analysis) {
      return results.results.diamond_analysis;
    }

    // Check for diamond analysis in reachability scenarios
    const scenarios = results.results.reachability_scenarios;
    if (scenarios) {
      const scenarioWithDiamonds = Object.values(scenarios).find(s => s.diamond_analysis);
      return scenarioWithDiamonds?.diamond_analysis || null;
    }

    return null;
  }

  getScenarioDiamondAnalyses() {
    const results = this.analysisResults();
    if (!results?.results?.reachability_scenarios) return [];

    return Object.entries(results.results.reachability_scenarios)
      .filter(([_, scenario]) => scenario.diamond_analysis)
      .map(([name, scenario]) => ({
        name,
        analysis: scenario.diamond_analysis!
      }));
  }

  getDiamondMetrics(analysis: any): { metric: string; value: string | number }[] {
    if (!analysis) return [];

    return [
      { metric: 'Root Diamonds', value: analysis.root_diamonds_count },
      { metric: 'Unique Diamonds', value: analysis.unique_diamonds_count },
      { metric: 'Join Nodes with Diamonds', value: analysis.join_nodes_with_diamonds?.length || 0 },
      { metric: 'Diamond Efficiency', value: `${(analysis.diamond_efficiency * 100).toFixed(1)}%` },
      { metric: 'Root Computation Time', value: `${analysis.root_computation_time.toFixed(4)}s` },
      { metric: 'Unique Computation Time', value: `${analysis.unique_computation_time.toFixed(4)}s` },
      { metric: 'Total Computation Time', value: `${analysis.total_computation_time.toFixed(4)}s` }
    ];
  }

  getJoinNodesWithDiamonds(analysis: any): number[] {
    return analysis?.join_nodes_with_diamonds || [];
  }

  getEfficiencyLevel(efficiency: number): 'high' | 'medium' | 'low' {
    if (efficiency >= 0.8) return 'high';
    if (efficiency >= 0.5) return 'medium';
    return 'low';
  }

  // Get available scenarios for dropdown
  getAvailableScenarios(): { value: string; label: string }[] {
    const results = this.analysisResults();
    if (!results?.results) return [];

    const scenarios: { value: string; label: string }[] = [];
    
    // Add standalone analysis
    if (results.results.diamond_analysis) {
      scenarios.push({ value: 'standalone', label: 'Main Analysis' });
    }
    
    // Add scenario-based analyses
    if (results.results.reachability_scenarios) {
      Object.entries(results.results.reachability_scenarios)
        .filter(([_, scenario]) => scenario.diamond_analysis)
        .forEach(([name]) => {
          scenarios.push({ value: name, label: name });
        });
    }
    
    return scenarios;
  }

  // Get current scenario analysis
  getCurrentScenarioAnalysis() {
    const selectedScenario = this.selectedScenario();
    if (!selectedScenario) return null;
    
    const results = this.analysisResults();
    if (!results?.results) return null;
    
    if (selectedScenario === 'standalone') {
      return results.results.diamond_analysis;
    }
    
    return results.results.reachability_scenarios?.[selectedScenario]?.diamond_analysis;
  }

  // Get summary statistics for overview
  getSummaryStats(analysis: any): { metric: string; value: string; description: string }[] {
    if (!analysis) return [];
    
    return [
      {
        metric: 'Diamond Patterns',
        value: `${analysis.unique_diamonds_count}/${analysis.root_diamonds_count}`,
        description: 'Unique patterns found vs total patterns'
      },
      {
        metric: 'Optimization Efficiency',
        value: `${(analysis.diamond_efficiency * 100).toFixed(1)}%`,
        description: 'How well diamond patterns optimize computation'
      },
      {
        metric: 'Join Nodes Affected',
        value: `${analysis.join_nodes_with_diamonds?.length || 0}`,
        description: 'Number of join nodes containing diamond patterns'
      },
      {
        metric: 'Total Computation Time',
        value: `${analysis.total_computation_time.toFixed(4)}s`,
        description: 'Time spent on diamond analysis'
      }
    ];
  }

  // Get detailed metrics for dashboard
  getDetailedMetrics(analysis: any): { category: string; metrics: { metric: string; value: string; unit?: string }[] }[] {
    if (!analysis) return [];
    
    return [
      {
        category: 'Pattern Classification',
        metrics: [
          { metric: 'Root Diamonds', value: analysis.root_diamonds_count.toString() },
          { metric: 'Unique Diamonds', value: analysis.unique_diamonds_count.toString() },
          { metric: 'Pattern Reduction', value: `${((1 - analysis.diamond_efficiency) * 100).toFixed(1)}`, unit: '%' }
        ]
      },
      {
        category: 'Performance Metrics',
        metrics: [
          { metric: 'Root Computation', value: analysis.root_computation_time.toFixed(4), unit: 's' },
          { metric: 'Unique Computation', value: analysis.unique_computation_time.toFixed(4), unit: 's' },
          { metric: 'Total Time', value: analysis.total_computation_time.toFixed(4), unit: 's' }
        ]
      },
      {
        category: 'Network Impact',
        metrics: [
          { metric: 'Affected Join Nodes', value: (analysis.join_nodes_with_diamonds?.length || 0).toString() },
          { metric: 'Efficiency Level', value: this.getEfficiencyLevel(analysis.diamond_efficiency) },
          { metric: 'Optimization Score', value: `${(analysis.diamond_efficiency * 100).toFixed(1)}`, unit: '%' }
        ]
      }
    ];
  }

  // Handle view mode change
  onViewModeChange(mode: 'dashboard' | 'visual'): void {
    this.viewMode.set(mode);
  }

  // Handle scenario selection
  onScenarioChange(scenario: string): void {
    this.selectedScenario.set(scenario);
  }

  // Handle node click in visualization
  onNodeClick(nodeInfo: NodeClickInfo): void {
    this.selectedNodeInfo.set(nodeInfo);
  }

  // Clear node selection
  clearNodeSelection(): void {
    this.selectedNodeInfo.set(null);
  }

  // Initialize scenario selection
  ngOnInit(): void {
    // Set default scenario when data loads
    const scenarios = this.getAvailableScenarios();
    if (scenarios.length > 0 && !this.selectedScenario()) {
      this.selectedScenario.set(scenarios[0].value);
    }
  }
}