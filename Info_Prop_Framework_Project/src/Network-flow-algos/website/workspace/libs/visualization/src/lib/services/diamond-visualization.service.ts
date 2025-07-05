import { Injectable, signal, computed, effect, inject } from '@angular/core';
import {
  DiamondStateService,
  DiamondStructure,
  DiamondClassification,
  DiamondType,
  NodeId
} from '@network-analysis/network-core';
import { VisualizationStateService } from './visualization-state.service';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * Diamond visualization configuration
 */
export interface DiamondVisualizationConfig {
  /** Whether diamond highlighting is enabled */
  enabled: boolean;
  /** Show diamond clusters in visualization */
  showClusters: boolean;
  /** Show diamond paths with animation */
  animatePaths: boolean;
  /** Animation duration in milliseconds */
  animationDuration: number;
  /** Diamond highlight opacity */
  highlightOpacity: number;
  /** Whether to show diamond labels */
  showLabels: boolean;
  /** Diamond type filter - only show specific types */
  typeFilter: DiamondType[];
  /** Cluster rendering mode */
  clusterMode: 'subgraph' | 'background' | 'border';
}

/**
 * Diamond visual style configuration
 */
export interface DiamondVisualStyle {
  /** Diamond type */
  type: DiamondType;
  /** Primary color for the diamond */
  color: string;
  /** Secondary color for highlights */
  highlightColor: string;
  /** Border color */
  borderColor: string;
  /** Node shape for diamond nodes */
  nodeShape: string;
  /** Edge style for diamond edges */
  edgeStyle: 'solid' | 'dashed' | 'dotted';
  /** Cluster background color */
  clusterColor: string;
  /** Animation color */
  animationColor: string;
}

/**
 * Diamond cluster definition for GraphViz
 */
export interface DiamondCluster {
  /** Cluster identifier */
  id: string;
  /** Diamond structure reference */
  diamond: DiamondStructure;
  /** Cluster label */
  label: string;
  /** Cluster style properties */
  style: {
    color: string;
    fillcolor: string;
    style: string;
    penwidth: number;
  };
  /** Nodes contained in this cluster */
  nodes: NodeId[];
}

/**
 * GraphViz DOT generation options
 */
export interface DotGenerationOptions {
  /** Include diamond clusters */
  includeClusters: boolean;
  /** Include diamond-specific styling */
  includeStyles: boolean;
  /** Include diamond path annotations */
  includePathAnnotations: boolean;
  /** Graph direction */
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  /** Node separation */
  nodesep: number;
  /** Rank separation */
  ranksep: number;
  /** Include legend */
  includeLegend: boolean;
}

/**
 * Diamond path animation state
 */
export interface DiamondPathAnimation {
  /** Animation identifier */
  id: string;
  /** Diamond being animated */
  diamondId: string;
  /** Path being animated */
  pathIndex: number;
  /** Animation progress (0-1) */
  progress: number;
  /** Animation direction */
  direction: 'forward' | 'reverse';
  /** Animation status */
  status: 'running' | 'paused' | 'completed';
}

// ============================================================================
// DIAMOND VISUALIZATION SERVICE
// ============================================================================

/**
 * Diamond Visualization Integration Service
 * 
 * Provides comprehensive diamond visualization capabilities including:
 * - Diamond highlighting in D3.js visualization
 * - GraphViz DOT generation with diamond clusters
 * - Integration with existing visualization patterns
 * - Support for different diamond types with distinct visual styles
 */
@Injectable({ providedIn: 'root' })
export class DiamondVisualizationService {
  // Inject dependencies
  private readonly diamondStateService = inject(DiamondStateService);
  private readonly visualizationStateService = inject(VisualizationStateService);

  // Private signals for internal state management
  private _config = signal<DiamondVisualizationConfig>({
    enabled: true,
    showClusters: true,
    animatePaths: false,
    animationDuration: 2000,
    highlightOpacity: 0.8,
    showLabels: true,
    typeFilter: [DiamondType.SIMPLE, DiamondType.NESTED, DiamondType.OVERLAPPING, DiamondType.CASCADE, DiamondType.PARALLEL],
    clusterMode: 'subgraph'
  });

