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
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import * as d3 from 'd3';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';

type LayoutMode = 'hierarchical' | 'top-down' | 'force';
type NodeType = 'source' | 'sink' | 'fork' | 'join' | 'regular';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  radius: number;
  color: string;
  nodeType: NodeType;
  layer: number;       // iteration set index
  layerIndex: number;  // position within the layer
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

// Solarized colors for node types
const NODE_TYPE_COLORS: Record<NodeType, string> = {
  source: '#859900',   // solarized green
  sink: '#dc322f',     // solarized red
  fork: '#cb4b16',     // solarized orange
  join: '#2aa198',     // solarized cyan
  regular: '#268bd2',  // solarized blue
};

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
    MatDividerModule,
    MatButtonToggleModule
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
  layoutMode = signal<LayoutMode>('hierarchical');

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

  // Layout data from network structure
  private iterationSets: number[][] = [];
  private sourceNodes: Set<string> = new Set();
  private sinkNodes: Set<string> = new Set();
  private forkNodes: Set<string> = new Set();
  private joinNodes: Set<string> = new Set();

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
    this.isLoading.set(false);
    this.analysisState.loadParsedDataFromSession();

    if (!this.analysisState.networkData()) {
      this.analysisState.loadNetworkDataFromFileManager();
    }
  }

  ngAfterViewInit(): void {
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

  // ─── Public methods ────────────────────────────────────────────────

  setLayoutMode(mode: LayoutMode): void {
    if (mode === this.layoutMode()) return;
    this.layoutMode.set(mode);
    this.applyLayout();
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    if (this.svg) {
      this.svg.selectAll('.node circle')
        .attr('stroke', (d: any) => d.id === nodeId ? '#ffd700' : d3.color(d.color)!.darker(0.6).formatHex())
        .attr('stroke-width', (d: any) => d.id === nodeId ? 3 : 1.5);
    }
  }

  resetSelection(): void {
    this.selectedNodeId.set(null);
    if (this.svg) {
      this.svg.selectAll('.node circle')
        .attr('stroke', (d: any) => d3.color(d.color)!.darker(0.6).formatHex())
        .attr('stroke-width', 1.5);
    }
  }

  centerGraph(): void {
    if (!this.svg) return;
    // Fit the graph to the viewport
    const g = this.svg.select<SVGGElement>('.main-group');
    const bounds = (g.node() as SVGGElement)?.getBBox();
    if (!bounds || bounds.width === 0) return;

    const padding = 40;
    const scaleX = (this.width - padding * 2) / bounds.width;
    const scaleY = (this.height - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 2); // cap at 2x zoom
    const tx = (this.width - bounds.width * scale) / 2 - bounds.x * scale;
    const ty = (this.height - bounds.height * scale) / 2 - bounds.y * scale;

    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    this.svg.transition().duration(750).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      transform
    );
  }

  restartSimulation(): void {
    this.nodes.forEach(node => { node.fx = null; node.fy = null; });
    const mode = this.layoutMode();
    if (mode === 'force') {
      if (this.simulation) this.simulation.alpha(1).restart();
    } else {
      this.applyLayeredPositions(mode === 'top-down');
      this.updatePositions(true);
    }
  }

  trackByNodeId(index: number, nodeId: string): string { return nodeId; }
  trackByParentId(index: number, parentId: string): string { return parentId; }
  trackByChildId(index: number, childId: string): string { return childId; }
  trackByEdgeKey(index: number, edge: any): string { return edge.key || `${edge.from}-${edge.to}`; }

  // ─── Initialization ────────────────────────────────────────────────

  private initializeVisualization(): void {
    const networkData = this.analysisState.networkData();
    if (!networkData) return;

    this.setupDimensions();
    this.extractStructuralInfo(networkData);
    this.prepareData(networkData);
    this.createSVG();
    this.renderVisualization();
    this.applyLayout();
  }

  private setupDimensions(): void {
    if (!this.svgContainer?.nativeElement) return;
    const rect = this.svgContainer.nativeElement.getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = Math.max(600, rect.height || 600);
  }

  private extractStructuralInfo(networkData: any): void {
    this.iterationSets = networkData.iteration_sets || [];
    this.sourceNodes = new Set((networkData.source_nodes || []).map((n: number) => n.toString()));
    this.sinkNodes = new Set((networkData.sink_nodes || []).map((n: number) => n.toString()));
    this.forkNodes = new Set((networkData.fork_nodes || []).map((n: number) => n.toString()));
    this.joinNodes = new Set((networkData.join_nodes || []).map((n: number) => n.toString()));
  }

  private getNodeType(nodeId: string): NodeType {
    if (this.sourceNodes.has(nodeId)) return 'source';
    if (this.sinkNodes.has(nodeId)) return 'sink';
    if (this.forkNodes.has(nodeId)) return 'fork';
    if (this.joinNodes.has(nodeId)) return 'join';
    return 'regular';
  }

  private prepareData(networkData: any): void {
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();

    networkData.edges.forEach((edge: [number, number]) => {
      const [source, target] = edge;
      const s = source.toString(), t = target.toString();
      if (!nodeConnections.has(s)) nodeConnections.set(s, { inDegree: 0, outDegree: 0 });
      if (!nodeConnections.has(t)) nodeConnections.set(t, { inDegree: 0, outDegree: 0 });
      nodeConnections.get(s)!.outDegree++;
      nodeConnections.get(t)!.inDegree++;
    });

    // Build node-to-layer lookup from iteration_sets
    const nodeLayerMap = new Map<string, { layer: number; index: number }>();
    this.iterationSets.forEach((layerNodes, layerIdx) => {
      layerNodes.forEach((nodeNum, posIdx) => {
        nodeLayerMap.set(nodeNum.toString(), { layer: layerIdx, index: posIdx });
      });
    });

    // Collect all node IDs (from edges + iteration_sets)
    const allNodeIds = new Set<string>();
    networkData.edges.forEach((e: [number, number]) => {
      allNodeIds.add(e[0].toString());
      allNodeIds.add(e[1].toString());
    });
    this.iterationSets.forEach(layer => layer.forEach(n => allNodeIds.add(n.toString())));

    this.nodes = Array.from(allNodeIds).map(nodeId => {
      const connections = nodeConnections.get(nodeId) || { inDegree: 0, outDegree: 0 };
      const totalDegree = connections.inDegree + connections.outDegree;
      const nodeType = this.getNodeType(nodeId);
      const layerInfo = nodeLayerMap.get(nodeId) || { layer: 0, index: 0 };

      return {
        id: nodeId,
        name: nodeId,
        inDegree: connections.inDegree,
        outDegree: connections.outDegree,
        totalDegree,
        radius: this.calculateNodeRadius(totalDegree),
        color: NODE_TYPE_COLORS[nodeType],
        nodeType,
        layer: layerInfo.layer,
        layerIndex: layerInfo.index,
      } as D3Node;
    });

    // Build a node lookup for resolving link references
    const nodeMap = new Map<string, D3Node>();
    this.nodes.forEach(n => nodeMap.set(n.id, n));

    this.links = networkData.edges.map((edge: [number, number]) => ({
      source: nodeMap.get(edge[0].toString())!,
      target: nodeMap.get(edge[1].toString())!,
      id: `${edge[0]}-${edge[1]}`,
      strokeWidth: 1.5,
      color: '#93a1a1' // solarized-base1 — good contrast on both themes
    } as D3Link));
  }

  private calculateNodeRadius(totalDegree: number): number {
    return 8 + Math.min(totalDegree * 0.5, 12);
  }

  // ─── SVG creation ──────────────────────────────────────────────────

  private createSVG(): void {
    d3.select(this.svgContainer.nativeElement).select('svg').remove();

    this.svg = d3.select(this.svgContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('background', 'var(--solarized-base03)');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.svg) {
          this.svg.select('g').attr('transform', event.transform);
        }
      });
    this.svg.call(zoom);
    this.svg.append('g').attr('class', 'main-group');
  }

  // ─── Rendering ─────────────────────────────────────────────────────

  private renderVisualization(): void {
    if (!this.svg) return;
    const g = this.svg.select('.main-group');

    // Arrowhead marker
    const defs = this.svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 12).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#93a1a1');

    // Links — render as paths (curved) for better readability
    g.selectAll('.link')
      .data(this.links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-opacity', 0.5)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Node groups
    const node = g.selectAll('.node')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.createDragBehavior());

    // Drop shadow filter for depth
    defs.append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-30%').attr('y', '-30%')
      .attr('width', '160%').attr('height', '160%')
      .append('feDropShadow')
      .attr('dx', 0).attr('dy', 1)
      .attr('stdDeviation', 1.5)
      .attr('flood-color', 'rgba(0,0,0,0.3)');

    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d3.color(d.color)!.darker(0.6).formatHex())
      .attr('stroke-width', 1.5)
      .style('filter', 'url(#node-shadow)');

    node.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', d => d.radius > 12 ? '11px' : '9px')
      .attr('font-weight', '600')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none');

    node.on('click', (event, d) => {
      event.stopPropagation();
      this.selectNode(d.id);
    });

    node.on('mouseenter', (_event, d) => {
      this.highlightConnections(d.id, true);
    }).on('mouseleave', (_event, d) => {
      this.highlightConnections(d.id, false);
    });
  }

  // ─── Layout switching ──────────────────────────────────────────────

  private applyLayout(): void {
    const mode = this.layoutMode();
    if (mode === 'hierarchical' || mode === 'top-down') {
      // Stop force simulation
      if (this.simulation) {
        this.simulation.stop();
        this.simulation = null;
      }
      this.applyLayeredPositions(mode === 'top-down');
      this.updatePositions(true);
    } else {
      this.applyForceLayout();
    }
  }

  /** Place nodes in layers. horizontal = left→right, vertical = top→bottom */
  private applyLayeredPositions(vertical: boolean = false): void {
    const layerCount = this.iterationSets.length;
    if (layerCount === 0) return;

    const padding = 60;
    const usableW = this.width - padding * 2;
    const usableH = this.height - padding * 2;

    // Group nodes by layer
    const layerGroups = new Map<number, D3Node[]>();
    for (const node of this.nodes) {
      if (!layerGroups.has(node.layer)) layerGroups.set(node.layer, []);
      layerGroups.get(node.layer)!.push(node);
    }

    const layerStep = layerCount > 1
      ? (vertical ? usableH : usableW) / (layerCount - 1)
      : 0;

    for (const [layer, layerNodes] of layerGroups) {
      const layerPos = layerCount === 1
        ? (vertical ? this.height / 2 : this.width / 2)
        : padding + layer * layerStep;

      const crossAxisTotal = vertical ? usableW : usableH;
      const nodeStep = layerNodes.length > 1
        ? crossAxisTotal / (layerNodes.length - 1)
        : 0;

      layerNodes.forEach((node, idx) => {
        const crossPos = layerNodes.length === 1
          ? (vertical ? this.width / 2 : this.height / 2)
          : padding + idx * nodeStep;

        if (vertical) {
          node.x = crossPos;  node.fx = crossPos;
          node.y = layerPos;  node.fy = layerPos;
        } else {
          node.x = layerPos;  node.fx = layerPos;
          node.y = crossPos;  node.fy = crossPos;
        }
      });
    }
  }

  private applyForceLayout(): void {
    // Seed positions from hierarchical layout for deterministic starting point
    this.applyLayeredPositions(false);
    // Release fixed positions so force sim can move them
    this.nodes.forEach(n => { n.fx = null; n.fy = null; });

    this.simulation = d3.forceSimulation<D3Node>(this.nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(this.links)
        .id(d => d.id)
        .distance(80)
        .strength(0.8))
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(250))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<D3Node>()
        .radius(d => d.radius + 5)
        .strength(0.9))
      .force('x', d3.forceX(this.width / 2).strength(0.05))
      .force('y', d3.forceY(this.height / 2).strength(0.05));

    this.simulation.on('tick', () => this.updatePositions(false));
  }

  // ─── Position updates ──────────────────────────────────────────────

  private updatePositions(animate: boolean): void {
    if (!this.svg) return;
    const g = this.svg.select('.main-group');
    const dur = animate ? 600 : 0;

    // Update link paths (curved)
    const linkSel = g.selectAll<SVGPathElement, D3Link>('.link');
    if (animate) {
      linkSel.transition().duration(dur)
        .attr('d', d => this.linkPath(d));
    } else {
      linkSel.attr('d', d => this.linkPath(d));
    }

    // Update node positions
    const nodeSel = g.selectAll<SVGGElement, D3Node>('.node');
    if (animate) {
      nodeSel.transition().duration(dur)
        .attr('transform', d => `translate(${d.x},${d.y})`);
    } else {
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    }
  }

  /** Path between source and target, accounting for node radius */
  private linkPath(d: D3Link): string {
    const s = d.source as D3Node;
    const t = d.target as D3Node;
    if (s.x == null || s.y == null || t.x == null || t.y == null) return '';

    const sx = s.x, sy = s.y, tx = t.x, ty = t.y;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Pull back from source and target by their radii
    const startX = sx + (dx / dist) * s.radius;
    const startY = sy + (dy / dist) * s.radius;
    const endX = tx - (dx / dist) * (t.radius + 4); // +4 for arrowhead
    const endY = ty - (dy / dist) * (t.radius + 4);

    const mode = this.layoutMode();
    if (mode === 'hierarchical') {
      // Smooth horizontal bezier for left-to-right flow
      const midX = (startX + endX) / 2;
      return `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
    }
    if (mode === 'top-down') {
      // Smooth vertical bezier for top-to-bottom flow
      const midY = (startY + endY) / 2;
      return `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`;
    }
    return `M${startX},${startY} L${endX},${endY}`;
  }

  // ─── Drag behavior ─────────────────────────────────────────────────

  private createDragBehavior() {
    return d3.drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (this.layoutMode() === 'force' && !event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        // Immediate position update while dragging
        this.updatePositions(false);
      })
      .on('end', (event, d) => {
        if (this.layoutMode() === 'force') {
          if (!event.active && this.simulation) {
            this.simulation.alphaTarget(0);
          }
          // Keep fixed in force mode
        }
        // In hierarchical mode, node stays where dragged
      });
  }

  // ─── Highlight ─────────────────────────────────────────────────────

  private highlightConnections(nodeId: string, highlight: boolean): void {
    if (!this.svg) return;

    const opacity = highlight ? 0.1 : 0.5;
    const highlightOpacity = highlight ? 0.9 : 0.5;

    this.svg.selectAll('.link')
      .style('stroke-opacity', opacity);

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

  // ─── Stats ─────────────────────────────────────────────────────────

  private calculateNetworkStats(): NetworkStats {
    const networkData = this.analysisState.networkData();
    if (!networkData) {
      return { totalNodes: 0, totalEdges: 0, avgDegree: 0, density: 0 };
    }

    const nodeSet = new Set<string>();
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();

    networkData.edges.forEach((edge: [number, number]) => {
      const s = edge[0].toString(), t = edge[1].toString();
      nodeSet.add(s);
      nodeSet.add(t);
      if (!nodeConnections.has(s)) nodeConnections.set(s, { inDegree: 0, outDegree: 0 });
      if (!nodeConnections.has(t)) nodeConnections.set(t, { inDegree: 0, outDegree: 0 });
      nodeConnections.get(s)!.outDegree++;
      nodeConnections.get(t)!.inDegree++;
    });

    const totalNodes = nodeSet.size;
    const totalEdges = networkData.edges.length;
    let totalDegree = 0;
    nodeConnections.forEach(({ inDegree, outDegree }) => { totalDegree += inDegree + outDegree; });
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

    if (!nodeId || !networkData) return null;

    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;

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
        connectedEdges.push({
          type: 'incoming', from: sourceStr, to: nodeId, key: edgeKey,
          floatProbability: parsedData?.float?.edge_probabilities?.[edgeKey],
          intervalProbability: parsedData?.interval?.edge_probabilities?.[edgeKey],
          pboxProbability: parsedData?.pbox?.edge_probabilities?.[edgeKey],
          capacity: parsedData?.capacity?.capacities?.edges?.[edgeKey]
        });
      }
      if (sourceStr === nodeId) {
        children.push(targetStr);
        connectedEdges.push({
          type: 'outgoing', from: nodeId, to: targetStr, key: edgeKey,
          floatProbability: parsedData?.float?.edge_probabilities?.[edgeKey],
          intervalProbability: parsedData?.interval?.edge_probabilities?.[edgeKey],
          pboxProbability: parsedData?.pbox?.edge_probabilities?.[edgeKey],
          capacity: parsedData?.capacity?.capacities?.edges?.[edgeKey]
        });
      }
    });

    return {
      id: nodeId,
      nodeType: node.nodeType,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      totalDegree: node.totalDegree,
      layer: node.layer,
      parents, children, connectedEdges,
      floatPrior: parsedData?.float?.node_priors?.[nodeId],
      intervalPrior: parsedData?.interval?.node_priors?.[nodeId],
      pboxPrior: parsedData?.pbox?.node_priors?.[nodeId],
      capacity: parsedData?.capacity?.capacities?.nodes?.[nodeId],
      sourceRate: parsedData?.capacity?.capacities?.source_rates?.[nodeId]
    };
  }
}