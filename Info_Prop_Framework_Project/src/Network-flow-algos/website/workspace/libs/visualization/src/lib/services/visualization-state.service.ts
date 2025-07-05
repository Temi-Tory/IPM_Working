import { Injectable, signal, computed, effect } from '@angular/core';

// Visualization types and interfaces
export interface VisualizationSettings {
  layout: LayoutType;
  nodeSize: number;
  edgeWidth: number;
  showLabels: boolean;
  showProbabilities: boolean;
  colorScheme: ColorScheme;
  animationSpeed: number;
  zoomLevel: number;
  panPosition: { x: number; y: number };
}

export interface SelectionState {
  selectedNodes: number[];
  selectedEdges: string[];
  hoveredNode: number | null;
  hoveredEdge: string | null;
  selectionMode: SelectionMode;
}

export interface HighlightState {
  highlightedPaths: Path[];
  highlightedNodes: number[];
  highlightedEdges: string[];
  highlightColor: string;
  highlightOpacity: number;
}

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
  fit: boolean;
  center: { x: number; y: number };
  bounds: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
}

export interface Path {
  id: string;
  nodes: number[];
  edges: string[];
  probability?: number;
  color?: string;
}

export type LayoutType = 
  | 'dagre' 
  | 'hierarchical' 
  | 'force-directed' 
  | 'circular' 
  | 'grid' 
  | 'breadthfirst' 
  | 'concentric';

export type ColorScheme = 
  | 'default' 
  | 'probability' 
  | 'analysis-results' 
  | 'custom';

export type SelectionMode = 
  | 'single' 
  | 'multiple' 
  | 'path' 
  | 'area';

export interface NodeStyle {
  id: number;
  color?: string;
  size?: number;
  shape?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  label?: string;
  labelColor?: string;
}

export interface EdgeStyle {
  id: string;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  label?: string;
  labelColor?: string;
}

/**
 * Visualization State Service using Angular 20 Native Signals
 * Manages all visualization-related state for Cytoscape.js integration
 */
@Injectable({ providedIn: 'root' })
export class VisualizationStateService {
  // Private signals for internal state
  private _settings = signal<VisualizationSettings>({
    layout: 'dagre',
    nodeSize: 30,
    edgeWidth: 2,
    showLabels: true,
    showProbabilities: false,
    colorScheme: 'default',
    animationSpeed: 500,
    zoomLevel: 1,
    panPosition: { x: 0, y: 0 }
  });

  private _selection = signal<SelectionState>({
    selectedNodes: [],
    selectedEdges: [],
    hoveredNode: null,
    hoveredEdge: null,
    selectionMode: 'single'
  });

  private _highlight = signal<HighlightState>({
    highlightedPaths: [],
    highlightedNodes: [],
    highlightedEdges: [],
    highlightColor: '#ff6b6b',
    highlightOpacity: 0.8
  });

