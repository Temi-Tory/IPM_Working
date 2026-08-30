import { TestBed } from '@angular/core/testing';
import { NetworkStructure } from '@inf-prop/shared/api-client';
import { NetworkGraphComponent } from './network-graph.component';

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

describe('NetworkGraphComponent', () => {
  function make(nodeCount: number) {
    const fixture = TestBed.createComponent(NetworkGraphComponent);
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
    expect(el.querySelectorAll('svg g').length).toBe(300);
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

  it('names the highlight in the aria-label when one is given', () => {
    const f = make(3);
    f.componentRef.setInput('highlight', {
      nodeIds: [2],
      label: 'conditioning set across 1 maximal diamond',
    });
    f.detectChanges();
    const svg = svgOf(f);
    expect(svg.getAttribute('aria-label')).toContain(
      'conditioning set across 1 maximal diamond',
    );
  });
});
