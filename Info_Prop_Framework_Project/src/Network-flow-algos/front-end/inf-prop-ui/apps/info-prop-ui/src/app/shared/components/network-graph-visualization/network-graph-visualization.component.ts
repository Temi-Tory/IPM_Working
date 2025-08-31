import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

// NGX Graph imports
import { NgxGraphModule, Node, Edge, Layout } from '@swimlane/ngx-graph';

// Interface for zoom options
interface NgxGraphZoomOptions {
  autoCenter?: boolean;
  force?: boolean;
}

// Interface for node detail data
export interface NodeDetail {
  node: number;
  type: string;
  inDegree: number;
  outDegree: number;
}

// Interface for edge detail data
export interface EdgeDetail {
  source: number;
  target: number;
  edgeType: string;
}

// Interface for graph layout settings
export interface GraphLayoutSettings {
  orientation: 'TB' | 'BT' | 'LR' | 'RL';
  marginX: number;
  marginY: number;
  edgePadding: number;
  rankPadding: number;
  nodePadding: number;
}

@Component({
  selector: 'app-network-graph-visualization',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    NgxGraphModule
  ],
  templateUrl: './network-graph-visualization.component.html',
  styleUrls: ['./network-graph-visualization.component.scss']
})
export class NetworkGraphVisualizationComponent implements OnInit, OnDestroy {
  
  // Input properties
  @Input() nodes: NodeDetail[] = [];
  @Input() edges: EdgeDetail[] = [];
  @Input() filteredNodeCount: number = 0;
  @Input() filteredEdgeCount: number = 0;
  
  // Output events
  @Output() nodeSelected = new EventEmitter<number>();
  @Output() edgeSelected = new EventEmitter<{sourceId: number, targetId: number}>();
  
  // Graph visualization computed signals
  graphNodes = computed(() => this.transformToGraphNodes());
  graphEdges = computed(() => this.transformToGraphEdges());
  
  // Graph layout configuration
  graphLayout: string | Layout = 'dagre';
  
  // Graph layout settings
  graphLayoutSettings: GraphLayoutSettings = {
    orientation: 'TB', // Top to Bottom
    marginX: 20,
    marginY: 20,
    edgePadding: 30,
    rankPadding: 50,
    nodePadding: 20,
  };

  // Subject for triggering zoom to fit
  zoomToFit$ = new Subject<NgxGraphZoomOptions>();
  
  // Computed properties for legend
  uniqueNodeTypes = computed(() => this.getUniqueNodeTypes());

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.zoomToFit$.complete();
  }

  // Graph transformation methods
  private transformToGraphNodes(): Node[] {
    // Safety check to ensure we have valid data
    if (!this.nodes || !Array.isArray(this.nodes)) {
      return [];
    }
    
    return this.nodes.map(nodeDetail => ({
      id: `node-${nodeDetail.node}`, // Prefix with 'node-' to make valid CSS selector
      label: nodeDetail.node.toString(),
      data: {
        type: nodeDetail.type,
        inDegree: nodeDetail.inDegree,
        outDegree: nodeDetail.outDegree,
        originalId: nodeDetail.node
      },
      dimension: {
        width: 60,
        height: 60
      }
    }));
  }

  private transformToGraphEdges(): Edge[] {
    // Safety check to ensure we have valid data
    if (!this.edges || !Array.isArray(this.edges)) {
      return [];
    }
    
    return this.edges.map(edgeDetail => ({
      id: `edge-${edgeDetail.source}-${edgeDetail.target}`, // Prefix with 'edge-'
      source: `node-${edgeDetail.source}`, // Match the node ID format
      target: `node-${edgeDetail.target}`, // Match the node ID format
      label: '', // You can add edge labels if needed
      data: {
        type: edgeDetail.edgeType,
        sourceId: edgeDetail.source,
        targetId: edgeDetail.target
      }
    }));
  }

  // Graph interaction methods
  onNodeSelect(event: any): void {
    console.log('Selected node:', event);
    if (event && event.data && event.data.originalId) {
      this.nodeSelected.emit(event.data.originalId);
    }
  }

  onEdgeSelect(event: any): void {
    console.log('Selected edge:', event);
    if (event && event.data && event.data.sourceId && event.data.targetId) {
      this.edgeSelected.emit({
        sourceId: event.data.sourceId,
        targetId: event.data.targetId
      });
    }
  }

  // Graph control methods
  updateGraphLayout(): void {
    // Trigger re-layout by updating the layout settings
    this.graphLayoutSettings = { ...this.graphLayoutSettings };
  }

  fitGraphToView(): void {
    this.zoomToFit$.next({ autoCenter: true, force: true });
  }

  // Get node color based on type
  getNodeColor(nodeType: string): string {
    const colorMap: { [key: string]: string } = {
      'Source': '#4CAF50',      // Green
      'Sink': '#F44336',        // Red  
      'Fork': '#FF9800',        // Orange
      'Join': '#2196F3',        // Blue
      'Regular': '#9E9E9E',     // Gray
      'Source + Fork': '#8BC34A',
      'Sink + Join': '#3F51B5',
      // Add more combinations as needed
    };
    return colorMap[nodeType] || '#9E9E9E';
  }

  // Get unique node types for legend
  private getUniqueNodeTypes(): string[] {
    const types = new Set<string>();
    
    this.nodes.forEach(node => {
      types.add(node.type);
    });

    return Array.from(types).sort();
  }

  // Get node count by type for legend
  getNodeCountByType(nodeType: string): number {
    return this.nodes.filter(node => node.type === nodeType).length;
  }

  // Helper method to access Math.min in template
  mathMin(a: number, b: number): number {
    return Math.min(a, b);
  }
}