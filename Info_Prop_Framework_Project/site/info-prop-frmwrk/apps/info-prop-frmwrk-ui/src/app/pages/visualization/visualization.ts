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
import { HighlightService } from '../../services/vis/highlight.service';
import { MainServerService } from '../../services/main-server-service';
import { LayoutOption, HighlightOption, VisualizationConfig, NodeHighlight } from '../../shared/models/vis/vis-types';
import { VisualizationRendererService } from '../../services/vis/vis-renderer-service';
import { ZOOM_CONFIG, LAYOUT_OPTIONS, HIGHLIGHT_OPTIONS } from '../../shared/models/vis/vis-constants';
import { DiamondClassification, DiamondAnalysisResponse, DiamondStructureData } from '../../shared/models/main-sever-interface';

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
  selectedNodeInfo = signal<any>(null);
  
  // Track rendering state
  private hasRenderedOnce = signal<boolean>(false);
  private isUpdating = signal<boolean>(false);

  // Constants exposed to template
  readonly layoutOptions: LayoutOption[] = LAYOUT_OPTIONS;
  readonly highlightOptions: HighlightOption[] = HIGHLIGHT_OPTIONS;

  // Computed properties
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly structure = computed(() => this.graphState.graphStructure());
  readonly nodeCount = computed(() => this.graphState.nodeCount());
  readonly edgeCount = computed(() => this.graphState.edgeCount());

  // Current visualization configuration
  readonly currentConfig = computed((): VisualizationConfig => ({
    layout: this.selectedLayout(),
    zoomLevel: this.zoomLevel(),
    showNodeLabels: this.showNodeLabels(),
    showEdgeLabels: this.showEdgeLabels(),
    highlightMode: this.highlightMode(),
    highlights: this.nodeHighlights()
  }));

  // Enhanced node highlights based on individual controls matching static version
  readonly nodeHighlights = computed((): NodeHighlight[] => {
    const structure = this.structure();
    let highlights: NodeHighlight[] = [];
    
    if (!structure) return [];
    
    // Individual node type highlights
    if (this.showSourceNodes()) {
      structure.source_nodes?.forEach(nodeId => {
        highlights.push({ nodeId, type: 'source', color: '#4CAF50' });
      });
    }
    
    if (this.showSinkNodes()) {
      // Assume sink nodes are nodes with no outgoing edges
      const sinkNodes = this.findSinkNodes(structure);
      sinkNodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'sink', color: '#4CAF50' });
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
    
    if (this.showDiamonds()) {
      // Highlight all diamond structure nodes
      const diamondNodes = this.getAllDiamondNodes();
      diamondNodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'diamond', color: '#E91E63' });
      });
    }
    
    if (this.showIterations()) {
      // Color by iteration sets with gradient
      structure.iteration_sets?.forEach((iterationSet, index) => {
        const hue = (index * 360) / (structure.iteration_sets?.length || 1);
        const color = `hsl(${hue}, 70%, 60%)`;
        iterationSet.forEach(nodeId => {
          highlights.push({ nodeId, type: 'diamond', color });
        });
      });
    }
    
    // Add focused diamond highlights
    const focusedDiamondId = this.focusedDiamond();
    if (focusedDiamondId) {
      const diamondHighlights = this.generateDiamondHighlights(focusedDiamondId);
      highlights = [...highlights, ...diamondHighlights];
    }
    
    // Add custom highlights
    const customHighlights = this.customHighlights();
    highlights = [...highlights, ...customHighlights];
    
    // Add path highlights
    const pathNodes = this.highlightedPath();
    if (pathNodes.length > 0) {
      const pathHighlights = pathNodes.map(nodeId => ({
        nodeId,
        type: 'diamond' as const,
        color: '#00BCD4'
      }));
      highlights = [...highlights, ...pathHighlights];
    }
    
    return highlights;
  });

  // For template compatibility (no longer used but kept for DOT download)
  readonly dotString = signal<string>('');

  // Lifecycle hooks
  async ngAfterViewInit(): Promise<void> {
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
    
    // If graph is already loaded, generate visualization
    if (this.isGraphLoaded()) {
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
    if (!this.isGraphLoaded()) {
      this.showError('No graph loaded. Please upload a graph first.');
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

      // Render with D3
      await this.rendererService.renderWithD3(container, structure, config);
      
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
    diamond.diamondStructure.diamond.forEach((group: any) => {
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

  private findSimplePath(from: number, to: number, structure: any): number[] {
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

  private findSinkNodes(structure: any): number[] {
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
        diamond.diamondStructure.diamond?.forEach((group: any) => {
          group.relevant_nodes?.forEach((node: number) => diamondNodes.add(node));
        });
        diamondNodes.add(diamond.diamondStructure.join_node);
      }
    });
    
    return Array.from(diamondNodes);
  }

  private findAncestors(nodeId: number, structure: any): number[] {
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

  private findDescendants(nodeId: number, structure: any): number[] {
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