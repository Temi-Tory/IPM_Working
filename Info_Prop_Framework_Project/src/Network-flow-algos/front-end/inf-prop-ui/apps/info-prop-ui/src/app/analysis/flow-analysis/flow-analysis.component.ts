import { Component, inject, computed, signal, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';

import * as d3 from 'd3';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { NetworkStructure, CapacityScenario, RawCapacityResult } from '../../shared/models/network-analysis.models';

interface FlowTableData {
  node: number;
  type: string;
  maxFlow: number;
  utilization: number;
  isBottleneck: boolean;
}

interface BottleneckAnalysisData {
  target: number;
  bottlenecks: any[];
  criticalPath: number[][];
  maxFlow: number;
}

interface FlowScenarioData {
  name: string;
  scenario: CapacityScenario;
  flowTableData: FlowTableData[];
  bottleneckData: BottleneckAnalysisData[];
  summaryMetrics: {
    totalInputFlow: number;
    totalOutputFlow: number;
    networkUtilization: number;
    activeSourcesCount: number;
    targetCount: number;
    nodeCapacitiesCount: number;
    edgeCapacitiesCount: number;
  };
}

interface D3CapacityNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  maxFlow: number;
  capacity: number;
  utilization: number;
  isBottleneck: boolean;
  isSource: boolean;
  isTarget: boolean;
  radius: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

interface D3CapacityLink extends d3.SimulationLinkDatum<D3CapacityNode> {
  source: string | D3CapacityNode;
  target: string | D3CapacityNode;
  id: string;
  flow: number;
  capacity: number;
  utilization: number;
  isBottleneck: boolean;
  strokeWidth: number;
  color: string;
  opacity: number;
  dashArray?: string;
}

interface CapacityVisualizationOptions {
  showFlowAnimation: boolean;
  showUtilizationOverlay: boolean;
  highlightBottlenecks: boolean;
  showCapacityLabels: boolean;
  animationSpeed: number;
}

@Component({
  selector: 'app-flow-analysis',
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
    MatExpansionModule,
    MatProgressBarModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatDividerModule,
    FormsModule
  ],
  templateUrl: './flow-analysis.component.html',
  styleUrls: ['./flow-analysis.component.scss']
})
export class FlowAnalysisComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('capacityVisualization', { static: false }) capacityVisualizationContainer!: ElementRef<HTMLDivElement>;
  private analysisState = inject(AnalysisStateService);

  // Core data signals
  networkData = computed(() => this.analysisState.networkData());
  analysisResults = computed(() => this.analysisState.analysisResults());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  currentView = signal<'overview' | 'network-capacity' | 'flow-details' | 'bottlenecks' | 'critical-paths'>('network-capacity');
  selectedScenario = signal<string>('');
  
  // Pagination
  flowPageSize = signal(50);
  flowPageIndex = signal(0);
  
  // Filters
  flowSearchTerm = signal('');
  selectedFlowTypes = signal<string[]>([]);
  
  // D3 Visualization state
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<D3CapacityNode, D3CapacityLink> | null = null;
  private nodes: D3CapacityNode[] = [];
  private links: D3CapacityLink[] = [];
  private width = 0;
  private height = 0;
  
  // Visualization options
  visualizationOptions = signal<CapacityVisualizationOptions>({
    showFlowAnimation: true,
    showUtilizationOverlay: true,
    highlightBottlenecks: true,
    showCapacityLabels: false,
    animationSpeed: 1.0
  });
  
  // Selected elements
  selectedNodeId = signal<string | null>(null);
  selectedEdgeId = signal<string | null>(null);
  
  // Color scales for capacity visualization
  private utilizationColorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([1, 0]);
  private capacityColorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);
  private flowColorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1]);

  // Table columns
  flowColumns = ['node', 'type', 'maxFlow', 'utilization', 'status'];
  
  constructor() {
    // React to scenario changes and update visualization
    effect(() => {
      const scenario = this.currentScenarioData();
      const view = this.currentView();
      if (scenario && view === 'network-capacity' && this.capacityVisualizationContainer) {
        this.initializeCapacityVisualization();
      }
    });
    
    // React to visualization options changes
    effect(() => {
      const options = this.visualizationOptions();
      if (this.svg && this.currentView() === 'network-capacity') {
        this.updateVisualizationStyles();
      }
    });
  }
  
  ngOnInit(): void {
    // Component initialization
  }
  
  ngAfterViewInit(): void {
    // Initialize visualization after view is ready
    const scenario = this.currentScenarioData();
    if (scenario && this.currentView() === 'network-capacity') {
      setTimeout(() => {
        this.initializeCapacityVisualization();
      }, 100);
    }
  }
  
  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  // Computed capacity scenarios
  capacityScenarios = computed(() => {
    const results = this.analysisResults();
    if (!results?.results?.capacity_scenarios) return {};
    return results.results.capacity_scenarios;
  });

  // Flow scenario data with enhanced processing
  flowScenarioData = computed(() => {
    const scenarios = this.capacityScenarios();
    const networkData = this.networkData();
    
    if (!scenarios || !networkData) return [];

    return Object.entries(scenarios).map(([name, scenario]) => {
      const flowTableData = this.processFlowTableData(scenario, networkData);
      const bottleneckData = this.processBottleneckData(scenario);
      const summaryMetrics = {
        totalInputFlow: scenario.total_source_input,
        totalOutputFlow: scenario.total_target_output,
        networkUtilization: scenario.network_utilization,
        activeSourcesCount: scenario.active_sources.length,
        targetCount: scenario.target_nodes.length,
        nodeCapacitiesCount: scenario.node_capacities_count,
        edgeCapacitiesCount: scenario.edge_capacities_count
      };

      return {
        name,
        scenario,
        flowTableData,
        bottleneckData,
        summaryMetrics
      } as FlowScenarioData;
    });
  });

  // Currently selected scenario data
  currentScenarioData = computed(() => {
    const scenarios = this.flowScenarioData();
    const selected = this.selectedScenario();
    
    if (!selected && scenarios.length > 0) {
      // Auto-select first scenario
      this.selectedScenario.set(scenarios[0].name);
      return scenarios[0];
    }
    
    return scenarios.find(s => s.name === selected) || scenarios[0] || null;
  });
  
  // Selected node data for capacity view
  selectedCapacityNodeData = computed(() => {
    const nodeId = this.selectedNodeId();
    const scenario = this.currentScenarioData();
    
    if (!nodeId || !scenario) return null;
    
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    // Get connected flows
    const connectedEdges = this.links.filter(link => 
      (link.source as D3CapacityNode).id === nodeId || (link.target as D3CapacityNode).id === nodeId
    );
    
    const incomingFlow = connectedEdges
      .filter(link => (link.target as D3CapacityNode).id === nodeId)
      .reduce((sum, link) => sum + link.flow, 0);
      
    const outgoingFlow = connectedEdges
      .filter(link => (link.source as D3CapacityNode).id === nodeId)
      .reduce((sum, link) => sum + link.flow, 0);
    
    return {
      ...node,
      incomingFlow,
      outgoingFlow,
      connectedEdges: connectedEdges.length,
      flowBalance: incomingFlow - outgoingFlow,
      isFlowBalanced: Math.abs(incomingFlow - outgoingFlow) < 0.001
    };
  });
  
  // Capacity visualization insights
  capacityInsights = computed(() => {
    const scenario = this.currentScenarioData();
    if (!scenario) return [];
    
    const insights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string, icon: string}> = [];
    
    const bottleneckNodes = this.nodes.filter(n => n.isBottleneck);
    const bottleneckEdges = this.links.filter(l => l.isBottleneck);
    const highUtilNodes = this.nodes.filter(n => n.utilization > 0.8);
    const highUtilEdges = this.links.filter(l => l.utilization > 0.8);
    
    // Bottleneck analysis
    if (bottleneckNodes.length > 0 || bottleneckEdges.length > 0) {
      insights.push({
        type: 'warning',
        message: `${bottleneckNodes.length + bottleneckEdges.length} Bottlenecks Detected`,
        detail: `${bottleneckNodes.length} node(s) and ${bottleneckEdges.length} edge(s) are limiting network flow`,
        icon: 'warning'
      });
    }
    
    // High utilization analysis
    if (highUtilNodes.length > 0 || highUtilEdges.length > 0) {
      insights.push({
        type: 'info',
        message: `High Utilization Elements`,
        detail: `${highUtilNodes.length} node(s) and ${highUtilEdges.length} edge(s) operating above 80% capacity`,
        icon: 'trending_up'
      });
    }
    
    // Flow distribution
    const totalFlow = this.nodes.reduce((sum, n) => sum + n.maxFlow, 0);
    if (totalFlow > 0) {
      insights.push({
        type: 'info',
        message: `Total Network Flow: ${this.formatFlow(totalFlow)}`,
        detail: `Combined flow capacity across all nodes`,
        icon: 'timeline'
      });
    }
    
    // Network efficiency
    const avgUtilization = this.nodes.length > 0 
      ? this.nodes.reduce((sum, n) => sum + n.utilization, 0) / this.nodes.length 
      : 0;
      
    if (avgUtilization > 0.7) {
      insights.push({
        type: 'warning',
        message: `High Average Utilization (${(avgUtilization * 100).toFixed(1)}%)`,
        detail: 'Network may be approaching capacity limits',
        icon: 'speed'
      });
    } else if (avgUtilization < 0.3) {
      insights.push({
        type: 'success',
        message: `Low Average Utilization (${(avgUtilization * 100).toFixed(1)}%)`,
        detail: 'Network has significant unused capacity',
        icon: 'check_circle'
      });
    }
    
    return insights;
  });

  // Network summary with flow context
  flowNetworkSummary = computed(() => {
    const scenario = this.currentScenarioData();
    if (!scenario) return null;

    const { summaryMetrics, flowTableData } = scenario;
    
    const bottleneckCount = flowTableData.filter(f => f.isBottleneck).length;
    const highUtilization = flowTableData.filter(f => f.utilization > 0.8).length;
    const lowUtilization = flowTableData.filter(f => f.utilization < 0.2 && f.utilization > 0).length;

    return {
      ...summaryMetrics,
      bottleneckCount,
      highUtilizationCount: highUtilization,
      lowUtilizationCount: lowUtilization,
      averageUtilization: flowTableData.length > 0 
        ? flowTableData.reduce((sum, f) => sum + f.utilization, 0) / flowTableData.length 
        : 0
    };
  });

  // Flow insights
  flowInsights = computed(() => {
    const summary = this.flowNetworkSummary();
    if (!summary) return [];

    const insights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string}> = [];

    // Network utilization insights
    if (summary.networkUtilization > 0.9) {
      insights.push({
        type: 'warning',
        message: `High Network Utilization (${(summary.networkUtilization * 100).toFixed(1)}%)`,
        detail: 'Network is operating near capacity - potential performance bottlenecks'
      });
    } else if (summary.networkUtilization < 0.3) {
      insights.push({
        type: 'info',
        message: `Low Network Utilization (${(summary.networkUtilization * 100).toFixed(1)}%)`,
        detail: 'Network has significant unused capacity - could handle increased load'
      });
    } else {
      insights.push({
        type: 'success',
        message: `Optimal Utilization (${(summary.networkUtilization * 100).toFixed(1)}%)`,
        detail: 'Network operating within efficient capacity range'
      });
    }

    // Bottleneck analysis
    if (summary.bottleneckCount > 0) {
      insights.push({
        type: 'warning',
        message: `${summary.bottleneckCount} Bottleneck Nodes Detected`,
        detail: 'These nodes are limiting overall network flow capacity'
      });
    }

    // Flow balance analysis
    const flowBalance = Math.abs(summary.totalInputFlow - summary.totalOutputFlow);
    if (flowBalance < 0.01) {
      insights.push({
        type: 'success',
        message: 'Balanced Flow',
        detail: 'Input and output flows are well balanced'
      });
    } else {
      insights.push({
        type: 'info',
        message: `Flow Imbalance: ${flowBalance.toFixed(3)}`,
        detail: 'Difference between total input and output flows'
      });
    }

    return insights;
  });

  // Filtered and paginated flow data
  filteredFlowData = computed(() => {
    const scenario = this.currentScenarioData();
    if (!scenario) return [];

    const searchTerm = this.flowSearchTerm().toLowerCase();
    const selectedTypes = this.selectedFlowTypes();

    return scenario.flowTableData.filter(item => {
      const matchesSearch = !searchTerm || 
        item.node.toString().includes(searchTerm) || 
        item.type.toLowerCase().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.type);
      return matchesSearch && matchesType;
    });
  });

  paginatedFlowData = computed(() => {
    const filtered = this.filteredFlowData();
    const pageSize = this.flowPageSize();
    const pageIndex = this.flowPageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Helper methods
  private processFlowTableData(scenario: CapacityScenario, networkData: NetworkStructure): FlowTableData[] {
    const rawResult = scenario.raw_capacity_result;
    if (!rawResult?.node_max_flows) return [];

    return Object.entries(rawResult.node_max_flows).map(([nodeStr, maxFlow]) => {
      const node = parseInt(nodeStr);
      const nodeType = this.getNodeType(node, networkData);
      const utilization = this.calculateNodeUtilization(node, maxFlow, scenario);
      const isBottleneck = this.isNodeBottleneck(node, scenario);

      return {
        node,
        type: nodeType,
        maxFlow,
        utilization,
        isBottleneck
      };
    }).sort((a, b) => a.node - b.node);
  }

  private processBottleneckData(scenario: CapacityScenario): BottleneckAnalysisData[] {
    const rawResult = scenario.raw_capacity_result;
    if (!rawResult?.bottlenecks || !rawResult?.critical_paths) return [];

    return scenario.target_nodes.map(target => {
      const targetStr = target.toString();
      const bottlenecks = rawResult.bottlenecks[targetStr] || [];
      const criticalPath = rawResult.critical_paths[targetStr] || [];
      const maxFlow = rawResult.node_max_flows[targetStr] || 0;

      return {
        target,
        bottlenecks,
        criticalPath,
        maxFlow
      };
    });
  }

  private getNodeType(nodeId: number, networkData: NetworkStructure): string {
    const types: string[] = [];
    
    if (networkData.source_nodes.includes(nodeId)) types.push('Source');
    if (networkData.sink_nodes.includes(nodeId)) types.push('Sink');
    if (networkData.fork_nodes.includes(nodeId)) types.push('Fork');
    if (networkData.join_nodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  private calculateNodeUtilization(nodeId: number, maxFlow: number, scenario: CapacityScenario): number {
    // Calculate utilization based on flow vs capacity
    // This is a simplified calculation - in practice, you'd need actual capacity data
    if (maxFlow === 0) return 0;
    
    // Use network utilization as a proxy if specific node capacity isn't available
    return scenario.network_utilization;
  }

  private isNodeBottleneck(nodeId: number, scenario: CapacityScenario): boolean {
    const rawResult = scenario.raw_capacity_result;
    if (!rawResult?.bottlenecks) return false;

    // Check if this node appears in any bottleneck analysis
    return Object.values(rawResult.bottlenecks).some(bottleneckList => 
      bottleneckList.some(bottleneck => 
        typeof bottleneck === 'number' && bottleneck === nodeId
      )
    );
  }

  // Capacity Visualization Methods
  private initializeCapacityVisualization(): void {
    const scenario = this.currentScenarioData();
    const networkData = this.networkData();
    
    if (!scenario || !networkData || !this.capacityVisualizationContainer) return;
    
    this.setupVisualizationDimensions();
    this.prepareCapacityData(scenario, networkData);
    this.createCapacitySVG();
    this.setupCapacityForceSimulation();
    this.renderCapacityVisualization();
  }
  
  private setupVisualizationDimensions(): void {
    if (!this.capacityVisualizationContainer?.nativeElement) return;
    
    const container = this.capacityVisualizationContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    this.width = rect.width || 900;
    this.height = Math.max(600, rect.height || 600);
  }
  
  private prepareCapacityData(scenario: FlowScenarioData, networkData: NetworkStructure): void {
    const rawResult = scenario.scenario.raw_capacity_result;
    if (!rawResult) return;
    
    // Extract unique nodes from edges and add capacity information
    const nodeSet = new Set<string>();
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();
    const edgeFlows = new Map<string, number>();
    
    // Process network edges
    networkData.edges.forEach(edge => {
      const [source, target] = edge;
      const sourceStr = source.toString();
      const targetStr = target.toString();
      const edgeId = `${source}-${target}`;
      
      nodeSet.add(sourceStr);
      nodeSet.add(targetStr);
      
      // Count connections
      if (!nodeConnections.has(sourceStr)) {
        nodeConnections.set(sourceStr, { inDegree: 0, outDegree: 0 });
      }
      if (!nodeConnections.has(targetStr)) {
        nodeConnections.set(targetStr, { inDegree: 0, outDegree: 0 });
      }
      
      nodeConnections.get(sourceStr)!.outDegree++;
      nodeConnections.get(targetStr)!.inDegree++;
      
      // Store edge flow if available
      const edgeFlow = rawResult.edge_flows?.[edgeId] || 0;
      edgeFlows.set(edgeId, edgeFlow);
    });
    
    // Create capacity nodes
    this.nodes = Array.from(nodeSet).map(nodeId => {
      const connections = nodeConnections.get(nodeId) || { inDegree: 0, outDegree: 0 };
      const nodeIdNum = parseInt(nodeId);
      const maxFlow = rawResult.node_max_flows?.[nodeId] || 0;
      const nodeType = this.getNodeType(nodeIdNum, networkData);
      
      // Determine capacity (simplified - would need actual capacity data)
      const capacity = this.estimateNodeCapacity(nodeIdNum, scenario.scenario);
      const utilization = capacity > 0 ? Math.min(maxFlow / capacity, 1) : 0;
      
      const isBottleneck = this.isNodeBottleneck(nodeIdNum, scenario.scenario);
      const isSource = networkData.source_nodes.includes(nodeIdNum);
      const isTarget = networkData.sink_nodes.includes(nodeIdNum);
      
      return {
        id: nodeId,
        name: nodeId,
        type: nodeType,
        maxFlow,
        capacity,
        utilization,
        isBottleneck,
        isSource,
        isTarget,
        radius: this.calculateCapacityNodeRadius(maxFlow, capacity, isBottleneck),
        fillColor: this.getNodeCapacityColor(utilization, isBottleneck, isSource, isTarget),
        strokeColor: isBottleneck ? '#ff4444' : (utilization > 0.8 ? '#ff9800' : '#666'),
        strokeWidth: isBottleneck ? 4 : (utilization > 0.8 ? 3 : 2)
      } as D3CapacityNode;
    });
    
    // Create capacity links
    this.links = networkData.edges.map(edge => {
      const [source, target] = edge;
      const edgeId = `${source}-${target}`;
      const flow = edgeFlows.get(edgeId) || 0;
      
      // Estimate edge capacity (simplified)
      const capacity = this.estimateEdgeCapacity(source, target, scenario.scenario);
      const utilization = capacity > 0 ? Math.min(flow / capacity, 1) : 0;
      
      const isBottleneck = this.isEdgeBottleneck(source, target, scenario.scenario);
      
      return {
        source: source.toString(),
        target: target.toString(),
        id: edgeId,
        flow,
        capacity,
        utilization,
        isBottleneck,
        strokeWidth: this.calculateCapacityEdgeWidth(flow, capacity, isBottleneck),
        color: this.getEdgeCapacityColor(utilization, isBottleneck),
        opacity: Math.max(0.3, utilization),
        dashArray: isBottleneck ? '5,5' : undefined
      } as D3CapacityLink;
    });
  }
  
  private createCapacitySVG(): void {
    // Clear existing SVG
    d3.select(this.capacityVisualizationContainer.nativeElement).select('svg').remove();
    
    // Create new SVG
    this.svg = d3.select(this.capacityVisualizationContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
    
    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.svg) {
          this.svg.select('.main-group').attr('transform', event.transform);
        }
      });
    
    this.svg.call(zoom);
    
    // Create main group for zoomable content
    this.svg.append('g').attr('class', 'main-group');
    
    // Add definitions for patterns and gradients
    const defs = this.svg.append('defs');
    
    // Arrow markers for different states
    this.createArrowMarkers(defs);
    
    // Flow animation patterns
    this.createFlowPatterns(defs);
    
    // Utilization gradients
    this.createUtilizationGradients(defs);
  }
  
  private createArrowMarkers(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Normal flow arrow
    defs.append('marker')
      .attr('id', 'flow-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');
    
    // Bottleneck arrow
    defs.append('marker')
      .attr('id', 'bottleneck-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#ff4444');
    
    // High utilization arrow
    defs.append('marker')
      .attr('id', 'high-util-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#ff9800');
  }
  
  private createFlowPatterns(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Animated flow pattern
    const flowPattern = defs.append('pattern')
      .attr('id', 'flow-animation')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 20)
      .attr('height', 4)
      .attr('patternTransform', 'rotate(0)');
    
    flowPattern.append('rect')
      .attr('width', 20)
      .attr('height', 4)
      .attr('fill', 'url(#flow-gradient)');
    
    flowPattern.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 10)
      .attr('height', 4)
      .attr('fill', 'rgba(255,255,255,0.3)')
      .append('animateTransform')
      .attr('attributeName', 'transform')
      .attr('type', 'translate')
      .attr('values', '0,0;20,0;0,0')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');
  }
  
  private createUtilizationGradients(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>): void {
    // Flow gradient
    const flowGradient = defs.append('linearGradient')
      .attr('id', 'flow-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    
    flowGradient.append('stop')
      .attr('offset', '0%')
      .attr('style', 'stop-color:#4CAF50;stop-opacity:0.8');
    
    flowGradient.append('stop')
      .attr('offset', '100%')
      .attr('style', 'stop-color:#2196F3;stop-opacity:0.8');
  }
  
  private setupCapacityForceSimulation(): void {
    this.simulation = d3.forceSimulation<D3CapacityNode>(this.nodes)
      .force('link', d3.forceLink<D3CapacityNode, D3CapacityLink>(this.links)
        .id(d => d.id)
        .distance(d => {
          // Adjust distance based on capacity and flow
          const baseDistance = 100;
          const link = d as D3CapacityLink;
          const capacityFactor = Math.max(link.capacity || 0, link.flow || 0) / 100;
          return baseDistance + capacityFactor * 20;
        })
        .strength(0.8))
      .force('charge', d3.forceManyBody()
        .strength(d => {
          // Stronger repulsion for high-capacity nodes
          const baseStrength = -400;
          const node = d as D3CapacityNode;
          const capacityMultiplier = node.capacity > 0 ? Math.log(node.capacity + 1) : 1;
          return baseStrength * capacityMultiplier;
        })
        .distanceMax(300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<D3CapacityNode>()
        .radius(d => d.radius + 10)
        .strength(0.9))
      .force('x', d3.forceX(this.width / 2).strength(0.05))
      .force('y', d3.forceY(this.height / 2).strength(0.05));
  }
  
  private renderCapacityVisualization(): void {
    if (!this.svg) return;
    
    const g = this.svg.select('.main-group');
    
    // Render capacity links
    const link = g.selectAll('.capacity-link')
      .data(this.links)
      .enter()
      .append('line')
      .attr('class', 'capacity-link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-opacity', d => d.opacity)
      .attr('stroke-dasharray', d => d.dashArray || null)
      .attr('marker-end', d => {
        if (d.isBottleneck) return 'url(#bottleneck-arrow)';
        if (d.utilization > 0.8) return 'url(#high-util-arrow)';
        return 'url(#flow-arrow)';
      });
    
    // Add flow animation if enabled
    const options = this.visualizationOptions();
    if (options.showFlowAnimation) {
      link.filter(d => d.flow > 0)
        .attr('stroke', 'url(#flow-animation)');
    }
    
    // Render capacity nodes
    const node = g.selectAll('.capacity-node')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'capacity-node')
      .style('cursor', 'pointer')
      .call(this.createCapacityDragBehavior() as any);
    
    // Node main circle
    node.append('circle')
      .attr('class', 'node-main')
      .attr('r', d => d.radius)
      .attr('fill', d => d.fillColor)
      .attr('stroke', d => d.strokeColor)
      .attr('stroke-width', d => d.strokeWidth);
    
    // Capacity ring for nodes with capacity data
    node.filter(d => d.capacity > 0)
      .append('circle')
      .attr('class', 'capacity-ring')
      .attr('r', d => d.radius + 5)
      .attr('fill', 'none')
      .attr('stroke', d => this.capacityColorScale(d.utilization))
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.7);
    
    // Utilization arc for visual capacity indicator
    node.filter(d => d.utilization > 0)
      .append('path')
      .attr('class', 'utilization-arc')
      .attr('d', d => this.createUtilizationArc(d.radius + 8, d.utilization))
      .attr('fill', 'none')
      .attr('stroke', d => this.utilizationColorScale(d.utilization))
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round');
    
    // Node labels
    node.append('text')
      .attr('class', 'node-label')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5)
      .attr('pointer-events', 'none');
    
    // Capacity labels (optional)
    if (options.showCapacityLabels) {
      node.filter(d => d.capacity > 0)
        .append('text')
        .attr('class', 'capacity-label')
        .text(d => `${this.formatFlow(d.maxFlow)}/${this.formatFlow(d.capacity)}`)
        .attr('text-anchor', 'middle')
        .attr('dy', d => d.radius + 20)
        .attr('font-size', '9px')
        .attr('fill', '#333')
        .attr('pointer-events', 'none');
    }
    
    // Bottleneck indicators
    if (options.highlightBottlenecks) {
      node.filter(d => d.isBottleneck)
        .append('circle')
        .attr('class', 'bottleneck-indicator')
        .attr('r', d => d.radius + 12)
        .attr('fill', 'none')
        .attr('stroke', '#ff4444')
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.8)
        .append('animate')
        .attr('attributeName', 'stroke-dashoffset')
        .attr('values', '0;10;0')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');
    }
    
    // Add click and hover handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.selectCapacityNode(d.id);
    });
    
    node.on('mouseenter', (event, d) => {
      this.highlightCapacityConnections(d.id, true);
    }).on('mouseleave', (event, d) => {
      this.highlightCapacityConnections(d.id, false);
    });
    
    // Update positions on simulation tick
    this.simulation?.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3CapacityNode).x!)
        .attr('y1', d => (d.source as D3CapacityNode).y!)
        .attr('x2', d => (d.target as D3CapacityNode).x!)
        .attr('y2', d => (d.target as D3CapacityNode).y!);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }
  
  private updateVisualizationStyles(): void {
    if (!this.svg) return;
    
    const options = this.visualizationOptions();
    
    // Update flow animation
    this.svg.selectAll('.capacity-link')
      .attr('stroke', d => {
        const link = d as D3CapacityLink;
        if (options.showFlowAnimation && link.flow > 0) {
          return 'url(#flow-animation)';
        }
        return link.color;
      });
    
    // Update utilization overlay visibility
    this.svg.selectAll('.capacity-ring')
      .style('display', options.showUtilizationOverlay ? 'block' : 'none');
    
    this.svg.selectAll('.utilization-arc')
      .style('display', options.showUtilizationOverlay ? 'block' : 'none');
    
    // Update bottleneck highlighting
    this.svg.selectAll('.bottleneck-indicator')
      .style('display', options.highlightBottlenecks ? 'block' : 'none');
    
    // Update capacity labels
    this.svg.selectAll('.capacity-label')
      .style('display', options.showCapacityLabels ? 'block' : 'none');
  }

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    const newView = event.value as 'overview' | 'network-capacity' | 'flow-details' | 'bottlenecks' | 'critical-paths';
    this.currentView.set(newView);
    
    // Initialize capacity visualization when switching to network-capacity view
    if (newView === 'network-capacity' && this.capacityVisualizationContainer) {
      setTimeout(() => {
        this.initializeCapacityVisualization();
      }, 100);
    }
  }

  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
    this.flowPageIndex.set(0); // Reset pagination
  }

  onFlowPageChange(event: PageEvent): void {
    this.flowPageIndex.set(event.pageIndex);
    this.flowPageSize.set(event.pageSize);
  }

  // Missing toggle methods
  toggleFlowAnimation(): void {
    const current = this.visualizationOptions();
    this.visualizationOptions.set({
      ...current,
      showFlowAnimation: !current.showFlowAnimation
    });
    this.applyVisualizationOptions();
  }

  toggleUtilizationOverlay(): void {
    const current = this.visualizationOptions();
    this.visualizationOptions.set({
      ...current,
      showUtilizationOverlay: !current.showUtilizationOverlay
    });
    this.applyVisualizationOptions();
  }

  toggleBottleneckHighlighting(): void {
    const current = this.visualizationOptions();
    this.visualizationOptions.set({
      ...current,
      highlightBottlenecks: !current.highlightBottlenecks
    });
    this.applyVisualizationOptions();
  }

  toggleCapacityLabels(): void {
    const current = this.visualizationOptions();
    this.visualizationOptions.set({
      ...current,
      showCapacityLabels: !current.showCapacityLabels
    });
    this.applyVisualizationOptions();
  }

  updateAnimationSpeed(speed: number): void {
    const current = this.visualizationOptions();
    this.visualizationOptions.set({
      ...current,
      animationSpeed: speed
    });
    this.applyVisualizationOptions();
  }

  private applyVisualizationOptions(): void {
    // Update visualization based on current options
    if (this.svg) {
      const options = this.visualizationOptions();
      
      // Update flow animation
      this.svg.selectAll('.capacity-link')
        .style('display', options.showFlowAnimation ? 'block' : 'none');
      
      // Update utilization overlay
      this.svg.selectAll('.utilization-arc')
        .style('display', options.showUtilizationOverlay ? 'block' : 'none');
      
      // Update bottleneck highlighting
      this.svg.selectAll('.bottleneck-indicator')
        .style('display', options.highlightBottlenecks ? 'block' : 'none');
      
      // Update capacity labels
      this.svg.selectAll('.capacity-label')
        .style('display', options.showCapacityLabels ? 'block' : 'none');
    }
  }

  // Add missing selectedCapacityNode signal
  selectedCapacityNode = signal<string | null>(null);

  centerCapacityGraph(): void {
    if (this.svg && this.nodes) {
      // Center the graph
      const bounds = this.svg.node()?.getBoundingClientRect();
      if (bounds) {
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        this.svg.selectAll('.capacity-node')
          .transition()
          .duration(500)
          .attr('cx', centerX)
          .attr('cy', centerY);
      }
    }
  }

  restartCapacitySimulation(): void {
    if (this.simulation) {
      this.simulation.alpha(0.3).restart();
    }
  }

  resetCapacitySelection(): void {
    this.selectedCapacityNode.set(null);
    if (this.svg) {
      this.svg.selectAll('.capacity-node')
        .classed('selected', false);
      this.svg.selectAll('.capacity-link')
        .classed('highlighted', false);
    }
  }

  // Missing estimation methods
  private estimateNodeCapacity(nodeId: number, scenario: CapacityScenario): number {
    // Simple estimation - in real implementation would come from capacity data
    const rawResult = scenario.raw_capacity_result;
    if (!rawResult) return 100; // Default capacity
    const maxFlow = rawResult.node_max_flows?.[nodeId.toString()] || 0;
    return maxFlow * 1.5; // Assume capacity is 150% of current max flow
  }

  private estimateEdgeCapacity(source: number, target: number, scenario: CapacityScenario): number {
    // Simple estimation - in real implementation would come from edge capacity data
    return 100; // Default edge capacity
  }

  private calculateCapacityNodeRadius(maxFlow: number, capacity: number, isBottleneck: boolean): number {
    const baseRadius = 8;
    const flowFactor = Math.sqrt(maxFlow / 10);
    const bottleneckBonus = isBottleneck ? 4 : 0;
    return Math.max(baseRadius + flowFactor + bottleneckBonus, 6);
  }

  private calculateCapacityEdgeWidth(flow: number, capacity: number, isBottleneck: boolean): number {
    const baseWidth = 2;
    const flowFactor = capacity > 0 ? (flow / capacity) * 6 : 1;
    const bottleneckBonus = isBottleneck ? 2 : 0;
    return Math.max(baseWidth + flowFactor + bottleneckBonus, 1);
  }

  private getNodeCapacityColor(utilization: number, isBottleneck: boolean, isSource: boolean, isTarget: boolean): string {
    if (isBottleneck) return '#ff4444';
    if (isSource) return '#4caf50';
    if (isTarget) return '#2196f3';
    if (utilization > 0.8) return '#ff9800';
    if (utilization > 0.6) return '#ffeb3b';
    return '#9e9e9e';
  }

  private getEdgeCapacityColor(utilization: number, isBottleneck: boolean): string {
    if (isBottleneck) return '#ff4444';
    if (utilization > 0.8) return '#ff9800';
    if (utilization > 0.6) return '#ffeb3b';
    return '#666666';
  }

  private isEdgeBottleneck(source: number, target: number, scenario: CapacityScenario): boolean {
    // Simple check - in real implementation would analyze bottlenecks data
    if (!scenario.raw_capacity_result) return false;
    const edgeId = `${source}-${target}`;
    const bottlenecks = scenario.raw_capacity_result.bottlenecks || {};
    return Object.values(bottlenecks).some(bottleneckList => 
      Array.isArray(bottleneckList) && bottleneckList.some(b => 
        typeof b === 'string' && b.includes(`${source}`) && b.includes(`${target}`)
      )
    );
  }

  private createCapacityDragBehavior() {
    return d3.drag<SVGCircleElement, D3CapacityNode>()
      .on('start', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });
  }

  private createUtilizationArc(radius: number, utilization: number): string {
    const angle = utilization * 2 * Math.PI;
    const x1 = radius * Math.cos(-Math.PI / 2);
    const y1 = radius * Math.sin(-Math.PI / 2);
    const x2 = radius * Math.cos(-Math.PI / 2 + angle);
    const y2 = radius * Math.sin(-Math.PI / 2 + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  private selectCapacityNode(nodeId: string): void {
    this.selectedCapacityNode.set(nodeId);
    
    if (this.svg) {
      // Update visual selection
      this.svg.selectAll('.capacity-node')
        .classed('selected', d => (d as D3CapacityNode).id === nodeId);
      
      this.highlightCapacityConnections(nodeId, true);
    }
  }

  private highlightCapacityConnections(nodeId: string, highlight: boolean): void {
    if (!this.svg) return;
    
    this.svg.selectAll('.capacity-link')
      .classed('highlighted', d => {
        const link = d as D3CapacityLink;
        return highlight && (
          (typeof link.source === 'object' ? link.source.id : link.source) === nodeId || 
          (typeof link.target === 'object' ? link.target.id : link.target) === nodeId
        );
      });
  }

  onFlowSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.flowSearchTerm.set(target.value);
    this.flowPageIndex.set(0); // Reset to first page
  }

  onFlowTypeFilter(types: string[]): void {
    this.selectedFlowTypes.set(types);
    this.flowPageIndex.set(0); // Reset to first page
  }

  retryAnalysis(): void {
    console.log('Retrying flow analysis...');
    // Could trigger a re-analysis if needed
  }

  getFlowStatusIcon(flow: FlowTableData): string {
    if (flow.isBottleneck) return 'error';
    if (flow.utilization > 0.8) return 'warning';
    if (flow.utilization > 0.5) return 'trending_up';
    if (flow.utilization > 0) return 'trending_flat';
    return 'trending_down';
  }

  getFlowStatusColor(flow: FlowTableData): string {
    if (flow.isBottleneck) return 'warn';
    if (flow.utilization > 0.8) return 'accent';
    return 'primary';
  }

  formatFlow(flow: number): string {
    if (flow >= 1000000) return (flow / 1000000).toFixed(2) + 'M';
    if (flow >= 1000) return (flow / 1000).toFixed(1) + 'K';
    return flow.toFixed(3);
  }

  formatBottleneck(bottleneck: any): string {
    if (typeof bottleneck === 'number') {
      return `Node ${bottleneck}`;
    } else if (typeof bottleneck === 'object' && bottleneck.source && bottleneck.target) {
      return `Edge ${bottleneck.source}→${bottleneck.target}`;
    } else {
      return String(bottleneck);
    }
  }

  formatCriticalPath(path: number[]): string {
    return path.join(' → ');
  }
}