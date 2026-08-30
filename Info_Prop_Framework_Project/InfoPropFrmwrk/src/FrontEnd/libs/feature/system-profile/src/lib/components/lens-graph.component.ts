import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NetworkStructure } from '@inf-prop/shared/api-client';

interface PlacedNode {
  id: number;
  x: number;
  y: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  inPrimary: boolean;
  inCompare: boolean;
  selected: boolean;
}

interface PlacedEdge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  inPrimary: boolean;
  inCompare: boolean;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

/**
 * A dependency-light layered rendering of the unified graph object — the same
 * topology every toolkit reads, laid out along the iteration sets so
 * information flows down the page in the order the algorithms process it, with
 * the node roles (source, sink, fork, join) distinguished. Up to two analyses'
 * own result sets are shown on top at once — a primary set and an optional
 * "compare with" set — with nodes/edges in both drawn in a third, distinct
 * colour, so where two analyses agree is legible directly on the drawing
 * rather than by mentally overlaying two separate screenshots. It draws
 * results that exist; it computes nothing about them. Pannable (drag, or
 * native scrollbars) and zoomable (wheel, +/- buttons) — no network is too big
 * to draw, just too big to fit the viewport at 100%, same treatment as the
 * shared network graph and Flow's own.
 */
@Component({
  selector: 'ipf-sp-lens-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @let g = geometry();
    <div class="toolbar">
      <span class="count">{{ g.nodeTotal }} nodes · {{ g.edges.length }} edges</span>
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
        aria-label="Layered drawing of the network with the selected result set(s)"
      >
        @for (e of g.edges; track e.key) {
          <line
            [attr.x1]="e.x1"
            [attr.y1]="e.y1"
            [attr.x2]="e.x2"
            [attr.y2]="e.y2"
            [attr.class]="
              'edge' +
              (e.inPrimary && e.inCompare
                ? ' hl-both'
                : e.inPrimary
                  ? ' hl'
                  : e.inCompare
                    ? ' hl2'
                    : '') +
              (g.anyHighlight && !e.inPrimary && !e.inCompare ? ' dim' : '')
            "
          />
        }
        @for (n of g.nodes; track n.id) {
          <g
            [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
            class="node-g"
            (click)="nodeSelect.emit(n.id)"
            tabindex="0"
            (keydown.enter)="nodeSelect.emit(n.id)"
          >
            <circle
              [attr.r]="n.inPrimary || n.inCompare || n.selected ? 13 : 10"
              [attr.class]="
                'node ' +
                n.role +
                (n.inPrimary && n.inCompare
                  ? ' hl-both'
                  : n.inPrimary
                    ? ' hl'
                    : n.inCompare
                      ? ' hl2'
                      : '') +
                (n.selected ? ' sel' : '') +
                (g.anyHighlight && !n.inPrimary && !n.inCompare && !n.selected
                  ? ' dim'
                  : '')
              "
            />
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
        stroke: var(--colorNeutralStroke1);
        stroke-width: 1;
        opacity: 0.5;
      }
      .edge.hl {
        stroke: var(--colorBrandStroke1, #0f6cbd);
        stroke-width: 2.5;
        opacity: 1;
      }
      .edge.hl2 {
        stroke: var(--colorPaletteTealForeground2, #00695c);
        stroke-width: 2.5;
        opacity: 1;
      }
      .edge.hl-both {
        stroke: var(--colorPaletteRedForeground1, #b10e1c);
        stroke-width: 2.75;
        opacity: 1;
      }
      .edge.dim {
        opacity: 0.12;
      }
      .node-g {
        cursor: pointer;
        outline: none;
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
      .node.hl {
        fill: var(--colorBrandBackground, #0f6cbd);
        stroke: var(--colorBrandStroke1, #0f6cbd);
        stroke-width: 2;
      }
      .node.hl2 {
        fill: var(--colorPaletteTealForeground2, #00695c);
        stroke: var(--colorPaletteTealForeground2, #00695c);
        stroke-width: 2;
      }
      .node.hl-both {
        fill: var(--colorPaletteRedForeground1, #b10e1c);
        stroke: var(--colorPaletteRedForeground1, #b10e1c);
        stroke-width: 2;
      }
      .node.sel {
        stroke: var(--colorNeutralForeground1);
        stroke-width: 2.75;
      }
      .node.dim {
        opacity: 0.22;
      }
      .node-g:focus-visible .node {
        stroke: var(--colorStrokeFocus2, #000);
        stroke-width: 2.5;
      }
      .label {
        fill: var(--colorNeutralBackground1);
        font-size: 9px;
        text-anchor: middle;
        font-weight: 600;
        pointer-events: none;
      }
    `,
  ],
})
export class LensGraphComponent {
  readonly structure = input.required<NetworkStructure>();
  readonly highlightNodes = input<readonly number[]>([]);
  readonly highlightEdges = input<readonly (readonly [number, number])[]>([]);
  /** an optional second result set — "compare with" — drawn in its own
   *  colour, with nodes/edges the two sets share drawn in a third. */
  readonly compareNodes = input<readonly number[]>([]);
  readonly compareEdges = input<readonly (readonly [number, number])[]>([]);
  readonly selectedNode = input<number | null>(null);

  readonly nodeSelect = output<number>();

  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  private dragStartX = 0;
  private dragStartY = 0;
  private dragPointerId: number | null = null;

  protected readonly geometry = computed(() => {
    const s = this.structure();
    const hlNodes = new Set(this.highlightNodes());
    const hlEdges = new Set(
      this.highlightEdges().map(([u, v]) => `${u}->${v}`),
    );
    const cmpNodes = new Set(this.compareNodes());
    const cmpEdges = new Set(
      this.compareEdges().map(([u, v]) => `${u}->${v}`),
    );
    const selected = this.selectedNode();

    const colGap = 120;
    const rowGap = 42;
    const pad = 30;

    const roleOf = (id: number): PlacedNode['role'] => {
      if (s.source_nodes.includes(id)) return 'source';
      if (s.sink_nodes.includes(id)) return 'sink';
      if (s.join_nodes.includes(id)) return 'join';
      if (s.fork_nodes.includes(id)) return 'fork';
      return 'regular';
    };

    const layers =
      s.iteration_sets.length > 0 ? s.iteration_sets : [s.nodes];
    const nodeTotal = s.nodes.length;

    const pos = new Map<number, PlacedNode>();
    let maxRows = 0;
    layers.forEach((layer, col) => {
      maxRows = Math.max(maxRows, layer.length);
      layer.forEach((id, row) => {
        pos.set(id, {
          id,
          role: roleOf(id),
          x: pad + col * colGap,
          y: pad + row * rowGap,
          inPrimary: hlNodes.has(id),
          inCompare: cmpNodes.has(id),
          selected: selected === id,
        });
      });
    });

    const nodes = [...pos.values()];
    const edges: PlacedEdge[] = s.edges
      .map(([u, v]): PlacedEdge | null => {
        const a = pos.get(u);
        const b = pos.get(v);
        if (!a || !b) return null;
        const key = `${u}->${v}`;
        return {
          key,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          inPrimary:
            hlEdges.has(key) ||
            (hlNodes.size > 0 && hlNodes.has(u) && hlNodes.has(v)),
          inCompare:
            cmpEdges.has(key) ||
            (cmpNodes.size > 0 && cmpNodes.has(u) && cmpNodes.has(v)),
        };
      })
      .filter((e): e is PlacedEdge => e !== null);

    return {
      width: pad * 2 + Math.max(layers.length - 1, 0) * colGap,
      height: pad * 2 + Math.max(maxRows - 1, 0) * rowGap,
      nodes,
      edges,
      nodeTotal,
      anyHighlight:
        hlNodes.size > 0 ||
        hlEdges.size > 0 ||
        cmpNodes.size > 0 ||
        cmpEdges.size > 0,
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
