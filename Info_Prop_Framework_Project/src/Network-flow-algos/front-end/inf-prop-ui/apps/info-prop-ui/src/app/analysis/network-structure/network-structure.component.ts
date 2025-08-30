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
        // Ensure uploaded data summary is populated
        this.ensureUploadedDataSummary(data);
        this.networkDialogService.setNetworkData(data);
      }
    });
  }

  /**
   * Ensure uploaded data summary is populated for display
   */
  private ensureUploadedDataSummary(data: NetworkStructure): void {
    if (!data.uploaded_data_summary && data.uploaded_data) {
      console.log('🔧 [NetworkStructureComponent] Generating missing uploaded_data_summary');
      
      const availableTypes: string[] = [];
      let hasNodePriors = false;
      let hasEdgeProbabilities = false;
      let hasCapacities = false;
      let hasCmpData = false;

      // Check float data
      if (data.uploaded_data.float) {
        availableTypes.push('Float');
        if (data.uploaded_data.float.node_priors) hasNodePriors = true;
        if (data.uploaded_data.float.edge_probabilities) hasEdgeProbabilities = true;
      }

      // Check interval data
      if (data.uploaded_data.interval) {
        availableTypes.push('Interval');
        if (data.uploaded_data.interval.node_priors) hasNodePriors = true;
        if (data.uploaded_data.interval.edge_probabilities) hasEdgeProbabilities = true;
      }

      // Check pbox data
      if (data.uploaded_data.pbox) {
        availableTypes.push('P-Box');
        if (data.uploaded_data.pbox.node_priors) hasNodePriors = true;
        if (data.uploaded_data.pbox.edge_probabilities) hasEdgeProbabilities = true;
      }

      // Check capacity data
      if (data.uploaded_data.capacity) {
        availableTypes.push('Capacity');
        hasCapacities = true;
      }

      // Check CPM data
      if (data.uploaded_data.cpm) {
        availableTypes.push('CPM');
        hasCmpData = true;
      }

      // Create the summary
      data.uploaded_data_summary = {
        available_data_types: availableTypes,
        data_types_count: availableTypes.length,
        has_node_priors: hasNodePriors,
        has_edge_probabilities: hasEdgeProbabilities,
        has_capacities: hasCapacities,
        has_cmp_data: hasCmpData
      };

      console.log('✅ [NetworkStructureComponent] Generated uploaded_data_summary:', data.uploaded_data_summary);
    }
  }

  // Computed signals to prevent expression changed errors
  connectivityDistribution = computed(() => this.getConnectivityDistribution());
  networkMetrics = computed(() => this.getNetworkMetrics());
  nodeDetails = computed(() => this.getNodeDetails());
  edgeDetails = computed(() => this.getEdgeDetails());
  

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
  structuralChokepoints = computed(() => this.getStructuralChokepoints());

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

      if (quickFilters.includes('chokepoints')) {
        // Structural chokepoints: single points of control in topology
        const isChokepoint = this.isStructuralChokepoint(node.node);
        if (!isChokepoint) {
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

  getStructuralChokepoints() {
    const stats = this.degreeStatistics();
    const nodeDetails = this.getNodeDetails();

    // High connectivity threshold: above 75th percentile of total degree
    const highConnectivityThreshold = stats.totalDegree.q3;
    
    // Structural chokepoints: topology-based critical points
    const structuralChokepoints = nodeDetails.filter(node => {
      return this.isStructuralChokepoint(node.node);
    });

    // Outlier detection: nodes with degrees significantly above mean
    const outlierThreshold = stats.totalDegree.mean + (2 * this.calculateStandardDeviation(nodeDetails.map(n => n.inDegree + n.outDegree)));
    const outlierNodes = nodeDetails.filter(node => (node.inDegree + node.outDegree) > outlierThreshold);

    return {
      highConnectivityThreshold,
      structuralChokepoints: structuralChokepoints.length,
      outlierNodes: outlierNodes.length,
      suggestedFilters: [
        { 
          name: `High Connectivity (≥${highConnectivityThreshold})`, 
          count: nodeDetails.filter(n => (n.inDegree + n.outDegree) >= highConnectivityThreshold).length,
          type: 'high-connectivity'
        },
        { 
          name: `Structural Chokepoints`, 
          count: structuralChokepoints.length,
          type: 'chokepoints'
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

  // Update quick filters to use structural data
  getStructuralQuickFilters() {
    const structuralChokepoints = this.structuralChokepoints();
    return structuralChokepoints.suggestedFilters.map(filter => ({
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

  // Basic structural node classification
  getBasicNodeClassifications(): {
    singleParent: any[], 
    singleChild: any[], 
    orphans: any[], 
    hubs: any[],
    counts: {
      singleParent: number,
      singleChild: number,
      orphans: number,
      hubs: number
    }
  } {
    const data = this.networkData();
    if (!data) return {
      singleParent: [],
      singleChild: [],
      orphans: [],
      hubs: [],
      counts: { singleParent: 0, singleChild: 0, orphans: 0, hubs: 0 }
    };

    const nodeDetails = this.getNodeDetails();
    
    // Calculate degree statistics for thresholds
    const degreeStats = this.calculateDegreeStatistics();
    const hubThreshold = Math.max(4, degreeStats.totalDegree.q3);
    
    // Initialize classification arrays
    const singleParent: any[] = [];
    const singleChild: any[] = [];
    const orphans: any[] = [];
    const hubs: any[] = [];

    // Classify each node based on structure only
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
    });

    return {
      singleParent: singleParent.sort((a, b) => a.nodeId - b.nodeId),
      singleChild: singleChild.sort((a, b) => a.nodeId - b.nodeId),
      orphans: orphans.sort((a, b) => a.nodeId - b.nodeId),
      hubs: hubs.sort((a, b) => b.hubScore - a.hubScore),
      counts: {
        singleParent: singleParent.length,
        singleChild: singleChild.length,
        orphans: orphans.length,
        hubs: hubs.length
      }
    };
  }



  // Simple structural helper methods
  private isStructuralChokepoint(nodeId: number): boolean {
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);
    
    // Structural chokepoint: topology-based critical point where flow must pass through
    return (inDegree === 1 && outDegree > 1) || (outDegree === 1 && inDegree > 1);
  }


  // Dialog methods
  openNodeDialog(nodeId: number): void {
    console.log('🔍 [NetworkStructureComponent] openNodeDialog called with:', {
      nodeId: nodeId,
      nodeIdType: typeof nodeId
    });

    // Validate nodeId before passing to dialog
    if (nodeId === null || nodeId === undefined || isNaN(nodeId)) {
      console.error('🚨 [NetworkStructureComponent] Invalid nodeId passed to openNodeDialog:', nodeId);
      return;
    }

    // Convert to number if needed
    const validNodeId = typeof nodeId === 'number' ? nodeId : parseInt(String(nodeId), 10);
    if (isNaN(validNodeId)) {
      console.error('🚨 [NetworkStructureComponent] Could not convert nodeId to number:', nodeId);
      return;
    }

    this.dialog.open(NodeDetailDialogComponent, {
      data: {
        nodeId: validNodeId,
        networkName: 'Current Network'
      },
      width: '800px',
      maxHeight: '90vh'
    });
  }

  openEdgeDialog(source: number, target: number): void {
    console.log('🔍 [NetworkStructureComponent] openEdgeDialog called with:', {
      source: source,
      target: target,
      sourceType: typeof source,
      targetType: typeof target
    });

    // Validate source and target before passing to dialog
    if (source === null || source === undefined || isNaN(source) ||
        target === null || target === undefined || isNaN(target)) {
      console.error('🚨 [NetworkStructureComponent] Invalid source or target passed to openEdgeDialog:', { source, target });
      return;
    }

    // Convert to numbers if needed
    const validSource = typeof source === 'number' ? source : parseInt(String(source), 10);
    const validTarget = typeof target === 'number' ? target : parseInt(String(target), 10);
    
    if (isNaN(validSource) || isNaN(validTarget)) {
      console.error('🚨 [NetworkStructureComponent] Could not convert source/target to numbers:', { source, target });
      return;
    }

    this.dialog.open(EdgeDetailDialogComponent, {
      data: {
        sourceId: validSource,
        targetId: validTarget,
        networkName: 'Current Network'
      },
      width: '700px',
      maxHeight: '90vh'
    });
  }
}