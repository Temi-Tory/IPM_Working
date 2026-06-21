import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FlowWorkbenchStore } from '../flow-workbench.store';

@Component({
  selector: 'app-flow-visualization-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './flow-visualization-page.component.html',
  styleUrl: './flow-visualization-page.component.scss'
})
export class FlowVisualizationPageComponent {
  readonly store = inject(FlowWorkbenchStore);
  readonly edgeViewMode = signal<'all' | 'critical'>('all');

  readonly nodes = computed(() => {
    const network = this.store.network();
    if (!network) return [] as number[];
    return network.nodes.slice(0, Math.max(10, this.store.graphRender().maxNodes));
  });

  readonly criticalEdgeSet = computed(() => {
    const result = this.store.result();
    const keys = new Set<string>();
    if (!result) return keys;

    for (const [u, v] of result.flow.saturatedEdges ?? []) {
      keys.add(`${u}-${v}`);
    }

    for (const [u, v] of result.minCutAnalysis.edgesInEveryCut ?? []) {
      keys.add(`${u}-${v}`);
    }

    for (const [u, v] of result.structure.spofEdges ?? []) {
      keys.add(`${u}-${v}`);
    }

    return keys;
  });

  readonly minCutEdgeSet = computed(() => {
    const result = this.store.result();
    const keys = new Set<string>();
    if (!result) return keys;

    for (const [u, v] of result.minCutAnalysis.edgesInEveryCut ?? []) {
      keys.add(`${u}-${v}`);
    }

    for (const [u, v] of result.minCutAnalysis.edgesInSomeCut ?? []) {
      keys.add(`${u}-${v}`);
    }

    return keys;
  });

  readonly sourceSet = computed(() => new Set(this.store.network()?.source_nodes ?? []));
  readonly sinkSet = computed(() => new Set(this.store.network()?.sink_nodes ?? []));

  readonly edges = computed(() => {
    const network = this.store.network();
    if (!network) return [] as Array<[number, number]>;

    const maxEdges = Math.max(50, this.store.graphRender().maxEdges);
    const allEdges = network.edges;

    if (this.edgeViewMode() === 'all') {
      return allEdges.slice(0, maxEdges);
    }

    const critical = this.criticalEdgeSet();
    const criticalEdges = allEdges.filter(([u, v]) => critical.has(`${u}-${v}`));

    if (criticalEdges.length > 0) {
      return criticalEdges.slice(0, maxEdges);
    }

    return allEdges.slice(0, Math.min(200, maxEdges));
  });

  readonly nodePos = computed(() => {
    const network = this.store.network();
    const nodes = this.nodes();
    const map = new Map<number, { x: number; y: number }>();
    if (!network) return map;

    const layers = (network.iteration_sets?.length ? network.iteration_sets : [nodes]).map((layer) =>
      layer.filter((n) => nodes.includes(n))
    );

    const width = 1400;
    const height = 860;
    const xStep = width / Math.max(1, layers.length);

    layers.forEach((layer, i) => {
      const yStep = height / (Math.max(1, layer.length) + 1);
      layer.forEach((n, j) => map.set(n, { x: 70 + i * xStep, y: (j + 1) * yStep }));
    });

    nodes.forEach((n, idx) => {
      if (!map.has(n)) {
        map.set(n, { x: 80 + (idx % 12) * 90, y: 80 + Math.floor(idx / 12) * 65 });
      }
    });

    return map;
  });

  readonly saturatedSet = computed(() => {
    const sat = this.store.result()?.flow.saturatedEdges ?? [];
    return new Set(sat.map(([u, v]) => `${u}-${v}`));
  });

  readonly graphStats = computed(() => {
    const network = this.store.network();
    if (!network) {
      return { totalNodes: 0, totalEdges: 0, shownNodes: 0, shownEdges: 0 };
    }

    return {
      totalNodes: network.nodes.length,
      totalEdges: network.edges.length,
      shownNodes: this.nodes().length,
      shownEdges: this.edges().length
    };
  });

  readonly layoutNote = computed(() => {
    const iterationSets = this.store.network()?.iteration_sets ?? [];
    if (iterationSets.length > 0) {
      return 'Directed DAG layout uses topological layers from iteration sets (left to right).';
    }
    return 'Directed DAG layout uses fallback layered placement because iteration sets are unavailable.';
  });

  setEdgeViewMode(mode: 'all' | 'critical'): void {
    this.edgeViewMode.set(mode);
  }

  edgeClass(u: number, v: number): string {
    const key = `${u}-${v}`;
    const saturated = this.saturatedSet().has(key);
    const mincut = this.minCutEdgeSet().has(key);

    if (saturated && mincut) {
      return 'edge saturated mincut';
    }
    if (saturated) {
      return 'edge saturated';
    }
    if (mincut) {
      return 'edge mincut';
    }
    return 'edge';
  }

  edgePath(u: number, v: number): string {
    const src = this.nodePos().get(u);
    const dst = this.nodePos().get(v);
    if (!src || !dst) return '';

    const dx = dst.x - src.x;
    const bend = Math.max(10, Math.min(40, Math.abs(dx) * 0.08));
    const c1x = src.x + bend;
    const c2x = dst.x - bend;
    return `M ${src.x} ${src.y} C ${c1x} ${src.y}, ${c2x} ${dst.y}, ${dst.x} ${dst.y}`;
  }

  nodeClass(node: number): string {
    const selected = this.store.selectedNodeKeys().has(String(node));
    const source = this.sourceSet().has(node);
    const sink = this.sinkSet().has(node);

    if (selected && source) return 'node selected source';
    if (selected && sink) return 'node selected sink';
    if (source) return 'node source';
    if (sink) return 'node sink';
    if (selected) return 'node selected';
    return 'node';
  }

  toggleNodeSelection(node: number): void {
    this.store.toggleRow('node', String(node));
  }
}
