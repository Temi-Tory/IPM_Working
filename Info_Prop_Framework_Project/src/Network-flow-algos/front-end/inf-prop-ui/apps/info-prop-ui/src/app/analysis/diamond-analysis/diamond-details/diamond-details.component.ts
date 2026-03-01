import { Component, inject, computed, signal, OnInit, Inject } from '@angular/core';
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
  RootDiamondStructure,
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
  currentView = signal<'overview' | 'nodes' | 'edges' | 'subdiamonds' | 'subgraphAnalysis'>('overview');

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

  // ─── Editable source value overrides per analysis type ───────────────────────
  private reachabilityPriorOverrides = signal<Map<number, number>>(new Map());
  private capacityRateOverrides = signal<Map<number, number>>(new Map());
  private cpmTimeOverrides = signal<Map<number, number>>(new Map());
  private cpmCostOverrides = signal<Map<number, number>>(new Map());

  // Source nodes from diamond structure
  sourceNodes = computed((): number[] => {
    const data = this.diamondDetailsData();
    if (!data) return [];
    const diamond = data.diamond as UniqueDiamondStructure;
    return diamond.sub_sources || [];
  });

  // Exact Inference source priors (probability 0–1) — defaults from backend source_priors
  reachabilitySourceEntries = computed(() => {
    const sources = this.sourceNodes();
    const overrides = this.reachabilityPriorOverrides();
    const result = this.subgraphAnalysisResult();
    const defaults = result?.diamond_info?.source_priors || {};
    return sources.map(node => ({
      node,
      value: overrides.get(node) ?? defaults[node.toString()] ?? 1.0
    }));
  });

  // Capacity source rates — defaults from backend source_rates_used
  capacitySourceEntries = computed(() => {
    const sources = this.sourceNodes();
    const overrides = this.capacityRateOverrides();
    const result = this.subgraphAnalysisResult();
    const defaults = result?.capacity_result?.source_rates_used || {};
    return sources.map(node => ({
      node,
      value: overrides.get(node) ?? defaults[node.toString()] ?? 1.0
    }));
  });

  // CPM Time — source durations
  cpmTimeSourceEntries = computed(() => {
    const sources = this.sourceNodes();
    const overrides = this.cpmTimeOverrides();
    const result = this.subgraphAnalysisResult();
    const defaults = result?.cpm_result?.time_result?.node_durations || {};
    return sources.map(node => ({
      node,
      value: overrides.get(node) ?? defaults[node.toString()] ?? 0.0
    }));
  });

  // CPM Cost — source costs
  cpmCostSourceEntries = computed(() => {
    const sources = this.sourceNodes();
    const overrides = this.cpmCostOverrides();
    const result = this.subgraphAnalysisResult();
    const defaults = result?.cpm_result?.cost_result?.node_costs || {};
    return sources.map(node => ({
      node,
      value: overrides.get(node) ?? defaults[node.toString()] ?? 0.0
    }));
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
    
    // Handle different diamond types
    const isRootDiamond = 'join_node' in diamond;
    const diamondData = isRootDiamond ? (diamond as RootDiamondStructure).diamond : null;
    const uniqueDiamond = !isRootDiamond ? (diamond as UniqueDiamondStructure) : null;
    
    return {
      diamondId: data.diamondId,
      displayId: displayId, // **FIXED: Use meaningful display ID**
      conditioningNodes: conditioningNodes,
      joinNode: joinNode,
      rootNodes: isRootDiamond ? [joinNode!] : (uniqueDiamond?.sub_sources || []),
      leafNodes: isRootDiamond ? [joinNode!] : (uniqueDiamond?.sub_join_nodes || []),
      totalNodes: networkSubset.nodes.length,
      totalEdges: networkSubset.edges.length,
      conditioningNodesCount: conditioningNodes.length,
      bridgeEdges: networkSubset.bridgeEdges.length,
      diamondJoinEdges: networkSubset.diamondJoinEdges.length,
      pathCount: diamondData?.node_count || uniqueDiamond?.node_count || 0,
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

    const isRootDiamond = 'join_node' in diamond;
    const diamondData = isRootDiamond ? (diamond as RootDiamondStructure).diamond : null;
    const uniqueDiamond = !isRootDiamond ? (diamond as UniqueDiamondStructure) : null;

    // **ENHANCED: Diamond identification insight with meaningful info**
    insights.push({
      type: 'info',
      message: 'Diamond Identification',
      detail: displayId
    });

    // Structure type insight
    if (isRootDiamond) {
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
  private createNetworkSubset(diamond: RootDiamondStructure | UniqueDiamondStructure, isRoot: boolean) {
    // Extract network subset based on diamond type
    if (isRoot) {
      const rootDiamond = diamond as RootDiamondStructure;
      const nodes = rootDiamond.diamond.relevant_nodes;
      const edges = rootDiamond.diamond.edgelist;
      const conditioningNodes = rootDiamond.diamond.conditioning_nodes;
      
      return {
        nodes,
        edges,
        conditioningNodes,
        bridgeEdges: [] as [number, number][], // Would need full network to calculate
        diamondJoinEdges: [] as [number, number][] // Would need full network to calculate
      };
    } else {
      const uniqueDiamond = diamond as UniqueDiamondStructure;
      // Extract nodes from sub_iteration_sets and diamond structure
      const nodes = uniqueDiamond.diamond.relevant_nodes || uniqueDiamond.sub_iteration_sets.flat();
      const edges = uniqueDiamond.diamond.edgelist || [];
      
      return {
        nodes,
        edges,
        conditioningNodes: uniqueDiamond.diamond.conditioning_nodes || [],
        bridgeEdges: [] as [number, number][],
        diamondJoinEdges: [] as [number, number][]
      };
    }
  }

  private extractSubDiamonds(diamond: RootDiamondStructure | UniqueDiamondStructure, isRoot: boolean): DiamondPattern[] {
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

  private calculateStructuralInfo(diamond: RootDiamondStructure | UniqueDiamondStructure, isRoot: boolean, networkSubset: any) {
    const nodeCount = networkSubset.nodes.length;
    const edgeCount = networkSubset.edges.length;
    const conditioningNodes = isRoot ? 
      (diamond as RootDiamondStructure).diamond.conditioning_nodes :
      (diamond as UniqueDiamondStructure).diamond.conditioning_nodes || [];

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
    const isRoot = 'join_node' in data.diamond;
    
    if (isRoot) {
      const rootDiamond = data.diamond as RootDiamondStructure;
      if (nodeId === rootDiamond.join_node) types.push('Join');
      if (rootDiamond.diamond.conditioning_nodes.includes(nodeId)) types.push('Conditioning');
    } else {
      const uniqueDiamond = data.diamond as UniqueDiamondStructure;
      if (uniqueDiamond.sub_sources.includes(nodeId)) types.push('Source');
      if (uniqueDiamond.sub_join_nodes.includes(nodeId)) types.push('Join');
      if (uniqueDiamond.sub_fork_nodes.includes(nodeId)) types.push('Fork');
    }
    
    return types.length > 0 ? types.join(' + ') : 'Internal';
  }

  private getNodeRole(nodeId: number, data: DiamondDetailsData): 'root' | 'leaf' | 'conditioning' | 'bridge' | 'internal' {
    const isRoot = 'join_node' in data.diamond;
    
    if (isRoot) {
      const rootDiamond = data.diamond as RootDiamondStructure;
      if (nodeId === rootDiamond.join_node) return 'root';
      if (rootDiamond.diamond.conditioning_nodes.includes(nodeId)) return 'conditioning';
    } else {
      const uniqueDiamond = data.diamond as UniqueDiamondStructure;
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
    if (data.networkSubset.bridgeEdges.some(([s, t]) => s === source && t === target)) {
      return 'Bridge Connection';
    }
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
    this.currentView.set(event.value as 'overview' | 'nodes' | 'edges' | 'subdiamonds' | 'subgraphAnalysis');
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

    const sourceOverrides = this.buildSourceOverrides();

    this.diamondAnalysisService.analyzeDiamondSubgraph({
      networkPath: this.dialogData.networkPath,
      nodepriorsPath: this.selectedNodepriorsPath(),
      linkprobsPath: this.selectedLinkprobsPath(),
      capacitiesPath: this.selectedCapacitiesPath(),
      cpmPath: this.selectedCpmPath(),
      diamondHash: hash,
      analyses: analysesToRun,
      sourceOverrides: Object.keys(sourceOverrides).length > 0 ? sourceOverrides : undefined
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
    this.reachabilityPriorOverrides.set(new Map());
  }

  onCapacityGroupChange(index: number): void {
    this.selectedCapacityIndex.set(index);
    // Clear capacity-specific overrides when scenario changes
    this.capacityRateOverrides.set(new Map());
  }

  onCpmGroupChange(index: number): void {
    this.selectedCpmIndex.set(index);
    // Clear CPM-specific overrides when scenario changes
    this.cpmTimeOverrides.set(new Map());
    this.cpmCostOverrides.set(new Map());
  }

  onSubgraphTabChange(index: number): void {
    this.subgraphTabIndex.set(index);
  }

  runSingleAnalysis(type: 'reachability' | 'capacity' | 'cpm'): void {
    this.runSubgraphAnalysis([type]);
  }

  // ─── Source value override handlers ──────────────────────────────────────────
  onReachabilitySourceChange(node: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      const current = new Map(this.reachabilityPriorOverrides());
      current.set(node, value);
      this.reachabilityPriorOverrides.set(current);
    }
  }

  onCapacitySourceChange(node: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value >= 0) {
      const current = new Map(this.capacityRateOverrides());
      current.set(node, value);
      this.capacityRateOverrides.set(current);
    }
  }

  onCpmTimeSourceChange(node: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value >= 0) {
      const current = new Map(this.cpmTimeOverrides());
      current.set(node, value);
      this.cpmTimeOverrides.set(current);
    }
  }

  onCpmCostSourceChange(node: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value >= 0) {
      const current = new Map(this.cpmCostOverrides());
      current.set(node, value);
      this.cpmCostOverrides.set(current);
    }
  }

  resetReachabilityPriors(): void {
    this.reachabilityPriorOverrides.set(new Map());
  }

  resetCapacityRates(): void {
    this.capacityRateOverrides.set(new Map());
  }

  resetCpmTimeValues(): void {
    this.cpmTimeOverrides.set(new Map());
  }

  resetCpmCostValues(): void {
    this.cpmCostOverrides.set(new Map());
  }

  private buildSourceOverrides(): Record<string, Record<string, number>> {
    const sourceOverrides: Record<string, Record<string, number>> = {};

    if (this.reachabilityPriorOverrides().size > 0) {
      const priors: Record<string, number> = {};
      for (const [node, value] of this.reachabilityPriorOverrides()) {
        priors[node.toString()] = value;
      }
      sourceOverrides['reachability'] = priors;
    }

    if (this.capacityRateOverrides().size > 0) {
      const rates: Record<string, number> = {};
      for (const [node, value] of this.capacityRateOverrides()) {
        rates[node.toString()] = value;
      }
      sourceOverrides['capacity'] = rates;
    }

    if (this.cpmTimeOverrides().size > 0) {
      const durations: Record<string, number> = {};
      for (const [node, value] of this.cpmTimeOverrides()) {
        durations[node.toString()] = value;
      }
      sourceOverrides['cpm_time'] = durations;
    }

    if (this.cpmCostOverrides().size > 0) {
      const costs: Record<string, number> = {};
      for (const [node, value] of this.cpmCostOverrides()) {
        costs[node.toString()] = value;
      }
      sourceOverrides['cpm_cost'] = costs;
    }

    return sourceOverrides;
  }

  // ─── Exact Inference helpers ─────────────────────────────────────────────────

  getBeliefEntries(): Array<{node: string; belief: number}> {
    const result = this.subgraphAnalysisResult();
    if (!result?.reachability_result?.beliefs) return [];
    return Object.entries(result.reachability_result.beliefs)
      .map(([node, belief]) => ({ node, belief }))
      .sort((a, b) => b.belief - a.belief);
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