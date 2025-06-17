import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatBadgeModule } from '@angular/material/badge';

import { GraphStateService } from '../../services/graph-state-service';

interface NodeInfo {
  id: number;
  type: string;
  inDegree: number;
  outDegree: number;
  iterationLevel?: number;
}

interface EdgeInfo {
  from: number;
  to: number;
  probability: number;
}

interface DiamondInfo {
  joinNode: number;
  diamondCount: number;
  totalNodes: number;
  complexity: string;
}

@Component({
  selector: 'app-network-structure',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatExpansionModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatTableModule,
    MatBadgeModule
  ],
  templateUrl: './network-structure.html',
  styleUrl: './network-structure.scss',
})
export class NetworkStructureComponent {
  readonly graphState = inject(GraphStateService);

  // Computed properties for structural analysis
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly structure = computed(() => this.graphState.graphStructure());
  readonly nodeCount = computed(() => this.graphState.nodeCount());
  readonly edgeCount = computed(() => this.graphState.edgeCount());
  readonly sourceNodeCount = computed(() => this.graphState.sourceNodeCount());
  readonly joinNodeCount = computed(() => this.graphState.joinNodeCount());
  readonly forkNodeCount = computed(() => this.graphState.forkNodeCount());
  readonly hasDiamonds = computed(() => this.graphState.hasDiamonds());

  // Detailed structural analysis
  readonly nodeAnalysis = computed(() => {
    const structure = this.structure();
    if (!structure) return [];

    const nodes: NodeInfo[] = [];
    const allNodes = this.extractUniqueNodes(structure.edgelist);
    
    allNodes.forEach(nodeId => {
      const inDegree = structure.incoming_index[nodeId]?.length || 0;
      const outDegree = structure.outgoing_index[nodeId]?.length || 0;
      
      let type = 'Regular';
      if (structure.source_nodes.includes(nodeId)) type = 'Source';
      else if (structure.fork_nodes.includes(nodeId)) type = 'Fork';
      else if (structure.join_nodes.includes(nodeId)) type = 'Join';
      else if (inDegree === 0) type = 'Isolated';
      else if (outDegree === 0) type = 'Sink';

      // Find iteration level
      let iterationLevel: number | undefined;
      structure.iteration_sets.forEach((set, index) => {
        if (set.includes(nodeId)) {
          iterationLevel = index + 1;
        }
      });

      nodes.push({
        id: nodeId,
        type,
        inDegree,
        outDegree,
        iterationLevel
      });
    });

    return nodes.sort((a, b) => a.id - b.id);
  });

  readonly edgeAnalysis = computed(() => {
    const structure = this.structure();
    if (!structure) return [];

    return structure.edgelist.map(([from, to]) => ({
      from,
      to,
      probability: structure.edge_probabilities[`${from}-${to}`] || 
                   structure.edge_probabilities[`(${from},${to})`] || 0.9
    })).sort((a, b) => a.from - b.from || a.to - b.to);
  });

  readonly diamondAnalysis = computed(() => {
    const structure = this.structure();
    if (!structure?.diamond_structures) return [];

    const diamonds: DiamondInfo[] = [];
    
    Object.entries(structure.diamond_structures.diamondStructures || {}).forEach(([joinNodeStr, diamondData]) => {
      const joinNode = parseInt(joinNodeStr);
      const diamondCount = diamondData.diamond?.length || 0;
      
      let totalNodes = 0;
      diamondData.diamond?.forEach(diamond => {
        totalNodes += diamond.relevant_nodes?.length || 0;
        totalNodes += diamond.highest_nodes?.length || 0;
      });

      let complexity = 'Simple';
      if (diamondCount > 2) complexity = 'Complex';
      else if (totalNodes > 10) complexity = 'Large';

      diamonds.push({
        joinNode,
        diamondCount,
        totalNodes,
        complexity
      });
    });

    return diamonds.sort((a, b) => a.joinNode - b.joinNode);
  });

  readonly networkMetrics = computed(() => {
    const structure = this.structure();
    if (!structure) return null;

    const allNodes = this.extractUniqueNodes(structure.edgelist);
    const totalPossibleEdges = allNodes.length * (allNodes.length - 1);
    const density = totalPossibleEdges > 0 ? structure.edgelist.length / totalPossibleEdges : 0;

    // Calculate average degrees
    let totalInDegree = 0;
    let totalOutDegree = 0;
    allNodes.forEach(nodeId => {
      totalInDegree += structure.incoming_index[nodeId]?.length || 0;
      totalOutDegree += structure.outgoing_index[nodeId]?.length || 0;
    });

    const avgInDegree = allNodes.length > 0 ? totalInDegree / allNodes.length : 0;
    const avgOutDegree = allNodes.length > 0 ? totalOutDegree / allNodes.length : 0;

    return {
      density: density * 100,
      avgInDegree: Math.round(avgInDegree * 100) / 100,
      avgOutDegree: Math.round(avgOutDegree * 100) / 100,
      maxIterationDepth: structure.iteration_sets.length,
      diamondCount: Object.keys(structure.diamond_structures?.diamondStructures || {}).length
    };
  });

  readonly iterationSetsAnalysis = computed(() => {
    const structure = this.structure();
    if (!structure) return [];

    return structure.iteration_sets.map((set, index) => ({
      level: index + 1,
      nodeCount: set.length,
      nodes: set.sort((a, b) => a - b)
    }));
  });

  // Display columns for tables
  readonly nodeColumns = ['id', 'type', 'inDegree', 'outDegree', 'iterationLevel'];
  readonly edgeColumns = ['from', 'to', 'probability'];
  readonly diamondColumns = ['joinNode', 'diamondCount', 'totalNodes', 'complexity'];

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  getNodeTypeIcon(type: string): string {
    switch (type) {
      case 'Source': return 'play_arrow';
      case 'Sink': return 'stop';
      case 'Fork': return 'call_split';
      case 'Join': return 'call_merge';
      case 'Isolated': return 'radio_button_unchecked';
      default: return 'circle';
    }
  }

  getNodeTypeColor(type: string): string {
    switch (type) {
      case 'Source': return 'primary';
      case 'Sink': return 'accent';
      case 'Fork': return 'warn';
      case 'Join': return 'warn';
      case 'Isolated': return '';
      default: return '';
    }
  }

  getDiamondComplexityColor(complexity: string): string {
    switch (complexity) {
      case 'Simple': return 'primary';
      case 'Large': return 'accent';
      case 'Complex': return 'warn';
      default: return '';
    }
  }
}