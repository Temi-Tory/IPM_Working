import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';

import { BaseAnalysisComponent, AnalysisComponentData, VisualizationConfig } from '../../shared/interfaces/analysis-component.interface';
import { AnalysisViewSwitcherComponent } from '../../shared/components/analysis-view-switcher/analysis-view-switcher.component';
import { AnalysisStateService, AnalysisStateSnapshot } from '../../shared/services/analysis-state.service';
import { DataType } from '../../shared/models/network-analysis.models';

interface SystemProfileResult {
  networkName: string;
  totalAnalyses: number;
  completedAnalyses: number;
  failedAnalyses: number;
  overallHealthScore: number;
  analysisResults: {
    networkStructure?: {
      status: 'completed' | 'failed' | 'not_run';
      data?: any;
      executionTime?: number;
    };
    exactInference?: {
      status: 'completed' | 'failed' | 'not_run';
      data?: any;
      executionTime?: number;
    };
    flowAnalysis?: {
      status: 'completed' | 'failed' | 'not_run';
      data?: any;
      executionTime?: number;
    };
    criticalPath?: {
      status: 'completed' | 'failed' | 'not_run';
      data?: any;
      executionTime?: number;
    };
  };
  performanceMetrics: {
    totalExecutionTime: number;
    averageExecutionTime: number;
    fastestAnalysis: string;
    slowestAnalysis: string;
  };
  networkInsights: {
    totalNodes: number;
    totalEdges: number;
    sourceNodes: number;
    sinkNodes: number;
    networkDensity: number;
    topologyComplexity: 'simple' | 'moderate' | 'complex';
  };
  crossAnalysisInsights: {
    flowToTopologyRatio: number;
    inferenceQuality: 'high' | 'medium' | 'low' | 'unknown';
    systemEfficiency: number;
    recommendations: string[];
  };
}

interface SystemMetric {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  icon: string;
  trend?: 'up' | 'down' | 'stable';
  description: string;
}

interface AnalysisComparison {
  analysisType: string;
  status: string;
  successRate: number;
  avgExecutionTime: number;
  keyMetric?: {
    label: string;
    value: string;
  };
}

