import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  NetworkContextService,
  ScenarioCacheService,
  ScenarioRun,
} from '@inf-prop/shared/data-access';
import { FeatureSystemProfile } from './feature-system-profile';

const NETWORK_PATH = '/tmp/uploads/abc/KarlNetwork';

function flowRun(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    id: 'flow:' + NETWORK_PATH + ':default:float64',
    networkPath: NETWORK_PATH,
    networkName: 'KarlNetwork',
    toolkit: 'flow',
    scenarioName: 'default',
    valueType: 'float64',
    ranAt: Date.now(),
    computationTimeMs: 1200,
    inputFiles: { capacities: 'KarlNetwork-capacities.json' },
    metrics: [
      { label: 'Max flow', value: 42, unit: 'units', direction: 'higher-better' },
      { label: 'Min-cut capacity', value: 42, unit: 'units' },
    ],
    overlays: [
      {
        focus: 'saturated-edges',
        label: 'Saturated edges',
        edges: [
          [1, 2],
          [2, 4],
        ],
      },
      {
        focus: 'spof-nodes',
        label: 'Single points of failure',
        nodeIds: [2],
      },
    ],
    raw: { capacity_result: {} },
    ...overrides,
  };
}

describe('FeatureSystemProfile', () => {
  let fixture: ComponentFixture<FeatureSystemProfile>;
  let cache: ScenarioCacheService;
  let ctx: NetworkContextService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureSystemProfile],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    cache = TestBed.inject(ScenarioCacheService);
    ctx = TestBed.inject(NetworkContextService);
    cache.clear();
    ctx.setContext(null);
  });

  afterEach(() => {
    cache.clear();
    ctx.setContext(null);
  });

  async function render() {
    fixture = TestBed.createComponent(FeatureSystemProfile);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('creates', async () => {
    const el = await render();
    expect(el.querySelector('ipf-page-header')).toBeTruthy();
  });

  it('shows a real gated empty-state — not an error — before there are results to compare', async () => {
    ctx.setContext({
      sessionId: 's1',
      networkPath: NETWORK_PATH,
      networkName: 'KarlNetwork',
    });
    const el = await render();

    const empty = el.querySelector('ipf-empty-state');
    expect(empty).toBeTruthy();
    expect(el.textContent).toContain('No results to compare yet');
    // names the pipeline order and the three producing views
    expect(el.textContent).toContain('structure first, then analysis, then comparison');
    expect(el.textContent).toContain('Reliability');
    expect(el.textContent).toContain('Flow');
    expect(el.textContent).toContain('Schedule');
    // it is NOT rendering a comparison
    expect(el.querySelector('ipf-sp-metrics-comparison')).toBeNull();
  });

  it('sets cached scenario runs for the loaded network side by side', async () => {
    ctx.setContext({
      sessionId: 's1',
      networkPath: NETWORK_PATH,
      networkName: 'KarlNetwork',
    });
    cache.record(flowRun());
    const el = await render();

    expect(el.querySelector('ipf-empty-state')).toBeNull();
    expect(el.querySelector('ipf-sp-metrics-comparison')).toBeTruthy();
    expect(el.textContent).toContain('Max flow');
    expect(el.textContent).toContain('Scenarios side by side');
    // result sets come straight from the run's overlays
    expect(el.textContent).toContain('Saturated edges');
    expect(el.textContent).toContain('Single points of failure');
  });

  it('carries no client-side scoring / recommendation logic', () => {
    const proto = FeatureSystemProfile.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(proto['buildCapacityRecommendation']).toBeUndefined();
    expect(proto['capacityOptimizations']).toBeUndefined();
    expect(proto['generateHotspotAlerts']).toBeUndefined();
  });

  it('scopes to the active network and notes runs cached elsewhere', async () => {
    ctx.setContext({
      sessionId: 's1',
      networkPath: NETWORK_PATH,
      networkName: 'KarlNetwork',
    });
    cache.record(flowRun());
    cache.record(
      flowRun({
        id: 'flow:/other/Net:default:float64',
        networkPath: '/other/Net',
        networkName: 'OtherNet',
      }),
    );
    const el = await render();

    expect(el.textContent).toContain('other networks');
  });
});
