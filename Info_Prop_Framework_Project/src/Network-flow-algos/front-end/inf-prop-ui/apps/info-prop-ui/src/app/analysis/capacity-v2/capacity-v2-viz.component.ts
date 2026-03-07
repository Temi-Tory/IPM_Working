import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { CapacityV2Store } from './capacity-v2.store';
import { CapacityV2HighlightMode } from './capacity-v2.models';

interface VizNode {
  id: number;
  x: number;
  y: number;
  radius: number;
  utilization: number;
  isBottleneck: boolean;
  isCritical: boolean;
}

interface VizEdge {
  key: string;
  from: number;
  to: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  utilization: number;
  isBottleneck: boolean;
  isSaturated: boolean;
  isCritical: boolean;
}

@Component({
  selector: 'app-capacity-v2-viz',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './capacity-v2-viz.component.html',
  styleUrl: './capacity-v2-viz.component.scss'
})
export class CapacityV2VizComponent {
  readonly store = inject(CapacityV2Store);

  readonly width = 920;
  readonly height = 640;

  private readonly zoomSignal = signal(1);
  private readonly panXSignal = signal(0);
  private readonly panYSignal = signal(0);

  readonly zoom = computed(() => this.zoomSignal());
  readonly panX = computed(() => this.panXSignal());
  readonly panY = computed(() => this.panYSignal());

  highlightModeValue: CapacityV2HighlightMode = 'bottlenecks';

  readonly highlightModes: Array<{ label: string; value: CapacityV2HighlightMode }> = [
    { label: 'Bottlenecks', value: 'bottlenecks' },
    { label: 'Saturated', value: 'saturated' },
    { label: 'Critical Paths', value: 'critical-paths' },
    { label: 'All', value: 'all' },
    { label: 'None', value: 'none' }
  ];

  readonly nodePositions = computed(() => {
    const network = this.store.networkData();
    if (!network) {
      return new Map<number, { x: number; y: number }>();
    }

    const positions = new Map<number, { x: number; y: number }>();
    const layers = network.iteration_sets?.length ? network.iteration_sets : [network.nodes];

    const maxLayerSize = Math.max(...layers.map((layer) => Math.max(layer.length, 1)), 1);
    const xStep = this.width / Math.max(layers.length, 1);

    layers.forEach((layerNodes, layerIndex) => {
      layerNodes.forEach((nodeId, nodeIndex) => {
        const yStep = this.height / (Math.max(layerNodes.length, maxLayerSize) + 1);
        positions.set(nodeId, {
          x: layerIndex * xStep + xStep * 0.5,
          y: (nodeIndex + 1) * yStep
        });
      });
    });

    network.nodes.forEach((nodeId, index) => {
      if (!positions.has(nodeId)) {
        positions.set(nodeId, {
          x: 60 + (index % 10) * 80,
          y: 70 + Math.floor(index / 10) * 70
        });
      }
    });

    return positions;
  });

  readonly nodes = computed<VizNode[]>(() => {
    const network = this.store.networkData();
    const detail = this.store.activeDeterministicDetail();
    const positions = this.nodePositions();

    if (!network || !detail) {
      return [];
    }

    const nodeCapMap = new Map(detail.nodeFlows.map((entry) => [entry.nodeId, entry.flow]));
    const isBottleneck = new Set<number>([
      ...detail.bottlenecks.minCutNodes,
      ...detail.bottlenecks.saturatedNodes,
      ...detail.bottlenecks.nearSaturatedNodes.map((entry) => entry.node)
    ]);

    const criticalNodeSet = new Set<number>();
    detail.criticalPaths.criticalPaths.forEach((path) => {
      path.path.forEach((nodeId) => criticalNodeSet.add(nodeId));
    });

    return network.nodes.map((nodeId) => {
      const position = positions.get(nodeId) || { x: 40, y: 40 };
      const flow = nodeCapMap.get(nodeId) ?? 0;
      const capacityRow = this.store.inputs().nodeCapacities.find((row) => Number(row.key) === nodeId);
      const capacity = this.store.inputs().analysisType === 'interval'
        ? capacityRow?.interval.max ?? 1
        : capacityRow?.deterministic ?? 1;
      const utilization = capacity > 0 ? Math.min(flow / capacity, 1) : 0;

      return {
        id: nodeId,
        x: position.x,
        y: position.y,
        radius: 8 + Math.min(Math.max(capacity, 0), 30),
        utilization,
        isBottleneck: isBottleneck.has(nodeId),
        isCritical: criticalNodeSet.has(nodeId)
      };
    });
  });

