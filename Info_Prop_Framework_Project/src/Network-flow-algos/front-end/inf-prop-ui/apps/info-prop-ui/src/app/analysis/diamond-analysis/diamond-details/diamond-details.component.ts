import { Component, inject, computed, signal, OnInit, Inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

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

import { AnalysisStateService } from '../../../shared/services/analysis-state.service';
import { DiamondAnalysisService } from '../../../shared/services/diamond-analysis.service';
import {
  DiamondAnalysisResponse,
  UniqueDiamondStructure,
  SubDiamondStructure,
  DiamondDetailsData,
  NodeDetail,
  EdgeDetail,
  DiamondPattern,
  DiamondSubgraphAnalysisResponse
} from '../../../shared/models/network-analysis.models';

@Component({
  selector: 'app-diamond-details',
  standalone: true,
  imports: [
    CommonModule,
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
  private diamondAnalysisService = inject(DiamondAnalysisService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<DiamondDetailsComponent>);
  private dialogData = inject<{
    diamondId: string;
    conditioningNodes?: number[];
    joinNode?: number;
    diamondHash?: string;
    diamondAnalysisResult?: any;
    networkPath?: string;
    // All available scenario groups for dropdown selection
    reachabilityGroups?: Array<{ scenarioName: string; dataType: string; nodepriorsPath?: string; linkprobsPath?: string; networkPath?: string }>;
    activeReachabilityIndex?: number;
    capacityGroups?: Array<{ scenarioName: string; capacitiesPath?: string; networkPath?: string }>;
    cpmGroups?: Array<{ scenarioName: string; cpmPath?: string; networkPath?: string; hasTimeAnalysis?: boolean; hasCostAnalysis?: boolean }>;
    activeDataType?: 'float' | 'interval' | 'pbox';
  }>(MAT_DIALOG_DATA);

  // Core data signals — prefer data passed from parent, fall back to global state
  diamondAnalysis = computed(() => {
    // If the parent passed the diamond result directly, wrap it in the expected shape
    if (this.dialogData.diamondAnalysisResult) {
      return {
        success: true,
        message: '',
        network_name: '',
        timestamp: '',
        diamond_analysis: this.dialogData.diamondAnalysisResult
      };
    }
    return this.analysisState.diamondAnalysis();
  });
  isLoading = computed(() => !this.dialogData.diamondAnalysisResult && this.analysisState.isLoading());
  error = computed(() => !this.dialogData.diamondAnalysisResult ? this.analysisState.error() : null);

  // Component state
  diamondId = signal<string>('');
  currentView = signal<'overview' | 'nodes' | 'edges' | 'subdiamonds' | 'subgraphAnalysis' | 'visualization'>('overview');

  // Visualization state
  visualizationHighlight = signal<'all' | 'conditioning' | 'forks' | 'sources' | 'joins' | 'diamondjoin' | 'subdiamond' | 'bottlenecks'>('diamondjoin');
  visualizationGraphScope = signal<'diamond' | 'main'>('diamond');
  visualizationSelectedSubDiamondId = signal<string>('');
  visualizationZoom = signal(1.0);
  visualizationSelectedNode = signal<number | null>(null);
  visualizationHoveredNode = signal<number | null>(null);
  visualizationPanX = signal(0);
  visualizationPanY = signal(0);
  visualizationNodePositionOverrides = signal<Record<number, { x: number; y: number }>>({});
  private draggingNodeId: number | null = null;
  private draggingSvg: SVGSVGElement | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isPanning = false;
  private panningSvg: SVGSVGElement | null = null;
  private panStartMouseX = 0;
  private panStartMouseY = 0;
  private panStartX = 0;
  private panStartY = 0;

  // Subgraph analysis state
  subgraphAnalysisResult = signal<DiamondSubgraphAnalysisResponse | null>(null);
  subgraphAnalysisStatus = signal<'idle' | 'computing' | 'computed' | 'error'>('idle');
  subgraphAnalysisError = signal<string | null>(null);

  // Subgraph analysis inner tab: 0=Exact Inference, 1=Capacity, 2=CPM Time, 3=CPM Cost
  subgraphTabIndex = signal(0);

  // Scenario selection indexes into dialogData arrays
  selectedReachabilityIndex = signal(this.dialogData.activeReachabilityIndex ?? 0);
  selectedCapacityIndex = signal(0);
  selectedCpmIndex = signal(0);

  // Expose available groups to the template
  reachabilityGroups = computed(() => this.dialogData.reachabilityGroups || []);
  capacityGroups = computed(() => this.dialogData.capacityGroups || []);
  cpmGroups = computed(() => this.dialogData.cpmGroups || []);

  // Derived paths from selected scenario
  selectedNodepriorsPath = computed(() => {
    const groups = this.reachabilityGroups();
    const idx = this.selectedReachabilityIndex();
    return groups[idx]?.nodepriorsPath;
  });
  selectedLinkprobsPath = computed(() => {
    const groups = this.reachabilityGroups();
    const idx = this.selectedReachabilityIndex();
    return groups[idx]?.linkprobsPath;
  });
  selectedCapacitiesPath = computed(() => {
    const groups = this.capacityGroups();
    const idx = this.selectedCapacityIndex();
    return groups[idx]?.capacitiesPath;
  });
  selectedCpmPath = computed(() => {
    const groups = this.cpmGroups();
    const idx = this.selectedCpmIndex();
    return groups[idx]?.cpmPath;
  });

  // Subgraph analysis availability
  canRunReachability = computed(() => !!this.selectedNodepriorsPath() && !!this.selectedLinkprobsPath() && !!this.dialogData.networkPath);
  canRunCapacity = computed(() => !!this.selectedCapacitiesPath() && !!this.dialogData.networkPath);
  canRunCpm = computed(() => !!this.selectedCpmPath() && !!this.dialogData.networkPath);
  hasAnySubgraphAnalysis = computed(() => this.canRunReachability() || this.canRunCapacity() || this.canRunCpm());
  availableAnalyses = computed(() => {
    const analyses: string[] = [];
    if (this.canRunReachability()) analyses.push('reachability');
    if (this.canRunCapacity()) analyses.push('capacity');
    if (this.canRunCpm()) analyses.push('cpm');
    return analyses;
  });

  // Source nodes from diamond structure
  sourceNodes = computed((): number[] => {
    const data = this.diamondDetailsData();
    if (!data) return [];
    const diamond = data.diamond as UniqueDiamondStructure;
    return diamond.sub_sources || [];
  });

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
  minNodeCount = signal(1); // Default minimum node count for diamond filtering
  maxNodeCount = signal(100); // Default maximum node count for diamond filtering

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

    // Check for cached subgraph analysis results
    if (this.dialogData?.diamondHash) {
      const analyses = this.availableAnalyses();
      if (analyses.length > 0) {
        const cached = this.diamondAnalysisService.getSubgraphCachedResult(
          this.dialogData.diamondHash, analyses
        );
        if (cached) {
          this.subgraphAnalysisResult.set(cached);
          this.subgraphAnalysisStatus.set('computed');
        }
      }
    }
  }

  // **FIXED: Enhanced diamond details computation with proper identification**
  diamondDetailsData = computed((): DiamondDetailsData | null => {
    const analysis = this.diamondAnalysis();
    const id = this.diamondId();
    
    if (!analysis || !id) return null;

    // **FIXED: Only look for unique diamonds (root diamonds are included with isRoot flag)**
    let diamond: UniqueDiamondStructure | null = null;
    let conditioningNodes: number[] = [];
    let joinNode: number | undefined;
    let diamondHash: string | undefined;
    let displayId = '';
    let isRoot = false;
    
    // Check if it's a unique diamond (starts with "unique-")
    if (id.startsWith('unique-')) {
      const hash = id.replace('unique-', '');
      console.log('🔍 Looking for unique diamond with hash:', hash);
      console.log('🔍 Available diamonds:', Object.keys(analysis.diamond_analysis?.raw_unique_diamonds || {}));
      
      const found = analysis.diamond_analysis?.raw_unique_diamonds?.[hash];
      if (found) {
        diamond = found;
        diamondHash = hash;
        isRoot = found.is_root_diamond || false;
        conditioningNodes = found.diamond?.conditioning_nodes || [];

        // Handle different data structures for parent vs sub-diamonds
        if (found.join_node !== undefined) {
          joinNode = found.join_node;
          displayId = this.diamondAnalysisService.createDiamondIdentifier(found, true, found.join_node);
        } else {
          joinNode = found.sub_join_nodes?.[0];
          displayId = this.diamondAnalysisService.createDiamondIdentifier(found, false);
        }
      } else {
        console.error('❌ Unique diamond not found for hash:', hash);
      }
    }
    // **NEW: Check if it's a sub-diamond (starts with "sub-")
    // **REMOVED: Sub-diamond lookup logic - sub-diamonds now use unique- IDs**
    // Since sub-diamonds now have proper hash-based IDs with unique- prefix,
    // they will be found in the raw_unique_diamonds lookup above 
    else {
      console.error('❌ Invalid diamond ID format (expected unique-* or sub-*):', id);
    }
    
    if (!diamond) return null;

    // **FIXED: Use the actual isRoot value determined from the diamond type**
    // Create network subset for this diamond
    const networkSubset = this.createNetworkSubset(diamond, isRoot);
    
    // Extract sub-diamonds from the diamond structure
    const subDiamonds = this.extractSubDiamonds(diamond, isRoot);

    // Calculate structural information
    const structuralInfo = this.calculateStructuralInfo(diamond, isRoot, networkSubset);

    return {
      diamondId: id,
      displayId,
      conditioningNodes,
      joinNode,
      diamondHash,
      diamond,
      networkSubset,
      subDiamonds,
      hierarchyPath: this.hierarchyPath(),
      structuralInfo
    };
  });

  // **ENHANCED: Diamond summary with proper identification**
  diamondSummary = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return null;

    const { diamond, networkSubset, subDiamonds, conditioningNodes, joinNode, displayId, structuralInfo } = data;
    const uniqueDiamond = diamond as UniqueDiamondStructure;
    
    return {
      diamondId: data.diamondId,
      displayId: displayId, // **FIXED: Use meaningful display ID**
      conditioningNodes: conditioningNodes,
      joinNode: joinNode,
      rootNodes: uniqueDiamond.sub_sources || [],
      leafNodes: uniqueDiamond.sub_join_nodes || [],
      totalNodes: networkSubset.nodes.length,
      totalEdges: networkSubset.edges.length,
      conditioningNodesCount: conditioningNodes.length,
      bridgeEdges: networkSubset.bridgeEdges.length,
      diamondJoinEdges: networkSubset.diamondJoinEdges.length,
      pathCount: uniqueDiamond.node_count || uniqueDiamond.diamond?.node_count || 0,
      subDiamondsCount: subDiamonds.length,
      riskScore: structuralInfo.riskLevel === 'critical' ? 0.9 : 
                 structuralInfo.riskLevel === 'high' ? 0.7 :
                 structuralInfo.riskLevel === 'medium' ? 0.5 : 0.2,
      riskLevel: structuralInfo.riskLevel,
      complexity: structuralInfo.complexity,
      isBottleneck: structuralInfo.isBottleneck
    };
  });

  // **ENHANCED: Diamond insights with structural analysis**
  diamondInsights = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return [];

    const { diamond, networkSubset, subDiamonds, conditioningNodes, joinNode, displayId } = data;
    const insights: Array<{type: 'info' | 'warning' | 'success' | 'critical', message: string, detail: string}> = [];

    const uniqueDiamond = diamond as UniqueDiamondStructure;

    // **ENHANCED: Diamond identification insight with meaningful info**
    insights.push({
      type: 'info',
      message: 'Diamond Identification',
      detail: displayId
    });

    // Structure type insight
    insights.push({
      type: 'info',
      message: uniqueDiamond.is_root_diamond ? 'Unique Root Diamond Structure' : 'Unique Sub-Diamond Structure',
      detail: `Pre-computed subgraph with ${uniqueDiamond.node_count || uniqueDiamond.diamond?.node_count || 0} nodes`
    });

    // **ENHANCED: Conditioning nodes analysis with risk assessment**
    if (conditioningNodes.length === 0) {
      insights.push({
        type: 'warning',
        message: 'No Conditioning Dependencies',
        detail: 'This diamond has no conditioning dependencies - may indicate isolated structure'
      });
    } else if (conditioningNodes.length === 1) {
      insights.push({
        type: 'critical',
        message: 'Single Point of Failure',
        detail: `Single conditioning node [${conditioningNodes[0]}] creates vulnerability`
      });
    } else {
      insights.push({
        type: 'success',
        message: 'Multiple Conditioning Dependencies',
        detail: `${conditioningNodes.length} conditioning nodes: [${conditioningNodes.join(', ')}] provide redundancy`
      });
    }

    // **NEW: Network complexity analysis**
    if (uniqueDiamond.diamond) {
      const relevantNodes = uniqueDiamond.diamond.relevant_nodes?.length || 0;
      const edgeCount = uniqueDiamond.diamond.edgelist?.length || 0;
      
      if (relevantNodes > 0 && edgeCount > 0) {
        const density = edgeCount / (relevantNodes * (relevantNodes - 1));
        if (density > 0.5) {
          insights.push({
            type: 'info',
            message: 'Dense Diamond Structure',
            detail: `High connectivity with ${(density * 100).toFixed(1)}% edge density`
          });
        } else if (density < 0.2) {
          insights.push({
            type: 'warning',
            message: 'Sparse Diamond Structure',
            detail: `Low connectivity with ${(density * 100).toFixed(1)}% edge density may indicate bottlenecks`
          });
        }
      }
    }

    // **NEW: Sub-diamonds hierarchical analysis**
    if (subDiamonds.length > 0) {
      insights.push({
        type: 'success',
        message: 'Hierarchical Structure',
        detail: `Contains ${subDiamonds.length} sub-diamonds for detailed analysis`
      });
    }

    // **NEW: Risk assessment insights**
    const riskFactors = this.assessRiskFactors(data);
    if (riskFactors.length > 0) {
      insights.push({
        type: 'warning',
        message: 'Risk Factors Detected',
        detail: riskFactors.join(', ')
      });
    }

    return insights;
  });

  // Node details for table with enhanced analysis
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
        riskLevel,
        isBottleneck: inDegree === 1 || outDegree === 1,
        centrality: this.calculateNodeCentrality(nodeId, data),
        influence: this.calculateNodeInfluence(nodeId, data)
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  });

  // Edge details for table with enhanced analysis
  edgeDetails = computed((): EdgeDetail[] => {
    const data = this.diamondDetailsData();
    if (!data) return [];

    const allEdges = [
      ...data.networkSubset.edges.map(([s, t]) => ({ source: s, target: t, type: 'diamond-internal' as const })),
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
        isCritical,
        reliability: this.calculateEdgeReliability(edge.source, edge.target, data),
        capacity: this.calculateEdgeCapacity(edge.source, edge.target, data)
      };
    }).sort((a, b) => a.source - b.source || a.target - b.target);
  });

  // **Enhanced filtering and pagination computed properties remain the same**
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

  // **ENHANCED: Helper methods with improved logic**
  private createNetworkSubset(diamond: UniqueDiamondStructure, _isRoot: boolean) {
    const nodes = diamond.diamond?.relevant_nodes || diamond.sub_iteration_sets.flat();
    const edges = diamond.diamond?.edgelist || [];

    return {
      nodes,
      edges,
      conditioningNodes: diamond.diamond?.conditioning_nodes || [],
      bridgeEdges: [] as [number, number][],
      diamondJoinEdges: [] as [number, number][]
    };
  }

  private extractSubDiamonds(diamond: UniqueDiamondStructure, _isRoot: boolean): DiamondPattern[] {
    const subDiamonds: DiamondPattern[] = [];
    
    // **FIXED: Type guard for UniqueDiamondStructure with sub_diamond_structures**
    const uniqueDiamond = diamond as UniqueDiamondStructure;
    if (uniqueDiamond.sub_diamond_structures && Object.keys(uniqueDiamond.sub_diamond_structures).length > 0) {
      // This is a diamond with sub-diamonds
      Object.entries(uniqueDiamond.sub_diamond_structures).forEach(([key, subDiamondData]) => {
        const typedSubDiamondData = subDiamondData as SubDiamondStructure;
        // **FIXED: Use the proper sub_diamond_hash from backend**
        const subDiamondHash = typedSubDiamondData.sub_diamond_hash || `fallback-${key}`;
        const structuralInfo = this.diamondAnalysisService.getDiamondStructuralInfo(typedSubDiamondData, true);
        
        subDiamonds.push({
          id: `unique-${subDiamondHash}`, // **FIXED: Use proper hash-based ID**
          displayId: this.diamondAnalysisService.createDiamondIdentifier(typedSubDiamondData, true, typedSubDiamondData.join_node),
          nodeCount: structuralInfo.nodeCount,
          isRoot: true,
          complexity: this.calculateComplexity(typedSubDiamondData),
          joinNodes: [typedSubDiamondData.join_node],
          sourceNodes: structuralInfo.conditioningNodes,
          forkNodes: [],
          conditioningNodes: structuralInfo.conditioningNodes,
          joinNode: typedSubDiamondData.join_node,
          relevantNodes: structuralInfo.relevantNodes,
          edgeList: structuralInfo.edgeList,
          subDiamonds: [] // Will be populated recursively if this sub-diamond has its own sub-diamonds
        });
      });
    }
    // If this diamond has no sub_diamond_structures, it has no sub-diamonds to extract
    
    return subDiamonds;
  }

  private calculateStructuralInfo(diamond: UniqueDiamondStructure, _isRoot: boolean, networkSubset: any) {
    const nodeCount = networkSubset.nodes.length;
    const edgeCount = networkSubset.edges.length;
    const conditioningNodes = diamond.diamond?.conditioning_nodes || [];

    // Calculate complexity based on structure
    const complexity = nodeCount + edgeCount + (conditioningNodes.length * 2);
    
    // Assess risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (conditioningNodes.length === 1) riskLevel = 'critical';
    else if (conditioningNodes.length === 0) riskLevel = 'high';
    else if (nodeCount > 20 || complexity > 50) riskLevel = 'medium';

    // Check if it's a bottleneck
    const isBottleneck = conditioningNodes.length <= 1 || nodeCount < 5;

    return {
      nodeCount,
      edgeCount,
      complexity,
      riskLevel,
      isBottleneck
    };
  }

  private assessRiskFactors(data: DiamondDetailsData): string[] {
    const factors: string[] = [];
    
    if (data.conditioningNodes.length === 1) factors.push('Single point of failure');
    if (data.conditioningNodes.length === 0) factors.push('No conditioning dependencies');
    if (data.networkSubset.nodes.length < 5) factors.push('Very small structure');
    if (data.structuralInfo.complexity > 100) factors.push('High complexity');
    
    return factors;
  }

  private calculateComplexity(diamond: any): number {
    const baseComplexity = diamond.diamond?.node_count || diamond.node_count || 0;
    const edgeComplexity = diamond.diamond?.edgelist?.length || 0;
    return baseComplexity + (edgeComplexity * 0.5);
  }

  // **Enhanced node analysis methods**
  private getNodeType(nodeId: number, data: DiamondDetailsData): string {
    const types: string[] = [];
    const uniqueDiamond = data.diamond as UniqueDiamondStructure;

    if (uniqueDiamond.sub_sources.includes(nodeId)) types.push('Source');
    if (uniqueDiamond.sub_join_nodes.includes(nodeId) || uniqueDiamond.join_node === nodeId) types.push('Join');
    if (uniqueDiamond.sub_fork_nodes.includes(nodeId)) types.push('Fork');
    if (uniqueDiamond.diamond?.conditioning_nodes?.includes(nodeId)) types.push('Conditioning');
    
    return types.length > 0 ? types.join(' + ') : 'Internal';
  }

  private getNodeRole(nodeId: number, data: DiamondDetailsData): 'root' | 'leaf' | 'conditioning' | 'bridge' | 'internal' {
    const uniqueDiamond = data.diamond as UniqueDiamondStructure;

    if (uniqueDiamond.sub_sources.includes(nodeId)) return 'root';
    if (uniqueDiamond.sub_join_nodes.includes(nodeId) || uniqueDiamond.join_node === nodeId) return 'leaf';
    if (uniqueDiamond.diamond?.conditioning_nodes?.includes(nodeId)) return 'conditioning';
    
    return 'internal';
  }

  private calculateInDegree(nodeId: number, edges: [number, number][]): number {
    return edges.filter(([_, target]) => target === nodeId).length;
  }

  private calculateOutDegree(nodeId: number, edges: [number, number][]): number {
    return edges.filter(([source, _]) => source === nodeId).length;
  }

  private calculateNodePathCount(nodeId: number, data: DiamondDetailsData): number {
    // Estimate path count based on position in diamond
    const inDegree = this.calculateInDegree(nodeId, data.networkSubset.edges);
    const outDegree = this.calculateOutDegree(nodeId, data.networkSubset.edges);
    return Math.max(1, inDegree * outDegree);
  }

  private calculateNodeCentrality(nodeId: number, data: DiamondDetailsData): number {
    const inDegree = this.calculateInDegree(nodeId, data.networkSubset.edges);
    const outDegree = this.calculateOutDegree(nodeId, data.networkSubset.edges);
    return inDegree + outDegree;
  }

  private calculateNodeInfluence(nodeId: number, data: DiamondDetailsData): number {
    // Nodes closer to conditioning nodes have higher influence
    if (data.conditioningNodes.includes(nodeId)) return 100;
    if (data.joinNode === nodeId) return 80;
    return 50; // Default for internal nodes
  }

  private getNodeRiskLevel(nodeId: number, data: DiamondDetailsData): 'low' | 'medium' | 'high' | 'critical' {
    const inDegree = this.calculateInDegree(nodeId, data.networkSubset.edges);
    const outDegree = this.calculateOutDegree(nodeId, data.networkSubset.edges);
    
    if (inDegree === 1 || outDegree === 1) return 'critical';
    if (data.conditioningNodes.includes(nodeId)) return 'high';
    if (inDegree <= 2 || outDegree <= 2) return 'medium';
    return 'low';
  }

  // **Enhanced edge analysis methods**
  private getEdgeRole(source: number, target: number, data: DiamondDetailsData): string {
    if (data.networkSubset.diamondJoinEdges.some(([s, t]) => s === source && t === target)) {
      return 'Diamond Join';
    }
    if (data.conditioningNodes.includes(source)) {
      return 'Conditioning Flow';
    }
    return 'Internal Flow';
  }

  private calculateEdgePathContribution(source: number, target: number, data: DiamondDetailsData): number {
    // Higher contribution for edges from conditioning nodes
    if (data.conditioningNodes.includes(source)) return 75;
    if (data.joinNode === target) return 60;
    return 25; // Default for internal edges
  }

  private calculateEdgeReliability(source: number, target: number, data: DiamondDetailsData): number {
    // Higher reliability for edges with multiple parallel paths
    const targetInDegree = this.calculateInDegree(target, data.networkSubset.edges);
    return Math.min(100, targetInDegree * 25);
  }

  private calculateEdgeCapacity(source: number, target: number, data: DiamondDetailsData): number {
    // Simplified capacity estimation
    return 100; // Default capacity
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

  // **Event handlers remain the same but with enhanced functionality**
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' | 'nodes' | 'edges' | 'subdiamonds' | 'subgraphAnalysis' | 'visualization');
  }

  // ─── Subgraph Analysis Methods ──────────────────────────────────────────────

  runSubgraphAnalysis(analyses?: string[]): void {
    const hash = this.dialogData.diamondHash;
    if (!hash || !this.dialogData.networkPath) return;

    const analysesToRun = analyses || this.availableAnalyses();
    if (analysesToRun.length === 0) return;

    // Check cache first
    const cached = this.diamondAnalysisService.getSubgraphCachedResult(hash, analysesToRun);
    if (cached) {
      this.subgraphAnalysisResult.set(cached);
      this.subgraphAnalysisStatus.set('computed');
      // Auto-navigate to first result tab
      this.autoSelectResultTab(analysesToRun);
      return;
    }

    this.subgraphAnalysisStatus.set('computing');
    this.subgraphAnalysisError.set(null);

    this.diamondAnalysisService.analyzeDiamondSubgraph({
      networkPath: this.dialogData.networkPath,
      nodepriorsPath: this.selectedNodepriorsPath(),
      linkprobsPath: this.selectedLinkprobsPath(),
      capacitiesPath: this.selectedCapacitiesPath(),
      cpmPath: this.selectedCpmPath(),
      diamondHash: hash,
      analyses: analysesToRun
    }).subscribe({
      next: (result) => {
        this.subgraphAnalysisResult.set(result);
        this.subgraphAnalysisStatus.set('computed');
        // Auto-navigate to first result tab
        this.autoSelectResultTab(analysesToRun);
      },
      error: (err) => {
        this.subgraphAnalysisError.set(err?.error?.error || err?.message || 'Subgraph analysis failed');
        this.subgraphAnalysisStatus.set('error');
      }
    });
  }

  private autoSelectResultTab(_analyses: string[]): void {
    // Results now appear within the same tab — no navigation needed
  }

  onReachabilityGroupChange(index: number): void {
    this.selectedReachabilityIndex.set(index);
    this.subgraphAnalysisResult.set(null);
  }

  onCapacityGroupChange(index: number): void {
    this.selectedCapacityIndex.set(index);
    this.subgraphAnalysisResult.set(null);
  }

  onCpmGroupChange(index: number): void {
    this.selectedCpmIndex.set(index);
    this.subgraphAnalysisResult.set(null);
  }

  onSubgraphTabChange(index: number): void {
    this.subgraphTabIndex.set(index);
  }

  runSingleAnalysis(type: 'reachability' | 'capacity' | 'cpm'): void {
    this.runSubgraphAnalysis([type]);
  }


  // ─── Belief value formatting (handles float, interval, pbox) ────────────────

  formatBeliefValue(val: any): string {
    if (val == null) return '\u2014';
    if (typeof val === 'number') return val.toFixed(4);
    if (typeof val === 'object') {
      if (val.type === 'interval' && typeof val.lower === 'number' && typeof val.upper === 'number') {
        return `[${val.lower.toFixed(4)}, ${val.upper.toFixed(4)}]`;
      }
      if (val.type === 'pbox' && typeof val.mean_lower === 'number' && typeof val.mean_upper === 'number') {
        return `\u03BC\u2208[${val.mean_lower.toFixed(4)}, ${val.mean_upper.toFixed(4)}]`;
      }
    }
    return String(val);
  }

  extractNumericBelief(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'object') {
      if (val.type === 'interval') return (val.lower + val.upper) / 2;
      if (val.type === 'pbox') return (val.mean_lower + val.mean_upper) / 2;
    }
    return 0;
  }

  // ─── Exact Inference helpers ─────────────────────────────────────────────────

  getBeliefEntries(): Array<{node: string; belief: any; numericBelief: number; displayBelief: string}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.reachability_result?.beliefs) return [];
    return Object.entries(result.reachability_result.beliefs)
      .map(([node, belief]) => ({
        node,
        belief,
        numericBelief: this.extractNumericBelief(belief),
        displayBelief: this.formatBeliefValue(belief)
      }))
      .sort((a, b) => b.numericBelief - a.numericBelief);
  }

  // ─── Capacity helpers ────────────────────────────────────────────────────────

  getCapacityEntries(): Array<{node: string; flow: number; capacity: number; utilization: number; spare: number}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.capacity_result?.node_max_flows) return [];
    const maxFlows = result.capacity_result.node_max_flows;
    const capacities = result.capacity_result.node_capacities || {};
    return Object.keys(maxFlows).map(node => {
      const flow = maxFlows[node] ?? 0;
      const cap = capacities[node] ?? 0;
      return {
        node,
        flow,
        capacity: cap,
        utilization: cap > 0 ? (flow / cap) * 100 : 0,
        spare: Math.max(0, cap - flow)
      };
    }).sort((a, b) => b.flow - a.flow);
  }

  getFlowEntries(): Array<{node: string; flow: number}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.capacity_result?.node_max_flows) return [];
    return Object.entries(result.capacity_result.node_max_flows)
      .map(([node, flow]) => ({ node, flow }))
      .sort((a, b) => b.flow - a.flow);
  }

  getTotalSourceInput(): string {
    const result = this.subgraphAnalysisResult();
    const rates = result?.capacity_result?.source_rates_used || {};
    const total = Object.values(rates).reduce((sum: number, v: any) => sum + (v || 0), 0);
    return total > 0 ? total.toFixed(2) : 'N/A';
  }

  getUtilizationColor(utilization: number): string {
    if (utilization >= 90) return 'var(--error-color, #f44336)';
    if (utilization >= 70) return 'var(--warning-color, #ff9800)';
    return 'var(--success-color, #4caf50)';
  }

  // ─── CPM Time helpers ────────────────────────────────────────────────────────

  getCpmTimeEntries(): Array<{node: string; duration: number; earlyStart: number; earlyFinish: number; lateFinish: number; slack: number; isCritical: boolean}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.cpm_result?.time_result) return [];
    const tr = result.cpm_result.time_result;
    const criticalSet = new Set((tr.critical_nodes || []).map(String));
    return Object.keys(tr.node_values || {}).map(node => ({
      node,
      duration: tr.node_durations?.[node] ?? 0,
      earlyStart: tr.early_start?.[node] ?? 0,
      earlyFinish: tr.node_values?.[node] ?? 0,
      lateFinish: tr.late_finish?.[node] ?? 0,
      slack: tr.total_slack?.[node] ?? 0,
      isCritical: criticalSet.has(node)
    })).sort((a, b) => a.earlyStart - b.earlyStart);
  }

  getCriticalTimeDuration(): string {
    const result = this.subgraphAnalysisResult();
    return result?.cpm_result?.time_result?.critical_value?.toFixed(2) ?? 'N/A';
  }

  getAvgTimeSlack(): string {
    const entries = this.getCpmTimeEntries();
    if (entries.length === 0) return 'N/A';
    const sum = entries.reduce((acc, e) => acc + Math.abs(e.slack), 0);
    return (sum / entries.length).toFixed(2);
  }

  // ─── CPM Cost helpers ────────────────────────────────────────────────────────

  getCpmCostEntries(): Array<{node: string; nodeCost: number; accumulatedCost: number; slack: number; isCritical: boolean}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.cpm_result?.cost_result) return [];
    const cr = result.cpm_result.cost_result;
    const criticalSet = new Set((cr.critical_nodes || []).map(String));
    return Object.keys(cr.node_values || {}).map(node => ({
      node,
      nodeCost: cr.node_costs?.[node] ?? 0,
      accumulatedCost: cr.node_values?.[node] ?? 0,
      slack: cr.total_slack?.[node] ?? 0,
      isCritical: criticalSet.has(node)
    })).sort((a, b) => b.accumulatedCost - a.accumulatedCost);
  }

  getCriticalCostValue(): string {
    const result = this.subgraphAnalysisResult();
    return result?.cpm_result?.cost_result?.critical_value?.toFixed(2) ?? 'N/A';
  }

  getSlackColor(slack: number): string {
    if (Math.abs(slack) < 0.001) return 'var(--error-color, #f44336)';
    if (slack < 1) return 'var(--warning-color, #ff9800)';
    return 'var(--success-color, #4caf50)';
  }

  getBeliefColor(belief: number): string {
    if (belief >= 0.8) return 'var(--success-color)';
    if (belief >= 0.5) return 'var(--warning-color)';
    return 'var(--error-color)';
  }

  // ─── Visualization methods ──────────────────────────────────────────────────

  diamondGraphData = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return null;

    const { networkSubset, conditioningNodes, diamond } = data;
    const scope = this.visualizationGraphScope();
    const fullNetwork = this.analysisState.networkData();

    const allNodes = scope === 'main' && fullNetwork?.nodes?.length
      ? fullNetwork.nodes
      : networkSubset.nodes;

    const allEdges: [number, number][] = scope === 'main' && fullNetwork?.edges?.length
      ? fullNetwork.edges
      : [
          ...networkSubset.edges,
          ...networkSubset.diamondJoinEdges
        ];

    const diamondNodeSet = new Set(networkSubset.nodes);
    const diamondEdgeSet = new Set(networkSubset.edges.map(([s, t]) => `${s}-${t}`));

    // Extract actual diamond structure properties from unified unique-diamond payload
    const uniqueDiamond = diamond as UniqueDiamondStructure;
    
    // Get actual sets from the diamond structure
    const actualForkNodes = new Set(uniqueDiamond.sub_fork_nodes || []);
    const actualSourceNodes = new Set(uniqueDiamond.sub_sources || []);
    const actualJoinNodes = new Set([...(uniqueDiamond.sub_join_nodes || []), ...(uniqueDiamond.join_node !== undefined ? [uniqueDiamond.join_node] : [])]);

    // Build simple layered layout
    const nodePositions = this.computeGraphLayout(allNodes, allEdges, data);
    const positionOverrides = this.visualizationNodePositionOverrides();

    return {
      nodes: allNodes.map(nodeId => ({
        id: nodeId,
        x: positionOverrides[nodeId]?.x ?? nodePositions.get(nodeId)?.x ?? 0,
        y: positionOverrides[nodeId]?.y ?? nodePositions.get(nodeId)?.y ?? 0,
        isConditioning: conditioningNodes.includes(nodeId),
        isFork: actualForkNodes.has(nodeId),
        isSource: actualSourceNodes.has(nodeId),
        isJoin: actualJoinNodes.has(nodeId),
        isInDiamond: diamondNodeSet.has(nodeId)
      })),
      edges: allEdges.map(([source, target]) => ({
        source,
        target,
        isDiamondJoin: networkSubset.diamondJoinEdges.some(([s, t]) => s === source && t === target),
        isInDiamond: diamondEdgeSet.has(`${source}-${target}`)
      }))
    };
  });

  selectedVisualizationSubDiamond = computed(() => {
    const data = this.diamondDetailsData();
    if (!data) return null;
    const selectedId = this.visualizationSelectedSubDiamondId();
    if (!selectedId) return null;
    return data.subDiamonds.find(sub => sub.id === selectedId) || null;
  });

  private computeGraphLayout(nodes: number[], edges: [number, number][], data: DiamondDetailsData): Map<number, {x: number, y: number}> {
    const positions = new Map<number, {x: number, y: number}>();
    const width = 800;
    const height = 600;
    const padding = 50;

    // Simple topological sort for layering
    const inDegree = new Map<number, number>();
    const adjList = new Map<number, number[]>();
    
    nodes.forEach(n => {
      inDegree.set(n, 0);
      adjList.set(n, []);
    });
    
    edges.forEach(([s, t]) => {
      adjList.get(s)?.push(t);
      inDegree.set(t, (inDegree.get(t) || 0) + 1);
    });

    const layers: number[][] = [];
    const queue: number[] = nodes.filter(n => (inDegree.get(n) || 0) === 0);
    const processed = new Set<number>();

    while (queue.length > 0) {
      const currentLayer = [...queue];
      layers.push(currentLayer);
      queue.length = 0;

      currentLayer.forEach(node => {
        processed.add(node);
        adjList.get(node)?.forEach(neighbor => {
          const degree = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, degree);
          if (degree === 0 && !processed.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      });
    }

    // Handle any remaining nodes (cycles)
    nodes.forEach(n => {
      if (!processed.has(n)) {
        if (layers.length === 0) layers.push([]);
        layers[layers.length - 1].push(n);
      }
    });

    // Position nodes
    const usableWidth = width - 2 * padding;
    const usableHeight = height - 2 * padding;
    const layerSpacing = layers.length > 1 ? usableWidth / (layers.length - 1) : 0;

    layers.forEach((layer, layerIdx) => {
      const nodeSpacing = layer.length > 1 ? usableHeight / (layer.length - 1) : usableHeight / 2;
      layer.forEach((node, nodeIdx) => {
        const x = padding + layerIdx * layerSpacing;
        const y = padding + (layer.length > 1 ? nodeIdx * nodeSpacing : usableHeight / 2);
        positions.set(node, { x, y });
      });
    });

    return positions;
  }

  highlightedNodes = computed(() => {
    const mode = this.visualizationHighlight();
    const graphData = this.diamondGraphData();
    const data = this.diamondDetailsData();
    if (!graphData || !data) return new Set<number>();

    switch (mode) {
      case 'conditioning':
        // Use actual conditioning nodes from diamond structure
        return new Set(data.conditioningNodes);
      case 'forks':
        // Use actual fork nodes from diamond structure
        return new Set(graphData.nodes.filter(n => n.isFork).map(n => n.id));
      case 'sources':
        // Use actual source nodes from diamond structure
        return new Set(graphData.nodes.filter(n => n.isSource).map(n => n.id));
      case 'diamondjoin': {
        const diamondJoinNodes = new Set<number>();
        data.networkSubset.diamondJoinEdges.forEach(([s, t]) => {
          diamondJoinNodes.add(s);
          diamondJoinNodes.add(t);
        });
        if (data.joinNode !== undefined) {
          diamondJoinNodes.add(data.joinNode);
        }
        return diamondJoinNodes;
      }
      case 'subdiamond': {
        const selectedSubDiamond = this.selectedVisualizationSubDiamond();
        if (!selectedSubDiamond) return new Set<number>();
        return new Set(selectedSubDiamond.relevantNodes || []);
      }
      case 'bottlenecks':
        // Use actual bottleneck flags from node analysis
        const nodeDetailsMap = this.nodeDetails();
        return new Set(nodeDetailsMap.filter(n => n.isBottleneck).map(n => n.nodeId));
      case 'joins':
        // Use actual join nodes from diamond structure
        return new Set(graphData.nodes.filter(n => n.isJoin).map(n => n.id));
      case 'all':
      default:
        if (this.visualizationGraphScope() === 'main') {
          return new Set(graphData.nodes.filter(n => n.isInDiamond).map(n => n.id));
        }
        return new Set(graphData.nodes.map(n => n.id));
    }
  });

  highlightedEdges = computed(() => {
    const mode = this.visualizationHighlight();
    const graphData = this.diamondGraphData();
    if (!graphData) return new Set<string>();

    // Only edge-specific filters should affect edge highlighting
    // Node-only filters (joins, forks, sources, conditioning, bottlenecks) should NOT highlight edges
    switch (mode) {
      case 'diamondjoin':
        return new Set(graphData.edges.filter(e => e.isDiamondJoin).map(e => `${e.source}-${e.target}`));

      case 'subdiamond':
        const selectedSubDiamond = this.selectedVisualizationSubDiamond();
        const edgeList = selectedSubDiamond?.edgeList || [];
        return new Set(edgeList.map(([s, t]) => `${s}-${t}`));

      case 'all':
        if (this.visualizationGraphScope() === 'main') {
          return new Set(graphData.edges.filter(e => e.isInDiamond).map(e => `${e.source}-${e.target}`));
        }
        return new Set(graphData.edges.map(e => `${e.source}-${e.target}`));

      // Node-only filters: joins, forks, sources, conditioning, bottlenecks
      // These should NOT highlight edges - return empty set
      case 'joins':
      case 'forks':
      case 'sources':
      case 'conditioning':
      case 'bottlenecks':
      default:
        return new Set<string>();
    }
  });

  hoverNeighborEdges = computed(() => {
    const hoveredNode = this.visualizationHoveredNode();
    const graphData = this.diamondGraphData();
    const neighborEdges = new Set<string>();

    if (hoveredNode === null || !graphData) return neighborEdges;

    for (const edge of graphData.edges) {
      if (edge.source === hoveredNode || edge.target === hoveredNode) {
        neighborEdges.add(`${edge.source}-${edge.target}`);
      }
    }

    return neighborEdges;
  });

  hoverNeighborNodes = computed(() => {
    const hoveredNode = this.visualizationHoveredNode();
    const graphData = this.diamondGraphData();
    const neighborNodes = new Set<number>();

    if (hoveredNode === null || !graphData) return neighborNodes;

    neighborNodes.add(hoveredNode);
    for (const edge of graphData.edges) {
      if (edge.source === hoveredNode) {
        neighborNodes.add(edge.target);
      }
      if (edge.target === hoveredNode) {
        neighborNodes.add(edge.source);
      }
    }

    return neighborNodes;
  });

  graphTransform = computed(() => {
    const zoom = this.visualizationZoom();
    const panX = this.visualizationPanX();
    const panY = this.visualizationPanY();
    return `translate(${panX}, ${panY}) scale(${zoom})`;
  });

  private isFilterHighlightActive(): boolean {
    return this.visualizationHighlight() !== 'all';
  }

  private getVisualizationGraphEdge(source: number, target: number) {
    return this.diamondGraphData()?.edges.find(edge => edge.source === source && edge.target === target);
  }

  getNodeFill(nodeId: number): string {
    const highlighted = this.highlightedNodes();
    const isHighlighted = highlighted.has(nodeId);

    if (!this.isFilterHighlightActive()) {
      return 'var(--viz-node-base-fill)';
    }

    if (!isHighlighted) return 'var(--viz-node-base-fill)';
    return 'var(--viz-filter-node)';
  }

  getNodeOpacity(nodeId: number): number {
    const hoveredNode = this.visualizationHoveredNode();
    if (hoveredNode === null) return 1;

    return this.hoverNeighborNodes().has(nodeId) ? 1 : 0.22;
  }

  getNodeStroke(nodeId: number): string {
    const isHighlighted = this.highlightedNodes().has(nodeId) && this.isFilterHighlightActive();
    return isHighlighted ? 'var(--viz-filter-node-stroke)' : 'var(--viz-node-base-stroke)';
  }

  getNodeStrokeWidth(nodeId: number): number {
    let width = this.highlightedNodes().has(nodeId) && this.isFilterHighlightActive() ? 1.9 : 1.1;
    const hoveredNode = this.visualizationHoveredNode();

    if (hoveredNode === nodeId) {
      width = Math.max(width, 2.4);
    } else if (hoveredNode !== null && this.hoverNeighborNodes().has(nodeId)) {
      width = Math.max(width, 1.5);
    }

    return width;
  }

  getEdgeStroke(source: number, target: number): string {
    const highlighted = this.highlightedEdges();
    const edgeId = `${source}-${target}`;
    const edge = this.getVisualizationGraphEdge(source, target);

    if (this.isFilterHighlightActive() && highlighted.has(edgeId)) {
      return 'var(--viz-filter-edge)';
    }

    if (edge?.isInDiamond || edge?.isDiamondJoin) {
      return 'var(--viz-diamond-edge)';
    }

    return 'var(--viz-edge-base)';
  }

  getEdgeOpacity(source: number, target: number): number {
    const hoveredNode = this.visualizationHoveredNode();
    if (hoveredNode === null) return 1;

    const edgeId = `${source}-${target}`;
    return this.hoverNeighborEdges().has(edgeId) ? 1 : 0.18;
  }

  getEdgeStrokeWidth(source: number, target: number): number {
    const highlighted = this.highlightedEdges();
    const edgeId = `${source}-${target}`;
    const edge = this.getVisualizationGraphEdge(source, target);
    const hoveredNode = this.visualizationHoveredNode();

    let width = 1.1;
    if (edge?.isInDiamond || edge?.isDiamondJoin) {
      width = 1.8;
    }
    if (this.isFilterHighlightActive() && highlighted.has(edgeId)) {
      width = 2.7;
    }
    if (hoveredNode !== null && this.hoverNeighborEdges().has(edgeId)) {
      width = Math.max(width, 2.2);
    }

    return width;
  }

  getEdgePath(source: number, target: number): string {
    const sourceNode = this.getVisualizationGraphNode(source);
    const targetNode = this.getVisualizationGraphNode(target);
    if (!sourceNode || !targetNode) return '';

    const sx = sourceNode.x;
    const sy = sourceNode.y;
    const tx = targetNode.x;
    const ty = targetNode.y;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nodeRadius = 10;
    const arrowLength = 9;

    const startX = sx + (dx / dist) * nodeRadius;
    const startY = sy + (dy / dist) * nodeRadius;
    const endX = tx - (dx / dist) * (nodeRadius + arrowLength);
    const endY = ty - (dy / dist) * (nodeRadius + arrowLength);
    const midX = (startX + endX) / 2;

    return `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
  }

  getEdgeArrowPoints(source: number, target: number): string {
    const sourceNode = this.getVisualizationGraphNode(source);
    const targetNode = this.getVisualizationGraphNode(target);
    if (!sourceNode || !targetNode) return '';

    const sx = sourceNode.x;
    const sy = sourceNode.y;
    const tx = targetNode.x;
    const ty = targetNode.y;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nodeRadius = 10;
    const arrowLength = 9;
    const arrowWidth = 5;

    const tipX = tx - (dx / dist) * nodeRadius;
    const tipY = ty - (dy / dist) * nodeRadius;
    const baseX = tipX - (dx / dist) * arrowLength;
    const baseY = tipY - (dy / dist) * arrowLength;
    const perpX = -dy / dist;
    const perpY = dx / dist;

    const leftX = baseX + perpX * arrowWidth;
    const leftY = baseY + perpY * arrowWidth;
    const rightX = baseX - perpX * arrowWidth;
    const rightY = baseY - perpY * arrowWidth;

    return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
  }

  getVisualizationGraphNode(nodeId: number) {
    return this.diamondGraphData()?.nodes.find(node => node.id === nodeId);
  }

  getVisualizationNodeDetail(nodeId: number) {
    return this.nodeDetails().find(node => node.nodeId === nodeId);
  }

  startNodeDrag(event: MouseEvent, nodeId: number): void {
    if (event.button !== 0) return;

    const currentNode = this.getVisualizationGraphNode(nodeId);
    if (!currentNode) return;

    const svg = this.resolveSvgFromEvent(event);
    if (!svg) return;

    const pointer = this.toGraphCoordinates(event, svg);
    this.draggingNodeId = nodeId;
    this.draggingSvg = svg;
    this.dragOffsetX = currentNode.x - pointer.x;
    this.dragOffsetY = currentNode.y - pointer.y;

    event.preventDefault();
    event.stopPropagation();
  }

  startGraphPan(event: MouseEvent): void {
    if (event.button !== 0 || this.draggingNodeId !== null) return;

    const target = event.target as Element | null;
    if (target?.closest('.graph-node')) return;

    const svg = this.resolveSvgFromEvent(event);
    if (!svg) return;

    this.isPanning = true;
    this.panningSvg = svg;
    this.panStartMouseX = event.clientX;
    this.panStartMouseY = event.clientY;
    this.panStartX = this.visualizationPanX();
    this.panStartY = this.visualizationPanY();
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  onGlobalMouseMove(event: MouseEvent): void {
    if (this.draggingNodeId !== null && this.draggingSvg) {
      const pointer = this.toGraphCoordinates(event, this.draggingSvg);
      const nextX = this.clamp(pointer.x + this.dragOffsetX, 20, 780);
      const nextY = this.clamp(pointer.y + this.dragOffsetY, 20, 580);
      const nodeId = this.draggingNodeId;

      this.visualizationNodePositionOverrides.update(prev => ({
        ...prev,
        [nodeId]: { x: nextX, y: nextY }
      }));
      return;
    }

    if (!this.isPanning || !this.panningSvg) return;

    const rect = this.panningSvg.getBoundingClientRect();
    const scaleX = rect.width > 0 ? 800 / rect.width : 1;
    const scaleY = rect.height > 0 ? 600 / rect.height : 1;
    const deltaX = (event.clientX - this.panStartMouseX) * scaleX;
    const deltaY = (event.clientY - this.panStartMouseY) * scaleY;

    this.visualizationPanX.set(this.panStartX + deltaX);
    this.visualizationPanY.set(this.panStartY + deltaY);
  }

  @HostListener('window:mouseup')
  onGlobalMouseUp(): void {
    this.draggingNodeId = null;
    this.draggingSvg = null;
    this.isPanning = false;
    this.panningSvg = null;
  }

  isGraphPanning(): boolean {
    return this.isPanning;
  }

  isNodeDragging(nodeId: number): boolean {
    return this.draggingNodeId === nodeId;
  }

  private resolveSvgFromEvent(event: MouseEvent): SVGSVGElement | null {
    const target = event.currentTarget as Element | null;
    const svg = target?.closest('svg');
    return svg instanceof SVGSVGElement ? svg : null;
  }

  private toGraphCoordinates(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    const viewWidth = 800;
    const viewHeight = 600;
    const svgX = ((event.clientX - rect.left) / rect.width) * viewWidth;
    const svgY = ((event.clientY - rect.top) / rect.height) * viewHeight;
    const zoom = this.visualizationZoom();
    const panX = this.visualizationPanX();
    const panY = this.visualizationPanY();

    return {
      x: (svgX - panX) / zoom,
      y: (svgY - panY) / zoom
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  clearVisualizationSelection(): void {
    this.visualizationSelectedNode.set(null);
  }

  setHoveredNode(nodeId: number): void {
    this.visualizationHoveredNode.set(nodeId);
  }

  clearHoveredNode(): void {
    this.visualizationHoveredNode.set(null);
  }

  setHighlightMode(mode: 'all' | 'conditioning' | 'forks' | 'sources' | 'joins' | 'diamondjoin' | 'subdiamond' | 'bottlenecks'): void {
    this.visualizationHighlight.set(mode);
    if (mode === 'subdiamond') {
      const data = this.diamondDetailsData();
      if (!this.visualizationSelectedSubDiamondId() && data?.subDiamonds?.length) {
        this.visualizationSelectedSubDiamondId.set(data.subDiamonds[0].id);
      }
    } else {
      this.visualizationSelectedSubDiamondId.set('');
    }
  }

  toggleHighlightMode(mode: 'all' | 'conditioning' | 'forks' | 'sources' | 'joins' | 'diamondjoin' | 'subdiamond' | 'bottlenecks'): void {
    const current = this.visualizationHighlight();
    if (current === mode && mode !== 'all') {
      this.setHighlightMode('all');
      return;
    }
    this.setHighlightMode(mode);
  }

  setVisualizationGraphScope(scope: 'diamond' | 'main'): void {
    this.visualizationGraphScope.set(scope);
    this.resetVisualizationZoom();
  }

  setVisualizationSubDiamond(subDiamondId: string): void {
    this.visualizationSelectedSubDiamondId.set(subDiamondId || '');
  }

  zoomInVisualization(): void {
    this.visualizationZoom.update(z => Math.min(z * 1.2, 3));
  }

  zoomOutVisualization(): void {
    this.visualizationZoom.update(z => Math.max(z / 1.2, 0.3));
  }

  resetVisualizationZoom(): void {
    this.visualizationZoom.set(1.0);
    this.visualizationPanX.set(0);
    this.visualizationPanY.set(0);
  }

  getHighlightLabel(): string {
    const mode = this.visualizationHighlight();
    switch (mode) {
      case 'all': return 'All Diamond Nodes';
      case 'conditioning': return 'Conditioning Nodes (from diamond structure)';
      case 'forks': return 'Fork Nodes (sub_fork_nodes)';
      case 'sources': return 'Source Nodes (sub_sources)';
      case 'joins': return 'Join Nodes (sub_join_nodes)';
      case 'diamondjoin': return 'Diamond Join Nodes/Edges';
      case 'subdiamond': {
        const selectedSubDiamond = this.selectedVisualizationSubDiamond();
        return selectedSubDiamond?.displayId
          ? `Sub-Diamond: ${selectedSubDiamond.displayId}`
          : 'Sub-Diamond Nodes';
      }
      case 'bottlenecks': return 'Bottleneck Nodes (from analysis)';
      default: return 'All Nodes';
    }
  }

  getFlowColor(flow: number, maxFlow: number): string {
    const ratio = maxFlow > 0 ? flow / maxFlow : 0;
    if (ratio >= 0.8) return 'var(--success-color)';
    if (ratio >= 0.5) return 'var(--warning-color)';
    return 'var(--error-color)';
  }

  getMaxFlow(): number {
    const entries = this.getFlowEntries();
    return entries.length > 0 ? Math.max(...entries.map(e => e.flow)) : 1;
  }

  getAvgBelief(): string {
    const entries = this.getBeliefEntries();
    if (entries.length === 0) return 'N/A';
    const sum = entries.reduce((acc, e) => acc + e.belief, 0);
    return (sum / entries.length).toFixed(3);
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

  setMinNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (!isNaN(value) && value >= 1) {
      this.minNodeCount.set(value);
      // Ensure min doesn't exceed max
      if (value > this.maxNodeCount()) {
        this.maxNodeCount.set(value);
      }
    }
  }

  setMaxNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (!isNaN(value) && value >= 1) {
      this.maxNodeCount.set(value);
      // Ensure max doesn't go below min
      if (value < this.minNodeCount()) {
        this.minNodeCount.set(value);
      }
    }
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