@Component({
  selector: 'app-system-profile',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTabsModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatDividerModule,
    MatGridListModule,
    AnalysisViewSwitcherComponent
  ],
  templateUrl: './system-profile.component.html',
  styleUrl: './system-profile.component.scss'
})
export class SystemProfileComponent extends BaseAnalysisComponent<SystemProfileResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // System profile specific properties
  private systemSnapshot: AnalysisStateSnapshot | null = null;
  private systemMetrics: SystemMetric[] = [];
  private analysisComparisons: AnalysisComparison[] = [];
  private executiveSummary: string[] = [];
  private recommendations: string[] = [];

  constructor() {
    super();
  }

  // Template helper methods for safe data access
  getSystemProfileResults(): SystemProfileResult | null {
    return this.componentData()?.results || null;
  }

  getNetworkInsights(): SystemProfileResult['networkInsights'] | null {
    return this.getSystemProfileResults()?.networkInsights || null;
  }

  getCrossAnalysisInsights(): SystemProfileResult['crossAnalysisInsights'] | null {
    return this.getSystemProfileResults()?.crossAnalysisInsights || null;
  }

  getAnalysisResults(): SystemProfileResult['analysisResults'] | null {
    return this.getSystemProfileResults()?.analysisResults || null;
  }

  getPerformanceMetrics(): SystemProfileResult['performanceMetrics'] | null {
    return this.getSystemProfileResults()?.performanceMetrics || null;
  }

  getTotalNodes(): number {
    return this.getNetworkInsights()?.totalNodes || 0;
  }

  getTotalEdges(): number {
    return this.getNetworkInsights()?.totalEdges || 0;
  }

  getOverallHealthScore(): number {
    return this.getSystemProfileResults()?.overallHealthScore || 0;
  }

  getCompletedAnalyses(): number {
    return this.getSystemProfileResults()?.completedAnalyses || 0;
  }

  getFailedAnalyses(): number {
    return this.getSystemProfileResults()?.failedAnalyses || 0;
  }

  getTotalAnalyses(): number {
    return this.getSystemProfileResults()?.totalAnalyses || 0;
  }

  getSystemEfficiency(): number {
    return this.getCrossAnalysisInsights()?.systemEfficiency || 0;
  }

  getTopologyComplexity(): string {
    return this.getNetworkInsights()?.topologyComplexity || '';
  }

  getAnalysisStatus(analysisType: 'networkStructure' | 'exactInference' | 'flowAnalysis' | 'criticalPath'): string {
    return this.getAnalysisResults()?.[analysisType]?.status || 'not_run';
  }

  // Additional helper methods needed by template
  getSourceNodes(): number {
    return this.getNetworkInsights()?.sourceNodes || 0;
  }

  getSinkNodes(): number {
    return this.getNetworkInsights()?.sinkNodes || 0;
  }

  getNetworkDensity(): number {
    return this.getNetworkInsights()?.networkDensity || 0;
  }

  getInferenceQuality(): string {
    return this.getCrossAnalysisInsights()?.inferenceQuality || '';
  }

  getFlowToTopologyRatio(): number {
    return this.getCrossAnalysisInsights()?.flowToTopologyRatio || 0;
  }

  getTotalExecutionTime(): number {
    return this.getPerformanceMetrics()?.totalExecutionTime || 0;
  }

  getAverageExecutionTime(): number {
    return this.getPerformanceMetrics()?.averageExecutionTime || 0;
  }

  getFastestAnalysis(): string {
    return this.getPerformanceMetrics()?.fastestAnalysis || '';
  }

  getSlowestAnalysis(): string {
    return this.getPerformanceMetrics()?.slowestAnalysis || '';
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadSystemProfile();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('dashboard'); // Start with dashboard for executive view
  }

  private loadSystemProfile(): void {
    this.systemSnapshot = this.analysisState.getCurrentSnapshot();
    
    if (!this.systemSnapshot) {
      this.setError('No analysis data available for system profile');
      return;
    }

    this.setLoading(true);
    
    try {
      const profileData = this.generateSystemProfile(this.systemSnapshot);
      
      const analysisData: AnalysisComponentData<SystemProfileResult> = {
        structure: this.systemSnapshot.networkStructure,
        results: profileData
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      const healthScore = (profileData.overallHealthScore * 100).toFixed(0);
      this.snackBar.open(`System profile loaded: ${healthScore}% system health`, 'Close', {
        duration: 3000
      });
      
    } catch (error) {
      this.setError(`Failed to generate system profile: ${error}`);
      this.setLoading(false);
    }
  }

  private generateSystemProfile(snapshot: AnalysisStateSnapshot): SystemProfileResult {
    const results = snapshot.analysisResults.results || {};
    
    // Analyze each analysis type
    const analysisResults = {
      networkStructure: this.analyzeAnalysisResult(results.network_structure, snapshot.tabStates.networkStructure),
      exactInference: this.analyzeAnalysisResult(results.exact_inference, snapshot.tabStates.exactInference),
      flowAnalysis: this.analyzeAnalysisResult(results.flow_analysis, snapshot.tabStates.flowAnalysis),
      criticalPath: this.analyzeAnalysisResult(results.critical_path, snapshot.tabStates.criticalPath)
    };

    // Calculate aggregate metrics
    const completedCount = Object.values(analysisResults).filter(a => a.status === 'completed').length;
    const totalCount = Object.values(analysisResults).filter(a => a.status !== 'not_run').length;
    const failedCount = Object.values(analysisResults).filter(a => a.status === 'failed').length;

    // Performance metrics
    const executionTimes = Object.values(analysisResults)
      .filter(a => a.executionTime !== undefined)
      .map(a => a.executionTime!);
    
    const totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
    const averageExecutionTime = executionTimes.length > 0 ? totalExecutionTime / executionTimes.length : 0;
    
    const timeEntries = Object.entries(analysisResults)
      .filter(([_, a]) => a.executionTime !== undefined)
      .map(([name, a]) => ({ name, time: a.executionTime! }));
    
    const fastestAnalysis = timeEntries.length > 0 
      ? timeEntries.reduce((min, curr) => curr.time < min.time ? curr : min).name 
      : 'none';
    const slowestAnalysis = timeEntries.length > 0 
      ? timeEntries.reduce((max, curr) => curr.time > max.time ? curr : max).name 
      : 'none';

    // Network insights
    const networkStructureData = results.network_structure;
    const networkInsights = this.calculateNetworkInsights(networkStructureData);

    // Cross-analysis insights
    const crossAnalysisInsights = this.generateCrossAnalysisInsights(analysisResults, networkInsights);

    // Overall health score (weighted by importance and completion)
    const baseHealthScore = totalCount > 0 ? completedCount / totalCount : 0;
    const complexityBonus = networkInsights.topologyComplexity === 'complex' ? 0.1 : 
                          networkInsights.topologyComplexity === 'moderate' ? 0.05 : 0;
    const overallHealthScore = Math.min(1.0, baseHealthScore + complexityBonus);

    return {
      networkName: snapshot.networkName,
      totalAnalyses: totalCount,
      completedAnalyses: completedCount,
      failedAnalyses: failedCount,
      overallHealthScore,
      analysisResults,
      performanceMetrics: {
        totalExecutionTime,
        averageExecutionTime,
        fastestAnalysis,
        slowestAnalysis
      },
      networkInsights,
      crossAnalysisInsights
    };
  }

  private analyzeAnalysisResult(data: any, tabState: any): any {
    if (!tabState.enabled) {
      return { status: 'not_run' };
    }
    
    if (data?.error || tabState.error) {
      return { 
        status: 'failed',
        executionTime: data?.execution_time || 0
      };
    }
    
    if (tabState.completed && tabState.hasData) {
      return {
        status: 'completed',
        data,
        executionTime: data?.execution_time || 0
      };
    }
    
    return { status: 'failed' };
  }

  private calculateNetworkInsights(networkData: any): SystemProfileResult['networkInsights'] {
    const totalNodes = networkData?.total_nodes || 0;
    const totalEdges = networkData?.total_edges || 0;
    const sourceNodes = networkData?.source_nodes?.length || 0;
    const sinkNodes = networkData?.sink_nodes?.length || 0;

    // Calculate network density (edges / max possible edges)
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const networkDensity = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    // Enhanced complexity calculation using comprehensive data
    let topologyComplexity: 'simple' | 'moderate' | 'complex';
    
    // Check if we have comprehensive structure data
    const hasComprehensiveData = !!(networkData?.edgelist && networkData?.outgoing_index);
    
    if (hasComprehensiveData) {
      // Use comprehensive data for better complexity assessment
      const forkNodes = networkData?.fork_nodes?.length || 0;
      const joinNodes = networkData?.join_nodes?.length || 0;
      const iterationSets = networkData?.iteration_sets?.length || 0;
      
      // More sophisticated complexity scoring
      const complexityScore = this.calculateComplexityScore(
        totalNodes, 
        totalEdges, 
        forkNodes, 
        joinNodes, 
        iterationSets, 
        networkDensity
      );
      
      if (complexityScore < 0.3) {
        topologyComplexity = 'simple';
      } else if (complexityScore < 0.7) {
        topologyComplexity = 'moderate';
      } else {
        topologyComplexity = 'complex';
      }
    } else {
      // Fallback to basic complexity calculation
      if (totalNodes < 10 || networkDensity < 0.1) {
        topologyComplexity = 'simple';
      } else if (totalNodes < 50 && networkDensity < 0.3) {
        topologyComplexity = 'moderate';
      } else {
        topologyComplexity = 'complex';
      }
    }

    return {
      totalNodes,
      totalEdges,
      sourceNodes,
      sinkNodes,
      networkDensity,
      topologyComplexity
    };
  }

  private calculateComplexityScore(
    totalNodes: number, 
    totalEdges: number, 
    forkNodes: number, 
    joinNodes: number, 
    iterationSets: number, 
    networkDensity: number
  ): number {
    // Normalize metrics to 0-1 scale
    const nodeComplexity = Math.min(totalNodes / 100, 1); // Scale up to 100 nodes
    const densityComplexity = networkDensity;
    const branchComplexity = Math.min((forkNodes + joinNodes) / totalNodes, 1);
    const iterationComplexity = Math.min(iterationSets / 10, 1); // Scale up to 10 iteration sets
    
    // Weighted combination
    return (
      nodeComplexity * 0.3 + 
      densityComplexity * 0.3 + 
      branchComplexity * 0.25 + 
      iterationComplexity * 0.15
    );
  }

  private generateCrossAnalysisInsights(
    analysisResults: SystemProfileResult['analysisResults'],
    networkInsights: SystemProfileResult['networkInsights']
  ): SystemProfileResult['crossAnalysisInsights'] {
    const recommendations: string[] = [];
    let inferenceQuality: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';
    let systemEfficiency = 0.5; // Default neutral efficiency
    
    // Flow to topology analysis
    const flowData = analysisResults.flowAnalysis?.data;
    const flowToTopologyRatio = flowData?.network_utilization || 0;
    
    // Analyze inference quality
    const inferenceData = analysisResults.exactInference?.data;
    if (inferenceData) {
      const diamondsFound = inferenceData.diamonds_found || 0;
      const beliefRange = this.calculateBeliefRange(inferenceData.node_beliefs || {});
      
      if (diamondsFound > 5 && beliefRange > 0.3) {
        inferenceQuality = 'high';
        systemEfficiency += 0.2;
      } else if (diamondsFound > 0 && beliefRange > 0.1) {
        inferenceQuality = 'medium';
        systemEfficiency += 0.1;
      } else {
        inferenceQuality = 'low';
        systemEfficiency -= 0.1;
      }
    }
    
    // Generate recommendations based on analysis
    if (flowToTopologyRatio < 0.3) {
      recommendations.push('Network utilization is low - consider optimizing flow distribution');
    }
    
    if (networkInsights.topologyComplexity === 'complex' && analysisResults.criticalPath?.status === 'failed') {
      recommendations.push('Complex network detected but critical path analysis failed - investigate CPM data');
    }
    
    if (inferenceQuality === 'low') {
      recommendations.push('Low inference quality detected - check node priors and link probabilities');
    }
    
    if (analysisResults.flowAnalysis?.status === 'completed' && flowToTopologyRatio > 0.8) {
      recommendations.push('High network utilization - monitor for potential bottlenecks');
    }
    
    if (networkInsights.sourceNodes === 1) {
      recommendations.push('Single source network detected - consider redundancy for reliability');
    }
    
    // Overall system efficiency calculation
    const completionRate = Object.values(analysisResults).filter(a => a.status === 'completed').length / 4;
    systemEfficiency = Math.max(0, Math.min(1, systemEfficiency + completionRate * 0.3));

    return {
      flowToTopologyRatio,
      inferenceQuality,
      systemEfficiency,
      recommendations
    };
  }

  private calculateBeliefRange(nodeBeliefs: Record<string, number>): number {
    const beliefs = Object.values(nodeBeliefs);
    if (beliefs.length === 0) return 0;
    
    const min = Math.min(...beliefs);
    const max = Math.max(...beliefs);
    return max - min;
  }

  processData(data: AnalysisComponentData<SystemProfileResult>): void {
    console.log('Processing system profile data:', data);
    
    // Generate system metrics
    this.systemMetrics = this.generateSystemMetrics(data.results);
    
    // Generate analysis comparisons
    this.analysisComparisons = this.generateAnalysisComparisons(data.results);
    
    // Generate executive summary
    this.executiveSummary = this.generateExecutiveSummary(data.results);
    
    // Set recommendations
    this.recommendations = data.results.crossAnalysisInsights.recommendations;
    
    // Update visualization config for system-wide view
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      nodeColors: this.generateSystemOverviewColors(data.results),
      highlightNodes: [], // Will be set based on system highlighting
    }));
  }

  private generateSystemMetrics(results: SystemProfileResult): SystemMetric[] {
    return [
      {
        label: 'System Health',
        value: (results.overallHealthScore * 100).toFixed(0),
        unit: '%',
        color: this.getHealthScoreColor(results.overallHealthScore),
        icon: 'favorite',
        trend: 'stable',
        description: 'Overall system analysis health score'
      },
      {
        label: 'Network Size',
        value: results.networkInsights.totalNodes,
        unit: 'nodes',
        color: '#9C27B0',
        icon: 'account_tree',
        description: 'Total number of network nodes'
      },
      {
        label: 'Connectivity',
        value: results.networkInsights.totalEdges,
        unit: 'edges',
        color: '#673AB7',
        icon: 'alt_route',
        description: 'Total number of network connections'
      },
      {
        label: 'Analysis Success',
        value: `${results.completedAnalyses}/${results.totalAnalyses}`,
        color: results.completedAnalyses === results.totalAnalyses ? '#4CAF50' : '#FF9800',
        icon: 'task_alt',
        description: 'Successfully completed analyses'
      },
      {
        label: 'System Efficiency',
        value: (results.crossAnalysisInsights.systemEfficiency * 100).toFixed(0),
        unit: '%',
        color: this.getEfficiencyColor(results.crossAnalysisInsights.systemEfficiency),
        icon: 'speed',
        description: 'Overall system operational efficiency'
      },
      {
        label: 'Topology Complexity',
        value: results.networkInsights.topologyComplexity,
        color: this.getComplexityColor(results.networkInsights.topologyComplexity),
        icon: 'schema',
        description: 'Network structural complexity level'
      }
    ];
  }

  private generateAnalysisComparisons(results: SystemProfileResult): AnalysisComparison[] {
    const comparisons: AnalysisComparison[] = [];
    
    // Network Structure
    if (results.analysisResults.networkStructure?.status !== 'not_run') {
      comparisons.push({
        analysisType: 'Network Structure',
        status: results.analysisResults.networkStructure?.status || 'unknown',
        successRate: results.analysisResults.networkStructure?.status === 'completed' ? 100 : 0,
        avgExecutionTime: results.analysisResults.networkStructure?.executionTime || 0,
        keyMetric: {
          label: 'Nodes',
          value: results.networkInsights.totalNodes.toString()
        }
      });
    }
    
    // Exact Inference
    if (results.analysisResults.exactInference?.status !== 'not_run') {
      const inferenceData = results.analysisResults.exactInference?.data;
      comparisons.push({
        analysisType: 'Exact Inference',
        status: results.analysisResults.exactInference?.status || 'unknown',
        successRate: results.analysisResults.exactInference?.status === 'completed' ? 100 : 0,
        avgExecutionTime: results.analysisResults.exactInference?.executionTime || 0,
        keyMetric: {
          label: 'Diamonds',
          value: (inferenceData?.diamonds_found || 0).toString()
        }
      });
    }
    
    // Flow Analysis
    if (results.analysisResults.flowAnalysis?.status !== 'not_run') {
      const flowData = results.analysisResults.flowAnalysis?.data;
      comparisons.push({
        analysisType: 'Flow Analysis',
        status: results.analysisResults.flowAnalysis?.status || 'unknown',
        successRate: results.analysisResults.flowAnalysis?.status === 'completed' ? 100 : 0,
        avgExecutionTime: results.analysisResults.flowAnalysis?.executionTime || 0,
        keyMetric: {
          label: 'Utilization',
          value: `${((flowData?.network_utilization || 0) * 100).toFixed(1)}%`
        }
      });
    }
    
    // Critical Path
    if (results.analysisResults.criticalPath?.status !== 'not_run') {
      comparisons.push({
        analysisType: 'Critical Path',
        status: results.analysisResults.criticalPath?.status || 'unknown',
        successRate: results.analysisResults.criticalPath?.status === 'completed' ? 100 : 0,
        avgExecutionTime: results.analysisResults.criticalPath?.executionTime || 0,
        keyMetric: {
          label: 'Status',
          value: results.analysisResults.criticalPath?.status === 'completed' ? 'Success' : 'Failed'
        }
      });
    }
    
    return comparisons;
  }

  private generateExecutiveSummary(results: SystemProfileResult): string[] {
    const summary: string[] = [];
    
    // Network overview
    summary.push(
      `Network "${results.networkName}" contains ${results.networkInsights.totalNodes} nodes and ${results.networkInsights.totalEdges} edges with ${results.networkInsights.topologyComplexity} topology complexity.`
    );
    
    // Analysis completion
    if (results.completedAnalyses === results.totalAnalyses) {
      summary.push(`All ${results.totalAnalyses} requested analyses completed successfully.`);
    } else {
      summary.push(
        `${results.completedAnalyses} of ${results.totalAnalyses} analyses completed successfully. ${results.failedAnalyses} analyses failed.`
      );
    }
    
    // Performance summary
    if (results.performanceMetrics.totalExecutionTime > 0) {
      summary.push(
        `Total analysis time: ${results.performanceMetrics.totalExecutionTime.toFixed(2)}s (avg: ${results.performanceMetrics.averageExecutionTime.toFixed(2)}s per analysis).`
      );
    }
    
    // Flow analysis insights
    const flowData = results.analysisResults.flowAnalysis?.data;
    if (flowData) {
      const utilization = (flowData.network_utilization * 100).toFixed(1);
      summary.push(`Network utilization at ${utilization}% with flow efficiency indicating ${results.crossAnalysisInsights.systemEfficiency > 0.7 ? 'optimal' : 'suboptimal'} performance.`);
    }
    
    // Inference insights
    const inferenceData = results.analysisResults.exactInference?.data;
    if (inferenceData) {
      summary.push(
        `Inference analysis found ${inferenceData.diamonds_found} diamonds with ${results.crossAnalysisInsights.inferenceQuality} quality belief propagation.`
      );
    }
    
    // System health conclusion
    const healthPercentage = (results.overallHealthScore * 100).toFixed(0);
    summary.push(`Overall system health score: ${healthPercentage}% indicating ${results.overallHealthScore > 0.8 ? 'excellent' : results.overallHealthScore > 0.6 ? 'good' : 'needs attention'} system performance.`);
    
    return summary;
  }

  private generateSystemOverviewColors(results: SystemProfileResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Color nodes based on system-wide importance and analysis results
    const totalNodes = results.networkInsights.totalNodes;
    
    // Use purple theme for system overview
    const primaryColor = '#9C27B0'; // Purple primary
    const secondaryColor = '#673AB7'; // Purple secondary
    const accentColor = '#E1BEE7'; // Light purple
    
    for (let i = 1; i <= totalNodes; i++) {
      // Default to light purple
      nodeColors[i] = accentColor;
    }
    
    // If we have specific node data, highlight accordingly
    const flowData = results.analysisResults.flowAnalysis?.data;
    if (flowData) {
      // Highlight source nodes with primary color
      flowData.active_sources?.forEach((nodeId: number) => {
        nodeColors[nodeId] = primaryColor;
      });
      
      // Highlight target nodes with secondary color
      if (flowData.target_flows) {
        Object.keys(flowData.target_flows).forEach(nodeIdStr => {
          const nodeId = parseInt(nodeIdStr, 10);
          if (!isNaN(nodeId)) {
            nodeColors[nodeId] = secondaryColor;
          }
        });
      }
    }
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    console.log('Updating system profile visualization with config:', config);
    
    if (this.isVisualMode()) {
      // Update the system-wide visualization
      // This will show all analysis overlays combined
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

  private exportAsJson(data: SystemProfileResult): void {
    const exportData = {
      ...data,
      systemMetrics: this.systemMetrics,
      analysisComparisons: this.analysisComparisons,
      executiveSummary: this.executiveSummary,
      exported_at: new Date().toISOString(),
      export_type: 'system_profile'
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-profile-${data.networkName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: SystemProfileResult): void {
    const csvRows = [
      ['System Profile Report'],
      ['Generated At', new Date().toISOString()],
      ['Network Name', data.networkName],
      [''],
      ['Executive Summary'],
      ...this.executiveSummary.map(summary => ['', summary]),
      [''],
      ['System Metrics'],
      ['Metric', 'Value', 'Unit', 'Description'],
      ...this.systemMetrics.map(metric => [
        metric.label,
        metric.value.toString(),
        metric.unit || '',
        metric.description
      ]),
      [''],
      ['Analysis Comparisons'],
      ['Analysis Type', 'Status', 'Success Rate (%)', 'Execution Time (s)', 'Key Metric'],
      ...this.analysisComparisons.map(comp => [
        comp.analysisType,
        comp.status,
        comp.successRate.toString(),
        comp.avgExecutionTime.toString(),
        comp.keyMetric ? `${comp.keyMetric.label}: ${comp.keyMetric.value}` : ''
      ]),
      [''],
      ['Recommendations'],
      ...this.recommendations.map(rec => ['', rec])
    ];

    const csvContent = csvRows.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-profile-${data.networkName}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsPng(): void {
    this.snackBar.open('PNG export will capture the system visualization once implemented', 'Close', { 
      duration: 3000 
    });
  }

  // Template helper methods
  getSystemSnapshot(): AnalysisStateSnapshot | null {
    return this.systemSnapshot;
  }

  getSystemMetrics(): SystemMetric[] {
    return this.systemMetrics;
  }

  getAnalysisComparisons(): AnalysisComparison[] {
    return this.analysisComparisons;
  }

  getExecutiveSummary(): string[] {
    return this.executiveSummary;
  }

  getRecommendations(): string[] {
    return this.recommendations;
  }

  getHealthScoreColor(score: number): string {
    if (score >= 0.8) return '#4CAF50'; // Green
    if (score >= 0.6) return '#8BC34A'; // Light green
    if (score >= 0.4) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 0.8) return '#4CAF50'; // Green
    if (efficiency >= 0.6) return '#8BC34A'; // Light green
    if (efficiency >= 0.4) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  getComplexityColor(complexity: string): string {
    switch (complexity) {
      case 'simple': return '#4CAF50'; // Green
      case 'moderate': return '#FF9800'; // Orange
      case 'complex': return '#9C27B0'; // Purple
      default: return '#9E9E9E'; // Grey
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return '#4CAF50'; // Green
      case 'failed': return '#F44336'; // Red
      case 'not_run': return '#9E9E9E'; // Grey
      default: return '#FF9800'; // Orange
    }
  }

  getFormattedExecutionTime(time: number): string {
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

  // System highlighting methods
  highlightCompletedAnalyses(): void {
    // This would highlight nodes related to completed analyses
    this.snackBar.open('Highlighting completed analysis results', 'Close', { duration: 2000 });
  }

  highlightFailedAnalyses(): void {
    // This would highlight nodes related to failed analyses
    this.snackBar.open('Highlighting failed analysis areas', 'Close', { duration: 2000 });
  }

  highlightCriticalNodes(): void {
    // This would highlight the most important nodes across all analyses
    this.snackBar.open('Highlighting critical system nodes', 'Close', { duration: 2000 });
  }

  // New methods for the comprehensive system profile template

  getNetworkName(): string {
    return this.systemSnapshot?.networkName || 'System';
  }

  getNetworkTopologyType(): string {
    const nodes = this.getTotalNodes();
    const edges = this.getTotalEdges();
    if (nodes === 0) return 'Empty';
    
    const density = edges / (nodes * (nodes - 1) / 2);
    if (density > 0.7) return 'Dense Network';
    if (density > 0.3) return 'Moderate Network';
    return 'Sparse Network';
  }

  getHealthScoreGradient(): string {
    const score = this.getOverallHealthScore();
    if (score >= 0.8) {
      return 'linear-gradient(135deg, #4CAF50, #8BC34A)';
    } else if (score >= 0.6) {
      return 'linear-gradient(135deg, #8BC34A, #CDDC39)';
    } else if (score >= 0.4) {
      return 'linear-gradient(135deg, #CDDC39, #FF9800)';
    } else {
      return 'linear-gradient(135deg, #FF9800, #F44336)';
    }
  }

  isAnalysisCompleted(analysisType: string): boolean {
    if (!this.systemSnapshot) return false;
    
    const tabStates = this.systemSnapshot.tabStates;
    switch (analysisType) {
      case 'networkStructure': return tabStates.networkStructure?.completed || false;
      case 'diamondAnalysis': return tabStates.diamondAnalysis?.completed || false;
      case 'exactInference': return tabStates.exactInference?.completed || false;
      case 'flowAnalysis': return tabStates.flowAnalysis?.completed || false;
      case 'criticalPath': return tabStates.criticalPath?.completed || false;
      default: return false;
    }
  }

  // Add minimal required methods that the template expects
  getNetworkStructureMetric(metric: string): number {
    return 0; // Placeholder
  }

  getNetworkComplexityScore(): number {
    return 50; // Placeholder
  }

  // New analysis-focused summary methods
  getNetworkConnectivitySummary(): string {
    const nodes = this.getTotalNodes();
    const edges = this.getTotalEdges();
    if (nodes === 0) return 'No network data';
    
    const density = edges / Math.max(1, (nodes * (nodes - 1) / 2));
    const connectivity = (density * 100).toFixed(1);
    return `${nodes} nodes, ${edges} edges (${connectivity}% density)`;
  }

  getDiamondStructureSummary(): string {
    const diamondData = this.analysisState.diamondData();
    if (!diamondData?.results) return 'No diamond analysis';
    
    const rootCount = diamondData.results.root_diamonds_count || 0;
    const uniqueCount = diamondData.results.unique_diamonds_count || 0;
    const efficiency = ((diamondData.results.diamond_efficiency || 0) * 100).toFixed(1);
    
    if (rootCount === 0) return 'No diamond structures detected';
    return `${rootCount} root diamonds, ${uniqueCount} unique (${efficiency}% efficiency)`;
  }

  getInformationFlowSummary(): string {
    const flowData = this.analysisState.flowAnalysisData();
    if (!flowData?.results) return 'No flow analysis';
    
    const totalOutput = flowData.results.total_target_output || 0;
    const utilization = ((flowData.results.network_utilization || 0) * 100).toFixed(1);
    const activeSources = flowData.results.active_sources?.length || 0;
    
    return `${activeSources} active sources, ${totalOutput.toFixed(2)} total output (${utilization}% utilization)`;
  }

  getCriticalPathSummary(): string {
    const cpmData = this.analysisState.criticalPathData();
    if (!cpmData?.results) return 'No critical path analysis';
    
    const duration = cpmData.results.time_analysis?.critical_duration || 0;
    const criticalActivities = cpmData.results.time_analysis?.critical_nodes?.length || 0;
    const totalCost = cpmData.results.cost_analysis?.total_cost || 0;
    
    return `Duration: ${duration.toFixed(1)}, Cost: ${totalCost.toFixed(1)}, ${criticalActivities} critical nodes`;
  }

  getBeliefPropagationSummary(): string {
    const beliefData = this.analysisState.exactInferenceData();
    if (!beliefData?.results) return 'No belief propagation';
    
    const nodeBeliefs = beliefData.results.node_beliefs || {};
    const totalNodes = Object.keys(nodeBeliefs).length;
    
    if (totalNodes === 0) return 'No belief values computed';
    
    const maxBelief = Math.max(...Object.values(nodeBeliefs) as number[]);
    const avgBelief = (Object.values(nodeBeliefs) as number[]).reduce((a, b) => a + b, 0) / totalNodes;
    
    return `${totalNodes} nodes, max belief: ${maxBelief.toFixed(3)}, avg: ${avgBelief.toFixed(3)}`;
  }

  getConnectivityType(): string {
    return 'Connected'; // Placeholder
  }

  getDiamondAnalysisMetric(metric: string): any {
    return 0; // Placeholder
  }

  getDiamondEfficiencyFormatted(): string {
    return '0%'; // Placeholder
  }

  getDiamondCoveragePercent(): number {
    return 0; // Placeholder
  }

  getInferenceDataType(): string {
    return 'Unknown'; // Placeholder
  }

  getInferenceMetric(metric: string): any {
    return 0; // Placeholder
  }

  getInferenceConvergence(): boolean {
    return false; // Placeholder
  }

  getUncertaintyType(): string {
    return 'Unknown'; // Placeholder
  }

  getInferenceComplexity(): string {
    return 'Unknown'; // Placeholder
  }

  getFlowAnalysisMetric(metric: string): any {
    return 0; // Placeholder
  }

  getFlowBottlenecks(): number {
    return 0; // Placeholder
  }

  getFlowUtilizationPercent(): number {
    return 0; // Placeholder
  }

  getFlowEfficiencyClass(): string {
    return 'low-efficiency'; // Placeholder
  }

  getFlowEfficiencyLevel(): string {
    return 'Unknown'; // Placeholder
  }

  getFlowPatternType(): string {
    return 'Unknown'; // Placeholder
  }

  getCriticalPathMetric(metric: string): any {
    return 0; // Placeholder
  }

  getCriticalPathFloat(): number {
    return 0; // Placeholder
  }

  getCriticalPathRiskClass(): string {
    return 'medium-risk'; // Placeholder
  }

  getCriticalPathRiskLevel(): string {
    return 'Unknown'; // Placeholder
  }

  getResourceConstraintLevel(): string {
    return 'Unknown'; // Placeholder
  }


  getMemoryUsage(): string {
    return '< 100MB'; // Placeholder
  }

  getOptimizationScore(): number {
    return 0.5; // Placeholder
  }

  getOptimizationScoreClass(): string {
    return 'optimization-medium'; // Placeholder
  }

  getBottleneckRiskClass(): string {
    return 'bottleneck-low'; // Placeholder
  }

  getOverallBottleneckRisk(): string {
    return 'Low'; // Placeholder
  }

  getPerformanceBreakdown(): any[] {
    return []; // Placeholder
  }

  getSystemRecommendations(): any[] {
    return []; // Placeholder
  }

  getAnalysisCoverage(): number {
    return this.getCompletedAnalyses() * 20; // 5 analyses max
  }

  getOptimizationPotential(): number {
    return 50; // Placeholder
  }

  getOverallRiskScore(): string {
    return 'Low'; // Placeholder
  }

  getRiskColor(): string {
    return '#4CAF50'; // Green for low risk
  }

  getCompletionPercentage(): number {
    return this.getAnalysisCoverage();
  }

  // Methods for accessing comprehensive structure data
  getComprehensiveStructureData(): any {
    return this.analysisState.getComprehensiveStructureData();
  }

  hasComprehensiveStructureData(): boolean {
    const data = this.getComprehensiveStructureData();
    return !!(data?.edgelist && data?.outgoing_index && data?.incoming_index);
  }

  getStructuralComplexityMetrics(): any {
    const comprehensive = this.getComprehensiveStructureData();
    if (!comprehensive) return null;

    const totalNodes = comprehensive.total_nodes || 0;
    const totalEdges = comprehensive.total_edges || 0;
    const forkNodes = comprehensive.fork_nodes?.length || 0;
    const joinNodes = comprehensive.join_nodes?.length || 0;
    const iterationSets = comprehensive.iteration_sets?.length || 0;
    
    return {
      totalNodes,
      totalEdges,
      forkNodes,
      joinNodes,
      iterationSets,
      branchingFactor: totalNodes > 0 ? (forkNodes + joinNodes) / totalNodes : 0,
      networkDensity: totalNodes > 1 ? totalEdges / (totalNodes * (totalNodes - 1)) : 0,
      hasNodePriors: !!(comprehensive.node_priors),
      hasEdgeProbabilities: !!(comprehensive.edge_probabilities),
      hasCpmData: !!(comprehensive.cpm_data),
      hasCapacityData: !!(comprehensive.capacity_data)
    };
  }

  getDataRichness(): string {
    const comprehensive = this.getComprehensiveStructureData();
    if (!comprehensive) return 'Basic';
    
    let richness = 0;
    if (comprehensive.node_priors) richness++;
    if (comprehensive.edge_probabilities) richness++;
    if (comprehensive.cpm_data) richness++;
    if (comprehensive.capacity_data) richness++;
    
    if (richness >= 3) return 'Very Rich';
    if (richness >= 2) return 'Rich';
    if (richness >= 1) return 'Moderate';
    return 'Basic';
  }

  getCompletionCircumference(): string {
    return '264'; // 2 * π * 42
  }

  getCompletionOffset(): string {
    const circumference = 264;
    const percentage = this.getCompletionPercentage();
    const offset = circumference - (percentage / 100) * circumference;
    return offset.toString();
  }

  getAnalysisBreakdown(): any[] {
    return [
      { name: 'Network Structure', completed: this.isAnalysisCompleted('networkStructure'), time: 50 },
      { name: 'Diamond Analysis', completed: this.isAnalysisCompleted('diamondAnalysis'), time: 100 },
      { name: 'Exact Inference', completed: this.isAnalysisCompleted('exactInference'), time: 200 },
      { name: 'Flow Analysis', completed: this.isAnalysisCompleted('flowAnalysis'), time: 75 },
      { name: 'Critical Path', completed: this.isAnalysisCompleted('criticalPath'), time: 60 }
    ];
  }

  getTopInsight(): any {
    const completedCount = this.getCompletedAnalyses();
    if (completedCount >= 4) {
      return {
        title: 'Comprehensive Analysis Complete',
        description: 'Most network analyses completed successfully with good coverage.',
        icon: 'check_circle',
        severity: 'success'
      };
    } else if (completedCount >= 2) {
      return {
        title: 'Partial Analysis Available',
        description: 'Some analyses completed. Additional analysis recommended for full insights.',
        icon: 'info',
        severity: 'info'
      };
    } else {
      return {
        title: 'Limited Analysis Data',
        description: 'Few analyses completed. Run additional analyses for comprehensive insights.',
        icon: 'warning',
        severity: 'warning'
      };
    }
  }

  getAdditionalInsights(): any[] {
    const insights = [];
    
    if (this.isAnalysisCompleted('diamondAnalysis')) {
      insights.push({
        id: 'diamonds',
        text: 'Diamond structures detected',
        icon: 'diamond',
        type: 'info'
      });
    }
    
    if (this.isAnalysisCompleted('flowAnalysis')) {
      insights.push({
        id: 'flow',
        text: 'Flow analysis completed',
        icon: 'water_drop',
        type: 'success'
      });
    }
    
    return insights;
  }

  override switchViewMode(mode: 'visual' | 'dashboard'): void {
    this.currentViewMode.set(mode);
  }

  override isVisualMode(): boolean {
    return this.currentViewMode() === 'visual';
  }

  override isDashboardMode(): boolean {
    return this.currentViewMode() === 'dashboard';
  }
}