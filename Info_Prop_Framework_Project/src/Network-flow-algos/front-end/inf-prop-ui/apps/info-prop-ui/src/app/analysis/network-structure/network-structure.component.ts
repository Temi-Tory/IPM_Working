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
import { NetworkVisualizationComponent, NodeSelectionEvent, EdgeSelectionEvent } from '../network-visualization/network-visualization.component';

import { NetworkStructureResult } from '../../shared/models/network-analysis.models';

@Component({
  selector: 'app-network-structure',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSnackBarModule,
    AnalysisViewSwitcherComponent,
    NetworkVisualizationComponent
  ],
  templateUrl: './network-structure.component.html',
  styleUrl: './network-structure.component.scss'
})
export class NetworkStructureComponent extends BaseAnalysisComponent<NetworkStructureResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadNetworkData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadNetworkData(): void {
    const networkData = this.analysisState.networkData();
    
    if (!networkData || !networkData.results) {
      this.setError('No network analysis data available');
      return;
    }

    this.setLoading(true);
    
    // Check if we have comprehensive structure data, if not try to load it
    const comprehensiveData = this.analysisState.getComprehensiveStructureData();
    
    if (!comprehensiveData && networkData.structure) {
      // Try to load comprehensive structure data
      this.analysisState.loadComprehensiveNetworkStructure().subscribe({
        next: (comprehensive) => {
          this.processComprehensiveData(comprehensive, networkData.structure);
        },
        error: (error) => {
          console.warn('Could not load comprehensive structure data, using basic data:', error);
          this.processBasicData(networkData);
        }
      });
    } else if (comprehensiveData) {
      this.processComprehensiveData(comprehensiveData, networkData.structure);
    } else {
      this.processBasicData(networkData);
    }
  }

  private processComprehensiveData(comprehensive: NetworkStructureResult, structure: any): void {
    try {
      const analysisData: AnalysisComponentData<NetworkStructureResult> = {
        structure: structure,
        results: comprehensive
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      this.snackBar.open(
        `Comprehensive network structure loaded: ${comprehensive.total_nodes} nodes, ${comprehensive.total_edges} edges, ${comprehensive.edgelist.length} edge connections`, 
        'Close', 
        { duration: 3000 }
      );
      
    } catch (error) {
      this.setError(`Failed to process comprehensive network data: ${error}`);
      this.setLoading(false);
    }
  }

  private processBasicData(networkData: any): void {
    try {
      const analysisData: AnalysisComponentData<NetworkStructureResult> = {
        structure: networkData.structure,
        results: networkData.results
      };
      
      this.setData(analysisData);
      this.setLoading(false);
      
      this.snackBar.open(
        `Basic network structure loaded: ${analysisData.results.total_nodes} nodes, ${analysisData.results.total_edges} edges`, 
        'Close', 
        { duration: 3000 }
      );
      
    } catch (error) {
      this.setError(`Failed to load network data: ${error}`);
      this.setLoading(false);
    }
  }

  processData(data: AnalysisComponentData<NetworkStructureResult>): void {
    // Process and prepare data for visualization
    console.log('Processing network structure data:', data);
    
    // Update visualization config based on data
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [], // Will be set based on node types
      nodeColors: this.generateNodeColors(data.results)
    }));
  }

  private generateNodeColors(results: NetworkStructureResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Color nodes by type
    results.source_nodes?.forEach(nodeId => {
      nodeColors[nodeId] = '#4CAF50'; // Green for sources
    });
    
    results.sink_nodes?.forEach(nodeId => {
      nodeColors[nodeId] = '#F44336'; // Red for sinks
    });
    
    results.fork_nodes?.forEach(nodeId => {
      nodeColors[nodeId] = '#FF9800'; // Orange for forks
    });
    
    results.join_nodes?.forEach(nodeId => {
      nodeColors[nodeId] = '#2196F3'; // Blue for joins
    });
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    // Update the visualization based on the config
    console.log('Updating visualization with config:', config);
    
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

  private exportAsJson(data: NetworkStructureResult): void {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-structure-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: NetworkStructureResult): void {
    const csvRows = [
      ['Metric', 'Value'],
      ['Total Nodes', data.total_nodes?.toString() || '0'],
      ['Total Edges', data.total_edges?.toString() || '0'],
      ['Source Nodes', data.source_nodes?.length.toString() || '0'],
      ['Sink Nodes', data.sink_nodes?.length.toString() || '0'],
      ['Fork Nodes', data.fork_nodes?.length.toString() || '0'],
      ['Join Nodes', data.join_nodes?.length.toString() || '0'],
      ['Iteration Sets', data.iteration_sets_count?.toString() || '0']
    ];
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-structure-${Date.now()}.csv`;
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

  getTotalNodes(): number {
    return this.componentData()?.results?.total_nodes || 0;
  }

  getTotalEdges(): number {
    return this.componentData()?.results?.total_edges || 0;
  }

  getSourceNodes(): number[] {
    return this.componentData()?.results?.source_nodes || [];
  }

  getSinkNodes(): number[] {
    return this.componentData()?.results?.sink_nodes || [];
  }

  getForkNodes(): number[] {
    return this.componentData()?.results?.fork_nodes || [];
  }

  getJoinNodes(): number[] {
    return this.componentData()?.results?.join_nodes || [];
  }

  getIterationSetsCount(): number {
    return this.componentData()?.results?.iteration_sets_count || 0;
  }

  // New methods for comprehensive structure data
  getAllNodes(): number[] {
    return this.componentData()?.results?.all_nodes || [];
  }

  getEdgeList(): [number, number][] {
    return this.componentData()?.results?.edgelist || [];
  }

  getOutgoingIndex(): Record<number, number[]> {
    return this.componentData()?.results?.outgoing_index || {};
  }

  getIncomingIndex(): Record<number, number[]> {
    return this.componentData()?.results?.incoming_index || {};
  }

  getIterationSets(): number[][] {
    return this.componentData()?.results?.iteration_sets || [];
  }

  getAncestors(): Record<number, number[]> {
    return this.componentData()?.results?.ancestors || {};
  }

  getDescendants(): Record<number, number[]> {
    return this.componentData()?.results?.descendants || {};
  }

  getNodePriors(): Record<number, number> | undefined {
    return this.componentData()?.results?.node_priors;
  }

  getEdgeProbabilities(): Record<string, number> | undefined {
    return this.componentData()?.results?.edge_probabilities;
  }

  getCpmData(): any | undefined {
    return this.componentData()?.results?.cpm_data;
  }

  getCapacityData(): Record<number, number> | undefined {
    return this.componentData()?.results?.capacity_data;
  }

  hasComprehensiveData(): boolean {
    const data = this.componentData()?.results;
    return !!(data?.edgelist && data?.outgoing_index && data?.incoming_index);
  }

  hasOptionalData(): boolean {
    const data = this.componentData()?.results;
    return !!(data?.node_priors || data?.edge_probabilities || data?.cpm_data || data?.capacity_data);
  }

  // Highlighting methods for interaction
  highlightSourceNodes(): void {
    this.highlightNodes(this.getSourceNodes());
  }

  highlightSinkNodes(): void {
    this.highlightNodes(this.getSinkNodes());
  }

  highlightForkNodes(): void {
    this.highlightNodes(this.getForkNodes());
  }

  highlightJoinNodes(): void {
    this.highlightNodes(this.getJoinNodes());
  }

  // Methods for refreshing comprehensive data
  refreshComprehensiveData(): void {
    this.setLoading(true);
    
    this.analysisState.refreshComprehensiveStructure().subscribe({
      next: (comprehensive) => {
        this.processComprehensiveData(comprehensive, this.componentData()?.structure);
        this.snackBar.open('Comprehensive structure data refreshed', 'Close', { duration: 2000 });
      },
      error: (error) => {
        this.setError(`Failed to refresh comprehensive data: ${error}`);
        this.setLoading(false);
      }
    });
  }

  // Utility methods for comprehensive analysis
  getAncestorsForNode(nodeId: number): number[] {
    const ancestors = this.getAncestors();
    return ancestors[nodeId] || [];
  }

  getDescendantsForNode(nodeId: number): number[] {
    const descendants = this.getDescendants();
    return descendants[nodeId] || [];
  }

  getOutgoingEdgesForNode(nodeId: number): number[] {
    const outgoing = this.getOutgoingIndex();
    return outgoing[nodeId] || [];
  }

  getIncomingEdgesForNode(nodeId: number): number[] {
    const incoming = this.getIncomingIndex();
    return incoming[nodeId] || [];
  }

  // Get edge probability by edge key
  getEdgeProbability(fromNode: number, toNode: number): number | undefined {
    const edgeProbs = this.getEdgeProbabilities();
    return edgeProbs ? edgeProbs[`${fromNode}_${toNode}`] : undefined;
  }

  // Get node prior probability
  getNodePrior(nodeId: number): number | undefined {
    const nodePriors = this.getNodePriors();
    return nodePriors ? nodePriors[nodeId] : undefined;
  }

  // Event handlers for network visualization
  onNodeSelected(event: NodeSelectionEvent): void {
    console.log('Node selected:', event.node);
    this.snackBar.open(
      `Node ${event.node.id} selected (${event.node.role})`,
      'Close',
      { duration: 2000 }
    );
  }

  onEdgeSelected(event: EdgeSelectionEvent): void {
    console.log('Edge selected:', event.link);
    const sourceId = typeof event.link.source === 'object' ? event.link.source.id : event.link.source;
    const targetId = typeof event.link.target === 'object' ? event.link.target.id : event.link.target;
    this.snackBar.open(
      `Edge ${sourceId} → ${targetId} selected`,
      'Close',
      { duration: 2000 }
    );
  }

  onCanvasClicked(event: MouseEvent): void {
    console.log('Canvas clicked');
    // Clear any selections or perform other actions
  }
}