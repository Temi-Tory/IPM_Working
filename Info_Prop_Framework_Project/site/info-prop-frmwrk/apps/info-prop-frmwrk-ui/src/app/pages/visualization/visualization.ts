import { Component, inject, computed, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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

  // State signals
  isGeneratingDot = signal(false);
  dotString = signal<string>('');
  selectedLayout = signal<string>('dot');
  zoomLevel = signal<number>(100);
  showNodeLabels = signal<boolean>(true);
  showEdgeLabels = signal<boolean>(false);
  highlightMode = signal<string>('none');

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
    
    // Extract unique nodes from edgelist and indices
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

  ngAfterViewInit() {
    if (this.isGraphLoaded()) {
      this.generateVisualization();
    }
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

      // Use server's DOT generation instead of local sample
      console.log('🎨 Requesting DOT string from Julia server...');
      
      // Extract unique nodes from edgelist and indices
      const nodeSet = new Set<number>();
      structure.edgelist.forEach(([from, to]) => {
        nodeSet.add(from);
        nodeSet.add(to);
      });
      // Also add nodes from indices that might not be in edges
      Object.keys(structure.outgoing_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
      Object.keys(structure.incoming_index).forEach(nodeStr => nodeSet.add(parseInt(nodeStr)));
      
      const allNodes = Array.from(nodeSet);
      
      // Find sink nodes (nodes with no outgoing edges)
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
      
      // Apply highlighting and styling to the server-generated DOT
      dotString = this.applyVisualizationOptions(dotString);
      
      this.dotString.set(dotString);
      this.renderDotVisualization(dotString);
      
      this.snackBar.open('Visualization generated successfully using Julia backend!', 'Close', {
        duration: 2000
      });
    } catch (error) {
      console.error('Visualization generation failed:', error);
      
      // Fallback to local generation if server fails
      console.log('⚠️ Server DOT generation failed, falling back to local generation...');
      try {
        const structure = this.structure();
        if (structure) {
          let dotString = this.generateSampleDotString(structure);
          dotString = this.applyVisualizationOptions(dotString);
          this.dotString.set(dotString);
          this.renderDotVisualization(dotString);
          
          this.snackBar.open('Visualization generated using fallback method', 'Close', {
            duration: 3000
          });
        }
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        this.snackBar.open('Failed to generate visualization', 'Close', {
          duration: 3000
        });
      }
    } finally {
      this.isGeneratingDot.set(false);
    }
  }

  private generateSampleDotString(structure: any): string {
    const nodes = structure.nodes || [];
    const edges = structure.edges || [];
    
    let dot = 'digraph G {\n';
    dot += '  rankdir="TB";\n';
    dot += '  node [shape=circle, style=filled, fillcolor=lightblue];\n';
    dot += '  edge [color=gray];\n\n';
    
    // Add nodes
    nodes.forEach((node: any) => {
      dot += `  "${node.id}" [label="${node.id}"];\n`;
    });
    
    dot += '\n';
    
    // Add edges
    edges.forEach((edge: any) => {
      dot += `  "${edge.from}" -> "${edge.to}";\n`;
    });
    
    dot += '}\n';
    
    return dot;
  }

  private applyVisualizationOptions(dotString: string): string {
    let modifiedDot = dotString;
    
    // Apply layout engine
    const layout = this.selectedLayout();
    modifiedDot = modifiedDot.replace(/digraph\s+\w+\s*{/, `digraph G {
  layout="${layout}";
  rankdir="TB";
  splines="true";
  overlap="false";
  sep="+25,25";`);

    // Apply node highlighting
    const highlights = this.nodeHighlights();
    highlights.forEach(highlight => {
      const nodePattern = new RegExp(`"${highlight.nodeId}"\\s*\\[([^\\]]*)\\]`, 'g');
      modifiedDot = modifiedDot.replace(nodePattern, (match, attributes) => {
        const newAttributes = attributes ? 
          `${attributes}, fillcolor="${highlight.color}", style="filled"` :
          `fillcolor="${highlight.color}", style="filled"`;
        return `"${highlight.nodeId}" [${newAttributes}]`;
      });
    });

    // Apply node label settings
    if (!this.showNodeLabels()) {
      modifiedDot = modifiedDot.replace(/node\s*\[([^\]]*)\]/, (match, attributes) => {
        return `node [${attributes}, label=""]`;
      });
    }

    // Apply edge label settings
    if (!this.showEdgeLabels()) {
      modifiedDot = modifiedDot.replace(/edge\s*\[([^\]]*)\]/, (match, attributes) => {
        return `edge [${attributes}, label=""]`;
      });
    }

    return modifiedDot;
  }

  private async renderDotVisualization(dotString: string) {
    if (!this.dotContainer) return;

    try {
      const container = this.dotContainer.nativeElement;
      container.innerHTML = ''; // Clear previous content
      
      // Create D3 visualization
      this.createD3Visualization(container);
      
    } catch (error) {
      console.error('Failed to render DOT visualization:', error);
      this.snackBar.open('Failed to render visualization', 'Close', {
        duration: 3000
      });
    }
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
      name: `Node ${nodeId}`,
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

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => (d as D3Node).id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Create container group
    const g = svg.append('g');

    // Add links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.value) * 2);

    // Add nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', (d: any) => this.getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
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

    // Add labels
    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d: D3Node) => d.name)
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .attr('dy', 4);

    // Add tooltips
    node.append('title')
      .text((d: D3Node) => `${d.name}\nType: ${d.type}`);

    // Update positions on simulation tick
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private applyZoom() {
    if (!this.dotContainer) return;
    
    const zoomLevel = this.zoomLevel();
    const svg = d3.select(this.dotContainer.nativeElement).select('svg');
    
    if (!svg.empty()) {
      const transform = d3.zoomIdentity.scale(zoomLevel / 100);
      svg.call(d3.zoom().transform as any, transform);
    }
  }

  onLayoutChange() {
    if (this.dotString()) {
      this.generateVisualization();
    }
  }

  onZoomChange(value: number) {
    this.zoomLevel.set(value);
    this.applyZoom();
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
    // Future: Export as PNG/SVG
    this.snackBar.open('Export feature coming soon!', 'Close', {
      duration: 2000
    });
  }
}