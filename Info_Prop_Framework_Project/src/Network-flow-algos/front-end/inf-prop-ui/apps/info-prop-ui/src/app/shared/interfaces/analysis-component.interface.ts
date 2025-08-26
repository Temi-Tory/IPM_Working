import { signal, Signal } from '@angular/core';

export type ViewMode = 'visual' | 'dashboard';

export interface AnalysisComponentData<T = any> {
  structure: any; // DetectedNetworkStructure
  results: T;
}

export interface AnalysisViewModes {
  visual: boolean;
  dashboard: boolean;
}

export interface FilterOptions {
  [key: string]: any;
}

export interface VisualizationConfig {
  highlightNodes?: number[];
  highlightEdges?: Array<{from: number, to: number}>;
  nodeColors?: Record<number, string>;
  edgeColors?: Record<string, string>;
  showLabels?: boolean;
  zoomLevel?: number;
  centerOn?: number;
}

export abstract class BaseAnalysisComponent<T = any> {
  // View mode management
  currentViewMode = signal<ViewMode>('visual');
  availableViewModes = signal<AnalysisViewModes>({ visual: true, dashboard: true });

  // Data and state
  componentData = signal<AnalysisComponentData<T> | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Filtering and visualization
  activeFilters = signal<FilterOptions>({});
  visualizationConfig = signal<VisualizationConfig>({
    showLabels: true,
    zoomLevel: 1,
    highlightNodes: [],
    highlightEdges: []
  });

  constructor() {}

  // Abstract methods that must be implemented by subclasses
  abstract initializeComponent(): void;
  abstract processData(data: AnalysisComponentData<T>): void;
  abstract updateVisualization(config: VisualizationConfig): void;
  abstract exportData(format: 'json' | 'csv' | 'png'): void;

  // Common view mode management
  switchViewMode(mode: ViewMode): void {
    const availableModes = this.availableViewModes();
    if (availableModes[mode]) {
      this.currentViewMode.set(mode);
      this.onViewModeChanged(mode);
    }
  }

  protected onViewModeChanged(mode: ViewMode): void {
    // Override in subclasses for custom behavior
  }

  // Filter management
  updateFilter(key: string, value: any): void {
    this.activeFilters.update(filters => ({
      ...filters,
      [key]: value
    }));
    this.onFiltersChanged();
  }

  clearFilters(): void {
    this.activeFilters.set({});
    this.onFiltersChanged();
  }

  protected onFiltersChanged(): void {
    // Override in subclasses to handle filter changes
  }

  // Visualization helpers
  highlightNodes(nodeIds: number[]): void {
    this.visualizationConfig.update(config => ({
      ...config,
      highlightNodes: nodeIds
    }));
    this.updateVisualization(this.visualizationConfig());
  }

  highlightEdges(edges: Array<{from: number, to: number}>): void {
    this.visualizationConfig.update(config => ({
      ...config,
      highlightEdges: edges
    }));
    this.updateVisualization(this.visualizationConfig());
  }

  resetHighlights(): void {
    this.visualizationConfig.update(config => ({
      ...config,
      highlightNodes: [],
      highlightEdges: []
    }));
    this.updateVisualization(this.visualizationConfig());
  }

  // Utility methods
  protected setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  protected setError(error: string | null): void {
    this.error.set(error);
  }

  protected setData(data: AnalysisComponentData<T> | null): void {
    this.componentData.set(data);
    if (data) {
      this.processData(data);
    }
  }

  // Template helper methods for common UI patterns
  hasVisualMode(): boolean {
    return this.availableViewModes().visual;
  }

  hasDashboardMode(): boolean {
    return this.availableViewModes().dashboard;
  }

  isVisualMode(): boolean {
    return this.currentViewMode() === 'visual';
  }

  isDashboardMode(): boolean {
    return this.currentViewMode() === 'dashboard';
  }
}