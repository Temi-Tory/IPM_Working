import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkVisualizationComponent, NodeClickInfo } from '../network-visualization/network-visualization.component';
import { CpmScenario } from '../../shared/models/network-analysis.models';

@Component({
  selector: 'app-critical-path',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatSliderModule,
    FormsModule,
    NetworkVisualizationComponent
  ],
  templateUrl: './critical-path.component.html',
  styleUrls: ['./critical-path.component.scss']
})
export class CriticalPathComponent {
  private analysisState = inject(AnalysisStateService);

  analysisResults = computed(() => this.analysisState.analysisResults());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());
  networkData = computed(() => this.analysisState.networkData());

  // View state
  viewMode = signal<'dashboard' | 'visual'>('dashboard');
  selectedScenario = signal<string>('');
  selectedTab = signal<number>(0);

  // Filter state for visual view
  criticalPathFilter = signal<'all' | 'critical-only' | 'non-critical'>('all');
  timeLevelFilter = signal<number>(0);
  costLevelFilter = signal<number>(0);
  selectedNode = signal<NodeClickInfo | null>(null);

  displayedColumns: string[] = ['metric', 'value'];
  nodeValueColumns: string[] = ['node', 'timeValue', 'costValue'];
  overviewColumns: string[] = ['metric', 'time', 'cost'];
  timeAnalysisColumns: string[] = ['node', 'timeValue', 'earlyStart', 'lateFinish', 'slack'];
  costAnalysisColumns: string[] = ['node', 'costValue', 'costEfficiency', 'optimization'];

  getCpmScenarios() {
    const results = this.analysisResults();
    if (!results?.results?.cpm_scenarios) return [];

    return Object.entries(results.results.cpm_scenarios).map(([name, scenario]) => ({
      name,
      scenario
    }));
  }

  getCriticalPathMetrics(scenario: any): { metric: string; value: string | number }[] {
    if (!scenario) return [];

    return [
      { metric: 'Critical Time', value: scenario.time_result.critical_value.toFixed(2) },
      { metric: 'Critical Cost', value: scenario.cost_result.critical_value.toFixed(2) },
      { metric: 'Time Critical Nodes', value: scenario.time_result.critical_nodes.length },
      { metric: 'Cost Critical Nodes', value: scenario.cost_result.critical_nodes.length },
      { metric: 'Total Nodes Analyzed', value: Object.keys(scenario.time_result.node_values).length },
      { metric: 'Computation Time', value: `${scenario.computation_time.toFixed(4)}s` }
    ];
  }

  getTopNodesByValue(nodeValues: Record<string, number>, count: number = 10): { node: string; value: number }[] {
    return Object.entries(nodeValues)
      .map(([node, value]) => ({ node, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count);
  }

  getCombinedNodeData(scenario: any): { node: string; timeValue: number; costValue: number; isTimeCritical: boolean; isCostCritical: boolean }[] {
    if (!scenario?.time_result?.node_values || !scenario?.cost_result?.node_values) return [];

    const allNodes = new Set([
      ...Object.keys(scenario.time_result.node_values),
      ...Object.keys(scenario.cost_result.node_values)
    ]);

    return Array.from(allNodes).map(node => ({
      node,
      timeValue: scenario.time_result.node_values[node] || 0,
      costValue: scenario.cost_result.node_values[node] || 0,
      isTimeCritical: scenario.time_result.critical_nodes.includes(parseInt(node)),
      isCostCritical: scenario.cost_result.critical_nodes.includes(parseInt(node))
    })).sort((a, b) => {
      if (a.isTimeCritical && !b.isTimeCritical) return -1;
      if (!a.isTimeCritical && b.isTimeCritical) return 1;
      if (a.isCostCritical && !b.isCostCritical) return -1;
      if (!a.isCostCritical && b.isCostCritical) return 1;
      return b.timeValue - a.timeValue;
    });
  }

  getMaxValue(values: Record<string, number>): number {
    return Math.max(...Object.values(values));
  }

  isCriticalNode(nodeId: string, criticalNodes: number[]): boolean {
    return criticalNodes.includes(parseInt(nodeId));
  }

  getCriticalityLevel(timeValue: number, costValue: number, maxTime: number, maxCost: number): 'high' | 'medium' | 'low' {
    const timeRatio = timeValue / maxTime;
    const costRatio = costValue / maxCost;
    const avgRatio = (timeRatio + costRatio) / 2;

    if (avgRatio >= 0.8) return 'high';
    if (avgRatio >= 0.5) return 'medium';
    return 'low';
  }

  getCurrentScenario(): { name: string; scenario: CpmScenario } | null {
    const scenarios = this.getCpmScenarios();
    if (scenarios.length === 0) return null;
    
    const selectedName = this.selectedScenario();
    if (selectedName) {
      return scenarios.find(s => s.name === selectedName) || scenarios[0];
    }
    return scenarios[0];
  }

  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
    this.selectedNode.set(null); // Reset selected node
  }

  getOverviewMetrics(scenario: any): { metric: string; time: string | number; cost: string | number }[] {
    if (!scenario) return [];

    return [
      {
        metric: 'Critical Value',
        time: scenario.time_result.critical_value.toFixed(2),
        cost: scenario.cost_result.critical_value.toFixed(2)
      },
      {
        metric: 'Critical Nodes Count',
        time: scenario.time_result.critical_nodes.length,
        cost: scenario.cost_result.critical_nodes.length
      },
      {
        metric: 'Average Node Value',
        time: (Object.values(scenario.time_result.node_values).reduce((a: number, b: any) => a + b, 0) / Object.keys(scenario.time_result.node_values).length).toFixed(2),
        cost: (Object.values(scenario.cost_result.node_values).reduce((a: number, b: any) => a + b, 0) / Object.keys(scenario.cost_result.node_values).length).toFixed(2)
      },
      {
        metric: 'Max Node Value',
        time: this.getMaxValue(scenario.time_result.node_values).toFixed(2),
        cost: this.getMaxValue(scenario.cost_result.node_values).toFixed(2)
      }
    ];
  }

  getTimeAnalysisData(scenario: any): { node: string; timeValue: number; earlyStart: number; lateFinish: number; slack: number; isCritical: boolean }[] {
    if (!scenario?.time_result?.node_values) return [];

    return Object.entries(scenario.time_result.node_values).map(([node, timeValue]: [string, any]) => {
      const isCritical = scenario.time_result.critical_nodes.includes(parseInt(node));
      const maxTime = this.getMaxValue(scenario.time_result.node_values);
      
      return {
        node,
        timeValue: timeValue,
        earlyStart: timeValue * 0.8, // Placeholder calculation
        lateFinish: timeValue * 1.2, // Placeholder calculation
        slack: isCritical ? 0 : (maxTime - timeValue) * 0.1,
        isCritical
      };
    }).sort((a, b) => b.timeValue - a.timeValue);
  }

  getCostAnalysisData(scenario: any): { node: string; costValue: number; costEfficiency: number; optimization: string; isCritical: boolean }[] {
    if (!scenario?.cost_result?.node_values) return [];

    const maxCost = this.getMaxValue(scenario.cost_result.node_values);

    return Object.entries(scenario.cost_result.node_values).map(([node, costValue]: [string, any]) => {
      const isCritical = scenario.cost_result.critical_nodes.includes(parseInt(node));
      const efficiency = (maxCost - costValue) / maxCost * 100;
      
      let optimization = 'Optimal';
      if (efficiency < 20) optimization = 'High Cost';
      else if (efficiency < 50) optimization = 'Moderate';
      
      return {
        node,
        costValue: costValue,
        costEfficiency: efficiency,
        optimization,
        isCritical
      };
    }).sort((a, b) => b.costValue - a.costValue);
  }

  onNodeClick(nodeInfo: NodeClickInfo): void {
    this.selectedNode.set(nodeInfo);
  }

  onTimeLevelFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.timeLevelFilter.set(+target.value);
    this.onFilterChange();
  }

  onCostLevelFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.costLevelFilter.set(+target.value);
    this.onFilterChange();
  }

  onFilterChange(): void {
    // Emit filter changes for network visualization
    const currentScenario = this.getCurrentScenario();
    if (currentScenario) {
      // Update filters based on current selection
    }
  }

  clearSelectedNode(): void {
    this.selectedNode.set(null);
  }
}