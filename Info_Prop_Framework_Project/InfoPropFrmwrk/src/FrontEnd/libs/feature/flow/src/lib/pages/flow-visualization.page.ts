import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  CardComponent,
  EmptyStateComponent,
  LoadingStateComponent,
} from '@inf-prop/shared/ui';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import { NetworkStructure } from '@inf-prop/shared/api-client';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';
import { edgeKey } from '../flow-view.util';

interface PlacedNode {
  id: number;
  x: number;
  y: number;
  role: 'source' | 'sink' | 'spof' | 'regular';
}

interface PlacedEdge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'regular' | 'saturated' | 'mincut';
}

const COL_GAP = 130;
const ROW_GAP = 46;
const PAD = 32;
const MAX_NODES = 260;

/** Visualization sub-view: the layered DAG, coloured by the solved flow state. */
@Component({
  selector: 'ipf-flow-visualization-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, EmptyStateComponent, LoadingStateComponent],
  template: `
    @if (store.capacityResult()) {
      @if (ctx.structureLoading()) {
        <ipf-loading-state label="Loading network structure…" />
      } @else if (geometry(); as g) {
        <ipf-card>
          <h2>Flow map</h2>
          @if (g.tooBig) {
            <p class="muted">
              This network has {{ g.nodeCount }} nodes — too many to draw
              legibly. The tables in Summary and Bottlenecks carry the same
              information.
            </p>
          } @else {
            <div class="scroll">
              <svg
                [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Layered view of the network coloured by flow state"
              >
                @for (edge of g.edges; track edge.key) {
                  <line
                    [attr.x1]="edge.x1"
                    [attr.y1]="edge.y1"
                    [attr.x2]="edge.x2"
                    [attr.y2]="edge.y2"
                    [attr.class]="'edge ' + edge.kind"
                  />
                }
                @for (node of g.nodes; track node.id) {
                  <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'">
                    <circle r="11" [attr.class]="'node ' + node.role" />
                    <text class="label" dy="0.32em">{{ node.id }}</text>
                  </g>
                }
              </svg>
            </div>
            <div class="legend">
              <span><i class="sw src"></i> source</span>
              <span><i class="sw sink"></i> sink</span>
              <span><i class="sw spofn"></i> structural SPOF node</span>
              <span><i class="ln sat"></i> saturated edge (f* = c)</span>
              <span><i class="ln mc"></i> edge in every minimum cut</span>
            </div>
          }
        </ipf-card>
      } @else {
        <ipf-empty-state
          icon="visualization"
          title="Network structure unavailable"
          message="The layered view needs the network's topological layers. Open the Network page to compute them, then come back."
        />
      }
    } @else {
      <ipf-empty-state
        icon="visualization"
        title="No result yet"
        message="Run a flow analysis from Configure to see the network coloured by saturated edges, edges in every minimum cut and structural single points of failure."
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
      .scroll {
        overflow-x: auto;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
      }
      svg {
        display: block;
        width: 100%;
        min-width: 520px;
        max-height: 540px;
      }
      .edge {
        stroke: var(--colorNeutralStroke1);
        stroke-width: 1;
        opacity: 0.5;
      }
      .edge.saturated {
        stroke: var(--colorPaletteDarkOrangeForeground1, #bc4b09);
        stroke-width: 2;
        opacity: 0.9;
      }
      .edge.mincut {
        stroke: var(--colorPalettePurpleForeground2, #6b3fa0);
        stroke-width: 2;
        opacity: 0.9;
      }
      .node {
        fill: var(--colorNeutralForeground3);
        stroke: var(--colorNeutralBackground1);
        stroke-width: 1.5;
      }
      .node.source {
        fill: var(--colorPaletteGreenForeground1, #0e700e);
      }
      .node.sink {
        fill: var(--colorPaletteBlueForeground2, #0f6cbd);
      }
      .node.spof {
        fill: var(--colorPaletteRedForeground1, #b10e1c);
      }
      .label {
        fill: var(--colorNeutralBackground1);
        font-size: 9px;
        text-anchor: middle;
        font-weight: 600;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .sw {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .sw.src {
        background: var(--colorPaletteGreenForeground1, #0e700e);
      }
      .sw.sink {
        background: var(--colorPaletteBlueForeground2, #0f6cbd);
      }
      .sw.spofn {
        background: var(--colorPaletteRedForeground1, #b10e1c);
      }
      .ln {
        width: 16px;
        height: 0;
        border-top-width: 2px;
        border-top-style: solid;
        display: inline-block;
      }
      .ln.sat {
        border-top-color: var(--colorPaletteDarkOrangeForeground1, #bc4b09);
      }
      .ln.mc {
        border-top-color: var(--colorPalettePurpleForeground2, #6b3fa0);
      }
    `,
  ],
})
export class FlowVisualizationPage {
  protected readonly store = inject(FlowWorkbenchStore);
  protected readonly ctx = inject(NetworkContextService);

  constructor() {
    if (!this.ctx.structure() && this.ctx.context()) {
      this.ctx.loadStructure().subscribe({ error: () => undefined });
    }
  }

  protected readonly geometry = computed(() => {
    const structure = this.ctx.structure();
    const cr = this.store.capacityResult();
    if (!structure || !cr) return null;

    const nodeCount = structure.nodes.length;
    if (nodeCount > MAX_NODES) {
      return {
        tooBig: true,
        nodeCount,
        width: 0,
        height: 0,
        nodes: [] as PlacedNode[],
        edges: [] as PlacedEdge[],
      };
    }

    const saturated = new Set(cr.flow.saturated_edges.map((e) => edgeKey(e)));
    const minCut = new Set(
      cr.min_cut_analysis.edges_in_every_cut.map((e) => edgeKey(e)),
    );
    const spofNodes = new Set(cr.structure.spof_nodes);
    const sources = new Set(structure.source_nodes);
    const sinks = new Set(structure.sink_nodes);

    const layers = layersOf(structure);
    const pos = new Map<number, PlacedNode>();
    let maxRows = 0;

    layers.forEach((layer, col) => {
      maxRows = Math.max(maxRows, layer.length);
      layer.forEach((id, row) => {
        pos.set(id, {
          id,
          x: PAD + col * COL_GAP,
          y: PAD + row * ROW_GAP,
          role: spofNodes.has(id)
            ? 'spof'
            : sources.has(id)
              ? 'source'
              : sinks.has(id)
                ? 'sink'
                : 'regular',
        });
      });
    });

    const edges: PlacedEdge[] = [];
    for (const [u, v] of structure.edges) {
      const a = pos.get(u);
      const b = pos.get(v);
      if (!a || !b) continue;
      const key = edgeKey([u, v]);
      const kind: PlacedEdge['kind'] = minCut.has(key)
        ? 'mincut'
        : saturated.has(key)
          ? 'saturated'
          : 'regular';
      edges.push({ key, x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind });
    }

    return {
      tooBig: false,
      nodeCount,
      width: PAD * 2 + Math.max(layers.length - 1, 0) * COL_GAP,
      height: PAD * 2 + Math.max(maxRows - 1, 0) * ROW_GAP,
      nodes: [...pos.values()],
      edges,
    };
  });
}

function layersOf(structure: NetworkStructure): number[][] {
  if (structure.iteration_sets.length > 0) return structure.iteration_sets;
  return [structure.nodes];
}
