import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NetworkStructure } from '@inf-prop/shared/api-client';

interface Placed {
  id: number;
  x: number;
  y: number;
  role: 'source' | 'sink' | 'fork' | 'join' | 'regular';
}

/**
 * A dependency-light layered DAG rendering, laid out straight from the server's
 * `iteration_sets` (topological layers). Not an interactive graph editor — a
 * legible at-a-glance picture of structure and node roles. Feature tracks build
 * their own richer, result-coloured views.
 */
@Component({
  selector: 'ipf-layered-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <div class="wrap">
      <svg
        [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Layered view of the network"
      >
        @for (e of g.edges; track e.key) {
          <line
            [attr.x1]="e.x1"
            [attr.y1]="e.y1"
            [attr.x2]="e.x2"
            [attr.y2]="e.y2"
            class="edge"
          />
        }
        @for (n of g.nodes; track n.id) {
          <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'">
            <circle r="11" [attr.class]="'node ' + n.role" />
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
      .wrap {
        overflow-x: auto;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
      }
      svg {
        display: block;
        width: 100%;
        min-width: 480px;
        max-height: 460px;
      }
      .edge {
        stroke: var(--colorNeutralStroke1);
        stroke-width: 1;
        opacity: 0.55;
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
})
export class LayeredGraphComponent {
  readonly structure = input.required<NetworkStructure>();
  readonly maxNodes = input(160);

  protected readonly geometry = computed(() => {
    const s = this.structure();
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

    const layers =
      s.iteration_sets.length > 0
        ? s.iteration_sets
        : [s.nodes];

    const pos = new Map<number, Placed>();
    let maxRows = 0;
    layers.forEach((layer, col) => {
      maxRows = Math.max(maxRows, layer.length);
      layer.forEach((id, row) => {
        pos.set(id, {
          id,
          role: roleOf(id),
          x: pad + col * colGap,
          y: pad + row * rowGap,
        });
      });
    });

    const tooBig = pos.size > this.maxNodes();
    const nodes = tooBig ? [] : [...pos.values()];
    const edges = tooBig
      ? []
      : s.edges
          .map(([u, v]) => {
            const a = pos.get(u);
            const b = pos.get(v);
            if (!a || !b) return null;
            return { key: `${u}-${v}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

    return {
      width: pad * 2 + Math.max(layers.length - 1, 0) * colGap,
      height: pad * 2 + Math.max(maxRows - 1, 0) * rowGap,
      nodes,
      edges,
      tooBig,
    };
  });
}
