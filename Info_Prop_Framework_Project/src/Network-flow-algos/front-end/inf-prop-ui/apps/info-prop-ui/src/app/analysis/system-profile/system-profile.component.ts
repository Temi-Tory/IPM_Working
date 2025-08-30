import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';

interface SystemSummary {
  networkStructure: {
    totalNodes: number;
    totalEdges: number;
    sourceNodes: number;
    sinkNodes: number;
    computationTime: number;
  };
  analysisResults: {
    reachabilityScenarios: number;
    diamondAnalysis: boolean;
    capacityScenarios: number;
    cpmScenarios: number;
    totalComputationTime: number;
  };
  performanceMetrics: {
    averageBeliefValue?: number;
    networkUtilization?: number;
    criticalTimeValue?: number;
    criticalCostValue?: number;
  };
}

@Component({
  selector: 'app-system-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule,
    MatButtonModule
  ],
  templateUrl: './system-profile.component.html',
  styleUrls: ['./system-profile.component.scss']
})
export class SystemProfileComponent {
  private analysisState = inject(AnalysisStateService);

  analysisResults = computed(() => this.analysisState.analysisResults());
  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  displayedColumns: string[] = ['metric', 'value'];

  getSystemSummary(): SystemSummary | null {
    const results = this.analysisResults();
    const network = this.networkData();
    
    if (!results || !network) return null;

    const networkStructure = {
      totalNodes: network.total_nodes || 0,
      totalEdges: network.total_edges || 0,
      sourceNodes: network.source_nodes?.length || 0,
      sinkNodes: network.sink_nodes?.length || 0,
      computationTime: network.computation_time || 0
    };

    const analysisResults = {
      reachabilityScenarios: Object.keys(results.results?.reachability_scenarios || {}).length,
      diamondAnalysis: !!results.results?.diamond_analysis,
      capacityScenarios: Object.keys(results.results?.capacity_scenarios || {}).length,
      cpmScenarios: Object.keys(results.results?.cpm_scenarios || {}).length,
      totalComputationTime: results.computation_summary?.total_analysis_time || 0
    };

    const performanceMetrics = this.calculatePerformanceMetrics(results);

    return {
      networkStructure,
      analysisResults,
      performanceMetrics
    };
  }

  private calculatePerformanceMetrics(results: any) {
    const metrics: SystemSummary['performanceMetrics'] = {};

    // Average belief value across all reachability scenarios
    if (results.results?.reachability_scenarios) {
      const allBeliefs: number[] = [];
      Object.values(results.results.reachability_scenarios).forEach((scenario: any) => {
        if (scenario.exact_inference?.beliefs) {
          allBeliefs.push(...Object.values(scenario.exact_inference.beliefs) as number[]);
        }
      });
      if (allBeliefs.length > 0) {
        metrics.averageBeliefValue = allBeliefs.reduce((sum, val) => sum + val, 0) / allBeliefs.length;
      }
    }

    // Average network utilization across capacity scenarios
    if (results.results?.capacity_scenarios) {
      const utilizations: number[] = Object.values(results.results.capacity_scenarios)
        .map((scenario: any) => scenario.network_utilization)
        .filter(util => typeof util === 'number');
      if (utilizations.length > 0) {
        metrics.networkUtilization = utilizations.reduce((sum, val) => sum + val, 0) / utilizations.length;
      }
    }

    // Maximum critical time and cost across CPM scenarios
    if (results.results?.cpm_scenarios) {
      const timeValues: number[] = Object.values(results.results.cpm_scenarios)
        .map((scenario: any) => scenario.time_result?.critical_value)
        .filter(val => typeof val === 'number');
      if (timeValues.length > 0) {
        metrics.criticalTimeValue = Math.max(...timeValues);
      }

      const costValues: number[] = Object.values(results.results.cpm_scenarios)
        .map((scenario: any) => scenario.cost_result?.critical_value)
        .filter(val => typeof val === 'number');
      if (costValues.length > 0) {
        metrics.criticalCostValue = Math.max(...costValues);
      }
    }

    return metrics;
  }

