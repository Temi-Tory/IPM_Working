import { Component, inject, computed, signal, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import * as d3 from 'd3';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { ExactInferenceResult, BeliefValue, IntervalData, PboxData, ReachabilityScenario } from '../../shared/models/network-analysis.models';

interface BeliefDisplayData {
  nodeId: number;
  beliefValue: BeliefValue;
  uncertaintyType: 'Float64' | 'Interval' | 'pbox';
  displayValue: string;
  numericValue?: number;
  intervalBounds?: { lower: number; upper: number };
  pboxBounds?: {
    left_min: number;
    left_max: number;
    right_min: number;
    right_max: number;
  };
}

interface BeliefStatistics {
  mean: number;
  min: number;
  max: number;
  numeric_count: number;
  total_count: number;
}

interface BeliefNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  beliefValue: number;
  uncertaintyType: 'Float64' | 'Interval' | 'pbox';
  originalBeliefData: BeliefValue;
  radius: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
}

interface BeliefLink extends d3.SimulationLinkDatum<BeliefNode> {
  source: string | BeliefNode;
  target: string | BeliefNode;
  id: string;
  flowStrength: number;
  strokeWidth: number;
  color: string;
  animated: boolean;
}

interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
}

@Component({
  selector: 'app-exact-inference',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSliderModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './exact-inference.component.html',
  styleUrls: ['./exact-inference.component.scss']
})
export class ExactInferenceComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('beliefVisualization', { static: false }) visualizationContainer!: ElementRef<HTMLDivElement>;
  private analysisState = inject(AnalysisStateService);

  // Core data signals
  analysisResults = computed(() => this.analysisState.analysisResults());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());
  networkData = computed(() => this.analysisState.networkData());

  // Visual state
  selectedNodeId = signal<string | null>(null);
  selectedUncertaintyFilter = signal<string[]>(['Float64', 'Interval', 'pbox']);
  beliefThresholdRange = signal<{ min: number; max: number }>({ min: 0, max: 1 });
  
  // Animation state
  animationState = signal<AnimationState>({
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 100,
    speed: 1
  });

  // D3 visualization properties
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<BeliefNode, BeliefLink> | null = null;
  private nodes: BeliefNode[] = [];
  private links: BeliefLink[] = [];
  private width = 0;
  private height = 0;

  // Color scales
  private beliefColorScale: d3.ScaleSequential<string> | null = null;
  private uncertaintyColorMap = new Map([
    ['Float64', '#1976d2'],  // Blue
    ['Interval', '#388e3c'], // Green
    ['pbox', '#f57c00']      // Orange
  ]);

  // Animation timer
  private animationTimer: d3.Timer | null = null;

  // Computed properties for reachability scenarios
  reachabilityScenarios = computed(() => {
    const results = this.analysisResults();
    if (!results?.results?.reachability_scenarios) return [];

    return Object.entries(results.results.reachability_scenarios).map(([name, scenario]) => ({
      name,
      scenario: scenario as ReachabilityScenario,
      hasExactInference: !!scenario.exact_inference,
      hasDiamondAnalysis: !!scenario.diamond_analysis
    }));
  });

  // Get exact inference results for all scenarios
  exactInferenceResults = computed(() => {
    const scenarios = this.reachabilityScenarios();
    const results: Array<{ scenarioName: string; result: ExactInferenceResult }> = [];

    scenarios.forEach(({ name, scenario }) => {
      if (scenario.exact_inference) {
        results.push({
          scenarioName: name,
          result: scenario.exact_inference
        });
      }
    });

    return results;
  });

  // Combined belief data from all scenarios
  combinedBeliefData = computed(() => {
    const inferenceResults = this.exactInferenceResults();
    const allBeliefs: BeliefDisplayData[] = [];

    inferenceResults.forEach(({ scenarioName, result }) => {
      Object.entries(result.beliefs).forEach(([nodeIdStr, beliefValue]) => {
        const nodeId = parseInt(nodeIdStr, 10);
        const displayData = this.processBeliefValue(nodeId, beliefValue, scenarioName);
        allBeliefs.push(displayData);
      });
    });

    return allBeliefs.sort((a, b) => a.nodeId - b.nodeId);
  });

  // Belief statistics across all scenarios
  overallBeliefStatistics = computed(() => {
    const inferenceResults = this.exactInferenceResults();
    
    if (inferenceResults.length === 0) return null;

    let totalMean = 0;
    let totalMin = Number.MAX_VALUE;
    let totalMax = Number.MIN_VALUE;
    let numericCount = 0;
    let totalCount = 0;

    inferenceResults.forEach(({ result }) => {
      if (result.belief_statistics) {
        totalMean += result.belief_statistics.mean;
        totalMin = Math.min(totalMin, result.belief_statistics.min);
        totalMax = Math.max(totalMax, result.belief_statistics.max);
        totalCount += Object.keys(result.beliefs).length;
        
        // Count numeric beliefs
        Object.values(result.beliefs).forEach(belief => {
          if (typeof belief === 'number') {
            numericCount++;
          }
        });
      }
    });

    return {
      mean: totalMean / inferenceResults.length,
      min: totalMin === Number.MAX_VALUE ? 0 : totalMin,
      max: totalMax === Number.MIN_VALUE ? 0 : totalMax,
      numeric_count: numericCount,
      total_count: totalCount
    };
  });

  // Filter controls
  searchTerm = signal<string>('');
  beliefValueRange = signal<{min?: number; max?: number}>({});
  pageSize = signal<number>(50);
  pageIndex = signal<number>(0);

  // Filtered and paginated data
  filteredBeliefData = computed(() => {
    const beliefs = this.combinedBeliefData();
    const searchTerm = this.searchTerm().toLowerCase();
    const selectedTypes = this.selectedUncertaintyFilter();
    const valueRange = this.beliefValueRange();

    return beliefs.filter(belief => {
      const matchesSearch = !searchTerm || belief.nodeId.toString().includes(searchTerm);
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(belief.uncertaintyType);
      
      let matchesRange = true;
      if (belief.numericValue !== undefined) {
        if (valueRange.min !== undefined && belief.numericValue < valueRange.min) matchesRange = false;
        if (valueRange.max !== undefined && belief.numericValue > valueRange.max) matchesRange = false;
      }
      
      return matchesSearch && matchesType && matchesRange;
    });
  });

  paginatedBeliefData = computed(() => {
    const filtered = this.filteredBeliefData();
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Summary metrics
  scenarioSummary = computed(() => {
    const scenarios = this.reachabilityScenarios();
    return {
      totalScenarios: scenarios.length,
      scenariosWithInference: scenarios.filter(s => s.hasExactInference).length,
      scenariosWithDiamond: scenarios.filter(s => s.hasDiamondAnalysis).length
    };
  });

  // Uncertainty type distribution
  uncertaintyDistribution = computed(() => {
    const beliefs = this.combinedBeliefData();
    const distribution = beliefs.reduce((acc, belief) => {
      acc[belief.uncertaintyType] = (acc[belief.uncertaintyType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution).map(([type, count]) => ({
      type,
      count,
      percentage: beliefs.length > 0 ? (count / beliefs.length) * 100 : 0
    }));
  });

  private processBeliefValue(nodeId: number, beliefValue: BeliefValue, scenarioName: string): BeliefDisplayData {
    if (typeof beliefValue === 'number') {
      return {
        nodeId,
        beliefValue,
        uncertaintyType: 'Float64',
        displayValue: beliefValue.toFixed(6),
        numericValue: beliefValue
      };
    }
    
    if (this.isIntervalData(beliefValue)) {
      return {
        nodeId,
        beliefValue,
        uncertaintyType: 'Interval',
        displayValue: `[${beliefValue.lower.toFixed(4)}, ${beliefValue.upper.toFixed(4)}]`,
        numericValue: (beliefValue.lower + beliefValue.upper) / 2,
        intervalBounds: {
          lower: beliefValue.lower,
          upper: beliefValue.upper
        }
      };
    }
    
    if (this.isPboxData(beliefValue)) {
      return {
        nodeId,
        beliefValue,
        uncertaintyType: 'pbox',
        displayValue: `P-Box (${beliefValue.shape})`,
        numericValue: (beliefValue.mean_lower + beliefValue.mean_upper) / 2,
        pboxBounds: beliefValue.bounds_summary
      };
    }
    
    // Fallback
    return {
      nodeId,
      beliefValue,
      uncertaintyType: 'Float64',
      displayValue: 'Unknown',
      numericValue: 0
    };
  }

  private isIntervalData(value: any): value is IntervalData {
    return value && typeof value === 'object' && value.type === 'interval' && 
           'lower' in value && 'upper' in value;
  }

  private isPboxData(value: any): value is PboxData {
    return value && typeof value === 'object' && value.type === 'pbox' && 
           'bounds_summary' in value && 'shape' in value;
  }

  constructor() {
    // React to data changes and update visualization
    effect(() => {
      const inferenceResults = this.exactInferenceResults();
      const networkData = this.networkData();
      if (inferenceResults.length > 0 && networkData && this.visualizationContainer) {
        this.initializeVisualization();
      }
    });
  }

  ngOnInit(): void {
    // Component initialization
    this.setupBeliefColorScale();
  }

  ngAfterViewInit(): void {
    // Initialize visualization after view is ready
    const inferenceResults = this.exactInferenceResults();
    const networkData = this.networkData();
    if (inferenceResults.length > 0 && networkData) {
      this.initializeVisualization();
    }
  }

  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
    if (this.animationTimer) {
      this.animationTimer.stop();
    }
  }

  // Event handlers
  onUncertaintyFilter(types: string[]): void {
    this.selectedUncertaintyFilter.set(types);
    this.updateVisualizationFilters();
  }

  onBeliefThresholdChange(range: { min: number; max: number }): void {
    this.beliefThresholdRange.set(range);
    this.updateVisualizationFilters();
  }

  onAnimationSpeedChange(speed: number): void {
    this.animationState.update(state => ({ ...state, speed }));
  }

  toggleAnimation(): void {
    const currentState = this.animationState();
    if (currentState.isPlaying) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  resetAnimation(): void {
    this.stopAnimation();
    this.animationState.update(state => ({ ...state, currentFrame: 0 }));
    this.updateAnimationFrame(0);
  }

  // Visualization initialization
  private initializeVisualization(): void {
    if (!this.visualizationContainer?.nativeElement) return;
    
    this.setupDimensions();
    this.prepareBeliefData();
    this.createSVG();
    this.setupForceSimulation();
    this.renderVisualization();
  }

  private setupDimensions(): void {
    const container = this.visualizationContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    this.width = rect.width || 1000;
    this.height = Math.max(700, rect.height || 700);
  }

  private prepareBeliefData(): void {
    const networkData = this.networkData();
    const beliefData = this.combinedBeliefData();
    
    if (!networkData) return;

    // Create map of beliefs by node ID for fast lookup
    const beliefMap = new Map<string, BeliefDisplayData>();
    beliefData.forEach(belief => {
      beliefMap.set(belief.nodeId.toString(), belief);
    });

    // Extract unique nodes from edges
    const nodeSet = new Set<string>();
    networkData.edges.forEach((edge: [number, number]) => {
      nodeSet.add(edge[0].toString());
      nodeSet.add(edge[1].toString());
    });

    // Create belief nodes
    this.nodes = Array.from(nodeSet).map(nodeId => {
      const belief = beliefMap.get(nodeId);
      const beliefValue = belief?.numericValue ?? 0;
      const uncertaintyType = belief?.uncertaintyType ?? 'Float64';
      
      return {
        id: nodeId,
        name: nodeId,
        beliefValue,
        uncertaintyType,
        originalBeliefData: belief?.beliefValue ?? 0,
        radius: this.calculateNodeRadius(beliefValue),
        color: this.getBeliefColor(beliefValue),
        strokeColor: this.getUncertaintyStrokeColor(uncertaintyType),
        strokeWidth: this.getUncertaintyStrokeWidth(uncertaintyType)
      } as BeliefNode;
    });

    // Create belief links with flow strength
    this.links = networkData.edges.map((edge: [number, number]) => {
      const [source, target] = edge;
      const sourceBelief = beliefMap.get(source.toString())?.numericValue ?? 0;
      const targetBelief = beliefMap.get(target.toString())?.numericValue ?? 0;
      const flowStrength = Math.abs(targetBelief - sourceBelief);
      
      return {
        source: source.toString(),
        target: target.toString(),
        id: `${source}-${target}`,
        flowStrength,
        strokeWidth: Math.max(1, flowStrength * 10),
        color: this.getFlowColor(flowStrength),
        animated: flowStrength > 0.1
      } as BeliefLink;
    });
  }

  private setupBeliefColorScale(): void {
    this.beliefColorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, 1]);
  }

  private calculateNodeRadius(beliefValue: number): number {
    const baseRadius = 12;
    const beliefBonus = beliefValue * 15;
    return baseRadius + beliefBonus;
  }

  private getBeliefColor(beliefValue: number): string {
    if (!this.beliefColorScale) return '#1976d2';
    return this.beliefColorScale(beliefValue);
  }

  private getUncertaintyStrokeColor(uncertaintyType: string): string {
    return this.uncertaintyColorMap.get(uncertaintyType) ?? '#333';
  }

  private getUncertaintyStrokeWidth(uncertaintyType: string): number {
    const widthMap = new Map([
      ['Float64', 2],
      ['Interval', 3],
      ['pbox', 4]
    ]);
    return widthMap.get(uncertaintyType) ?? 2;
  }

  private getUncertaintyPattern(uncertaintyType: string): string {
    // Create different stroke patterns for uncertainty types
    switch (uncertaintyType) {
      case 'Float64':
        return 'none'; // Solid line
      case 'Interval':
        return '5,5'; // Dashed line
      case 'pbox':
        return '2,3,2,3'; // Dotted line
      default:
        return 'none';
    }
  }

  private getFlowColor(flowStrength: number): string {
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, 1]);
    return colorScale(flowStrength);
  }

  private createSVG(): void {
    // Clear existing SVG
    d3.select(this.visualizationContainer.nativeElement).select('svg').remove();

    // Create new SVG
    this.svg = d3.select(this.visualizationContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.svg) {
          this.svg.select('.main-group').attr('transform', event.transform);
        }
      });

    this.svg.call(zoom);

    // Create main group for zoomable content
    this.svg.append('g').attr('class', 'main-group');
  }

  private setupForceSimulation(): void {
    this.simulation = d3.forceSimulation<BeliefNode>(this.nodes)
      .force('link', d3.forceLink<BeliefNode, BeliefLink>(this.links)
        .id(d => d.id)
        .distance(100)
        .strength(0.6))
      .force('charge', d3.forceManyBody()
        .strength(-400)
        .distanceMax(300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide<BeliefNode>()
        .radius(d => d.radius + 10)
        .strength(0.8))
      .force('x', d3.forceX(this.width / 2).strength(0.05))
      .force('y', d3.forceY(this.height / 2).strength(0.05));
  }

  private renderVisualization(): void {
    if (!this.svg) return;

    const g = this.svg.select('.main-group');

    // Add gradient definitions for flow animations
    const defs = this.svg.append('defs');
    defs.append('linearGradient')
      .attr('id', 'flowGradient')
      .attr('gradientUnits', 'objectBoundingBox')
      .selectAll('stop')
      .data([
        { offset: '0%', color: 'rgba(255,255,255,0)' },
        { offset: '50%', color: 'rgba(255,255,255,0.8)' },
        { offset: '100%', color: 'rgba(255,255,255,0)' }
      ])
      .enter().append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    // Render links
    const link = g.selectAll('.belief-link')
      .data(this.links)
      .enter()
      .append('line')
      .attr('class', 'belief-link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrowhead marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Render nodes
    const node = g.selectAll('.belief-node')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'belief-node')
      .style('cursor', 'pointer')
      .call(this.createDragBehavior());

    // Add node circles with belief coloring and uncertainty patterns
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.strokeColor)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-dasharray', d => this.getUncertaintyPattern(d.uncertaintyType))
      .attr('opacity', 0.9);

    // Add inner uncertainty indicator for pbox and interval
    node.filter(d => d.uncertaintyType !== 'Float64')
      .append('circle')
      .attr('r', d => d.radius * 0.6)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-dasharray', d => d.uncertaintyType === 'pbox' ? '1,1' : '3,1');

    // Add belief value text
    node.append('text')
      .text(d => d.beliefValue.toFixed(3))
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none');

    // Add node ID labels
    node.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '20px')
      .attr('font-size', '8px')
      .attr('fill', '#333')
      .attr('pointer-events', 'none');

    // Add click and hover handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.selectNode(d.id);
    })
    .on('mouseenter', (event, d) => {
      this.showNodeTooltip(d, event);
    })
    .on('mouseleave', () => {
      this.hideNodeTooltip();
    });

    // Update positions on simulation tick
    this.simulation?.on('tick', () => {
      link
        .attr('x1', d => (d.source as BeliefNode).x!)
        .attr('y1', d => (d.source as BeliefNode).y!)
        .attr('x2', d => (d.target as BeliefNode).x!)
        .attr('y2', d => (d.target as BeliefNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  private createDragBehavior() {
    return d3.drag<SVGGElement, BeliefNode>()
      .on('start', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0);
        }
      });
  }

  private selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    
    // Visual feedback for selected node with enhanced highlighting
    if (this.svg) {
      // Reset all nodes
      this.svg.selectAll('.belief-node')
        .selectAll('circle')
        .style('stroke', function(d: any) {
          return d3.select(this).attr('stroke');
        })
        .style('stroke-width', function(d: any) {
          return d3.select(this).attr('stroke-width');
        })
        .style('filter', 'none');
      
      // Highlight selected node
      const selectedNode = this.svg.selectAll('.belief-node')
        .filter((d: any) => d.id === nodeId);
        
      selectedNode.selectAll('circle')
        .style('stroke', '#ffd700')
        .style('stroke-width', '6')
        .style('filter', 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))');
        
      // Highlight connected links
      this.svg.selectAll('.belief-link')
        .style('stroke-opacity', (d: any) => {
          const isConnected = (d.source as BeliefNode).id === nodeId || 
                             (d.target as BeliefNode).id === nodeId;
          return isConnected ? 1 : 0.2;
        })
        .style('stroke-width', (d: any) => {
          const isConnected = (d.source as BeliefNode).id === nodeId || 
                             (d.target as BeliefNode).id === nodeId;
          return isConnected ? d.strokeWidth * 1.5 : d.strokeWidth;
        });
        
      // Dim non-connected nodes
      this.svg.selectAll('.belief-node')
        .filter((d: any) => d.id !== nodeId)
        .style('opacity', 0.3);
        
      // Maintain full opacity for selected node
      selectedNode.style('opacity', 1);
    }
  }

  private showNodeTooltip(node: BeliefNode, event: MouseEvent): void {
    // Remove existing tooltip
    d3.selectAll('.belief-tooltip').remove();
    
    // Create enhanced tooltip with detailed belief information
    const tooltip = d3.select('body').append('div')
      .attr('class', 'belief-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '8px')
      .style('font-size', '13px')
      .style('line-height', '1.4')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
      .style('border', `2px solid ${node.strokeColor}`)
      .style('z-index', '1000')
      .style('pointer-events', 'none')
      .style('left', event.pageX + 15 + 'px')
      .style('top', event.pageY - 10 + 'px');

    // Get detailed belief information
    const beliefData = this.combinedBeliefData().find(b => b.nodeId.toString() === node.id);
    
    let tooltipContent = `
      <div style="font-weight: bold; margin-bottom: 8px; color: ${node.strokeColor}">Node ${node.id}</div>
      <div><strong>Belief:</strong> ${(node.beliefValue * 100).toFixed(2)}%</div>
      <div><strong>Type:</strong> ${node.uncertaintyType}</div>
    `;
    
    if (beliefData) {
      if (beliefData.intervalBounds) {
        tooltipContent += `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
            <strong>Interval Bounds:</strong><br/>
            [${beliefData.intervalBounds.lower.toFixed(4)}, ${beliefData.intervalBounds.upper.toFixed(4)}]
          </div>
        `;
      }
      
      if (beliefData.pboxBounds) {
        tooltipContent += `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
            <strong>P-Box Bounds:</strong><br/>
            Left: [${beliefData.pboxBounds.left_min.toFixed(3)}, ${beliefData.pboxBounds.left_max.toFixed(3)}]<br/>
            Right: [${beliefData.pboxBounds.right_min.toFixed(3)}, ${beliefData.pboxBounds.right_max.toFixed(3)}]
          </div>
        `;
      }
    }
    
    tooltipContent += `
      <div style="margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.7);">
        Click to select node
      </div>
    `;

    tooltip.html(tooltipContent);
    
    // Adjust position if tooltip goes off-screen
    const tooltipRect = (tooltip.node() as HTMLElement).getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (tooltipRect.right > windowWidth) {
      tooltip.style('left', (event.pageX - tooltipRect.width - 15) + 'px');
    }
    
    if (tooltipRect.bottom > windowHeight) {
      tooltip.style('top', (event.pageY - tooltipRect.height - 10) + 'px');
    }
  }

  private hideNodeTooltip(): void {
    d3.selectAll('.belief-tooltip').remove();
  }

  private updateVisualizationFilters(): void {
    if (!this.svg) return;

    const selectedTypes = this.selectedUncertaintyFilter();
    const thresholdRange = this.beliefThresholdRange();

    this.svg.selectAll('.belief-node')
      .style('opacity', (d: any) => {
        const typeMatch = selectedTypes.includes(d.uncertaintyType);
        const valueMatch = d.beliefValue >= thresholdRange.min && d.beliefValue <= thresholdRange.max;
        return typeMatch && valueMatch ? 1 : 0.2;
      });
  }

  private startAnimation(): void {
    this.animationState.update(state => ({ ...state, isPlaying: true }));
    
    this.animationTimer = d3.timer((elapsed) => {
      const state = this.animationState();
      const frame = Math.floor(elapsed / (1000 / (state.speed * 10))) % state.totalFrames;
      
      this.animationState.update(s => ({ ...s, currentFrame: frame }));
      this.updateAnimationFrame(frame);
    });
  }

  private stopAnimation(): void {
    if (this.animationTimer) {
      this.animationTimer.stop();
      this.animationTimer = null;
    }
    this.animationState.update(state => ({ ...state, isPlaying: false }));
  }

  private updateAnimationFrame(frame: number): void {
    if (!this.svg) return;
    
    const totalFrames = this.animationState().totalFrames;

    // Animate belief propagation with wave-like flow effects
    this.svg.selectAll('.belief-link')
      .style('stroke-opacity', (d: any) => {
        if (!d.animated) return 0.6;
        
        // Create wave propagation effect
        const wavePhase = (frame / totalFrames) * 4 * Math.PI;
        const linkPhase = d.id.length * 0.1; // Slight offset per link
        const wave = Math.sin(wavePhase + linkPhase);
        
        return 0.4 + 0.6 * (wave + 1) / 2;
      })
      .style('stroke-width', (d: any) => {
        if (!d.animated) return d.strokeWidth;
        
        const pulsePhase = (frame / totalFrames) * 3 * Math.PI;
        const pulse = Math.sin(pulsePhase);
        
        return d.strokeWidth * (0.7 + 0.3 * (pulse + 1) / 2);
      })
      .style('filter', (d: any) => {
        if (!d.animated) return 'none';
        
        const glowPhase = (frame / totalFrames) * 2 * Math.PI;
        const glow = Math.sin(glowPhase);
        const intensity = 2 + 2 * (glow + 1) / 2;
        
        return `drop-shadow(0 0 ${intensity}px ${d.color})`;
      });
      
    // Animate node pulsing for high-belief nodes
    this.svg.selectAll('.belief-node')
      .selectAll('circle')
      .style('filter', (d: any) => {
        const beliefNode = d as BeliefNode;
        if (beliefNode.beliefValue < 0.7) return 'none';
        
        const pulsePhase = (frame / totalFrames) * 2 * Math.PI + beliefNode.id.length * 0.2;
        const pulse = Math.sin(pulsePhase);
        const intensity = 3 + 3 * (pulse + 1) / 2;
        
        return `drop-shadow(0 0 ${intensity}px ${beliefNode.color})`;
      });
  }

  // Helper methods
  getUncertaintyTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'Float64': 'decimal_increase',
      'Interval': 'linear_scale',
      'pbox': 'analytics'
    };
    return iconMap[type] || 'help_outline';
  }

  getUncertaintyTypeColor(type: string): string {
    return this.uncertaintyColorMap.get(type) ?? '#333';
  }

  getBeliefForNode(nodeId: string): BeliefDisplayData | null {
    const beliefs = this.combinedBeliefData();
    return beliefs.find(b => b.nodeId.toString() === nodeId) || null;
  }
  
  expandBeliefDetails(belief: BeliefDisplayData): void {
    // Implementation for expanded belief details modal or panel
    console.log('Expanding detailed view for belief:', belief);
    this.selectNode(belief.nodeId.toString());
  }

  centerVisualization(): void {
    if (this.svg && this.simulation) {
      const transform = d3.zoomIdentity.translate(0, 0).scale(1);
      this.svg.transition().duration(750).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        transform
      );
    }
  }

  resetSelection(): void {
    this.selectedNodeId.set(null);
    if (this.svg) {
      // Reset all nodes to original appearance
      this.svg.selectAll('.belief-node')
        .style('opacity', 1)
        .selectAll('circle')
        .style('stroke', function(d: any) {
          return (d as BeliefNode).strokeColor;
        })
        .style('stroke-width', function(d: any) {
          return (d as BeliefNode).strokeWidth;
        })
        .style('filter', 'none');
        
      // Reset all links to original appearance
      this.svg.selectAll('.belief-link')
        .style('stroke-opacity', 0.6)
        .style('stroke-width', (d: any) => d.strokeWidth);
    }
  }

  retryAnalysis(): void {
    console.log('Retrying exact inference analysis...');
  }
}