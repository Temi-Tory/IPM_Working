import { TestBed } from '@angular/core/testing';
import { NetworkStructure } from '@inf-prop/shared/api-client';
import { LensGraphComponent } from './lens-graph.component';

function structureOf(nodeCount: number): NetworkStructure {
  const nodes = Array.from({ length: nodeCount }, (_, i) => i + 1);
  const edges: [number, number][] = [];
  for (let i = 1; i < nodeCount; i++) edges.push([i, i + 1]);
  return {
    computation_time: 0,
    total_nodes: nodeCount,
    total_edges: edges.length,
    nodes,
    edges,
    source_nodes: [1],
    sink_nodes: [nodeCount],
    fork_nodes: [],
    join_nodes: [],
    // one layer per node — a simple chain
    iteration_sets: nodes.map((n) => [n]),
    iteration_sets_count: nodeCount,
    ancestors: {},
    descendants: {},
    outgoing_index: {},
    incoming_index: {},
  };
}

describe('LensGraphComponent', () => {
  function make(nodeCount: number) {
    const fixture = TestBed.createComponent(LensGraphComponent);
    fixture.componentRef.setInput('structure', structureOf(nodeCount));
    fixture.detectChanges();
    return fixture;
  }

  function svgOf(fixture: { nativeElement: unknown }): SVGSVGElement {
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    if (!svg) throw new Error('expected an <svg> in the rendered output');
    return svg;
  }

  it('renders every node, however many there are — no legibility cutoff', () => {
    const f = make(300);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.node-g').length).toBe(300);
    expect(el.textContent).toContain('300 nodes');
    expect(el.textContent).not.toContain('too many');
  });

  it('zoom in/out/reset scale the rendered SVG size and clamp at the bounds', () => {
    const f = make(5);
    const cmp = f.componentInstance as unknown as {
      zoom: () => number;
      zoomIn: () => void;
      zoomOut: () => void;
      zoomReset: () => void;
    };
    expect(cmp.zoom()).toBe(1);

    cmp.zoomIn();
    f.detectChanges();
    expect(cmp.zoom()).toBeGreaterThan(1);
    const svg = svgOf(f);
    const widthAtZoomedIn = Number(svg.getAttribute('width'));

    cmp.zoomReset();
    f.detectChanges();
    expect(cmp.zoom()).toBe(1);
    expect(Number(svg.getAttribute('width'))).toBeLessThan(widthAtZoomedIn);

    // clamps rather than growing without bound
    for (let i = 0; i < 40; i++) cmp.zoomIn();
    f.detectChanges();
    expect(cmp.zoom()).toBeLessThanOrEqual(3);

    for (let i = 0; i < 80; i++) cmp.zoomOut();
    f.detectChanges();
    expect(cmp.zoom()).toBeGreaterThanOrEqual(0.1);
  });

  it('marks highlighted nodes/edges and dims the rest once a highlight set exists', () => {
    const f = make(4);
    f.componentRef.setInput('highlightNodes', [1, 2]);
    f.componentRef.setInput('highlightEdges', [[1, 2]]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.querySelectorAll('circle.node.hl').length).toBe(2);
    expect(el.querySelectorAll('circle.node.dim').length).toBe(2);
    expect(el.querySelectorAll('line.edge.hl').length).toBe(1);
    expect(el.querySelectorAll('line.edge.dim').length).toBe(2);
  });

  it('emits the clicked node id and marks it selected', () => {
    const f = make(3);
    f.componentRef.setInput('selectedNode', 2);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('circle.node.sel').length).toBe(1);

    let emitted: number | undefined;
    f.componentInstance.nodeSelect.subscribe((id: number) => (emitted = id));
    const groups = Array.from(el.querySelectorAll('.node-g'));
    groups[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(emitted).toBe(1);
  });

  it('has no highlight/dim classes when no result set is on the network', () => {
    const f = make(3);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.node.dim, .edge.dim').length).toBe(0);
  });
});
