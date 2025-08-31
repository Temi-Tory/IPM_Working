import { Component, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import * as d3 from 'd3';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  radius: number;
  color: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  id: string;
  strokeWidth: number;
  color: string;
}

interface NetworkStats {
  totalNodes: number;
  totalEdges: number;
  avgDegree: number;
  density: number;
}

@Component({
  selector: 'app-network-visualization',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './network-visualization.component.html',
  styleUrls: ['./network-visualization.component.scss']
})
export class NetworkVisualizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: false }) svgContainer!: ElementRef<HTMLDivElement>;

  private analysisState = inject(AnalysisStateService);
  
  // Signals for reactive state management
  private selectedNodeId = signal<string | null>(null);
  isLoading = signal(true);

  // Computed properties
  networkStats = computed(() => this.calculateNetworkStats());
  selectedNodeData = computed(() => this.getSelectedNodeData());
  hasData = computed(() => {
    const networkData = this.analysisState.networkData();
    return networkData !== null;
  });
  
  // Access to parsed data for additional information
  parsedData = computed(() => this.analysisState.parsedData());

  // D3 visualization properties
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<D3Node, D3Link> | null = null;
  private nodes: D3Node[] = [];
  private links: D3Link[] = [];
  private width = 0;
  private height = 0;

  // Color scheme for nodes
  private readonly nodeColor = '#1976d2'; // Primary blue

  constructor() {
    // React to network data changes
    effect(() => {
      const networkData = this.analysisState.networkData();
      this.isLoading.set(false);
      if (networkData && this.svgContainer) {
        this.initializeVisualization();
      }
    });
  }

  ngOnInit(): void {
    // Component initialization - don't initialize visualization here
    this.isLoading.set(false);
    
    // Load parsed data from session if available
    this.analysisState.loadParsedDataFromSession();
  }

  ngAfterViewInit(): void {
    // Initialize visualization after view is ready
    const networkData = this.analysisState.networkData();
    if (networkData) {
      this.initializeVisualization();
    }
  }

  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  private initializeVisualization(): void {
    const networkData = this.analysisState.networkData();
    if (!networkData) return;

    this.setupDimensions();
    this.prepareData(networkData);
    this.createSVG();
    this.setupForceSimulation();
    this.renderVisualization();
  }

  private setupDimensions(): void {
    if (!this.svgContainer?.nativeElement) {
      console.warn('SVG container not available');
      return;
    }
    const container = this.svgContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    this.width = rect.width || 800; // fallback width
    this.height = Math.max(600, rect.height || 600); // fallback height
  }

  private prepareData(networkData: any): void {
    // Extract unique nodes from edges
    const nodeSet = new Set<string>();
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();

    // Initialize node connections
    networkData.edges.forEach((edge: [number, number]) => {
      const [source, target] = edge;
      const sourceStr = source.toString();
      const targetStr = target.toString();
      
      nodeSet.add(sourceStr);
      nodeSet.add(targetStr);
      
      // Count degrees
      if (!nodeConnections.has(sourceStr)) {
        nodeConnections.set(sourceStr, { inDegree: 0, outDegree: 0 });
      }
      if (!nodeConnections.has(targetStr)) {
        nodeConnections.set(targetStr, { inDegree: 0, outDegree: 0 });
      }
      
      nodeConnections.get(sourceStr)!.outDegree++;
      nodeConnections.get(targetStr)!.inDegree++;
    });

    // Prepare nodes with enhanced properties
    this.nodes = Array.from(nodeSet).map(nodeId => {
      const connections = nodeConnections.get(nodeId) || { inDegree: 0, outDegree: 0 };
      const totalDegree = connections.inDegree + connections.outDegree;
      
      return {
        id: nodeId,
        name: nodeId,
        inDegree: connections.inDegree,
        outDegree: connections.outDegree,
        totalDegree: totalDegree,
        radius: this.calculateNodeRadius(totalDegree),
        color: this.nodeColor
      } as D3Node;
    });

    // Prepare links
    this.links = networkData.edges.map((edge: [number, number]) => {
      const [source, target] = edge;
      return {
        source: source.toString(),
        target: target.toString(),
        id: `${source}-${target}`,
        strokeWidth: 1.5,
        color: '#666'
      } as D3Link;
    });
  }

  private calculateNodeRadius(totalDegree: number): number {
    const baseRadius = 8;
    const degreeBonus = Math.min(totalDegree * 0.5, 12);
    return baseRadius + degreeBonus;
  }

  private createSVG(): void {
    // Clear existing SVG
    d3.select(this.svgContainer.nativeElement).select('svg').remove();

    // Create new SVG
    this.svg = d3.select(this.svgContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('background', 'var(--solarized-base03)');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.svg) {
          this.svg.select('g').attr('transform', event.transform);
        }
      });

    this.svg.call(zoom);

    // Create main group for zoomable content
    this.svg.append('g').attr('class', 'main-group');
  }

  private setupForceSimulation(): void {
    this.simulation = d3.forceSimulation<D3Node>(this.nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(this.links)
        .id(d => d.id)
        .distance(80)
        .strength(0.8))
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(200))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<D3Node>()
        .radius(d => d.radius + 5)
        .strength(0.9))
      .force('x', d3.forceX(this.width / 2).strength(0.1))
      .force('y', d3.forceY(this.height / 2).strength(0.1));
  }

  private renderVisualization(): void {
    if (!this.svg) return;

    const g = this.svg.select('.main-group');

    // Add arrowhead marker
    this.svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Render links
    const link = g.selectAll('.link')
      .data(this.links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-opacity', 0.8)
      .attr('marker-end', 'url(#arrowhead)');

    // Render nodes
    const node = g.selectAll('.node')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.createDragBehavior());

    // Add node circles
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add node labels
    node.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none');

    // Add click handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.selectNode(d.id);
    });

    // Add hover effects
    node.on('mouseenter', (event, d) => {
      this.highlightConnections(d.id, true);
    }).on('mouseleave', (event, d) => {
      this.highlightConnections(d.id, false);
    });

    // Update positions on simulation tick
    this.simulation?.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  private createDragBehavior() {
    return d3.drag<SVGGElement, D3Node>()
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
        // Keep the node fixed at its dragged position
        // Don't set fx and fy to null - this allows nodes to stay where dragged
      });
  }

  private highlightConnections(nodeId: string, highlight: boolean): void {
    if (!this.svg) return;

    const opacity = highlight ? 0.3 : 0.8;
    const highlightOpacity = highlight ? 1.0 : 0.8;

    // Dim all links
    this.svg.selectAll('.link')
      .style('stroke-opacity', opacity);

    // Highlight connected links
    if (highlight) {
      this.svg.selectAll('.link')
        .filter((d: any) => d.source.id === nodeId || d.target.id === nodeId)
        .style('stroke-opacity', highlightOpacity)
        .style('stroke-width', (d: any) => d.strokeWidth + 1);
    } else {
      this.svg.selectAll('.link')
        .style('stroke-width', (d: any) => d.strokeWidth);
    }
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    
    // Visual feedback for selected node
    if (this.svg) {
      this.svg.selectAll('.node circle')
        .style('stroke', d => (d as D3Node).id === nodeId ? '#ffd700' : '#fff')
        .style('stroke-width', d => (d as D3Node).id === nodeId ? 4 : 2);
    }
  }

  private calculateNetworkStats(): NetworkStats {
    const networkData = this.analysisState.networkData();
    if (!networkData) {
      return {
        totalNodes: 0,
        totalEdges: 0,
        avgDegree: 0,
        density: 0
      };
    }

    // Calculate unique nodes from edges data directly
    const nodeSet = new Set<string>();
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();

    // Count nodes and degrees from edges
    networkData.edges.forEach((edge: [number, number]) => {
      const [source, target] = edge;
      const sourceStr = source.toString();
      const targetStr = target.toString();
      
      nodeSet.add(sourceStr);
      nodeSet.add(targetStr);
      
      // Track connections for degree calculation
      if (!nodeConnections.has(sourceStr)) {
        nodeConnections.set(sourceStr, { inDegree: 0, outDegree: 0 });
      }
      if (!nodeConnections.has(targetStr)) {
        nodeConnections.set(targetStr, { inDegree: 0, outDegree: 0 });
      }
      
      nodeConnections.get(sourceStr)!.outDegree++;
      nodeConnections.get(targetStr)!.inDegree++;
    });

    const totalNodes = nodeSet.size;
    const totalEdges = networkData.edges.length;
    
    // Calculate total degree from connection data
    let totalDegree = 0;
    nodeConnections.forEach(({ inDegree, outDegree }) => {
      totalDegree += inDegree + outDegree;
    });
    
    const avgDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;
    
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? (totalEdges * 2) / maxPossibleEdges : 0;

    return {
      totalNodes,
      totalEdges,
      avgDegree: Math.round(avgDegree * 100) / 100,
      density: Math.round(density * 10000) / 100
    };
  }

  private getSelectedNodeData(): any {
    const nodeId = this.selectedNodeId();
    const networkData = this.analysisState.networkData();
    const parsedData = this.parsedData();
    
    console.log('🔍 getSelectedNodeData called:', { nodeId, hasNetworkData: !!networkData, parsedData });
    
    if (!nodeId || !networkData) return null;

    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // Get connected nodes from edges
    const parents: string[] = [];
    const children: string[] = [];
    const connectedEdges: any[] = [];

    networkData.edges.forEach((edge: [number, number]) => {
      const [source, target] = edge;
      const sourceStr = source.toString();
      const targetStr = target.toString();
      const edgeKey = `(${source},${target})`;
      
      if (targetStr === nodeId) {
        parents.push(sourceStr);
        // Add edge data for incoming edges
        connectedEdges.push({
          type: 'incoming',
          from: sourceStr,
          to: nodeId,
          key: edgeKey,
          floatProbability: parsedData?.float?.edge_probabilities?.[edgeKey],
          intervalProbability: parsedData?.interval?.edge_probabilities?.[edgeKey],
          pboxProbability: parsedData?.pbox?.edge_probabilities?.[edgeKey],
          capacity: parsedData?.capacity?.capacities?.edges?.[edgeKey]
        });
      }
      if (sourceStr === nodeId) {
        children.push(targetStr);
        // Add edge data for outgoing edges
        connectedEdges.push({
          type: 'outgoing',
          from: nodeId,
          to: targetStr,
          key: edgeKey,
          floatProbability: parsedData?.float?.edge_probabilities?.[edgeKey],
          intervalProbability: parsedData?.interval?.edge_probabilities?.[edgeKey],
          pboxProbability: parsedData?.pbox?.edge_probabilities?.[edgeKey],
          capacity: parsedData?.capacity?.capacities?.edges?.[edgeKey]
        });
      }
    });

    // Get node-specific data
    const nodeKey = nodeId;
    const nodeData = {
      id: nodeId,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      totalDegree: node.totalDegree,
      parents,
      children,
      connectedEdges,
      // Additional node data when available
      floatPrior: parsedData?.float?.node_priors?.[nodeKey],
      intervalPrior: parsedData?.interval?.node_priors?.[nodeKey],
      pboxPrior: parsedData?.pbox?.node_priors?.[nodeKey],
      capacity: parsedData?.capacity?.capacities?.nodes?.[nodeKey],
      sourceRate: parsedData?.capacity?.capacities?.source_rates?.[nodeKey]
    };

    return nodeData;
  }

  resetSelection(): void {
    this.selectedNodeId.set(null);
    if (this.svg) {
      this.svg.selectAll('.node circle')
        .style('stroke', '#fff')
        .style('stroke-width', 2);
    }
  }

  centerGraph(): void {
    if (this.svg && this.simulation) {
      const transform = d3.zoomIdentity.translate(0, 0).scale(1);
      this.svg.transition().duration(750).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        transform
      );
    }
  }

  restartSimulation(): void {
    if (this.simulation) {
      // Release all fixed positions to allow natural force simulation
      this.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
      });
      this.simulation.alpha(1).restart();
    }
  }

  // Tracking functions for Angular @for loops to prevent unnecessary DOM recreation
  trackByNodeId(index: number, nodeId: string): string {
    return nodeId;
  }

  trackByParentId(index: number, parentId: string): string {
    return parentId;
  }

  trackByChildId(index: number, childId: string): string {
    return childId;
  }

  trackByEdgeKey(index: number, edge: any): string {
    return edge.key || `${edge.from}-${edge.to}`;
  }
}