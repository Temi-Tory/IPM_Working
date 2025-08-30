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

    // Calculate total nodes from all unique node IDs
    const allNodes = new Set<number>();
    data.edges.forEach(([source, target]) => {
      allNodes.add(source);
      allNodes.add(target);
    });
    const totalNodes = data.total_nodes || allNodes.size;
    const totalEdges = data.total_edges || data.edges.length;

    return [
      { metric: 'Total Nodes', value: totalNodes },
      { metric: 'Total Edges', value: totalEdges },
      { metric: 'Source Nodes', value: data.source_nodes.length },
      { metric: 'Sink Nodes', value: data.sink_nodes.length },
      { metric: 'Fork Nodes', value: data.fork_nodes.length },
      { metric: 'Join Nodes', value: data.join_nodes.length },
      { metric: 'Iteration Sets', value: data.iteration_sets_count || 0 },
      { metric: 'Computation Time', value: `${data.computation_time.toFixed(4)}s` }
    ];
  }

  getNodesByType(type: 'source' | 'sink' | 'fork' | 'join'): number[] {
    const data = this.networkData();
    if (!data) return [];

    switch (type) {
      case 'source': return data.source_nodes;
      case 'sink': return data.sink_nodes;
      case 'fork': return data.fork_nodes;
      case 'join': return data.join_nodes;
      default: return [];
    }
  }

  getNodeDetails(): { node: number; type: string; inDegree: number; outDegree: number }[] {
    const data = this.networkData();
    if (!data) return [];

    // Get all unique nodes from edges if nodes array is not available
    const allNodes = new Set<number>();
    data.edges.forEach(([source, target]) => {
      allNodes.add(source);
      allNodes.add(target);
    });
    const nodes = data.nodes || Array.from(allNodes).sort((a, b) => a - b);

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

  private getNodeType(nodeId: number): string {
    const data = this.networkData();
    if (!data) return 'regular';

    if (data.source_nodes?.includes(nodeId)) return 'Source';
    if (data.sink_nodes?.includes(nodeId)) return 'Sink';
    if (data.fork_nodes?.includes(nodeId)) return 'Fork';
    if (data.join_nodes?.includes(nodeId)) return 'Join';
    return 'Regular';
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

    // Get all unique nodes from edges if nodes array is not available
    const allNodes = new Set<number>();
    data.edges.forEach(([source, target]) => {
      allNodes.add(source);
      allNodes.add(target);
    });
    const nodes = data.nodes || Array.from(allNodes);

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
}