  private _viewport = signal<ViewportState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    fit: true,
    center: { x: 0, y: 0 },
    bounds: null
  });

  private _nodeStyles = signal<Record<number, NodeStyle>>({});
  private _edgeStyles = signal<Record<string, EdgeStyle>>({});
  private _isInitialized = signal(false);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  // Public readonly signals
  readonly settings = this._settings.asReadonly();
  readonly selection = this._selection.asReadonly();
  readonly highlight = this._highlight.asReadonly();
  readonly viewport = this._viewport.asReadonly();
  readonly nodeStyles = this._nodeStyles.asReadonly();
  readonly edgeStyles = this._edgeStyles.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly hasSelection = computed(() => {
    const selection = this._selection();
    return selection.selectedNodes.length > 0 || selection.selectedEdges.length > 0;
  });

  readonly selectionCount = computed(() => {
    const selection = this._selection();
    return selection.selectedNodes.length + selection.selectedEdges.length;
  });

  readonly hasHighlights = computed(() => {
    const highlight = this._highlight();
    return highlight.highlightedPaths.length > 0 || 
           highlight.highlightedNodes.length > 0 || 
           highlight.highlightedEdges.length > 0;
  });

  readonly canZoomIn = computed(() => this._viewport().zoom < 3);
  readonly canZoomOut = computed(() => this._viewport().zoom > 0.1);

  readonly visualizationConfig = computed(() => {
    const settings = this._settings();
    const viewport = this._viewport();
    
    return {
      layout: {
        name: settings.layout,
        animate: true,
        animationDuration: settings.animationSpeed
      },
      style: this.generateCytoscapeStyles(),
      zoom: viewport.zoom,
      pan: viewport.pan,
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.1
    };
  });

  readonly selectionSummary = computed(() => {
    const selection = this._selection();
    return {
      nodeCount: selection.selectedNodes.length,
      edgeCount: selection.selectedEdges.length,
      hasHover: selection.hoveredNode !== null || selection.hoveredEdge !== null,
      mode: selection.selectionMode
    };
  });

  constructor() {
    // Effect: Save settings to localStorage
    effect(() => {
      const settings = this._settings();
      try {
        localStorage.setItem('visualization-settings', JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to save visualization settings:', error);
      }
    });

    // Effect: Log selection changes
    effect(() => {
      const selection = this._selection();
      if (this.hasSelection()) {
        console.log('Selection changed:', {
          nodes: selection.selectedNodes,
          edges: selection.selectedEdges
        });
      }
    });

    // Effect: Error logging
    effect(() => {
      const error = this._error();
      if (error) {
        console.error('Visualization Error:', error);
      }
    });

    // Load saved settings
    this.loadSettings();
  }

  // Settings methods
  updateSettings(partial: Partial<VisualizationSettings>): void {
    this._settings.update(current => ({
      ...current,
      ...partial
    }));
  }

  setLayout(layout: LayoutType): void {
    this._settings.update(settings => ({
      ...settings,
      layout
    }));
  }

  setColorScheme(colorScheme: ColorScheme): void {
    this._settings.update(settings => ({
      ...settings,
      colorScheme
    }));
  }

  setNodeSize(size: number): void {
    this._settings.update(settings => ({
      ...settings,
      nodeSize: Math.max(10, Math.min(100, size))
    }));
  }

  setEdgeWidth(width: number): void {
    this._settings.update(settings => ({
      ...settings,
      edgeWidth: Math.max(1, Math.min(10, width))
    }));
  }

  toggleLabels(): void {
    this._settings.update(settings => ({
      ...settings,
      showLabels: !settings.showLabels
    }));
  }

  toggleProbabilities(): void {
    this._settings.update(settings => ({
      ...settings,
      showProbabilities: !settings.showProbabilities
    }));
  }

  // Selection methods
  selectNode(nodeId: number, addToSelection = false): void {
    this._selection.update(selection => {
      const selectedNodes = addToSelection && selection.selectionMode === 'multiple'
        ? [...selection.selectedNodes, nodeId]
        : [nodeId];
      
      return {
        ...selection,
        selectedNodes: [...new Set(selectedNodes)] // Remove duplicates
      };
    });
  }

  selectEdge(edgeId: string, addToSelection = false): void {
    this._selection.update(selection => {
      const selectedEdges = addToSelection && selection.selectionMode === 'multiple'
        ? [...selection.selectedEdges, edgeId]
        : [edgeId];
      
      return {
        ...selection,
        selectedEdges: [...new Set(selectedEdges)] // Remove duplicates
      };
    });
  }

  selectMultiple(nodeIds: number[], edgeIds: string[] = []): void {
    this._selection.update(selection => ({
      ...selection,
      selectedNodes: [...new Set(nodeIds)],
      selectedEdges: [...new Set(edgeIds)]
    }));
  }

  deselectNode(nodeId: number): void {
    this._selection.update(selection => ({
      ...selection,
      selectedNodes: selection.selectedNodes.filter(id => id !== nodeId)
    }));
  }

  deselectEdge(edgeId: string): void {
    this._selection.update(selection => ({
      ...selection,
      selectedEdges: selection.selectedEdges.filter(id => id !== edgeId)
    }));
  }

  clearSelection(): void {
    this._selection.update(selection => ({
      ...selection,
      selectedNodes: [],
      selectedEdges: []
    }));
  }

  setHoveredNode(nodeId: number | null): void {
    this._selection.update(selection => ({
      ...selection,
      hoveredNode: nodeId
    }));
  }

  setHoveredEdge(edgeId: string | null): void {
    this._selection.update(selection => ({
      ...selection,
      hoveredEdge: edgeId
    }));
  }

  setSelectionMode(mode: SelectionMode): void {
    this._selection.update(selection => ({
      ...selection,
      selectionMode: mode
    }));
  }

  // Highlight methods
  highlightPath(path: Path): void {
    this._highlight.update(highlight => ({
      ...highlight,
      highlightedPaths: [...highlight.highlightedPaths, path],
      highlightedNodes: [...new Set([...highlight.highlightedNodes, ...path.nodes])],
      highlightedEdges: [...new Set([...highlight.highlightedEdges, ...path.edges])]
    }));
  }

  highlightNodes(nodeIds: number[], color?: string): void {
    this._highlight.update(highlight => ({
      ...highlight,
      highlightedNodes: [...new Set([...highlight.highlightedNodes, ...nodeIds])],
      highlightColor: color || highlight.highlightColor
    }));
  }

  highlightEdges(edgeIds: string[], color?: string): void {
    this._highlight.update(highlight => ({
      ...highlight,
      highlightedEdges: [...new Set([...highlight.highlightedEdges, ...edgeIds])],
      highlightColor: color || highlight.highlightColor
    }));
  }

  clearHighlights(): void {
    this._highlight.set({
      highlightedPaths: [],
      highlightedNodes: [],
      highlightedEdges: [],
      highlightColor: '#ff6b6b',
      highlightOpacity: 0.8
    });
  }

  setHighlightColor(color: string): void {
    this._highlight.update(highlight => ({
      ...highlight,
      highlightColor: color
    }));
  }

  // Viewport methods
  setZoom(zoom: number): void {
    const clampedZoom = Math.max(0.1, Math.min(3, zoom));
    this._viewport.update(viewport => ({
      ...viewport,
      zoom: clampedZoom
    }));
  }

  zoomIn(factor = 1.2): void {
    this._viewport.update(viewport => ({
      ...viewport,
      zoom: Math.min(3, viewport.zoom * factor)
    }));
  }

  zoomOut(factor = 0.8): void {
    this._viewport.update(viewport => ({
      ...viewport,
      zoom: Math.max(0.1, viewport.zoom * factor)
    }));
  }

  setPan(x: number, y: number): void {
    this._viewport.update(viewport => ({
      ...viewport,
      pan: { x, y }
    }));
  }

  fitToView(): void {
    this._viewport.update(viewport => ({
      ...viewport,
      fit: true,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }));
  }

  centerView(): void {
    this._viewport.update(viewport => ({
      ...viewport,
      pan: { x: 0, y: 0 }
    }));
  }

  // Style methods
  setNodeStyle(nodeId: number, style: Partial<NodeStyle>): void {
    this._nodeStyles.update(styles => ({
      ...styles,
      [nodeId]: {
        ...styles[nodeId],
        id: nodeId,
        ...style
      }
    }));
  }

  setEdgeStyle(edgeId: string, style: Partial<EdgeStyle>): void {
    this._edgeStyles.update(styles => ({
      ...styles,
      [edgeId]: {
        ...styles[edgeId],
        id: edgeId,
        ...style
      }
    }));
  }

  clearNodeStyle(nodeId: number): void {
    this._nodeStyles.update(styles => {
      const newStyles = { ...styles };
      delete newStyles[nodeId];
      return newStyles;
    });
  }

  clearEdgeStyle(edgeId: string): void {
    this._edgeStyles.update(styles => {
      const newStyles = { ...styles };
      delete newStyles[edgeId];
      return newStyles;
    });
  }

  clearAllStyles(): void {
    this._nodeStyles.set({});
    this._edgeStyles.set({});
  }

  // State management methods
  setInitialized(initialized: boolean): void {
    this._isInitialized.set(initialized);
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  setError(error: string | null): void {
    this._error.set(error);
  }

  // Utility methods
  resetToDefaults(): void {
    this._settings.set({
      layout: 'dagre',
      nodeSize: 30,
      edgeWidth: 2,
      showLabels: true,
      showProbabilities: false,
      colorScheme: 'default',
      animationSpeed: 500,
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 }
    });
    
    this.clearSelection();
    this.clearHighlights();
    this.clearAllStyles();
    this.fitToView();
  }

  // Private methods
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('visualization-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this._settings.set({
          ...this._settings(),
          ...settings
        });
      }
    } catch (error) {
      console.warn('Failed to load visualization settings:', error);
    }
  }

  private generateCytoscapeStyles(): Array<{ selector: string; style: Record<string, string | number> }> {
    const settings = this._settings();
    const highlight = this._highlight();
    const selection = this._selection();

    return [
      // Default node style
      {
        selector: 'node',
        style: {
          'width': settings.nodeSize,
          'height': settings.nodeSize,
          'background-color': '#6B5B95',
          'border-color': '#4A4A4A',
          'border-width': 2,
          'label': settings.showLabels ? 'data(label)' : '',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          'color': '#2C2C2C'
        }
      },
      // Default edge style
      {
        selector: 'edge',
        style: {
          'width': settings.edgeWidth,
          'line-color': '#D4A5A5',
          'target-arrow-color': '#D4A5A5',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': settings.showProbabilities ? 'data(probability)' : '',
          'font-size': '10px',
          'text-rotation': 'autorotate'
        }
      },
      // Selected nodes
      {
        selector: `node[id = "${selection.selectedNodes.join('"], node[id = "')}"]`,
        style: {
          'border-color': '#FF6B6B',
          'border-width': 4,
          'background-color': '#FFE5E5'
        }
      },
      // Selected edges
      {
        selector: `edge[id = "${selection.selectedEdges.join('"], edge[id = "')}"]`,
        style: {
          'line-color': '#FF6B6B',
          'target-arrow-color': '#FF6B6B',
          'width': settings.edgeWidth + 2
        }
      },
      // Highlighted nodes
      {
        selector: `node[id = "${highlight.highlightedNodes.join('"], node[id = "')}"]`,
        style: {
          'background-color': highlight.highlightColor,
          'opacity': highlight.highlightOpacity
        }
      },
      // Highlighted edges
      {
        selector: `edge[id = "${highlight.highlightedEdges.join('"], edge[id = "')}"]`,
        style: {
          'line-color': highlight.highlightColor,
          'target-arrow-color': highlight.highlightColor,
          'opacity': highlight.highlightOpacity
        }
      }
    ];
  }
}