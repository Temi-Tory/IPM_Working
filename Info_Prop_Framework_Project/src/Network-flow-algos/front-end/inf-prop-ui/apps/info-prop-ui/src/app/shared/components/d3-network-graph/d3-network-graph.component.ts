import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  AfterViewInit, 
  ElementRef,
  ViewEncapsulation,
  computed, 
  signal 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import * as d3 from 'd3';
import { graphConnect, sugiyama, decrossOpt, decrossTwoLayer, coordSimplex } from 'd3-dag';

// Interface for node detail data
export interface NodeDetail {
  node: number;
  type: string;
  inDegree: number;
  outDegree: number;
}

// Interface for edge detail data
export interface EdgeDetail {
  source: number;
  target: number;
  edgeType: string;
}

// Interface for edge selection event
export interface EdgeSelectionEvent {
  sourceId: number;
  targetId: number;
}

// Layout types
type LayoutType = 'sugiyama' | 'force' | 'grid';

@Component({
  selector: 'app-d3-network-graph',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
    <div class="d3-network-container" [class.fullscreen-mode]="isFullScreen()">
      <!-- Graph Controls (Floating when fullscreen) -->
      <div class="graph-controls-card" [class.floating-controls]="isFullScreen()">
        <div class="card-header">
          <mat-icon class="card-icon">tune</mat-icon>
          <div class="card-title">Graph Controls</div>
          @if (isFullScreen()) {
            <button mat-icon-button (click)="exitFullScreen()" class="close-button">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
        <div class="card-content">
          <div class="control-row" [class.vertical-controls]="isFullScreen()">
            <mat-form-field appearance="outline" class="layout-field">
              <mat-label>Layout Algorithm</mat-label>
              <mat-select [(value)]="selectedLayout" (selectionChange)="onLayoutChange()">
                <mat-option value="sugiyama">Hierarchical (Sugiyama)</mat-option>
                <mat-option value="force">Force-Directed</mat-option>
                <mat-option value="grid">Grid Layout</mat-option>
              </mat-select>
            </mat-form-field>
            
            <button mat-stroked-button (click)="resetZoom()" class="control-button" [class.compact-button]="isFullScreen()">
              <mat-icon>fit_screen</mat-icon>
              @if (!isFullScreen()) { Reset View }
            </button>
            
            <button mat-stroked-button (click)="centerGraph()" class="control-button" [class.compact-button]="isFullScreen()">
              <mat-icon>center_focus_strong</mat-icon>
              @if (!isFullScreen()) { Center }
            </button>
            
            @if (!isFullScreen()) {
              <button mat-stroked-button (click)="toggleFullScreen()" class="control-button">
                <mat-icon>fullscreen</mat-icon>
                Full Screen
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content" [class.fullscreen-content]="isFullScreen()">
        <!-- Graph Visualization -->
        <div class="graph-card" [class.fullscreen-graph]="isFullScreen()">
          @if (!isFullScreen()) {
            <div class="card-header">
              <mat-icon class="card-icon">device_hub</mat-icon>
              <div class="card-title">Network Visualization (D3)</div>
              <div class="card-subtitle">{{ filteredNodeCount }} nodes, {{ filteredEdgeCount }} edges</div>
            </div>
          }
          <div class="card-content graph-container">
            <div class="d3-graph-container"></div>
            
            @if (graphNodes().length === 0) {
              <div class="no-graph-data">
                <mat-icon class="empty-icon">device_hub</mat-icon>
                <h3>No Graph Data</h3>
                <p>Apply different filters to see nodes and edges in the graph view.</p>
              </div>
            }
            
            <!-- Fullscreen Info Overlay -->
            @if (isFullScreen()) {
              <div class="fullscreen-info-overlay">
                <div class="info-badge">
                  {{ filteredNodeCount }} nodes, {{ filteredEdgeCount }} edges
                </div>
                @if (selectedNodeDetail()) {
                  <div class="selected-node-info">
                    <div class="node-badge">
                      <strong>Node {{ selectedNodeDetail()?.node }}</strong>
                      <span class="node-type-badge" [class]="getNodeTypeClass(selectedNodeDetail()?.type)">
                        {{ selectedNodeDetail()?.type }}
                      </span>
                    </div>
                    <button mat-icon-button (click)="clearSelection()" class="clear-selection-btn">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Information Side Panel (hidden in fullscreen) -->
        @if (!isFullScreen()) {
          <div class="info-panel">
            @if (selectedNodeDetail()) {
              <!-- Node Details -->
              <div class="card-header">
                <mat-icon class="card-icon">info</mat-icon>
                <div class="card-title">Node Details</div>
                <button mat-icon-button (click)="clearSelection()" class="close-button">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <div class="card-content">
                <div class="detail-row">
                  <span class="detail-label">Node ID:</span>
                  <span class="detail-value">{{ selectedNodeDetail()?.node }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value node-type" [class]="getNodeTypeClass(selectedNodeDetail()?.type)">
                    {{ selectedNodeDetail()?.type }}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">In Degree:</span>
                  <span class="detail-value">{{ selectedNodeDetail()?.inDegree }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Out Degree:</span>
                  <span class="detail-value">{{ selectedNodeDetail()?.outDegree }}</span>
                </div>
              </div>
            } @else {
              <!-- General Graph Information -->
              <div class="card-header">
                <mat-icon class="card-icon">analytics</mat-icon>
                <div class="card-title">Graph Information</div>
              </div>
              <div class="card-content">
                <div class="detail-row">
                  <span class="detail-label">Total Nodes:</span>
                  <span class="detail-value">{{ filteredNodeCount }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Total Edges:</span>
                  <span class="detail-value">{{ filteredEdgeCount }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Layout:</span>
                  <span class="detail-value">{{ getLayoutDisplayName() }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Source Nodes:</span>
                  <span class="detail-value">{{ getNodeCountByType('Source') }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Sink Nodes:</span>
                  <span class="detail-value">{{ getNodeCountByType('Sink') }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Intermediate:</span>
                  <span class="detail-value">{{ getNodeCountByType('Intermediate') }}</span>
                </div>
                
                <div class="info-section">
                  <h4>Instructions</h4>
                  <p>Click on any node to view detailed information about that specific node.</p>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./d3-network-graph.component.scss'],
  encapsulation: ViewEncapsulation.None // Critical for D3 CSS styling
})
export class D3NetworkGraphComponent implements OnInit, AfterViewInit, OnDestroy {

  // Input properties
  @Input() nodes: NodeDetail[] = [];
  @Input() edges: EdgeDetail[] = [];
  @Input() filteredNodeCount = 0;
  @Input() filteredEdgeCount = 0;

  // Output events
  @Output() nodeSelected = new EventEmitter<number>();
  @Output() edgeSelected = new EventEmitter<EdgeSelectionEvent>();

  // Component state
  selectedLayout: LayoutType = 'force'; // Force-Directed as default
  selectedNodeDetail = signal<NodeDetail | null>(null);
  isFullScreen = signal<boolean>(false);
  
  // D3 elements
  private svg: any;
  private g: any;
  private simulation: any;
  private zoom: any;
  private dag: any;

  // Computed properties
  graphNodes = computed(() => this.transformToD3Nodes());
  graphLinks = computed(() => this.transformToD3Links());

  // Component dimensions
  private width = 800;
  private height = 600;
  private nodeRadius = 20;
  
  // Full-screen dimensions
  private fullScreenWidth = window.innerWidth;
  private fullScreenHeight = window.innerHeight;

  constructor(private elementRef: ElementRef) {
    // Listen for window resize to update full-screen dimensions
    window.addEventListener('resize', () => {
      this.fullScreenWidth = window.innerWidth;
      this.fullScreenHeight = window.innerHeight;
      if (this.isFullScreen()) {
        this.updateVisualization();
      }
    });
  }

  ngOnInit(): void {
    // Prepare data - following research best practices
    this.prepareData();
  }

  ngAfterViewInit(): void {
    // Initialize D3 visualization in ngAfterViewInit, not ngOnInit
    this.createDAG();
  }

  ngOnDestroy(): void {
    // Clean up D3 elements to prevent memory leaks
    if (this.simulation) {
      this.simulation.stop();
    }
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }
  }

  private prepareData(): void {
    // Data preparation logic
    console.log('📊 [D3NetworkGraph] Preparing data:', {
      nodes: this.nodes.length,
      edges: this.edges.length
    });
  }

  private createDAG(): void {
    const container = this.elementRef.nativeElement.querySelector('.d3-graph-container');
    
    // Clear any existing SVG
    d3.select(container).selectAll('*').remove();

    // Determine dimensions based on fullscreen state
    const containerRect = container.getBoundingClientRect();
    const svgWidth = this.isFullScreen() ? this.fullScreenWidth : containerRect.width || this.width;
    const svgHeight = this.isFullScreen() ? this.fullScreenHeight : containerRect.height || this.height;

    // Create SVG with theme-aware background
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      .style('background-color', 'var(--d3-canvas-bg)')
      .style('transition', 'background-color 0.3s ease');

    // Enhanced zoom behavior for better performance
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 8]) // Increased max zoom for better detail
      .on('zoom', (event) => {
        // Use requestAnimationFrame for smooth 60fps interactions
        requestAnimationFrame(() => {
          this.g.attr('transform', event.transform);
        });
      });

    this.svg.call(this.zoom);

    // Create main group for graph elements
    this.g = this.svg.append('g');

    // Enhanced arrow markers with theme integration
    this.svg.append('defs').selectAll('marker')
      .data(['end', 'active', 'hover'])
      .enter().append('marker')
      .attr('id', (d: string) => `arrowhead-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', (d: string) => {
        switch(d) {
          case 'active': return 'var(--d3-edge-active)';
          case 'hover': return 'var(--d3-edge-hover)';
          default: return 'var(--d3-edge-default)';
        }
      })
      .style('transition', 'fill 0.2s ease');

    // Initial render
    this.updateVisualization();
  }

  private transformToD3Nodes(): any[] {
    if (!this.nodes || !Array.isArray(this.nodes)) {
      return [];
    }
    
    return this.nodes.map(nodeDetail => ({
      id: nodeDetail.node.toString(),
      label: nodeDetail.node.toString(),
      type: nodeDetail.type,
      originalId: nodeDetail.node,
      inDegree: nodeDetail.inDegree,
      outDegree: nodeDetail.outDegree
    }));
  }

  private transformToD3Links(): any[] {
    if (!this.edges || !Array.isArray(this.edges)) {
      return [];
    }
    
    return this.edges.map(edgeDetail => ({
      source: edgeDetail.source.toString(),
      target: edgeDetail.target.toString(),
      sourceId: edgeDetail.source,
      targetId: edgeDetail.target,
      edgeType: edgeDetail.edgeType
    }));
  }

  private updateVisualization(): void {
    const nodes = this.graphNodes();
    const links = this.graphLinks();

    if (nodes.length === 0) {
      return;
    }

    // Clear existing elements
    this.g.selectAll('*').remove();

    switch (this.selectedLayout) {
      case 'sugiyama':
        this.renderSugiyamaLayout(nodes, links);
        break;
      case 'force':
        this.renderForceDirectedLayout(nodes, links);
        break;
      case 'grid':
        this.renderGridLayout(nodes, links);
        break;
    }
  }

  private renderSugiyamaLayout(nodes: any[], links: any[]): void {
    try {
      if (links.length === 0) {
        this.renderNodesOnly(nodes);
        return;
      }

      // Correct d3-dag implementation from research
      // graphConnect expects array of objects with string properties
      const linkPairs = links.map((link: any) => ({
        "0": link.source.toString(),
        "1": link.target.toString()
      }));
      const dagConnector = graphConnect();
      this.dag = dagConnector(linkPairs as any);

      // Configure Sugiyama layout with research recommendations
      // Use cheaper decrossing for large graphs (>100 nodes)
      const decrossStrategy = this.nodes.length > 100 ? decrossTwoLayer() : decrossOpt();
      
      const layout = sugiyama()
        .nodeSize(() => [
          this.nodeRadius * 3.6, // Following research formula
          this.nodeRadius * 3
        ])
        .decross(decrossStrategy) // Use appropriate decrossing strategy
        .coord(coordSimplex()); // coordinate assignment

      const { width, height } = layout(this.dag);

      // Update SVG viewBox
      this.svg.attr('viewBox', `0 0 ${width + 100} ${height + 100}`);

      this.renderNodes();
      this.renderEdges();

    } catch (error) {
      console.warn('⚠️ [D3NetworkGraph] Error creating Sugiyama layout:', error);
      // Handle "no roots" error as mentioned in research
      this.renderNodesOnly(nodes);
    }
  }

  private renderNodes(): void {
    // Render nodes following research patterns
    const nodeGroups = this.g.selectAll('.node')
      .data(this.dag.nodes())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => this.onNodeClick(d));

    nodeGroups.append('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: any) => this.getNodeColor(d.data.id))
      .attr('stroke', 'var(--outline)')
      .attr('stroke-width', 'var(--d3-node-stroke-width)');

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--on-surface)')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '1px 1px 2px var(--shadow)')
      .style('pointer-events', 'none')
      .text((d: any) => d.data.id);
  }

  private renderEdges(): void {
    // Render edges with simple straight lines (avoiding NaN issues)
    const linkElements = this.g.selectAll('.link')
      .data(this.dag.links())
      .enter().append('line')
      .attr('class', 'link')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
      .attr('stroke', 'var(--d3-edge-default)')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead-end)')
      .style('cursor', 'pointer')
      .on('mouseover', function(this: SVGLineElement) {
        d3.select(this)
          .attr('stroke', 'var(--d3-edge-hover)')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 3)
          .attr('marker-end', 'url(#arrowhead-hover)');
      })
      .on('mouseout', function(this: SVGLineElement) {
        d3.select(this)
          .attr('stroke', 'var(--d3-edge-default)')
          .attr('stroke-opacity', 0.7)
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead-end)');
      });
  }

  private renderForceDirectedLayout(nodes: any[], links: any[]): void {
    // Enhanced force simulation with better parameters for different screen sizes
    const containerRect = this.elementRef.nativeElement.querySelector('.d3-graph-container').getBoundingClientRect();
    const centerX = (this.isFullScreen() ? this.fullScreenWidth : containerRect.width || this.width) / 2;
    const centerY = (this.isFullScreen() ? this.fullScreenHeight : containerRect.height || this.height) / 2;
    
    // Optimized force parameters for better performance and visual appeal
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id)
        .distance(this.isFullScreen() ? 120 : 80)
        .strength(0.8))
      .force('charge', d3.forceManyBody()
        .strength(this.isFullScreen() ? -400 : -200)
        .distanceMax(this.isFullScreen() ? 300 : 200))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide().radius(this.nodeRadius + 10))
      .force('x', d3.forceX(centerX).strength(0.05))
      .force('y', d3.forceY(centerY).strength(0.05))
      .alphaDecay(0.02) // Slower cooling for smoother animation
      .velocityDecay(0.8); // More natural movement

    // Enhanced theme-aware links with solarized colors
    const linkElements = this.g.selectAll('.link')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', 'var(--d3-edge-default)')
      .attr('stroke-width', this.isFullScreen() ? 3 : 2)
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead-end)')
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s ease')
      .on('mouseover', function(this: SVGLineElement) {
        d3.select(this)
          .attr('stroke', 'var(--d3-edge-hover)')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 4)
          .attr('marker-end', 'url(#arrowhead-hover)');
      })
      .on('mouseout', function(this: SVGLineElement) {
        d3.select(this)
          .attr('stroke', 'var(--d3-edge-default)')
          .attr('stroke-opacity', 0.7)
          .attr('stroke-width', 3)
          .attr('marker-end', 'url(#arrowhead-end)');
      });

    // Enhanced theme-integrated nodes with hover effects
    const nodeGroups = this.g.selectAll('.node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.createDragBehavior())
      .on('click', (event: any, d: any) => this.onNodeClick(d))
      .on('mouseover', function(this: SVGGElement, event: any, d: any) {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', 25)
          .attr('stroke', 'var(--d3-node-hover-ring)')
          .attr('stroke-width', 'var(--d3-node-hover-stroke-width)')
          .style('filter', 'drop-shadow(4px 4px 8px var(--shadow))');
      })
      .on('mouseout', function(this: SVGGElement, event: any, d: any) {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', 20)
          .attr('stroke', 'var(--outline)')
          .attr('stroke-width', 'var(--d3-node-stroke-width)')
          .style('filter', 'drop-shadow(2px 2px 4px var(--shadow))');
      });

    nodeGroups.append('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: any) => this.getNodeColor(d.id))
      .attr('stroke', 'var(--outline)')
      .attr('stroke-width', 'var(--d3-node-stroke-width)')
      .style('filter', 'drop-shadow(2px 2px 4px var(--shadow))')
      .style('transition', 'all 0.2s ease');

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--on-surface)')
      .attr('font-size', this.isFullScreen() ? '14px' : '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '1px 1px 2px var(--shadow)')
      .style('pointer-events', 'none')
      .text((d: any) => d.label);

    // Optimized tick function for 60fps performance
    this.simulation.on('tick', () => {
      // Use requestAnimationFrame to ensure smooth 60fps updates
      requestAnimationFrame(() => {
        linkElements
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        nodeGroups
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
    });
  }

  private renderGridLayout(nodes: any[], links: any[]): void {
    // Simple grid layout for comparison
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(this.width / cols, this.height / cols) * 0.8;

    const nodeGroups = this.g.selectAll('.node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any, i: number) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col + 0.5) * spacing + 50;
        const y = (row + 0.5) * spacing + 50;
        return `translate(${x},${y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => this.onNodeClick(d));

    nodeGroups.append('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: any) => this.getNodeColor(d.id))
      .attr('stroke', 'var(--outline)')
      .attr('stroke-width', 'var(--d3-node-stroke-width)');

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--on-surface)')
      .style('text-shadow', '1px 1px 2px var(--shadow)')
      .style('pointer-events', 'none')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text((d: any) => d.label);
  }

  private renderNodesOnly(nodes: any[]): void {
    // Fallback when DAG creation fails
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(this.width / cols, this.height / cols) * 0.8;

    const nodeGroups = this.g.selectAll('.node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any, i: number) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col + 0.5) * spacing + 50;
        const y = (row + 0.5) * spacing + 50;
        return `translate(${x},${y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => this.onNodeClick(d));

    nodeGroups.append('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: any) => this.getNodeColor(d.id))
      .attr('stroke', 'var(--outline)')
      .attr('stroke-width', 'var(--d3-node-stroke-width)');

    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--on-surface)')
      .style('text-shadow', '1px 1px 2px var(--shadow)')
      .style('pointer-events', 'none')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text((d: any) => d.label);
  }

  private createDragBehavior(): any {
    return d3.drag()
      .on('start', (event: any, d: any) => {
        if (!event.active && this.simulation) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active && this.simulation) this.simulation.alphaTarget(0);
        // Keep nodes where they are dragged - no snap-back animation
        // This prevents trichophobia-triggering elastic animations
      });
  }

  private getNodeColor(nodeId: string | number): string {
    // Get node type for color determination
    const originalId = typeof nodeId === 'string' ? parseInt(nodeId) : nodeId;
    const nodeDetail = this.nodes.find(n => n.node === originalId);
    
    // Enhanced theme-integrated color system using D3-specific solarized variables
    const colors = {
      Source: 'var(--d3-node-source)', // Solarized green for source nodes
      Sink: 'var(--d3-node-sink)', // Solarized red for sink nodes  
      Intermediate: 'var(--d3-node-intermediate)', // Solarized blue for intermediate nodes
      Fork: 'var(--d3-node-fork)', // Solarized orange for fork nodes
      Join: 'var(--d3-node-join)', // Solarized violet for join nodes
      Hub: 'var(--d3-node-hub)', // Solarized magenta for hub nodes
      Regular: 'var(--d3-node-default)' // Default grey tone
    };
    
    return colors[nodeDetail?.type as keyof typeof colors] || colors.Regular;
  }

  private onNodeClick(d: any): void {
    const originalId = d.data ? parseInt(d.data.id) : parseInt(d.id);
    console.log('🖱️ [D3NetworkGraph] Node clicked:', originalId);
    
    // Update visual selection state - clear all selections
    this.g.selectAll('.node circle')
      .attr('stroke', 'var(--outline)')
      .attr('stroke-width', 'var(--d3-node-stroke-width)')
      .style('filter', 'drop-shadow(2px 2px 4px var(--shadow))');
    
    // Highlight selected node with solarized selection ring
    const selectedNode = this.g.selectAll('.node')
      .filter((nodeData: any) => {
        const id = nodeData.data ? parseInt(nodeData.data.id) : parseInt(nodeData.id);
        return id === originalId;
      });
    
    if (!selectedNode.empty()) {
      selectedNode.select('circle')
        .attr('stroke', 'var(--d3-node-selected-ring)')
        .attr('stroke-width', 'var(--d3-node-selected-stroke-width)')
        .style('filter', 'drop-shadow(6px 6px 12px var(--shadow))');
    }
    
    // Find and set the selected node detail for side panel
    const nodeDetail = this.nodes.find(n => n.node === originalId);
    if (nodeDetail) {
      this.selectedNodeDetail.set(nodeDetail);
    }
    
    // Emit event for parent component
    this.nodeSelected.emit(originalId);
  }

  clearSelection(): void {
    // Clear visual selection state
    if (this.g) {
      this.g.selectAll('.node circle')
        .attr('stroke', 'var(--outline)')
        .attr('stroke-width', 'var(--d3-node-stroke-width)')
        .style('filter', 'drop-shadow(2px 2px 4px var(--shadow))');
    }
    
    // Clear selection state
    this.selectedNodeDetail.set(null);
  }

  getNodeTypeClass(type: string | undefined): string {
    switch (type) {
      case 'Source': return 'source-type';
      case 'Sink': return 'sink-type';
      case 'Intermediate': return 'intermediate-type';
      default: return 'default-type';
    }
  }

  getLayoutDisplayName(): string {
    switch (this.selectedLayout) {
      case 'sugiyama': return 'Hierarchical (Sugiyama)';
      case 'force': return 'Force-Directed';
      case 'grid': return 'Grid Layout';
      default: return 'Unknown';
    }
  }

  getNodeCountByType(type: string): number {
    return this.nodes.filter(node => node.type === type).length;
  }

  onLayoutChange(): void {
    console.log('🔄 [D3NetworkGraph] Layout changed to:', this.selectedLayout);
    this.updateVisualization();
  }

  // Full-screen functionality
  toggleFullScreen(): void {
    this.isFullScreen.set(!this.isFullScreen());
    
    const container = this.elementRef.nativeElement.querySelector('.d3-network-container');
    
    if (this.isFullScreen()) {
      // Enter full-screen mode
      container.classList.add('fullscreen-mode');
      document.body.style.overflow = 'hidden';
    } else {
      // Exit full-screen mode
      container.classList.remove('fullscreen-mode');
      document.body.style.overflow = '';
    }
    
    // Re-render with new dimensions
    setTimeout(() => this.createDAG(), 100);
  }

  exitFullScreen(): void {
    if (this.isFullScreen()) {
      this.toggleFullScreen();
    }
  }

  resetZoom(): void {
    this.svg.transition().duration(750).call(
      this.zoom.transform,
      d3.zoomIdentity
    );
  }

  centerGraph(): void {
    const bounds = this.g.node()?.getBBox();
    if (!bounds) return;
    
    const containerRect = this.elementRef.nativeElement.querySelector('.d3-graph-container').getBoundingClientRect();
    const fullWidth = this.isFullScreen() ? this.fullScreenWidth : containerRect.width || this.width;
    const fullHeight = this.isFullScreen() ? this.fullScreenHeight : containerRect.height || this.height;
    
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    
    if (width === 0 || height === 0) return;
    
    const scale = Math.min(fullWidth / width, fullHeight / height) * 0.8;
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    this.svg.transition().duration(750).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }
}