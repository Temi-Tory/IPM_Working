import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { CpmScenario, NetworkStructure } from '../../shared/models/network-analysis.models';

export interface CostSummary {
  totalProjectCost: number;
  mostExpensivePath: number[];
  mostExpensivePathCost: number;
  averageNodeCost: number;
  costVariance: number;
  budgetEfficiency: number;
}

export interface CostBreakdownItem {
  nodeId: number;
  nodeCost: number;
  accumulatedCost: number;
  costContribution: number;
  isOnCriticalPath: boolean;
  nodeType: string;
}

export interface CostPathItem {
  path: number[];
  totalCost: number;
  pathLength: number;
  averageCostPerNode: number;
  costEfficiency: number;
}

export interface CostOptimizationInsight {
  type: 'info' | 'warning' | 'success' | 'optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  nodeIds?: number[];
  recommendedAction?: string;
}

export interface TimeCostComparison {
  hasTimeData: boolean;
  nodeComparisons: Array<{
    nodeId: number;
    timeValue: number;
    costValue: number;
    timeRank: number;
    costRank: number;
    tradeoffScore: number;
  }>;
  correlationCoefficient: number;
  tradeoffInsights: string[];
}

@Component({
  selector: 'app-cost-analysis',
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
    MatExpansionModule,
    MatSlideToggleModule,
    FormsModule
  ],
  templateUrl: './cost-analysis.component.html',
  styleUrls: ['./cost-analysis.component.scss']
})
export class CostAnalysisComponent {
  private analysisState = inject(AnalysisStateService);

  // Core data signals
  networkData = computed(() => this.analysisState.networkData());
  cpmAnalysis = computed(() => this.analysisState.cpmAnalysis());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  currentView = signal<'overview' | 'breakdown' | 'paths' | 'optimization' | 'comparison'>('overview');
  selectedScenario = signal<string | null>(null);
  
  // Pagination
  breakdownPageSize = signal(50);
  breakdownPageIndex = signal(0);
  pathsPageSize = signal(25);
  pathsPageIndex = signal(0);

  // Filters
  costSearchTerm = signal('');
  selectedCostRange = signal<'all' | 'high' | 'medium' | 'low'>('all');
  showOnlyCriticalPath = signal(false);

  // Table columns
  breakdownColumns = ['nodeId', 'nodeCost', 'accumulatedCost', 'contribution', 'critical', 'type', 'actions'];
  pathColumns = ['path', 'totalCost', 'length', 'avgCost', 'efficiency', 'actions'];

  // Available CPM scenarios
  availableScenarios = computed(() => {
    const results = this.analysisState.analysisResults();
    if (!results?.results?.cpm_scenarios) return [];
    
    return Object.keys(results.results.cpm_scenarios).map(key => ({
      key,
      name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      scenario: results.results!.cpm_scenarios![key]
    }));
  });

  // Current scenario data
  currentScenario = computed(() => {
    const scenarios = this.availableScenarios();
    const selected = this.selectedScenario();
    if (!selected && scenarios.length > 0) {
      this.selectedScenario.set(scenarios[0].key);
      return scenarios[0].scenario;
    }
    return scenarios.find(s => s.key === selected)?.scenario || null;
  });

  // Cost summary calculations
  costSummary = computed((): CostSummary | null => {
    const scenario = this.currentScenario();
    if (!scenario?.cost_result) return null;

    const { critical_value, critical_nodes, node_values } = scenario.cost_result;
    const costs = Object.values(node_values);
    const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
    const avgCost = costs.length > 0 ? totalCost / costs.length : 0;
    
    // Calculate cost variance
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - avgCost, 2), 0) / costs.length;
    
    // Budget efficiency (critical path cost vs total cost)
    const budgetEfficiency = totalCost > 0 ? (critical_value / totalCost) * 100 : 0;

