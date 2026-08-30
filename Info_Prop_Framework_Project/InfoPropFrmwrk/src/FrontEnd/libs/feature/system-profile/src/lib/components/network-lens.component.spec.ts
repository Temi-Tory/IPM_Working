import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetworkStructure } from '@inf-prop/shared/api-client';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { NetworkLensComponent } from './network-lens.component';
import { overlayKey } from '../model/profile-view';

const STRUCTURE = {
  computation_time: 0,
  total_nodes: 4,
  total_edges: 4,
  nodes: [1, 2, 3, 4],
  edges: [
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
  ],
  source_nodes: [1],
  sink_nodes: [4],
  fork_nodes: [1],
  join_nodes: [4],
  iteration_sets: [[1], [2, 3], [4]],
  iteration_sets_count: 3,
  ancestors: {},
  descendants: {},
  outgoing_index: {},
  incoming_index: {},
} satisfies NetworkStructure;

function flowRun(): ScenarioRun {
  return {
    id: 'flow:/n:default:float64',
    networkPath: '/n',
    networkName: 'N',
    toolkit: 'flow',
    scenarioName: 'Degraded',
    valueType: 'float64',
    ranAt: 0,
    computationTimeMs: 5,
    inputFiles: {},
    metrics: [{ label: 'Max flow', value: 10 }],
    overlays: [
      {
        focus: 'spof',
        label: 'Single points of failure',
        nodeIds: [2],
        nodeValues: { '2': { type: 'interval', lower: 0.1, upper: 0.3 } },
      },
    ],
    raw: null,
  };
}

/** overlaps with `flowRun()`'s overlay at node 2, plus its own node 3 —
 *  gives a non-trivial "both / only A / only B" split to assert on. */
function reliabilityRun(): ScenarioRun {
  return {
    id: 'reliability:/n:default:float64',
    networkPath: '/n',
    networkName: 'N',
    toolkit: 'reliability',
    scenarioName: 'Degraded',
    valueType: 'float64',
    ranAt: 1,
    computationTimeMs: 5,
    inputFiles: {},
    metrics: [{ label: 'Mean belief', value: 0.8 }],
    overlays: [
      {
        focus: 'diamond-fixed-nodes',
        label: 'Conditioning set',
        nodeIds: [2, 3],
      },
    ],
    raw: null,
  };
}

describe('NetworkLensComponent', () => {
  let fixture: ComponentFixture<NetworkLensComponent>;

  async function render(runs: ScenarioRun[], selectedKey: string | null) {
    await TestBed.configureTestingModule({
      imports: [NetworkLensComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(NetworkLensComponent);
    fixture.componentRef.setInput('runs', runs);
    fixture.componentRef.setInput('structure', STRUCTURE);
    fixture.componentRef.setInput('selectedKey', selectedKey);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** finds the "compare with" select and fires it with the given value,
   *  throwing (rather than a non-null assertion) if the picker isn't there. */
  function chooseCompare(el: HTMLElement, value: string): void {
    const select = el.querySelector<HTMLSelectElement>('#sp-compare-with');
    if (!select) throw new Error('expected a "compare with" <select>');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('prompts for a result set when none is chosen', async () => {
    const el = await render([flowRun()], null);
    expect(el.textContent).toContain('Choose a result set');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('shows the chosen analysis result set on the network drawing', async () => {
    const r = flowRun();
    const [overlay] = r.overlays ?? [];
    const el = await render([r], overlayKey(r, overlay));
    expect(el.querySelector('ipf-sp-lens-graph')).toBeTruthy();
    expect(el.querySelector('svg')).toBeTruthy();
    // one highlighted node (node 2)
    expect(el.querySelectorAll('circle.node.hl').length).toBe(1);
    expect(el.textContent).toContain('Single points of failure');
    expect(el.textContent).toContain('from the Degraded scenario');
  });

  it('shows a node\'s overlay value in its form when the node is clicked', async () => {
    const r = flowRun();
    const [overlay] = r.overlays ?? [];
    const el = await render([r], overlayKey(r, overlay));
    const groups = Array.from(el.querySelectorAll('.node-g'));
    const hlGroup = groups.find((g) => g.querySelector('circle.node.hl'));
    hlGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    // interval kept as a bound pair, not midpointed
    expect(el.textContent).toContain('[0.1, 0.3]');
  });

  it('hides the "compare with" picker when there is only one result set', async () => {
    const r = flowRun();
    const [overlay] = r.overlays ?? [];
    const el = await render([r], overlayKey(r, overlay));
    expect(el.querySelector('#sp-compare-with')).toBeNull();
  });

  it('draws a second result set alongside the first and reports the overlap', async () => {
    const flow = flowRun();
    const reliability = reliabilityRun();
    const [flowOverlay] = flow.overlays ?? [];
    const [relOverlay] = reliability.overlays ?? [];
    const el = await render(
      [flow, reliability],
      overlayKey(flow, flowOverlay),
    );

    expect(el.querySelector('#sp-compare-with')).toBeTruthy();
    chooseCompare(el, overlayKey(reliability, relOverlay));

    // node 2 is in both sets, node 3 only in the compared (reliability) set
    expect(el.querySelectorAll('circle.node.hl-both').length).toBe(1);
    expect(el.querySelectorAll('circle.node.hl2').length).toBe(1);
    expect(el.textContent).toContain('1 in both');
    expect(el.textContent).toContain('0 only in Single points of failure');
    expect(el.textContent).toContain('1 only in Conditioning set');
  });

  it('drops the compared set if the primary selection moves onto it', async () => {
    const flow = flowRun();
    const reliability = reliabilityRun();
    const [flowOverlay] = flow.overlays ?? [];
    const [relOverlay] = reliability.overlays ?? [];
    const el = await render(
      [flow, reliability],
      overlayKey(flow, flowOverlay),
    );

    chooseCompare(el, overlayKey(reliability, relOverlay));
    expect(el.querySelectorAll('circle.node.hl2').length).toBeGreaterThan(0);

    // now the primary selection itself moves onto what was being compared —
    // the comparison is dropped rather than silently comparing a set with
    // itself, though the picker stays (flow's overlay is still a valid
    // "compare with" option, just reset to "none")
    fixture.componentRef.setInput(
      'selectedKey',
      overlayKey(reliability, relOverlay),
    );
    fixture.detectChanges();
    const selectAfter = el.querySelector<HTMLSelectElement>('#sp-compare-with');
    expect(selectAfter?.value).toBe('');
    expect(el.querySelectorAll('circle.node.hl2').length).toBe(0);
  });
});