  private _selectedDiamonds = signal<string[]>([]);
  private _hoveredDiamond = signal<string | null>(null);
  private _activeAnimations = signal<DiamondPathAnimation[]>([]);
  private _clusters = signal<DiamondCluster[]>([]);
  private _isGeneratingDot = signal(false);
  private _lastGeneratedDot = signal<string | null>(null);
  private _error = signal<string | null>(null);

  // Diamond type visual styles
  private readonly diamondStyles: Record<DiamondType, DiamondVisualStyle> = {
    [DiamondType.SIMPLE]: {
      type: DiamondType.SIMPLE,
      color: '#4CAF50',
      highlightColor: '#66BB6A',
      borderColor: '#388E3C',
      nodeShape: 'ellipse',
      edgeStyle: 'solid',
      clusterColor: '#E8F5E8',
      animationColor: '#81C784'
    },
    [DiamondType.NESTED]: {
      type: DiamondType.NESTED,
      color: '#2196F3',
      highlightColor: '#42A5F5',
      borderColor: '#1976D2',
      nodeShape: 'box',
      edgeStyle: 'solid',
      clusterColor: '#E3F2FD',
      animationColor: '#64B5F6'
    },
    [DiamondType.OVERLAPPING]: {
      type: DiamondType.OVERLAPPING,
      color: '#FF9800',
      highlightColor: '#FFB74D',
      borderColor: '#F57C00',
      nodeShape: 'diamond',
      edgeStyle: 'dashed',
      clusterColor: '#FFF3E0',
      animationColor: '#FFCC02'
    },
    [DiamondType.CASCADE]: {
      type: DiamondType.CASCADE,
      color: '#9C27B0',
      highlightColor: '#BA68C8',
      borderColor: '#7B1FA2',
      nodeShape: 'hexagon',
      edgeStyle: 'solid',
      clusterColor: '#F3E5F5',
      animationColor: '#CE93D8'
    },
    [DiamondType.PARALLEL]: {
      type: DiamondType.PARALLEL,
      color: '#F44336',
      highlightColor: '#EF5350',
      borderColor: '#D32F2F',
      nodeShape: 'octagon',
      edgeStyle: 'dotted',
      clusterColor: '#FFEBEE',
      animationColor: '#E57373'
    }
  };

  // Public readonly signals
  readonly config = this._config.asReadonly();
  readonly selectedDiamonds = this._selectedDiamonds.asReadonly();
  readonly hoveredDiamond = this._hoveredDiamond.asReadonly();
  readonly activeAnimations = this._activeAnimations.asReadonly();
  readonly clusters = this._clusters.asReadonly();
  readonly isGeneratingDot = this._isGeneratingDot.asReadonly();
  readonly lastGeneratedDot = this._lastGeneratedDot.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly isEnabled = computed(() => this._config().enabled);
  
  readonly visibleDiamonds = computed(() => {
    const diamonds = this.diamondStateService.diamonds();
    const classifications = this.diamondStateService.classifications();
    const typeFilter = this._config().typeFilter;
    
    if (typeFilter.length === 0) return diamonds;
    
    const filteredClassifications = classifications.filter(c => typeFilter.includes(c.type));
    const filteredDiamondIds = filteredClassifications.map(c => c.diamondId);
    
    return diamonds.filter(d => filteredDiamondIds.includes(d.id));
  });

  readonly diamondHighlightData = computed(() => {
    const visibleDiamonds = this.visibleDiamonds();
    const classifications = this.diamondStateService.classifications();
    const selectedDiamonds = this._selectedDiamonds();
    const hoveredDiamond = this._hoveredDiamond();
    
    return visibleDiamonds.map(diamond => {
      const classification = classifications.find(c => c.diamondId === diamond.id);
      const style = classification ? this.diamondStyles[classification.type] : this.diamondStyles[DiamondType.SIMPLE];
      const isSelected = selectedDiamonds.includes(diamond.id);
      const isHovered = hoveredDiamond === diamond.id;
      
      return {
        diamond,
        classification,
        style,
        isSelected,
        isHovered,
        highlightNodes: diamond.nodes,
        highlightEdges: this.getEdgesForDiamond(diamond),
        color: isSelected || isHovered ? style.highlightColor : style.color
      };
    });
  });