    return {
      totalProjectCost: totalCost,
      mostExpensivePath: critical_nodes,
      mostExpensivePathCost: critical_value,
      averageNodeCost: avgCost,
      costVariance: variance,
      budgetEfficiency
    };
  });

  // Cost breakdown for table
  costBreakdown = computed((): CostBreakdownItem[] => {
    const scenario = this.currentScenario();
    const networkData = this.networkData();
    if (!scenario?.cost_result || !networkData) return [];

    const { critical_nodes, node_values } = scenario.cost_result;
    const totalCost = Object.values(node_values).reduce((sum, cost) => sum + cost, 0);
    const criticalSet = new Set(critical_nodes);

    return Object.entries(node_values).map(([nodeIdStr, cost]) => {
      const nodeId = parseInt(nodeIdStr);
      
      // Calculate accumulated cost (sum of all predecessor costs)
      const accumulatedCost = this.calculateAccumulatedCost(nodeId, node_values, networkData);
      
      return {
        nodeId,
        nodeCost: cost,
        accumulatedCost,
        costContribution: totalCost > 0 ? (cost / totalCost) * 100 : 0,
        isOnCriticalPath: criticalSet.has(nodeId),
        nodeType: this.getNodeType(nodeId, networkData)
      };
    }).sort((a, b) => b.nodeCost - a.nodeCost);
  });

  // Cost paths analysis
  costPaths = computed((): CostPathItem[] => {
    const scenario = this.currentScenario();
    const networkData = this.networkData();
    if (!scenario?.cost_result || !networkData) return [];

    const paths = this.generateAllPaths(networkData);
    const { node_values } = scenario.cost_result;

    return paths.map(path => {
      const totalCost = path.reduce((sum, nodeId) => sum + (node_values[nodeId] || 0), 0);
      const avgCost = path.length > 0 ? totalCost / path.length : 0;
      
      return {
        path,
        totalCost,
        pathLength: path.length,
        averageCostPerNode: avgCost,
        costEfficiency: path.length > 0 ? totalCost / path.length : 0
      };
    }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 50); // Top 50 most expensive paths
  });

  // Cost optimization insights
  costOptimizationInsights = computed((): CostOptimizationInsight[] => {
    const summary = this.costSummary();
    const breakdown = this.costBreakdown();
    if (!summary || !breakdown.length) return [];

    const insights: CostOptimizationInsight[] = [];

    // High cost nodes
    const highCostNodes = breakdown.filter(item => item.costContribution > 10);
    if (highCostNodes.length > 0) {
      insights.push({
        type: 'warning',
        title: 'High Cost Concentrations',
        description: `${highCostNodes.length} nodes consume more than 10% of total budget each`,
        impact: 'high',
        nodeIds: highCostNodes.map(n => n.nodeId),
        recommendedAction: 'Consider cost reduction strategies for these high-impact nodes'
      });
    }

    // Critical path analysis
    const criticalPathItems = breakdown.filter(item => item.isOnCriticalPath);
    const criticalPathCost = criticalPathItems.reduce((sum, item) => sum + item.nodeCost, 0);
    const criticalPathPercentage = summary.totalProjectCost > 0 ? (criticalPathCost / summary.totalProjectCost) * 100 : 0;

    if (criticalPathPercentage > 60) {
      insights.push({
        type: 'optimization',
        title: 'Critical Path Cost Dominance',
        description: `Critical path consumes ${criticalPathPercentage.toFixed(1)}% of total budget`,
        impact: 'high',
        nodeIds: criticalPathItems.map(n => n.nodeId),
        recommendedAction: 'Focus optimization efforts on critical path nodes for maximum impact'
      });
    }

    // Budget efficiency
    if (summary.budgetEfficiency < 30) {
      insights.push({
        type: 'info',
        title: 'Low Budget Efficiency',
        description: 'Critical path uses only a small portion of total budget',
        impact: 'medium',
        recommendedAction: 'Consider reallocating resources from non-critical to critical nodes'
      });
    } else if (summary.budgetEfficiency > 80) {
      insights.push({
        type: 'warning',
        title: 'High Budget Concentration Risk',
        description: 'Most budget is concentrated in the critical path',
        impact: 'high',
        recommendedAction: 'Consider risk mitigation strategies for critical path cost overruns'
      });
    }

    // Cost variance analysis
    const avgCost = summary.averageNodeCost;
    const highVarianceNodes = breakdown.filter(item => 
      Math.abs(item.nodeCost - avgCost) > avgCost * 0.5
    );

    if (highVarianceNodes.length > breakdown.length * 0.3) {
      insights.push({
        type: 'info',
        title: 'High Cost Variability',
        description: 'Significant cost differences between nodes detected',
        impact: 'medium',
        recommendedAction: 'Review cost estimation methodology for consistency'
      });
    }

    return insights;
  });

  // Time-cost comparison (when both analyses are available)
  timeCostComparison = computed((): TimeCostComparison => {
    const scenario = this.currentScenario();
    if (!scenario?.cost_result || !scenario?.time_result) {
      return { hasTimeData: false, nodeComparisons: [], correlationCoefficient: 0, tradeoffInsights: [] };
    }

    const { node_values: costValues } = scenario.cost_result;
    const { node_values: timeValues } = scenario.time_result;
    
    // Create comparison data
    const nodeComparisons = Object.keys(costValues)
      .filter(nodeId => timeValues[nodeId] !== undefined)
      .map(nodeId => ({
        nodeId: parseInt(nodeId),
        timeValue: timeValues[nodeId],
        costValue: costValues[nodeId],
        timeRank: 0,
        costRank: 0,
        tradeoffScore: 0
      }));

    // Calculate ranks
    const sortedByTime = [...nodeComparisons].sort((a, b) => b.timeValue - a.timeValue);
    const sortedByCost = [...nodeComparisons].sort((a, b) => b.costValue - a.costValue);

    sortedByTime.forEach((item, index) => {
      const original = nodeComparisons.find(n => n.nodeId === item.nodeId)!;
      original.timeRank = index + 1;
    });

    sortedByCost.forEach((item, index) => {
      const original = nodeComparisons.find(n => n.nodeId === item.nodeId)!;
      original.costRank = index + 1;
    });

    // Calculate tradeoff scores and correlation
    nodeComparisons.forEach(item => {
      item.tradeoffScore = Math.abs(item.timeRank - item.costRank);
    });

    const correlation = this.calculateCorrelation(
      nodeComparisons.map(n => n.timeValue),
      nodeComparisons.map(n => n.costValue)
    );

    // Generate insights
    const insights: string[] = [];
    if (correlation > 0.7) {
      insights.push('Strong positive correlation between time and cost - optimizing one may benefit both');
    } else if (correlation < -0.7) {
      insights.push('Strong negative correlation - there may be time-cost tradeoffs to explore');
    } else {
      insights.push('Weak correlation between time and cost - independent optimization strategies recommended');
    }

    return {
      hasTimeData: true,
      nodeComparisons: nodeComparisons.sort((a, b) => b.tradeoffScore - a.tradeoffScore),
      correlationCoefficient: correlation,
      tradeoffInsights: insights
    };
  });

  // Filtered and paginated data
  filteredCostBreakdown = computed(() => {
    const breakdown = this.costBreakdown();
    const searchTerm = this.costSearchTerm().toLowerCase();
    const costRange = this.selectedCostRange();
    const showOnlyCritical = this.showOnlyCriticalPath();

    return breakdown.filter(item => {
      const matchesSearch = !searchTerm || item.nodeId.toString().includes(searchTerm);
      const matchesCritical = !showOnlyCritical || item.isOnCriticalPath;
      
      let matchesCostRange = true;
      if (costRange !== 'all') {
        const avgCost = this.costSummary()?.averageNodeCost || 0;
        switch (costRange) {
          case 'high':
            matchesCostRange = item.nodeCost > avgCost * 1.5;
            break;
          case 'medium':
            matchesCostRange = item.nodeCost >= avgCost * 0.5 && item.nodeCost <= avgCost * 1.5;
            break;
          case 'low':
            matchesCostRange = item.nodeCost < avgCost * 0.5;
            break;
        }
      }
      
      return matchesSearch && matchesCritical && matchesCostRange;
    });
  });

  paginatedCostBreakdown = computed(() => {
    const filtered = this.filteredCostBreakdown();
    const pageSize = this.breakdownPageSize();
    const pageIndex = this.breakdownPageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  paginatedCostPaths = computed(() => {
    const paths = this.costPaths();
    const pageSize = this.pathsPageSize();
    const pageIndex = this.pathsPageIndex();
    const start = pageIndex * pageSize;
    return paths.slice(start, start + pageSize);
  });

  // Helper methods
  private calculateAccumulatedCost(nodeId: number, nodeValues: Record<string, number>, networkData: NetworkStructure): number {
    const ancestors = this.getAncestors(nodeId, networkData);
    return ancestors.reduce((sum, ancestorId) => sum + (nodeValues[ancestorId] || 0), 0) + (nodeValues[nodeId] || 0);
  }

  private getNodeType(nodeId: number, networkData: NetworkStructure): string {
    const types: string[] = [];
    
    if (networkData.source_nodes.includes(nodeId)) types.push('Source');
    if (networkData.sink_nodes.includes(nodeId)) types.push('Sink');
    if (networkData.fork_nodes.includes(nodeId)) types.push('Fork');
    if (networkData.join_nodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  private getAncestors(nodeId: number, networkData: NetworkStructure): number[] {
    const ancestors = new Set<number>();
    const visited = new Set<number>();
    
    const dfs = (currentNode: number) => {
      if (visited.has(currentNode)) return;
      visited.add(currentNode);
      
      const parents = networkData.edges
        .filter(([, target]) => target === currentNode)
        .map(([source]) => source);
      
      for (const parent of parents) {
        ancestors.add(parent);
        dfs(parent);
      }
    };
    
    dfs(nodeId);
    return Array.from(ancestors);
  }

  private generateAllPaths(networkData: NetworkStructure): number[][] {
    const paths: number[][] = [];
    const sources = networkData.source_nodes;
    const sinks = networkData.sink_nodes;

    // Generate paths from each source to each sink
    for (const source of sources) {
      for (const sink of sinks) {
        const sourceTosinkPaths = this.findAllPathsBetween(source, sink, networkData);
        paths.push(...sourceTosinkPaths);
      }
    }

    return paths;
  }

  private findAllPathsBetween(source: number, target: number, networkData: NetworkStructure): number[][] {
    const paths: number[][] = [];
    const visited = new Set<number>();

    const dfs = (current: number, path: number[]) => {
      if (current === target) {
        paths.push([...path, current]);
        return;
      }

      if (visited.has(current)) return;
      visited.add(current);

      const neighbors = networkData.edges
        .filter(([src]) => src === current)
        .map(([, tgt]) => tgt);

      for (const neighbor of neighbors) {
        dfs(neighbor, [...path, current]);
      }

      visited.delete(current);
    };

    dfs(source, []);
    return paths;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' | 'breakdown' | 'paths' | 'optimization' | 'comparison');
  }

  onScenarioChange(scenarioKey: string): void {
    this.selectedScenario.set(scenarioKey);
  }

  onBreakdownPageChange(event: PageEvent): void {
    this.breakdownPageIndex.set(event.pageIndex);
    this.breakdownPageSize.set(event.pageSize);
  }

  onPathsPageChange(event: PageEvent): void {
    this.pathsPageIndex.set(event.pageIndex);
    this.pathsPageSize.set(event.pageSize);
  }

  onCostSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.costSearchTerm.set(target.value);
    this.breakdownPageIndex.set(0); // Reset to first page
  }

  onCostRangeFilter(range: 'all' | 'high' | 'medium' | 'low'): void {
    this.selectedCostRange.set(range);
    this.breakdownPageIndex.set(0); // Reset to first page
  }

  onCriticalPathToggle(checked: boolean): void {
    this.showOnlyCriticalPath.set(checked);
    this.breakdownPageIndex.set(0); // Reset to first page
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatPercentage(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  }

  // Make Math available in template
  Math = Math;

  retryAnalysis(): void {
    console.log('Retrying cost analysis...');
  }
}