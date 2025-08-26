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
import { DiamondAnalysisResult } from '../../shared/models/network-analysis.models';

interface DiamondTypeInfo {
  type: 'root' | 'unique';
  count: number;
  percentage: number;
  color: string;
}

interface ClassificationInfo {
  id: string;
  classification: any;
  type: 'root' | 'unique';
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
  private classificationDetails: ClassificationInfo[] = [];

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

    const totalDiamonds = diamondData.results.total_classifications || 0;
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
      
      const totalCount = analysisData.results.total_classifications || 0;
      this.snackBar.open(`Diamond analysis loaded: ${totalCount} diamond classifications found`, 'Close', {
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
    
    // Extract diamond nodes from join nodes with diamonds
    this.diamondNodes = data.results.join_nodes_with_diamonds || [];

    // Calculate diamond type distribution using actual backend data
    this.diamondTypes = this.calculateDiamondTypes(data.results);
    
    // Process classification details for detailed view
    this.classificationDetails = this.processClassifications(data.results);
    
    // Update visualization config based on data
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [], // Will be set based on diamond highlighting
      nodeColors: this.generateDiamondNodeColors(data.results)
    }));
  }

  private calculateDiamondTypes(results: DiamondAnalysisResult): DiamondTypeInfo[] {
    // Use the actual diamond analysis results from the backend
    const rootDiamonds = results.root_diamonds_count || 0;
    const uniqueDiamonds = results.unique_diamonds_count || 0;
    const totalDiamonds = results.total_classifications || 0;

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

  private processClassifications(results: DiamondAnalysisResult): ClassificationInfo[] {
    const classifications: ClassificationInfo[] = [];
    
    // Process root classifications
    if (results.root_classifications) {
      Object.entries(results.root_classifications).forEach(([id, classification]) => {
        classifications.push({
          id,
          classification,
          type: 'root'
        });
      });
    }
    
    // Process unique classifications
    if (results.unique_classifications) {
      Object.entries(results.unique_classifications).forEach(([id, classification]) => {
        classifications.push({
          id,
          classification,
          type: 'unique'
        });
      });
    }
    
    return classifications;
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
      total_classifications: data.total_classifications,
      root_diamonds_count: data.root_diamonds_count,
      unique_diamonds_count: data.unique_diamonds_count,
      diamond_efficiency: data.diamond_efficiency,
      has_complex_diamonds: data.has_complex_diamonds,
      join_nodes_with_diamonds: data.join_nodes_with_diamonds,
      root_classifications: data.root_classifications,
      unique_classifications: data.unique_classifications,
      diamond_types: this.diamondTypes,
      classifications: this.classificationDetails,
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
      ['Total Classifications', data.total_classifications?.toString() || '0'],
      ['Root Diamonds Count', data.root_diamonds_count?.toString() || '0'],
      ['Unique Diamonds Count', data.unique_diamonds_count?.toString() || '0'],
      ['Diamond Efficiency', data.diamond_efficiency?.toString() || '0'],
      ['Has Complex Diamonds', data.has_complex_diamonds?.toString() || 'false'],
      ['Join Nodes with Diamonds', data.join_nodes_with_diamonds?.join(';') || 'None']
    ];

    // Add diamond type information
    this.diamondTypes.forEach(type => {
      csvRows.push([`${type.type.charAt(0).toUpperCase() + type.type.slice(1)} Diamonds`, type.count.toString()]);
      csvRows.push([`${type.type.charAt(0).toUpperCase() + type.type.slice(1)} Percentage`, type.percentage.toFixed(2) + '%']);
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

  getTotalClassifications(): number {
    return this.componentData()?.results?.total_classifications || 0;
  }

  getRootDiamondsCount(): number {
    return this.componentData()?.results?.root_diamonds_count || 0;
  }

  getUniqueDiamondsCount(): number {
    return this.componentData()?.results?.unique_diamonds_count || 0;
  }

  getDiamondEfficiency(): number {
    return this.componentData()?.results?.diamond_efficiency || 0;
  }

  getHasComplexDiamonds(): boolean {
    return this.componentData()?.results?.has_complex_diamonds || false;
  }

  getJoinNodesWithDiamonds(): number[] {
    return this.componentData()?.results?.join_nodes_with_diamonds || [];
  }

  getClassifications(): ClassificationInfo[] {
    return this.classificationDetails;
  }

  getDiamondTypes(): DiamondTypeInfo[] {
    return this.diamondTypes;
  }

  getDiamondsFound(): number {
    return this.getTotalClassifications();
  }

  getTotalNodeBeliefs(): number {
    return this.getJoinNodesWithDiamonds().length;
  }

  highlightHighBeliefNodes(): void {
    // For diamond analysis, highlight join nodes with diamonds
    this.highlightJoinNodes();
  }

  getDataType(): string {
    return 'diamond';
  }

  getFormattedExecutionTime(): string {
    // Diamond analysis doesn't have execution time, return default
    return '0ms';
  }

  getAverageNodeBelief(): number {
    // For diamond analysis, return efficiency as "average belief"
    return this.getDiamondEfficiency();
  }

  getMaxNodeBelief(): number {
    // Return 1.0 for diamond analysis (max efficiency)
    return 1.0;
  }

  getMinNodeBelief(): number {
    // Return 0.0 for diamond analysis (min efficiency)
    return 0.0;
  }

  getExecutionTime(): number {
    // Diamond analysis doesn't have execution time, return 0
    return 0;
  }

  getFormattedEfficiency(): string {
    const efficiency = this.getDiamondEfficiency();
    return `${(efficiency * 100).toFixed(2)}%`;
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

  highlightJoinNodes(): void {
    const joinNodes = this.getJoinNodesWithDiamonds();
    this.highlightNodes(joinNodes);
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