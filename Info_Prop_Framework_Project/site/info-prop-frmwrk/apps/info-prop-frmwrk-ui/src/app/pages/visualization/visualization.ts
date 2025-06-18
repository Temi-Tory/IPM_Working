import { 
  Component, 
  inject, 
  computed, 
  signal, 
  ViewChild, 
  ElementRef, 
  AfterViewInit, 
  ChangeDetectorRef, 
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { GraphStateService } from '../../services/graph-state-service';
import { GraphStructure } from '../../shared/models/graph-structure-interface';
import { HighlightService } from '../../services/vis/highlight.service';
import { MainServerService } from '../../services/main-server-service';
import { LayoutOption, HighlightOption, VisualizationConfig, NodeHighlight } from '../../shared/models/vis/vis-types';
import { VisualizationRendererService } from '../../services/vis/vis-renderer-service';
import { ZOOM_CONFIG, LAYOUT_OPTIONS, HIGHLIGHT_OPTIONS } from '../../shared/models/vis/vis-constants';
import { DiamondClassification, DiamondAnalysisResponse, DiamondStructureData, DiamondGroup } from '../../shared/models/main-sever-interface';

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
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  providers: [
    VisualizationRendererService,
    HighlightService
  ],
  templateUrl: './visualization.html',
  styleUrl: './visualization.scss',
})
export class VisualizationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dotContainer', { static: false }) dotContainer!: ElementRef<HTMLDivElement>;
  
  // Injected services
  readonly graphState = inject(GraphStateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly rendererService = inject(VisualizationRendererService);
  private readonly highlightService = inject(HighlightService);
  private readonly mainServerService = inject(MainServerService);
  private readonly route = inject(ActivatedRoute);

  // State signals
  isGeneratingDot = signal(false);
  selectedLayout = signal<string>('dot');
  zoomLevel = signal<number>(ZOOM_CONFIG.DEFAULT);
  showNodeLabels = signal<boolean>(true);
  showEdgeLabels = signal<boolean>(false);
  highlightMode = signal<string>('none');
  
  // Enhanced visualization controls matching static version
  showSourceNodes = signal<boolean>(true);
  showSinkNodes = signal<boolean>(true);
  showForkNodes = signal<boolean>(false);
  showJoinNodes = signal<boolean>(false);
  showIterations = signal<boolean>(false);
  showDiamonds = signal<boolean>(false);
  
  // Diamond and subgraph controls
  focusedDiamond = signal<number | null>(null);
  fromNode: number | null = null;
  toNode: number | null = null;
  multiNodeInput = '';
  customHighlights = signal<NodeHighlight[]>([]);
  highlightedPath = signal<number[]>([]);
  availableDiamonds = signal<(DiamondClassification & { diamondStructure?: DiamondStructureData })[]>([]);
  selectedNodeInfo = signal<{
    nodeId: number;
    nodeType: string;
    priorProbability?: number;
    reachabilityValue?: number;
    ancestors?: number[];
    descendants?: number[];
    diamondMemberships?: string[];
    iterationSet?: number;
    inDegree?: number;
    outDegree?: number;
    [key: string]: any;
  } | null>(null);
  
  // Enhanced node interaction state
  hoveredNodeInfo = signal<{
    nodeId: number;
    x: number;
    y: number;
    details: any;
  } | null>(null);
  
  // Track rendering state
  private hasRenderedOnce = signal<boolean>(false);
  private isUpdating = signal<boolean>(false);

  // Task 6.3: Enhanced highlight options with analysis-based modes
  readonly enhancedHighlightOptions: HighlightOption[] = [
    ...HIGHLIGHT_OPTIONS,
    { value: 'structure-analysis', label: 'Structure Analysis Results' },
    { value: 'diamond-analysis', label: 'Diamond Analysis Results' },
    { value: 'reachability-analysis', label: 'Reachability Analysis Results' },
    { value: 'prior-probabilities', label: 'Prior Probabilities (Heat Map)' },
    { value: 'reachability-values', label: 'Reachability Values (Heat Map)' }
  ];

  // Constants exposed to template
  readonly layoutOptions: LayoutOption[] = LAYOUT_OPTIONS;
  readonly highlightOptions: HighlightOption[] = this.enhancedHighlightOptions;

  // Task 6.1: Add Structure Analysis Dependency
  readonly hasStructureAnalysis = computed(() => this.graphState.lastAnalysisType() !== null);
  readonly isVisualizationEnabled = computed(() => this.hasStructureAnalysis() && this.isGraphLoaded());

  // Computed properties
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly structure = computed(() => this.graphState.graphStructure());
  readonly nodeCount = computed(() => this.graphState.nodeCount());
  readonly edgeCount = computed(() => this.graphState.edgeCount());
  readonly lastAnalysisType = computed(() => this.graphState.lastAnalysisType());
  readonly lastResults = computed(() => this.graphState.lastResults());

  // Current visualization configuration
  readonly currentConfig = computed((): VisualizationConfig => ({
    layout: this.selectedLayout(),
    zoomLevel: this.zoomLevel(),
    showNodeLabels: this.showNodeLabels(),
    showEdgeLabels: this.showEdgeLabels(),
    highlightMode: this.highlightMode(),
    highlights: this.nodeHighlights()
  }));

  // Task 6.2 & 6.3: Enhanced node highlights with analysis-based coloring
  readonly nodeHighlights = computed((): NodeHighlight[] => {
    const structure = this.structure();
    let highlights: NodeHighlight[] = [];
    
    if (!structure) return [];
    
    // Analysis-based highlighting modes
    const highlightMode = this.highlightMode();
    if (highlightMode.includes('analysis') || highlightMode.includes('probabilities') || highlightMode.includes('values')) {
      highlights = this.generateAnalysisBasedHighlights(highlightMode);
      if (highlights.length > 0) return highlights;
    }
    
    // Individual node type highlights (existing functionality)
    if (this.showSourceNodes()) {
      structure.source_nodes?.forEach(nodeId => {
        highlights.push({ nodeId, type: 'source', color: '#4CAF50' });
      });
    }
    
    if (this.showSinkNodes()) {
      // Find sink nodes (nodes with no outgoing edges)
      const sinkNodes = this.findSinkNodes(structure);
      sinkNodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'sink', color: '#FF5722' });
      });
    }
    
    if (this.showForkNodes()) {
      structure.fork_nodes?.forEach(nodeId => {
        highlights.push({ nodeId, type: 'fork', color: '#FF9800' });
      });
    }
    
    if (this.showJoinNodes()) {
      structure.join_nodes?.forEach(nodeId => {
        highlights.push({ nodeId, type: 'join', color: '#2196F3' });
      });
    }
    
    if (this.showIterations()) {
      highlights.push(...this.generateIterationHighlights(structure));
    }
    
    if (this.showDiamonds()) {
      highlights.push(...this.generateDiamondHighlightsFromStructure(structure));
    }
    
    // Add custom highlights
    highlights.push(...this.customHighlights());
    
    return highlights;
  });

  // For template compatibility (no longer used but kept for DOT download)
  readonly dotString = signal<string>('');

  // Enhanced node details computed properties
  readonly selectedNodeDetails = computed(() => {
    const nodeInfo = this.selectedNodeInfo();
    if (!nodeInfo) return null;
    
    return this.enrichNodeDetails(nodeInfo.nodeId);
  });

  readonly hoveredNodeDetails = computed(() => {
    const hoverInfo = this.hoveredNodeInfo();
    if (!hoverInfo) return null;
    
    return this.enrichNodeDetails(hoverInfo.nodeId);
  });

  // Task 6.1: Check component initialization
  async ngAfterViewInit(): Promise<void> {
    if (!this.isVisualizationEnabled()) {
      this.showError('Visualization requires structure analysis to be completed first');
      return;
    }
    
    // Load available diamonds when graph is loaded
    if (this.isGraphLoaded()) {
      this.loadAvailableDiamonds();
    }
    
    // Check for focusDiamond query parameter
    this.route.queryParams.subscribe(params => {
      if (params['focusDiamond']) {
        const joinNode = parseInt(params['focusDiamond']);
        this.focusOnDiamond(joinNode);
      }
    });
    
    // If graph is already loaded and analysis completed, generate visualization
    if (this.isVisualizationEnabled()) {
      setTimeout(() => {
        this.generateVisualization();
      }, 200);
    }
  }

  ngOnDestroy(): void {
    this.rendererService.cleanup();
  }

  // Public methods
  async generateVisualization(): Promise<void> {
    if (!this.isVisualizationEnabled()) {
      this.showError('Visualization requires structure analysis to be completed first.');
      return;
    }

    const container = this.getContainer();
    if (!container) {
      this.showError('Visualization container not available. Please try again.');
      return;
    }

    this.isGeneratingDot.set(true);
    this.isUpdating.set(false);
    
    try {
      const structure = this.structure();
      if (!structure) {
        throw new Error('No graph structure available');
      }

      const config = this.currentConfig();

      // Clear container
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Preparing D3 visualization...</div>';

      // Render with D3 and setup node interaction handlers
      await this.rendererService.renderWithD3(container, structure, config);
      this.setupNodeInteractionHandlers(container);
      
      this.hasRenderedOnce.set(true);
      
      const message = this.isUpdating() 
        ? 'Visualization updated!'
        : 'Visualization generated successfully!';
        
      this.showSuccess(message);
      this.dotString.set('generated'); // Set to indicate visualization exists

    } catch (error) {
      console.error('❌ Visualization generation failed:', error);
      this.showError('Failed to generate visualization. Please try again.');
      
      const container = this.getContainer();
      if (container) {
        container.innerHTML = `
          <div class="no-visualization">
            <mat-icon>error</mat-icon>
            <h3>Visualization Error</h3>
            <p>Please try generating the visualization again.</p>
          </div>
        `;
      }
    } finally {
      this.isGeneratingDot.set(false);
      this.isUpdating.set(false);
    }
  }

  // Event handlers - each triggers immediate re-rendering
  onLayoutChange(): void {
    this.triggerUpdate('Layout');
  }

  onZoomChange(value: number): void {
    this.zoomLevel.set(value);
    
    // Apply zoom immediately without full re-render for better UX
    const container = this.getContainer();
    if (container && this.hasRenderedOnce()) {
      this.rendererService.applyZoom(value, container);
    }
  }

  onHighlightModeChange(): void {
    this.triggerUpdate('Highlighting');
  }

  onNodeLabelsChange(): void {
    this.triggerUpdate('Node labels');
  }

  onEdgeLabelsChange(): void {
    this.triggerUpdate('Edge labels');
  }

  onDiamondFocusChange(): void {
    this.triggerUpdate('Diamond focus');
  }

  updateVisualization(): void {
    this.triggerUpdate('Visualization options');
  }

  // Enhanced control methods matching static version
  resetView(): void {
    this.zoomLevel.set(ZOOM_CONFIG.DEFAULT);
    this.selectedLayout.set('dot');
    this.highlightMode.set('none');
    this.showNodeLabels.set(true);
    this.showEdgeLabels.set(false);
    
    // Reset all visualization toggles to default state
    this.showSourceNodes.set(true);
    this.showSinkNodes.set(true);
    this.showForkNodes.set(false);
    this.showJoinNodes.set(false);
    this.showIterations.set(false);
    this.showDiamonds.set(false);
    
    // Clear custom highlights and selections
    this.focusedDiamond.set(null);
    this.customHighlights.set([]);
    this.highlightedPath.set([]);
    this.selectedNodeInfo.set(null);
    this.fromNode = null;
    this.toNode = null;
    this.multiNodeInput = '';
    
    if (this.isGraphLoaded()) {
      this.showInfo('Resetting to defaults...');
      setTimeout(() => {
        this.generateVisualization();
      }, 100);
    }
  }

  resetZoom(): void {
    this.zoomLevel.set(ZOOM_CONFIG.DEFAULT);
    const container = this.getContainer();
    if (container) {
      this.rendererService.applyZoom(ZOOM_CONFIG.DEFAULT, container);
    }
  }

  fitToScreen(): void {
    const container = this.getContainer();
    if (container) {
      this.rendererService.fitToScreen(container);
    }
  }

  exportDot(): void {
    this.downloadDotFile();
  }

  highlightPath(): void {
    if (!this.fromNode || !this.toNode) return;
    
    const structure = this.structure();
    if (!structure) return;
    
    // Simple path finding - in a real implementation, you'd use a proper pathfinding algorithm
    const path = this.findSimplePath(this.fromNode, this.toNode, structure);
    this.highlightedPath.set(path);
    this.triggerUpdate('Path highlighting');
  }

  highlightMultipleNodes(): void {
    if (!this.multiNodeInput.trim()) return;
    
    try {
      const nodeIds = this.multiNodeInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const highlights: NodeHighlight[] = nodeIds.map(nodeId => ({
        nodeId,
        type: 'diamond' as const,
        color: '#9C27B0'
      }));
      
      this.customHighlights.set(highlights);
      this.triggerUpdate('Custom node highlighting');
    } catch (error) {
      this.showError('Invalid node input format. Use comma-separated numbers.');
    }
  }

  clearCustomHighlights(): void {
    this.customHighlights.set([]);
    this.highlightedPath.set([]);
    this.fromNode = null;
    this.toNode = null;
    this.multiNodeInput = '';
    this.triggerUpdate('Clear custom highlights');
  }

  hasCustomHighlights(): boolean {
    return this.customHighlights().length > 0 || this.highlightedPath().length > 0;
  }

  getCustomHighlightCount(): number {
    return this.customHighlights().length + this.highlightedPath().length;
  }

  focusOnDiamond(joinNode: number): void {
    this.focusedDiamond.set(joinNode);
    this.highlightMode.set('diamond-structures');
    
    if (this.isGraphLoaded()) {
      this.showInfo(`Focusing on diamond at join node ${joinNode}...`);
      setTimeout(() => {
        this.generateVisualization();
      }, 100);
    }
  }

  // Node interaction methods matching static version
  highlightAncestors(nodeId: number): void {
    const structure = this.structure();
    if (!structure) return;
    
    const ancestors = this.findAncestors(nodeId, structure);
    const highlights: NodeHighlight[] = ancestors.map(ancestorId => ({
      nodeId: ancestorId,
      type: 'diamond',
      color: '#9C27B0'
    }));
    
    this.customHighlights.set(highlights);
    this.triggerUpdate('Ancestor highlighting');
  }

  highlightDescendants(nodeId: number): void {
    const structure = this.structure();
    if (!structure) return;
    
    const descendants = this.findDescendants(nodeId, structure);
    const highlights: NodeHighlight[] = descendants.map(descendantId => ({
      nodeId: descendantId,
      type: 'diamond',
      color: '#FF5722'
    }));
    
    this.customHighlights.set(highlights);
    this.triggerUpdate('Descendant highlighting');
  }

  showNodeDiamonds(nodeId: number): void {
    // Navigate to diamond analysis and highlight diamonds containing this node
    console.log('Showing diamonds for node:', nodeId);
    // Implementation would depend on router navigation
  }

  // Enhanced node interaction methods
  selectNode(nodeId: number): void {
    const nodeDetails = this.enrichNodeDetails(nodeId);
    this.selectedNodeInfo.set(nodeDetails);
    
    // Scroll to node details panel if it exists
    const detailsPanel = document.querySelector('.node-details-panel');
    if (detailsPanel) {
      detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  showNodeTooltip(nodeId: number, x: number, y: number): void {
    const nodeDetails = this.enrichNodeDetails(nodeId);
    this.hoveredNodeInfo.set({
      nodeId,
      x,
      y,
      details: nodeDetails
    });
  }

  hideNodeTooltip(): void {
    this.hoveredNodeInfo.set(null);
  }

  clearNodeSelection(): void {
    this.selectedNodeInfo.set(null);
  }

  highlightNodeRelationships(nodeId: number, type: 'ancestors' | 'descendants' | 'both'): void {
    const structure = this.structure();
    if (!structure) return;

    const highlights: NodeHighlight[] = [];
    
    if (type === 'ancestors' || type === 'both') {
      const ancestors = this.findAncestors(nodeId, structure);
      ancestors.forEach(ancestorId => {
        highlights.push({
          nodeId: ancestorId,
          type: 'diamond',
          color: '#9C27B0' // Purple for ancestors
        });
      });
    }
    
    if (type === 'descendants' || type === 'both') {
      const descendants = this.findDescendants(nodeId, structure);
      descendants.forEach(descendantId => {
        highlights.push({
          nodeId: descendantId,
          type: 'diamond',
          color: '#FF5722' // Orange for descendants
        });
      });
    }
    
    // Highlight the selected node itself
    highlights.push({
      nodeId,
      type: 'source',
      color: '#4CAF50' // Green for selected node
    });
    
    this.customHighlights.set(highlights);
    this.triggerUpdate(`${type} highlighting for node ${nodeId}`);
  }

  // Trigger update with user feedback
  private triggerUpdate(changeType: string): void {
    if (!this.isGraphLoaded()) return;
    
    if (this.hasRenderedOnce()) {
      this.isUpdating.set(true);
      this.showInfo(`Updating ${changeType.toLowerCase()}...`);
      
      // Small delay to prevent rapid updates and show feedback
      setTimeout(() => {
        this.generateVisualization().catch((error) => {
          console.error('Update failed:', error);
          this.showError(`Failed to update ${changeType.toLowerCase()}`);
        });
      }, 100);
    }
  }

  // Utility methods
  downloadDotFile(): void {
    // For DOT download, we'll generate a simple DOT representation
    const structure = this.structure();
    if (!structure) {
      this.showError('No graph structure available to download');
      return;
    }

    try {
      // Generate a basic DOT string for download
      let dotContent = `digraph G {\n`;
      dotContent += `  layout="${this.selectedLayout()}";\n`;
      
      // Add nodes
      const nodeSet = this.extractUniqueNodes(structure.edgelist);
      nodeSet.forEach(nodeId => {
        const highlight = this.nodeHighlights().find(h => h.nodeId === nodeId);
        if (highlight) {
          dotContent += `  "${nodeId}" [fillcolor="${highlight.color}", style="filled"];\n`;
        } else {
          dotContent += `  "${nodeId}";\n`;
        }
      });
      
      // Add edges
      structure.edgelist.forEach(([from, to]) => {
        dotContent += `  "${from}" -> "${to}";\n`;
      });
      
      dotContent += `}\n`;

      const blob = new Blob([dotContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = `network_${this.selectedLayout()}_${this.highlightMode()}_${Date.now()}.dot`;
      link.click();
      
      window.URL.revokeObjectURL(url);
      this.showSuccess('DOT file downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      this.showError('Failed to download DOT file');
    }
  }

  exportVisualization(): void {
    const container = this.getContainer();
    if (!container) {
      this.showError('Visualization container not available');
      return;
    }

    const svg = container.querySelector('svg');
    if (!svg) {
      this.showError('No visualization to export');
      return;
    }

    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `network_${this.selectedLayout()}_${this.highlightMode()}_${Date.now()}.svg`;
      link.click();
      
      URL.revokeObjectURL(url);
      this.showSuccess('Visualization exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      this.showError('Failed to export visualization');
    }
  }

  // Task 6.3: Generate analysis-based highlights
  private generateAnalysisBasedHighlights(mode: string): NodeHighlight[] {
    const structure = this.structure();
    const lastResults = this.lastResults();
    const lastAnalysisType = this.lastAnalysisType();
    const highlights: NodeHighlight[] = [];

    if (!structure) return highlights;

    switch (mode) {
      case 'structure-analysis':
        if (lastAnalysisType === 'structure' || lastAnalysisType === 'full') {
          highlights.push(...this.generateStructureAnalysisHighlights(structure));
        }
        break;

      case 'diamond-analysis':
        if (lastAnalysisType === 'diamond' || lastAnalysisType === 'full') {
          highlights.push(...this.generateDiamondAnalysisHighlights(structure));
        }
        break;

      case 'reachability-analysis':
        if (lastAnalysisType === 'full' && lastResults) {
          highlights.push(...this.generateReachabilityAnalysisHighlights(lastResults, structure));
        }
        break;

      case 'prior-probabilities':
        highlights.push(...this.generatePriorProbabilityHeatMap(structure));
        break;

      case 'reachability-values':
        if (lastResults && lastAnalysisType === 'full') {
          highlights.push(...this.generateReachabilityValueHeatMap(lastResults));
        }
        break;
    }

    return highlights;
  }

  private generateStructureAnalysisHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    // Highlight nodes based on structural role
    structure.source_nodes?.forEach((nodeId: number) => {
      highlights.push({ nodeId, type: 'source', color: '#4CAF50' });
    });
    
    structure.fork_nodes?.forEach((nodeId: number) => {
      highlights.push({ nodeId, type: 'fork', color: '#FF9800' });
    });
    
    structure.join_nodes?.forEach((nodeId: number) => {
      highlights.push({ nodeId, type: 'join', color: '#2196F3' });
    });
    
    return highlights;
  }

  private generateDiamondAnalysisHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (structure.diamond_structures?.diamondStructures) {
      let diamondIndex = 0;
      Object.values(structure.diamond_structures.diamondStructures).forEach((diamond: DiamondStructureData) => {
        const hue = (diamondIndex * 137.5) % 360; // Golden angle for color distribution
        const color = `hsl(${hue}, 70%, 60%)`;
        
        diamond.diamond?.forEach((group: DiamondGroup) => {
          group.relevant_nodes?.forEach((nodeId: number) => {
            highlights.push({ nodeId, type: 'diamond', color });
          });
        });
        
        diamondIndex++;
      });
    }
    
    return highlights;
  }

  private generateReachabilityAnalysisHighlights(results: any, structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (Array.isArray(results)) {
      // Find min and max probabilities for color scaling
      const probabilities = results.map(r => r.probability);
      const minProb = Math.min(...probabilities);
      const maxProb = Math.max(...probabilities);
      
      results.forEach(result => {
        // Scale probability to color intensity (0-1)
        const intensity = maxProb > minProb ?
          (result.probability - minProb) / (maxProb - minProb) : 0.5;
        
        // Create heat map color (blue to red scale)
        const hue = (1 - intensity) * 240; // Blue (240) to Red (0)
        const color = `hsl(${hue}, 70%, ${50 + intensity * 30}%)`;
        
        highlights.push({
          nodeId: result.node,
          type: 'source',
          color
        });
      });
    }
    
    return highlights;
  }

  private generatePriorProbabilityHeatMap(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (structure.node_priors) {
      const priors = Object.values(structure.node_priors) as number[];
      const minPrior = Math.min(...priors);
      const maxPrior = Math.max(...priors);
      
      Object.entries(structure.node_priors).forEach(([nodeId, prior]) => {
        const intensity = maxPrior > minPrior ?
          ((prior as number) - minPrior) / (maxPrior - minPrior) : 0.5;
        
        const hue = intensity * 120; // Green scale based on probability
        const color = `hsl(${hue}, 70%, ${40 + intensity * 40}%)`;
        
        highlights.push({
          nodeId: parseInt(nodeId),
          type: 'source',
          color
        });
      });
    }
    
    return highlights;
  }

  private generateReachabilityValueHeatMap(results: any): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (Array.isArray(results)) {
      const probabilities = results.map(r => r.probability);
      const minProb = Math.min(...probabilities);
      const maxProb = Math.max(...probabilities);
      
      results.forEach(result => {
        const intensity = maxProb > minProb ?
          (result.probability - minProb) / (maxProb - minProb) : 0.5;
        
        const hue = intensity * 60; // Yellow to red scale
        const color = `hsl(${hue}, 80%, ${30 + intensity * 50}%)`;
        
        highlights.push({
          nodeId: result.node,
          type: 'source',
          color
        });
      });
    }
    
    return highlights;
  }

  private generateIterationHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    structure.iteration_sets?.forEach((set: number[], index: number) => {
      const hue = (index * 60) % 360;
      const color = `hsl(${hue}, 70%, 60%)`;
      
      set.forEach(nodeId => {
        highlights.push({ nodeId, type: 'source', color });
      });
    });
    
    return highlights;
  }

  private generateDiamondHighlightsFromStructure(structure: GraphStructure): NodeHighlight[] {
    return this.highlightService.generateHighlights(structure, 'diamond-structures');
  }

  private async loadAvailableDiamonds(): Promise<void> {
    try {
      const csvContent = this.graphState.csvContent();
      if (!csvContent) return;
      
      const request = this.mainServerService.buildEnhancedRequest(
        csvContent,
        { nodePrior: 1.0, edgeProb: 0.9, overrideNodePrior: false, overrideEdgeProb: false },
        { includeClassification: true, enableMonteCarlo: false }
      );
      
      const result = await this.mainServerService.analyzeEnhanced(request).toPromise();
      if (result?.success && result.diamondData?.diamondClassifications) {
        // Combine classifications with their structures
        const diamondsWithStructures = result.diamondData.diamondClassifications.map(diamond => ({
          ...diamond,
          diamondStructure: result.diamondData?.diamondStructures?.[diamond.join_node.toString()]
        }));
        this.availableDiamonds.set(diamondsWithStructures);
      }
    } catch (error) {
      console.warn('Could not load available diamonds:', error);
    }
  }

  private generateDiamondHighlights(joinNode: number): NodeHighlight[] {
    const diamond = this.availableDiamonds().find(d => d.join_node === joinNode);
    if (!diamond?.diamondStructure) return [];
    
    const highlights: NodeHighlight[] = [];
    const diamondNodes = new Set<number>();
    
    // Collect all diamond nodes
    diamond.diamondStructure.diamond.forEach((group: DiamondGroup) => {
      group.relevant_nodes.forEach((node: number) => diamondNodes.add(node));
    });
    diamondNodes.add(diamond.diamondStructure.join_node);
    
    // Create highlights for diamond nodes
    diamondNodes.forEach(nodeId => {
      highlights.push({
        nodeId,
        type: 'diamond',
        color: '#FF5722'
      });
    });
    
    return highlights;
  }

  private findSimplePath(from: number, to: number, structure: GraphStructure): number[] {
    // Simple BFS pathfinding - in production, use a more sophisticated algorithm
    const visited = new Set<number>();
    const queue: { node: number; path: number[] }[] = [{ node: from, path: [from] }];
    
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      
      if (node === to) {
        return path;
      }
      
      if (visited.has(node)) continue;
      visited.add(node);
      
      // Find connected nodes
      structure.edgelist.forEach(([source, target]: [number, number]) => {
        if (source === node && !visited.has(target)) {
          queue.push({ node: target, path: [...path, target] });
        }
      });
    }
    
    return []; // No path found
  }

  private findSinkNodes(structure: GraphStructure): number[] {
    const allNodes = new Set<number>();
    const hasOutgoing = new Set<number>();
    
    structure.edgelist.forEach(([from, to]: [number, number]) => {
      allNodes.add(from);
      allNodes.add(to);
      hasOutgoing.add(from);
    });
    
    return Array.from(allNodes).filter(node => !hasOutgoing.has(node));
  }

  private getAllDiamondNodes(): number[] {
    const diamondNodes = new Set<number>();
    
    this.availableDiamonds().forEach(diamond => {
      if (diamond.diamondStructure) {
        diamond.diamondStructure.diamond?.forEach((group: DiamondGroup) => {
          group.relevant_nodes?.forEach((node: number) => diamondNodes.add(node));
        });
        diamondNodes.add(diamond.diamondStructure.join_node);
      }
    });
    
    return Array.from(diamondNodes);
  }

  private findAncestors(nodeId: number, structure: GraphStructure): number[] {
    const ancestors = new Set<number>();
    const queue = [nodeId];
    
    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      
      structure.edgelist.forEach(([from, to]: [number, number]) => {
        if (to === currentNode && !ancestors.has(from)) {
          ancestors.add(from);
          queue.push(from);
        }
      });
    }
    
    return Array.from(ancestors);
  }

  private findDescendants(nodeId: number, structure: GraphStructure): number[] {
    const descendants = new Set<number>();
    const queue = [nodeId];
    
    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      
      structure.edgelist.forEach(([from, to]: [number, number]) => {
        if (from === currentNode && !descendants.has(to)) {
          descendants.add(to);
          queue.push(to);
        }
      });
    }
    
    return Array.from(descendants);
  }

  // Enhanced node details enrichment
  private enrichNodeDetails(nodeId: number): any {
    const structure = this.structure();
    const lastResults = this.lastResults();
    
    if (!structure) return { nodeId, nodeType: 'unknown' };
    
    // Determine node type
    let nodeType = 'regular';
    if (structure.source_nodes?.includes(nodeId)) nodeType = 'source';
    else if (structure.fork_nodes?.includes(nodeId)) nodeType = 'fork';
    else if (structure.join_nodes?.includes(nodeId)) nodeType = 'join';
    else if (this.findSinkNodes(structure).includes(nodeId)) nodeType = 'sink';
    
    // Get prior probability
    const priorProbability = structure.node_priors?.[nodeId] || null;
    
    // Get reachability value from results
    let reachabilityValue = null;
    if (lastResults && Array.isArray(lastResults)) {
      const result = lastResults.find(r => r.node === nodeId);
      reachabilityValue = result?.probability || null;
    }
    
    // Calculate in-degree and out-degree
    let inDegree = 0;
    let outDegree = 0;
    structure.edgelist.forEach(([from, to]) => {
      if (to === nodeId) inDegree++;
      if (from === nodeId) outDegree++;
    });
    
    // Find ancestors and descendants
    const ancestors = this.findAncestors(nodeId, structure);
    const descendants = this.findDescendants(nodeId, structure);
    
    // Find diamond memberships
    const diamondMemberships: string[] = [];
    if (structure.diamond_structures?.diamondStructures) {
      Object.entries(structure.diamond_structures.diamondStructures).forEach(([joinNode, diamond]) => {
        const diamondData = diamond as DiamondStructureData;
        const isInDiamond = diamondData.diamond?.some((group: DiamondGroup) =>
          group.relevant_nodes?.includes(nodeId)
        ) || diamondData.join_node === nodeId;
        
        if (isInDiamond) {
          diamondMemberships.push(`Diamond at Join ${joinNode}`);
        }
      });
    }
    
    // Find iteration set
    let iterationSet = null;
    structure.iteration_sets?.forEach((set, index) => {
      if (set.includes(nodeId)) {
        iterationSet = index;
      }
    });
    
    return {
      nodeId,
      nodeType,
      priorProbability,
      reachabilityValue,
      ancestors,
      descendants,
      diamondMemberships,
      iterationSet,
      inDegree,
      outDegree,
      // Additional computed properties
      hasResults: reachabilityValue !== null,
      isPriorAvailable: priorProbability !== null,
      connectivityRatio: inDegree + outDegree > 0 ? outDegree / (inDegree + outDegree) : 0,
      isHighlyConnected: inDegree + outDegree > 3,
      isBottleneck: inDegree > 2 && outDegree > 2,
      isTerminal: (inDegree === 0 && nodeType === 'source') || (outDegree === 0 && nodeType === 'sink')
    };
  }

  // Setup interactive node handlers for D3 visualization
  private setupNodeInteractionHandlers(container: HTMLElement): void {
    // Find all node elements (circles or other shapes)
    const nodeElements = container.querySelectorAll('.node, circle[data-node-id], g.node');
    
    nodeElements.forEach(nodeElement => {
      const element = nodeElement as HTMLElement;
      
      // Extract node ID from various possible attributes
      let nodeId: number | null = null;
      if (element.dataset['nodeId']) {
        nodeId = parseInt(element.dataset['nodeId']);
      } else if (element.getAttribute('id')) {
        const idMatch = element.getAttribute('id')?.match(/node-(\d+)/);
        if (idMatch) nodeId = parseInt(idMatch[1]);
      } else {
        // Try to find node ID in child elements
        const childWithId = element.querySelector('[data-node-id], [id*="node"]');
        if (childWithId) {
          const childId = childWithId.getAttribute('data-node-id') || childWithId.getAttribute('id');
          const idMatch = childId?.match(/(\d+)/);
          if (idMatch) nodeId = parseInt(idMatch[1]);
        }
      }
      
      if (nodeId === null) return;
      
      const finalNodeId = nodeId;
      
      // Mouse enter - show tooltip
      element.addEventListener('mouseenter', (event) => {
        const rect = element.getBoundingClientRect();
        this.showNodeTooltip(finalNodeId, rect.left + rect.width / 2, rect.top);
      });
      
      // Mouse leave - hide tooltip
      element.addEventListener('mouseleave', () => {
        this.hideNodeTooltip();
      });
      
      // Click - select node and show details
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        this.selectNode(finalNodeId);
      });
      
      // Add visual feedback for hover
      element.addEventListener('mouseenter', () => {
        element.style.cursor = 'pointer';
        element.style.opacity = '0.8';
      });
      
      element.addEventListener('mouseleave', () => {
        element.style.cursor = 'default';
        element.style.opacity = '1';
      });
    });
    
    // Click outside to clear selection
    container.addEventListener('click', (event) => {
      if (event.target === container) {
        this.clearNodeSelection();
      }
    });
  }

  // Private methods
  private getContainer(): HTMLElement | null {
    if (this.dotContainer?.nativeElement) {
      return this.dotContainer.nativeElement;
    }
    
    this.cdr.detectChanges();
    if (this.dotContainer?.nativeElement) {
      return this.dotContainer.nativeElement;
    }
    
    const element = document.querySelector('.dot-container') as HTMLElement;
    if (element) {
      return element;
    }
    
    console.warn('⚠️ No container available');
    return null;
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['error-snackbar']
    });
  }

  private showInfo(message: string): void {
    this.snackBar.open(message, '', {
      duration: 1000,
      panelClass: ['info-snackbar']
    });
  }
}