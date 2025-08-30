import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkDialogService } from '../../shared/services/network-dialog.service';
import { NetworkStructure } from '../../shared/models/network-analysis.models';
import { NodeDetailDialogComponent, NodeDetailDialogData } from '../../shared/components/dialogs/node-detail-dialog/node-detail-dialog.component';
import { EdgeDetailDialogComponent, EdgeDetailDialogData } from '../../shared/components/dialogs/edge-detail-dialog/edge-detail-dialog.component';

@Component({
  selector: 'app-network-structure',
  standalone: true,
  imports: [
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule
],
  templateUrl: './network-structure.component.html',
  styleUrls: ['./network-structure.component.scss']
})
export class NetworkStructureComponent implements OnInit {
  private analysisState = inject(AnalysisStateService);
  private dialog = inject(MatDialog);
  private networkDialogService = inject(NetworkDialogService);

  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  constructor() {
    // Use effect to watch for network data changes
    effect(() => {
      const data = this.networkData();
      if (data) {
        this.networkDialogService.setNetworkData(data);
        // Clear computation cache when network data changes
        this.clearComputationCache();
      }
    });
  }

  // Computed signals to prevent expression changed errors
  connectivityDistribution = computed(() => this.getConnectivityDistribution());
  networkMetrics = computed(() => this.getNetworkMetrics());
  nodeDetails = computed(() => this.getNodeDetails());
  edgeDetails = computed(() => this.getEdgeDetails());
  
  // Enhanced data processing signals
  advancedNodeMetrics = computed(() => this.getAdvancedNodeMetrics());
  criticalPathAnalysis = computed(() => this.getCriticalPathAnalysis());
  structuralPatterns = computed(() => this.getStructuralPatterns());
  performanceMetrics = computed(() => this.getPerformanceMetrics());
  
  // Caching for expensive computations
  private computationCache = new Map<string, { data: any; timestamp: number; networkHash: string }>();
  private cacheTimeout = 300000; // 5 minutes

  // View toggle
  currentView = signal<'overview' | 'nodes' | 'edges' | 'structure'>('overview');

  // BI-style filtering signals
  nodeSearchTerm = signal<string>('');
  selectedNodeTypes = signal<string[]>([]);
  inDegreeRange = signal<{min: number, max: number}>({min: 0, max: 10});
  outDegreeRange = signal<{min: number, max: number}>({min: 0, max: 10});
  quickFilters = signal<string[]>([]);

  /**
   * Get icon for data type
   */
  getDataTypeIcon(dataType: string): string {
    const iconMap: Record<string, string> = {
      'float': 'decimal_increase',
      'interval': 'linear_scale',
      'pbox': 'analytics',
      'capacity': 'speed',
      'cpm': 'schedule'
    };
    return iconMap[dataType.toLowerCase()] || 'data_object';
  }

  // Data-driven filter statistics
  degreeStatistics = computed(() => this.calculateDegreeStatistics());
  dynamicFilters = computed(() => this.generateDynamicFilters());

  // Pagination signals
  nodePageSize = signal<number>(50);
  nodePageIndex = signal<number>(0);
  edgePageSize = signal<number>(100);
  edgePageIndex = signal<number>(0);
  filtersExpanded = signal<boolean>(false);

  // Filtered data computed properties
  filteredNodeDetails = computed(() => this.applyNodeFilters());
  filteredEdgeDetails = computed(() => this.applyEdgeFilters());
  
  // Paginated data computed properties
  paginatedNodeDetails = computed(() => this.getPaginatedNodes());
  paginatedEdgeDetails = computed(() => this.getPaginatedEdges());

  displayedColumns: string[] = ['metric', 'value'];
  nodeDetailsColumns: string[] = ['node', 'type', 'inDegree', 'outDegree', 'actions'];
  edgeDetailsColumns: string[] = ['source', 'target', 'edgeType', 'actions'];

