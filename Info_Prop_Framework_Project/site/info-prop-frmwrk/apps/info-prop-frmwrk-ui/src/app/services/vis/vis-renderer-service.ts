import { Injectable, inject } from "@angular/core";
import * as d3 from "d3";
import { BehaviorSubject } from "rxjs";
import { GraphStructure } from "../../shared/models/graph-structure-interface";
import { VISUALIZATION_CONSTANTS } from "../../shared/models/vis/vis-constants";
import { VisualizationConfig, RenderResult, NodeHighlight, D3Node, D3Link } from "../../shared/models/vis/vis-types";
import { MainServerService } from "../main-server-service";

@Injectable()
export class VisualizationRendererService {
  private readonly mainServerService = inject(MainServerService);
  
  private renderingSubject = new BehaviorSubject<boolean>(false);
  private lastRenderedContainer: HTMLElement | null = null;
  private currentZoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private currentSvg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  
  readonly isRendering$ = this.renderingSubject.asObservable();

  /**
   * Render D3 visualization that responds to config changes
   */
  async renderWithD3(
    container: HTMLElement, 
    structure: GraphStructure, 
    config: VisualizationConfig
  ): Promise<RenderResult> {
    this.renderingSubject.next(true);
    this.lastRenderedContainer = container;
    
    try {
      
      const { nodes, links } = this.prepareD3Data(structure, config);
      
      // Clear container completely to avoid conflicts
      container.innerHTML = '';
      
      const svg = this.createSvgContainer(container);
      const simulation = this.createSimulation(nodes, links, config, container);
      
      this.renderD3Elements(svg, nodes, links, simulation, config);
      this.applyZoomToSvg(svg, config.zoomLevel);
      
      // Store references for zoom control
      this.currentSvg = svg;
      
      return { success: true, renderer: 'd3' };
    } catch (error) {
      console.error('❌ D3 rendering failed:', error);
      throw error;
    } finally {
      this.renderingSubject.next(false);
    }
  }

  /**
   * Apply zoom to current visualization
   */
  applyZoom(zoomLevel: number, container?: HTMLElement): void {
    
    const targetContainer = container || this.lastRenderedContainer;
    if (targetContainer && this.currentSvg) {
      try {
        const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
        const transform = d3.zoomIdentity.scale(zoomLevel / 100);
        this.currentSvg.call(zoom.transform, transform);
      } catch (error) {
        console.warn('⚠️ Error applying zoom:', error);
      }
    } else {
      console.warn('⚠️ No SVG available for zoom');
    }
  }

  /**
   * Cleanup current instance
   */
  async cleanup(): Promise<void> {
    this.lastRenderedContainer = null;
    this.currentSvg = null;
    this.currentZoomBehavior = null;
  }

  // Private methods
  private prepareD3Data(structure: GraphStructure, config: VisualizationConfig): { nodes: D3Node[], links: D3Link[] } {
    const nodeSet = this.extractUniqueNodes(structure.edgelist);
    const highlightMap = new Map(config.highlights.map((h: NodeHighlight) => [h.nodeId, h.color]));

    const nodes: D3Node[] = nodeSet.map(nodeId => ({
      id: nodeId,
      name: config.showNodeLabels ? `${nodeId}` : '',
      type: this.getNodeType(nodeId, structure),
      color: highlightMap.get(nodeId)
    }));

    const links: D3Link[] = structure.edgelist.map(([from, to]) => ({
      source: from,
      target: to,
      value: structure.edge_probabilities?.[`${from}-${to}`] || 1
    }));

    return { nodes, links };
  }

  private createSvgContainer(container: HTMLElement): d3.Selection<SVGSVGElement, unknown, null, undefined> {
    const width = container.clientWidth || VISUALIZATION_CONSTANTS.DEFAULT_WIDTH;
    const height = VISUALIZATION_CONSTANTS.DEFAULT_HEIGHT;

    return d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('background-color', VISUALIZATION_CONSTANTS.COLORS.BACKGROUND);
  }

