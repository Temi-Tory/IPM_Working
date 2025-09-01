import { Component, inject, computed, signal, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

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
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisResponse, RootDiamondStructure, UniqueDiamondStructure } from '../../shared/models/network-analysis.models';

interface DiamondDetailsData {
  diamondId: string;
  conditioningNodes: number[];
  joinNode?: number; // For root diamonds
  diamondHash?: string; // For unique diamonds
  diamond: RootDiamondStructure | UniqueDiamondStructure;
  networkSubset: {
    nodes: number[];
    edges: [number, number][];
    conditioningNodes: number[];
    bridgeEdges: [number, number][];
    diamondJoinEdges: [number, number][];
  };
  subDiamonds: (RootDiamondStructure | UniqueDiamondStructure)[];
  hierarchyPath: string[];
}

interface NodeDetail {
  nodeId: number;
  type: string;
  role: 'root' | 'leaf' | 'conditioning' | 'bridge' | 'internal';
  inDegree: number;
  outDegree: number;
  pathCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface EdgeDetail {
  source: number;
  target: number;
  type: 'diamond-internal' | 'bridge' | 'diamond-join' | 'conditioning';
  role: string;
  pathContribution: number;
  isCritical: boolean;
}

@Component({
  selector: 'app-diamond-details',
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
    MatExpansionModule,
    MatBadgeModule,
    MatProgressBarModule,
    FormsModule
  ],
  templateUrl: './diamond-details.component.html',
  styleUrls: ['./diamond-details.component.scss']
})
export class DiamondDetailsComponent implements OnInit {
  private analysisState = inject(AnalysisStateService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<DiamondDetailsComponent>);
  private dialogData = inject<{
    diamondId: string;
    conditioningNodes?: number[];
    joinNode?: number;
    diamondHash?: string;
  }>(MAT_DIALOG_DATA);

  // Core data signals
  diamondAnalysis = computed(() => this.analysisState.diamondAnalysis());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // Component state
  diamondId = signal<string>('');
  currentView = signal<'overview' |  'nodes' | 'edges' | 'subdiamonds'>('overview');
  
  // Pagination
  nodePageSize = signal(50);
  nodePageIndex = signal(0);
  edgePageSize = signal(100);
  edgePageIndex = signal(0);
  subDiamondPageSize = signal(25);
  subDiamondPageIndex = signal(0);

