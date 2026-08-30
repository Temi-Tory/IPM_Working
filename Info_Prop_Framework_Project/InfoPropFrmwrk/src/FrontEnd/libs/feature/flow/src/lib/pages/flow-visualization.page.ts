import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
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
const NODE_RADIUS = 11;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

/**
 * Visualization sub-view: the layered DAG, coloured by the solved flow state.
 * Pannable (drag, or native scrollbars) and zoomable (wheel, +/- buttons) —
 * no network is too big to draw, just too big to fit the viewport at 100%.
 */
@Component({
  selector: 'ipf-flow-visualization-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, EmptyStateComponent, LoadingStateComponent, DecimalPipe],
  template: `
    @if (store.capacityResult()) {
      @if (ctx.structureLoading()) {
        <ipf-loading-state label="Loading network structure…" />
      } @else if (geometry(); as g) {
        <ipf-card>
          <div class="head">
            <h2>Flow map</h2>
            <div class="toolbar">
              <span class="count">{{ g.nodes.length }} nodes · {{ g.edges.length }} edges</span>
              <div class="zoom-controls">
                <button type="button" (click)="zoomOut()" aria-label="Zoom out">
                  <span aria-hidden="true">−</span>
                </button>
                <span class="zoom-level">{{ zoom() * 100 | number: '1.0-0' }}%</span>
                <button type="button" (click)="zoomIn()" aria-label="Zoom in">
                  <span aria-hidden="true">+</span>
                </button>
                <button type="button" class="reset" (click)="zoomReset()">Reset</button>
              </div>
            </div>
          </div>
          <div
            class="wrap"
            #wrap
            [class.dragging]="dragging()"
            (wheel)="onWheel($event)"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event, wrap)"
            (pointerup)="onPointerUp($event)"
            (pointerleave)="onPointerUp($event)"
          >
            <svg
              [attr.width]="g.width * zoom()"
              [attr.height]="g.height * zoom()"
              [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
              role="img"
              aria-label="Layered view of the network coloured by flow state"
            >
              <defs>
                <marker
                  id="ipf-flow-arrow"
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" class="arrow-head" />
                </marker>
              </defs>
              @for (edge of g.edges; track edge.key) {
                <line
                  [attr.x1]="edge.x1"
                  [attr.y1]="edge.y1"
                  [attr.x2]="edge.x2"
                  [attr.y2]="edge.y2"
                  [attr.class]="'edge ' + edge.kind"
                  marker-end="url(#ipf-flow-arrow)"
                />
              }
              @for (node of g.nodes; track node.id) {
                <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'">
                  <circle [attr.r]="nodeRadius" [attr.class]="'node ' + node.role" />
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
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacingHorizontalM, 12px);
        flex-wrap: wrap;
        margin-bottom: 6px;
      }
      h2 {
        margin: 0;
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
      }
      .count {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .zoom-controls {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .zoom-controls button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        font: inherit;
        font-size: 14px;
        line-height: 1;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground2);
        cursor: pointer;
      }
      .zoom-controls button.reset {
        width: auto;
        padding: 0 8px;
        font-size: var(--fontSizeBase200, 12px);
      }
      .zoom-controls button:hover {
        border-color: var(--colorBrandStroke1);
        color: var(--colorBrandForeground1);
      }
      .zoom-level {
        min-width: 3.6ch;
        text-align: center;
        font-size: var(--fontSizeBase200, 12px);
        font-variant-numeric: tabular-nums;
        color: var(--colorNeutralForeground3);
      }
      .wrap {
        overflow: auto;
        height: 460px;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        cursor: grab;
        touch-action: none;
      }
      .wrap.dragging {
        cursor: grabbing;
      }
      svg {
        display: block;
      }
      .edge {
        stroke: var(--colorNeutralForeground3);
        stroke-width: 1.25;
        opacity: 0.8;
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
      .arrow-head {
        fill: var(--colorNeutralForeground3);
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
  protected readonly nodeRadius = NODE_RADIUS;

  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  private dragStartX = 0;
  private dragStartY = 0;
  private dragPointerId: number | null = null;

  constructor() {
    if (!this.ctx.structure() && this.ctx.context()) {
      this.ctx.loadStructure().subscribe({ error: () => undefined });
    }
  }

  protected readonly geometry = computed(() => {
    const structure = this.ctx.structure();
    const cr = this.store.capacityResult();
    if (!structure || !cr) return null;

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

    // trim the end short of the target node's boundary so the arrowhead
    // lands on the circle's edge, not buried under its fill
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
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ex = b.x - (dx / len) * NODE_RADIUS;
      const ey = b.y - (dy / len) * NODE_RADIUS;
      edges.push({ key, x1: a.x, y1: a.y, x2: ex, y2: ey, kind });
    }

    return {
      width: PAD * 2 + Math.max(layers.length - 1, 0) * COL_GAP,
      height: PAD * 2 + Math.max(maxRows - 1, 0) * ROW_GAP,
      nodes: [...pos.values()],
      edges,
    };
  });

  protected zoomIn(): void {
    this.zoom.update((z) => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(3)));
  }

  protected zoomOut(): void {
    this.zoom.update((z) => Math.max(MIN_ZOOM, +(z / 1.25).toFixed(3)));
  }

  protected zoomReset(): void {
    this.zoom.set(1);
  }

  protected onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const factor = ev.deltaY > 0 ? 0.9 : 1.1;
    this.zoom.update((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z * factor).toFixed(3))));
  }

  protected onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    this.dragging.set(true);
    this.dragPointerId = ev.pointerId;
    this.dragStartX = ev.clientX;
    this.dragStartY = ev.clientY;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  }

  protected onPointerMove(ev: PointerEvent, wrap: HTMLElement): void {
    if (!this.dragging() || ev.pointerId !== this.dragPointerId) return;
    wrap.scrollLeft -= ev.clientX - this.dragStartX;
    wrap.scrollTop -= ev.clientY - this.dragStartY;
    this.dragStartX = ev.clientX;
    this.dragStartY = ev.clientY;
  }

  protected onPointerUp(ev: PointerEvent): void {
    this.dragging.set(false);
    this.dragPointerId = null;
    if ((ev.currentTarget as HTMLElement).hasPointerCapture?.(ev.pointerId)) {
      (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
    }
  }
}

function layersOf(structure: NetworkStructure): number[][] {
  if (structure.iteration_sets.length > 0) return structure.iteration_sets;
  return [structure.nodes];
}
