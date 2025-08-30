import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkVisualizationComponent, NodeClickInfo } from '../network-visualization/network-visualization.component';

@Component({
  selector: 'app-flow-analysis',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatButtonModule,
    NetworkVisualizationComponent,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSliderModule,
    FormsModule
  ],
  templateUrl: './flow-analysis.component.html',
  styleUrls: ['./flow-analysis.component.scss']
})
export class FlowAnalysisComponent {
  private analysisState = inject(AnalysisStateService);

  analysisResults = computed(() => this.analysisState.analysisResults());
  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View toggle
  currentView = signal<'dashboard' | 'visual'>('dashboard');
  
  // Scenario selection
  selectedScenario = signal<string>('');
  
  // Dashboard tab selection
  activeTab = signal<'overview' | 'metrics' | 'utilization'>('overview');
  
  // Visual filters
  flowThresholdFilter = signal<number>(0.1);
  showBottlenecks = signal<boolean>(true);
  utilizationThreshold = signal<number>(0.8);
  selectedNode = signal<string | null>(null);

  displayedColumns: string[] = ['metric', 'value'];
  flowsDisplayedColumns: string[] = ['node', 'flow'];
  capacityDisplayedColumns: string[] = ['edge', 'capacity', 'flow', 'utilization'];
  bottleneckDisplayedColumns: string[] = ['edge', 'capacity', 'flow', 'bottleneck_severity'];

  switchView(view: 'dashboard' | 'visual'): void {
    this.currentView.set(view);
  }

  getCapacityScenarios() {
    const results = this.analysisResults();
    if (!results?.results?.capacity_scenarios) return [];

    return Object.entries(results.results.capacity_scenarios).map(([name, scenario]) => ({
      name,
      scenario
    }));
  }

  getFlowMetrics(scenario: any): { metric: string; value: string | number }[] {
    if (!scenario) return [];

    return [
      { metric: 'Network Utilization', value: `${(scenario.network_utilization * 100).toFixed(1)}%` },
      { metric: 'Total Source Input', value: scenario.total_source_input.toFixed(2) },
      { metric: 'Total Target Output', value: scenario.total_target_output.toFixed(2) },
      { metric: 'Active Sources', value: scenario.active_sources.length },
      { metric: 'Target Nodes', value: scenario.target_nodes.length },
      { metric: 'Computation Time', value: `${scenario.computation_time.toFixed(4)}s` }
    ];
  }

  getFlowsData(flows: Record<string, number>): { node: string; flow: number }[] {
    return Object.entries(flows)
      .map(([node, flow]) => ({ node, flow }))
      .sort((a, b) => b.flow - a.flow);
  }

  getUtilizationLevel(utilization: number): 'high' | 'medium' | 'low' {
    if (utilization >= 0.8) return 'high';
    if (utilization >= 0.5) return 'medium';
    return 'low';
  }

  // Scenario management
  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
    // Reset tabs when switching scenarios
    this.activeTab.set('overview');
  }

  getSelectedScenarioData() {
    const scenarios = this.getCapacityScenarios();
    const selectedName = this.selectedScenario();
    
    if (!selectedName && scenarios.length > 0) {
      // Auto-select first scenario if none selected
      this.selectedScenario.set(scenarios[0].name);
      return scenarios[0];
    }
    
    return scenarios.find(s => s.name === selectedName) || scenarios[0];
  }

  getCurrentScenarioIndex(): number {
    const scenarios = this.getCapacityScenarios();
    const selectedName = this.selectedScenario();
    const index = scenarios.findIndex(s => s.name === selectedName);
    return index >= 0 ? index + 1 : 1;
  }

  // Dashboard tab management
  switchTab(tab: 'overview' | 'metrics' | 'utilization'): void {
    this.activeTab.set(tab);
  }

  onTabChange(index: number): void {
    const tabs: ('overview' | 'metrics' | 'utilization')[] = ['overview', 'metrics', 'utilization'];
    this.switchTab(tabs[index]);
  }

  // Enhanced data processing for tabs
  getOverviewData(scenario: any) {
    if (!scenario) return null;
    
    return {
      networkUtilization: scenario.network_utilization,
      totalInput: scenario.total_source_input,
      totalOutput: scenario.total_target_output,
      activeSources: scenario.active_sources.length,
      targetNodes: scenario.target_nodes.length,
      computationTime: scenario.computation_time,
      efficiency: scenario.total_target_output / scenario.total_source_input
    };
  }

  getCapacityData(scenario: any): { edge: string; capacity: number; flow: number; utilization: number }[] {
    if (!scenario?.edge_capacities || !scenario?.edge_flows) return [];
    
    return Object.entries(scenario.edge_capacities)
      .map(([edge, capacity]: [string, any]) => {
        const flow = scenario.edge_flows[edge] || 0;
        return {
          edge,
          capacity: capacity as number,
          flow: flow as number,
          utilization: capacity > 0 ? (flow as number) / (capacity as number) : 0
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }

  getBottleneckData(scenario: any): { edge: string; capacity: number; flow: number; bottleneck_severity: number }[] {
    if (!scenario?.bottlenecks) return [];
    
    return Object.entries(scenario.bottlenecks)
      .map(([edge, severity]: [string, any]) => {
        const capacity = scenario.edge_capacities?.[edge] || 0;
        const flow = scenario.edge_flows?.[edge] || 0;
        return {
          edge,
          capacity,
          flow,
          bottleneck_severity: severity as number
        };
      })
      .sort((a, b) => b.bottleneck_severity - a.bottleneck_severity);
  }

  // Visual view enhancements
  onNodeClick(nodeInfo: NodeClickInfo): void {
    const nodeId = nodeInfo.id.toString();
    this.selectedNode.set(this.selectedNode() === nodeId ? null : nodeId);
  }

  getNodeFlowInfo(nodeId: string) {
    const scenario = this.getSelectedScenarioData();
    if (!scenario || !nodeId) return null;
    
    const targetFlow = scenario.scenario.target_flows?.[nodeId];
    const sourceFlow = scenario.scenario.source_inputs?.[nodeId];
    
    return {
      nodeId,
      targetFlow: targetFlow || 0,
      sourceFlow: sourceFlow || 0,
      isSource: scenario.scenario.active_sources.includes(+nodeId),
      isTarget: scenario.scenario.target_nodes.includes(+nodeId)
    };
  }

  // Filter methods
  getFilteredFlowData(flows: Record<string, number>): { node: string; flow: number }[] {
    const threshold = this.flowThresholdFilter();
    return Object.entries(flows)
      .filter(([_, flow]) => flow >= threshold)
      .map(([node, flow]) => ({ node, flow }))
      .sort((a, b) => b.flow - a.flow);
  }

  onFlowThresholdChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.flowThresholdFilter.set(+target.value || 0.1);
  }

  onUtilizationThresholdChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.utilizationThreshold.set(+target.value || 0.8);
  }

  resetFilters(): void {
    this.flowThresholdFilter.set(0.1);
    this.showBottlenecks.set(true);
    this.utilizationThreshold.set(0.8);
    this.selectedNode.set(null);
  }
}