  private createSimulation(
    nodes: D3Node[], 
    links: D3Link[], 
    config: VisualizationConfig, 
    container: HTMLElement
  ): d3.Simulation<D3Node, D3Link> {
    const width = container.clientWidth || VISUALIZATION_CONSTANTS.DEFAULT_WIDTH;
    const height = VISUALIZATION_CONSTANTS.DEFAULT_HEIGHT;

    // Use different force configurations based on layout
    const forceConfig = VISUALIZATION_CONSTANTS.FORCE_CONFIGS[config.layout] || VISUALIZATION_CONSTANTS.FORCE_CONFIGS.default;
    

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => (d as D3Node).id).distance(forceConfig.linkDistance))
      .force('charge', d3.forceManyBody().strength(forceConfig.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(forceConfig.collisionRadius));

    // Layout-specific adjustments
    switch (config.layout) {
      case 'circo':
        simulation.force('radial', d3.forceRadial(Math.min(width, height) / 4, width / 2, height / 2).strength(0.2));
        break;
      case 'twopi':
        simulation.force('radial', d3.forceRadial(Math.min(width, height) / 3, width / 2, height / 2).strength(0.3));
        break;
    }

    return simulation;
  }

  private renderD3Elements(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    nodes: D3Node[],
    links: D3Link[],
    simulation: d3.Simulation<D3Node, D3Link>,
    config: VisualizationConfig
  ): void {
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);
    this.currentZoomBehavior = zoom;
    
    const g = svg.append('g');

    // Add arrowhead marker
    this.addArrowMarker(svg);

    // Add links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', VISUALIZATION_CONSTANTS.COLORS.EDGE)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Add nodes with proper coloring based on config
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', VISUALIZATION_CONSTANTS.NODE_RADIUS)
      .attr('fill', (d: D3Node) => {
        // Use highlight color if available, otherwise use type color
        if (d.color) {
          return d.color;
        }
        return this.getNodeColor(d.type);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(this.createDragBehavior(simulation) as any);

    // Add labels only if enabled in config
    let label: any = null;
    if (config.showNodeLabels) {
      label = g.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text((d: D3Node) => d.name)
        .attr('font-size', 10)
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .attr('dy', 4)
        .attr('fill', 'white')
        .style('pointer-events', 'none');
    } 

    // Add tooltips
    node.append('title')
      .text((d: D3Node) => `Node ${d.id}\nType: ${d.type}${d.color ? '\nHighlighted' : ''}`);

    // Simulation tick function
    simulation.on('tick', () => {
      link
        .attr('x1', (d: D3Link) => (d.source as D3Node).x || 0)
        .attr('y1', (d: D3Link) => (d.source as D3Node).y || 0)
        .attr('x2', (d: D3Link) => (d.target as D3Node).x || 0)
        .attr('y2', (d: D3Link) => (d.target as D3Node).y || 0);

      node
        .attr('cx', (d: D3Node) => d.x || 0)
        .attr('cy', (d: D3Node) => d.y || 0);

      if (label) {
        label
          .attr('x', (d: D3Node) => d.x || 0)
          .attr('y', (d: D3Node) => d.y || 0);
      }
    });

  }

  private addArrowMarker(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): void {
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 13)
      .attr('markerHeight', 13)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', VISUALIZATION_CONSTANTS.COLORS.EDGE)
      .style('stroke', 'none');
  }

  private createDragBehavior(simulation: d3.Simulation<D3Node, D3Link>) {
    return d3.drag<SVGCircleElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  private applyZoomToSvg(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, zoomLevel: number): void {
    if (zoomLevel !== 100) {
      const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
      const transform = d3.zoomIdentity.scale(zoomLevel / 100);
      svg.call(zoom.transform, transform);
    }
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  private getNodeType(nodeId: number, structure: GraphStructure): string {
    if (structure.source_nodes?.includes(nodeId)) return 'source';
    if (structure.fork_nodes?.includes(nodeId)) return 'fork';
    if (structure.join_nodes?.includes(nodeId)) return 'join';
    return 'regular';
  }

  private getNodeColor(type: string): string {
    return VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES[type] || VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.regular;
  }
}