import { Component, inject, computed, signal, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

import { GraphStateService } from '../../services/graph-state.service';
import { MainServerService } from '../../services/main-server-service';

interface LayoutOption {
  value: string;
  label: string;
  description: string;
}

interface NodeHighlight {
  nodeId: number;
  type: 'source' | 'fork' | 'join' | 'diamond' | 'sink';
  color: string;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  type: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: number | D3Node;
  target: number | D3Node;
  value: number;
}

// Declare types for DOT rendering libraries
declare global {
  interface Window {
    Viz: any;
    d3: any;
  }
}

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatSliderModule,
    MatToolbarModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    FormsModule
  ],
  templateUrl: './visualization.html',
  styleUrl: './visualization.scss',
})
export class VisualizationComponent implements AfterViewInit {
  @ViewChild('dotContainer', { static: false }) dotContainer!: ElementRef<HTMLDivElement>;
  
  readonly graphState = inject(GraphStateService);
  private mainServerService = inject(MainServerService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // State signals
  isGeneratingDot = signal(false);
  dotString = signal<string>('');
  selectedLayout = signal<string>('dot');
  zoomLevel = signal<number>(100);
  showNodeLabels = signal<boolean>(true);
  showEdgeLabels = signal<boolean>(false);
  highlightMode = signal<string>('none');
  private graphvizLoaded = signal<boolean>(false);
  private renderingLibrary = signal<'d3-graphviz' | 'viz.js' | 'd3-fallback'>('d3-graphviz');

  // Layout options for DOT rendering
  readonly layoutOptions: LayoutOption[] = [
    {
      value: 'dot',
      label: 'Hierarchical (DOT)',
      description: 'Top-down hierarchical layout, best for DAGs'
    },
    {
      value: 'neato',
      label: 'Spring Model (Neato)',
      description: 'Force-directed layout using spring model'
    },
    {
      value: 'fdp',
      label: 'Force-Directed (FDP)',
      description: 'Force-directed layout with simulated annealing'
    },
    {
      value: 'circo',
      label: 'Circular (Circo)',
      description: 'Circular layout, good for small graphs'
    },
    {
      value: 'twopi',
      label: 'Radial (Twopi)',
      description: 'Radial layout with one node at center'
    },
    {
      value: 'sfdp',
      label: 'Large Graph (SFDP)',
      description: 'Scalable force-directed layout for large graphs'
    }
  ];

  readonly highlightOptions = [
    { value: 'none', label: 'No Highlighting' },
    { value: 'node-types', label: 'Node Types' },
    { value: 'iteration-levels', label: 'Iteration Levels' },
    { value: 'diamond-structures', label: 'Diamond Structures' },
    { value: 'critical-path', label: 'Critical Paths' }
  ];

  // Computed properties
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly structure = computed(() => this.graphState.graphStructure());
  readonly nodeCount = computed(() => {
    const structure = this.structure();
    if (!structure) return 0;
    
    const nodeSet = new Set<number>();
    structure.edgelist.forEach(([from, to]) => {
      nodeSet.add(from);
      nodeSet.add(to);
    });
    Object.keys(structure.outgoing_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
    Object.keys(structure.incoming_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
    
    return nodeSet.size;
  });
  readonly edgeCount = computed(() => {
    const structure = this.structure();
    return structure?.edgelist.length || 0;
  });

  readonly nodeHighlights = computed(() => {
    const structure = this.structure();
    const mode = this.highlightMode();
    if (!structure || mode === 'none') return [];

    const highlights: NodeHighlight[] = [];
    
    switch (mode) {
      case 'node-types':
        structure.source_nodes.forEach(nodeId => {
          highlights.push({ nodeId, type: 'source', color: '#4CAF50' });
        });
        structure.fork_nodes.forEach(nodeId => {
          highlights.push({ nodeId, type: 'fork', color: '#FF9800' });
        });
        structure.join_nodes.forEach(nodeId => {
          highlights.push({ nodeId, type: 'join', color: '#2196F3' });
        });
        break;
        
      case 'iteration-levels':
        structure.iteration_sets.forEach((set, index) => {
          const hue = (index * 60) % 360;
          const color = `hsl(${hue}, 70%, 60%)`;
          set.forEach(nodeId => {
            highlights.push({ nodeId, type: 'source', color });
          });
        });
        break;
        
      case 'diamond-structures':
        if (structure.diamond_structures?.diamondStructures) {
          Object.values(structure.diamond_structures.diamondStructures).forEach(diamond => {
            diamond.diamond?.forEach(group => {
              group.relevant_nodes?.forEach(nodeId => {
                highlights.push({ nodeId, type: 'diamond', color: '#E91E63' });
              });
            });
          });
        }
        break;
    }
    
    return highlights;
  });

  async ngAfterViewInit() {
    // Load the best available rendering library
    await this.loadRenderingLibraries();
    
    if (this.isGraphLoaded()) {
      this.generateVisualization();
    }
  }

  private async loadRenderingLibraries(): Promise<void> {
    try {
      // Try loading d3-graphviz first (best option)
      await this.loadD3Graphviz();
      this.renderingLibrary.set('d3-graphviz');
      console.log('✅ d3-graphviz loaded successfully');
      return;
    } catch (error) {
      console.log('⚠️ d3-graphviz not available, trying Viz.js...');
    }

    try {
      // Fallback to Viz.js
      await this.loadVizJs();
      this.renderingLibrary.set('viz.js');
      console.log('✅ Viz.js loaded successfully');
      return;
    } catch (error) {
      console.log('⚠️ Viz.js not available, using D3 fallback');
      this.renderingLibrary.set('d3-fallback');
    }
  }

  private async loadD3Graphviz(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.d3?.graphviz) {
        this.graphvizLoaded.set(true);
        resolve();
        return;
      }

      // Load @hpcc-js/wasm first
      const wasmScript = document.createElement('script');
      wasmScript.src = 'https://unpkg.com/@hpcc-js/wasm/dist/graphviz.umd.js';
      wasmScript.onload = () => {
        // Then load d3-graphviz
        const graphvizScript = document.createElement('script');
        graphvizScript.src = 'https://unpkg.com/d3-graphviz@5.6.0/build/d3-graphviz.min.js';
        graphvizScript.onload = () => {
          this.graphvizLoaded.set(true);
          resolve();
        };
        graphvizScript.onerror = () => reject(new Error('Failed to load d3-graphviz'));
        document.head.appendChild(graphvizScript);
      };
      wasmScript.onerror = () => reject(new Error('Failed to load @hpcc-js/wasm'));
      document.head.appendChild(wasmScript);
    });
  }

