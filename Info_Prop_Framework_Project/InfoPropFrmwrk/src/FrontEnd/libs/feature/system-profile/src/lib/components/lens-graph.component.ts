import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NetworkStructure } from '@inf-prop/shared/api-client';

interface PlacedNode {
  id: number;
  x: number;
  y: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  highlighted: boolean;
  selected: boolean;
}

interface PlacedEdge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlighted: boolean;
}

/**
 * A dependency-light layered rendering of the unified graph object — the same
 * topology every toolkit reads, laid out along the iteration sets so
 * information flows down the page in the order the algorithms process it, with
 * the node roles (source, sink, fork, join) distinguished. One analysis's own
 * result set is shown on top. It draws results that exist; it computes nothing
 * about them.
 */
@Component({
  selector: 'ipf-sp-lens-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    @if (g.tooBig) {
      <p class="note">
        This network has {{ g.nodeTotal }} nodes — too many to draw legibly
        here. Open the Network view for the full layered drawing.
      </p>
    } @else {
      <div class="wrap">
        <svg
          [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Layered drawing of the network with the selected result set"
        >
          @for (e of g.edges; track e.key) {
            <line
              [attr.x1]="e.x1"
              [attr.y1]="e.y1"
              [attr.x2]="e.x2"
              [attr.y2]="e.y2"
              [attr.class]="
                'edge' +
                (e.highlighted ? ' hl' : '') +
                (g.anyHighlight && !e.highlighted ? ' dim' : '')
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
                [attr.r]="n.highlighted || n.selected ? 13 : 10"
                [attr.class]="
                  'node ' +
                  n.role +
                  (n.highlighted ? ' hl' : '') +
                  (n.selected ? ' sel' : '') +
                  (g.anyHighlight && !n.highlighted && !n.selected ? ' dim' : '')
                "
              />
              <text class="label" dy="0.32em">{{ n.id }}</text>
            </g>
          }
        </svg>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .note {
        margin: 0;
        padding: var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .wrap {
        overflow-x: auto;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
      }
      svg {
        display: block;
        width: 100%;
        min-width: 520px;
        max-height: 520px;
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
      .node.sel {
        fill: var(--colorBrandForeground1, #0f6cbd);
        stroke: var(--colorNeutralForeground1);
        stroke-width: 2.5;
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
  readonly selectedNode = input<number | null>(null);
  readonly maxNodes = input(220);

  readonly nodeSelect = output<number>();

  protected readonly geometry = computed(() => {
    const s = this.structure();
    const hlNodes = new Set(this.highlightNodes());
    const hlEdges = new Set(
      this.highlightEdges().map(([u, v]) => `${u}->${v}`),
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
    const tooBig = nodeTotal > this.maxNodes();

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
          highlighted: hlNodes.has(id),
          selected: selected === id,
        });
      });
    });

    const nodes = tooBig ? [] : [...pos.values()];
    const edges: PlacedEdge[] = tooBig
      ? []
      : s.edges
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
              highlighted:
                hlEdges.has(key) ||
                (hlNodes.size > 0 && hlNodes.has(u) && hlNodes.has(v)),
            };
          })
          .filter((e): e is PlacedEdge => e !== null);

    return {
      width: pad * 2 + Math.max(layers.length - 1, 0) * colGap,
      height: pad * 2 + Math.max(maxRows - 1, 0) * rowGap,
      nodes,
      edges,
      tooBig,
      nodeTotal,
      anyHighlight: hlNodes.size > 0 || hlEdges.size > 0,
    };
  });
}
