import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { graphviz } from 'd3-graphviz';

// Import state services
import { VisualizationStateService, LayoutType } from '@network-analysis/visualization';
import { NetworkStateService, NetworkData, AnalysisStateService } from '@network-analysis/network-core';

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

  // D3-Graphviz instance
  private graphvizRenderer: ReturnType<typeof graphviz> | null = null;

  // Component signals
  readonly isInitialized = signal(false);
  readonly selectedLayout = signal<LayoutType>('dagre');
  readonly nodeSize = signal(30);
  readonly edgeWidth = signal(2);
  readonly showLabels = signal(true);

  // Computed signals from services
  readonly networkData = this.networkState.networkData;
  readonly isNetworkLoaded = this.networkState.isNetworkLoaded;
  readonly nodeCount = this.networkState.nodeCount;
  readonly edgeCount = this.networkState.edgeCount;
  readonly analysisResults = this.analysisState.currentAnalysis;
  readonly isAnalysisRunning = this.analysisState.isRunning;
  readonly visualizationSettings = this.visualizationState.settings;
  readonly selectionState = this.visualizationState.selection;

  // Layout options for Graphviz
  readonly layoutOptions: Array<{ value: LayoutType; label: string }> = [
    { value: 'dagre', label: 'Hierarchical (DOT)' },
    { value: 'hierarchical', label: 'Hierarchical (Neato)' },
    { value: 'circular', label: 'Circular (Circo)' },
    { value: 'force-directed', label: 'Force Directed (FDP)' }
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
  }

  ngOnInit(): void {
    console.log('VisualizationComponent initialized');
  }

  ngAfterViewInit(): void {
    this.initializeGraphviz();
  }

  ngOnDestroy(): void {
    if (this.graphvizRenderer) {
      this.graphvizRenderer = null;
    }
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
      this.graphvizRenderer = graphviz(this.graphvizContainer.nativeElement)
        .fit(true)
        .width(800)
        .height(600);

      this.isInitialized.set(true);
      this.visualizationState.setInitialized(true);

      // Load network data if available
      const networkData = this.networkData();
      if (networkData) {
        this.renderNetwork(networkData);
      }

      console.log('D3-Graphviz initialized successfully');
    } catch (error) {
      console.error('Failed to initialize D3-Graphviz:', error);
    }
  }

  // Render network data using DOT notation
  private renderNetwork(networkData: NetworkData): void {
    if (!this.graphvizRenderer) return;

    try {
      const dotString = this.generateDotString(networkData);
      this.graphvizRenderer.renderDot(dotString);
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
    dot += `  node [shape=circle, style=filled];\n`;
    dot += `  edge [arrowhead=normal];\n\n`;

    // Add nodes with styling
    networkData.nodes.forEach(node => {
      const nodeStyle = this.getNodeStyle(node);
      dot += `  "${node.id}" [label="${this.showLabels() ? node.label : ''}", ${nodeStyle}];\n`;
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
    
    // Color based on type
    switch (node.type) {
      case 'source':
        style += 'fillcolor=lightgreen, shape=triangle';
        break;
      case 'sink':
        style += 'fillcolor=lightcoral, shape=square';
        break;
      case 'fork':
        style += 'fillcolor=orange, shape=diamond';
        break;
      case 'join':
        style += 'fillcolor=plum, shape=pentagon';
        break;
      default:
        style += 'fillcolor=lightblue';
    }

    // Add probability-based styling if available
    if (node.probability !== undefined) {
      style += `, style="filled,setlinewidth(${this.edgeWidth()})"`;
    }

    return style;
  }

  // Get edge styling for DOT notation
  private getEdgeStyle(edge: { probability?: number }): string {
    let style = `penwidth=${this.edgeWidth()}`;
    
    if (edge.probability !== undefined) {
      const opacity = Math.max(0.3, edge.probability);
      style += `, color="black;${opacity}"`;
      
      if (this.showLabels()) {
        style += `, label="${edge.probability.toFixed(2)}"`;
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
  private updateAnalysisVisualization(results: { results?: { reachabilityProbabilities?: Record<string, number>; diamondStructures?: Array<{ nodes: number[] }> } }): void {
    if (!this.graphvizRenderer || !results.results) return;

    // Re-render with analysis results integrated
    const networkData = this.networkData();
    if (networkData) {
      this.renderNetwork(networkData);
    }
  }

  // Get color based on probability value
  private getProbabilityColor(probability: number): string {
    if (probability > 0.8) return 'green';
    if (probability > 0.6) return 'yellow';
    if (probability > 0.4) return 'orange';
    return 'red';
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

  // Zoom controls (Graphviz handles these automatically)
  zoomIn(): void {
    // Graphviz handles zoom through SVG interaction
    this.visualizationState.zoomIn();
  }

  zoomOut(): void {
    // Graphviz handles zoom through SVG interaction
    this.visualizationState.zoomOut();
  }

  fitToView(): void {
    if (this.graphvizRenderer) {
      this.graphvizRenderer.fit(true);
      this.visualizationState.fitToView();
    }
  }

  // Analysis controls
  async runAnalysis(): Promise<void> {
    if (this.analysisState.canRunAnalysis()) {
      await this.analysisState.runAnalysis('reachability');
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