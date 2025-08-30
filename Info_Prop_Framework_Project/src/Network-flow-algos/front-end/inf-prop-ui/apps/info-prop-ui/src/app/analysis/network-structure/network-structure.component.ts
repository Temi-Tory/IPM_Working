import { Component, inject, computed, signal } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkStructure } from '../../shared/models/network-analysis.models';

@Component({
  selector: 'app-network-structure',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatProgressBarModule
],
  templateUrl: './network-structure.component.html',
  styleUrls: ['./network-structure.component.scss']
})
export class NetworkStructureComponent {
  private analysisState = inject(AnalysisStateService);

  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // Computed signals to prevent expression changed errors
  connectivityDistribution = computed(() => this.getConnectivityDistribution());
  networkMetrics = computed(() => this.getNetworkMetrics());
  nodeDetails = computed(() => this.getNodeDetails());
  edgeDetails = computed(() => this.getEdgeDetails());

  // View toggle
  currentView = signal<'dashboard' | 'visual'>('dashboard');

  displayedColumns: string[] = ['metric', 'value'];
  nodeDetailsColumns: string[] = ['node', 'type', 'inDegree', 'outDegree'];
  edgeDetailsColumns: string[] = ['source', 'target', 'edgeType'];

  switchView(view: 'dashboard' | 'visual'): void {
    this.currentView.set(view);
  }

  getNetworkMetrics(): { metric: string; value: string | number }[] {
    const data = this.networkData();
    if (!data) return [];

    const diamondJoinNodes = this.getDiamondJoinNodes();
    const multiTypeNodes = this.getMultiTypeNodes();

    return [
      { metric: 'Total Nodes', value: data.total_nodes },
      { metric: 'Total Edges', value: data.total_edges },
      { metric: 'Source Nodes', value: data.source_nodes.length },
      { metric: 'Sink Nodes', value: data.sink_nodes.length },
      { metric: 'Fork Nodes', value: data.fork_nodes.length },
      { metric: 'Join Nodes', value: data.join_nodes.length },
      { metric: 'Diamond Join Nodes', value: diamondJoinNodes.length },
      { metric: 'Multi-Type Nodes', value: multiTypeNodes.length },
      { metric: 'Iteration Sets', value: data.iteration_sets_count },
      { metric: 'Computation Time', value: `${data.computation_time.toFixed(4)}s` }
    ];
  }

  getNodesByType(type: 'source' | 'sink' | 'fork' | 'join' | 'diamond-join'): number[] {
    const data = this.networkData();
    if (!data) return [];

    switch (type) {
      case 'source': return data.source_nodes;
      case 'sink': return data.sink_nodes;
      case 'fork': return data.fork_nodes;
      case 'join': return data.join_nodes;
      case 'diamond-join': return this.getDiamondJoinNodes();
      default: return [];
    }
  }

  getDiamondJoinNodes(): number[] {
    const data = this.networkData();
    const analysisResults = this.analysisState.analysisResults();
    
    if (!data || !analysisResults?.results) return [];

    const diamondJoins = new Set<number>();
    const analysisData = (analysisResults.results as any).results || analysisResults.results;
    
    // Check across all reachability scenarios for diamond analysis
    if (analysisData.reachability_scenarios) {
      for (const scenario of Object.values(analysisData.reachability_scenarios) as any[]) {
        if (scenario.diamond_analysis?.raw_root_diamonds) {
          const rootDiamonds = scenario.diamond_analysis.raw_root_diamonds;
          // root_diamonds keys are join node IDs - these are the diamond joins
          for (const nodeIdStr of Object.keys(rootDiamonds)) {
            const nodeId = parseInt(nodeIdStr);
            if (data.join_nodes.includes(nodeId)) {
              diamondJoins.add(nodeId);
            }
          }
        }
      }
    }
    
    // Also check standalone diamond analysis
    if (analysisData.diamond_analysis?.raw_root_diamonds) {
      const rootDiamonds = analysisData.diamond_analysis.raw_root_diamonds;
      // root_diamonds keys are join node IDs - these are the diamond joins
      for (const nodeIdStr of Object.keys(rootDiamonds)) {
        const nodeId = parseInt(nodeIdStr);
        if (data.join_nodes.includes(nodeId)) {
          diamondJoins.add(nodeId);
        }
      }
    }
    
    return Array.from(diamondJoins).sort((a, b) => a - b);
  }