  getSystemOverviewData(): { metric: string; value: string | number; category: string }[] {
    const summary = this.getSystemSummary();
    if (!summary) return [];

    return [
      // Network Structure
      { metric: 'Total Nodes', value: summary.networkStructure.totalNodes, category: 'Network' },
      { metric: 'Total Edges', value: summary.networkStructure.totalEdges, category: 'Network' },
      { metric: 'Source Nodes', value: summary.networkStructure.sourceNodes, category: 'Network' },
      { metric: 'Sink Nodes', value: summary.networkStructure.sinkNodes, category: 'Network' },
      
      // Analysis Coverage
      { metric: 'Reachability Scenarios', value: summary.analysisResults.reachabilityScenarios, category: 'Analysis' },
      { metric: 'Diamond Analysis', value: summary.analysisResults.diamondAnalysis ? 'Enabled' : 'Disabled', category: 'Analysis' },
      { metric: 'Capacity Scenarios', value: summary.analysisResults.capacityScenarios, category: 'Analysis' },
      { metric: 'CPM Scenarios', value: summary.analysisResults.cpmScenarios, category: 'Analysis' },
      
      // Performance Metrics
      ...(summary.performanceMetrics.averageBeliefValue !== undefined 
        ? [{ metric: 'Average Belief Value', value: summary.performanceMetrics.averageBeliefValue.toFixed(4), category: 'Performance' }]
        : []),
      ...(summary.performanceMetrics.networkUtilization !== undefined 
        ? [{ metric: 'Network Utilization', value: `${(summary.performanceMetrics.networkUtilization * 100).toFixed(1)}%`, category: 'Performance' }]
        : []),
      ...(summary.performanceMetrics.criticalTimeValue !== undefined 
        ? [{ metric: 'Critical Time', value: summary.performanceMetrics.criticalTimeValue.toFixed(2), category: 'Performance' }]
        : []),
      ...(summary.performanceMetrics.criticalCostValue !== undefined 
        ? [{ metric: 'Critical Cost', value: summary.performanceMetrics.criticalCostValue.toFixed(2), category: 'Performance' }]
        : []),
      
      // Computation Times
      { metric: 'Network Analysis Time', value: `${summary.networkStructure.computationTime.toFixed(4)}s`, category: 'Computation' },
      { metric: 'Total Analysis Time', value: `${summary.analysisResults.totalComputationTime.toFixed(4)}s`, category: 'Computation' }
    ];
  }

  getAnalysisCompleteness(): { total: number; completed: number; percentage: number } {
    const results = this.analysisResults();
    if (!results) return { total: 0, completed: 0, percentage: 0 };

    let total = 1; // Network structure is always performed
    let completed = 1;

    // Count possible analyses
    if (results.results?.reachability_scenarios) {
      total += Object.keys(results.results.reachability_scenarios).length;
      completed += Object.keys(results.results.reachability_scenarios).length;
    }

    if (results.results?.diamond_analysis) {
      total += 1;
      completed += 1;
    }

    if (results.results?.capacity_scenarios) {
      total += Object.keys(results.results.capacity_scenarios).length;
      completed += Object.keys(results.results.capacity_scenarios).length;
    }

    if (results.results?.cpm_scenarios) {
      total += Object.keys(results.results.cpm_scenarios).length;
      completed += Object.keys(results.results.cpm_scenarios).length;
    }

    return {
      total,
      completed,
      percentage: total > 0 ? (completed / total) * 100 : 0
    };
  }

  getHealthScore(): number {
    const summary = this.getSystemSummary();
    if (!summary) return 0;

    let score = 100;
    
    // Deduct points based on analysis gaps
    if (summary.analysisResults.reachabilityScenarios === 0) score -= 20;
    if (!summary.analysisResults.diamondAnalysis) score -= 15;
    if (summary.analysisResults.capacityScenarios === 0) score -= 20;
    if (summary.analysisResults.cpmScenarios === 0) score -= 15;

    // Deduct points for performance issues
    if (summary.performanceMetrics.networkUtilization && summary.performanceMetrics.networkUtilization < 0.3) {
      score -= 10; // Low utilization might indicate inefficiency
    }

    // Deduct points for excessive computation time
    if (summary.analysisResults.totalComputationTime > 10) {
      score -= 20; // Long computation times
    }

    return Math.max(0, score);
  }

  getHealthLevel(): 'excellent' | 'good' | 'fair' | 'poor' {
    const score = this.getHealthScore();
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  exportSystemReport(): void {
    // Placeholder for export functionality
    console.log('Exporting system report...');
  }

  refreshAnalysis(): void {
    // Placeholder for refresh functionality
    console.log('Refreshing analysis...');
  }
}