  readonly edges = computed<VizEdge[]>(() => {
    const network = this.store.networkData();
    const detail = this.store.activeDeterministicDetail();
    const positions = this.nodePositions();

    if (!network || !detail) {
      return [];
    }

    const bottleneckEdgeSet = new Set<string>([
      ...detail.bottlenecks.minCutEdges.map((edge) => this.edgeTupleKey(edge[0], edge[1])),
      ...detail.bottlenecks.saturatedEdges.map((edge) => this.edgeTupleKey(edge[0], edge[1])),
      ...detail.bottlenecks.nearSaturatedEdges.map((entry) => this.edgeTupleKey(entry.edge[0], entry.edge[1]))
    ]);

    const saturatedSet = new Set<string>(detail.bottlenecks.saturatedEdges.map((edge) => this.edgeTupleKey(edge[0], edge[1])));

    const criticalEdgeSet = new Set<string>();
    detail.criticalPaths.criticalPaths.forEach((path) => {
      for (let i = 0; i < path.path.length - 1; i += 1) {
        criticalEdgeSet.add(this.edgeTupleKey(path.path[i], path.path[i + 1]));
      }
    });

    const edgeFlowMap = new Map(detail.edgeFlows.map((edge) => [this.edgeTupleKey(edge.from, edge.to), edge]));

    return network.edges.map(([from, to]) => {
      const fromPosition = positions.get(from) || { x: 0, y: 0 };
      const toPosition = positions.get(to) || { x: 0, y: 0 };
      const key = this.edgeTupleKey(from, to);
      const flowEntry = edgeFlowMap.get(key);
      const flow = flowEntry?.flow ?? 0;
      const utilization = flowEntry?.utilization ?? 0;

      return {
        key,
        from,
        to,
        x1: fromPosition.x,
        y1: fromPosition.y,
        x2: toPosition.x,
        y2: toPosition.y,
        thickness: 1 + Math.min(flow, 8),
        utilization,
        isBottleneck: bottleneckEdgeSet.has(key),
        isSaturated: saturatedSet.has(key),
        isCritical: criticalEdgeSet.has(key)
      };
    });
  });

  onHighlightModeChange(event: MatSelectChange): void {
    const mode = event.value as CapacityV2HighlightMode;
    this.highlightModeValue = mode;
    this.store.setHighlightMode(mode);
  }

  zoomIn(): void {
    this.zoomSignal.set(Math.min(this.zoomSignal() + 0.1, 2.5));
  }

  zoomOut(): void {
    this.zoomSignal.set(Math.max(this.zoomSignal() - 0.1, 0.5));
  }

  pan(dx: number, dy: number): void {
    this.panXSignal.update((x) => x + dx);
    this.panYSignal.update((y) => y + dy);
  }

  resetView(): void {
    this.zoomSignal.set(1);
    this.panXSignal.set(0);
    this.panYSignal.set(0);
  }

  selectNode(nodeId: number): void {
    this.store.setSelectedNode(nodeId.toString());
  }

  edgeClass(edge: VizEdge): string {
    const highlightMode = this.store.highlightMode();

    if (highlightMode === 'none') {
      return 'viz-edge';
    }

    if (highlightMode === 'all') {
      if (edge.isBottleneck) {
        return 'viz-edge is-bottleneck';
      }
      if (edge.isCritical) {
        return 'viz-edge is-critical';
      }
      if (edge.isSaturated) {
        return 'viz-edge is-saturated';
      }
      return 'viz-edge';
    }

    if (highlightMode === 'bottlenecks' && edge.isBottleneck) {
      return 'viz-edge is-bottleneck';
    }

    if (highlightMode === 'saturated' && edge.isSaturated) {
      return 'viz-edge is-saturated';
    }

    if (highlightMode === 'critical-paths' && edge.isCritical) {
      return 'viz-edge is-critical';
    }

    return 'viz-edge';
  }

  nodeClass(node: VizNode): string {
    const selectedNode = this.store.selectedNodeId();

    if (selectedNode && Number(selectedNode) === node.id) {
      return 'viz-node is-selected';
    }

    if (node.isBottleneck) {
      return 'viz-node is-bottleneck';
    }

    if (node.isCritical) {
      return 'viz-node is-critical';
    }

    if (node.utilization >= 0.9) {
      return 'viz-node util-high';
    }

    if (node.utilization >= 0.6) {
      return 'viz-node util-mid';
    }

    return 'viz-node util-low';
  }

  connectedEdgeClass(edge: VizEdge): string {
    const selectedNode = this.store.selectedNodeId();
    if (!selectedNode) {
      return this.edgeClass(edge);
    }

    const selected = Number(selectedNode);
    const isConnected = edge.from === selected || edge.to === selected;
    return isConnected ? `${this.edgeClass(edge)} is-connected` : this.edgeClass(edge);
  }

  transform(): string {
    return `translate(${this.panX()}, ${this.panY()}) scale(${this.zoom()})`;
  }

  trackNode(_: number, node: VizNode): number {
    return node.id;
  }

  trackEdge(_: number, edge: VizEdge): string {
    return edge.key;
  }

  private edgeTupleKey(from: number, to: number): string {
    return `${from}->${to}`;
  }
}
