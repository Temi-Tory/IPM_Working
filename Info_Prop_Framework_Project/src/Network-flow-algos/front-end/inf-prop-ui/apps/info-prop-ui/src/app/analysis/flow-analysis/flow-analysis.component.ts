import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseAnalysisComponent, AnalysisComponentData, VisualizationConfig } from '../../shared/interfaces/analysis-component.interface';
import { AnalysisViewSwitcherComponent } from '../../shared/components/analysis-view-switcher/analysis-view-switcher.component';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FlowAnalysisResult } from '../../shared/models/network-analysis.models';

interface FlowMetrics {
  utilizationPercentage: number;
  flowEfficiency: number;
  activeSourcesCount: number;
  totalTargets: number;
  averageTargetFlow: number;
  maxTargetFlow: number;
  utilizationCategory: 'low' | 'moderate' | 'high' | 'saturated';
}

interface SourceInfo {
  nodeId: number;
  contribution: number;
  isActive: boolean;
  utilizationImpact: number;
}

@Component({
  selector: 'app-flow-analysis',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSnackBarModule,
    AnalysisViewSwitcherComponent
  ],
  templateUrl: './flow-analysis.component.html',
  styleUrl: './flow-analysis.component.scss'
})
export class FlowAnalysisComponent extends BaseAnalysisComponent<FlowAnalysisResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // Flow-specific properties
  private flowMetrics: FlowMetrics | null = null;
  private sourcesInfo: SourceInfo[] = [];
  private targetFlowsList: Array<{nodeId: string, flow: number}> = [];
  private bottleneckNodes: number[] = [];
  private highlightedFlowType: string | null = null;

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadFlowData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadFlowData(): void {
    const flowData = this.analysisState.flowAnalysisData();
    
    if (!flowData || !flowData.results) {
      this.setError('No flow analysis data available');
      return;
    }


    this.setLoading(true);
    
    try {
      const analysisData: AnalysisComponentData<FlowAnalysisResult> = {
        structure: flowData.structure,
        results: flowData.results
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      this.snackBar.open(`Flow analysis loaded: ${(this.getNetworkUtilization() * 100).toFixed(1)}% network utilization`, 'Close', {
        duration: 3000
      });
      
    } catch (error) {
      this.setError(`Failed to load flow data: ${error}`);
      this.setLoading(false);
    }
  }

  processData(data: AnalysisComponentData<FlowAnalysisResult>): void {
    // Process and prepare data for visualization
    console.log('Processing flow analysis data:', data);
    
    // Calculate flow metrics
    this.flowMetrics = this.calculateFlowMetrics(data.results);
    
    // Process source information
    this.sourcesInfo = this.calculateSourcesInfo(data.results);
    
    // Process target flows
    this.targetFlowsList = Object.entries(data.results.target_flows || {})
      .map(([nodeId, flow]) => ({nodeId, flow}))
      .sort((a, b) => b.flow - a.flow);
    
    // Identify potential bottlenecks (sources with high utilization impact)
    this.bottleneckNodes = this.identifyBottlenecks(data.results);
    
    // Update visualization config based on data
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [], // Will be set based on flow highlighting
      nodeColors: this.generateFlowNodeColors(data.results)
    }));
  }

  private calculateFlowMetrics(results: FlowAnalysisResult): FlowMetrics {
    const utilization = results.network_utilization || 0;
    const utilizationPercentage = utilization * 100;
    
    // Calculate flow efficiency (output/input ratio)
    const flowEfficiency = results.total_source_input > 0 
      ? results.total_target_output / results.total_source_input 
      : 0;
    
    const targetFlows = Object.values(results.target_flows || {});
    const averageTargetFlow = targetFlows.length > 0 
      ? targetFlows.reduce((sum, flow) => sum + flow, 0) / targetFlows.length 
      : 0;
    
    const maxTargetFlow = targetFlows.length > 0 ? Math.max(...targetFlows) : 0;
    
    // Categorize utilization
    let utilizationCategory: 'low' | 'moderate' | 'high' | 'saturated';
    if (utilizationPercentage < 25) {
      utilizationCategory = 'low';
    } else if (utilizationPercentage < 65) {
      utilizationCategory = 'moderate';
    } else if (utilizationPercentage < 90) {
      utilizationCategory = 'high';
    } else {
      utilizationCategory = 'saturated';
    }

    return {
      utilizationPercentage,
      flowEfficiency,
      activeSourcesCount: results.active_sources?.length || 0,
      totalTargets: Object.keys(results.target_flows || {}).length,
      averageTargetFlow,
      maxTargetFlow,
      utilizationCategory
    };
  }

  private calculateSourcesInfo(results: FlowAnalysisResult): SourceInfo[] {
    const activeSources = results.active_sources || [];
    const totalInput = results.total_source_input || 1; // Avoid division by zero
    
    return activeSources.map(nodeId => {
      // In a real implementation, we would have individual source contributions
      // For now, we'll estimate based on equal distribution
      const estimatedContribution = totalInput / activeSources.length;
      const utilizationImpact = estimatedContribution / totalInput;
      
      return {
        nodeId,
        contribution: estimatedContribution,
        isActive: true,
        utilizationImpact
      };
    });
  }

  private identifyBottlenecks(results: FlowAnalysisResult): number[] {
    // Identify potential bottlenecks based on flow patterns
    // In a real implementation, this would be more sophisticated
    const bottlenecks: number[] = [];
    
    // High-utilization active sources could be bottlenecks
    const activeSources = results.active_sources || [];
    if (results.network_utilization > 0.8 && activeSources.length < 3) {
      bottlenecks.push(...activeSources);
    }
    
    // Targets with significantly lower flow than input could indicate bottlenecks
    const targetFlows = Object.values(results.target_flows || {});
    const totalOutput = results.total_target_output || 0;
    const totalInput = results.total_source_input || 0;
    
    if (totalInput > totalOutput * 1.5) {
      // Potential flow restriction - add targets as potential bottlenecks
      const targetNodes = Object.keys(results.target_flows || {})
        .map(nodeId => parseInt(nodeId, 10))
        .filter(nodeId => !isNaN(nodeId));
      bottlenecks.push(...targetNodes);
    }
    
    return [...new Set(bottlenecks)]; // Remove duplicates
  }

  private generateFlowNodeColors(results: FlowAnalysisResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Color active sources with green intensity based on contribution
    const activeSources = results.active_sources || [];
    const totalInput = results.total_source_input || 1;
    
    activeSources.forEach(nodeId => {
      // Estimate contribution (in a real implementation, this would be precise)
      const estimatedContribution = totalInput / activeSources.length;
      const intensity = Math.max(0.3, Math.min(1.0, estimatedContribution / (totalInput * 0.5)));
      nodeColors[nodeId] = `rgba(76, 175, 80, ${intensity})`; // Green with varying alpha
    });
    
    // Color target nodes based on flow volume
    const targetFlows = results.target_flows || {};
    const maxFlow = Math.max(...Object.values(targetFlows));
    
    Object.entries(targetFlows).forEach(([nodeIdStr, flow]) => {
      const nodeId = parseInt(nodeIdStr, 10);
      if (!isNaN(nodeId)) {
        const intensity = maxFlow > 0 ? Math.max(0.3, flow / maxFlow) : 0.3;
        nodeColors[nodeId] = `rgba(139, 195, 74, ${intensity})`; // Light green for targets
      }
    });
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    // Update the visualization based on the config
    console.log('Updating flow visualization with config:', config);
    
    if (this.isVisualMode()) {
      // Update the graph visualization component
      // This will be implemented when we add the graph component
    }
  }

  exportData(format: 'json' | 'csv' | 'png'): void {
    const data = this.componentData();
    if (!data) return;
    
    switch (format) {
      case 'json':
        this.exportAsJson(data.results);
        break;
      case 'csv':
        this.exportAsCsv(data.results);
        break;
      case 'png':
        this.exportAsPng();
        break;
    }
  }

  private exportAsJson(data: FlowAnalysisResult): void {
    const exportData = {
      network_utilization: data.network_utilization,
      total_source_input: data.total_source_input,
      total_target_output: data.total_target_output,
      active_sources: data.active_sources,
      target_flows: data.target_flows,
      execution_time: data.execution_time,
      flow_metrics: this.flowMetrics,
      sources_info: this.sourcesInfo,
      bottleneck_nodes: this.bottleneckNodes,
      exported_at: new Date().toISOString()
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: FlowAnalysisResult): void {
    const csvRows = [
      ['Metric', 'Value'],
      ['Network Utilization (%)', (data.network_utilization * 100).toFixed(2)],
      ['Total Source Input', data.total_source_input?.toString() || '0'],
      ['Total Target Output', data.total_target_output?.toString() || '0'],
      ['Flow Efficiency (%)', ((this.flowMetrics?.flowEfficiency || 0) * 100).toFixed(2)],
      ['Active Sources Count', data.active_sources?.length?.toString() || '0'],
      ['Total Targets', Object.keys(data.target_flows || {}).length.toString()],
      ['Average Target Flow', this.flowMetrics?.averageTargetFlow?.toFixed(2) || '0'],
      ['Max Target Flow', this.flowMetrics?.maxTargetFlow?.toString() || '0'],
      ['Execution Time (s)', data.execution_time?.toString() || '0'],
      ['Utilization Category', this.flowMetrics?.utilizationCategory || 'unknown']
    ];

    // Add active sources
    csvRows.push(['Active Sources', (data.active_sources || []).join('; ')]);
    
    // Add target flows
    Object.entries(data.target_flows || {}).forEach(([nodeId, flow]) => {
      csvRows.push([`Target ${nodeId} Flow`, flow.toString()]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-analysis-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsPng(): void {
    // This would capture the visualization canvas/svg as PNG
    this.snackBar.open('PNG export not yet implemented', 'Close', { duration: 3000 });
  }

  // Template helper methods
  getNetworkName(): string {
    return this.componentData()?.structure?.networkName || 'Network';
  }

  getNetworkUtilization(): number {
    return this.componentData()?.results?.network_utilization || 0;
  }

  getUtilizationPercentage(): number {
    return this.getNetworkUtilization() * 100;
  }

  getTotalSourceInput(): number {
    return this.componentData()?.results?.total_source_input || 0;
  }

  getTotalTargetOutput(): number {
    return this.componentData()?.results?.total_target_output || 0;
  }

  getActiveSources(): number[] {
    return this.componentData()?.results?.active_sources || [];
  }

  getActiveSourcesCount(): number {
    return this.getActiveSources().length;
  }

  getTargetFlows(): Record<string, number> {
    return this.componentData()?.results?.target_flows || {};
  }

  getTargetFlowsList(): Array<{nodeId: string, flow: number}> {
    return this.targetFlowsList;
  }

  getExecutionTime(): number {
    return this.componentData()?.results?.execution_time || 0;
  }

  getDataType(): string {
    return 'flow_analysis';
  }

  getFlowMetrics(): FlowMetrics | null {
    return this.flowMetrics;
  }

  getFlowEfficiency(): number {
    return this.flowMetrics?.flowEfficiency || 0;
  }

  getFlowEfficiencyPercentage(): number {
    return this.getFlowEfficiency() * 100;
  }

  getUtilizationCategory(): string {
    return this.flowMetrics?.utilizationCategory || 'unknown';
  }

  getUtilizationCategoryColor(): string {
    const category = this.getUtilizationCategory();
    switch (category) {
      case 'low': return '#8BC34A'; // Light green
      case 'moderate': return '#4CAF50'; // Green
      case 'high': return '#FF9800'; // Orange
      case 'saturated': return '#F44336'; // Red
      default: return '#9E9E9E'; // Grey
    }
  }

  getSourcesInfo(): SourceInfo[] {
    return this.sourcesInfo;
  }

  getBottleneckNodes(): number[] {
    return this.bottleneckNodes;
  }

  getFormattedExecutionTime(): string {
    const time = this.getExecutionTime();
    if (time < 1) {
      return `${(time * 1000).toFixed(0)}ms`;
    } else if (time < 60) {
      return `${time.toFixed(2)}s`;
    } else {
      const minutes = Math.floor(time / 60);
      const seconds = (time % 60).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  // Flow highlighting methods for interaction
  highlightActiveSources(): void {
    this.highlightNodes(this.getActiveSources());
    this.highlightedFlowType = 'sources';
  }

  highlightTargetNodes(): void {
    const targetNodes = Object.keys(this.getTargetFlows())
      .map(nodeId => parseInt(nodeId, 10))
      .filter(nodeId => !isNaN(nodeId));
    this.highlightNodes(targetNodes);
    this.highlightedFlowType = 'targets';
  }

  highlightBottlenecks(): void {
    this.highlightNodes(this.getBottleneckNodes());
    this.highlightedFlowType = 'bottlenecks';
  }

  highlightHighFlowTargets(): void {
    const highFlowTargets = this.targetFlowsList
      .slice(0, Math.ceil(this.targetFlowsList.length * 0.3)) // Top 30%
      .map(target => parseInt(target.nodeId, 10))
      .filter(nodeId => !isNaN(nodeId));
    
    this.highlightNodes(highFlowTargets);
    this.highlightedFlowType = 'high-flow';
  }

  getActiveSourcesList(): string {
    const sources = this.getActiveSources();
    if (sources.length === 0) return 'None';
    if (sources.length > 10) {
      return `${sources.slice(0, 10).join(', ')}... (+${sources.length - 10} more)`;
    }
    return sources.join(', ');
  }

  getTargetNodesList(): string {
    const targets = Object.keys(this.getTargetFlows());
    if (targets.length === 0) return 'None';
    if (targets.length > 10) {
      return `${targets.slice(0, 10).join(', ')}... (+${targets.length - 10} more)`;
    }
    return targets.join(', ');
  }

  isHighlightedFlowType(type: string): boolean {
    return this.highlightedFlowType === type;
  }

  hasBottlenecks(): boolean {
    return this.getBottleneckNodes().length > 0;
  }

  getBottlenecksList(): string {
    const bottlenecks = this.getBottleneckNodes();
    if (bottlenecks.length === 0) return 'None detected';
    if (bottlenecks.length > 5) {
      return `${bottlenecks.slice(0, 5).join(', ')}... (+${bottlenecks.length - 5} more)`;
    }
    return bottlenecks.join(', ');
  }
}