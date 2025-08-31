import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FormsModule } from '@angular/forms';

import { UniqueDiamondStructure, BeliefValue } from '../../shared/models/network-analysis.models';

interface UniqueDiamondDialogData {
  diamond: UniqueDiamondStructure;
  diamondHash: string;
}

interface SubNodeRow {
  node: number;
  type: string;
  inDegree: number;
  outDegree: number;
  prior?: BeliefValue;
  iterationSet: number;
}

interface SubEdgeRow {
  source: number;
  target: number;
  type: string;
  probability?: BeliefValue;
}

interface SubDiamondRow {
  hash: string;
  nodeCount: number;
  isRoot: boolean;
}

@Component({
  selector: 'app-unique-diamond-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatTabsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    FormsModule
  ],
  templateUrl: './unique-diamond-dialog.component.html',
  styleUrls: ['./unique-diamond-dialog.component.scss']
})
export class UniqueDiamondDialogComponent {
  // View state
  currentTab = signal(0);
  
  // Pagination
  nodePageSize = signal(10);
  nodePageIndex = signal(0);
  edgePageSize = signal(10);
  edgePageIndex = signal(0);

  // Filters
  nodeSearchTerm = signal('');
  edgeSearchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);
  selectedEdgeTypes = signal<string[]>([]);

  // Table columns
  nodeColumns = ['node', 'type', 'inDegree', 'outDegree', 'prior', 'iterationSet'];
  edgeColumns = ['source', 'target', 'type', 'probability'];
  subDiamondColumns = ['hash', 'nodeCount', 'isRoot', 'actions'];

  constructor(
    private dialogRef: MatDialogRef<UniqueDiamondDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UniqueDiamondDialogData
  ) {}

  // Computed properties for diamond summary
  diamondSummary = computed(() => {
    return {
      hash: this.data.diamondHash,
      nodeCount: this.data.diamond.node_count,
      isRootDiamond: this.data.diamond.is_root_diamond,
      sourcesCount: this.data.diamond.sub_sources.length,
      forksCount: this.data.diamond.sub_fork_nodes.length,
      joinsCount: this.data.diamond.sub_join_nodes.length,
      layersCount: this.data.diamond.sub_iteration_sets_count,
      priorsCount: Object.keys(this.data.diamond.sub_node_priors || {}).length
    };
  });

  // Computed properties for nodes
  subNodeDetails = computed(() => {
    const diamond = this.data.diamond;
    const allNodes = new Set<number>();
    
    // Collect all nodes from different sources
    diamond.sub_sources.forEach(n => allNodes.add(n));
    diamond.sub_fork_nodes.forEach(n => allNodes.add(n));
    diamond.sub_join_nodes.forEach(n => allNodes.add(n));
    Object.keys(diamond.sub_outgoing_index).forEach(n => allNodes.add(parseInt(n)));
    Object.keys(diamond.sub_incoming_index).forEach(n => allNodes.add(parseInt(n)));

    return Array.from(allNodes).map(nodeId => {
      const nodeType = this.getSubNodeType(nodeId);
      const inDegree = diamond.sub_incoming_index[nodeId.toString()]?.length || 0;
      const outDegree = diamond.sub_outgoing_index[nodeId.toString()]?.length || 0;
      const prior = diamond.sub_node_priors?.[nodeId.toString()];
      const iterationSet = this.getNodeIterationSet(nodeId);

      return {
        node: nodeId,
        type: nodeType,
        inDegree,
        outDegree,
        prior,
        iterationSet
      } as SubNodeRow;
    }).sort((a, b) => a.node - b.node);
  });

  // Computed properties for edges
  subEdgeDetails = computed(() => {
    const diamond = this.data.diamond;
    const edges: SubEdgeRow[] = [];

    // Build edges from outgoing index
    Object.entries(diamond.sub_outgoing_index).forEach(([source, targets]) => {
      targets.forEach(target => {
        const sourceNum = parseInt(source);
        const edgeType = this.getSubEdgeType(sourceNum, target);
        
        edges.push({
          source: sourceNum,
          target,
          type: edgeType
        });
      });
    });

    return edges.sort((a, b) => a.source - b.source || a.target - b.target);
  });

  // Filtered and paginated data for nodes
  filteredSubNodeDetails = computed(() => {
    const nodes = this.subNodeDetails();
    const searchTerm = this.nodeSearchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();

    return nodes.filter(node => {
      const matchesSearch = !searchTerm || node.node.toString().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(node.type);
      return matchesSearch && matchesType;
    });
  });

  paginatedSubNodeDetails = computed(() => {
    const filtered = this.filteredSubNodeDetails();
    const pageSize = this.nodePageSize();
    const pageIndex = this.nodePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Filtered and paginated data for edges
  filteredSubEdgeDetails = computed(() => {
    const edges = this.subEdgeDetails();
    const searchTerm = this.edgeSearchTerm().toLowerCase();
    const selectedTypes = this.selectedEdgeTypes();

    return edges.filter(edge => {
      const matchesSearch = !searchTerm || 
        edge.source.toString().includes(searchTerm) ||
        edge.target.toString().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(edge.type);
      return matchesSearch && matchesType;
    });
  });

  paginatedSubEdgeDetails = computed(() => {
    const filtered = this.filteredSubEdgeDetails();
    const pageSize = this.edgePageSize();
    const pageIndex = this.edgePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Diamond metrics
  diamondMetrics = computed(() => {
    const diamond = this.data.diamond;
    const nodeCount = diamond.node_count;
    const edgeCount = this.subEdgeDetails().length;
    const layerCount = diamond.sub_iteration_sets_count;
    
    const edgeToNodeRatio = nodeCount > 0 ? (edgeCount / nodeCount).toFixed(2) : '0.00';
    const avgDegree = nodeCount > 0 ? ((edgeCount * 2) / nodeCount).toFixed(2) : '0.00';
    const layerEfficiency = layerCount > 0 ? (nodeCount / layerCount).toFixed(1) : '0.0';
    
    const boundaryNodes = diamond.sub_sources.length;
    const boundaryRatio = nodeCount > 0 ? ((boundaryNodes / nodeCount) * 100).toFixed(1) : '0.0';

    return {
      edgeToNodeRatio,
      averageDegree: avgDegree,
      layerEfficiency,
      boundaryNodeRatio: boundaryRatio
    };
  });

  // Helper methods
  private getSubNodeType(nodeId: number): string {
    const diamond = this.data.diamond;
    const types: string[] = [];
    
    if (diamond.sub_sources.includes(nodeId)) types.push('Source');
    if (diamond.sub_fork_nodes.includes(nodeId)) types.push('Fork');
    if (diamond.sub_join_nodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  private getSubEdgeType(source: number, target: number): string {
    const sourceType = this.getSubNodeType(source);
    const targetType = this.getSubNodeType(target);
    
    if (sourceType.includes('Source') && targetType.includes('Join')) return 'Source→Join';
    if (sourceType.includes('Fork') && targetType.includes('Join')) return 'Fork→Join';
    if (sourceType.includes('Source')) return 'Source→';
    if (targetType.includes('Join')) return '→Join';
    return 'Internal';
  }

  private getNodeIterationSet(nodeId: number): number {
    const diamond = this.data.diamond;
    
    // Find which iteration set this node belongs to
    for (let i = 0; i < diamond.sub_iteration_sets.length; i++) {
      if (diamond.sub_iteration_sets[i].includes(nodeId)) {
        return i;
      }
    }
    return -1; // Not found in any iteration set
  }

  formatBeliefValue(belief?: BeliefValue): string {
    if (!belief) return 'N/A';
    
    if (typeof belief === 'number') {
      return belief.toFixed(4);
    }
    
    if (typeof belief === 'object') {
      if ('lower' in belief && 'upper' in belief) {
        return `[${belief.lower.toFixed(3)}, ${belief.upper.toFixed(3)}]`;
      }
      if ('type' in belief && belief.type === 'pbox') {
        return `PBox(${belief.mean_lower?.toFixed(3)}, ${belief.mean_upper?.toFixed(3)})`;
      }
    }
    
    return 'Complex';
  }

  formatDiamondHash(hash: string): string {
    return hash.substring(0, 12) + '...';
  }

  // Event handlers
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
    this.nodePageIndex.set(0);
  }

  onEdgeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.edgeSearchTerm.set(target.value);
    this.edgePageIndex.set(0);
  }

  onNodeTypeFilter(types: string[]): void {
    this.selectedNodeTypes.set(types);
    this.nodePageIndex.set(0);
  }

  onEdgeTypeFilter(types: string[]): void {
    this.selectedEdgeTypes.set(types);
    this.edgePageIndex.set(0);
  }

  // Navigation methods
  navigateToNode(nodeId: number): void {
    console.log('Navigate to node:', nodeId);
    // Could implement node detail view or highlight in network
  }

  navigateToSubDiamond(diamondHash: string): void {
    this.dialogRef.close({ navigateToDiamond: diamondHash });
  }

  viewFullNetwork(): void {
    this.dialogRef.close({ viewFullNetwork: true });
  }

  close(): void {
    this.dialogRef.close();
  }
}