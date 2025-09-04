import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { NetworkStructure } from '../../shared/models/network-analysis.models';
import { NodeDetailsDialogComponent } from './node-details-dialog.component';
import { EdgeDetailsDialogComponent } from './edge-details-dialog.component';

@Component({
  selector: 'app-network-structure',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    FormsModule
  ],
  templateUrl: './network-structure.component.html',
  styleUrls: ['./network-structure.component.scss']
})
export class NetworkStructureComponent implements OnInit {
  private analysisState = inject(AnalysisStateService);
  private sessionService = inject(NetworkSessionService);
  private dialog = inject(MatDialog);

  // Core data signals
  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  currentView = signal<'overview' | 'nodes' | 'edges'>('overview');
  
  // Pagination
  nodePageSize = signal(50);
  nodePageIndex = signal(0);
  edgePageSize = signal(100);
  edgePageIndex = signal(0);

  // Filters
  nodeSearchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);

  // Table columns
  nodeColumns = ['node', 'type', 'inDegree', 'outDegree', 'actions'];
  edgeColumns = ['source', 'target', 'type', 'actions'];

  // Computed properties for dashboard
  networkSummary = computed(() => {
    const data = this.networkData();
    if (!data) return null;

    return {
      totalNodes: data.total_nodes || 0,
      totalEdges: data.total_edges || 0,
      sourceNodes: data.source_nodes?.length || 0,
      sinkNodes: data.sink_nodes?.length || 0,
      forkNodes: data.fork_nodes?.length || 0,
      joinNodes: data.join_nodes?.length || 0,
      layers: data.iteration_sets_count || 0,
      computationTime: data.computation_time || 0
    };
  });

  // Network insights
  networkInsights = computed(() => {
    const data = this.networkData();
    if (!data) return [];

    const insights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string}> = [];
    
    const totalNodes = data.total_nodes || 0;
    const sourceNodes = data.source_nodes?.length || 0;
    const sinkNodes = data.sink_nodes?.length || 0;
    const forkNodes = data.fork_nodes?.length || 0;
    const joinNodes = data.join_nodes?.length || 0;

    // Network density
    const maxEdges = totalNodes * (totalNodes - 1);
    const density = maxEdges > 0 ? data.total_edges / maxEdges : 0;
    
    if (density < 0.1) {
      insights.push({
        type: 'info',
        message: `Sparse Network (${(density * 100).toFixed(1)}% density)`,
        detail: 'Few connections relative to potential - efficient for sequential processing'
      });
    } else if (density > 0.5) {
      insights.push({
        type: 'info',
        message: `Dense Network (${(density * 100).toFixed(1)}% density)`,
        detail: 'Highly interconnected - may benefit from parallel processing'
      });
    }

    // Source/sink analysis
    if (sourceNodes === 0) {
      insights.push({
        type: 'warning',
        message: 'No Source Nodes',
        detail: 'Network lacks clear entry points'
      });
    } else if (sourceNodes === 1) {
      insights.push({
        type: 'success',
        message: 'Single Source Structure',
        detail: 'Clear single entry point - ideal for hierarchical flow'
      });
    }

    if (sinkNodes === 0) {
      insights.push({
        type: 'warning',
        message: 'No Sink Nodes',
        detail: 'Network lacks clear endpoints'
      });
    }

    // Fork/join balance
    const forkJoinRatio = joinNodes > 0 ? forkNodes / joinNodes : (forkNodes > 0 ? Infinity : 1);
    if (forkJoinRatio > 1.5) {
      insights.push({
        type: 'info',
        message: 'Divergent Structure',
        detail: `${forkNodes} forks vs ${joinNodes} joins - information spreads more than consolidates`
      });
    } else if (forkJoinRatio < 0.67 && joinNodes > 0) {
      insights.push({
        type: 'info',
        message: 'Convergent Structure',
        detail: `${joinNodes} joins vs ${forkNodes} forks - information consolidates more than spreads`
      });
    }

    return insights;
  });

  // Structural metrics
  structuralMetrics = computed(() => {
    const data = this.networkData();
    if (!data) return null;

    const totalNodes = data.total_nodes || 0;
    const totalEdges = data.total_edges || 0;
    const layers = data.iteration_sets_count || 0;
    
    const edgeToNodeRatio = totalNodes > 0 ? totalEdges / totalNodes : 0;
    const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
    const layerEfficiency = layers > 0 ? totalNodes / layers : 0;
    
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;
    
    const boundaryNodes = (data.source_nodes?.length || 0) + (data.sink_nodes?.length || 0);
    const boundaryRatio = totalNodes > 0 ? boundaryNodes / totalNodes : 0;
    
    return {
      edgeToNodeRatio: Number(edgeToNodeRatio.toFixed(2)),
      averageDegree: Number(avgDegree.toFixed(2)),
      networkDensity: Number((density * 100).toFixed(2)),
      layerEfficiency: Number(layerEfficiency.toFixed(1)),
      boundaryNodeRatio: Number((boundaryRatio * 100).toFixed(1))
    };
  });

  // Graph Theory Connectivity Insights
  connectivityInsights = computed(() => {
    const data = this.networkData();
    if (!data) return null;

    const totalNodes = data.total_nodes || 0;
    const totalEdges = data.total_edges || 0;
    const layers = data.iteration_sets_count || 0;
    
    // Calculate graph theory metrics
    const maxPossibleEdges = totalNodes * (totalNodes - 1); // For directed graph
    const density = maxPossibleEdges > 0 ? (totalEdges / maxPossibleEdges) * 100 : 0;
    
    // Connectivity ratio (edges per node)
    const connectivityRatio = totalNodes > 0 ? totalEdges / totalNodes : 0;
    
    // Average path length approximation (layers give us topological depth)
    const avgPathLength = layers > 1 ? layers / 2 : 1;
    
    // Branching factor (average outgoing connections)
    const branchingFactor = (data.fork_nodes?.length || 0) > 0 ?
      totalEdges / (data.source_nodes?.length + data.fork_nodes?.length || 1) : 1;
    
    // Convergence factor (average incoming connections to joins/sinks)
    const convergenceFactor = (data.join_nodes?.length || 0) > 0 ?
      totalEdges / (data.sink_nodes?.length + data.join_nodes?.length || 1) : 1;
    
    return {
      density: Number(density.toFixed(2)),
      connectivityRatio: Number(connectivityRatio.toFixed(2)),
      avgPathLength: Number(avgPathLength.toFixed(1)),
      branchingFactor: Number(branchingFactor.toFixed(2)),
      convergenceFactor: Number(convergenceFactor.toFixed(2)),
      isWellConnected: density > 10,
      isSparseDag: density < 5,
      hasBalancedFlow: Math.abs(branchingFactor - convergenceFactor) < 0.5
    };
  });

  // Topological Structure Analysis
  topologyAnalysis = computed(() => {
    const data = this.networkData();
    if (!data) return null;

    const totalNodes = data.total_nodes || 0;
    const sources = data.source_nodes?.length || 0;
    const sinks = data.sink_nodes?.length || 0;
    const forks = data.fork_nodes?.length || 0;
    const joins = data.join_nodes?.length || 0;
    const layers = data.iteration_sets_count || 0;
    
    // Calculate topology characteristics
    const parallelismIndex = forks > 0 ? forks / totalNodes : 0;
    const convergenceIndex = joins > 0 ? joins / totalNodes : 0;
    const layerEfficiency = layers > 0 ? totalNodes / layers : 0;
    
    // Determine network shape characteristics
    const isDiamondShaped = forks > 0 && joins > 0 && forks === joins;
    const isFanOut = forks > joins;
    const isFanIn = joins > forks;
    const isLinear = forks === 0 && joins === 0;
    
    // Calculate width variation (how much the network expands/contracts)
    const maxWidth = Math.max(sources, forks, joins, sinks);
    const minWidth = Math.min(sources || 1, sinks || 1);
    const widthVariation = maxWidth / minWidth;
    
    return {
      parallelismIndex: Number((parallelismIndex * 100).toFixed(1)),
      convergenceIndex: Number((convergenceIndex * 100).toFixed(1)),
      layerEfficiency: Number(layerEfficiency.toFixed(1)),
      widthVariation: Number(widthVariation.toFixed(2)),
      isDiamondShaped,
      isFanOut,
      isFanIn,
      isLinear,
      networkShape: isDiamondShaped ? 'Diamond' :
                   isFanOut ? 'Fan-Out' :
                   isFanIn ? 'Fan-In' :
                   isLinear ? 'Linear' : 'Complex'
    };
  });

  // Reachability Analysis
  reachabilityAnalysis = computed(() => {
    const data = this.networkData();
    if (!data?.ancestors || !data?.descendants) return null;

    const totalNodes = data.total_nodes || 0;
    const ancestors = data.ancestors;
    const descendants = data.descendants;
    
    // Calculate reachability metrics
    let totalAncestors = 0;
    let totalDescendants = 0;
    let maxAncestors = 0;
    let maxDescendants = 0;
    
    Object.values(ancestors).forEach((ancestorList: any) => {
      const count = ancestorList.length;
      totalAncestors += count;
      maxAncestors = Math.max(maxAncestors, count);
    });
    
    Object.values(descendants).forEach((descendantList: any) => {
      const count = descendantList.length;
      totalDescendants += count;
      maxDescendants = Math.max(maxDescendants, count);
    });
    
    const avgAncestors = totalNodes > 0 ? totalAncestors / totalNodes : 0;
    const avgDescendants = totalNodes > 0 ? totalDescendants / totalNodes : 0;
    
    // Reachability ratio (how much of the network each node can reach on average)
    const reachabilityRatio = totalNodes > 0 ? (avgDescendants / totalNodes) * 100 : 0;
    const influenceSpread = totalNodes > 0 ? (maxDescendants / totalNodes) * 100 : 0;
    
    return {
      avgAncestors: Number(avgAncestors.toFixed(1)),
      avgDescendants: Number(avgDescendants.toFixed(1)),
      maxAncestors,
      maxDescendants,
      reachabilityRatio: Number(reachabilityRatio.toFixed(1)),
      influenceSpread: Number(influenceSpread.toFixed(1)),
      isHighlyConnected: reachabilityRatio > 50,
      hasInfluentialNodes: influenceSpread > 75
    };
  });

  // Node details for table
  nodeDetails = computed(() => {
    const data = this.networkData();
    if (!data) return [];

    return data.nodes.map((nodeId: number) => {
      const nodeType = this.getNodeType(nodeId);
      const inDegree = this.calculateInDegree(nodeId);
      const outDegree = this.calculateOutDegree(nodeId);

      return {
        node: nodeId,
        type: nodeType,
        inDegree,
        outDegree
      };
    }).sort((a, b) => a.node - b.node);
  });

  // Edge details for table
  edgeDetails = computed(() => {
    const data = this.networkData();
    if (!data?.edges) return [];

    return data.edges.map(([source, target]: [number, number]) => ({
      source,
      target,
      type: this.getEdgeType(source, target)
    })).sort((a, b) => a.source - b.source || a.target - b.target);
  });

  // Filtered and paginated data
  filteredNodeDetails = computed(() => {
    const nodes = this.nodeDetails();
    const searchTerm = this.nodeSearchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();

    return nodes.filter(node => {
      const matchesSearch = !searchTerm || node.node.toString().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(node.type);
      return matchesSearch && matchesType;
    });
  });

  paginatedNodeDetails = computed(() => {
    const filtered = this.filteredNodeDetails();
    const pageSize = this.nodePageSize();
    const pageIndex = this.nodePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  paginatedEdgeDetails = computed(() => {
    const edges = this.edgeDetails();
    const pageSize = this.edgePageSize();
    const pageIndex = this.edgePageIndex();
    const start = pageIndex * pageSize;
    return edges.slice(start, start + pageSize);
  });

  // Helper methods
  private getNodeType(nodeId: number): string {
    const data = this.networkData();
    if (!data) return 'Unknown';

    const types: string[] = [];
    
    if (data.source_nodes.includes(nodeId)) types.push('Source');
    if (data.sink_nodes.includes(nodeId)) types.push('Sink');
    if (data.fork_nodes.includes(nodeId)) types.push('Fork');
    if (data.join_nodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  private calculateInDegree(nodeId: number): number {
    const data = this.networkData();
    if (!data?.edges) return 0;
    return data.edges.filter(([_, target]) => target === nodeId).length;
  }

  private calculateOutDegree(nodeId: number): number {
    const data = this.networkData();
    if (!data?.edges) return 0;
    return data.edges.filter(([source, _]) => source === nodeId).length;
  }

  private getEdgeType(source: number, target: number): string {
    const sourceType = this.getNodeType(source);
    const targetType = this.getNodeType(target);
    
    if (sourceType.includes('Source') && targetType.includes('Sink')) return 'Source→Sink';
    if (sourceType.includes('Fork') && targetType.includes('Join')) return 'Fork→Join';
    if (sourceType.includes('Source')) return 'Source→';
    if (targetType.includes('Sink')) return '→Sink';
    return 'Internal';
  }

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' | 'nodes' | 'edges');
  }

  onNodePageChange(event: PageEvent): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  onEdgePageChange(event: PageEvent): void {
    this.edgePageIndex.set(event.pageIndex);
    this.edgePageSize.set(event.pageSize);
  }

  onNodeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.nodeSearchTerm.set(target.value);
    this.nodePageIndex.set(0); // Reset to first page
  }

  onNodeTypeFilter(types: string[]): void {
    this.selectedNodeTypes.set(types);
    this.nodePageIndex.set(0); // Reset to first page
  }

  // Modal methods
  openNodeDetailsModal(nodeId: number): void {
    const data = this.networkData();
    if (!data) return;

    const nodeDetails = this.getDetailedNodeInfo(nodeId);
    
    const dialogRef = this.dialog.open(NodeDetailsDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      data: {
        nodeId,
        nodeDetails,
        networkData: data
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateToNode) {
        this.openNodeDetailsModal(result.navigateToNode);
      }
    });
  }

  openEdgeDetailsModal(source: number, target: number): void {
    const data = this.networkData();
    if (!data) return;

    const edgeDetails = this.getDetailedEdgeInfo(source, target);
    
    const dialogRef = this.dialog.open(EdgeDetailsDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      data: {
        source,
        target,
        edgeDetails,
        networkData: data
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateToNode) {
        this.openNodeDetailsModal(result.navigateToNode);
      }
    });
  }

  private getDetailedNodeInfo(nodeId: number) {
    const data = this.networkData();
    if (!data) return null;

    const nodeTypes = this.getNodeType(nodeId).split(' + ');
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);

    const parents = data.edges
      .filter(([_, target]) => target === nodeId)
      .map(([source, _]) => source);

    const children = data.edges
      .filter(([source, _]) => source === nodeId)
      .map(([_, target]) => target);

    const ancestors = this.getAncestors(nodeId, data);
    const descendants = this.getDescendants(nodeId, data);

    return {
      nodeId,
      types: nodeTypes,
      inDegree,
      outDegree,
      parents,
      children,
      ancestors,
      descendants,
      iterationSet: this.getNodeIterationSet(nodeId, data),
      isChokepoint: inDegree === 1 || outDegree === 1,
      connectivity: {
        totalConnections: inDegree + outDegree,
        connectivityRatio: data.total_nodes > 0 ? (inDegree + outDegree) / (data.total_nodes - 1) : 0
      }
    };
  }

  private getDetailedEdgeInfo(source: number, target: number) {
    const data = this.networkData();
    if (!data) return null;

    const sourceTypes = this.getNodeType(source).split(' + ');
    const targetTypes = this.getNodeType(target).split(' + ');
    const edgeType = this.getEdgeType(source, target);

    const targetParents = data.edges.filter(([_, t]) => t === target).length;
    const isCritical = targetParents === 1;

    return {
      source,
      target,
      sourceTypes,
      targetTypes,
      edgeType,
      isCritical,
      pathLength: 1, // Direct connection
      sourceIterationSet: this.getNodeIterationSet(source, data),
      targetIterationSet: this.getNodeIterationSet(target, data),
      crossesLayers: Math.abs(
        this.getNodeIterationSet(source, data) - this.getNodeIterationSet(target, data)
      ) > 1
    };
  }

  private getAncestors(nodeId: number, data: any): number[] {
    const ancestors = new Set<number>();
    const visited = new Set<number>();
    
    const dfs = (currentNode: number) => {
      if (visited.has(currentNode)) return;
      visited.add(currentNode);
      
      const parents = data.edges
        .filter(([, target]: [number, number]) => target === currentNode)
        .map(([source]: [number, number]) => source);
      
      for (const parent of parents) {
        ancestors.add(parent);
        dfs(parent);
      }
    };
    
    dfs(nodeId);
    return Array.from(ancestors).sort((a, b) => a - b);
  }

  private getDescendants(nodeId: number, data: any): number[] {
    const descendants = new Set<number>();
    const visited = new Set<number>();
    
    const dfs = (currentNode: number) => {
      if (visited.has(currentNode)) return;
      visited.add(currentNode);
      
      const children = data.edges
        .filter(([source]: [number, number]) => source === currentNode)
        .map(([, target]: [number, number]) => target);
      
      for (const child of children) {
        descendants.add(child);
        dfs(child);
      }
    };
    
    dfs(nodeId);
    return Array.from(descendants).sort((a, b) => a - b);
  }

  private getNodeIterationSet(nodeId: number, data: any): number {
    // Simple approximation - would need proper topological sorting for accuracy
    const sources = data.source_nodes;
    if (sources.includes(nodeId)) return 0;
    
    const ancestors = this.getAncestors(nodeId, data);
    return ancestors.length > 0 ? Math.max(...ancestors.map(a => this.getNodeIterationSet(a, data))) + 1 : 0;
  }

  ngOnInit(): void {
    console.log('🏗️ NetworkStructureComponent initializing...');
    
    // Trigger API call immediately if network path is available
    const currentSession = this.sessionService.getCurrentSession();
    const networkPath = currentSession?.networkPath || this.analysisState.currentNetworkPath();
    
    if (networkPath) {
      this.loadNetworkStructureDataIfNeeded();
    }
  }

  private hasCalledNetworkStructureAPI = false;

  private loadNetworkStructureDataIfNeeded(): void {
    const currentSession = this.sessionService.getCurrentSession();
    const networkPath = currentSession?.networkPath || this.analysisState.currentNetworkPath();
    
    if (networkPath && !this.hasCalledNetworkStructureAPI) {
      // Convert Windows backslashes to forward slashes for backend compatibility
      const normalizedPath = networkPath.replace(/\\/g, '/');
      console.log('🔍 Loading Network Structure data from API endpoint:', normalizedPath);
      this.hasCalledNetworkStructureAPI = true;
      
      this.analysisState.loadNetworkStructure(normalizedPath).subscribe({
        next: () => console.log('✅ Network structure loaded successfully'),
        error: (error) => {
          console.error('❌ Failed to load network structure from API:', error);
          this.hasCalledNetworkStructureAPI = false; // Reset on error to allow retry
        }
      });
    }
  }

  retryAnalysis(): void {
    // Retry analysis - would need to implement proper retry logic
    console.log('Retrying network analysis...');
  }

}