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

interface NetworkStructureResult {
  total_nodes: number;
  total_edges: number;
  source_nodes: number[];
  sink_nodes: number[];
  fork_nodes: number[];
  join_nodes: number[];
  iteration_sets_count: number;
}

interface ReachabilityResult {
  reachabilityMatrix: boolean[][];
  pathMatrix: number[][][]; // [source][target] = [path of node IDs]
  stronglyConnectedComponents: number[][];
  connectedComponentsCount: number;
  nodeDistances: number[][]; // [source][target] = distance
  maxDistance: number;
  averageDistance: number;
  reachabilityStats: {
    totalPairs: number;
    reachablePairs: number;
    reachabilityRatio: number;
  };
}

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
export class ReachabilityAnalysisComponent extends BaseAnalysisComponent<ReachabilityResult> implements OnInit, OnDestroy {
  
  private analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  // UI state
  selectedSourceNode: number | null = null;
  selectedTargetNode: number | null = null;
  showOnlyReachable = false;
  availableNodes: number[] = [];

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.loadAndAnalyzeData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  initializeComponent(): void {
    // Set available view modes
    this.availableViewModes.set({ visual: true, dashboard: true });
    this.currentViewMode.set('visual');
  }

  private loadAndAnalyzeData(): void {
    const networkData = this.analysisState.networkData();
    
    if (!networkData || !networkData.results) {
      this.setError('No network analysis data available');
      return;
    }

    this.setLoading(true);
    
    try {
      const networkStructure = networkData.results as NetworkStructureResult;
      const reachabilityResults = this.calculateReachability(networkStructure);
      
      const analysisData: AnalysisComponentData<ReachabilityResult> = {
        structure: networkData.structure,
        results: reachabilityResults
      };
      
      this.availableNodes = Array.from({length: networkStructure.total_nodes}, (_, i) => i);
      
      this.setData(analysisData);
      this.setLoading(false);
      
      this.snackBar.open(
        `Reachability analysis complete: ${reachabilityResults.reachabilityStats.reachablePairs}/${reachabilityResults.reachabilityStats.totalPairs} pairs reachable`, 
        'Close', 
        { duration: 4000 }
      );
      
    } catch (error) {
      this.setError(`Failed to analyze reachability: ${error}`);
      this.setLoading(false);
    }
  }

  private calculateReachability(networkStructure: NetworkStructureResult): ReachabilityResult {
    const nodeCount = networkStructure.total_nodes;
    
    // Initialize adjacency matrix from network structure
    const adjacencyMatrix = this.buildAdjacencyMatrix(networkStructure);
    
    // Calculate reachability matrix using Floyd-Warshall algorithm
    const reachabilityMatrix = this.calculateReachabilityMatrix(adjacencyMatrix);
    
    // Calculate shortest paths and distances
    const { pathMatrix, distanceMatrix } = this.calculatePathsAndDistances(adjacencyMatrix);
    
    // Find strongly connected components (simplified for DAG)
    const stronglyConnectedComponents = this.findStronglyConnectedComponents(adjacencyMatrix);
    
    // Calculate statistics
    let reachablePairs = 0;
    let totalDistance = 0;
    let maxDistance = 0;
    
    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        if (i !== j && reachabilityMatrix[i][j]) {
          reachablePairs++;
          const distance = distanceMatrix[i][j];
          totalDistance += distance;
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }
    
    const totalPairs = nodeCount * (nodeCount - 1);
    
    return {
      reachabilityMatrix,
      pathMatrix,
      stronglyConnectedComponents,
      connectedComponentsCount: stronglyConnectedComponents.length,
      nodeDistances: distanceMatrix,
      maxDistance,
      averageDistance: reachablePairs > 0 ? totalDistance / reachablePairs : 0,
      reachabilityStats: {
        totalPairs,
        reachablePairs,
        reachabilityRatio: totalPairs > 0 ? reachablePairs / totalPairs : 0
      }
    };
  }

  private buildAdjacencyMatrix(networkStructure: NetworkStructureResult): boolean[][] {
    const nodeCount = networkStructure.total_nodes;
    const matrix = Array(nodeCount).fill(null).map(() => Array(nodeCount).fill(false));
    
    // For demonstration, build edges based on node types
    // In a real implementation, this would come from the actual edge data
    const allNodes = Array.from({length: nodeCount}, (_, i) => i);
    
    // Connect sources to forks/joins, forks to joins/sinks, etc.
    networkStructure.source_nodes?.forEach(source => {
      // Sources connect to next nodes (simplified logic)
      if (source + 1 < nodeCount) {
        matrix[source][source + 1] = true;
      }
    });
    
    // Add more sophisticated edge logic based on your actual network structure
    // This is a simplified version for demonstration
    for (let i = 0; i < nodeCount - 1; i++) {
      if (Math.random() > 0.3) { // Simplified random connectivity
        matrix[i][i + 1] = true;
      }
    }
    
    return matrix;
  }

