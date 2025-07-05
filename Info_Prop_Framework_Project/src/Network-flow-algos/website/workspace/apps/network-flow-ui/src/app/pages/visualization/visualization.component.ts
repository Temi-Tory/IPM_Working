import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { graphviz } from 'd3-graphviz';
import * as d3 from 'd3';

// Import state services
import { VisualizationStateService, LayoutType, DiamondVisualizationService } from '@network-analysis/visualization';
import {
  NetworkStateService,
  NetworkData,
  AnalysisStateService,
  AnalysisResults,
  DiamondStateService,
  DiamondStructure,
  DiamondType
} from '@network-analysis/network-core';

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './visualization.component.html',
  styleUrl: './visualization.component.scss'
})
export class VisualizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphvizContainer', { static: false }) graphvizContainer!: ElementRef<HTMLDivElement>;

  // Inject services using Angular 20 inject()
  private readonly visualizationState = inject(VisualizationStateService);
  private readonly networkState = inject(NetworkStateService);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly diamondState = inject(DiamondStateService);
  private readonly diamondVisualization = inject(DiamondVisualizationService);

  // D3-Graphviz instance and SVG reference
  private graphvizRenderer: ReturnType<typeof graphviz> | null = null;
  private svgElement: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private currentTransform: d3.ZoomTransform = d3.zoomIdentity;

  // Component signals
  readonly isInitialized = signal(false);
  readonly selectedLayout = signal<LayoutType>('dagre');
  readonly nodeSize = signal(30);
  readonly edgeWidth = signal(2);
  readonly showLabels = signal(true);
  readonly interactivityEnabled = signal(true);
  readonly diamondMode = signal(false);
  readonly selectedDiamondType = signal<DiamondType | 'all'>('all');
  readonly showDiamondPaths = signal(false);
  readonly animateDiamonds = signal(false);

  // Computed signals from services
  readonly networkData = this.networkState.networkData;
  readonly isNetworkLoaded = this.networkState.isNetworkLoaded;
  readonly nodeCount = this.networkState.nodeCount;
  readonly edgeCount = this.networkState.edgeCount;
  readonly analysisResults = this.analysisState.currentAnalysis;
  readonly isAnalysisRunning = this.analysisState.isRunning;
  readonly visualizationSettings = this.visualizationState.settings;
  readonly selectionState = this.visualizationState.selection;
  
  // Diamond-related computed signals
  readonly diamonds = this.diamondState.diamonds;
  readonly diamondCount = this.diamondState.diamondCount;
  readonly diamondClassifications = this.diamondState.classifications;
  readonly diamondAnalysisStatus = this.diamondState.analysisStatus;
  readonly diamondStatistics = this.diamondState.diamondStatistics;
  readonly selectedDiamonds = this.diamondVisualization.selectedDiamonds;
  readonly hoveredDiamond = this.diamondVisualization.hoveredDiamond;
  readonly diamondHighlightData = this.diamondVisualization.diamondHighlightData;
  readonly canAnalyzeDiamonds = this.diamondState.canAnalyze;

  // Layout options for Graphviz
  readonly layoutOptions: Array<{ value: LayoutType; label: string }> = [
    { value: 'dagre', label: 'Hierarchical (DOT)' },
    { value: 'hierarchical', label: 'Hierarchical (Neato)' },
    { value: 'circular', label: 'Circular (Circo)' },
    { value: 'force-directed', label: 'Force Directed (FDP)' }
  ];

  // Diamond type options
  readonly diamondTypeOptions: Array<{ value: DiamondType | 'all'; label: string }> = [
    { value: 'all', label: 'All Diamond Types' },
    { value: DiamondType.SIMPLE, label: 'Simple Diamonds' },
    { value: DiamondType.NESTED, label: 'Nested Diamonds' },
    { value: DiamondType.OVERLAPPING, label: 'Overlapping Diamonds' },
    { value: DiamondType.CASCADE, label: 'Cascade Diamonds' },
    { value: DiamondType.PARALLEL, label: 'Parallel Diamonds' }
  ];

  constructor() {
    // Effect: Initialize Graphviz when network data is available
    effect(() => {
      const networkData = this.networkData();
      if (networkData && this.graphvizRenderer) {
        this.renderNetwork(networkData);
      }
    });

    // Effect: Update visualization when settings change
    effect(() => {
      const settings = this.visualizationSettings();
      if (this.graphvizRenderer && settings) {
        this.updateVisualizationSettings(settings);
      }
    });

    // Effect: Update analysis results visualization
    effect(() => {
      const results = this.analysisResults();
      if (this.graphvizRenderer && results) {
        this.updateAnalysisVisualization(results);
      }
    });

    // Effect: Update diamond visualization
    effect(() => {
      const diamonds = this.diamonds();
      const diamondMode = this.diamondMode();
      if (this.graphvizRenderer && diamonds.length > 0 && diamondMode) {
        this.updateDiamondVisualization();
      }
    });

    // Effect: Handle diamond selection changes
    effect(() => {
      const selectedDiamonds = this.selectedDiamonds();
      const hoveredDiamond = this.hoveredDiamond();
      if (this.svgElement) {
        this.updateDiamondHighlighting(selectedDiamonds, hoveredDiamond);
      }
    });
  }

  ngOnInit(): void {
    console.log('VisualizationComponent initialized');
    
    // Add window resize listener for responsive behavior
    window.addEventListener('resize', this.handleWindowResize.bind(this));
  }

  ngAfterViewInit(): void {
    this.initializeGraphviz();
  }

  ngOnDestroy(): void {
    if (this.graphvizRenderer) {
      this.graphvizRenderer = null;
    }
    
    // Remove window resize listener
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
  }

  // Initialize d3-graphviz
  private initializeGraphviz(): void {
    // Add a small delay to ensure the DOM is ready
    setTimeout(() => {
      if (!this.graphvizContainer?.nativeElement) {
        console.error('Graphviz container not found');
        return;
      }
      this.setupGraphviz();
    }, 100);
  }

  private setupGraphviz(): void {
    try {
      const container = this.graphvizContainer.nativeElement;
      const containerRect = container.getBoundingClientRect();
      
      // Calculate proper dimensions within the allocated container
      const width = Math.max(400, containerRect.width || 800);
      const height = Math.max(300, containerRect.height || 600);
      
      this.graphvizRenderer = graphviz(container)
        .fit(true)
        .width(width)
        .height(height)
        .zoom(true)
        .transition(() => 'main')
        .on('end', () => {
          // Setup interactivity after rendering
          setTimeout(() => {
            this.setupInteractivity();
            // Ensure graph is immediately visible by fitting to view
            this.fitToView();
          }, 100);
        });

      this.isInitialized.set(true);
      this.visualizationState.setInitialized(true);

      // Load network data if available
      const networkData = this.networkData();
      if (networkData) {
        this.renderNetwork(networkData);
      }

      console.log(`D3-Graphviz initialized successfully (${width}x${height})`);
    } catch (error) {
      console.error('Failed to initialize D3-Graphviz:', error);
    }
  }

  // Render network data using DOT notation
  private renderNetwork(networkData: NetworkData): void {
    if (!this.graphvizRenderer) return;

    try {
      const dotString = this.generateDotString(networkData);
      this.graphvizRenderer
        .renderDot(dotString)
        .on('end', () => {
          // Setup interactivity after each render
          this.setupInteractivity();
          // Apply diamond visualization if enabled
          if (this.diamondMode()) {
            this.updateDiamondVisualization();
          }
          // Ensure graph is immediately visible
          setTimeout(() => this.fitToView(), 200);
        });
      console.log(`Network rendered: ${networkData.nodes.length} nodes, ${networkData.edges.length} edges`);
    } catch (error) {
      console.error('Failed to render network:', error);
    }
  }

  // Generate DOT notation string from network data
  private generateDotString(networkData: NetworkData): string {
    const layoutEngine = this.getGraphvizEngine(this.selectedLayout());
    let dot = `digraph G {\n`;
    dot += `  layout=${layoutEngine};\n`;
    dot += `  rankdir=TB;\n`;
    dot += `  bgcolor=transparent;\n`;
    dot += `  node [shape=circle, style=filled, width=0.8, height=0.8];\n`;
    dot += `  edge [arrowhead=normal, arrowsize=0.8];\n`;
    dot += `  graph [splines=true, overlap=false, sep="+15,15"];\n\n`;

    // Add nodes with styling
    networkData.nodes.forEach(node => {
      const nodeStyle = this.getNodeStyle(node);
      const label = this.showLabels() ? node.label || node.id.toString() : '';
      dot += `  "${node.id}" [label="${label}", ${nodeStyle}];\n`;
    });

    dot += '\n';

    // Add edges
    networkData.edges.forEach(edge => {
      const edgeStyle = this.getEdgeStyle(edge);
      dot += `  "${edge.source}" -> "${edge.target}" [${edgeStyle}];\n`;
    });

    dot += '}\n';
    return dot;
  }

  // Get Graphviz engine based on layout type
  private getGraphvizEngine(layoutType: LayoutType): string {
    switch (layoutType) {
      case 'dagre':
      case 'hierarchical':
        return 'dot';
      case 'circular':
        return 'circo';
      case 'force-directed':
        return 'fdp';
      default:
        return 'dot';
    }
  }

  // Get node styling for DOT notation
  private getNodeStyle(node: { id: number; type?: string; probability?: number }): string {
    let style = '';
    const nodeSize = Math.max(0.5, this.nodeSize() / 40); // Scale node size appropriately
    
    // Color based on type
    switch (node.type) {
      case 'source':
        style += `fillcolor="#4CAF50", shape=triangle, width=${nodeSize}, height=${nodeSize}`;
        break;
      case 'sink':
        style += `fillcolor="#F44336", shape=square, width=${nodeSize}, height=${nodeSize}`;
        break;
      case 'fork':
        style += `fillcolor="#FF9800", shape=diamond, width=${nodeSize}, height=${nodeSize}`;
        break;
      case 'join':
        style += `fillcolor="#9C27B0", shape=pentagon, width=${nodeSize}, height=${nodeSize}`;
        break;
      default:
        style += `fillcolor="#2196F3", width=${nodeSize}, height=${nodeSize}`;
    }

    // Add probability-based styling if available
    if (node.probability !== undefined) {
      const opacity = Math.max(0.3, node.probability);
      style += `, style="filled", alpha=${opacity}`;
    } else {
      style += `, style="filled"`;
    }

    return style;
  }

  // Get edge styling for DOT notation
  private getEdgeStyle(edge: { probability?: number }): string {
    const edgeWidth = Math.max(1, this.edgeWidth());
    let style = `penwidth=${edgeWidth}, color="#424242"`;
    
    if (edge.probability !== undefined) {
      const opacity = Math.max(0.3, edge.probability);
      const color = this.getProbabilityColor(edge.probability);
      style += `, color="${color}", alpha=${opacity}`;
      
      if (this.showLabels()) {
        style += `, label="${edge.probability.toFixed(2)}", fontsize=10`;
      }
    }

    return style;
  }

  // Update visualization based on settings changes
  private updateVisualizationSettings(settings: { nodeSize: number; edgeWidth: number; showLabels: boolean; layout: LayoutType }): void {
    if (!this.graphvizRenderer) return;

    // Update component signals
    this.nodeSize.set(settings.nodeSize);
    this.edgeWidth.set(settings.edgeWidth);
    this.showLabels.set(settings.showLabels);
    
    // Update layout if changed
    if (settings.layout !== this.selectedLayout()) {
      this.selectedLayout.set(settings.layout);
    }

    // Re-render with new settings
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  // Update visualization based on analysis results
  private updateAnalysisVisualization(results: AnalysisResults): void {
    if (!this.graphvizRenderer || !results.results) return;

    // Re-render with analysis results integrated
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  // Get color based on probability value
  private getProbabilityColor(probability: number): string {
    if (probability > 0.8) return '#4CAF50';
    if (probability > 0.6) return '#FFC107';
    if (probability > 0.4) return '#FF9800';
    return '#F44336';
  }

  // Control methods
  onLayoutChange(layout: LayoutType): void {
    this.selectedLayout.set(layout);
    this.visualizationState.setLayout(layout);
    
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  onNodeSizeChange(size: number): void {
    this.nodeSize.set(size);
    this.visualizationState.setNodeSize(size);
    
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  onEdgeWidthChange(width: number): void {
    this.edgeWidth.set(width);
    this.visualizationState.setEdgeWidth(width);
    
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  onToggleLabels(): void {
    this.showLabels.update(current => !current);
    this.visualizationState.toggleLabels();
    
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }


  // Analysis controls
  async runAnalysis(): Promise<void> {
    if (this.analysisState.canRunAnalysis()) {
      await this.analysisState.runAnalysis('reachability');
    }
  }

  // ============================================================================
  // INTERACTIVITY METHODS
  // ============================================================================

  private setupInteractivity(): void {
    if (!this.interactivityEnabled()) return;

    // Get the SVG element created by d3-graphviz
    this.svgElement = d3.select(this.graphvizContainer.nativeElement).select('svg');
    
    if (this.svgElement.empty()) {
      console.warn('SVG element not found for interactivity setup');
      return;
    }

    // Ensure SVG fills container
    this.svgElement
      .attr('width', '100%')
      .attr('height', '100%')
      .style('display', 'block');

    // Setup zoom and pan behavior
    this.setupZoomAndPan();
    
    // Setup node and edge interactions
    this.setupNodeInteractions();
    this.setupEdgeInteractions();
    
    // Setup diamond interactions if diamond mode is enabled
    if (this.diamondMode()) {
      this.setupDiamondInteractions();
    }

    console.log('✨ Interactive features enabled');
  }

  private setupZoomAndPan(): void {
    if (!this.svgElement) return;

    // Create zoom behavior
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        if (this.svgElement) {
          const g = this.svgElement.select('g');
          g.attr('transform', event.transform.toString());
        }
      });

    // Apply zoom behavior to SVG
    this.svgElement.call(this.zoomBehavior);

    // Restore previous transform if available
    if (this.currentTransform) {
      this.svgElement.call(this.zoomBehavior.transform, this.currentTransform);
    }
  }

  private setupNodeInteractions(): void {
    if (!this.svgElement) return;

    // Select all node elements (circles, ellipses, polygons) with more specific selectors
    const nodes = this.svgElement.selectAll('g.node');

    nodes
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.handleNodeClick(event, d);
      })
      .on('mouseover', (event, d) => {
        this.handleNodeHover(event, d, true);
      })
      .on('mouseout', (event, d) => {
        this.handleNodeHover(event, d, false);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        this.handleNodeDoubleClick(event, d);
      });

    // Also add interactions to node shapes (circles, ellipses, polygons)
    const nodeShapes = this.svgElement.selectAll('g.node ellipse, g.node circle, g.node polygon');
    nodeShapes
      .style('cursor', 'pointer')
      .style('pointer-events', 'all');

    console.log(`✨ Node interactions setup for ${nodes.size()} nodes`);
  }

  private setupEdgeInteractions(): void {
    if (!this.svgElement) return;

    // Select all edge elements with more specific selectors
    const edges = this.svgElement.selectAll('g.edge');

    edges
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.handleEdgeClick(event, d);
      })
      .on('mouseover', (event, d) => {
        this.handleEdgeHover(event, d, true);
      })
      .on('mouseout', (event, d) => {
        this.handleEdgeHover(event, d, false);
      });

    // Also add interactions to edge paths
    const edgePaths = this.svgElement.selectAll('g.edge path');
    edgePaths
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .style('stroke-width', '8px')
      .style('stroke', 'transparent');

    console.log(`✨ Edge interactions setup for ${edges.size()} edges`);
  }

  private setupDiamondInteractions(): void {
    if (!this.svgElement) return;

    // Add diamond-specific interaction handlers
    const diamonds = this.diamonds();
    
    diamonds.forEach(diamond => {
      // Highlight diamond nodes for interaction
      diamond.nodes.forEach(nodeId => {
        if (!this.svgElement) return;
        const nodeElement = this.svgElement.select(`[id*="${nodeId}"]`);
        if (!nodeElement.empty()) {
          nodeElement
            .on('click.diamond', (event) => {
              event.stopPropagation();
              this.handleDiamondNodeClick(diamond, nodeId, event);
            })
            .on('mouseover.diamond', () => {
              this.diamondVisualization.setHoveredDiamond(diamond.id);
            })
            .on('mouseout.diamond', () => {
              this.diamondVisualization.setHoveredDiamond(null);
            });
        }
      });
    });
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private handleNodeClick(event: MouseEvent, nodeData: unknown): void {
    const nodeId = this.extractNodeId(nodeData);
    if (nodeId === null) return;

    const isMultiSelect = event.ctrlKey || event.metaKey;
    
    if (isMultiSelect) {
      this.visualizationState.selectNode(nodeId);
    } else {
      this.visualizationState.selectNode(nodeId);
    }

    // Show node tooltip
    this.showNodeTooltip(event, nodeId);
    
    console.log(`Node clicked: ${nodeId}`, { multiSelect: isMultiSelect });
  }

  private handleNodeHover(event: MouseEvent, nodeData: unknown, isEntering: boolean): void {
    const nodeId = this.extractNodeId(nodeData);
    if (nodeId === null) return;

    if (isEntering) {
      this.visualizationState.setHoveredNode(nodeId);
      this.showNodeTooltip(event, nodeId);
    } else {
      this.visualizationState.setHoveredNode(null);
      this.hideTooltip();
    }
  }

  private handleNodeDoubleClick(event: MouseEvent, nodeData: unknown): void {
    const nodeId = this.extractNodeId(nodeData);
    if (nodeId === null) return;

    // Focus on node (zoom to node)
    this.focusOnNode(nodeId);
    console.log(`Node double-clicked: ${nodeId}`);
  }

  private handleEdgeClick(event: MouseEvent, edgeData: unknown): void {
    const edgeId = this.extractEdgeId(edgeData);
    if (!edgeId) return;

    const isMultiSelect = event.ctrlKey || event.metaKey;
    
    if (isMultiSelect) {
      this.visualizationState.selectEdge(edgeId);
    } else {
      this.visualizationState.selectEdge(edgeId);
    }

    this.showEdgeTooltip(event, edgeId);
    console.log(`Edge clicked: ${edgeId}`, { multiSelect: isMultiSelect });
  }

  private handleEdgeHover(event: MouseEvent, edgeData: unknown, isEntering: boolean): void {
    const edgeId = this.extractEdgeId(edgeData);
    if (!edgeId) return;

    if (isEntering) {
      this.visualizationState.setHoveredEdge(edgeId);
      this.showEdgeTooltip(event, edgeId);
    } else {
      this.visualizationState.setHoveredEdge(null);
      this.hideTooltip();
    }
  }

  private handleDiamondNodeClick(diamond: DiamondStructure, nodeId: string | number, event: MouseEvent): void {
    const isMultiSelect = event.ctrlKey || event.metaKey;
    this.diamondVisualization.selectDiamond(diamond.id, isMultiSelect);
    
    // Show diamond tooltip
    this.showDiamondTooltip(event, diamond);
    console.log(`Diamond node clicked: ${diamond.id} (node: ${nodeId})`);
  }

  // ============================================================================
  // TOOLTIP METHODS
  // ============================================================================

  private showNodeTooltip(event: MouseEvent, nodeId: number): void {
    const networkData = this.networkData();
    if (!networkData) return;

    const node = networkData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const tooltip = this.createTooltip();
    tooltip.innerHTML = `
      <div class="tooltip-header">Node ${nodeId}</div>
      <div class="tooltip-content">
        <div><strong>Type:</strong> ${node.type || 'Standard'}</div>
        <div><strong>Label:</strong> ${node.label || `Node ${nodeId}`}</div>
        ${node.probability ? `<div><strong>Probability:</strong> ${node.probability.toFixed(3)}</div>` : ''}
      </div>
    `;
    
    this.positionTooltip(tooltip, event);
  }

  private showEdgeTooltip(event: MouseEvent, edgeId: string): void {
    const networkData = this.networkData();
    if (!networkData) return;

    const edge = networkData.edges.find(e => `${e.source}-${e.target}` === edgeId);
    if (!edge) return;

    const tooltip = this.createTooltip();
    tooltip.innerHTML = `
      <div class="tooltip-header">Edge ${edgeId}</div>
      <div class="tooltip-content">
        <div><strong>From:</strong> ${edge.source}</div>
        <div><strong>To:</strong> ${edge.target}</div>
        ${edge.probability ? `<div><strong>Probability:</strong> ${edge.probability.toFixed(3)}</div>` : ''}
      </div>
    `;
    
    this.positionTooltip(tooltip, event);
  }

  private showDiamondTooltip(event: MouseEvent, diamond: DiamondStructure): void {
    const classification = this.diamondClassifications().find(c => c.diamondId === diamond.id);
    
    const tooltip = this.createTooltip();
    tooltip.innerHTML = `
      <div class="tooltip-header">Diamond ${diamond.id}</div>
      <div class="tooltip-content">
        <div><strong>Type:</strong> ${classification?.type || 'Unknown'}</div>
        <div><strong>Nodes:</strong> ${diamond.nodes.length}</div>
        <div><strong>Paths:</strong> ${diamond.paths.length}</div>
        <div><strong>Complexity:</strong> ${classification?.complexity || 'N/A'}</div>
        ${classification?.confidence ? `<div><strong>Confidence:</strong> ${(classification.confidence * 100).toFixed(1)}%</div>` : ''}
      </div>
    `;
    
    this.positionTooltip(tooltip, event);
  }

  private createTooltip(): HTMLElement {
    // Remove existing tooltip
    this.hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'visualization-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 200px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(tooltip);
    return tooltip;
  }

  private positionTooltip(tooltip: HTMLElement, event: MouseEvent): void {
    const x = event.pageX + 10;
    const y = event.pageY - 10;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  private hideTooltip(): void {
    const existingTooltip = document.querySelector('.visualization-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  // ============================================================================
  // DIAMOND VISUALIZATION METHODS
  // ============================================================================

  private updateDiamondVisualization(): void {
    if (!this.svgElement || !this.diamondMode()) return;

    const diamonds = this.diamonds();
    const selectedType = this.selectedDiamondType();
    
    // Filter diamonds by type if not 'all'
    const filteredDiamonds = selectedType === 'all'
      ? diamonds
      : diamonds.filter(d => {
          const classification = this.diamondClassifications().find(c => c.diamondId === d.id);
          return classification?.type === selectedType;
        });

    // Apply diamond highlighting
    this.applyDiamondHighlighting(filteredDiamonds);
    
    // Animate diamond paths if enabled
    if (this.animateDiamonds()) {
      this.animateAllDiamondPaths(filteredDiamonds);
    }
  }

  private applyDiamondHighlighting(diamonds: DiamondStructure[]): void {
    if (!this.svgElement) return;

    // Clear previous diamond highlighting
    this.svgElement.selectAll('.diamond-highlight').remove();
    
    diamonds.forEach((diamond) => {
      const classification = this.diamondClassifications().find(c => c.diamondId === diamond.id);
      const color = this.getDiamondColor(classification?.type || DiamondType.SIMPLE);
      
      // Highlight diamond nodes
      diamond.nodes.forEach(nodeId => {
        if (!this.svgElement) return;
        const nodeElement = this.svgElement.select(`[id*="${nodeId}"]`);
        if (!nodeElement.empty()) {
          nodeElement
            .select('ellipse, circle, polygon')
            .style('stroke', color)
            .style('stroke-width', '3px')
            .style('fill-opacity', '0.8')
            .classed('diamond-highlight', true);
        }
      });

      // Highlight diamond paths
      if (this.showDiamondPaths()) {
        this.highlightDiamondPaths(diamond, color);
      }
    });
  }

  private highlightDiamondPaths(diamond: DiamondStructure, color: string): void {
    if (!this.svgElement) return;

    diamond.paths.forEach((path, pathIndex) => {
      for (let i = 0; i < path.length - 1; i++) {
        const sourceId = path[i];
        const targetId = path[i + 1];
        const edgeSelector = `[id*="${sourceId}"][id*="${targetId}"], [id*="${targetId}"][id*="${sourceId}"]`;
        
        if (!this.svgElement) return;
        const edgeElement = this.svgElement.select(edgeSelector);
        if (!edgeElement.empty()) {
          edgeElement
            .select('path')
            .style('stroke', color)
            .style('stroke-width', '2px')
            .style('stroke-dasharray', pathIndex % 2 === 0 ? 'none' : '5,5')
            .classed('diamond-highlight', true);
        }
      }
    });
  }

  private animateAllDiamondPaths(diamonds: DiamondStructure[]): void {
    diamonds.forEach(diamond => {
      diamond.paths.forEach((path, pathIndex) => {
        setTimeout(() => {
          this.animateDiamondPath(diamond, pathIndex);
        }, pathIndex * 500);
      });
    });
  }

  private animateDiamondPath(diamond: DiamondStructure, pathIndex: number): void {
    if (!this.svgElement || pathIndex >= diamond.paths.length) return;

    const path = diamond.paths[pathIndex];
    const color = this.getDiamondColor(
      this.diamondClassifications().find(c => c.diamondId === diamond.id)?.type || DiamondType.SIMPLE
    );

    // Animate each edge in the path sequentially
    path.forEach((nodeId, index) => {
      if (index < path.length - 1) {
        setTimeout(() => {
          const nextNodeId = path[index + 1];
          this.animateEdge(nodeId, nextNodeId, color);
        }, index * 300);
      }
    });
  }

  private animateEdge(sourceId: string | number, targetId: string | number, color: string): void {
    if (!this.svgElement) return;

    const edgeSelector = `[id*="${sourceId}"][id*="${targetId}"], [id*="${targetId}"][id*="${sourceId}"]`;
    const edgeElement = this.svgElement.select(edgeSelector);
    
    if (!edgeElement.empty()) {
      const pathElement = edgeElement.select('path');
      if (!pathElement.empty()) {
        pathElement
          .style('stroke', color)
          .style('stroke-width', '4px')
          .style('opacity', '1')
          .transition()
          .duration(300)
          .style('opacity', '0.6')
          .transition()
          .duration(300)
          .style('opacity', '1');
      }
    }
  }

  private updateDiamondHighlighting(selectedDiamonds: string[], hoveredDiamond: string | null): void {
    if (!this.svgElement) return;

    // Clear previous selection highlighting
    this.svgElement.selectAll('.diamond-selected').classed('diamond-selected', false);
    this.svgElement.selectAll('.diamond-hovered').classed('diamond-hovered', false);

    // Apply selection highlighting
    selectedDiamonds.forEach(diamondId => {
      const diamond = this.diamondState.getDiamondById(diamondId);
      if (diamond && this.svgElement) {
        diamond.nodes.forEach(nodeId => {
          if (this.svgElement) {
            const nodeElement = this.svgElement.select(`[id*="${nodeId}"]`);
            nodeElement.classed('diamond-selected', true);
          }
        });
      }
    });

    // Apply hover highlighting
    if (hoveredDiamond && this.svgElement) {
      const diamond = this.diamondState.getDiamondById(hoveredDiamond);
      if (diamond) {
        diamond.nodes.forEach(nodeId => {
          if (this.svgElement) {
            const nodeElement = this.svgElement.select(`[id*="${nodeId}"]`);
            nodeElement.classed('diamond-hovered', true);
          }
        });
      }
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private extractNodeId(nodeData: unknown): number | null {
    // Extract node ID from D3 node data
    if (typeof nodeData === 'object' && nodeData !== null && 'key' in nodeData) {
      const key = (nodeData as { key: string }).key;
      if (typeof key === 'string') {
        const match = key.match(/\d+/);
        return match ? parseInt(match[0]) : null;
      }
    }
    return null;
  }

  private extractEdgeId(edgeData: unknown): string | null {
    // Extract edge ID from D3 edge data
    if (typeof edgeData === 'object' && edgeData !== null && 'key' in edgeData) {
      const key = (edgeData as { key: string }).key;
      if (typeof key === 'string') {
        return key;
      }
    }
    return null;
  }

  private focusOnNode(nodeId: number): void {
    if (!this.svgElement || !this.zoomBehavior) return;

    const nodeElement = this.svgElement.select(`[id*="${nodeId}"]`);
    if (nodeElement.empty()) return;

    const nodeBox = (nodeElement.node() as SVGGraphicsElement).getBBox();
    const svgBox = (this.svgElement.node() as SVGSVGElement).getBoundingClientRect();
    
    const scale = Math.min(svgBox.width / nodeBox.width, svgBox.height / nodeBox.height) * 0.8;
    const x = svgBox.width / 2 - nodeBox.x * scale - nodeBox.width * scale / 2;
    const y = svgBox.height / 2 - nodeBox.y * scale - nodeBox.height * scale / 2;
    
    const transform = d3.zoomIdentity.translate(x, y).scale(scale);
    this.svgElement.transition().duration(750).call(this.zoomBehavior.transform, transform);
  }

  private getDiamondColor(type: DiamondType): string {
    const colors = {
      [DiamondType.SIMPLE]: '#4CAF50',
      [DiamondType.NESTED]: '#2196F3',
      [DiamondType.OVERLAPPING]: '#FF9800',
      [DiamondType.CASCADE]: '#9C27B0',
      [DiamondType.PARALLEL]: '#F44336'
    };
    return colors[type] || colors[DiamondType.SIMPLE];
  }

  // ============================================================================
  // ENHANCED CONTROL METHODS
  // ============================================================================

  onToggleInteractivity(): void {
    this.interactivityEnabled.update(current => !current);
    if (this.interactivityEnabled()) {
      this.setupInteractivity();
    }
  }

  onToggleDiamondMode(): void {
    this.diamondMode.update(current => !current);
    if (this.diamondMode()) {
      this.updateDiamondVisualization();
    } else {
      // Clear diamond highlighting
      if (this.svgElement) {
        this.svgElement.selectAll('.diamond-highlight').remove();
      }
    }
  }

  onDiamondTypeChange(type: DiamondType | 'all'): void {
    this.selectedDiamondType.set(type);
    if (this.diamondMode()) {
      this.updateDiamondVisualization();
    }
  }

  onToggleDiamondPaths(): void {
    this.showDiamondPaths.update(current => !current);
    if (this.diamondMode()) {
      this.updateDiamondVisualization();
    }
  }

  onToggleDiamondAnimation(): void {
    this.animateDiamonds.update(current => !current);
    if (this.diamondMode() && this.animateDiamonds()) {
      const diamonds = this.diamonds();
      this.animateAllDiamondPaths(diamonds);
    }
  }

  async runDiamondAnalysis(): Promise<void> {
    if (this.diamondState.canAnalyze()) {
      await this.diamondState.detectDiamonds();
    }
  }

  clearDiamondSelection(): void {
    // Clear diamond selection - implement based on available methods
    console.log('Clearing diamond selection');
  }

  // Window resize handler for responsive behavior
  private handleWindowResize(): void {
    if (this.graphvizRenderer && this.graphvizContainer?.nativeElement) {
      const container = this.graphvizContainer.nativeElement;
      const containerRect = container.getBoundingClientRect();
      
      // Update graphviz dimensions
      this.graphvizRenderer
        .width(containerRect.width || window.innerWidth - 320)
        .height(containerRect.height || window.innerHeight - 120);
      
      // Re-render if we have network data
      const networkData = this.networkData();
      if (networkData) {
        this.renderNetwork(networkData);
      }
    }
  }

  // Enhanced zoom controls with smooth transitions
  zoomIn(): void {
    if (this.zoomBehavior && this.svgElement) {
      this.svgElement.transition().duration(300).call(
        this.zoomBehavior.scaleBy, 1.5
      );
    }
    this.visualizationState.zoomIn();
  }

  zoomOut(): void {
    if (this.zoomBehavior && this.svgElement) {
      this.svgElement.transition().duration(300).call(
        this.zoomBehavior.scaleBy, 1 / 1.5
      );
    }
    this.visualizationState.zoomOut();
  }

  fitToView(): void {
    if (!this.svgElement || !this.zoomBehavior) return;
    
    const svg = this.svgElement.node();
    const g = this.svgElement.select('g').node() as SVGGElement;
    if (!svg || !g) return;
    
    try {
      // Get the bounds of the graph content
      const bounds = g.getBBox();
      const svgRect = svg.getBoundingClientRect();
      
      if (bounds.width === 0 || bounds.height === 0) return;
      
      // Calculate scale to fit content with padding
      const padding = 40;
      const scaleX = (svgRect.width - padding * 2) / bounds.width;
      const scaleY = (svgRect.height - padding * 2) / bounds.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1
      
      // Calculate translation to center the content
      const translateX = (svgRect.width - bounds.width * scale) / 2 - bounds.x * scale;
      const translateY = (svgRect.height - bounds.height * scale) / 2 - bounds.y * scale;
      
      // Apply the transform
      const transform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);
        
      this.svgElement.transition()
        .duration(500)
        .call(this.zoomBehavior.transform, transform);
        
      this.currentTransform = transform;
      this.visualizationState.fitToView();
    } catch (error) {
      console.warn('Failed to fit to view:', error);
      // Fallback to simple reset
      this.svgElement.call(this.zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  resetView(): void {
    if (this.zoomBehavior && this.svgElement) {
      this.svgElement.transition().duration(750).call(
        this.zoomBehavior.transform, d3.zoomIdentity
      );
    }
  }

  // Utility methods for template
  getMaxProbability(): number {
    const results = this.analysisResults();
    if (!results?.results?.reachabilityProbabilities) return 0;
    
    const probabilities = Object.values(results.results.reachabilityProbabilities) as number[];
    return probabilities.length > 0 ? Math.max(...probabilities) : 0;
  }
}