import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { BeliefValue } from '../../shared/models/network-analysis.models';

export type VisualizationMode = 'structure' | 'beliefs' | 'flows' | 'critical-path';

export interface NetworkNode {
  id: number;
  x?: number;
  y?: number;
  type: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  value?: number;
  belief?: BeliefValue;
  flow?: number;
  isCritical?: boolean;
}

export interface NetworkEdge {
  source: number;
  target: number;
  value?: number;
  flow?: number;
  isCritical?: boolean;
}

export interface NodeClickInfo {
  id: number;
  type: string;
  value?: number;
  belief?: BeliefValue;
  flow?: number;
  isCritical?: boolean;
  [key: string]: any;
}

export interface EdgeClickInfo {
  source: number;
  target: number;
  value?: number;
  flow?: number;
  isCritical?: boolean;
  [key: string]: any;
}

export interface FilterConfig {
  nodeTypeFilters?: string[];
  valueRange?: { min: number; max: number };
  showCriticalOnly?: boolean;
  highlightThreshold?: number;
}

@Component({
  selector: 'app-network-visualization',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatSliderModule,
    MatCheckboxModule,
    MatCardModule
  ],
  templateUrl: './network-visualization.component.html',
  styleUrls: ['./network-visualization.component.scss']
})
export class NetworkVisualizationComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() networkData: any;
  @Input() analysisResults: any;
  @Input() visualizationMode: VisualizationMode = 'structure';
  @Input() height: string = '500px';
  @Input() showFilters: boolean = true;
  @Input() filterConfig: FilterConfig = {};

  @Output() nodeClick = new EventEmitter<NodeClickInfo>();
  @Output() edgeClick = new EventEmitter<EdgeClickInfo>();
  @Output() filtersChange = new EventEmitter<FilterConfig>();

  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('networkSvg', { static: true }) networkSvg!: ElementRef<SVGElement>;

  // Filter state
  selectedNodeTypes: string[] = [];
  valueRange = { min: 0, max: 100 };
  showCriticalOnly = false;
  highlightThreshold = 0.5;

  private svg: any;
  private simulation: any;
  nodes: NetworkNode[] = [];
  links: NetworkEdge[] = [];
  private zoom: any;

  ngOnInit(): void {
    this.processNetworkData();
  }

  ngAfterViewInit(): void {
    this.initializeVisualization();
  }

  ngOnDestroy(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  private processNetworkData(): void {
    if (!this.networkData) return;

    // Process nodes
    this.nodes = this.networkData.nodes?.map((nodeId: number) => ({
      id: nodeId,
      type: this.getNodeType(nodeId),
      value: this.getNodeValue(nodeId),
      belief: this.getNodeBelief(nodeId),
      flow: this.getNodeFlow(nodeId),
      isCritical: this.isNodeCritical(nodeId)
    })) || [];

    // Process edges
    this.links = this.networkData.edges?.map(([source, target]: [number, number]) => ({
      source,
      target,
      value: this.getEdgeValue(source, target),
      flow: this.getEdgeFlow(source, target),
      isCritical: this.isEdgeCritical(source, target)
    })) || [];
  }

  private getNodeType(nodeId: number): NetworkNode['type'] {
    if (this.networkData.source_nodes?.includes(nodeId)) return 'source';
    if (this.networkData.sink_nodes?.includes(nodeId)) return 'sink';
    if (this.networkData.fork_nodes?.includes(nodeId)) return 'fork';
    if (this.networkData.join_nodes?.includes(nodeId)) return 'join';
    return 'regular';
  }

  private getNodeValue(nodeId: number): number | undefined {
    if (this.visualizationMode === 'critical-path' && this.analysisResults?.results?.cpm_scenarios) {
      const scenarios = Object.values(this.analysisResults.results.cpm_scenarios);
      return (scenarios[0] as any)?.time_result?.node_values?.[nodeId.toString()];
    }
    return undefined;
  }

  private getNodeBelief(nodeId: number): BeliefValue | undefined {
    if (this.visualizationMode === 'beliefs' && this.analysisResults?.results?.reachability_scenarios) {
      const scenarios = Object.values(this.analysisResults.results.reachability_scenarios);
      return (scenarios[0] as any)?.exact_inference?.beliefs?.[nodeId.toString()];
    }
    return undefined;
  }

  private getNodeFlow(nodeId: number): number | undefined {
    if (this.visualizationMode === 'flows' && this.analysisResults?.results?.capacity_scenarios) {
      const scenarios = Object.values(this.analysisResults.results.capacity_scenarios);
      return (scenarios[0] as any)?.target_flows?.[nodeId.toString()];
    }
    return undefined;
  }

  private isNodeCritical(nodeId: number): boolean {
    if (this.visualizationMode === 'critical-path' && this.analysisResults?.results?.cpm_scenarios) {
      const scenarios = Object.values(this.analysisResults.results.cpm_scenarios);
      return (scenarios[0] as any)?.time_result?.critical_nodes?.includes(nodeId) || false;
    }
    return false;
  }

  private getEdgeValue(source: number, target: number): number | undefined {
    // Placeholder for edge-specific values
    return undefined;
  }

  private getEdgeFlow(source: number, target: number): number | undefined {
    // Placeholder for edge flow values
    return undefined;
  }

  private isEdgeCritical(source: number, target: number): boolean {
    // Placeholder for critical edge detection
    return false;
  }

  private initializeVisualization(): void {
    if (typeof window === 'undefined') return; // Skip on SSR

    // This would initialize D3.js visualization
    // For now, providing a placeholder structure
    console.log('Initializing D3.js visualization with:', {
      nodes: this.nodes,
      links: this.links,
      mode: this.visualizationMode
    });

    // TODO: Implement D3.js force simulation
    // this.createD3Visualization();
  }

  zoomIn(): void {
    console.log('Zoom in');
    // TODO: Implement zoom functionality
  }

  zoomOut(): void {
    console.log('Zoom out');
    // TODO: Implement zoom functionality
  }

  resetZoom(): void {
    console.log('Reset zoom');
    // TODO: Implement reset zoom functionality
  }

  centerGraph(): void {
    console.log('Center graph');
    // TODO: Implement center functionality
  }

  // Placeholder for D3.js implementation
  // private createD3Visualization(): void {
  //   // D3.js force simulation code would go here
  // }
}