  readonly animationStatus = computed(() => {
    const animations = this._activeAnimations();
    return {
      hasActiveAnimations: animations.length > 0,
      runningCount: animations.filter(a => a.status === 'running').length,
      totalCount: animations.length
    };
  });

  readonly dotGenerationStatus = computed(() => {
    const isGenerating = this._isGeneratingDot();
    const lastGenerated = this._lastGeneratedDot();
    const error = this._error();
    
    return {
      isGenerating,
      hasResult: lastGenerated !== null,
      hasError: error !== null,
      canGenerate: !isGenerating && this.visibleDiamonds().length > 0
    };
  });

  constructor() {
    console.log('💎🎨 DiamondVisualizationService: Initializing diamond visualization');
    
    // Load saved configuration
    this.loadConfiguration();
    
    // Effect: Save configuration changes
    effect(() => {
      const config = this._config();
      this.saveConfiguration(config);
    });

    // Effect: Update clusters when diamonds change
    effect(() => {
      const visibleDiamonds = this.visibleDiamonds();
      const classifications = this.diamondStateService.classifications();
      
      if (visibleDiamonds.length > 0) {
        this.updateClusters(visibleDiamonds, classifications);
      }
    });

    // Effect: Apply diamond highlighting to visualization
    effect(() => {
      const highlightData = this.diamondHighlightData();
      const config = this._config();
      
      if (config.enabled && highlightData.length > 0) {
        this.applyDiamondHighlighting(highlightData);
      }
    });

    // Effect: Handle animation updates
    effect(() => {
      const animations = this._activeAnimations();
      animations.forEach(animation => {
        if (animation.status === 'running') {
          this.updateAnimation(animation);
        }
      });
    });
  }

  // ============================================================================
  // CONFIGURATION METHODS
  // ============================================================================

  updateConfig(partial: Partial<DiamondVisualizationConfig>): void {
    this._config.update(current => ({
      ...current,
      ...partial
    }));
    console.log('💎🎨 Diamond visualization configuration updated:', partial);
  }

  toggleEnabled(): void {
    this._config.update(config => ({
      ...config,
      enabled: !config.enabled
    }));
  }

  setTypeFilter(types: DiamondType[]): void {
    this._config.update(config => ({
      ...config,
      typeFilter: [...types]
    }));
  }

  setClusterMode(mode: 'subgraph' | 'background' | 'border'): void {
    this._config.update(config => ({
      ...config,
      clusterMode: mode
    }));
  }

  // ============================================================================
  // DIAMOND SELECTION AND INTERACTION
  // ============================================================================

  selectDiamond(diamondId: string, addToSelection = false): void {
    this._selectedDiamonds.update(selected => {
      if (addToSelection) {
        return selected.includes(diamondId) 
          ? selected.filter(id => id !== diamondId)
          : [...selected, diamondId];
      } else {
        return [diamondId];
      }
    });
    
    // Update visualization selection
    const diamond = this.diamondStateService.getDiamondById(diamondId);
    if (diamond) {
      this.visualizationStateService.selectMultiple(
        diamond.nodes.map(n => typeof n === 'string' ? parseInt(n) : n),
        this.getEdgesForDiamond(diamond)
      );
    }
  }

  deselectDiamond(diamondId: string): void {
    this._selectedDiamonds.update(selected => 
      selected.filter(id => id !== diamondId)
    );
  }

  clearDiamondSelection(): void {
    this._selectedDiamonds.set([]);
    this.visualizationStateService.clearSelection();
  }

  setHoveredDiamond(diamondId: string | null): void {
    this._hoveredDiamond.set(diamondId);
    
    if (diamondId) {
      const diamond = this.diamondStateService.getDiamondById(diamondId);
      if (diamond) {
        // Highlight diamond nodes and edges on hover
        this.visualizationStateService.highlightNodes(
          diamond.nodes.map(n => typeof n === 'string' ? parseInt(n) : n),
          this.getDiamondStyle(diamondId).highlightColor
        );
        this.visualizationStateService.highlightEdges(
          this.getEdgesForDiamond(diamond),
          this.getDiamondStyle(diamondId).highlightColor
        );
      }
    } else {
      this.visualizationStateService.clearHighlights();
    }
  }

  // ============================================================================
  // DIAMOND HIGHLIGHTING METHODS
  // ============================================================================