  // Filters
  nodeSearchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);
  selectedNodeRoles = signal<string[]>([]);
  edgeSearchTerm = signal('');
  selectedEdgeTypes = signal<string[]>([]);

  // Breadcrumb navigation
  hierarchyPath = signal<string[]>([]);

  // Table columns
  nodeColumns = ['node', 'type', 'role', 'inDegree', 'outDegree', 'pathCount', 'riskLevel', 'actions'];
  edgeColumns = ['source', 'target', 'type', 'role', 'pathContribution', 'critical', 'actions'];
  subDiamondColumns = ['id', 'rootNodes', 'leafNodes', 'pathCount', 'riskScore', 'actions'];

  ngOnInit() {
    // Load diamond details from injected data
    if (this.dialogData?.diamondId) {
      this.diamondId.set(this.dialogData.diamondId);
      this.loadDiamondDetails();
    }
  }

  // Computed diamond details data
  diamondDetailsData = computed((): DiamondDetailsData | null => {
    const analysis = this.diamondAnalysis();
    const id = this.diamondId();
    
    if (!analysis || !id) return null;

    // Look for diamond in both root and unique diamonds
    let diamond: RootDiamondStructure | UniqueDiamondStructure | null = null;
    let conditioningNodes: number[] = [];
    let joinNode: number | undefined;
    let diamondHash: string | undefined;
    
    // Check if it's a root diamond (starts with "root-")
    if (id.startsWith('root-')) {
      const joinNodeStr = id.replace('root-', '');
      if (analysis.diamond_analysis?.raw_root_diamonds && analysis.diamond_analysis.raw_root_diamonds[joinNodeStr]) {
        const diamondsAtNode = analysis.diamond_analysis.raw_root_diamonds[joinNodeStr];
        diamond = diamondsAtNode;
        conditioningNodes = diamondsAtNode.diamond?.conditioning_nodes || [];
        joinNode = diamondsAtNode.join_node;
      }
    }
    // Check if it's a unique diamond (starts with "unique-")
    else if (id.startsWith('unique-')) {
      const hash = id.replace('unique-', '');
      if (analysis.diamond_analysis?.raw_unique_diamonds && analysis.diamond_analysis.raw_unique_diamonds[hash]) {
        diamond = analysis.diamond_analysis.raw_unique_diamonds[hash];
        diamondHash = hash;
        // NEW: Unique diamonds now have the main diamond structure with conditioning nodes
        conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      }
    }
    
    if (!diamond) return null;

    // Create network subset for this diamond
    const networkSubset = this.createNetworkSubset(diamond);
    
    // Find sub-diamonds (simplified for now)
    const subDiamonds: (RootDiamondStructure | UniqueDiamondStructure)[] = [];

    return {
      diamondId: id,
      conditioningNodes,
      joinNode,
      diamondHash,
      diamond,
      networkSubset,
      subDiamonds,
      hierarchyPath: this.hierarchyPath()
    };
  });

  // Diamond summary metrics
  diamondSummary = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return null;

    const { diamond, networkSubset, subDiamonds, conditioningNodes, joinNode } = data;
    
    // Handle different diamond types
    const isRootDiamond = 'join_node' in diamond;
    const diamondData = isRootDiamond ? (diamond as RootDiamondStructure).diamond : null;
    const uniqueDiamond = !isRootDiamond ? (diamond as UniqueDiamondStructure) : null;
    
    // Create proper diamond identifier: conditioning nodes + join node
    const diamondIdentifier = isRootDiamond
      ? `Conditioning: [${conditioningNodes.join(', ')}] → Join: ${joinNode}`
      : `Unique Diamond: ${data.diamondId}`;
    
    return {
      diamondId: data.diamondId,
      diamondIdentifier, // NEW: Proper diamond identification
      conditioningNodes: conditioningNodes,
      joinNode: joinNode,
      rootNodes: isRootDiamond ? [joinNode] : (uniqueDiamond?.sub_sources || []),
      leafNodes: isRootDiamond ? [joinNode] : (uniqueDiamond?.sub_join_nodes || []),
      totalNodes: networkSubset.nodes.length,
      totalEdges: networkSubset.edges.length,
      conditioningNodesCount: conditioningNodes.length,
      bridgeEdges: networkSubset.bridgeEdges.length,
      diamondJoinEdges: networkSubset.diamondJoinEdges.length,
      pathCount: diamondData?.node_count || uniqueDiamond?.node_count || 0,
      subDiamondsCount: subDiamonds.length,
      riskScore: 0.5, // Placeholder - calculate based on structure
      riskLevel: this.getRiskLevel(0.5)
    };
  });

  // Diamond insights
  diamondInsights = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return [];

    const { diamond, networkSubset, subDiamonds, conditioningNodes, joinNode } = data;
    const insights: Array<{type: 'info' | 'warning' | 'success' | 'critical', message: string, detail: string}> = [];

    const isRootDiamond = 'join_node' in diamond;
    const diamondData = isRootDiamond ? (diamond as RootDiamondStructure).diamond : null;
    const uniqueDiamond = !isRootDiamond ? (diamond as UniqueDiamondStructure) : null;

    // Diamond identification insight
    if (isRootDiamond) {
      insights.push({
        type: 'info',
        message: 'Diamond Identification',
        detail: `Identified by conditioning nodes [${conditioningNodes.join(', ')}] + join node ${joinNode}`
      });
      
      insights.push({
        type: 'info',
        message: 'Root Diamond Structure',
        detail: `${diamondData?.node_count || 0} relevant nodes, ${diamondData?.edgelist?.length || 0} edges`
      });
    } else {
      insights.push({
        type: 'info',
        message: 'Unique Diamond Structure',
        detail: `Pre-computed subgraph with ${uniqueDiamond?.node_count || 0} nodes`
      });
    }

    // Conditioning nodes analysis
    if (conditioningNodes.length > 0) {
      insights.push({
        type: 'success',
        message: 'Conditioning Dependencies',
        detail: `${conditioningNodes.length} conditioning nodes: [${conditioningNodes.join(', ')}]`
      });
    } else if (isRootDiamond) {
      insights.push({
        type: 'warning',
        message: 'No Conditioning Nodes',
        detail: 'This diamond has no conditioning dependencies'
      });
    }

    // Network structure insights
    if (isRootDiamond && diamondData) {
      const relevantNodes = diamondData.relevant_nodes?.length || 0;
      const edgeCount = diamondData.edgelist?.length || 0;
      
      if (relevantNodes > 0 && edgeCount > 0) {
        const density = edgeCount / (relevantNodes * (relevantNodes - 1));
        if (density > 0.5) {
          insights.push({
            type: 'info',
            message: 'Dense Diamond Structure',
            detail: `High connectivity with ${(density * 100).toFixed(1)}% edge density`
          });
        }
      }
    }

    // Sub-diamonds analysis
    if (subDiamonds.length > 0) {
      insights.push({
        type: 'success',
        message: 'Hierarchical Structure',
        detail: `Contains ${subDiamonds.length} sub-diamonds for detailed analysis`
      });
    }

    return insights;
  });

  // Node details for table
  nodeDetails = computed((): NodeDetail[] => {
    const data = this.diamondDetailsData();
    if (!data) return [];

    return data.networkSubset.nodes.map(nodeId => {
      const nodeType = this.getNodeType(nodeId, data);
      const nodeRole = this.getNodeRole(nodeId, data);
      const inDegree = this.calculateInDegree(nodeId, data.networkSubset.edges);
      const outDegree = this.calculateOutDegree(nodeId, data.networkSubset.edges);
      const pathCount = this.calculateNodePathCount(nodeId, data);
      const riskLevel = this.getNodeRiskLevel(nodeId, data);

      return {
        nodeId,
        type: nodeType,
        role: nodeRole,
        inDegree,
        outDegree,
        pathCount,
        riskLevel
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  });

  // Edge details for table
  edgeDetails = computed((): EdgeDetail[] => {
    const data = this.diamondDetailsData();
    if (!data) return [];

    const allEdges = [
      ...data.networkSubset.edges.map(([s, t]) => ({ source: s, target: t, type: 'diamond-internal' as const })),
      ...data.networkSubset.bridgeEdges.map(([s, t]) => ({ source: s, target: t, type: 'bridge' as const })),
      ...data.networkSubset.diamondJoinEdges.map(([s, t]) => ({ source: s, target: t, type: 'diamond-join' as const }))
    ];

    return allEdges.map(edge => {
      const role = this.getEdgeRole(edge.source, edge.target, data);
      const pathContribution = this.calculateEdgePathContribution(edge.source, edge.target, data);
      const isCritical = this.isEdgeCritical(edge.source, edge.target, data);

      return {
        source: edge.source,
        target: edge.target,
        type: edge.type,
        role,
        pathContribution,
        isCritical
      };
    }).sort((a, b) => a.source - b.source || a.target - b.target);
  });

  // Filtered data
  filteredNodeDetails = computed(() => {
    const nodes = this.nodeDetails();
    const searchTerm = this.nodeSearchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();
    const selectedRoles = this.selectedNodeRoles();

    return nodes.filter(node => {
      const matchesSearch = !searchTerm || node.nodeId.toString().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(node.type);
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(node.role);
      return matchesSearch && matchesType && matchesRole;
    });
  });

  filteredEdgeDetails = computed(() => {
    const edges = this.edgeDetails();
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

  // Paginated data
  paginatedNodeDetails = computed(() => {
    const filtered = this.filteredNodeDetails();
    const pageSize = this.nodePageSize();
    const pageIndex = this.nodePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  paginatedEdgeDetails = computed(() => {
    const filtered = this.filteredEdgeDetails();
    const pageSize = this.edgePageSize();
    const pageIndex = this.edgePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  paginatedSubDiamonds = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return [];
    
    const pageSize = this.subDiamondPageSize();
    const pageIndex = this.subDiamondPageIndex();
    const start = pageIndex * pageSize;
    return data.subDiamonds.slice(start, start + pageSize);
  });

  // Helper methods
  private createNetworkSubset(diamond: RootDiamondStructure | UniqueDiamondStructure) {
    // Extract network subset based on diamond type
    const isRootDiamond = 'join_node' in diamond;
    
    if (isRootDiamond) {
      const rootDiamond = diamond as RootDiamondStructure;
      const nodes = rootDiamond.diamond.relevant_nodes;
      const edges = rootDiamond.diamond.edgelist;
      const conditioningNodes = rootDiamond.diamond.conditioning_nodes;
      
      return {
        nodes,
        edges,
        conditioningNodes,
        bridgeEdges: [] as [number, number][],
        diamondJoinEdges: [] as [number, number][]
      };
    } else {
      const uniqueDiamond = diamond as UniqueDiamondStructure;
      // Extract nodes from sub_iteration_sets
      const nodes = uniqueDiamond.sub_iteration_sets.flat();
      const edges: [number, number][] = [];
      
      return {
        nodes,
        edges,
        conditioningNodes: [] as number[],
        bridgeEdges: [] as [number, number][],
        diamondJoinEdges: [] as [number, number][]
      };
    }
  }

  private isSubDiamond(candidate: RootDiamondStructure | UniqueDiamondStructure, parent: RootDiamondStructure | UniqueDiamondStructure): boolean {
    // Simplified sub-diamond detection
    return false; // For now, return false - this would need proper implementation
  }

  private getNodeType(nodeId: number, data: DiamondDetailsData): string {
    const { diamond } = data;
    const types: string[] = [];
    const isRootDiamond = 'join_node' in diamond;
    
    if (isRootDiamond) {
      const rootDiamond = diamond as RootDiamondStructure;
      if (nodeId === rootDiamond.join_node) types.push('Join');
      if (rootDiamond.diamond.conditioning_nodes.includes(nodeId)) types.push('Conditioning');
    } else {
      const uniqueDiamond = diamond as UniqueDiamondStructure;
      if (uniqueDiamond.sub_sources.includes(nodeId)) types.push('Source');
      if (uniqueDiamond.sub_join_nodes.includes(nodeId)) types.push('Join');
      if (uniqueDiamond.sub_fork_nodes.includes(nodeId)) types.push('Fork');
    }
    
    return types.length > 0 ? types.join(' + ') : 'Internal';
  }

  private getNodeRole(nodeId: number, data: DiamondDetailsData): 'root' | 'leaf' | 'conditioning' | 'bridge' | 'internal' {
    const { diamond } = data;
    const isRootDiamond = 'join_node' in diamond;
    
    if (isRootDiamond) {
      const rootDiamond = diamond as RootDiamondStructure;
      if (nodeId === rootDiamond.join_node) return 'root';
      if (rootDiamond.diamond.conditioning_nodes.includes(nodeId)) return 'conditioning';
    } else {
      const uniqueDiamond = diamond as UniqueDiamondStructure;
      if (uniqueDiamond.sub_sources.includes(nodeId)) return 'root';
      if (uniqueDiamond.sub_join_nodes.includes(nodeId)) return 'leaf';
    }
    
    // Check if it's a bridge node (connected to bridge edges)
    const isBridge = data.networkSubset.bridgeEdges.some(([s, t]) => s === nodeId || t === nodeId);
    if (isBridge) return 'bridge';
    
    return 'internal';
  }

  private calculateInDegree(nodeId: number, edges: [number, number][]): number {
    return edges.filter(([_, target]) => target === nodeId).length;
  }

  private calculateOutDegree(nodeId: number, edges: [number, number][]): number {
    return edges.filter(([source, _]) => source === nodeId).length;
  }

  private calculateNodePathCount(nodeId: number, data: DiamondDetailsData): number {
    // Simplified path count calculation
    return Math.floor(Math.random() * 100) + 1;
  }

  private getNodeRiskLevel(nodeId: number, data: DiamondDetailsData): 'low' | 'medium' | 'high' | 'critical' {
    const inDegree = this.calculateInDegree(nodeId, data.networkSubset.edges);
    const outDegree = this.calculateOutDegree(nodeId, data.networkSubset.edges);
    
    if (inDegree === 1 || outDegree === 1) return 'critical';
    if (inDegree <= 2 || outDegree <= 2) return 'high';
    if (inDegree <= 3 || outDegree <= 3) return 'medium';
    return 'low';
  }

  private getEdgeRole(source: number, target: number, data: DiamondDetailsData): string {
    if (data.networkSubset.bridgeEdges.some(([s, t]) => s === source && t === target)) {
      return 'Bridge Connection';
    }
    if (data.networkSubset.diamondJoinEdges.some(([s, t]) => s === source && t === target)) {
      return 'Diamond Join';
    }
    return 'Internal Flow';
  }

  private calculateEdgePathContribution(source: number, target: number, data: DiamondDetailsData): number {
    // Simplified path contribution calculation
    return Math.floor(Math.random() * 50) + 1;
  }

  private isEdgeCritical(source: number, target: number, data: DiamondDetailsData): boolean {
    // An edge is critical if removing it would disconnect the diamond
    const targetInDegree = this.calculateInDegree(target, data.networkSubset.edges);
    return targetInDegree === 1;
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  private loadDiamondDetails(): void {
    // This would trigger loading of specific diamond details
    // For now, we'll use the existing diamond analysis data
  }

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' |  'nodes' | 'edges' | 'subdiamonds');
  }

  onNodePageChange(event: PageEvent): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  onEdgePageChange(event: PageEvent): void {
    this.edgePageIndex.set(event.pageIndex);
    this.edgePageSize.set(event.pageSize);
  }

  onSubDiamondPageChange(event: PageEvent): void {
    this.subDiamondPageIndex.set(event.pageIndex);
    this.subDiamondPageSize.set(event.pageSize);
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

  onNodeRoleFilter(roles: string[]): void {
    this.selectedNodeRoles.set(roles);
    this.nodePageIndex.set(0);
  }

  onEdgeTypeFilter(types: string[]): void {
    this.selectedEdgeTypes.set(types);
    this.edgePageIndex.set(0);
  }

  // Navigation methods for modal dialog
  navigateToSubDiamond(subDiamondId: string): void {
    const currentPath = this.hierarchyPath();
    this.hierarchyPath.set([...currentPath, this.diamondId()]);
    this.diamondId.set(subDiamondId);
    this.loadDiamondDetails();
  }

  navigateBack(): void {
    const currentPath = this.hierarchyPath();
    if (currentPath.length > 0) {
      const parentId = currentPath[currentPath.length - 1];
      this.hierarchyPath.set(currentPath.slice(0, -1));
      this.diamondId.set(parentId);
      this.loadDiamondDetails();
    } else {
      this.dialogRef.close();
    }
  }

  navigateToBreadcrumb(index: number): void {
    const currentPath = this.hierarchyPath();
    if (index === -1) {
      // Close dialog to return to diamond analysis overview
      this.dialogRef.close();
    } else if (index < currentPath.length) {
      const targetId = currentPath[index];
      this.hierarchyPath.set(currentPath.slice(0, index));
      this.diamondId.set(targetId);
      this.loadDiamondDetails();
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  // Modal methods
  openNodeDetailsModal(nodeId: number): void {
    // Implementation for node details modal
    console.log('Opening node details for:', nodeId);
  }

  openEdgeDetailsModal(source: number, target: number): void {
    // Implementation for edge details modal
    console.log('Opening edge details for:', source, '->', target);
  }

  retryAnalysis(): void {
    // Reload the current analysis - implementation would depend on your service
    console.log('Retrying analysis...');
  }

  getRiskLevelIcon(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
      default: return 'help';
    }
  }

  getRiskLevelColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return 'var(--error-color)';
      case 'high': return 'var(--warning-color)';
      case 'medium': return 'var(--info-color)';
      case 'low': return 'var(--success-color)';
      default: return 'var(--text-secondary)';
    }
  }
}