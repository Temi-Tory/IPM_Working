import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';

import * as d3 from 'd3';
import { NetworkStructureResult } from '../../shared/models/network-analysis.models';

export interface NetworkNode {
  id: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x position
  fy?: number | null; // Fixed y position
}

export interface NetworkLink {
  source: number | NetworkNode;
  target: number | NetworkNode;
  id: string;
}

export interface NodeSelectionEvent {
  node: NetworkNode;
  event: MouseEvent;
}

export interface EdgeSelectionEvent {
  link: NetworkLink;
  event: MouseEvent;
}

export interface NodeInfo {
  id: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  ancestors?: number[];
  descendants?: number[];
  prior?: number;
  iterationSet?: number;
}

@Component({
  selector: 'app-network-visualization',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatToolbarModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatExpansionModule,
    FormsModule
  ],
  templateUrl: './network-visualization.component.html',
  styleUrl: './network-visualization.component.scss'
})
export class NetworkVisualizationComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() networkData?: NetworkStructureResult;
  @Input() width: number = 800;
  @Input() height: number = 600;
  
  @Output() nodeSelected = new EventEmitter<NodeSelectionEvent>();
  @Output() edgeSelected = new EventEmitter<EdgeSelectionEvent>();
  @Output() canvasClicked = new EventEmitter<MouseEvent>();
  
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLDivElement>;

  // D3 objects
  private svg: any;
  private g: any; // Main group for zoom/pan
  private simulation: any;
  private nodes: NetworkNode[] = [];
  private links: NetworkLink[] = [];
  
  // Configuration
  nodeRadius = 20;
  linkDistance = 80;
  chargeStrength = -300;
  edgeThickness = 2;
  showNodeLabels = true;
  enableHighlighting = false;
  isLoading = false;
  
  // Node information panel
  selectedNodeInfo: NodeInfo | null = null;

  constructor(private elementRef: ElementRef) {}
  
  // Get theme-aware colors from CSS custom properties
  private getNodeColors() {
    const computedStyle = getComputedStyle(this.elementRef.nativeElement);
    return {
      source: computedStyle.getPropertyValue('--node-source-color').trim() || '#43A047',
      sink: computedStyle.getPropertyValue('--node-sink-color').trim() || '#E53935',
      fork: computedStyle.getPropertyValue('--node-fork-color').trim() || '#1E88E5', 
      join: computedStyle.getPropertyValue('--node-join-color').trim() || '#FB8C00',
      regular: computedStyle.getPropertyValue('--node-regular-color').trim() || '#757575'
    };
  }

  // Get theme-aware arrow markers
  private getArrowMarkers() {
    const colors = this.getNodeColors();
    const edgeColor = getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--edge-color').trim() || '#666';
    return [
      { id: 'arrowhead-source', color: colors.source },
      { id: 'arrowhead-sink', color: colors.sink },
      { id: 'arrowhead-fork', color: colors.fork },
      { id: 'arrowhead-join', color: colors.join },
      { id: 'arrowhead-regular', color: colors.regular },
      { id: 'arrowhead-default', color: edgeColor }
    ];
  }

  ngAfterViewInit(): void {
    this.initializeVisualization();
    if (this.networkData) {
      this.updateVisualization();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['networkData'] && this.svg) {
      this.updateVisualization();
    }
    if ((changes['width'] || changes['height']) && this.svg) {
      this.resizeVisualization();
    }
  }

  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  private initializeVisualization(): void {
    const container = this.svgContainer.nativeElement;
    
    // Clear any existing SVG
    d3.select(container).selectAll('*').remove();
    
    // Create SVG with theme-aware styling
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background', getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--svg-background').trim() || '#fafafa')
      .style('border', '1px solid var(--mat-sys-outline-variant)')
      .style('border-radius', '4px');

    // Add zoom and pan behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Create main group for zoom/pan
    this.g = this.svg.append('g');

    // Add arrow markers for directed edges
    const defs = this.svg.append('defs');
    
    this.getArrowMarkers().forEach(marker => {
      defs.append('marker')
        .attr('id', marker.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', marker.color);
    });

    // Add click handler for canvas
    this.svg.on('click', (event: MouseEvent) => {
      if (event.target === this.svg.node()) {
        this.canvasClicked.emit(event);
      }
    });

    this.initializeSimulation();
  }

  private initializeSimulation(): void {
    this.simulation = d3.forceSimulation<NetworkNode, NetworkLink>()
      .force('link', d3.forceLink<NetworkNode, NetworkLink>().id((d: NetworkNode) => d.id.toString()).distance(this.linkDistance))
      .force('charge', d3.forceManyBody<NetworkNode>().strength(this.chargeStrength))
      .force('center', d3.forceCenter<NetworkNode>(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<NetworkNode>().radius(this.nodeRadius + 2));
  }

  private updateVisualization(): void {
    if (!this.networkData) return;

    this.isLoading = true;
    
    // Prepare data
    this.prepareData();
    
    // Update simulation
    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<NetworkNode, NetworkLink>).links(this.links);
    
    // Render visualization
    this.renderLinks();
    this.renderNodes();
    
    // Start simulation
    this.simulation.alpha(1).restart();
    
    this.isLoading = false;
  }

  private prepareData(): void {
    const data = this.networkData!;
    
    // Handle both comprehensive and basic network structure data
    let allNodes: number[] = [];
    let edgeList: [number, number][] = [];
    
    if (data.all_nodes && data.edgelist) {
      // Comprehensive structure data with explicit all_nodes and edgelist
      allNodes = data.all_nodes;
      edgeList = data.edgelist;
    } else if (data.incoming_index || data.outgoing_index) {
      // Comprehensive structure data - incoming_index has ALL nodes as keys
      const nodeSet = new Set<number>();
      
      // incoming_index contains ALL nodes as keys (source nodes have empty arrays)
      if (data.incoming_index) {
        Object.keys(data.incoming_index).forEach(nodeStr => {
          nodeSet.add(parseInt(nodeStr));
        });
      } else if (data.outgoing_index) {
        // Fallback: get nodes from outgoing_index keys and values
        Object.keys(data.outgoing_index).forEach(nodeStr => {
          nodeSet.add(parseInt(nodeStr));
        });
        Object.values(data.outgoing_index).forEach(nodeList => {
          nodeList.forEach(nodeId => nodeSet.add(nodeId));
        });
      }
      
      allNodes = Array.from(nodeSet).sort((a, b) => a - b);
      
      // Build edgelist from outgoing_index
      edgeList = [];
      if (data.outgoing_index) {
        for (const [sourceStr, targets] of Object.entries(data.outgoing_index)) {
          const source = parseInt(sourceStr);
          targets.forEach(target => {
            edgeList.push([source, target]);
          });
        }
      }
    } else {
      // Basic structure data - derive nodes from classified node arrays
      const nodeSet = new Set<number>();
      
      // Add all node types to the set
      if (data.source_nodes) data.source_nodes.forEach(n => nodeSet.add(n));
      if (data.sink_nodes) data.sink_nodes.forEach(n => nodeSet.add(n));
      if (data.fork_nodes) data.fork_nodes.forEach(n => nodeSet.add(n));
      if (data.join_nodes) data.join_nodes.forEach(n => nodeSet.add(n));
      
      allNodes = Array.from(nodeSet).sort((a, b) => a - b);
      edgeList = []; // No edge information in basic structure
    }
    
    // Create nodes with role classification
    this.nodes = allNodes.map(nodeId => ({
      id: nodeId,
      role: this.getNodeRole(nodeId, data)
    }));

    // Create links from edgelist
    this.links = edgeList.map(([source, target]) => ({
      source: source,
      target: target,
      id: `${source}-${target}`
    }));
  }

  private getNodeRole(nodeId: number, data: NetworkStructureResult): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    if (data.source_nodes.includes(nodeId)) return 'source';
    if (data.sink_nodes.includes(nodeId)) return 'sink';
    if (data.fork_nodes.includes(nodeId)) return 'fork';
    if (data.join_nodes.includes(nodeId)) return 'join';
    return 'regular';
  }

  private renderLinks(): void {
    const linkSelection = this.g.selectAll('.link')
      .data(this.links, (d: any) => d.id);

    // Remove old links
    linkSelection.exit().remove();

    // Add new links
    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', () => getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--edge-color').trim() || '#666')
      .attr('stroke-width', this.edgeThickness)
      .attr('marker-end', (d: any) => {
        const targetNode = this.nodes.find(n => n.id === (typeof d.target === 'object' ? d.target.id : d.target));
        return targetNode ? `url(#arrowhead-${targetNode.role})` : 'url(#arrowhead-default)';
      })
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: NetworkLink) => {
        event.stopPropagation();
        this.edgeSelected.emit({ link: d, event });
      });

    // Merge and update
    linkSelection.merge(linkEnter);

    this.simulation.on('tick', () => {
      this.g.selectAll('.link')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
    });
  }

  private renderNodes(): void {
    const nodeSelection = this.g.selectAll('.node-group')
      .data(this.nodes, (d: any) => d.id);

    // Remove old nodes
    nodeSelection.exit().remove();

    // Add new nodes
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node-group');

    // Add circles
    nodeEnter.append('circle')
      .attr('class', 'node')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: NetworkNode) => this.getNodeColors()[d.role])
      .attr('stroke', () => getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--node-stroke-color').trim() || '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'move');

    // Add labels
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text((d: NetworkNode) => d.id.toString());

    // Merge with existing
    const nodeUpdate = nodeSelection.merge(nodeEnter);

    // Add interaction behaviors
    nodeUpdate
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => this.onDragStart(event, d))
        .on('drag', (event, d) => this.onDrag(event, d))
        .on('end', (event, d) => this.onDragEnd(event, d)))
      .on('click', (event: MouseEvent, d: NetworkNode) => {
        event.stopPropagation();
        this.onNodeClick(d);
        this.nodeSelected.emit({ node: d, event });
      });

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      nodeUpdate.attr('transform', (d: NetworkNode) => `translate(${d.x},${d.y})`);
    });
  }

  private onDragStart(event: any, d: NetworkNode): void {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  private onDrag(event: any, d: NetworkNode): void {
    d.fx = event.x;
    d.fy = event.y;
  }

  private onDragEnd(event: any, d: NetworkNode): void {
    if (!event.active) this.simulation.alphaTarget(0);
    // Keep node fixed at dragged position
    // To unfix, set d.fx = null; d.fy = null;
  }

  private resizeVisualization(): void {
    this.svg
      .attr('width', this.width)
      .attr('height', this.height);
    
    this.simulation
      .force('center', d3.forceCenter<NetworkNode>(this.width / 2, this.height / 2))
      .alpha(0.3)
      .restart();
  }

  // Public methods for external control
  resetZoom(): void {
    this.svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity
    );
  }

  centerGraph(): void {
    const bounds = this.g.node().getBBox();
    const fullWidth = this.width;
    const fullHeight = this.height;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    
    if (width == 0 || height == 0) return;
    
    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    this.svg.transition().duration(750).call(
      d3.zoom().transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }

  unfixAllNodes(): void {
    this.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;
    });
    this.simulation.alpha(0.3).restart();
  }

  // Configuration update methods
  updateLinkDistance(): void {
    (this.simulation.force('link') as d3.ForceLink<NetworkNode, NetworkLink>).distance(this.linkDistance);
    this.simulation.alpha(0.3).restart();
  }

  updateChargeStrength(): void {
    (this.simulation.force('charge') as d3.ForceManyBody<NetworkNode>).strength(this.chargeStrength);
    this.simulation.alpha(0.3).restart();
  }

  updateNodeRadius(): void {
    if (this.svg) {
      this.svg.selectAll('.node')
        .attr('r', this.nodeRadius);
      
      // Update collision force
      if (this.simulation) {
        (this.simulation.force('collision') as d3.ForceCollide<NetworkNode>).radius(this.nodeRadius + 2);
        this.simulation.alpha(0.1).restart();
      }
    }
  }

  updateEdgeThickness(): void {
    if (this.svg) {
      this.svg.selectAll('.link')
        .attr('stroke-width', this.edgeThickness);
    }
  }

  updateNodeLabels(): void {
    if (this.svg) {
      this.svg.selectAll('.node-label')
        .style('display', this.showNodeLabels ? 'block' : 'none');
    }
  }

  // Advanced highlighting methods
  highlightNodeAncestors(nodeId: number): void {
    if (!this.enableHighlighting || !this.networkData) return;
    
    this.clearHighlights();
    
    if (this.networkData.ancestors && this.networkData.ancestors[nodeId]) {
      const ancestorNodes = [nodeId, ...this.networkData.ancestors[nodeId]];
      this.highlightNodes(ancestorNodes, 'ancestor-highlight');
      this.highlightConnectingEdges(ancestorNodes);
    }
  }

  highlightNodeDescendants(nodeId: number): void {
    if (!this.enableHighlighting || !this.networkData) return;
    
    this.clearHighlights();
    
    if (this.networkData.descendants && this.networkData.descendants[nodeId]) {
      const descendantNodes = [nodeId, ...this.networkData.descendants[nodeId]];
      this.highlightNodes(descendantNodes, 'descendant-highlight');
      this.highlightConnectingEdges(descendantNodes);
    }
  }

  highlightIterationSet(setIndex: number): void {
    if (!this.enableHighlighting || !this.networkData) return;
    
    this.clearHighlights();
    
    if (this.networkData.iteration_sets && this.networkData.iteration_sets[setIndex]) {
      const setNodes = this.networkData.iteration_sets[setIndex];
      this.highlightNodes(setNodes, 'iteration-set-highlight');
    }
  }

  private highlightNodes(nodeIds: number[], highlightClass: string = 'highlighted'): void {
    if (!this.svg) return;
    
    this.svg.selectAll('.node')
      .classed(highlightClass, (d: any) => nodeIds.includes(d.id))
      .style('stroke-width', (d: any) => nodeIds.includes(d.id) ? '4px' : '2px')
      .style('opacity', (d: any) => nodeIds.includes(d.id) ? 1.0 : 0.3);
  }

  private highlightConnectingEdges(nodeIds: number[]): void {
    if (!this.svg) return;
    
    this.svg.selectAll('.link')
      .style('stroke-width', (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        return (nodeIds.includes(sourceId) && nodeIds.includes(targetId)) ? this.edgeThickness * 2 : this.edgeThickness;
      })
      .style('opacity', (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        return (nodeIds.includes(sourceId) && nodeIds.includes(targetId)) ? 1.0 : 0.3;
      });
  }

  clearHighlights(): void {
    if (!this.svg) return;
    
    this.svg.selectAll('.node')
      .classed('highlighted ancestor-highlight descendant-highlight iteration-set-highlight', false)
      .style('stroke-width', '2px')
      .style('opacity', 1.0);
      
    this.svg.selectAll('.link')
      .style('stroke-width', this.edgeThickness)
      .style('opacity', 1.0);
  }

  // Utility methods
  getNodeCount(): number {
    return this.nodes.length;
  }

  getLinkCount(): number {
    return this.links.length;
  }

  getNodesByRole(role: string): NetworkNode[] {
    return this.nodes.filter(node => node.role === role);
  }

  // Helper method for template
  formatChargeStrength = (value: number): string => {
    return Math.abs(value).toString();
  };

  // Node click handler for information panel
  onNodeClick(node: NetworkNode): void {
    if (!this.networkData) {
      this.selectedNodeInfo = null;
      return;
    }

    const data = this.networkData;
    const nodeId = node.id;
    
    // Get ancestors from networkData
    const ancestors = data.ancestors?.[nodeId] || [];
    
    // Get descendants from networkData
    const descendants = data.descendants?.[nodeId] || [];
    
    // Get prior probability from node_priors if available
    const prior = data.node_priors?.[nodeId];
    
    // Find which iteration set this node belongs to
    let iterationSet: number | undefined = undefined;
    if (data.iteration_sets) {
      for (let i = 0; i < data.iteration_sets.length; i++) {
        if (data.iteration_sets[i].includes(nodeId)) {
          iterationSet = i;
          break;
        }
      }
    }

    this.selectedNodeInfo = {
      id: nodeId,
      role: node.role,
      ancestors: ancestors.length > 0 ? ancestors : undefined,
      descendants: descendants.length > 0 ? descendants : undefined,
      prior: prior,
      iterationSet: iterationSet
    };
  }

  // Make Math available to template
  Math = Math;
}