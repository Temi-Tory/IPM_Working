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
import { DataType } from '../../shared/models/network-analysis.models';

interface CriticalPathResult {
  time_analysis?: {
    critical_duration: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  cost_analysis?: {
    total_cost: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  execution_time: number;
  data_type?: DataType;
  error?: string;
}

interface PathMetrics {
  criticalDuration: number;
  totalCost: number;
  criticalPathLength: number;
  timeEfficiency: number;
  costEfficiency: number;
  analysisType: 'time' | 'cost' | 'both' | 'none';
  pathCategory: 'short' | 'moderate' | 'long' | 'complex';
}

interface NodeCriticality {
  nodeId: number;
  timeValue: number;
  costValue: number;
  isCriticalForTime: boolean;
  isCriticalForCost: boolean;
  criticalityScore: number;
  bottleneckPotential: 'low' | 'moderate' | 'high' | 'critical';
}

@Component({
  selector: 'app-critical-path',
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
  templateUrl: './critical-path.component.html',
  styleUrl: './critical-path.component.scss'
})
export class CriticalPathComponent extends BaseAnalysisComponent<CriticalPathResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // Critical path-specific properties
  private pathMetrics: PathMetrics | null = null;
  private nodeCriticality: NodeCriticality[] = [];
  private criticalTimeNodes: number[] = [];
  private criticalCostNodes: number[] = [];
  private optimizationOpportunities: Array<{nodeId: number, type: 'time' | 'cost', impact: number}> = [];
  private highlightedPathType: string | null = null;

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadCriticalPathData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadCriticalPathData(): void {
    const criticalPathData = this.analysisState.criticalPathData();
    
    if (!criticalPathData || !criticalPathData.results) {
      this.setError('No critical path analysis data available');
      return;
    }

    if (criticalPathData.results.error) {
      this.setError(`Critical path analysis failed: ${criticalPathData.results.error}`);
      return;
    }

    this.setLoading(true);
    
    try {
      const analysisData: AnalysisComponentData<CriticalPathResult> = {
        structure: criticalPathData.structure,
        results: criticalPathData.results
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      const duration = this.getCriticalDuration();
      const cost = this.getTotalCost();
      let message = 'Critical path analysis loaded';
      
      if (duration > 0 && cost > 0) {
        message += `: ${duration.toFixed(1)} time units, ${cost.toFixed(1)} cost units`;
      } else if (duration > 0) {
        message += `: ${duration.toFixed(1)} time units`;
      } else if (cost > 0) {
        message += `: ${cost.toFixed(1)} cost units`;
      }
      
      this.snackBar.open(message, 'Close', {
        duration: 3000
      });
      
    } catch (error) {
      this.setError(`Failed to load critical path data: ${error}`);
      this.setLoading(false);
    }
  }

  processData(data: AnalysisComponentData<CriticalPathResult>): void {
    // Process and prepare data for visualization
    console.log('Processing critical path analysis data:', data);
    
    // Calculate path metrics
    this.pathMetrics = this.calculatePathMetrics(data.results);
    
    // Process node criticality information
    this.nodeCriticality = this.calculateNodeCriticality(data.results);
    
    // Identify critical nodes for time and cost
    this.criticalTimeNodes = data.results.time_analysis?.critical_nodes || [];
    this.criticalCostNodes = data.results.cost_analysis?.critical_nodes || [];
    
    // Identify optimization opportunities
    this.optimizationOpportunities = this.identifyOptimizationOpportunities(data.results);
    
    // Update visualization config based on data
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [], // Will be set based on path highlighting
      nodeColors: this.generateCriticalPathNodeColors(data.results)
    }));
  }

  private calculatePathMetrics(results: CriticalPathResult): PathMetrics {
    const timeAnalysis = results.time_analysis;
    const costAnalysis = results.cost_analysis;
    
    const criticalDuration = timeAnalysis?.critical_duration || 0;
    const totalCost = costAnalysis?.total_cost || 0;
    const criticalPathLength = Math.max(
      timeAnalysis?.critical_nodes?.length || 0,
      costAnalysis?.critical_nodes?.length || 0
    );
    
    // Calculate efficiency metrics (higher is better)
    const timeEfficiency = criticalDuration > 0 ? 1 / Math.log(criticalDuration + 1) : 0;
    const costEfficiency = totalCost > 0 ? 1 / Math.log(totalCost + 1) : 0;
    
    // Determine analysis type
    let analysisType: 'time' | 'cost' | 'both' | 'none';
    if (timeAnalysis && costAnalysis) {
      analysisType = 'both';
    } else if (timeAnalysis) {
      analysisType = 'time';
    } else if (costAnalysis) {
      analysisType = 'cost';
    } else {
      analysisType = 'none';
    }
    
    // Categorize path complexity
    let pathCategory: 'short' | 'moderate' | 'long' | 'complex';
    if (criticalPathLength < 5) {
      pathCategory = 'short';
    } else if (criticalPathLength < 15) {
      pathCategory = 'moderate';
    } else if (criticalPathLength < 30) {
      pathCategory = 'long';
    } else {
      pathCategory = 'complex';
    }

    return {
      criticalDuration,
      totalCost,
      criticalPathLength,
      timeEfficiency,
      costEfficiency,
      analysisType,
      pathCategory
    };
  }

  private calculateNodeCriticality(results: CriticalPathResult): NodeCriticality[] {
    const criticality: NodeCriticality[] = [];
    const timeNodes = results.time_analysis?.critical_nodes || [];
    const costNodes = results.cost_analysis?.critical_nodes || [];
    const timeValues = results.time_analysis?.node_values || {};
    const costValues = results.cost_analysis?.node_values || {};
    
    // Get all unique nodes from both analyses
    const allNodes = new Set([...timeNodes, ...costNodes]);
    
    allNodes.forEach(nodeId => {
      const timeValue = typeof timeValues[nodeId.toString()] === 'number' ? timeValues[nodeId.toString()] : parseFloat(String(timeValues[nodeId.toString()] || 0));
      const costValue = typeof costValues[nodeId.toString()] === 'number' ? costValues[nodeId.toString()] : parseFloat(String(costValues[nodeId.toString()] || 0));
      const isCriticalForTime = timeNodes.includes(nodeId);
      const isCriticalForCost = costNodes.includes(nodeId);
      
      // Calculate criticality score (0-1, higher is more critical)
      let criticalityScore = 0;
      if (isCriticalForTime) criticalityScore += 0.5;
      if (isCriticalForCost) criticalityScore += 0.5;
      
      // Add value-based scoring
      const maxTimeValue = Math.max(...Object.values(timeValues).map(v => typeof v === 'number' ? v : parseFloat(String(v || 0))));
      const maxCostValue = Math.max(...Object.values(costValues).map(v => typeof v === 'number' ? v : parseFloat(String(v || 0))));
      
      if (maxTimeValue > 0) {
        criticalityScore += (timeValue / maxTimeValue) * 0.25;
      }
      if (maxCostValue > 0) {
        criticalityScore += (costValue / maxCostValue) * 0.25;
      }
      
      criticalityScore = Math.min(1, criticalityScore);
      
      // Determine bottleneck potential
      let bottleneckPotential: 'low' | 'moderate' | 'high' | 'critical';
      if (criticalityScore < 0.25) {
        bottleneckPotential = 'low';
      } else if (criticalityScore < 0.5) {
        bottleneckPotential = 'moderate';
      } else if (criticalityScore < 0.75) {
        bottleneckPotential = 'high';
      } else {
        bottleneckPotential = 'critical';
      }
      
      criticality.push({
        nodeId,
        timeValue,
        costValue,
        isCriticalForTime,
        isCriticalForCost,
        criticalityScore,
        bottleneckPotential
      });
    });
    
    // Sort by criticality score descending
    return criticality.sort((a, b) => b.criticalityScore - a.criticalityScore);
  }

  private identifyOptimizationOpportunities(results: CriticalPathResult): Array<{nodeId: number, type: 'time' | 'cost', impact: number}> {
    const opportunities: Array<{nodeId: number, type: 'time' | 'cost', impact: number}> = [];
    
    // Identify high-impact time optimization opportunities
    const timeValues = results.time_analysis?.node_values || {};
    const criticalTimeNodes = results.time_analysis?.critical_nodes || [];
    
    Object.entries(timeValues).forEach(([nodeIdStr, value]) => {
      const nodeId = parseInt(nodeIdStr, 10);
      const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0));
      
      if (!isNaN(nodeId) && criticalTimeNodes.includes(nodeId) && numValue > 0) {
        // Impact is proportional to the time value and position in critical path
        const impact = numValue / (results.time_analysis?.critical_duration || 1);
        opportunities.push({ nodeId, type: 'time', impact });
      }
    });
    
    // Identify high-impact cost optimization opportunities
    const costValues = results.cost_analysis?.node_values || {};
    const criticalCostNodes = results.cost_analysis?.critical_nodes || [];
    
    Object.entries(costValues).forEach(([nodeIdStr, value]) => {
      const nodeId = parseInt(nodeIdStr, 10);
      const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0));
      
      if (!isNaN(nodeId) && criticalCostNodes.includes(nodeId) && numValue > 0) {
        // Impact is proportional to the cost value and relative to total cost
        const impact = numValue / (results.cost_analysis?.total_cost || 1);
        opportunities.push({ nodeId, type: 'cost', impact });
      }
    });
    
    // Sort by impact descending and take top opportunities
    return opportunities.sort((a, b) => b.impact - a.impact).slice(0, 10);
  }

  private generateCriticalPathNodeColors(results: CriticalPathResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Orange theme colors for critical path
    const criticalTimeColor = '#FF9800'; // Orange
    const criticalCostColor = '#FFC107'; // Amber
    const bothCriticalColor = '#FF5722'; // Deep Orange
    const nonCriticalColor = '#E0E0E0'; // Light Grey
    
    const timeNodes = results.time_analysis?.critical_nodes || [];
    const costNodes = results.cost_analysis?.critical_nodes || [];
    
    // Color nodes based on criticality
    timeNodes.forEach(nodeId => {
      if (costNodes.includes(nodeId)) {
        nodeColors[nodeId] = bothCriticalColor; // Critical for both time and cost
      } else {
        nodeColors[nodeId] = criticalTimeColor; // Critical for time only
      }
    });
    
    costNodes.forEach(nodeId => {
      if (!nodeColors[nodeId]) { // Not already colored as both critical
        nodeColors[nodeId] = criticalCostColor; // Critical for cost only
      }
    });
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    // Update the visualization based on the config
    console.log('Updating critical path visualization with config:', config);
    
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

  private exportAsJson(data: CriticalPathResult): void {
    const exportData = {
      time_analysis: data.time_analysis,
      cost_analysis: data.cost_analysis,
      execution_time: data.execution_time,
      data_type: data.data_type,
      path_metrics: this.pathMetrics,
      node_criticality: this.nodeCriticality,
      optimization_opportunities: this.optimizationOpportunities,
      exported_at: new Date().toISOString()
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-path-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: CriticalPathResult): void {
    const csvRows = [
      ['Metric', 'Value'],
      ['Critical Duration', data.time_analysis?.critical_duration?.toString() || '0'],
      ['Total Cost', data.cost_analysis?.total_cost?.toString() || '0'],
      ['Critical Path Length (Time)', data.time_analysis?.critical_nodes?.length?.toString() || '0'],
      ['Critical Path Length (Cost)', data.cost_analysis?.critical_nodes?.length?.toString() || '0'],
      ['Time Efficiency', this.pathMetrics?.timeEfficiency?.toFixed(4) || '0'],
      ['Cost Efficiency', this.pathMetrics?.costEfficiency?.toFixed(4) || '0'],
      ['Path Category', this.pathMetrics?.pathCategory || 'unknown'],
      ['Analysis Type', this.pathMetrics?.analysisType || 'unknown'],
      ['Execution Time (s)', data.execution_time?.toString() || '0'],
      ['Data Type', data.data_type || 'unknown']
    ];

    // Add critical nodes
    const timeNodes = data.time_analysis?.critical_nodes || [];
    const costNodes = data.cost_analysis?.critical_nodes || [];
    
    csvRows.push(['Critical Time Nodes', timeNodes.join('; ')]);
    csvRows.push(['Critical Cost Nodes', costNodes.join('; ')]);
    
    // Add node values
    if (data.time_analysis?.node_values) {
      Object.entries(data.time_analysis.node_values).forEach(([nodeId, value]) => {
        csvRows.push([`Time Node ${nodeId}`, value.toString()]);
      });
    }
    
    if (data.cost_analysis?.node_values) {
      Object.entries(data.cost_analysis.node_values).forEach(([nodeId, value]) => {
        csvRows.push([`Cost Node ${nodeId}`, value.toString()]);
      });
    }
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-path-analysis-${Date.now()}.csv`;
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

  getCriticalDuration(): number {
    return this.componentData()?.results?.time_analysis?.critical_duration || 0;
  }

  getTotalCost(): number {
    return this.componentData()?.results?.cost_analysis?.total_cost || 0;
  }

  getCriticalTimeNodes(): number[] {
    return this.criticalTimeNodes;
  }

  getCriticalCostNodes(): number[] {
    return this.criticalCostNodes;
  }

  getTimeNodeValues(): Record<string, number> {
    return this.componentData()?.results?.time_analysis?.node_values || {};
  }

  getCostNodeValues(): Record<string, number> {
    return this.componentData()?.results?.cost_analysis?.node_values || {};
  }

  getExecutionTime(): number {
    return this.componentData()?.results?.execution_time || 0;
  }

  getDataType(): string {
    return this.componentData()?.results?.data_type || 'unknown';
  }

  getPathMetrics(): PathMetrics | null {
    return this.pathMetrics;
  }

  getNodeCriticality(): NodeCriticality[] {
    return this.nodeCriticality;
  }

  getOptimizationOpportunities(): Array<{nodeId: number, type: 'time' | 'cost', impact: number}> {
    return this.optimizationOpportunities;
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

  hasTimeAnalysis(): boolean {
    return !!(this.componentData()?.results?.time_analysis);
  }

  hasCostAnalysis(): boolean {
    return !!(this.componentData()?.results?.cost_analysis);
  }

  hasBothAnalyses(): boolean {
    return this.hasTimeAnalysis() && this.hasCostAnalysis();
  }

  getAnalysisType(): string {
    return this.pathMetrics?.analysisType || 'none';
  }

  getPathCategory(): string {
    return this.pathMetrics?.pathCategory || 'unknown';
  }

  getPathCategoryColor(): string {
    const category = this.getPathCategory();
    switch (category) {
      case 'short': return '#4CAF50'; // Green
      case 'moderate': return '#FF9800'; // Orange
      case 'long': return '#F44336'; // Red
      case 'complex': return '#9C27B0'; // Purple
      default: return '#9E9E9E'; // Grey
    }
  }

  getCriticalPathLength(): number {
    return this.pathMetrics?.criticalPathLength || 0;
  }

  getTimeEfficiency(): number {
    return this.pathMetrics?.timeEfficiency || 0;
  }

  getCostEfficiency(): number {
    return this.pathMetrics?.costEfficiency || 0;
  }

  // Path highlighting methods for interaction
  highlightTimeCriticalPath(): void {
    this.highlightNodes(this.getCriticalTimeNodes());
    this.highlightedPathType = 'time';
  }

  highlightCostCriticalPath(): void {
    this.highlightNodes(this.getCriticalCostNodes());
    this.highlightedPathType = 'cost';
  }

  highlightBothCriticalPaths(): void {
    const combinedNodes = [...new Set([...this.getCriticalTimeNodes(), ...this.getCriticalCostNodes()])];
    this.highlightNodes(combinedNodes);
    this.highlightedPathType = 'both';
  }

  highlightOptimizationTargets(): void {
    const targets = this.getOptimizationOpportunities()
      .slice(0, Math.ceil(this.getOptimizationOpportunities().length * 0.3)) // Top 30%
      .map(opp => opp.nodeId);
    
    this.highlightNodes(targets);
    this.highlightedPathType = 'optimization';
  }

  isHighlightedPathType(type: string): boolean {
    return this.highlightedPathType === type;
  }

  getCriticalTimeNodesList(): string {
    const nodes = this.getCriticalTimeNodes();
    if (nodes.length === 0) return 'None';
    if (nodes.length > 10) {
      return `${nodes.slice(0, 10).join(', ')}... (+${nodes.length - 10} more)`;
    }
    return nodes.join(', ');
  }

  getCriticalCostNodesList(): string {
    const nodes = this.getCriticalCostNodes();
    if (nodes.length === 0) return 'None';
    if (nodes.length > 10) {
      return `${nodes.slice(0, 10).join(', ')}... (+${nodes.length - 10} more)`;
    }
    return nodes.join(', ');
  }

  getTopCriticalNodes(): NodeCriticality[] {
    return this.nodeCriticality.slice(0, 8);
  }

  hasOptimizationOpportunities(): boolean {
    return this.optimizationOpportunities.length > 0;
  }

  getTopOptimizationOpportunities(): Array<{nodeId: number, type: 'time' | 'cost', impact: number}> {
    return this.optimizationOpportunities.slice(0, 6);
  }

  getBottleneckColorForPotential(potential: string): string {
    switch (potential) {
      case 'low': return '#4CAF50'; // Green
      case 'moderate': return '#FF9800'; // Orange
      case 'high': return '#F44336'; // Red
      case 'critical': return '#9C27B0'; // Purple
      default: return '#9E9E9E'; // Grey
    }
  }

  // Helper methods for template expressions (to avoid filter in bindings)
  getTimeCriticalNodes(): NodeCriticality[] {
    return this.nodeCriticality.filter(n => n.isCriticalForTime);
  }

  getCostCriticalNodes(): NodeCriticality[] {
    return this.nodeCriticality.filter(n => n.isCriticalForCost);
  }

  getHighImpactOpportunities(): Array<{nodeId: number, type: 'time' | 'cost', impact: number}> {
    return this.optimizationOpportunities.filter(o => o.impact > 0.1);
  }
}