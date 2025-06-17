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
import { GraphStateService } from '../../services/graph-state-service';
import { HighlightService } from '../../services/vis/highlight.service';
import { LayoutOption, HighlightOption, VisualizationConfig, NodeHighlight } from '../../shared/models/vis/vis-types';
import { VisualizationRendererService } from '../../services/vis/vis-renderer-service';
import { ZOOM_CONFIG, LAYOUT_OPTIONS, HIGHLIGHT_OPTIONS } from '../../shared/models/vis/vis-constants';

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

  // State signals
  isGeneratingDot = signal(false);
  selectedLayout = signal<string>('dot');
  zoomLevel = signal<number>(ZOOM_CONFIG.DEFAULT);
  showNodeLabels = signal<boolean>(true);
  showEdgeLabels = signal<boolean>(false);
  highlightMode = signal<string>('none');
  
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

  // Node highlights based on current mode
  readonly nodeHighlights = computed((): NodeHighlight[] => {
    const structure = this.structure();
    const mode = this.highlightMode();
    
    if (!structure) return [];
    
    return this.highlightService.generateHighlights(structure, mode);
  });

  // For template compatibility (no longer used but kept for DOT download)
  readonly dotString = signal<string>('');

  // Lifecycle hooks
  async ngAfterViewInit(): Promise<void> {
    console.log('🔧 Visualization component initializing...');
    
    // If graph is already loaded, generate visualization
    if (this.isGraphLoaded()) {
      setTimeout(() => {
        this.generateVisualization();
      }, 200);
    }
    
    console.log('✅ Visualization component initialized');
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
      console.log('🎨 Generating visualization with config:', {
        layout: config.layout,
        highlightMode: config.highlightMode,
        highlights: config.highlights.length,
        showNodeLabels: config.showNodeLabels,
        showEdgeLabels: config.showEdgeLabels,
        zoomLevel: config.zoomLevel
      });

      // Clear container
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Preparing D3 visualization...</div>';

      // Render with D3
      await this.rendererService.renderWithD3(container, structure, config);
      
      this.hasRenderedOnce.set(true);
      
      const message = this.isUpdating() 
        ? 'Visualization updated!'
        : 'Visualization generated successfully with D3!';
        
      this.showSuccess(message);
      
      console.log('✅ D3 rendering completed successfully');

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
    console.log(`🔄 Layout changed to: ${this.selectedLayout()}`);
    this.triggerUpdate('Layout');
  }

  onZoomChange(value: number): void {
    console.log(`🔍 Zoom changed to: ${value}%`);
    this.zoomLevel.set(value);
    
    // Apply zoom immediately without full re-render for better UX
    const container = this.getContainer();
    if (container && this.hasRenderedOnce()) {
      this.rendererService.applyZoom(value, container);
    }
  }

  onHighlightModeChange(): void {
    console.log(`🎨 Highlight mode changed to: ${this.highlightMode()}`);
    console.log('🎨 Available highlights:', this.nodeHighlights());
    this.triggerUpdate('Highlighting');
  }

  onNodeLabelsChange(): void {
    console.log(`🏷️ Node labels changed to: ${this.showNodeLabels()}`);
    this.triggerUpdate('Node labels');
  }

  onEdgeLabelsChange(): void {
    console.log(`🏷️ Edge labels changed to: ${this.showEdgeLabels()}`);
    this.triggerUpdate('Edge labels');
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

  resetView(): void {
    console.log('🔄 Resetting view to defaults...');
    
    this.zoomLevel.set(ZOOM_CONFIG.DEFAULT);
    this.selectedLayout.set('dot');
    this.highlightMode.set('none');
    this.showNodeLabels.set(true);
    this.showEdgeLabels.set(false);
    
    if (this.isGraphLoaded()) {
      this.showInfo('Resetting to defaults...');
      setTimeout(() => {
        this.generateVisualization();
      }, 100);
    }
  }

  debugVisualization(): void {
    const config = this.currentConfig();
    const highlights = this.nodeHighlights();
    
    console.log('🔍 VISUALIZATION DEBUG INFORMATION:');
    console.log('='.repeat(50));
    console.log('📊 GRAPH STATE:');
    console.log('  Graph loaded:', this.isGraphLoaded());
    console.log('  Node count:', this.nodeCount());
    console.log('  Edge count:', this.edgeCount());
    console.log('  Structure available:', !!this.structure());
    console.log('');
    console.log('🎛️ CURRENT CONFIGURATION:');
    console.log('  Layout:', config.layout);
    console.log('  Highlight mode:', config.highlightMode);
    console.log('  Show node labels:', config.showNodeLabels);
    console.log('  Show edge labels:', config.showEdgeLabels);
    console.log('  Zoom level:', config.zoomLevel + '%');
    console.log('');
    console.log('🎨 HIGHLIGHTING:');
    console.log('  Active highlights:', highlights.length);
    console.log('  Highlight details:', highlights);
    if (highlights.length > 0) {
      highlights.forEach(h => console.log(`    Node ${h.nodeId}: ${h.type} (${h.color})`));
    }
    console.log('');
    console.log('🔧 COMPONENT STATE:');
    console.log('  Container available:', !!this.getContainer());
    console.log('  ViewChild available:', !!this.dotContainer?.nativeElement);
    console.log('  Has rendered once:', this.hasRenderedOnce());
    console.log('  Is generating:', this.isGeneratingDot());
    console.log('  Is updating:', this.isUpdating());
    console.log('  d3 available:', !!window.d3);
    console.log('  Renderer: D3 only');
    console.log('='.repeat(50));
    
    // Also log graph structure details
    const structure = this.structure();
    if (structure) {
      console.log('📊 GRAPH STRUCTURE DETAILS:');
      console.log('  Source nodes:', structure.source_nodes?.length || 0, structure.source_nodes);
      console.log('  Fork nodes:', structure.fork_nodes?.length || 0, structure.fork_nodes);
      console.log('  Join nodes:', structure.join_nodes?.length || 0, structure.join_nodes);
      console.log('  Edge list length:', structure.edgelist?.length || 0);
      console.log('  First few edges:', structure.edgelist?.slice(0, 5));
      console.log('  Iteration sets:', structure.iteration_sets?.length || 0);
      console.log('='.repeat(50));
    }
    
    this.showSuccess('Debug information logged to console');
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