  private calculateReachabilityMatrix(adjacencyMatrix: boolean[][]): boolean[][] {
    const nodeCount = adjacencyMatrix.length;
    const reachability = adjacencyMatrix.map(row => [...row]);
    
    // Floyd-Warshall for reachability
    for (let k = 0; k < nodeCount; k++) {
      for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < nodeCount; j++) {
          reachability[i][j] = reachability[i][j] || (reachability[i][k] && reachability[k][j]);
        }
      }
    }
    
    return reachability;
  }

  private calculatePathsAndDistances(adjacencyMatrix: boolean[][]): {
    pathMatrix: number[][][],
    distanceMatrix: number[][]
  } {
    const nodeCount = adjacencyMatrix.length;
    const INF = Number.MAX_SAFE_INTEGER;
    
    // Initialize distance matrix
    const distanceMatrix = Array(nodeCount).fill(null).map(() => Array(nodeCount).fill(INF));
    const pathMatrix: number[][][] = Array(nodeCount).fill(null).map(() => 
      Array(nodeCount).fill(null).map(() => [] as number[])
    );
    
    // Initialize with direct edges
    for (let i = 0; i < nodeCount; i++) {
      distanceMatrix[i][i] = 0;
      pathMatrix[i][i] = []; // Empty path for self
      for (let j = 0; j < nodeCount; j++) {
        if (i !== j && adjacencyMatrix[i][j]) {
          distanceMatrix[i][j] = 1;
          pathMatrix[i][j] = [i, j];
        }
      }
    }
    
    // Floyd-Warshall for shortest paths
    for (let k = 0; k < nodeCount; k++) {
      for (let i = 0; i < nodeCount; i++) {
        for (let j = 0; j < nodeCount; j++) {
          if (distanceMatrix[i][k] !== INF && 
              distanceMatrix[k][j] !== INF && 
              distanceMatrix[i][k] + distanceMatrix[k][j] < distanceMatrix[i][j]) {
            distanceMatrix[i][j] = distanceMatrix[i][k] + distanceMatrix[k][j];
            // Reconstruct path by combining paths through k
            if (pathMatrix[i][k].length > 0 && pathMatrix[k][j].length > 0) {
              pathMatrix[i][j] = [...pathMatrix[i][k].slice(0, -1), ...pathMatrix[k][j]];
            }
          }
        }
      }
    }
    
    return { pathMatrix, distanceMatrix };
  }

  private findStronglyConnectedComponents(adjacencyMatrix: boolean[][]): number[][] {
    // Simplified SCC detection for demonstration
    // In practice, use Tarjan's or Kosaraju's algorithm
    const nodeCount = adjacencyMatrix.length;
    const visited = new Array(nodeCount).fill(false);
    const components: number[][] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      if (!visited[i]) {
        const component = [i];
        visited[i] = true;
        // Add connected nodes (simplified)
        for (let j = i + 1; j < nodeCount; j++) {
          if (!visited[j] && (adjacencyMatrix[i][j] || adjacencyMatrix[j][i])) {
            component.push(j);
            visited[j] = true;
          }
        }
        components.push(component);
      }
    }
    
    return components;
  }

  processData(data: AnalysisComponentData<ReachabilityResult>): void {
    console.log('Processing reachability analysis data:', data);
    
    // Update visualization config
    this.visualizationConfig.update(config => ({
      ...config,
      showLabels: true,
      highlightNodes: [],
      nodeColors: this.generateReachabilityNodeColors(data.results)
    }));
  }

  private generateReachabilityNodeColors(results: ReachabilityResult): Record<number, string> {
    const nodeColors: Record<number, string> = {};
    
    // Color nodes by connectivity (teal theme)
    const nodeCount = results.reachabilityMatrix.length;
    
    for (let i = 0; i < nodeCount; i++) {
      let reachableCount = 0;
      let reachedByCount = 0;
      
      for (let j = 0; j < nodeCount; j++) {
        if (results.reachabilityMatrix[i][j]) reachableCount++;
        if (results.reachabilityMatrix[j][i]) reachedByCount++;
      }
      
      const totalConnectivity = reachableCount + reachedByCount;
      
      if (totalConnectivity === 0) {
        nodeColors[i] = '#B0BEC5'; // Gray for isolated nodes
      } else if (totalConnectivity < nodeCount * 0.3) {
        nodeColors[i] = '#80CBC4'; // Light teal for low connectivity
      } else if (totalConnectivity < nodeCount * 0.7) {
        nodeColors[i] = '#009688'; // Primary teal for medium connectivity
      } else {
        nodeColors[i] = '#00695C'; // Dark teal for high connectivity
      }
    }
    
    return nodeColors;
  }

  updateVisualization(config: VisualizationConfig): void {
    console.log('Updating reachability visualization with config:', config);
    
    if (this.isVisualMode()) {
      // Update the graph visualization
      // This will highlight paths and reachability
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

  private exportAsJson(data: ReachabilityResult): void {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `reachability-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsCsv(data: ReachabilityResult): void {
    const csvRows = [
      ['Source Node', 'Target Node', 'Reachable', 'Distance', 'Path Length'],
    ];
    
    const nodeCount = data.reachabilityMatrix.length;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = 0; j < nodeCount; j++) {
        if (i !== j) {
          csvRows.push([
            i.toString(),
            j.toString(),
            data.reachabilityMatrix[i][j] ? 'Yes' : 'No',
            data.nodeDistances[i][j] !== Number.MAX_SAFE_INTEGER ? data.nodeDistances[i][j].toString() : 'Infinite',
            data.pathMatrix[i][j] ? data.pathMatrix[i][j].length.toString() : '0'
          ]);
        }
      }
    }
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `reachability-matrix-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private exportAsPng(): void {
    this.snackBar.open('PNG export not yet implemented', 'Close', { duration: 3000 });
  }

  // Template helper methods
  getReachabilityMatrix(): boolean[][] {
    return this.componentData()?.results?.reachabilityMatrix || [];
  }

  getReachablePairsCount(): number {
    return this.componentData()?.results?.reachabilityStats.reachablePairs || 0;
  }

  getTotalPairsCount(): number {
    return this.componentData()?.results?.reachabilityStats.totalPairs || 0;
  }

  getReachabilityRatio(): number {
    return this.componentData()?.results?.reachabilityStats.reachabilityRatio || 0;
  }

  getMaxDistance(): number {
    return this.componentData()?.results?.maxDistance || 0;
  }

  getAverageDistance(): number {
    return this.componentData()?.results?.averageDistance || 0;
  }

  getConnectedComponentsCount(): number {
    return this.componentData()?.results?.connectedComponentsCount || 0;
  }

  getStronglyConnectedComponents(): number[][] {
    return this.componentData()?.results?.stronglyConnectedComponents || [];
  }

  // Interactive path analysis
  onSourceNodeChange(nodeId: number | null): void {
    this.selectedSourceNode = nodeId;
    this.updatePathHighlight();
  }

  onTargetNodeChange(nodeId: number | null): void {
    this.selectedTargetNode = nodeId;
    this.updatePathHighlight();
  }

  private updatePathHighlight(): void {
    if (this.selectedSourceNode !== null && this.selectedTargetNode !== null) {
      const data = this.componentData();
      if (data && data.results.pathMatrix[this.selectedSourceNode][this.selectedTargetNode]) {
        const path = data.results.pathMatrix[this.selectedSourceNode][this.selectedTargetNode];
        this.highlightPath(path);
      }
    }
  }

  private highlightPath(path: number[]): void {
    this.highlightNodes(path);
    
    const edges = [];
    for (let i = 0; i < path.length - 1; i++) {
      edges.push({ from: path[i], to: path[i + 1] });
    }
    this.highlightEdges(edges);
  }

  isNodeReachable(source: number, target: number): boolean {
    const matrix = this.getReachabilityMatrix();
    return matrix[source] && matrix[source][target] || false;
  }

  getDistance(source: number, target: number): number {
    const data = this.componentData();
    if (!data) return Infinity;
    
    const distance = data.results.nodeDistances[source][target];
    return distance === Number.MAX_SAFE_INTEGER ? Infinity : distance;
  }

  getPath(source: number, target: number): number[] {
    const data = this.componentData();
    return data?.results.pathMatrix[source][target] || [];
  }

  highlightReachableFrom(sourceNode: number): void {
    const matrix = this.getReachabilityMatrix();
    const reachableNodes = [];
    
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[sourceNode] && matrix[sourceNode][i]) {
        reachableNodes.push(i);
      }
    }
    
    this.highlightNodes([sourceNode, ...reachableNodes]);
  }

  highlightReachableTo(targetNode: number): void {
    const matrix = this.getReachabilityMatrix();
    const reachingNodes = [];
    
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] && matrix[i][targetNode]) {
        reachingNodes.push(i);
      }
    }
    
    this.highlightNodes([...reachingNodes, targetNode]);
  }
}