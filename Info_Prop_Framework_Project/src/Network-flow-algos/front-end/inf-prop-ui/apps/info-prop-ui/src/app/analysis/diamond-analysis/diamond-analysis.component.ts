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

interface DiamondAnalysisResult {
  root_diamonds_count: number;
  unique_diamonds_count: number;
  join_nodes_with_diamonds: number[];
  classifications: Record<string, any>;
  diamond_efficiency: number;
  has_complex_diamonds: boolean;
  // For backward compatibility during transition
  diamonds_found?: number;
  execution_time?: number;
  data_type?: string;
  node_beliefs?: Record<string, number>;
}

interface DiamondTypeInfo {
  type: 'root' | 'unique';
  count: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-diamond-analysis',
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
  templateUrl: './diamond-analysis.component.html',
  styleUrl: './diamond-analysis.component.scss'
})
export class DiamondAnalysisComponent extends BaseAnalysisComponent<DiamondAnalysisResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // Diamond-specific properties
  private diamondNodes: number[] = [];
  private diamondTypes: DiamondTypeInfo[] = [];
  private highlightedDiamondType: string | null = null;

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadDiamondData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadDiamondData(): void {
    const diamondData = this.analysisState.diamondData();
    
    if (!diamondData || !diamondData.results) {
      this.setError('No diamond analysis data available');
      return;
    }

    const totalDiamonds = diamondData.results.unique_diamonds_count || (diamondData.results as any).diamonds_found || 0;
    if (totalDiamonds === 0) {
      this.setError('No diamonds found in the network. Diamond analysis requires networks with diamond structures.');
      return;
    }

    this.setLoading(true);
    
    try {
      const analysisData: AnalysisComponentData<DiamondAnalysisResult> = {
        structure: diamondData.structure,
        results: diamondData.results
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      const totalCount = analysisData.results.unique_diamonds_count || (analysisData.results as any).diamonds_found || 0;
      this.snackBar.open(`Diamond analysis loaded: ${totalCount} diamonds found`, 'Close', {
        duration: 3000
      });
      
    } catch (error) {
      this.setError(`Failed to load diamond data: ${error}`);
      this.setLoading(false);
    }
  }

  processData(data: AnalysisComponentData<DiamondAnalysisResult>): void {
    // Process and prepare data for visualization
    console.log('Processing diamond analysis data:', data);
    
    // Extract diamond nodes from node beliefs (nodes with beliefs are likely part of diamonds)
    this.diamondNodes = data.results.join_nodes_with_diamonds || Object.keys((data.results as any).node_beliefs || {})
      .map(nodeId => parseInt(nodeId, 10))
      .filter(nodeId => !isNaN(nodeId));

    // Calculate diamond type distribution (simplified - in a real implementation, 
    // this would come from the backend with more detailed diamond structure info)
    this.diamondTypes = this.calculateDiamondTypes(data.results);
    
    // Update visualization config based on data
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [], // Will be set based on diamond highlighting
      nodeColors: this.generateDiamondNodeColors(data.results)
    }));
  }

  private calculateDiamondTypes(results: DiamondAnalysisResult): DiamondTypeInfo[] {
    // This is a simplified calculation - in reality, the backend should provide
    // detailed information about diamond types and structures
    // Use the actual diamond analysis results from the backend
    const rootDiamonds = results.root_diamonds_count;
    const uniqueDiamonds = results.unique_diamonds_count;
    const totalDiamonds = rootDiamonds + uniqueDiamonds;

    return [
      {
        type: 'root',
        count: rootDiamonds,
        percentage: totalDiamonds > 0 ? (rootDiamonds / totalDiamonds) * 100 : 0,
        color: '#9C27B0' // Purple for root diamonds
      },
      {
        type: 'unique',
        count: uniqueDiamonds,
        percentage: totalDiamonds > 0 ? (uniqueDiamonds / totalDiamonds) * 100 : 0,
        color: '#673AB7' // Deep purple for unique diamonds
      }
    ];
  }

  private generateDiamondNodeColors(results: DiamondAnalysisResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Color join nodes that have diamonds
    results.join_nodes_with_diamonds.forEach((nodeId) => {
      if (!isNaN(nodeId)) {
        // Use consistent diamond color for all join nodes with diamonds
        nodeColors[nodeId] = `rgba(156, 39, 176, 0.8)`; // Purple for diamond nodes
      }
    });
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    // Update the visualization based on the config
    console.log('Updating diamond visualization with config:', config);
    
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

  private exportAsJson(data: DiamondAnalysisResult): void {
    const exportData = {
      diamonds_found: data.diamonds_found,
      execution_time: data.execution_time,
      data_type: data.data_type,
      node_beliefs: data.node_beliefs,
      diamond_types: this.diamondTypes,
      exported_at: new Date().toISOString()
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamond-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: DiamondAnalysisResult): void {
    const csvRows = [
      ['Metric', 'Value'],
      ['Diamonds Found', data.diamonds_found?.toString() || '0'],
      ['Execution Time (s)', data.execution_time?.toString() || '0'],
      ['Data Type', data.data_type || 'unknown'],
      ['Total Node Beliefs', Object.keys(data.node_beliefs || {}).length.toString()],
      ['Avg Node Belief', this.getAverageNodeBelief().toString()],
      ['Max Node Belief', this.getMaxNodeBelief().toString()],
      ['Min Node Belief', this.getMinNodeBelief().toString()]
    ];

    // Add diamond type information
    this.diamondTypes.forEach(type => {
      csvRows.push([`${type.type.charAt(0).toUpperCase() + type.type.slice(1)} Diamonds`, type.count.toString()]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamond-analysis-${Date.now()}.csv`;
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

  getDiamondsFound(): number {
    return this.componentData()?.results?.diamonds_found || 0;
  }

  getExecutionTime(): number {
    return this.componentData()?.results?.execution_time || 0;
  }

  getDataType(): string {
    return this.componentData()?.results?.data_type || 'unknown';
  }

  getNodeBeliefs(): Record<string, number> {
    return this.componentData()?.results?.node_beliefs || {};
  }

  getTotalNodeBeliefs(): number {
    return Object.keys(this.getNodeBeliefs()).length;
  }

  getAverageNodeBelief(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    if (beliefs.length === 0) return 0;
    return beliefs.reduce((sum, belief) => sum + belief, 0) / beliefs.length;
  }

  getMaxNodeBelief(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    return beliefs.length > 0 ? Math.max(...beliefs) : 0;
  }

  getMinNodeBelief(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    return beliefs.length > 0 ? Math.min(...beliefs) : 0;
  }

  getDiamondTypes(): DiamondTypeInfo[] {
    return this.diamondTypes;
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

  // Diamond highlighting methods for interaction
  highlightDiamondNodes(): void {
    this.highlightNodes(this.diamondNodes);
    this.highlightedDiamondType = null;
  }

  highlightDiamondType(type: string): void {
    // In a real implementation, we would have specific nodes for each diamond type
    // For now, we'll highlight all diamond nodes when any type is selected
    this.highlightNodes(this.diamondNodes);
    this.highlightedDiamondType = type;
  }

  highlightHighBeliefNodes(): void {
    const beliefs = this.getNodeBeliefs();
    const avgBelief = this.getAverageNodeBelief();
    
    // Highlight nodes with above-average beliefs
    const highBeliefNodes = Object.entries(beliefs)
      .filter(([_, belief]) => belief > avgBelief)
      .map(([nodeId, _]) => parseInt(nodeId, 10))
      .filter(nodeId => !isNaN(nodeId));
    
    this.highlightNodes(highBeliefNodes);
    this.highlightedDiamondType = null;
  }

  getDiamondNodesList(): string {
    if (this.diamondNodes.length === 0) return 'None';
    if (this.diamondNodes.length > 10) {
      return `${this.diamondNodes.slice(0, 10).join(', ')}... (+${this.diamondNodes.length - 10} more)`;
    }
    return this.diamondNodes.join(', ');
  }

  isHighlightedType(type: string): boolean {
    return this.highlightedDiamondType === type;
  }
}