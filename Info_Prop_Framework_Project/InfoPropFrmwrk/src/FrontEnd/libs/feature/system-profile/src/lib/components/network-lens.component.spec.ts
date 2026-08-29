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

function run(): ScenarioRun {
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

describe('NetworkLensComponent', () => {
  let fixture: ComponentFixture<NetworkLensComponent>;

  async function render(selectedKey: string | null) {
    await TestBed.configureTestingModule({
      imports: [NetworkLensComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(NetworkLensComponent);
    fixture.componentRef.setInput('runs', [run()]);
    fixture.componentRef.setInput('structure', STRUCTURE);
    fixture.componentRef.setInput('selectedKey', selectedKey);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('prompts for a result set when none is chosen', async () => {
    const el = await render(null);
    expect(el.textContent).toContain('Choose a result set');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('shows the chosen analysis result set on the network drawing', async () => {
    const el = await render(
      overlayKey(run(), run().overlays![0]),
    );
    expect(el.querySelector('ipf-sp-lens-graph')).toBeTruthy();
    expect(el.querySelector('svg')).toBeTruthy();
    // one highlighted node (node 2)
    expect(el.querySelectorAll('circle.node.hl').length).toBe(1);
    expect(el.textContent).toContain('Single points of failure');
    expect(el.textContent).toContain('from the Degraded scenario');
  });

  it('shows a node\'s overlay value in its form when the node is clicked', async () => {
    const el = await render(overlayKey(run(), run().overlays![0]));
    const groups = Array.from(el.querySelectorAll('.node-g'));
    const hlGroup = groups.find((g) => g.querySelector('circle.node.hl'));
    hlGroup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    // interval kept as a bound pair, not midpointed
    expect(el.textContent).toContain('[0.1, 0.3]');
  });
});
