import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { DataService, NetworkData } from '../../services/data.service';
import { Router } from '@angular/router';

declare const Viz: any;

interface LayoutOption {
  value: string;
  label: string;
  description: string;
}

interface ColorSchemeOption {
  value: string;
  label: string;
  description: string;
  nodeColor: string;
  edgeColor: string;
  highlightColor: string;
}

interface GraphDimensions {
  width: number;
  height: number;
  viewBox: { x: number; y: number; width: number; height: number };
}

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSliderModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  templateUrl: './visualization.component.html',
  styleUrls: ['./visualization.component.scss']
})
export class VisualizationComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('graphContainer') graphContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('svgElement') svgElement!: ElementRef<SVGElement>;

  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // Component state
  networkData: NetworkData | null = null;
  isLoading = false;
  isGeneratingVisualization = false;
  dotString = '';
  currentSvgContent = '';
  
  // Visualization state
  private currentZoom = 1;
  private currentPan = { x: 0, y: 0 };
  private isPanning = false;
  private lastPanPoint = { x: 0, y: 0 };
  private graphDimensions: GraphDimensions | null = null;
  selectedNodes = new Set<string>();
  selectedEdges = new Set<string>();

  // Control properties
  selectedLayout = 'dot';
  colorScheme = 'default';
  nodeSize = 50;
  edgeWidth = 2;
  showNodeLabels = true;
  showEdgeLabels = false;
  highlightConnected = true;
  enablePhysics = false;

  // Statistics Dashboard Properties
  selectedMetricFilter = 'all';
  chartViews = {
    nodeTypes: false,
    connectivity: false
  };
  
  // Performance tracking
  private visualizationStartTime = 0;
  private visualizationEndTime = 0;

  // Options
  layoutOptions: LayoutOption[] = [
    {
      value: 'dot',
      label: 'Hierarchical (DOT)',
      description: 'Top-down hierarchical layout ideal for DAGs and workflows'
    },
    {
      value: 'neato',
      label: 'Force-Directed (Neato)',
      description: 'Spring-based layout for undirected graphs'
    },
    {
      value: 'fdp',
      label: 'Force-Directed (FDP)',
      description: 'Force-directed layout with better node distribution'
    },
    {
      value: 'circo',
      label: 'Circular',
      description: 'Circular layout emphasizing cycles and symmetry'
    },
    {
      value: 'twopi',
      label: 'Radial',
      description: 'Radial layout with nodes arranged in concentric circles'
    }
  ];

  colorSchemeOptions: ColorSchemeOption[] = [
    {
      value: 'default',
      label: 'Default Blue',
      description: 'Clean blue theme suitable for professional presentations',
      nodeColor: '#2196F3',
      edgeColor: '#757575',
      highlightColor: '#FF5722'
    },
    {
      value: 'nature',
      label: 'Nature Green',
      description: 'Green theme representing growth and natural networks',
      nodeColor: '#4CAF50',
      edgeColor: '#8BC34A',
      highlightColor: '#FF9800'
    },
    {
      value: 'warm',
      label: 'Warm Sunset',
      description: 'Warm orange and red tones for engaging visualizations',
      nodeColor: '#FF9800',
      edgeColor: '#FF5722',
      highlightColor: '#3F51B5'
    },
    {
      value: 'cool',
      label: 'Cool Ocean',
      description: 'Cool blues and teals for calming, professional appearance',
      nodeColor: '#00BCD4',
      edgeColor: '#607D8B',
      highlightColor: '#E91E63'
    },
    {
      value: 'monochrome',
      label: 'Monochrome',
      description: 'Black and white theme for high contrast and clarity',
      nodeColor: '#424242',
      edgeColor: '#9E9E9E',
      highlightColor: '#F44336'
    }
  ];

  ngOnInit(): void {
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
        if (data && !this.currentSvgContent) {
          this.generateVisualization();
        }
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    // Load Viz.js library
    this.loadVizJs();
  }

  ngAfterViewInit(): void {
    this.setupGraphContainer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadVizJs(): void {
    if (typeof Viz !== 'undefined') {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@hpcc-js/wasm@1.12.8/dist/index.min.js';
    script.onload = () => {
      console.log('Viz.js loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Viz.js');
      this.snackBar.open('Failed to load visualization library', 'Dismiss', { duration: 5000 });
    };
    document.head.appendChild(script);
  }

  private setupGraphContainer(): void {
    if (!this.graphContainer) return;

    const container = this.graphContainer.nativeElement;
    
    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomBy(delta, { x: e.clientX, y: e.clientY });
    });

    // Mouse drag pan
    container.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.startPan(e.clientX, e.clientY);
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.updatePan(e.clientX, e.clientY);
      }
    });

    container.addEventListener('mouseup', () => {
      this.endPan();
    });

    container.addEventListener('mouseleave', () => {
      this.endPan();
    });

    // Double-click to reset zoom
    container.addEventListener('dblclick', () => {
      this.resetZoom();
    });
  }

  async generateVisualization(): Promise<void> {
    if (!this.networkData) return;

    this.visualizationStartTime = performance.now();
    this.isGeneratingVisualization = true;
    this.cdr.detectChanges();

    try {
      // Get DOT string from server
      const dotResponse = await this.getDotString();
      if (!dotResponse.success) {
        throw new Error(dotResponse.error || 'Failed to generate DOT string');
      }

      this.dotString = dotResponse.dotString;
      
      // Generate SVG using Viz.js
      await this.renderSvgFromDot();
      
      this.visualizationEndTime = performance.now();
      this.snackBar.open('Visualization generated successfully!', 'Dismiss', { duration: 3000 });
    } catch (error) {
      console.error('Visualization generation failed:', error);
      this.visualizationEndTime = performance.now();
      this.snackBar.open('Failed to generate visualization', 'Dismiss', { duration: 5000 });
    } finally {
      this.isGeneratingVisualization = false;
      this.cdr.detectChanges();
    }
  }

  private async getDotString(): Promise<any> {
    const requestData = {
      networkData: {
        nodes: this.getNodeIds(),
        edges: this.getEdgeList()
      }
    };

    try {
      const response = await this.http.post<any>('http://localhost:8080/api/export-dot', requestData).toPromise();
      return response;
    } catch (error: any) {
      // Handle 404 and other HTTP errors gracefully
      if (error.status === 404 || error.status === 0) {
        console.info('Backend DOT export service not available, using local generation');
      } else {
        console.warn('DOT export service error:', error.message);
      }
      
      // Generate a basic DOT string locally as fallback
      return {
        success: true,
        dotString: this.generateLocalDotString()
      };
    }
  }

  private generateLocalDotString(): string {
    if (!this.networkData) return 'digraph G { }';
    
    const nodes = this.getNodeIds();
    const edges = this.getEdgeList();
    
    let dotString = 'digraph G {\n';
    dotString += '  rankdir=TB;\n';
    dotString += '  node [shape=ellipse, style=filled];\n';
    
    // Add nodes
    nodes.forEach(node => {
      dotString += `  "${node}" [label="${node}"];\n`;
    });
    
    // Add edges
    edges.forEach(([from, to]) => {
      dotString += `  "${from}" -> "${to}";\n`;
    });
    
    dotString += '}';
    return dotString;
  }

  private getNodeIds(): string[] {
    if (!this.networkData) return [];
    
    const allNodes = new Set<string>();
    
    if (this.networkData.sourceNodes) {
      this.networkData.sourceNodes.forEach(node => allNodes.add(node.toString()));
    }
    if (this.networkData.sinkNodes) {
      this.networkData.sinkNodes.forEach(node => allNodes.add(node.toString()));
    }
    if (this.networkData.forkNodes) {
      this.networkData.forkNodes.forEach(node => allNodes.add(node.toString()));
    }
    if (this.networkData.joinNodes) {
      this.networkData.joinNodes.forEach(node => allNodes.add(node.toString()));
    }

    return Array.from(allNodes);
  }

  private getEdgeList(): [string, string][] {
    if (!this.networkData?.edgeList) return [];
    
    return this.networkData.edgeList.map(edge => [
      edge.from.toString(),
      edge.to.toString()
    ]);
  }

  private async renderSvgFromDot(): Promise<void> {
    if (!this.dotString) return;

    try {
      const { Graphviz } = await import('@hpcc-js/wasm');
      const graphviz = await Graphviz.load();
      
      // Customize DOT string with current settings
      const customizedDot = this.customizeDotString(this.dotString);
      
      // Generate SVG
      const svg = graphviz.dot(customizedDot);
      
      this.currentSvgContent = svg;
      this.displaySvg(svg);
      
      // Auto-center the visualization on first load
      setTimeout(() => {
        this.centerAndFitGraph();
      }, 100);
      
    } catch (error) {
      console.error('Failed to render SVG:', error);
      throw error;
    }
  }

  private customizeDotString(dot: string): string {
    const colorScheme = this.getSelectedColorScheme();
    
    // Customize based on current settings
    let customizedDot = dot.replace(/digraph\s*{/, `digraph {
      layout="${this.selectedLayout}";
      node [
        style="filled",
        fillcolor="${colorScheme.nodeColor}",
        fontcolor="white",
        fontsize="${Math.max(8, this.nodeSize / 6)}",
        width="${this.nodeSize / 50}",
        height="${this.nodeSize / 50}"
      ];
      edge [
        color="${colorScheme.edgeColor}",
        penwidth="${this.edgeWidth}",
        fontsize="10"
      ];
    `);

    // Add node labels based on settings
    if (!this.showNodeLabels) {
      customizedDot = customizedDot.replace(/label="[^"]*"/g, 'label=""');
    }

    return customizedDot;
  }

  private displaySvg(svgContent: string): void {
    if (!this.graphContainer) return;

    const container = this.graphContainer.nativeElement;
    container.innerHTML = svgContent;

    const svgElement = container.querySelector('svg');
    if (svgElement) {
      this.setupSvgInteractions(svgElement);
      this.extractGraphDimensions(svgElement);
      this.resetZoom();
    }
  }

  private setupSvgInteractions(svg: SVGElement): void {
    // Add click handlers for nodes and edges
    const nodes = svg.querySelectorAll('.node');
    const edges = svg.querySelectorAll('.edge');

    nodes.forEach((node, index) => {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onNodeClick(node as SVGElement);
      });

      node.addEventListener('mouseenter', () => {
        this.onNodeHover(node as SVGElement, true);
      });

      node.addEventListener('mouseleave', () => {
        this.onNodeHover(node as SVGElement, false);
      });
    });

    edges.forEach((edge, index) => {
      edge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onEdgeClick(edge as SVGElement);
      });
    });

    // Clear selection on background click
    svg.addEventListener('click', () => {
      this.clearSelection();
    });
  }

  private extractGraphDimensions(svg: SVGElement): void {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const [x, y, width, height] = viewBox.split(' ').map(Number);
      this.graphDimensions = {
        width: svg.clientWidth,
        height: svg.clientHeight,
        viewBox: { x, y, width, height }
      };
    }
  }

  private onNodeClick(node: SVGElement): void {
    const nodeId = this.getNodeId(node);
    if (!nodeId) return;

    if (this.selectedNodes.has(nodeId)) {
      this.selectedNodes.delete(nodeId);
      this.removeNodeHighlight(node);
    } else {
      this.selectedNodes.add(nodeId);
      this.addNodeHighlight(node);
    }

    if (this.highlightConnected) {
      this.updateConnectedHighlights();
    }
  }

  private onEdgeClick(edge: SVGElement): void {
    const edgeId = this.getEdgeId(edge);
    if (!edgeId) return;

    if (this.selectedEdges.has(edgeId)) {
      this.selectedEdges.delete(edgeId);
      this.removeEdgeHighlight(edge);
    } else {
      this.selectedEdges.add(edgeId);
      this.addEdgeHighlight(edge);
    }
  }

  private onNodeHover(node: SVGElement, isEntering: boolean): void {
    if (isEntering) {
      this.addNodeHoverEffect(node);
    } else {
      this.removeNodeHoverEffect(node);
    }
  }

  private getNodeId(node: SVGElement): string | null {
    const title = node.querySelector('title');
    return title ? title.textContent : null;
  }

  private getEdgeId(edge: SVGElement): string | null {
    const title = edge.querySelector('title');
    return title ? title.textContent : null;
  }

  private addNodeHighlight(node: SVGElement): void {
    const ellipse = node.querySelector('ellipse, circle, polygon');
    if (ellipse) {
      ellipse.setAttribute('stroke', this.getSelectedColorScheme().highlightColor);
      ellipse.setAttribute('stroke-width', '3');
    }
  }

  private removeNodeHighlight(node: SVGElement): void {
    const ellipse = node.querySelector('ellipse, circle, polygon');
    if (ellipse) {
      ellipse.removeAttribute('stroke');
      ellipse.removeAttribute('stroke-width');
    }
  }

  private addEdgeHighlight(edge: SVGElement): void {
    const path = edge.querySelector('path');
    if (path) {
      path.setAttribute('stroke', this.getSelectedColorScheme().highlightColor);
      path.setAttribute('stroke-width', '3');
    }
  }

  private removeEdgeHighlight(edge: SVGElement): void {
    const path = edge.querySelector('path');
    if (path) {
      path.setAttribute('stroke', this.getSelectedColorScheme().edgeColor);
      path.setAttribute('stroke-width', this.edgeWidth.toString());
    }
  }

  private addNodeHoverEffect(node: SVGElement): void {
    const ellipse = node.querySelector('ellipse, circle, polygon');
    if (ellipse && !this.selectedNodes.has(this.getNodeId(node) || '')) {
      ellipse.setAttribute('opacity', '0.8');
    }
  }

  private removeNodeHoverEffect(node: SVGElement): void {
    const ellipse = node.querySelector('ellipse, circle, polygon');
    if (ellipse && !this.selectedNodes.has(this.getNodeId(node) || '')) {
      ellipse.setAttribute('opacity', '1');
    }
  }

  private updateConnectedHighlights(): void {
    if (!this.graphContainer) return;

    const svg = this.graphContainer.nativeElement.querySelector('svg');
    if (!svg) return;

    // Remove existing connected highlights
    svg.querySelectorAll('.connected-highlight').forEach(el => {
      el.classList.remove('connected-highlight');
    });

    // Add highlights for connected elements
    this.selectedNodes.forEach(nodeId => {
      this.highlightConnectedElements(svg, nodeId);
    });
  }

  private highlightConnectedElements(svg: SVGElement, nodeId: string): void {
    const edges = svg.querySelectorAll('.edge');
    edges.forEach(edge => {
      const edgeId = this.getEdgeId(edge as SVGElement);
      if (edgeId && (edgeId.includes(nodeId))) {
        edge.classList.add('connected-highlight');
      }
    });
  }

  clearSelection(): void {
    this.selectedNodes.clear();
    this.selectedEdges.clear();
    
    if (!this.graphContainer) return;
    
    const svg = this.graphContainer.nativeElement.querySelector('svg');
    if (!svg) return;

    // Remove all highlights
    svg.querySelectorAll('.node').forEach(node => {
      this.removeNodeHighlight(node as SVGElement);
    });

    svg.querySelectorAll('.edge').forEach(edge => {
      this.removeEdgeHighlight(edge as SVGElement);
    });

    svg.querySelectorAll('.connected-highlight').forEach(el => {
      el.classList.remove('connected-highlight');
    });
  }

  // Zoom and pan methods
  private startPan(x: number, y: number): void {
    this.isPanning = true;
    this.lastPanPoint = { x, y };
  }

  private updatePan(x: number, y: number): void {
    if (!this.isPanning || !this.graphContainer) return;

    const deltaX = x - this.lastPanPoint.x;
    const deltaY = y - this.lastPanPoint.y;

    this.currentPan.x += deltaX;
    this.currentPan.y += deltaY;
    this.lastPanPoint = { x, y };

    this.applyTransform();
  }

  private endPan(): void {
    this.isPanning = false;
  }

  private zoomBy(factor: number, center?: { x: number; y: number }): void {
    const newZoom = Math.max(0.1, Math.min(5, this.currentZoom * factor));
    
    if (center && this.graphContainer) {
      const rect = this.graphContainer.nativeElement.getBoundingClientRect();
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;
      
      const zoomChange = newZoom - this.currentZoom;
      this.currentPan.x -= centerX * zoomChange / this.currentZoom;
      this.currentPan.y -= centerY * zoomChange / this.currentZoom;
    }
    
    this.currentZoom = newZoom;
    this.applyTransform();
  }

  private applyTransform(): void {
    if (!this.graphContainer) return;

    const svg = this.graphContainer.nativeElement.querySelector('svg');
    if (!svg) return;

    const g = svg.querySelector('g');
    if (g) {
      g.setAttribute('transform', 
        `translate(${this.currentPan.x}, ${this.currentPan.y}) scale(${this.currentZoom})`
      );
    }
  }

  // Control methods
  onLayoutChange(): void {
    this.generateVisualization();
  }

  onNodeSizeChange(): void {
    this.generateVisualization();
  }

  onEdgeWidthChange(): void {
    this.generateVisualization();
  }

  onColorSchemeChange(): void {
    this.generateVisualization();
  }

  toggleNodeLabels(): void {
    this.showNodeLabels = !this.showNodeLabels;
    this.generateVisualization();
  }

  toggleEdgeLabels(): void {
    this.showEdgeLabels = !this.showEdgeLabels;
    this.generateVisualization();
  }

  // Utility methods
  zoomIn(): void {
    this.zoomBy(1.2);
  }

  zoomOut(): void {
    this.zoomBy(0.8);
  }

  resetZoom(): void {
    this.currentZoom = 1;
    this.currentPan = { x: 0, y: 0 };
    this.applyTransform();
  }

  centerGraph(): void {
    if (!this.graphContainer || !this.graphDimensions) return;

    const container = this.graphContainer.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    this.currentPan.x = (containerRect.width - this.graphDimensions.viewBox.width) / 2;
    this.currentPan.y = (containerRect.height - this.graphDimensions.viewBox.height) / 2;
    
    this.applyTransform();
  }

  centerAndFitGraph(): void {
    if (!this.graphContainer) return;

    const container = this.graphContainer.nativeElement;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Get SVG viewBox or use SVG dimensions
    const viewBox = svg.getAttribute('viewBox');
    let svgWidth, svgHeight;

    if (viewBox) {
      const [, , width, height] = viewBox.split(' ').map(Number);
      svgWidth = width;
      svgHeight = height;
    } else {
      svgWidth = svg.clientWidth || 800;
      svgHeight = svg.clientHeight || 600;
    }

    // Calculate scale to fit the graph in the container with some padding
    const padding = 40;
    const scaleX = (containerWidth - padding * 2) / svgWidth;
    const scaleY = (containerHeight - padding * 2) / svgHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

    // Calculate center position
    const scaledWidth = svgWidth * scale;
    const scaledHeight = svgHeight * scale;
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;

    // Apply the transformation
    this.currentZoom = scale;
    this.currentPan = { x: centerX, y: centerY };
    this.applyTransform();

    // Update graph dimensions for future reference
    this.graphDimensions = {
      width: containerWidth,
      height: containerHeight,
      viewBox: { x: 0, y: 0, width: svgWidth, height: svgHeight }
    };
  }

  exportVisualization(): void {
    if (!this.currentSvgContent) {
      this.snackBar.open('No visualization to export', 'Dismiss', { duration: 3000 });
      return;
    }

    const blob = new Blob([this.currentSvgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'network-visualization.svg';
    link.click();
    URL.revokeObjectURL(url);

    this.snackBar.open('Visualization exported as SVG!', 'Dismiss', { duration: 3000 });
  }

  // Getter methods for template
  getCurrentLayoutLabel(): string {
    const layout = this.layoutOptions.find(l => l.value === this.selectedLayout);
    return layout ? layout.label : 'Unknown';
  }

  getCurrentLayoutDescription(): string {
    const layout = this.layoutOptions.find(l => l.value === this.selectedLayout);
    return layout ? layout.description : '';
  }

  getCurrentColorSchemeLabel(): string {
    const scheme = this.colorSchemeOptions.find(c => c.value === this.colorScheme);
    return scheme ? scheme.label : 'Unknown';
  }

  getCurrentColorSchemeDescription(): string {
    const scheme = this.colorSchemeOptions.find(c => c.value === this.colorScheme);
    return scheme ? scheme.description : '';
  }

  private getSelectedColorScheme(): ColorSchemeOption {
    return this.colorSchemeOptions.find(c => c.value === this.colorScheme) || this.colorSchemeOptions[0];
  }

  // Navigation methods
  navigateToUpload(): void {
    this.router.navigate(['/upload']);
  }

  navigateToStructure(): void {
    this.router.navigate(['/structure']);
  }

  navigateToDiamonds(): void {
    this.router.navigate(['/diamonds']);
  }

  // Statistics Dashboard Methods
  onMetricFilterChange(): void {
    // Filter metrics based on selection
    console.log('Metric filter changed to:', this.selectedMetricFilter);
  }

  isMetricVisible(category: string): boolean {
    return this.selectedMetricFilter === 'all' || this.selectedMetricFilter === category;
  }

  toggleChartView(chartType: string): void {
    if (chartType === 'nodeTypes') {
      this.chartViews.nodeTypes = !this.chartViews.nodeTypes;
    }
  }

  exportStatistics(): void {
    const stats = this.generateStatisticsReport();
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'network-statistics.json';
    link.click();
    URL.revokeObjectURL(url);
    
    this.snackBar.open('Statistics exported successfully!', 'Dismiss', { duration: 3000 });
  }

  refreshStatistics(): void {
    // Trigger recalculation of statistics
    this.snackBar.open('Statistics refreshed!', 'Dismiss', { duration: 2000 });
  }

  private generateStatisticsReport(): any {
    return {
      timestamp: new Date().toISOString(),
      networkOverview: {
        nodes: this.networkData?.nodeCount || 0,
        edges: this.networkData?.edgeCount || 0,
        density: this.getNetworkDensity(),
        averageConnectivity: this.getAverageConnectivity()
      },
      nodeDistribution: this.getNodeTypeData(),
      connectivity: {
        sources: this.networkData?.sourceNodes?.length || 0,
        sinks: this.networkData?.sinkNodes?.length || 0,
        forks: this.networkData?.forkNodes?.length || 0,
        joins: this.networkData?.joinNodes?.length || 0
      },
      health: {
        connectivity: this.getConnectivityHealthStatus(),
        balance: this.getBalanceHealthStatus(),
        complexity: this.getComplexityHealthStatus()
      },
      performance: {
        visualizationTime: this.getVisualizationTime(),
        renderQuality: this.getRenderQuality(),
        memoryUsage: this.getMemoryUsage()
      }
    };
  }

  // Network Analysis Methods
  getNetworkDensity(): number {
    if (!this.networkData) return 0;
    const nodes = this.networkData.nodeCount;
    const edges = this.networkData.edgeCount;
    const maxPossibleEdges = nodes * (nodes - 1);
    return maxPossibleEdges > 0 ? (edges / maxPossibleEdges) : 0;
  }

  getAverageConnectivity(): number {
    if (!this.networkData) return 0;
    const nodes = this.networkData.nodeCount;
    const edges = this.networkData.edgeCount;
    return nodes > 0 ? (edges * 2) / nodes : 0;
  }

  getNodeTypeData(): any[] {
    if (!this.networkData) return [];
    
    const total = this.networkData.nodeCount;
    const types = [
      {
        label: 'Source',
        value: this.networkData.sourceNodes?.length || 0,
        color: '#4CAF50'
      },
      {
        label: 'Sink',
        value: this.networkData.sinkNodes?.length || 0,
        color: '#F44336'
      },
      {
        label: 'Fork',
        value: this.networkData.forkNodes?.length || 0,
        color: '#FF9800'
      },
      {
        label: 'Join',
        value: this.networkData.joinNodes?.length || 0,
        color: '#9C27B0'
      }
    ];

    // Calculate regular nodes
    const specialNodes = types.reduce((sum, type) => sum + type.value, 0);
    const regularNodes = total - specialNodes;
    
    if (regularNodes > 0) {
      types.push({
        label: 'Regular',
        value: regularNodes,
        color: '#2196F3'
      });
    }

    // Add percentages
    return types.map(type => ({
      ...type,
      percentage: total > 0 ? (type.value / total) * 100 : 0
    }));
  }

  // Percentage calculations for connectivity bars
  getSourcePercentage(): number {
    if (!this.networkData) return 0;
    return this.networkData.nodeCount > 0 ?
      (this.networkData.sourceNodes?.length || 0) / this.networkData.nodeCount * 100 : 0;
  }

  getSinkPercentage(): number {
    if (!this.networkData) return 0;
    return this.networkData.nodeCount > 0 ?
      (this.networkData.sinkNodes?.length || 0) / this.networkData.nodeCount * 100 : 0;
  }

  getForkPercentage(): number {
    if (!this.networkData) return 0;
    return this.networkData.nodeCount > 0 ?
      (this.networkData.forkNodes?.length || 0) / this.networkData.nodeCount * 100 : 0;
  }

  getJoinPercentage(): number {
    if (!this.networkData) return 0;
    return this.networkData.nodeCount > 0 ?
      (this.networkData.joinNodes?.length || 0) / this.networkData.nodeCount * 100 : 0;
  }

  // Health Analysis Methods
  getConnectivityHealthClass(): string {
    const density = this.getNetworkDensity();
    if (density > 0.7) return 'health-excellent';
    if (density > 0.4) return 'health-good';
    if (density > 0.2) return 'health-fair';
    return 'health-poor';
  }

  getConnectivityHealthIcon(): string {
    const density = this.getNetworkDensity();
    if (density > 0.7) return 'check_circle';
    if (density > 0.4) return 'check';
    if (density > 0.2) return 'warning';
    return 'error';
  }

  getConnectivityHealthStatus(): string {
    const density = this.getNetworkDensity();
    if (density > 0.7) return 'Excellent';
    if (density > 0.4) return 'Good';
    if (density > 0.2) return 'Fair';
    return 'Poor';
  }

  getBalanceHealthClass(): string {
    if (!this.networkData) return 'health-poor';
    const sources = this.networkData.sourceNodes?.length || 0;
    const sinks = this.networkData.sinkNodes?.length || 0;
    const ratio = sources > 0 ? sinks / sources : 0;
    
    if (ratio >= 0.8 && ratio <= 1.2) return 'health-excellent';
    if (ratio >= 0.6 && ratio <= 1.4) return 'health-good';
    if (ratio >= 0.4 && ratio <= 1.6) return 'health-fair';
    return 'health-poor';
  }

  getBalanceHealthIcon(): string {
    const healthClass = this.getBalanceHealthClass();
    switch (healthClass) {
      case 'health-excellent': return 'balance';
      case 'health-good': return 'check';
      case 'health-fair': return 'warning';
      default: return 'error';
    }
  }

  getBalanceHealthStatus(): string {
    const healthClass = this.getBalanceHealthClass();
    switch (healthClass) {
      case 'health-excellent': return 'Balanced';
      case 'health-good': return 'Good';
      case 'health-fair': return 'Fair';
      default: return 'Unbalanced';
    }
  }

  getComplexityHealthClass(): string {
    if (!this.networkData) return 'health-poor';
    const complexity = this.networkData.nodeCount + this.networkData.edgeCount;
    
    if (complexity < 50) return 'health-excellent';
    if (complexity < 200) return 'health-good';
    if (complexity < 500) return 'health-fair';
    return 'health-poor';
  }

  getComplexityHealthIcon(): string {
    const healthClass = this.getComplexityHealthClass();
    switch (healthClass) {
      case 'health-excellent': return 'speed';
      case 'health-good': return 'check';
      case 'health-fair': return 'warning';
      default: return 'error';
    }
  }

  getComplexityHealthStatus(): string {
    const healthClass = this.getComplexityHealthClass();
    switch (healthClass) {
      case 'health-excellent': return 'Simple';
      case 'health-good': return 'Moderate';
      case 'health-fair': return 'Complex';
      default: return 'Very Complex';
    }
  }

  // Selection Analysis Methods
  getSelectionDensity(): number {
    if (!this.networkData || this.selectedNodes.size === 0) return 0;
    return (this.selectedNodes.size / this.networkData.nodeCount) * 100;
  }

  getSelectedConnectedComponents(): number {
    // Simplified calculation - in a real implementation, you'd analyze the graph structure
    return this.selectedNodes.size > 0 ? Math.ceil(this.selectedNodes.size / 3) : 0;
  }

  // Performance Methods
  getVisualizationTime(): number {
    return this.visualizationEndTime - this.visualizationStartTime;
  }

  getRenderQuality(): string {
    const time = this.getVisualizationTime();
    if (time < 100) return 'Excellent';
    if (time < 500) return 'Good';
    if (time < 1000) return 'Fair';
    return 'Poor';
  }

  getMemoryUsage(): number {
    // Estimate based on network size
    if (!this.networkData) return 0;
    const baseMemory = 2; // Base memory in MB
    const nodeMemory = this.networkData.nodeCount * 0.001; // 1KB per node
    const edgeMemory = this.networkData.edgeCount * 0.0005; // 0.5KB per edge
    return Math.round((baseMemory + nodeMemory + edgeMemory) * 100) / 100;
  }
}