  ngOnInit(): void {
    // Initialize the network dialog service with current network data
    const networkData = this.networkData();
    if (networkData) {
      this.networkDialogService.setNetworkData(networkData);
    }
  }

  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' | 'nodes' | 'edges' | 'structure');
  }

  getNetworkMetrics(): { metric: string; value: string | number }[] {
    const data = this.networkData();
    if (!data) return [];

    const multiTypeNodes = this.getMultiTypeNodes();

    return [
      { metric: 'Total Nodes', value: data.total_nodes },
      { metric: 'Total Edges', value: data.total_edges },
      { metric: 'Source Nodes', value: data.source_nodes.length },
      { metric: 'Sink Nodes', value: data.sink_nodes.length },
      { metric: 'Fork Nodes', value: data.fork_nodes.length },
      { metric: 'Join Nodes', value: data.join_nodes.length },
      { metric: 'Multi-Type Nodes', value: multiTypeNodes.length },
      { metric: 'Iteration Sets', value: data.iteration_sets_count },
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
      .filter(node => node.types.length > 1)
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

  /**
   * Get enhanced edge details with comprehensive analysis
   */
  getEnhancedEdgeDetails(): {
    source: number;
    target: number;
    edgeType: string;
    importance: 'high' | 'medium' | 'low';
    structuralRole: 'bridge' | 'redundant' | 'critical' | 'normal';
    connectionStrength: number;
    pathCriticality: number;
    flowPotential: number;
    redundancyLevel: number;
  }[] {
    const data = this.networkData();
    if (!data || !data.edges) return [];

    const cacheKey = `enhanced_edge_details_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const enhancedEdges = data.edges.map(([source, target]: [number, number]) => {
      const edgeType = this.getEdgeType(source, target);
      const importance = this.calculateEdgeImportance(source, target, data);
      const structuralRole = this.calculateEdgeStructuralRole(source, target);
      const connectionStrength = this.calculateConnectionStrength(source, target);
      const pathCriticality = this.calculateEdgePathCriticality(source, target, data);
      const flowPotential = this.calculateEdgeFlowPotential(source, target, data);
      const redundancyLevel = this.calculateEdgeRedundancy(source, target, data);

      return {
        source,
        target,
        edgeType,
        importance,
        structuralRole,
        connectionStrength,
        pathCriticality,
        flowPotential,
        redundancyLevel
      };
    }).sort((a, b) => a.source - b.source || a.target - b.target);

    this.setCachedData(cacheKey, enhancedEdges);
    return enhancedEdges;
  }

  private getNodeTypes(nodeId: number): string[] {
    const data = this.networkData();
    
    if (!data) return ['Regular'];

    const types: string[] = [];
    
    // Check all possible node types (nodes can have multiple types)
    if (data.source_nodes.includes(nodeId)) types.push('Source');
    if (data.sink_nodes.includes(nodeId)) types.push('Sink');
    if (data.fork_nodes.includes(nodeId)) types.push('Fork');
    if (data.join_nodes.includes(nodeId)) types.push('Join');
    
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

  // BI-style filtering methods
  setNodeSearchTerm(event: any): void {
    this.nodeSearchTerm.set(event.target.value);
  }

  setNodeTypeFilter(event: any): void {
    this.selectedNodeTypes.set(event.value);
  }

  setInDegreeMin(event: any): void {
    const current = this.inDegreeRange();
    this.inDegreeRange.set({...current, min: parseInt(event.target.value)});
  }

  setInDegreeMax(event: any): void {
    const current = this.inDegreeRange();
    this.inDegreeRange.set({...current, max: parseInt(event.target.value)});
  }

  setOutDegreeMin(event: any): void {
    const current = this.outDegreeRange();
    this.outDegreeRange.set({...current, min: parseInt(event.target.value)});
  }

  setOutDegreeMax(event: any): void {
    const current = this.outDegreeRange();
    this.outDegreeRange.set({...current, max: parseInt(event.target.value)});
  }

  applyQuickFilter(filterType: string): void {
    const current = this.quickFilters();
    if (current.includes(filterType)) {
      this.quickFilters.set(current.filter(f => f !== filterType));
    } else {
      this.quickFilters.set([...current, filterType]);
    }
  }

  clearAllFilters(): void {
    this.nodeSearchTerm.set('');
    this.selectedNodeTypes.set([]);
    const stats = this.degreeStatistics();
    this.inDegreeRange.set({min: stats.inDegree.min, max: stats.inDegree.max});
    this.outDegreeRange.set({min: stats.outDegree.min, max: stats.outDegree.max});
    this.quickFilters.set([]);
  }

  getMaxInDegree(): number {
    const data = this.networkData();
    if (!data) return 10;
    const degrees = data.nodes.map(nodeId => this.calculateInDegree(nodeId));
    return degrees.length > 0 ? Math.max(...degrees) : 10;
  }

  getMaxOutDegree(): number {
    const data = this.networkData();
    if (!data) return 10;
    const degrees = data.nodes.map(nodeId => this.calculateOutDegree(nodeId));
    return degrees.length > 0 ? Math.max(...degrees) : 10;
  }

  getFilteredNodeCount(): number {
    return this.filteredNodeDetails().length;
  }

  getFilteredEdgeCount(): number {
    return this.filteredEdgeDetails().length;
  }

  // Advanced filtering logic
  applyNodeFilters(): { node: number; type: string; inDegree: number; outDegree: number }[] {
    const allNodes = this.getNodeDetails();
    const searchTerm = this.nodeSearchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();
    const inRange = this.inDegreeRange();
    const outRange = this.outDegreeRange();
    const quickFilters = this.quickFilters();

    return allNodes.filter(node => {
      // Text search filter
      if (searchTerm && !(
        node.node.toString().includes(searchTerm) ||
        node.type.toLowerCase().includes(searchTerm)
      )) {
        return false;
      }

      // Node type filter
      if (selectedTypes.length > 0) {
        const nodeTypes = node.type.split(' + ');
        if (!selectedTypes.some(selectedType => nodeTypes.includes(selectedType))) {
          return false;
        }
      }

      // Degree range filters
      if (node.inDegree < inRange.min || node.inDegree > inRange.max) {
        return false;
      }
      if (node.outDegree < outRange.min || node.outDegree > outRange.max) {
        return false;
      }

      // Quick filters
      if (quickFilters.includes('high-connectivity')) {
        if (node.inDegree + node.outDegree < 4) {
          return false;
        }
      }

      if (quickFilters.includes('bottlenecks')) {
        // Nodes with high in-degree and low out-degree, or vice versa
        if (!((node.inDegree >= 2 && node.outDegree <= 1) || (node.outDegree >= 2 && node.inDegree <= 1))) {
          return false;
        }
      }

      if (quickFilters.includes('multi-type')) {
        if (!node.type.includes(' + ')) {
          return false;
        }
      }

      return true;
    });
  }

  applyEdgeFilters(): { source: number; target: number; edgeType: string }[] {
    const allEdges = this.getEdgeDetails();
    const filteredNodeIds = new Set(this.filteredNodeDetails().map(n => n.node));
    
    return allEdges.filter(edge => {
      // Only show edges where both source and target nodes are in the filtered node set
      return filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
    });
  }

  // Data-driven statistical analysis
  calculateDegreeStatistics() {
    const data = this.networkData();
    if (!data) {
      return {
        inDegree: { min: 0, max: 10, median: 2, q1: 1, q3: 4, mean: 2.5 },
        outDegree: { min: 0, max: 10, median: 2, q1: 1, q3: 4, mean: 2.5 },
        totalDegree: { min: 0, max: 20, median: 4, q1: 2, q3: 8, mean: 5 }
      };
    }

    const nodeDetails = this.getNodeDetails();
    const inDegrees = nodeDetails.map(n => n.inDegree).sort((a, b) => a - b);
    const outDegrees = nodeDetails.map(n => n.outDegree).sort((a, b) => a - b);
    const totalDegrees = nodeDetails.map(n => n.inDegree + n.outDegree).sort((a, b) => a - b);

    return {
      inDegree: this.calculateStats(inDegrees),
      outDegree: this.calculateStats(outDegrees),
      totalDegree: this.calculateStats(totalDegrees)
    };
  }

  private calculateStats(sortedArray: number[]) {
    const n = sortedArray.length;
    if (n === 0) return { min: 0, max: 0, median: 0, q1: 0, q3: 0, mean: 0 };

    const min = sortedArray[0];
    const max = sortedArray[n - 1];
    const median = n % 2 === 0 
      ? (sortedArray[Math.floor(n/2) - 1] + sortedArray[Math.floor(n/2)]) / 2
      : sortedArray[Math.floor(n/2)];
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sortedArray[q1Index];
    const q3 = sortedArray[q3Index];
    
    const mean = sortedArray.reduce((sum, val) => sum + val, 0) / n;

    return { min, max, median, q1, q3, mean };
  }

  generateDynamicFilters() {
    const stats = this.degreeStatistics();
    const nodeDetails = this.getNodeDetails();

    // High connectivity threshold: above 75th percentile of total degree
    const highConnectivityThreshold = stats.totalDegree.q3;
    
    // Bottleneck detection: nodes with degree ratios that indicate bottlenecks
    const potentialBottlenecks = nodeDetails.filter(node => {
      const ratio = node.inDegree > 0 ? node.outDegree / node.inDegree : Infinity;
      return (ratio < 0.5 && node.inDegree >= 2) || (ratio > 2 && node.outDegree >= 2);
    });

    // Critical nodes: high-degree nodes that could be critical to flow
    const criticalNodes = nodeDetails.filter(node => {
      const totalDegree = node.inDegree + node.outDegree;
      return totalDegree >= stats.totalDegree.median && (node.inDegree === 1 || node.outDegree === 1);
    });

    // Outlier detection: nodes with degrees significantly above mean
    const outlierThreshold = stats.totalDegree.mean + (2 * this.calculateStandardDeviation(nodeDetails.map(n => n.inDegree + n.outDegree)));
    const outlierNodes = nodeDetails.filter(node => (node.inDegree + node.outDegree) > outlierThreshold);

    return {
      highConnectivityThreshold,
      potentialBottlenecks: potentialBottlenecks.length,
      criticalNodes: criticalNodes.length,
      outlierNodes: outlierNodes.length,
      suggestedFilters: [
        { 
          name: `High Connectivity (≥${highConnectivityThreshold})`, 
          count: nodeDetails.filter(n => (n.inDegree + n.outDegree) >= highConnectivityThreshold).length,
          type: 'high-connectivity'
        },
        { 
          name: `Potential Bottlenecks`, 
          count: potentialBottlenecks.length,
          type: 'bottlenecks'
        },
        { 
          name: `Critical Flow Points`, 
          count: criticalNodes.length,
          type: 'critical-path'
        },
        { 
          name: `Statistical Outliers`, 
          count: outlierNodes.length,
          type: 'outliers'
        }
      ]
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // Update quick filters to use dynamic data
  getDynamicQuickFilters() {
    const dynamicFilters = this.dynamicFilters();
    return dynamicFilters.suggestedFilters.map(filter => ({
      id: filter.type,
      label: `${filter.name} (${filter.count})`,
      count: filter.count,
      enabled: filter.count > 0
    }));
  }

  // Pagination methods
  getPaginatedNodes() {
    const filtered = this.filteredNodeDetails();
    const start = this.nodePageIndex() * this.nodePageSize();
    return filtered.slice(start, start + this.nodePageSize());
  }

  getPaginatedEdges() {
    const filtered = this.filteredEdgeDetails();
    const start = this.edgePageIndex() * this.edgePageSize();
    return filtered.slice(start, start + this.edgePageSize());
  }

  onNodePageChange(event: any): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  onEdgePageChange(event: any): void {
    this.edgePageIndex.set(event.pageIndex);
    this.edgePageSize.set(event.pageSize);
  }

  toggleFiltersPanel(): void {
    this.filtersExpanded.set(!this.filtersExpanded());
  }

  // Enhanced node classification with comprehensive analysis
  getEnhancedNodeClassifications(): {
    singleParent: any[], 
    singleChild: any[], 
    orphans: any[], 
    hubs: any[], 
    bridges: any[],
    criticalPath: any[],
    bottlenecks: any[],
    chokePoints: any[],
    counts: {
      singleParent: number,
      singleChild: number,
      orphans: number,
      hubs: number,
      bridges: number,
      criticalPath: number,
      bottlenecks: number,
      chokePoints: number
    }
  } {
    const data = this.networkData();
    if (!data) return {
      singleParent: [],
      singleChild: [],
      orphans: [],
      hubs: [],
      bridges: [],
      criticalPath: [],
      bottlenecks: [],
      chokePoints: [],
      counts: { singleParent: 0, singleChild: 0, orphans: 0, hubs: 0, bridges: 0, criticalPath: 0, bottlenecks: 0, chokePoints: 0 }
    };

    const cacheKey = `enhanced_node_classifications_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const nodes = data.nodes;
    const nodeDetails = this.getNodeDetails();
    
    // Calculate degree statistics for thresholds
    const degreeStats = this.calculateDegreeStatistics();
    const hubThreshold = Math.max(4, degreeStats.totalDegree.q3);
    
    // Initialize classification arrays
    const singleParent: any[] = [];
    const singleChild: any[] = [];
    const orphans: any[] = [];
    const hubs: any[] = [];
    const bridges: any[] = [];
    const criticalPath: any[] = [];
    const bottlenecks: any[] = [];
    const chokePoints: any[] = [];

    // Classify each node
    nodeDetails.forEach(node => {
      const totalDegree = node.inDegree + node.outDegree;
      const nodeData = {
        nodeId: node.node,
        inDegree: node.inDegree,
        outDegree: node.outDegree,
        totalDegree,
        type: node.type
      };

      // Single parent (only one incoming edge)
      if (node.inDegree === 1 && node.outDegree > 0) {
        singleParent.push(nodeData);
      }

      // Single child (only one outgoing edge)
      if (node.outDegree === 1 && node.inDegree > 0) {
        singleChild.push(nodeData);
      }

      // Orphans (isolated nodes)
      if (totalDegree === 0) {
        orphans.push(nodeData);
      }

      // Hubs (high connectivity)
      if (totalDegree >= hubThreshold) {
        hubs.push({
          ...nodeData,
          hubScore: totalDegree / degreeStats.totalDegree.max
        });
      }

      // Bridges (nodes that connect different parts)
      if (this.isBridgeNode(node.node, data)) {
        bridges.push({
          ...nodeData,
          bridgeImportance: this.calculateBridgeImportance(node.node, data)
        });
      }

      // Critical path nodes
      if (this.isCriticalPathNode(node.node, data)) {
        criticalPath.push({
          ...nodeData,
          pathCriticality: this.calculatePathCriticality(node.node, data)
        });
      }

      // Bottlenecks (high in-degree, low out-degree or vice versa)
      const degreeRatio = node.inDegree > 0 ? node.outDegree / node.inDegree : Infinity;
      if ((degreeRatio < 0.5 && node.inDegree >= 2) || (degreeRatio > 2 && node.outDegree >= 2)) {
        bottlenecks.push({
          ...nodeData,
          bottleneckSeverity: Math.abs(Math.log(degreeRatio + 0.1))
        });
      }

      // Choke points (single points of failure)
      if (this.isChokePoint(node.node, data)) {
        chokePoints.push({
          ...nodeData,
          chokePointRisk: this.calculateChokePointRisk(node.node, data)
        });
      }
    });

    const result = {
      singleParent: singleParent.sort((a, b) => a.nodeId - b.nodeId),
      singleChild: singleChild.sort((a, b) => a.nodeId - b.nodeId),
      orphans: orphans.sort((a, b) => a.nodeId - b.nodeId),
      hubs: hubs.sort((a, b) => b.hubScore - a.hubScore),
      bridges: bridges.sort((a, b) => b.bridgeImportance - a.bridgeImportance),
      criticalPath: criticalPath.sort((a, b) => b.pathCriticality - a.pathCriticality),
      bottlenecks: bottlenecks.sort((a, b) => b.bottleneckSeverity - a.bottleneckSeverity),
      chokePoints: chokePoints.sort((a, b) => b.chokePointRisk - a.chokePointRisk),
      counts: {
        singleParent: singleParent.length,
        singleChild: singleChild.length,
        orphans: orphans.length,
        hubs: hubs.length,
        bridges: bridges.length,
        criticalPath: criticalPath.length,
        bottlenecks: bottlenecks.length,
        chokePoints: chokePoints.length
      }
    };

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Cache management methods
  private clearComputationCache(): void {
    this.computationCache.clear();
  }

  private getNetworkHash(data: any): string {
    // Create a simple hash of the network structure
    const nodeCount = data.nodes?.length || 0;
    const edgeCount = data.edges?.length || 0;
    const timestamp = data.computation_time || 0;
    return `${nodeCount}_${edgeCount}_${timestamp}`;
  }

  private getCachedData(key: string): any {
    const cached = this.computationCache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.computationCache.delete(key);
      return null;
    }
    
    const currentNetworkHash = this.getNetworkHash(this.networkData());
    if (cached.networkHash !== currentNetworkHash) {
      this.computationCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCachedData(key: string, data: any): void {
    const networkHash = this.getNetworkHash(this.networkData());
    this.computationCache.set(key, {
      data,
      timestamp: Date.now(),
      networkHash
    });
  }

  // Advanced node analysis methods
  getAdvancedNodeMetrics(): any {
    const data = this.networkData();
    if (!data) return null;

    const cacheKey = `advanced_node_metrics_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const nodeDetails = this.getNodeDetails();
    const classifications = this.getEnhancedNodeClassifications();
    
    const metrics = {
      totalNodes: data.nodes.length,
      classifications: classifications.counts,
      degreeDistribution: this.calculateDegreeDistribution(nodeDetails),
      connectivityMetrics: this.calculateConnectivityMetrics(nodeDetails),
      centralityMeasures: this.calculateCentralityMeasures(data),
      structuralProperties: this.calculateStructuralProperties(data)
    };

    this.setCachedData(cacheKey, metrics);
    return metrics;
  }

  getCriticalPathAnalysis(): any {
    const data = this.networkData();
    if (!data) return null;

    const cacheKey = `critical_path_analysis_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const analysis = {
      longestPaths: this.findLongestPaths(data),
      criticalNodes: this.findCriticalNodes(data),
      pathDependencies: this.analyzePathDependencies(data),
      bottleneckAnalysis: this.analyzeBottlenecks(data)
    };

    this.setCachedData(cacheKey, analysis);
    return analysis;
  }

  getStructuralPatterns(): any {
    const data = this.networkData();
    if (!data) return null;

    const cacheKey = `structural_patterns_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const patterns = {
      parallelPaths: this.findParallelPaths(data),
      convergencePoints: this.findConvergencePoints(data),
      divergencePoints: this.findDivergencePoints(data),
      cyclicPatterns: this.detectCyclicPatterns(data),
      hierarchicalLevels: this.analyzeHierarchicalLevels(data)
    };

    this.setCachedData(cacheKey, patterns);
    return patterns;
  }

  getPerformanceMetrics(): any {
    const data = this.networkData();
    if (!data) return null;

    const cacheKey = `performance_metrics_${this.getNetworkHash(data)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const startTime = performance.now();
    
    const metrics = {
      computationTime: data.computation_time,
      networkComplexity: this.calculateNetworkComplexity(data),
      scalabilityMetrics: this.calculateScalabilityMetrics(data),
      memoryUsage: this.estimateMemoryUsage(data),
      processingEfficiency: this.calculateProcessingEfficiency(data),
      analysisTime: 0
    };

    const endTime = performance.now();
    metrics.analysisTime = endTime - startTime;

    this.setCachedData(cacheKey, metrics);
    return metrics;
  }

  // Edge analysis methods
  private calculateEdgeImportance(source: number, target: number, data: any): 'high' | 'medium' | 'low' {
    const sourceOutDegree = this.calculateOutDegree(source);
    const targetInDegree = this.calculateInDegree(target);
    
    // High importance if connecting critical nodes
    if (sourceOutDegree === 1 || targetInDegree === 1) return 'high';
    if (sourceOutDegree <= 2 && targetInDegree <= 2) return 'medium';
    return 'low';
  }

  private calculateEdgeStructuralRole(source: number, target: number): 'bridge' | 'redundant' | 'critical' | 'normal' {
    const sourceOutDegree = this.calculateOutDegree(source);
    const targetInDegree = this.calculateInDegree(target);
    
    if (sourceOutDegree === 1 && targetInDegree === 1) return 'critical';
    if (sourceOutDegree === 1 || targetInDegree === 1) return 'bridge';
    if (sourceOutDegree > 3 && targetInDegree > 3) return 'redundant';
    return 'normal';
  }

  private calculateConnectionStrength(source: number, target: number): number {
    const sourceOutDegree = this.calculateOutDegree(source);
    const targetInDegree = this.calculateInDegree(target);
    
    // Strength inversely related to degree (more exclusive connections are stronger)
    return 1 / (Math.sqrt(sourceOutDegree * targetInDegree) + 1);
  }

  private calculateEdgePathCriticality(source: number, target: number, data: any): number {
    // Simple heuristic: criticality based on position in longest paths
    const sourceAncestors = data.ancestors[source.toString()]?.length || 0;
    const targetDescendants = data.descendants[target.toString()]?.length || 0;
    const maxPathLength = Math.max(...data.iteration_sets.map((set: any[]) => set.length));
    
    return (sourceAncestors + targetDescendants) / (maxPathLength * 2);
  }

  private calculateEdgeFlowPotential(source: number, target: number, data: any): number {
    // Flow potential based on network position and connectivity
    const sourceConnectivity = this.calculateInDegree(source) + this.calculateOutDegree(source);
    const targetConnectivity = this.calculateInDegree(target) + this.calculateOutDegree(target);
    const avgConnectivity = (sourceConnectivity + targetConnectivity) / 2;
    const maxConnectivity = Math.max(...data.nodes.map((n: number) =>
      this.calculateInDegree(n) + this.calculateOutDegree(n)
    ));
    
    return avgConnectivity / (maxConnectivity + 1);
  }

  private calculateEdgeRedundancy(source: number, target: number, data: any): number {
    // Calculate how many alternative paths exist between source and target
    const sourceDescendants = data.descendants[source.toString()] || [];
    const targetAncestors = data.ancestors[target.toString()] || [];
    const commonNodes = sourceDescendants.filter((n: number) => targetAncestors.includes(n));
    
    return Math.min(1, commonNodes.length / 10); // Normalize to 0-1 scale
  }

  // Node classification helper methods
  private isBridgeNode(nodeId: number, data: any): boolean {
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);
    
    // A bridge node typically has balanced in/out degrees and connects different parts
    return inDegree > 0 && outDegree > 0 && Math.abs(inDegree - outDegree) <= 1;
  }

  private calculateBridgeImportance(nodeId: number, data: any): number {
    const ancestors = data.ancestors[nodeId.toString()]?.length || 0;
    const descendants = data.descendants[nodeId.toString()]?.length || 0;
    const totalNodes = data.nodes.length;
    
    // Importance based on how many nodes this bridge connects
    return (ancestors * descendants) / (totalNodes * totalNodes);
  }

  private isCriticalPathNode(nodeId: number, data: any): boolean {
    // Node is on critical path if it's in the longest path through the network
    const ancestors = data.ancestors[nodeId.toString()]?.length || 0;
    const descendants = data.descendants[nodeId.toString()]?.length || 0;
    const maxPathLength = Math.max(...data.iteration_sets.map((set: any[]) => set.length));
    
    return (ancestors + descendants + 1) >= maxPathLength * 0.8;
  }

  private calculatePathCriticality(nodeId: number, data: any): number {
    const ancestors = data.ancestors[nodeId.toString()]?.length || 0;
    const descendants = data.descendants[nodeId.toString()]?.length || 0;
    const maxPathLength = Math.max(...data.iteration_sets.map((set: any[]) => set.length));
    
    return (ancestors + descendants + 1) / maxPathLength;
  }

  private isChokePoint(nodeId: number, data: any): boolean {
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);
    
    // Choke point: single point that many paths must go through
    return (inDegree === 1 && outDegree > 2) || (outDegree === 1 && inDegree > 2);
  }

  private calculateChokePointRisk(nodeId: number, data: any): number {
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);
    const ancestors = data.ancestors[nodeId.toString()]?.length || 0;
    const descendants = data.descendants[nodeId.toString()]?.length || 0;
    
    // Risk based on how many nodes would be affected if this choke point fails
    return (ancestors * descendants) / (data.nodes.length * data.nodes.length);
  }

  // Additional analysis methods (simplified implementations)
  private calculateDegreeDistribution(nodeDetails: any[]): any {
    const degrees = nodeDetails.map(n => n.inDegree + n.outDegree);
    const distribution: { [key: string]: number } = {};
    
    degrees.forEach(degree => {
      const bucket = Math.floor(degree / 2) * 2; // Group by 2s
      distribution[`${bucket}-${bucket + 1}`] = (distribution[`${bucket}-${bucket + 1}`] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateConnectivityMetrics(nodeDetails: any[]): any {
    const totalDegrees = nodeDetails.map(n => n.inDegree + n.outDegree);
    const avgDegree = totalDegrees.reduce((sum, d) => sum + d, 0) / totalDegrees.length;
    const maxDegree = Math.max(...totalDegrees);
    const minDegree = Math.min(...totalDegrees);
    
    return { avgDegree, maxDegree, minDegree, density: avgDegree / (nodeDetails.length - 1) };
  }

  private calculateCentralityMeasures(data: any): any {
    // Simplified centrality measures
    return {
      degreeCentrality: this.calculateDegreeCentrality(data),
      closenessCentrality: this.calculateClosenessCentrality(data),
      betweennessCentrality: this.calculateBetweennessCentrality(data)
    };
  }

  private calculateStructuralProperties(data: any): any {
    return {
      diameter: this.calculateNetworkDiameter(data),
      radius: this.calculateNetworkRadius(data),
      clustering: this.calculateClusteringCoefficient(data),
      assortativity: this.calculateAssortativity(data)
    };
  }

  // Simplified implementations for complex network analysis
  private findLongestPaths(data: any): any[] {
    return data.iteration_sets.map((set: any[], index: number) => ({
      setIndex: index,
      length: set.length,
      nodes: set
    })).sort((a: any, b: any) => b.length - a.length).slice(0, 5);
  }

  private findCriticalNodes(data: any): any[] {
    return data.nodes.filter((nodeId: number) => this.isCriticalPathNode(nodeId, data))
      .map((nodeId: number) => ({
        nodeId,
        criticality: this.calculatePathCriticality(nodeId, data)
      })).sort((a: any, b: any) => b.criticality - a.criticality);
  }

  private analyzePathDependencies(data: any): any {
    return {
      totalPaths: data.iteration_sets.length,
      avgPathLength: data.iteration_sets.reduce((sum: number, set: any[]) => sum + set.length, 0) / data.iteration_sets.length,
      maxDependency: Math.max(...data.nodes.map((n: number) => data.ancestors[n.toString()]?.length || 0))
    };
  }

  private analyzeBottlenecks(data: any): any[] {
    return data.nodes.filter((nodeId: number) => this.isChokePoint(nodeId, data))
      .map((nodeId: number) => ({
        nodeId,
        risk: this.calculateChokePointRisk(nodeId, data),
        inDegree: this.calculateInDegree(nodeId),
        outDegree: this.calculateOutDegree(nodeId)
      })).sort((a: any, b: any) => b.risk - a.risk);
  }

  private findParallelPaths(data: any): any[] {
    // Simplified: find nodes with multiple outgoing edges
    return data.nodes.filter((nodeId: number) => this.calculateOutDegree(nodeId) > 1)
      .map((nodeId: number) => ({
        nodeId,
        parallelCount: this.calculateOutDegree(nodeId)
      }));
  }

  private findConvergencePoints(data: any): any[] {
    // Nodes with multiple incoming edges
    return data.nodes.filter((nodeId: number) => this.calculateInDegree(nodeId) > 1)
      .map((nodeId: number) => ({
        nodeId,
        convergenceCount: this.calculateInDegree(nodeId)
      }));
  }

  private findDivergencePoints(data: any): any[] {
    // Same as parallel paths for DAGs
    return this.findParallelPaths(data);
  }

  private detectCyclicPatterns(data: any): any {
    // DAGs shouldn't have cycles, but we can detect potential feedback patterns
    return { cycles: [], feedbackLoops: [] };
  }

  private analyzeHierarchicalLevels(data: any): any {
    return {
      levels: data.iteration_sets.length,
      avgNodesPerLevel: data.nodes.length / data.iteration_sets.length,
      levelDistribution: data.iteration_sets.map((set: any[], index: number) => ({
        level: index,
        nodeCount: set.length
      }))
    };
  }

  private calculateNetworkComplexity(data: any): number {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;
    const iterationSets = data.iteration_sets.length;
    
    // Simple complexity measure
    return (edgeCount * iterationSets) / (nodeCount * nodeCount);
  }

  private calculateScalabilityMetrics(data: any): any {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;
    
    return {
      nodeEdgeRatio: edgeCount / nodeCount,
      density: (2 * edgeCount) / (nodeCount * (nodeCount - 1)),
      avgDegree: (2 * edgeCount) / nodeCount
    };
  }

  private estimateMemoryUsage(data: any): any {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;
    
    // Rough estimates in bytes
    return {
      nodes: nodeCount * 32, // 32 bytes per node estimate
      edges: edgeCount * 16, // 16 bytes per edge estimate
      total: (nodeCount * 32) + (edgeCount * 16)
    };
  }

  private calculateProcessingEfficiency(data: any): number {
    const nodeCount = data.nodes.length;
    const computationTime = data.computation_time;
    
    // Nodes processed per second
    return nodeCount / (computationTime + 0.001);
  }

  // Simplified centrality calculations
  private calculateDegreeCentrality(data: any): any[] {
    return data.nodes.map((nodeId: number) => ({
      nodeId,
      centrality: (this.calculateInDegree(nodeId) + this.calculateOutDegree(nodeId)) / (data.nodes.length - 1)
    })).sort((a: any, b: any) => b.centrality - a.centrality);
  }

  private calculateClosenessCentrality(data: any): any[] {
    // Simplified: use ancestor/descendant counts as proxy for distance
    return data.nodes.map((nodeId: number) => {
      const ancestors = data.ancestors[nodeId.toString()]?.length || 0;
      const descendants = data.descendants[nodeId.toString()]?.length || 0;
      const reachable = ancestors + descendants;
      return {
        nodeId,
        centrality: reachable / (data.nodes.length - 1)
      };
    }).sort((a: any, b: any) => b.centrality - a.centrality);
  }

  private calculateBetweennessCentrality(data: any): any[] {
    // Simplified: nodes that are bridges have higher betweenness
    return data.nodes.map((nodeId: number) => ({
      nodeId,
      centrality: this.isBridgeNode(nodeId, data) ? this.calculateBridgeImportance(nodeId, data) : 0
    })).sort((a: any, b: any) => b.centrality - a.centrality);
  }

  private calculateNetworkDiameter(data: any): number {
    // Maximum path length in the network
    return Math.max(...data.iteration_sets.map((set: any[]) => set.length));
  }

  private calculateNetworkRadius(data: any): number {
    // Minimum eccentricity (simplified)
    return Math.min(...data.iteration_sets.map((set: any[]) => set.length));
  }

  private calculateClusteringCoefficient(data: any): number {
    // Simplified clustering coefficient for DAG
    let totalTriangles = 0;
    let totalTriplets = 0;
    
    data.nodes.forEach((nodeId: number) => {
      const outNeighbors = data.edges
        .filter(([source]: [number, number]) => source === nodeId)
        .map(([, target]: [number, number]) => target);
      
      if (outNeighbors.length >= 2) {
        totalTriplets += outNeighbors.length * (outNeighbors.length - 1) / 2;
        
        // Count triangles (simplified)
        for (let i = 0; i < outNeighbors.length; i++) {
          for (let j = i + 1; j < outNeighbors.length; j++) {
            const hasEdge = data.edges.some(([source, target]: [number, number]) =>
              source === outNeighbors[i] && target === outNeighbors[j]
            );
            if (hasEdge) totalTriangles++;
          }
        }
      }
    });
    
    return totalTriplets > 0 ? totalTriangles / totalTriplets : 0;
  }

  private calculateAssortativity(data: any): number {
    // Simplified assortativity calculation
    let numerator = 0;
    let denominator = 0;
    const avgDegree = data.edges.length * 2 / data.nodes.length;
    
    data.edges.forEach(([source, target]: [number, number]) => {
      const sourceDegree = this.calculateInDegree(source) + this.calculateOutDegree(source);
      const targetDegree = this.calculateInDegree(target) + this.calculateOutDegree(target);
      
      numerator += (sourceDegree - avgDegree) * (targetDegree - avgDegree);
      denominator += Math.pow(sourceDegree - avgDegree, 2);
    });
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  // Dialog methods
  openNodeDialog(nodeId: number): void {
    const nodeData = this.networkDialogService.getNodeDialogData(nodeId);
    if (nodeData) {
      this.dialog.open(NodeDetailDialogComponent, {
        data: nodeData,
        width: '800px',
        maxHeight: '90vh'
      });
    }
  }

  openEdgeDialog(source: number, target: number): void {
    const edgeData = this.networkDialogService.getEdgeDialogData(source, target);
    if (edgeData) {
      this.dialog.open(EdgeDetailDialogComponent, {
        data: edgeData,
        width: '700px',
        maxHeight: '90vh'
      });
    }
  }
}