import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';

import { BaseAnalysisComponent, AnalysisComponentData, VisualizationConfig } from '../../shared/interfaces/analysis-component.interface';
import { AnalysisViewSwitcherComponent } from '../../shared/components/analysis-view-switcher/analysis-view-switcher.component';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { ExactInferenceResult, FloatBelief, IntervalBelief, PboxBelief } from '../../shared/models/network-analysis.models';

type BeliefValue = FloatBelief | IntervalBelief | PboxBelief;

@Component({
  selector: 'app-reachability-analysis',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    FormsModule,
    AnalysisViewSwitcherComponent
  ],
  templateUrl: './reachability-analysis.component.html',
  styleUrl: './reachability-analysis.component.scss'
})
export class ReachabilityAnalysisComponent extends BaseAnalysisComponent<ExactInferenceResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // UI state
  selectedNode: string | null = null;
  selectedSourceNode: string | null = null;
  selectedTargetNode: string | null = null;
  showHighBeliefsOnly = false;
  showOnlyReachable = false;
  availableNodes: string[] = [];
  sortOrder: 'asc' | 'desc' | 'none' = 'desc';

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadExactInferenceData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadExactInferenceData(): void {
    const exactInferenceData = this.analysisState.exactInferenceData();
    
    if (!exactInferenceData || !exactInferenceData.results) {
      this.setError('No exact inference data available');
      return;
    }

    this.setLoading(true);
    
    try {
      const analysisData: AnalysisComponentData<ExactInferenceResult> = {
        structure: exactInferenceData.structure,
        results: exactInferenceData.results
      };
      
      this.availableNodes = Object.keys(exactInferenceData.results.node_beliefs);
      
      this.setData(analysisData);
      this.setLoading(false);
      
      this.snackBar.open(
        `Exact inference loaded: ${this.availableNodes.length} node beliefs (${exactInferenceData.results.data_type})`, 
        'Close', 
        { duration: 4000 }
      );
      
    } catch (error) {
      this.setError(`Failed to load exact inference data: ${error}`);
      this.setLoading(false);
    }
  }


  processData(data: AnalysisComponentData<ExactInferenceResult>): void {
    console.log('Processing exact inference data:', data);
    
    // Update visualization config based on belief values
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [],
      nodeColors: this.generateBeliefNodeColors(data.results)
    }));
  }

  private generateBeliefNodeColors(results: ExactInferenceResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Generate colors based on belief values (blue/teal theme)
    Object.entries(results.node_beliefs).forEach(([nodeId, belief]) => {
      const numNodeId = parseInt(nodeId);
      if (isNaN(numNodeId)) return;
      
      const beliefValue = this.extractBeliefValue(belief);
      const intensity = Math.min(beliefValue, 1.0); // Cap at 1.0
      
      if (intensity < 0.3) {
        nodeColors[numNodeId] = '#E0F2F1'; // Very light teal for low beliefs
      } else if (intensity < 0.6) {
        nodeColors[numNodeId] = '#80CBC4'; // Light teal for medium beliefs
      } else if (intensity < 0.8) {
        nodeColors[numNodeId] = '#009688'; // Primary teal for high beliefs
      } else {
        nodeColors[numNodeId] = '#00695C'; // Dark teal for very high beliefs
      }
    });
    
    return nodeColors;
  }

  private extractBeliefValue(belief: BeliefValue): number {
    if (typeof belief === 'number') {
      return belief; // FloatBelief
    } else if ('lower' in belief && 'upper' in belief) {
      return (belief.lower + belief.upper) / 2; // IntervalBelief midpoint
    } else if ('mean_lower' in belief && 'mean_upper' in belief) {
      return (belief.mean_lower + belief.mean_upper) / 2; // PboxBelief midpoint
    }
    return 0;
  }

  updateVisualization(config: VisualizationConfig): void {
    console.log('Updating exact inference visualization with config:', config);
    
    if (this.isVisualMode()) {
      // Update the graph visualization to show belief values
      // This will highlight nodes based on their belief values
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

  private exportAsJson(data: ExactInferenceResult): void {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `exact-inference-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: ExactInferenceResult): void {
    const csvRows = [
      ['Node ID', 'Belief Value', 'Belief Type', 'Details']
    ];
    
    Object.entries(data.node_beliefs).forEach(([nodeId, belief]) => {
      const beliefValue = this.extractBeliefValue(belief);
      const beliefType = this.getBeliefType(belief);
      const details = this.getBeliefDetails(belief);
      
      csvRows.push([
        nodeId,
        beliefValue.toString(),
        beliefType,
        details
      ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `exact-inference-beliefs-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsPng(): void {
    this.snackBar.open('PNG export not yet implemented', 'Close', { duration: 3000 });
  }

  private getBeliefType(belief: BeliefValue): string {
    if (typeof belief === 'number') {
      return 'float';
    } else if ('lower' in belief && 'upper' in belief) {
      return 'interval';
    } else if ('type' in belief && belief.type === 'pbox') {
      return 'pbox';
    }
    return 'unknown';
  }

  private getBeliefDetails(belief: BeliefValue): string {
    if (typeof belief === 'number') {
      return belief.toString();
    } else if ('lower' in belief && 'upper' in belief) {
      return `[${belief.lower}, ${belief.upper}]`;
    } else if ('type' in belief && belief.type === 'pbox') {
      return `mean[${belief.mean_lower}, ${belief.mean_upper}] var[${belief.var_lower}, ${belief.var_upper}]`;
    }
    return 'N/A';
  }

  // Template helper methods
  getNodeBeliefs(): Record<string, BeliefValue> {
    return this.componentData()?.results?.node_beliefs || {};
  }

  getExecutionTime(): number {
    return this.componentData()?.results?.execution_time || 0;
  }

  getDataType(): 'float' | 'interval' | 'pbox' {
    return this.componentData()?.results?.data_type || 'float';
  }

  getAlgorithmType(): string {
    return this.componentData()?.results?.algorithm_type || 'belief_propagation';
  }

  getNodesCount(): number {
    return Object.keys(this.getNodeBeliefs()).length;
  }

  getAverageBeliefValue(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    if (beliefs.length === 0) return 0;
    
    const sum = beliefs.reduce((acc: number, belief) => acc + this.extractBeliefValue(belief), 0);
    return sum / beliefs.length;
  }

  getMaxBeliefValue(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    if (beliefs.length === 0) return 0;
    
    return Math.max(...beliefs.map(belief => this.extractBeliefValue(belief)));
  }

  getMinBeliefValue(): number {
    const beliefs = Object.values(this.getNodeBeliefs());
    if (beliefs.length === 0) return 0;
    
    return Math.min(...beliefs.map(belief => this.extractBeliefValue(belief)));
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

  getSortedNodeEntries(): Array<[string, BeliefValue]> {
    const entries = Object.entries(this.getNodeBeliefs());
    
    if (this.sortOrder === 'none') {
      return entries;
    }
    
    return entries.sort((a, b) => {
      const valueA = this.extractBeliefValue(a[1]);
      const valueB = this.extractBeliefValue(b[1]);
      
      if (this.sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
  }

  getFilteredNodeEntries(): Array<[string, BeliefValue]> {
    let entries = this.getSortedNodeEntries();
    
    if (this.showHighBeliefsOnly) {
      const avgBelief = this.getAverageBeliefValue();
      entries = entries.filter(([_, belief]) => this.extractBeliefValue(belief) > avgBelief);
    }
    
    return entries;
  }

  // Interactive belief analysis
  onNodeSelection(nodeId: string | null): void {
    this.selectedNode = nodeId;
    this.updateNodeHighlight();
  }

  onSortOrderChange(order: 'asc' | 'desc' | 'none'): void {
    this.sortOrder = order;
  }

  onHighBeliefsToggle(showHighOnly: boolean): void {
    this.showHighBeliefsOnly = showHighOnly;
  }

  private updateNodeHighlight(): void {
    if (this.selectedNode !== null) {
      const numNodeId = parseInt(this.selectedNode);
      if (!isNaN(numNodeId)) {
        this.highlightNodes([numNodeId]);
      }
    } else {
      this.highlightNodes([]);
    }
  }

  highlightHighBeliefNodes(): void {
    const avgBelief = this.getAverageBeliefValue();
    const highBeliefNodes: number[] = [];
    
    Object.entries(this.getNodeBeliefs()).forEach(([nodeId, belief]) => {
      const beliefValue = this.extractBeliefValue(belief);
      if (beliefValue > avgBelief) {
        const numNodeId = parseInt(nodeId);
        if (!isNaN(numNodeId)) {
          highBeliefNodes.push(numNodeId);
        }
      }
    });
    
    this.highlightNodes(highBeliefNodes);
    this.selectedNode = null;
  }

  highlightLowBeliefNodes(): void {
    const avgBelief = this.getAverageBeliefValue();
    const lowBeliefNodes: number[] = [];
    
    Object.entries(this.getNodeBeliefs()).forEach(([nodeId, belief]) => {
      const beliefValue = this.extractBeliefValue(belief);
      if (beliefValue < avgBelief) {
        const numNodeId = parseInt(nodeId);
        if (!isNaN(numNodeId)) {
          lowBeliefNodes.push(numNodeId);
        }
      }
    });
    
    this.highlightNodes(lowBeliefNodes);
    this.selectedNode = null;
  }

  clearHighlights(): void {
    this.highlightNodes([]);
    this.selectedNode = null;
  }

  getNodeBelief(nodeId: string): BeliefValue | null {
    return this.getNodeBeliefs()[nodeId] || null;
  }

  formatBeliefValue(belief: BeliefValue): string {
    if (typeof belief === 'number') {
      return belief.toFixed(4);
    } else if ('lower' in belief && 'upper' in belief) {
      return `[${belief.lower.toFixed(4)}, ${belief.upper.toFixed(4)}]`;
    } else if ('type' in belief && belief.type === 'pbox') {
      return `μ[${belief.mean_lower.toFixed(4)}, ${belief.mean_upper.toFixed(4)}]`;
    }
    return 'N/A';
  }

  // Legacy methods for backward compatibility with templates
  getReachablePairsCount(): number {
    return this.getNodesCount();
  }

  getTotalPairsCount(): number {
    const nodeCount = this.getNodesCount();
    return nodeCount * (nodeCount - 1);
  }

  getReachabilityRatio(): number {
    const total = this.getTotalPairsCount();
    return total > 0 ? this.getReachablePairsCount() / total : 0;
  }

  getConnectedComponentsCount(): number {
    // For exact inference, we assume all nodes are connected
    return 1;
  }

  getMaxDistance(): number {
    // For exact inference, return max belief value as "distance"
    return this.getMaxBeliefValue();
  }

  getAverageDistance(): number {
    // For exact inference, return average belief value as "distance"  
    return this.getAverageBeliefValue();
  }

  getReachabilityMatrix(): any[][] {
    // For exact inference, return empty matrix as we don't have reachability
    return [];
  }

  getStronglyConnectedComponents(): number[][] {
    // For exact inference, return all nodes as one component
    const allNodes = Object.keys(this.getNodeBeliefs()).map(id => parseInt(id)).filter(id => !isNaN(id));
    return allNodes.length > 0 ? [allNodes] : [];
  }

  // Legacy methods for backward compatibility with templates
  onSourceNodeChange(nodeId: string | null): void {
    this.selectedSourceNode = nodeId;
  }

  onTargetNodeChange(nodeId: string | null): void {
    this.selectedTargetNode = nodeId;
  }

  highlightReachableFrom(sourceNode: number | string | null): void {
    if (sourceNode !== null) {
      const nodeId = typeof sourceNode === 'string' ? parseInt(sourceNode) : sourceNode;
      if (!isNaN(nodeId)) {
        this.highlightNodes([nodeId]);
      }
    }
  }

  highlightReachableTo(targetNode: number | string | null): void {
    if (targetNode !== null) {
      const nodeId = typeof targetNode === 'string' ? parseInt(targetNode) : targetNode;
      if (!isNaN(nodeId)) {
        this.highlightNodes([nodeId]);
      }
    }
  }

  isNodeReachable(source: string | null, target: string | null): boolean {
    // For exact inference, just check if both nodes exist
    return source !== null && target !== null && source !== target;
  }

  getDistance(source: string | null, target: string | null): number {
    // For exact inference, return 1 if both nodes exist, otherwise 0
    return this.isNodeReachable(source, target) ? 1 : 0;
  }

  getPath(source: string | null, target: string | null): number[] {
    // For exact inference, return simple path if reachable
    if (this.isNodeReachable(source, target)) {
      const sourceId = parseInt(source!);
      const targetId = parseInt(target!);
      if (!isNaN(sourceId) && !isNaN(targetId)) {
        return [sourceId, targetId];
      }
    }
    return [];
  }
}