  getMultiTypeNodes(): { nodeId: number; types: string[] }[] {
    const data = this.networkData();
    if (!data) return [];

    const allNodes = new Set<number>();
    data.edges.forEach(([source, target]) => {
      allNodes.add(source);
      allNodes.add(target);
    });
    const nodes = data.nodes || Array.from(allNodes);

    return nodes
      .map(nodeId => ({
        nodeId,
        types: this.getNodeTypes(nodeId)
      }))
      .filter(node => node.types.length > 1 || node.types.includes('Diamond Join'))
      .sort((a, b) => a.nodeId - b.nodeId);
  }

  getNodeDetails(): { node: number; type: string; inDegree: number; outDegree: number }[] {
    const data = this.networkData();
    if (!data) return [];

    // Use the guaranteed nodes array from enhanced NetworkStructure
    const nodes = data.nodes;

    return nodes.map((nodeId: number) => {
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
  }

  getEdgeDetails(): { source: number; target: number; edgeType: string }[] {
    const data = this.networkData();
    if (!data || !data.edges) return [];

    return data.edges.map(([source, target]: [number, number]) => ({
      source,
      target,
      edgeType: this.getEdgeType(source, target)
    })).sort((a, b) => a.source - b.source || a.target - b.target);
  }

  private getNodeTypes(nodeId: number): string[] {
    const data = this.networkData();
    const analysisResults = this.analysisState.analysisResults();
    
    if (!data) return ['Regular'];

    const types: string[] = [];
    
    // Check all possible node types (nodes can have multiple types)
    if (data.source_nodes.includes(nodeId)) types.push('Source');
    if (data.sink_nodes.includes(nodeId)) types.push('Sink');
    if (data.fork_nodes.includes(nodeId)) types.push('Fork');
    if (data.join_nodes.includes(nodeId)) types.push('Join');
    
    // Check if this join node is also a diamond join
    if (data.join_nodes.includes(nodeId) && analysisResults?.results) {
      const analysisData = (analysisResults.results as any).results || analysisResults.results;
      let isDiamondJoin = false;
      
      // Check across all reachability scenarios for diamond analysis  
      if (analysisData.reachability_scenarios) {
        for (const scenario of Object.values(analysisData.reachability_scenarios) as any[]) {
          if (scenario.diamond_analysis?.raw_root_diamonds) {
            const rootDiamonds = scenario.diamond_analysis.raw_root_diamonds;
            // root_diamonds keys are join node IDs - check if this node is a diamond join
            if (rootDiamonds[nodeId.toString()]) {
              isDiamondJoin = true;
              break;
            }
          }
        }
      }
      
      // Also check standalone diamond analysis
      if (!isDiamondJoin && analysisData.diamond_analysis?.raw_root_diamonds) {
        const rootDiamonds = analysisData.diamond_analysis.raw_root_diamonds;
        // root_diamonds keys are join node IDs - check if this node is a diamond join
        if (rootDiamonds[nodeId.toString()]) {
          isDiamondJoin = true;
        }
      }
      
      if (isDiamondJoin) {
        types.push('Diamond Join');
      }
    }
    
    return types.length > 0 ? types : ['Regular'];
  }

  private getNodeType(nodeId: number): string {
    const types = this.getNodeTypes(nodeId);
    return types.join(' + ');
  }

  private calculateInDegree(nodeId: number): number {
    const data = this.networkData();
    if (!data || !data.edges) return 0;

    return data.edges.filter(([_, target]: [number, number]) => target === nodeId).length;
  }

  private calculateOutDegree(nodeId: number): number {
    const data = this.networkData();
    if (!data || !data.edges) return 0;

    return data.edges.filter(([source, _]: [number, number]) => source === nodeId).length;
  }

  private getEdgeType(source: number, target: number): string {
    const data = this.networkData();
    if (!data) return 'Regular';

    const sourceType = this.getNodeType(source).toLowerCase();
    const targetType = this.getNodeType(target).toLowerCase();

    if (sourceType === 'source') return 'Source → ' + this.capitalize(targetType);
    if (targetType === 'sink') return this.capitalize(sourceType) + ' → Sink';
    if (sourceType === 'fork') return 'Fork → ' + this.capitalize(targetType);
    if (targetType === 'join') return this.capitalize(sourceType) + ' → Join';
    
    return 'Regular';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getConnectivityDistribution(): { level: string; count: number; percentage: number }[] {
    const data = this.networkData();
    if (!data) return [];

    // Use the guaranteed nodes array from enhanced NetworkStructure
    const nodes = data.nodes;

    const connectivityLevels: { [key: string]: number } = {
      'High (>= 4 connections)': 0,
      'Medium (2-3 connections)': 0,
      'Low (1 connection)': 0,
      'Isolated (0 connections)': 0
    };

    nodes.forEach((nodeId: number) => {
      const totalDegree = this.calculateInDegree(nodeId) + this.calculateOutDegree(nodeId);
      
      if (totalDegree >= 4) connectivityLevels['High (>= 4 connections)']++;
      else if (totalDegree >= 2) connectivityLevels['Medium (2-3 connections)']++;
      else if (totalDegree === 1) connectivityLevels['Low (1 connection)']++;
      else connectivityLevels['Isolated (0 connections)']++;
    });

    const total = nodes.length;
    return Object.entries(connectivityLevels).map(([level, count]) => ({
      level,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }

  getIterationSetsAnalysis(): { setIndex: number; nodes: number[]; size: number }[] {
    const data = this.networkData();
    if (!data) return [];

    return data.iteration_sets.map((nodeSet, index) => ({
      setIndex: index + 1,
      nodes: nodeSet.sort((a, b) => a - b),
      size: nodeSet.length
    }));
  }

  getAncestorsDescendantsAnalysis(): { nodeId: number; ancestors: number[]; descendants: number[]; ancestorCount: number; descendantCount: number }[] {
    const data = this.networkData();
    if (!data) return [];

    return data.nodes
      .map(nodeId => {
        const ancestors = data.ancestors[nodeId.toString()] || [];
        const descendants = data.descendants[nodeId.toString()] || [];
        
        return {
          nodeId,
          ancestors: ancestors.sort((a, b) => a - b),
          descendants: descendants.sort((a, b) => a - b),
          ancestorCount: ancestors.length,
          descendantCount: descendants.length
        };
      })
      .sort((a, b) => a.nodeId - b.nodeId);
  }

  getTopologicalAnalysis(): { metric: string; value: string | number }[] {
    const data = this.networkData();
    if (!data) return [];

    const iterationSets = this.getIterationSetsAnalysis();
    const maxSetSize = Math.max(...iterationSets.map(set => set.size));
    const avgSetSize = iterationSets.reduce((sum, set) => sum + set.size, 0) / iterationSets.length;
    const ancestorDescendantData = this.getAncestorsDescendantsAnalysis();
    const maxAncestors = Math.max(...ancestorDescendantData.map(node => node.ancestorCount));
    const maxDescendants = Math.max(...ancestorDescendantData.map(node => node.descendantCount));
    const avgAncestors = ancestorDescendantData.reduce((sum, node) => sum + node.ancestorCount, 0) / ancestorDescendantData.length;
    const avgDescendants = ancestorDescendantData.reduce((sum, node) => sum + node.descendantCount, 0) / ancestorDescendantData.length;

    return [
      { metric: 'Total Iteration Sets', value: data.iteration_sets_count },
      { metric: 'Largest Set Size', value: maxSetSize },
      { metric: 'Average Set Size', value: avgSetSize.toFixed(2) },
      { metric: 'Max Ancestors (per node)', value: maxAncestors },
      { metric: 'Max Descendants (per node)', value: maxDescendants },
      { metric: 'Avg Ancestors (per node)', value: avgAncestors.toFixed(2) },
      { metric: 'Avg Descendants (per node)', value: avgDescendants.toFixed(2) }
    ];
  }
}