  highlightDiamond(diamondId: string, temporary = false): void {
    const diamond = this.diamondStateService.getDiamondById(diamondId);
    if (!diamond) return;

    const style = this.getDiamondStyle(diamondId);
    const nodeIds = diamond.nodes.map(n => typeof n === 'string' ? parseInt(n) : n);
    const edgeIds = this.getEdgesForDiamond(diamond);

    // Apply node styles
    nodeIds.forEach(nodeId => {
      this.visualizationStateService.setNodeStyle(nodeId, {
        color: style.color,
        borderColor: style.borderColor,
        borderWidth: 3,
        opacity: this._config().highlightOpacity
      });
    });

    // Apply edge styles
    edgeIds.forEach(edgeId => {
      this.visualizationStateService.setEdgeStyle(edgeId, {
        color: style.color,
        width: 3,
        style: style.edgeStyle,
        opacity: this._config().highlightOpacity
      });
    });

    if (!temporary) {
      this.selectDiamond(diamondId, true);
    }
  }

  clearDiamondHighlighting(): void {
    const selectedDiamonds = this._selectedDiamonds();
    
    selectedDiamonds.forEach(diamondId => {
      const diamond = this.diamondStateService.getDiamondById(diamondId);
      if (diamond) {
        // Clear node styles
        diamond.nodes.forEach(nodeId => {
          const numericId = typeof nodeId === 'string' ? parseInt(nodeId) : nodeId;
          this.visualizationStateService.clearNodeStyle(numericId);
        });

        // Clear edge styles
        this.getEdgesForDiamond(diamond).forEach(edgeId => {
          this.visualizationStateService.clearEdgeStyle(edgeId);
        });
      }
    });

    this.visualizationStateService.clearHighlights();
  }

  // ============================================================================
  // DIAMOND PATH ANIMATION
  // ============================================================================

  animateDiamondPath(diamondId: string, pathIndex = 0): void {
    const diamond = this.diamondStateService.getDiamondById(diamondId);
    if (!diamond || pathIndex >= diamond.paths.length) return;

    const animationId = `${diamondId}_path_${pathIndex}`;
    const animation: DiamondPathAnimation = {
      id: animationId,
      diamondId,
      pathIndex,
      progress: 0,
      direction: 'forward',
      status: 'running'
    };

    this._activeAnimations.update(animations => [
      ...animations.filter(a => a.id !== animationId),
      animation
    ]);

    this.runPathAnimation(animation);
  }

  stopAnimation(animationId: string): void {
    this._activeAnimations.update(animations =>
      animations.map(a => 
        a.id === animationId 
          ? { ...a, status: 'paused' as const }
          : a
      )
    );
  }

  clearAllAnimations(): void {
    this._activeAnimations.set([]);
  }

  // ============================================================================
  // GRAPHVIZ DOT GENERATION
  // ============================================================================

  async generateDiamondDot(options: Partial<DotGenerationOptions> = {}): Promise<string> {
    const fullOptions: DotGenerationOptions = {
      includeClusters: true,
      includeStyles: true,
      includePathAnnotations: false,
      rankdir: 'TB',
      nodesep: 1.0,
      ranksep: 1.5,
      includeLegend: true,
      ...options
    };

    this._isGeneratingDot.set(true);
    this._error.set(null);

    try {
      const diamonds = this.visibleDiamonds();
      const classifications = this.diamondStateService.classifications();
      
      if (diamonds.length === 0) {
        throw new Error('No diamonds available for DOT generation');
      }

      const dot = this.buildDotString(diamonds, classifications, fullOptions);
      
      this._lastGeneratedDot.set(dot);
      console.log('💎🎨 GraphViz DOT generated successfully');
      
      return dot;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during DOT generation';
      this._error.set(errorMessage);
      throw error;
    } finally {
      this._isGeneratingDot.set(false);
    }
  }

