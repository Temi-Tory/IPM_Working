import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { NetworkStructure } from '@inf-prop/shared/api-client';

interface Placed {
  id: number;
  x: number;
  y: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  highlighted: boolean;
}

const NODE_RADIUS = 11;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

/** One optional accent ring over a set of nodes — e.g. "these are diamond fixed
 *  nodes". A single highlight set, not a value-colour heatmap: colouring a
 *  continuous value on a graph is a real design decision (a colour scale, a
 *  legend, a domain) that belongs to whichever view owns that judgement, not to
 *  this shared renderer. */
export interface GraphHighlight {
  nodeIds: ReadonlyArray<number>;
  label: string;
}

/**
 * A dependency-light layered DAG rendering, laid out straight from the server's
 * `iteration_sets` (topological layers). Not an interactive graph editor, but
 * pannable and zoomable — drag or scroll to move, wheel or the +/- buttons to
 * zoom — so a network of any size stays navigable rather than being squeezed
 * into a fixed viewport until it's illegible. Shared so every view that needs
 * "draw this network" (the network overview, a toolkit's own visualisation, a
 * cross-scenario lens) draws it the same way once, instead of divergent
 * implementations.
 */
@Component({
  selector: 'ipf-network-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <div class="toolbar">
      <span class="count">{{ structure().total_nodes }} nodes · {{ structure().total_edges }} edges</span>
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
        [attr.aria-label]="ariaLabel()"
      >
        <defs>
          <marker
            id="ipf-graph-arrow"
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
        @for (e of g.edges; track e.key) {
          <line
            [attr.x1]="e.x1"
            [attr.y1]="e.y1"
            [attr.x2]="e.x2"
            [attr.y2]="e.y2"
            class="edge"
            marker-end="url(#ipf-graph-arrow)"
          />
        }
        @for (n of g.nodes; track n.id) {
          <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
            @if (n.highlighted) {
              <circle r="15.5" class="ring" />
            }
            <circle [attr.r]="nodeRadius" [attr.class]="'node ' + n.role" />
            <text class="label" dy="0.32em">{{ n.id }}</text>
          </g>
        }
      </svg>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacingHorizontalM, 12px);
        margin-bottom: 6px;
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
      .arrow-head {
        fill: var(--colorNeutralForeground3);
      }
      .ring {
        fill: none;
        stroke: var(--colorBrandStroke1);
        stroke-width: 2.5;
      }
      .node {
        stroke: var(--colorNeutralBackground1);
        stroke-width: 1.5;
        fill: var(--colorNeutralForeground3);
      }
      .node.source {
        fill: var(--colorPaletteGreenForeground1, #0e700e);
      }
      .node.sink {
        fill: var(--colorPaletteBlueForeground2, #0f6cbd);
      }
      .node.fork {
        fill: var(--colorPaletteDarkOrangeForeground1, #bc4b09);
      }
      .node.join {
        fill: var(--colorPalettePurpleForeground2, #6b3fa0);
      }
      .label {
        fill: var(--colorNeutralBackground1);
        font-size: 9px;
        text-anchor: middle;
        font-weight: 600;
      }
    `,
  ],
  imports: [DecimalPipe],
})
export class NetworkGraphComponent {
  readonly structure = input.required<NetworkStructure>();
  readonly highlight = input<GraphHighlight | null>(null);
  protected readonly nodeRadius = NODE_RADIUS;

  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  private dragStartX = 0;
  private dragStartY = 0;
  private dragPointerId: number | null = null;

  protected readonly ariaLabel = computed(() => {
    const h = this.highlight();
    return h
      ? `Layered view of the network, with ${h.label} highlighted`
      : 'Layered view of the network — edges point from cause to effect';
  });

  protected readonly geometry = computed(() => {
    const s = this.structure();
    const highlighted = new Set(this.highlight()?.nodeIds ?? []);
    const colGap = 110;
    const rowGap = 40;
    const pad = 28;

    const roleOf = (id: number): Placed['role'] => {
      if (s.source_nodes.includes(id)) return 'source';
      if (s.sink_nodes.includes(id)) return 'sink';
      if (s.join_nodes.includes(id)) return 'join';
      if (s.fork_nodes.includes(id)) return 'fork';
      return 'regular';
    };

    const layers = s.iteration_sets.length > 0 ? s.iteration_sets : [s.nodes];

    const pos = new Map<number, Placed>();
    let maxRows = 0;
    layers.forEach((layer, col) => {
      maxRows = Math.max(maxRows, layer.length);
      layer.forEach((id, row) => {
        pos.set(id, {
          id,
          role: roleOf(id),
          highlighted: highlighted.has(id),
          x: pad + col * colGap,
          y: pad + row * rowGap,
        });
      });
    });

    const nodes = [...pos.values()];
    // trim the end short of the target node's boundary so the arrowhead lands
    // on the circle's edge, not buried under its fill
    const edges = s.edges
      .map(([u, v]) => {
        const a = pos.get(u);
        const b = pos.get(v);
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ex = b.x - (dx / len) * NODE_RADIUS;
        const ey = b.y - (dy / len) * NODE_RADIUS;
        return { key: `${u}-${v}`, x1: a.x, y1: a.y, x2: ex, y2: ey };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return {
      width: pad * 2 + Math.max(layers.length - 1, 0) * colGap,
      height: pad * 2 + Math.max(maxRows - 1, 0) * rowGap,
      nodes,
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
    // left button / primary touch only
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
