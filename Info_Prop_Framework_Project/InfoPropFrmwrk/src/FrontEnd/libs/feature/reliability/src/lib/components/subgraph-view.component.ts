import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

interface PlacedNode {
  id: number;
  x: number;
  y: number;
  fixed: boolean;
  source: boolean;
  join: boolean;
}

/**
 * A small layered rendering of one diamond's subgraph, laid out straight from
 * its edge list (longest-path layering from the subgraph's own sources). Node
 * roles shown: fixed nodes (the set `C` the propagation conditions on), the
 * subgraph's local sources, and its diamond join. Not interactive — a legible
 * picture.
 */
@Component({
  selector: 'ipf-subgraph-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <div class="wrap">
      <svg
        [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Diamond subgraph"
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
            <circle
              r="12"
              class="node"
              [class.fixed]="n.fixed"
              [class.source]="n.source && !n.fixed"
              [class.join]="n.join && !n.fixed && !n.source"
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
      .wrap {
        overflow-x: auto;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
      }
      svg {
        display: block;
        width: 100%;
        min-width: 280px;
        max-height: 320px;
      }
      .edge {
        stroke: var(--colorNeutralStroke1);
        stroke-width: 1;
        opacity: 0.6;
      }
      .node {
        fill: var(--colorNeutralForeground3);
        stroke: var(--colorNeutralBackground1);
        stroke-width: 1.5;
      }
      .node.fixed {
        fill: var(--colorBrandBackground);
      }
      .node.source {
        fill: var(--colorPaletteGreenForeground1, #0e700e);
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
export class SubgraphViewComponent {
  readonly edgelist = input.required<[number, number][]>();
  readonly fixedNodes = input<number[]>([]);
  readonly sourceNodes = input<number[]>([]);
  readonly joinNodes = input<number[]>([]);

  protected readonly geometry = computed(() => {
    const edges = this.edgelist();
    const fixed = new Set(this.fixedNodes());
    const sources = new Set(this.sourceNodes());
    const joins = new Set(this.joinNodes());

    const nodeIds = new Set<number>();
    const incoming = new Map<number, number[]>();
    const outgoing = new Map<number, number[]>();
    const push = (map: Map<number, number[]>, key: number, value: number) => {
      const list = map.get(key);
      if (list) list.push(value);
      else map.set(key, [value]);
    };
    for (const [u, v] of edges) {
      nodeIds.add(u);
      nodeIds.add(v);
      push(outgoing, u, v);
      push(incoming, v, u);
    }

    // longest-path layering
    const layer = new Map<number, number>();
    const roots = [...nodeIds].filter((n) => (incoming.get(n) ?? []).length === 0);
    const queue: number[] = roots.length ? [...roots] : [...nodeIds];
    for (const r of queue) layer.set(r, 0);
    let guard = 0;
    const maxIters = nodeIds.size * nodeIds.size + 8;
    while (queue.length && guard++ < maxIters) {
      const n = queue.shift() as number;
      const nl = layer.get(n) ?? 0;
      for (const m of outgoing.get(n) ?? []) {
        if ((layer.get(m) ?? -1) < nl + 1) {
          layer.set(m, nl + 1);
          queue.push(m);
        }
      }
    }
    for (const n of nodeIds) if (!layer.has(n)) layer.set(n, 0);

    const colGap = 96;
    const rowGap = 46;
    const pad = 28;
    const byLayer = new Map<number, number[]>();
    for (const n of [...nodeIds].sort((a, b) => a - b)) {
      const l = layer.get(n) ?? 0;
      const list = byLayer.get(l);
      if (list) list.push(n);
      else byLayer.set(l, [n]);
    }

    const placed: PlacedNode[] = [];
    let maxRows = 0;
    let maxCol = 0;
    for (const [l, ids] of byLayer) {
      maxRows = Math.max(maxRows, ids.length);
      maxCol = Math.max(maxCol, l);
      ids.forEach((id, row) => {
        placed.push({
          id,
          x: pad + l * colGap,
          y: pad + row * rowGap,
          fixed: fixed.has(id),
          source: sources.has(id),
          join: joins.has(id),
        });
      });
    }

    const pos = new Map(placed.map((p) => [p.id, p]));
    const laidEdges = edges
      .map(([u, v], i) => {
        const a = pos.get(u);
        const b = pos.get(v);
        if (!a || !b) return null;
        return { key: `${u}-${v}-${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return {
      width: pad * 2 + maxCol * colGap,
      height: pad * 2 + Math.max(maxRows - 1, 0) * rowGap,
      nodes: placed,
      edges: laidEdges,
    };
  });
}