  exportDiamondDot(filename = 'diamond-network.dot'): void {
    const dot = this._lastGeneratedDot();
    if (!dot) {
      console.warn('💎🎨 No DOT content available for export');
      return;
    }

    const blob = new Blob([dot], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`💎🎨 Diamond DOT exported as ${filename}`);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private applyDiamondHighlighting(highlightData: Array<{
    diamond: DiamondStructure;
    isSelected: boolean;
    isHovered: boolean;
    color: string;
    highlightNodes: NodeId[];
    highlightEdges: string[];
    style: {
      borderColor: string;
      edgeStyle: "solid" | "dashed" | "dotted";
    };
  }>): void {
    highlightData.forEach(data => {
      if (data.isSelected || data.isHovered) {
        // Apply highlighting styles
        data.highlightNodes.forEach((nodeId: NodeId) => {
          const numericId = typeof nodeId === 'string' ? parseInt(nodeId) : nodeId;
          this.visualizationStateService.setNodeStyle(numericId, {
            color: data.color,
            borderColor: data.style.borderColor,
            borderWidth: data.isSelected ? 4 : 2,
            opacity: this._config().highlightOpacity
          });
        });

        data.highlightEdges.forEach((edgeId: string) => {
          this.visualizationStateService.setEdgeStyle(edgeId, {
            color: data.color,
            width: data.isSelected ? 4 : 2,
            style: data.style.edgeStyle,
            opacity: this._config().highlightOpacity
          });
        });
      }
    });
  }

  private updateClusters(diamonds: DiamondStructure[], classifications: DiamondClassification[]): void {
    const clusters: DiamondCluster[] = diamonds.map(diamond => {
      const classification = classifications.find(c => c.diamondId === diamond.id);
      const style = classification ? this.diamondStyles[classification.type] : this.diamondStyles[DiamondType.SIMPLE];
      
      return {
        id: `cluster_${diamond.id}`,
        diamond,
        label: `Diamond ${diamond.id}${classification ? ` (${classification.type})` : ''}`,
        style: {
          color: style.borderColor,
          fillcolor: style.clusterColor,
          style: 'filled,rounded',
          penwidth: 2
        },
        nodes: diamond.nodes
      };
    });

    this._clusters.set(clusters);
  }

  private getDiamondStyle(diamondId: string): DiamondVisualStyle {
    const classification = this.diamondStateService.getClassificationById(diamondId);
    return classification 
      ? this.diamondStyles[classification.type] 
      : this.diamondStyles[DiamondType.SIMPLE];
  }

  private getEdgesForDiamond(diamond: DiamondStructure): string[] {
    // Generate edge IDs based on diamond paths
    const edges: string[] = [];
    
    diamond.paths.forEach(path => {
      for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i + 1];
        edges.push(`${source}-${target}`);
      }
    });