  private async loadVizJs(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Viz) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/viz.js/2.1.2/viz.js';
      script.onload = () => {
        const renderScript = document.createElement('script');
        renderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/viz.js/2.1.2/full.render.js';
        renderScript.onload = () => resolve();
        renderScript.onerror = () => reject(new Error('Failed to load Viz.js render'));
        document.head.appendChild(renderScript);
      };
      script.onerror = () => reject(new Error('Failed to load Viz.js'));
      document.head.appendChild(script);
    });
  }

  async generateVisualization() {
    if (!this.isGraphLoaded()) {
      this.snackBar.open('No graph loaded. Please upload a graph first.', 'Close', {
        duration: 3000
      });
      return;
    }

    this.isGeneratingDot.set(true);
    
    try {
      const structure = this.structure();
      if (!structure) {
        throw new Error('No graph structure available');
      }

      console.log('🎨 Requesting DOT string from Julia server...');
      
      // Extract and validate nodes
      const nodeSet = new Set<number>();
      structure.edgelist.forEach(([from, to]) => {
        nodeSet.add(from);
        nodeSet.add(to);
      });
      Object.keys(structure.outgoing_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
      Object.keys(structure.incoming_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
      
      const allNodes = Array.from(nodeSet);
      
      if (allNodes.length === 0 || structure.edgelist.length === 0) {
        throw new Error('Graph contains no nodes or edges');
      }
      
      const sinkNodes = allNodes.filter(node =>
        !structure.outgoing_index[node] || structure.outgoing_index[node].length === 0
      );
      
      const dotExportRequest = {
        networkData: {
          nodes: allNodes,
          edges: structure.edgelist,
          sourceNodes: structure.source_nodes,
          sinkNodes: sinkNodes,
          forkNodes: structure.fork_nodes,
          joinNodes: structure.join_nodes,
          iterationSets: structure.iteration_sets,
          nodeCount: allNodes.length,
          edgeCount: structure.edgelist.length,
          ancestors: structure.ancestors,
          descendants: structure.descendants
        }
      };

      const response = await this.mainServerService.exportDot(dotExportRequest).toPromise();
      
      if (!response?.success || !response.dotString) {
        throw new Error('Server returned invalid DOT response');
      }

      let dotString = response.dotString;
      console.log('✅ Received DOT string from server:', dotString.substring(0, 200) + '...');
      console.log('📊 Full DOT string length:', dotString.length);
      
      if (!this.validateDotString(dotString)) {
        throw new Error('DOT string appears to be empty or invalid');
      }
      
      // Apply highlighting and styling
      dotString = this.applyVisualizationOptions(dotString);
      
      // Set the DOT string and force change detection
      this.dotString.set(dotString);
      this.cdr.detectChanges();
      
      // Use the most robust rendering approach
      await this.renderVisualizationRobust(dotString);
      
      this.snackBar.open('Visualization generated successfully!', 'Close', {
        duration: 2000
      });
    } catch (error) {
      console.error('Visualization generation failed:', error);
      
      // Set placeholder and render fallback
      this.dotString.set('digraph G { placeholder [label="Loading..."]; }');
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.renderFallbackVisualization();
      }, 100);
      
      this.snackBar.open('Using fallback visualization method', 'Close', {
        duration: 3000
      });
    } finally {
      this.isGeneratingDot.set(false);
    }
  }

  private async renderVisualizationRobust(dotString: string): Promise<void> {
    // Wait for container to be available using multiple strategies
    const container = await this.ensureContainerAvailable();
    
    const library = this.renderingLibrary();
    console.log(`🎨 Rendering with ${library}...`);
    
    try {
      switch (library) {
        case 'd3-graphviz':
          await this.renderWithD3Graphviz(container, dotString);
          break;
        case 'viz.js':
          await this.renderWithVizJs(container, dotString);
          break;
        default:
          await this.renderWithD3Fallback(container);
          break;
      }
    } catch (error) {
      console.error(`Failed to render with ${library}:`, error);
      // Always fallback to D3
      await this.renderWithD3Fallback(container);
    }
  }

  private async ensureContainerAvailable(): Promise<HTMLElement> {
    // Strategy 1: Check if already available
    if (this.dotContainer?.nativeElement) {
      console.log('✅ Container already available');
      return this.dotContainer.nativeElement;
    }

    // Strategy 2: Wait for Angular change detection cycles
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      this.cdr.detectChanges();
      
      if (this.dotContainer?.nativeElement) {
        console.log(`✅ Container available after ${i + 1} cycles`);
        return this.dotContainer.nativeElement;
      }
    }

    // Strategy 3: Direct DOM query as last resort
    const element = document.querySelector('.dot-container') as HTMLElement;
    if (element) {
      console.log('✅ Container found via DOM query');
      return element;
    }

    throw new Error('Could not ensure container availability');
  }

  private async renderWithD3Graphviz(container: HTMLElement, dotString: string): Promise<void> {
    if (!window.d3?.graphviz) {
      throw new Error('d3-graphviz not available');
    }

    container.innerHTML = '<div style="text-align: center; padding: 20px;">Rendering with d3-graphviz...</div>';

    // Use d3-graphviz for superior DOT rendering
    const graphviz = window.d3.select(container)
      .graphviz()
      .engine(this.selectedLayout())
      .fade(true)
      .tweenShapes(true)
      .tweenPaths(true)
      .zoom(true)
      .fit(true)
      .width(container.clientWidth || 800)
      .height(600);

    await new Promise<void>((resolve, reject) => {
      graphviz
        .renderDot(dotString, () => {
          console.log('✅ d3-graphviz rendering completed');
          resolve();
        })
        .onerror((error: any) => {
          console.error('d3-graphviz error:', error);
          reject(new Error(`d3-graphviz error: ${error}`));
        });
    });
  }

  private async renderWithVizJs(container: HTMLElement, dotString: string): Promise<void> {
    if (!window.Viz) {
      throw new Error('Viz.js not available');
    }

    container.innerHTML = '<div style="text-align: center; padding: 20px;">Rendering with Viz.js...</div>';

    const viz = new window.Viz();
    const svgString = await viz.renderString(dotString, {
      format: 'svg',
      engine: this.selectedLayout()
    });

    container.innerHTML = svgString;
    this.addZoomToSvg(container);
    console.log('✅ Viz.js rendering completed');
  }

  private async renderWithD3Fallback(container: HTMLElement): Promise<void> {
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Rendering with D3 fallback...</div>';
    
    await new Promise(resolve => setTimeout(resolve, 100));
    this.createD3Visualization(container);
    console.log('✅ D3 fallback rendering completed');
  }

  private validateDotString(dotString: string): boolean {
    if (!dotString || dotString.trim().length === 0) {
      console.error('DOT string is empty');
      return false;
    }
    
    if (!dotString.includes('digraph') && !dotString.includes('graph')) {
      console.error('DOT string does not contain graph declaration');
      return false;
    }
    
    const hasNodes = dotString.includes('->') || 
                    dotString.includes('--') || 
                    /"\d+"\s*\[/.test(dotString) ||
                    /\d+\s*\[/.test(dotString);
    
    if (!hasNodes) {
      console.error('DOT string appears to contain no nodes or edges');
      return false;
    }
    
    console.log('✅ DOT string validation passed');
    return true;
  }

  private applyVisualizationOptions(dotString: string): string {
    let modifiedDot = dotString;
    
    // Apply layout engine
    const layout = this.selectedLayout();
    
    if (modifiedDot.includes('layout=')) {
      modifiedDot = modifiedDot.replace(/layout="?\w+"?/, `layout="${layout}"`);
    } else {
      modifiedDot = modifiedDot.replace(/digraph\s+\w*\s*{/, `digraph G {
  layout="${layout}";`);
    }

    // Apply node highlighting
    const highlights = this.nodeHighlights();
    highlights.forEach(highlight => {
      const nodePattern = new RegExp(`"?${highlight.nodeId}"?\\s*\\[([^\\]]*)\\]`, 'g');
      modifiedDot = modifiedDot.replace(nodePattern, (match, attributes) => {
        let newAttributes = attributes || '';
        
        if (newAttributes.includes('fillcolor=')) {
          newAttributes = newAttributes.replace(/fillcolor="?[^",\]]*"?/, `fillcolor="${highlight.color}"`);
        } else {
          newAttributes = newAttributes ? `${newAttributes}, fillcolor="${highlight.color}"` : `fillcolor="${highlight.color}"`;
        }
        
        if (newAttributes.includes('style=')) {
          if (!newAttributes.includes('filled')) {
            newAttributes = newAttributes.replace(/style="?([^",\]]*)"?/, 'style="$1,filled"');
          }
        } else {
          newAttributes = newAttributes ? `${newAttributes}, style="filled"` : 'style="filled"';
        }
        
        return `"${highlight.nodeId}" [${newAttributes}]`;
      });
    });

    return modifiedDot;
  }

  private addZoomToSvg(container: HTMLElement): void {
    const svg = container.querySelector('svg');
    if (!svg) return;

    svg.style.width = '100%';
    svg.style.height = '600px';
    svg.style.cursor = 'grab';

    const d3Svg = d3.select(svg);
    const g = d3Svg.select('g');

    if (g.empty()) {
      const content = svg.innerHTML;
      svg.innerHTML = `<g>${content}</g>`;
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const g = d3Svg.select('g');
        g.attr('transform', event.transform.toString());
      });

    d3Svg.call(zoom);

    const initialScale = this.zoomLevel() / 100;
    const transform = d3.zoomIdentity.scale(initialScale);
    d3Svg.call(zoom.transform as any, transform);
  }

  private renderFallbackVisualization(): void {
    const container = document.querySelector('.dot-container') as HTMLElement;
    if (!container) {
      console.error('Could not find container for fallback visualization');
      return;
    }

    this.createD3Visualization(container);
  }

  private createD3Visualization(container: HTMLElement) {
    const structure = this.structure();
    if (!structure) return;

    // Extract unique nodes from edgelist
    const nodeSet = new Set<number>();
    structure.edgelist.forEach(([from, to]) => {
      nodeSet.add(from);
      nodeSet.add(to);
    });

    // Prepare data for D3
    const nodes: D3Node[] = Array.from(nodeSet).map(nodeId => ({
      id: nodeId,
      name: `${nodeId}`,
      type: this.getNodeType(nodeId, structure)
    }));

    const links: D3Link[] = structure.edgelist.map(([from, to]) => ({
      source: from,
      target: to,
      value: structure.edge_probabilities?.[`${from}-${to}`] || 1
    }));

    // Set dimensions
    const width = container.clientWidth || 800;
    const height = 600;

    // Clear and create SVG
    container.innerHTML = '';
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => (d as D3Node).id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Create container group
    const g = svg.append('g');

    // Add arrowhead marker
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
      .attr('fill', '#999')
      .style('stroke','none');

    // Add links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Add nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 12)
      .attr('fill', (d: any) => this.getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          const node = d as D3Node;
          if (!event.active) simulation.alphaTarget(0.3).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on('drag', (event, d) => {
          const node = d as D3Node;
          node.fx = event.x;
          node.fy = event.y;
        })
        .on('end', (event, d) => {
          const node = d as D3Node;
          if (!event.active) simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        }) as any);

    // Add labels if enabled
    if (this.showNodeLabels()) {
      const label = g.append('g')
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

      simulation.on('tick', () => {
        link
          .attr('x1', (d: D3Link) => (d.source as D3Node).x || 0)
          .attr('y1', (d: D3Link) => (d.source as D3Node).y || 0)
          .attr('x2', (d: D3Link) => (d.target as D3Node).x || 0)
          .attr('y2', (d: D3Link) => (d.target as D3Node).y || 0);

        node
          .attr('cx', (d: D3Node) => d.x || 0)
          .attr('cy', (d: D3Node) => d.y || 0);

        label
          .attr('x', (d: D3Node) => d.x || 0)
          .attr('y', (d: D3Node) => d.y || 0);
      });
    } else {
      simulation.on('tick', () => {
        link
          .attr('x1', (d: D3Link) => (d.source as D3Node).x || 0)
          .attr('y1', (d: D3Link) => (d.source as D3Node).y || 0)
          .attr('x2', (d: D3Link) => (d.target as D3Node).x || 0)
          .attr('y2', (d: D3Link) => (d.target as D3Node).y || 0);

        node
          .attr('cx', (d: D3Node) => d.x || 0)
          .attr('cy', (d: D3Node) => d.y || 0);
      });
    }

    // Add tooltips
    node.append('title')
      .text((d: D3Node) => `Node ${d.name}\nType: ${d.type}`);
  }

  private getNodeType(nodeId: number, structure: any): string {
    if (structure.source_nodes?.includes(nodeId)) return 'source';
    if (structure.fork_nodes?.includes(nodeId)) return 'fork';
    if (structure.join_nodes?.includes(nodeId)) return 'join';
    return 'regular';
  }

  private getNodeColor(type: string): string {
    switch (type) {
      case 'source': return '#4CAF50';
      case 'fork': return '#FF9800';
      case 'join': return '#2196F3';
      default: return '#9E9E9E';
    }
  }

  // Event handlers
  onLayoutChange() {
    if (this.dotString()) {
      this.generateVisualization();
    }
  }

  onZoomChange(value: number) {
    this.zoomLevel.set(value);
    
    const container = this.dotContainer?.nativeElement || document.querySelector('.dot-container') as HTMLElement;
    if (container) {
      const svg = d3.select(container).select('svg');
      if (!svg.empty()) {
        const zoom = d3.zoom().scaleExtent([0.1, 4]);
        const transform = d3.zoomIdentity.scale(value / 100);
        svg.call(zoom.transform as any, transform);
      }
    }
  }

  onHighlightModeChange() {
    if (this.dotString()) {
      this.generateVisualization();
    }
  }

  onNodeLabelsChange() {
    if (this.dotString()) {
      this.generateVisualization();
    }
  }

  onEdgeLabelsChange() {
    if (this.dotString()) {
      this.generateVisualization();
    }
  }

  downloadDotFile() {
    const dotString = this.dotString();
    if (!dotString) return;

    const blob = new Blob([dotString], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_${this.selectedLayout()}_${Date.now()}.dot`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.snackBar.open('DOT file downloaded!', 'Close', {
      duration: 2000
    });
  }

  resetView() {
    this.zoomLevel.set(100);
    this.selectedLayout.set('dot');
    this.highlightMode.set('none');
    this.showNodeLabels.set(true);
    this.showEdgeLabels.set(false);
    
    if (this.isGraphLoaded()) {
      this.generateVisualization();
    }
  }

  exportVisualization() {
    const container = this.dotContainer?.nativeElement || document.querySelector('.dot-container') as HTMLElement;
    if (!container) {
      this.snackBar.open('Visualization container not available', 'Close', { duration: 2000 });
      return;
    }

    const svg = container.querySelector('svg');
    if (!svg) {
      this.snackBar.open('No visualization to export', 'Close', { duration: 2000 });
      return;
    }

    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `network_visualization_${Date.now()}.svg`;
      link.click();
      
      URL.revokeObjectURL(url);
      this.snackBar.open('Visualization exported as SVG!', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('Export failed:', error);
      this.snackBar.open('Export failed', 'Close', { duration: 2000 });
    }
  }

  debugVisualization() {
    console.log('🔍 DEBUG INFORMATION:');
    console.log('Graph loaded:', this.isGraphLoaded());
    console.log('DOT string available:', !!this.dotString());
    console.log('DOT string length:', this.dotString()?.length || 0);
    console.log('Container available:', !!this.dotContainer?.nativeElement);
    console.log('Rendering library:', this.renderingLibrary());
    console.log('Library loaded:', this.graphvizLoaded());
    console.log('Current structure:', this.structure());
    console.log('Node count:', this.nodeCount());
    console.log('Edge count:', this.edgeCount());
    
    this.snackBar.open('Debug info logged to console', 'Close', { duration: 2000 });
  }
}