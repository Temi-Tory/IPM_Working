import { Component, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';

import * as d3 from 'd3';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { CpmScenario, NetworkStructure } from '../../shared/models/network-analysis.models';

interface CriticalPathNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  nodeId: number;
  completionTime: number;
  earlyStart: number;
  lateStart: number;
  slack: number;
  isCritical: boolean;
  nodeType: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  radius: number;
  color: string;
  duration?: number;
}

interface CriticalPathLink extends d3.SimulationLinkDatum<CriticalPathNode> {
  source: string | CriticalPathNode;
  target: string | CriticalPathNode;
  id: string;
  isCritical: boolean;
  strokeWidth: number;
  color: string;
  delay?: number;
}

interface TimelineActivity {
  nodeId: number;
  name: string;
  earlyStart: number;
  lateStart: number;
  duration: number;
  slack: number;
  isCritical: boolean;
  dependencies: number[];
}

interface CriticalPathAnalysis {
  totalDuration: number;
  criticalNodes: number[];
  completionTimes: Record<string, number>;
  slackTimes: Record<string, number>;
  criticalPath: number[];
}

type VisualizationMode = 'network' | 'timeline';
type PathViewMode = 'critical-only' | 'with-slack' | 'all-paths';

@Component({
  selector: 'app-critical-path-visualization',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatTabsModule
  ],
  templateUrl: './critical-path-visualization.component.html',
  styleUrls: ['./critical-path-visualization.component.scss']
})
export class CriticalPathVisualizationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('networkContainer', { static: false }) networkContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('timelineContainer', { static: false }) timelineContainer!: ElementRef<HTMLDivElement>;

  private analysisState = inject(AnalysisStateService);
  
  // Core state signals
  selectedNodeId = signal<string | null>(null);
  selectedScenario = signal<string>('');
  isLoading = signal(true);
  
  // View state
  visualizationMode = signal<VisualizationMode>('network');
  pathViewMode = signal<PathViewMode>('critical-only');
  showTimingLabels = signal(true);
  showSlackIndicators = signal(true);
  animateCriticalPath = signal(false);

  // Computed properties
  networkData = computed(() => this.analysisState.networkData());
  cpmAnalysis = computed(() => this.analysisState.cpmAnalysis());
  
  // CPM scenarios data
  cpmScenarios = computed(() => {
    const results = this.analysisState.analysisResults();
    return results?.results?.cpm_scenarios || {};
  });
  
  scenarioNames = computed(() => Object.keys(this.cpmScenarios()));
  
  selectedScenarioData = computed(() => {
    const scenarios = this.cpmScenarios();
    const scenarioName = this.selectedScenario();
    
    if (!scenarioName && Object.keys(scenarios).length > 0) {
      const firstScenario = Object.keys(scenarios)[0];
      this.selectedScenario.set(firstScenario);
      return scenarios[firstScenario];
    }
    
    return scenarios[scenarioName] || null;
  });

  // Critical path analysis
  criticalPathAnalysis = computed((): CriticalPathAnalysis | null => {
    const scenario = this.selectedScenarioData();
    if (!scenario?.time_result) return null;

    const timeResult = scenario.time_result;
    const nodeValues = timeResult.node_values;
    const criticalNodes = timeResult.critical_nodes;
    const totalDuration = timeResult.critical_value;

    // Calculate slack times
    const slackTimes: Record<string, number> = {};
    Object.keys(nodeValues).forEach(nodeId => {
      const completionTime = nodeValues[nodeId];
      const isOnCriticalPath = criticalNodes.includes(parseInt(nodeId));
      slackTimes[nodeId] = isOnCriticalPath ? 0 : Math.max(0, totalDuration - completionTime);
    });

    return {
      totalDuration,
      criticalNodes,
      completionTimes: nodeValues,
      slackTimes,
      criticalPath: this.calculateCriticalPath(criticalNodes, nodeValues)
    };
  });

  hasData = computed(() => {
    const networkData = this.networkData();
    const analysis = this.criticalPathAnalysis();
    return networkData !== null && analysis !== null;
  });

  // D3 visualization properties
  private networkSvg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private timelineSvg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<CriticalPathNode, CriticalPathLink> | null = null;
  private nodes: CriticalPathNode[] = [];
  private links: CriticalPathLink[] = [];
  private timelineActivities: TimelineActivity[] = [];
  private networkWidth = 0;
  private networkHeight = 0;
  private timelineWidth = 0;
  private timelineHeight = 0;

  // Color schemes
  private readonly colors = {
    critical: '#ff4444',      // Red for critical path
    nonCritical: '#1976d2',   // Blue for non-critical
    slack: '#ff9800',         // Orange for slack
    background: '#fafafa',
    grid: '#e0e0e0',
    text: '#333333'
  };

  constructor() {
    // React to data changes
    effect(() => {
      const hasData = this.hasData();
      this.isLoading.set(false);
      
      if (hasData && this.networkContainer) {
        this.initializeVisualization();
      }
    });
  }

  ngOnInit(): void {
    this.isLoading.set(false);
    this.analysisState.loadParsedDataFromSession();
  }

  ngAfterViewInit(): void {
    if (this.hasData()) {
      this.initializeVisualization();
    }
  }

  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  private initializeVisualization(): void {
    if (!this.hasData()) return;

    this.setupDimensions();
    this.prepareData();
    
    if (this.visualizationMode() === 'network') {
      this.createNetworkVisualization();
    } else {
      this.createTimelineVisualization();
    }
  }

  private setupDimensions(): void {
    // Network dimensions
    if (this.networkContainer?.nativeElement) {
      const networkRect = this.networkContainer.nativeElement.getBoundingClientRect();
      this.networkWidth = networkRect.width || 800;
      this.networkHeight = Math.max(600, networkRect.height || 600);
    }

    // Timeline dimensions
    if (this.timelineContainer?.nativeElement) {
      const timelineRect = this.timelineContainer.nativeElement.getBoundingClientRect();
      this.timelineWidth = timelineRect.width || 800;
      this.timelineHeight = Math.max(400, timelineRect.height || 400);
    }
  }

  private prepareData(): void {
    const networkData = this.networkData();
    const analysis = this.criticalPathAnalysis();
    
    if (!networkData || !analysis) return;

    // Prepare nodes with critical path information
    const nodeSet = new Set<string>();
    const nodeConnections = new Map<string, { inDegree: number; outDegree: number }>();

    // Build node connections from edges
    networkData.edges.forEach(([source, target]) => {
      const sourceStr = source.toString();
      const targetStr = target.toString();
      
      nodeSet.add(sourceStr);
      nodeSet.add(targetStr);
      
      if (!nodeConnections.has(sourceStr)) {
        nodeConnections.set(sourceStr, { inDegree: 0, outDegree: 0 });
      }
      if (!nodeConnections.has(targetStr)) {
        nodeConnections.set(targetStr, { inDegree: 0, outDegree: 0 });
      }
      
      nodeConnections.get(sourceStr)!.outDegree++;
      nodeConnections.get(targetStr)!.inDegree++;
    });

    // Create enhanced nodes
    this.nodes = Array.from(nodeSet).map(nodeId => {
      const nodeIdNum = parseInt(nodeId);
      const completionTime = analysis.completionTimes[nodeId] || 0;
      const slack = analysis.slackTimes[nodeId] || 0;
      const isCritical = analysis.criticalNodes.includes(nodeIdNum);
      const earlyStart = Math.max(0, completionTime - slack);
      const lateStart = earlyStart + slack;

      return {
        id: nodeId,
        name: nodeId,
        nodeId: nodeIdNum,
        completionTime,
        earlyStart,
        lateStart,
        slack,
        isCritical,
        nodeType: this.getNodeType(nodeIdNum, networkData),
        radius: this.calculateNodeRadius(isCritical, slack),
        color: this.getNodeColor(isCritical, slack)
      } as CriticalPathNode;
    });

    // Create enhanced links with critical path information
    this.links = networkData.edges.map(([source, target]) => {
      const sourceNode = this.nodes.find(n => n.nodeId === source);
      const targetNode = this.nodes.find(n => n.nodeId === target);
      const isCritical = sourceNode?.isCritical && targetNode?.isCritical;

      return {
        source: source.toString(),
        target: target.toString(),
        id: `${source}-${target}`,
        isCritical,
        strokeWidth: isCritical ? 3 : 1.5,
        color: isCritical ? this.colors.critical : this.colors.nonCritical
      } as CriticalPathLink;
    });

    // Prepare timeline activities
    this.timelineActivities = this.nodes.map(node => ({
      nodeId: node.nodeId,
      name: `Activity ${node.nodeId}`,
      earlyStart: node.earlyStart,
      lateStart: node.lateStart,
      duration: Math.max(1, node.completionTime - node.earlyStart),
      slack: node.slack,
      isCritical: node.isCritical,
      dependencies: this.getNodeDependencies(node.nodeId, networkData)
    }));
  }

  private createNetworkVisualization(): void {
    if (!this.networkContainer?.nativeElement) return;

    // Clear existing
    d3.select(this.networkContainer.nativeElement).select('svg').remove();

    // Create SVG
    this.networkSvg = d3.select(this.networkContainer.nativeElement)
      .append('svg')
      .attr('width', this.networkWidth)
      .attr('height', this.networkHeight)
      .attr('viewBox', `0 0 ${this.networkWidth} ${this.networkHeight}`)
      .style('background', this.colors.background);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.networkSvg) {
          this.networkSvg.select('g.main-group').attr('transform', event.transform);
        }
      });

    this.networkSvg.call(zoom);

    // Create main group
    const g = this.networkSvg.append('g').attr('class', 'main-group');

    // Add definitions for markers and gradients
    this.addNetworkDefinitions();

    // Setup force simulation
    this.setupNetworkSimulation();

    // Render network elements
    this.renderNetworkElements(g);

    // Add critical path animation if enabled
    if (this.animateCriticalPath()) {
      this.animateNetworkCriticalPath();
    }
  }

  private addNetworkDefinitions(): void {
    if (!this.networkSvg) return;

    const defs = this.networkSvg.append('defs');

    // Critical path arrowhead
    defs.append('marker')
      .attr('id', 'critical-arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', this.colors.critical);

    // Regular arrowhead
    defs.append('marker')
      .attr('id', 'regular-arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', this.colors.nonCritical);

    // Slack gradient
    const slackGradient = defs.append('radialGradient')
      .attr('id', 'slack-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');

    slackGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', this.colors.slack)
      .attr('stop-opacity', 0.8);

    slackGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', this.colors.slack)
      .attr('stop-opacity', 0.3);
  }

  private setupNetworkSimulation(): void {
    this.simulation = d3.forceSimulation<CriticalPathNode>(this.nodes)
      .force('link', d3.forceLink<CriticalPathNode, CriticalPathLink>(this.links)
        .id(d => d.id)
        .distance(d => d.isCritical ? 120 : 80)
        .strength(d => d.isCritical ? 1.0 : 0.8))
      .force('charge', d3.forceManyBody()
        .strength(d => (d as CriticalPathNode).isCritical ? -500 : -300)
        .distanceMax(300))
      .force('center', d3.forceCenter(this.networkWidth / 2, this.networkHeight / 2))
      .force('collision', d3.forceCollide<CriticalPathNode>()
        .radius(d => d.radius + 10)
        .strength(0.9))
      .force('x', d3.forceX(this.networkWidth / 2).strength(0.1))
      .force('y', d3.forceY(this.networkHeight / 2).strength(0.1));
  }

  private renderNetworkElements(g: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    // Render links first (behind nodes)
    const link = g.selectAll('.link')
      .data(this.links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.strokeWidth)
      .attr('stroke-opacity', d => d.isCritical ? 0.9 : 0.6)
      .attr('marker-end', d => `url(#${d.isCritical ? 'critical' : 'regular'}-arrowhead)`);

    // Add link animations for critical path
    if (this.animateCriticalPath()) {
      const criticalLinks = link.filter(d => d.isCritical)
        .style('stroke-dasharray', '8,4');
      
      // Animate dash offset for flowing effect
      function animateDashes() {
        criticalLinks
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .style('stroke-dashoffset', '-12')
          .on('end', () => {
            criticalLinks.style('stroke-dashoffset', '0');
            setTimeout(animateDashes, 100);
          });
      }
      
      animateDashes();
    }

    // Render nodes
    const node = g.selectAll('.node')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.createDragBehavior());

    // Add node circles with slack indicators
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.isCritical ? this.colors.critical : '#fff')
      .attr('stroke-width', d => d.isCritical ? 3 : 2);

    // Add slack indicators (outer ring)
    if (this.showSlackIndicators()) {
      node.filter(d => !d.isCritical && d.slack > 0)
        .append('circle')
        .attr('r', d => d.radius + 5)
        .attr('fill', 'none')
        .attr('stroke', this.colors.slack)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.7);
    }

    // Add node labels
    if (this.showTimingLabels()) {
      node.append('text')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.5em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', this.colors.text);

      // Add timing information
      node.append('text')
        .text(d => `${d.completionTime.toFixed(1)}`)
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .attr('font-size', '8px')
        .attr('fill', this.colors.text);

      // Add slack information for non-critical nodes
      node.filter(d => !d.isCritical && d.slack > 0)
        .append('text')
        .text(d => `±${d.slack.toFixed(1)}`)
        .attr('text-anchor', 'middle')
        .attr('dy', '2.4em')
        .attr('font-size', '7px')
        .attr('fill', this.colors.slack);
    }

    // Add click handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.selectNode(d.id);
    });

    // Add hover effects
    node.on('mouseenter', (event, d) => {
      this.highlightPath(d.nodeId, true);
    }).on('mouseleave', (event, d) => {
      this.highlightPath(d.nodeId, false);
    });

    // Update positions on simulation tick
    this.simulation?.on('tick', () => {
      link
        .attr('x1', d => (d.source as CriticalPathNode).x!)
        .attr('y1', d => (d.source as CriticalPathNode).y!)
        .attr('x2', d => (d.target as CriticalPathNode).x!)
        .attr('y2', d => (d.target as CriticalPathNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  private createTimelineVisualization(): void {
    if (!this.timelineContainer?.nativeElement || this.timelineActivities.length === 0) return;

    // Clear existing
    d3.select(this.timelineContainer.nativeElement).select('svg').remove();

    // Create SVG
    this.timelineSvg = d3.select(this.timelineContainer.nativeElement)
      .append('svg')
      .attr('width', this.timelineWidth)
      .attr('height', this.timelineHeight)
      .attr('viewBox', `0 0 ${this.timelineWidth} ${this.timelineHeight}`)
      .style('background', this.colors.background);

    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const width = this.timelineWidth - margin.left - margin.right;
    const height = this.timelineHeight - margin.top - margin.bottom;

    const g = this.timelineSvg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Sort activities by start time for better layout
    const sortedActivities = [...this.timelineActivities]
      .sort((a, b) => a.earlyStart - b.earlyStart);

    // Create scales
    const maxTime = Math.max(...sortedActivities.map(a => a.lateStart + a.duration));
    const xScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(sortedActivities.map(a => a.nodeId.toString()))
      .range([0, height])
      .padding(0.1);

    // Add grid lines
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => `${d}t`);

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => `Node ${d}`);

    // Grid lines
    g.selectAll('.grid-line')
      .data(xScale.ticks(10))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', this.colors.grid)
      .attr('stroke-dasharray', '2,2');

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .append('text')
      .attr('x', width / 2)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', this.colors.text)
      .text('Time');

    g.append('g')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', this.colors.text)
      .text('Activities');

    // Create activity bars
    const bars = g.selectAll('.activity-bar')
      .data(sortedActivities)
      .enter()
      .append('g')
      .attr('class', 'activity-bar');

    // Early start bars (main activity)
    bars.append('rect')
      .attr('class', 'early-bar')
      .attr('x', d => xScale(d.earlyStart))
      .attr('y', d => yScale(d.nodeId.toString())!)
      .attr('width', d => xScale(d.duration))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.isCritical ? this.colors.critical : this.colors.nonCritical)
      .attr('opacity', 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Slack bars (float time)
    bars.filter(d => d.slack > 0)
      .append('rect')
      .attr('class', 'slack-bar')
      .attr('x', d => xScale(d.earlyStart + d.duration))
      .attr('y', d => yScale(d.nodeId.toString())! + yScale.bandwidth() * 0.2)
      .attr('width', d => xScale(d.slack))
      .attr('height', yScale.bandwidth() * 0.6)
      .attr('fill', this.colors.slack)
      .attr('opacity', 0.5)
      .attr('stroke', this.colors.slack)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Add timing labels
    if (this.showTimingLabels()) {
      bars.append('text')
        .text(d => `${d.duration.toFixed(1)}${d.slack > 0 ? ` +${d.slack.toFixed(1)}` : ''}`)
        .attr('x', d => xScale(d.earlyStart + d.duration / 2))
        .attr('y', d => yScale(d.nodeId.toString())! + yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#fff');
    }

    // Add critical path highlighting
    if (this.pathViewMode() === 'critical-only') {
      bars.filter(d => !d.isCritical)
        .style('opacity', 0.3);
    }

    // Add interactivity
    bars.on('click', (event, d) => {
      this.selectNode(d.nodeId.toString());
    })
    .on('mouseenter', (event, d) => {
      this.highlightTimelineActivity(d.nodeId, true);
    })
    .on('mouseleave', (event, d) => {
      this.highlightTimelineActivity(d.nodeId, false);
    });
  }

  // Helper methods
  private calculateNodeRadius(isCritical: boolean, slack: number): number {
    const baseRadius = isCritical ? 12 : 8;
    const slackBonus = Math.min(slack * 0.5, 4);
    return baseRadius + slackBonus;
  }

  private getNodeColor(isCritical: boolean, slack: number): string {
    if (isCritical) return this.colors.critical;
    if (slack > 0) return this.colors.slack;
    return this.colors.nonCritical;
  }

  private getNodeType(nodeId: number, networkData: NetworkStructure): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    if (networkData.source_nodes.includes(nodeId)) return 'source';
    if (networkData.sink_nodes.includes(nodeId)) return 'sink';
    if (networkData.fork_nodes.includes(nodeId)) return 'fork';
    if (networkData.join_nodes.includes(nodeId)) return 'join';
    return 'regular';
  }

  private getNodeDependencies(nodeId: number, networkData: NetworkStructure): number[] {
    return networkData.edges
      .filter(([_, target]) => target === nodeId)
      .map(([source, _]) => source);
  }

  private calculateCriticalPath(criticalNodes: number[], completionTimes: Record<string, number>): number[] {
    // Sort critical nodes by completion time to get the actual critical path sequence
    return criticalNodes.sort((a, b) => {
      const timeA = completionTimes[a.toString()] || 0;
      const timeB = completionTimes[b.toString()] || 0;
      return timeA - timeB;
    });
  }

  private createDragBehavior() {
    return d3.drag<SVGGElement, CriticalPathNode>()
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
        // Keep the node fixed at its dragged position
      });
  }

  private highlightPath(nodeId: number, highlight: boolean): void {
    if (this.visualizationMode() === 'network' && this.networkSvg) {
      const opacity = highlight ? 0.3 : 0.8;
      const highlightOpacity = 1.0;

      // Dim all elements
      this.networkSvg.selectAll('.link')
        .style('stroke-opacity', opacity);
      
      this.networkSvg.selectAll('.node')
        .style('opacity', opacity);

      if (highlight) {
        // Highlight connected paths
        this.networkSvg.selectAll('.link')
          .filter((d: any) => 
            (d.source.nodeId === nodeId || d.target.nodeId === nodeId) &&
            (this.pathViewMode() === 'all-paths' || d.isCritical)
          )
          .style('stroke-opacity', highlightOpacity)
          .style('stroke-width', (d: any) => d.strokeWidth + 1);

        // Highlight connected nodes
        this.networkSvg.selectAll('.node')
          .filter((d: any) => d.nodeId === nodeId)
          .style('opacity', highlightOpacity);
      }
    }
  }

  private highlightTimelineActivity(nodeId: number, highlight: boolean): void {
    if (this.visualizationMode() === 'timeline' && this.timelineSvg) {
      const opacity = highlight ? 0.5 : 1.0;
      
      this.timelineSvg.selectAll('.activity-bar')
        .style('opacity', (d: any) => d.nodeId === nodeId ? 1.0 : opacity);
    }
  }

  private animateNetworkCriticalPath(): void {
    if (!this.networkSvg) return;

    // Animate critical path nodes in sequence
    const criticalNodes = this.nodes.filter(n => n.isCritical);
    const analysis = this.criticalPathAnalysis();
    
    if (!analysis) return;

    const sortedCriticalNodes = criticalNodes.sort((a, b) => 
      analysis.completionTimes[a.id] - analysis.completionTimes[b.id]
    );

    sortedCriticalNodes.forEach((node, index) => {
      this.networkSvg!.selectAll('.node')
        .filter((d: any) => d.id === node.id)
        .select('circle')
        .transition()
        .delay(index * 500)
        .duration(300)
        .attr('r', node.radius * 1.5)
        .transition()
        .duration(300)
        .attr('r', node.radius);
    });
  }

  private selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    
    // Visual feedback for selected node
    if (this.networkSvg) {
      this.networkSvg.selectAll('.node circle')
        .style('stroke', (d: any) => d.id === nodeId ? '#ffd700' : 
               d.isCritical ? this.colors.critical : '#fff')
        .style('stroke-width', (d: any) => d.id === nodeId ? 4 : 
               d.isCritical ? 3 : 2);
    }
  }

  // Public event handlers
  onVisualizationModeChange(mode: VisualizationMode): void {
    this.visualizationMode.set(mode);
    this.initializeVisualization();
  }

  onPathViewModeChange(mode: PathViewMode): void {
    this.pathViewMode.set(mode);
    this.initializeVisualization();
  }

  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
  }

  onTimingLabelsToggle(show: boolean): void {
    this.showTimingLabels.set(show);
    this.initializeVisualization();
  }

  onSlackIndicatorsToggle(show: boolean): void {
    this.showSlackIndicators.set(show);
    this.initializeVisualization();
  }

  onAnimationToggle(animate: boolean): void {
    this.animateCriticalPath.set(animate);
    if (this.visualizationMode() === 'network') {
      this.initializeVisualization();
    }
  }

  centerView(): void {
    if (this.networkSvg && this.simulation) {
      const transform = d3.zoomIdentity.translate(0, 0).scale(1);
      this.networkSvg.transition().duration(750).call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        transform
      );
    }
  }

  resetSimulation(): void {
    if (this.simulation) {
      this.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
      });
      this.simulation.alpha(1).restart();
    }
  }

  // Getters for template
  get selectedNodeData() {
    const nodeId = this.selectedNodeId();
    if (!nodeId) return null;
    
    const node = this.nodes.find(n => n.id === nodeId);
    const analysis = this.criticalPathAnalysis();
    
    if (!node || !analysis) return null;

    return {
      nodeId: node.nodeId,
      completionTime: node.completionTime,
      earlyStart: node.earlyStart,
      lateStart: node.lateStart,
      slack: node.slack,
      isCritical: node.isCritical,
      nodeType: node.nodeType,
      criticalPath: analysis.criticalPath.includes(node.nodeId)
    };
  }

  get projectSummary() {
    const analysis = this.criticalPathAnalysis();
    if (!analysis) return null;

    return {
      totalDuration: analysis.totalDuration,
      criticalActivities: analysis.criticalNodes.length,
      totalActivities: Object.keys(analysis.completionTimes).length,
      criticalPathLength: analysis.criticalPath.length,
      averageSlack: Object.values(analysis.slackTimes).reduce((a, b) => a + b, 0) / Object.keys(analysis.slackTimes).length
    };
  }

  getNodeTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'source': 'play_arrow',
      'sink': 'stop',
      'fork': 'call_split',
      'join': 'call_merge',
      'regular': 'grain'
    };
    return iconMap[type] || 'grain';
  }
}