    return [...new Set(edges)]; // Remove duplicates
  }

  private async runPathAnimation(animation: DiamondPathAnimation): Promise<void> {
    const diamond = this.diamondStateService.getDiamondById(animation.diamondId);
    if (!diamond || animation.pathIndex >= diamond.paths.length) return;

    const path = diamond.paths[animation.pathIndex];
    const style = this.getDiamondStyle(animation.diamondId);
    const duration = this._config().animationDuration;
    const steps = path.length - 1;
    const stepDuration = duration / steps;

    for (let i = 0; i < steps && animation.status === 'running'; i++) {
      const sourceId = typeof path[i] === 'string' ? parseInt(path[i] as string) : path[i] as number;
      // const targetId = typeof path[i + 1] === 'string' ? parseInt(path[i + 1] as string) : path[i + 1] as number;
      const edgeId = `${path[i]}-${path[i + 1]}`;

      // Highlight current step
      this.visualizationStateService.setNodeStyle(sourceId, {
        color: style.animationColor,
        borderColor: style.borderColor,
        borderWidth: 4
      });

      this.visualizationStateService.setEdgeStyle(edgeId, {
        color: style.animationColor,
        width: 4
      });

      // Update progress
      const progress = (i + 1) / steps;
      this._activeAnimations.update(animations =>
        animations.map(a => 
          a.id === animation.id 
            ? { ...a, progress }
            : a
        )
      );

      await this.delay(stepDuration);
    }

    // Mark animation as completed
    this._activeAnimations.update(animations =>
      animations.map(a => 
        a.id === animation.id 
          ? { ...a, status: 'completed' as const, progress: 1 }
          : a
      )
    );

    // Clean up completed animations after a delay
    setTimeout(() => {
      this._activeAnimations.update(animations =>
        animations.filter(a => a.id !== animation.id)
      );
    }, 1000);
  }

  private updateAnimation(_animation: DiamondPathAnimation): void {
    // Animation update logic is handled in runPathAnimation
    // This method can be used for real-time animation updates if needed
  }

  private buildDotString(
    diamonds: DiamondStructure[], 
    classifications: DiamondClassification[], 
    options: DotGenerationOptions
  ): string {
    let dot = `digraph DiamondNetwork {\n`;
    dot += `  rankdir=${options.rankdir};\n`;
    dot += `  nodesep=${options.nodesep};\n`;
    dot += `  ranksep=${options.ranksep};\n`;
    dot += `  compound=true;\n`;
    dot += `  concentrate=true;\n\n`;

    // Graph styling
    dot += `  graph [bgcolor=white, fontname="Arial", fontsize=12];\n`;
    dot += `  node [fontname="Arial", fontsize=10, style=filled];\n`;
    dot += `  edge [fontname="Arial", fontsize=8];\n\n`;

    // Generate clusters if enabled
    if (options.includeClusters) {
      const clusters = this._clusters();
      clusters.forEach((cluster, index) => {
        dot += `  subgraph cluster_${index} {\n`;
        dot += `    label="${cluster.label}";\n`;
        dot += `    color="${cluster.style.color}";\n`;
        dot += `    fillcolor="${cluster.style.fillcolor}";\n`;
        dot += `    style="${cluster.style.style}";\n`;
        dot += `    penwidth=${cluster.style.penwidth};\n\n`;

        // Add nodes to cluster
        cluster.nodes.forEach(nodeId => {
          const classification = classifications.find(c => c.diamondId === cluster.diamond.id);
          const style = classification ? this.diamondStyles[classification.type] : this.diamondStyles[DiamondType.SIMPLE];
          
          if (options.includeStyles) {
            dot += `    ${nodeId} [shape=${style.nodeShape}, fillcolor="${style.color}", color="${style.borderColor}"];\n`;
          } else {
            dot += `    ${nodeId};\n`;
          }
        });

        dot += `  }\n\n`;
      });
    }

    // Generate edges
    diamonds.forEach(diamond => {
      const classification = classifications.find(c => c.diamondId === diamond.id);
      const style = classification ? this.diamondStyles[classification.type] : this.diamondStyles[DiamondType.SIMPLE];

      diamond.paths.forEach((path, pathIndex) => {
        for (let i = 0; i < path.length - 1; i++) {
          const source = path[i];
          const target = path[i + 1];
          
          if (options.includeStyles) {
            dot += `  ${source} -> ${target} [color="${style.color}", style=${style.edgeStyle}`;
            
            if (options.includePathAnnotations) {
              dot += `, label="P${pathIndex + 1}"`;
            }
            
            dot += `];\n`;
          } else {
            dot += `  ${source} -> ${target};\n`;
          }
        }
      });
    });

    // Add legend if enabled
    if (options.includeLegend) {
      dot += `\n  // Legend\n`;
      dot += `  subgraph cluster_legend {\n`;
      dot += `    label="Diamond Types";\n`;
      dot += `    color=black;\n`;
      dot += `    style=filled;\n`;
      dot += `    fillcolor=lightgray;\n\n`;

      Object.values(DiamondType).forEach((type) => {
        const style = this.diamondStyles[type];
        dot += `    legend_${type} [label="${type}", shape=${style.nodeShape}, fillcolor="${style.color}", color="${style.borderColor}"];\n`;
      });

      dot += `  }\n`;
    }

    dot += `}\n`;
    return dot;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private saveConfiguration(config: DiamondVisualizationConfig): void {
    try {
      localStorage.setItem('diamond-visualization-config', JSON.stringify(config));
    } catch (error) {
      console.warn('💎🎨 Failed to save diamond visualization configuration:', error);
    }
  }

  private loadConfiguration(): void {
    try {
      const saved = localStorage.getItem('diamond-visualization-config');
      if (saved) {
        const config = JSON.parse(saved);
        this._config.update(current => ({ ...current, ...config }));
        console.log('💎🎨 Diamond visualization configuration loaded from localStorage');
      }
    } catch (error) {
      console.warn('💎🎨 Failed to load diamond visualization configuration:', error);
    }
  }
}