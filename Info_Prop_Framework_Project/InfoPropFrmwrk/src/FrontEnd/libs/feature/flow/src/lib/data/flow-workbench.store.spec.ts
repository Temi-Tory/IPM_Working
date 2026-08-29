import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  FlowAnalysisResponse,
  NetworkStructure,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  ScenarioCacheService,
} from '@inf-prop/shared/data-access';
import { FlowWorkbenchStore } from './flow-workbench.store';

const FLOW_URL = 'http://localhost:8080/flow-analysis';

function response(): FlowAnalysisResponse {
  return {
    success: true,
    message: 'ok',
    endpoint: 'flow-analysis',
    timestamp: '2026-08-29T12:00:00',
    input: {
      edges_file_path: 'net/net.EDGES',
      capacities_path: 'net/case-a/net-capacities.json',
      capacity_schema: 'toolkit-edges-array',
      source_nodes: [1],
      sink_nodes: [4],
      target_nodes_from_file: [],
      source_rates_from_file: [],
    },
    computation_time: 0.5,
    capacity_result: {
      metadata: { algorithm: 'dinic', tol: 1e-10, baseline_max_flow: 10 },
      flow: {
        max_flow: 10,
        is_unbounded: false,
        mincut_capacity: 10,
        sink_flow: [[4, 10]],
        saturated_edges: [
          [1, 2],
          [3, 4],
        ],
        mincut_S: [1],
        mincut_T: [4],
      },
      sensitivity: { critical_edges: [], marginal_capacity: [], birnbaum: [] },
      failure_impact: {
        min_cut_edges: [],
        single_edge_failures: [],
        k_edge_failures: [],
        degradation_results: [],
      },
      structure: {
        spof_edges: [[3, 4]],
        spof_nodes: [3],
        paths_count: 2,
        paths: [],
        edge_redundancy: [],
        bottleneck_ranking: [],
        node_positions: {},
      },
      flow_decomposition: { total_flow: 10, is_unique: true, components: [] },
      parametric_thresholds: {
        baseline_flow: 10,
        target_flow: null,
        degradation_thresholds: [],
      },
      min_cut_analysis: {
        max_flow: 10,
        min_cut_capacity: 7,
        representative_cut: { S: [1], T: [4], crossing_edges: [], capacity: 7 },
        edges_in_some_cut: [],
        edges_in_every_cut: [[3, 4]],
        enumeration: {
          total_cuts: 1,
          is_complete: true,
          free_zone_size: 0,
          cuts: [],
        },
      },
      global_connectivity: {
        edge_connectivity: {
          lambda: 1,
          achieving_source: 1,
          achieving_sink: 4,
          min_cut_edges: [],
          solver_calls: 1,
        },
        node_connectivity: {
          kappa: 1,
          achieving_source: 1,
          achieving_sink: 4,
          min_cut_nodes: [],
          solver_calls: 1,
        },
        global_min_cut: {
          min_cut_capacity: 7,
          achieving_source: 1,
          achieving_sink: 4,
          min_cut_edges: [],
          cut_S: [1],
          cut_T: [4],
          solver_calls: 1,
        },
      },
      node_capacitated: null,
    },
  };
}

class FakeNetworkContextService {
  context() {
    return {
      sessionId: 's1',
      networkPath: 'temp_uploads/x/net',
      networkName: 'net',
      edgesFilePath: 'net.EDGES',
    };
  }
  structure(): NetworkStructure | null {
    return null;
  }
  scenariosFor() {
    return [
      {
        scenario: { name: 'case-a', analyses: [] },
        analysis: {
          kind: 'flow' as const,
          valueType: 'float64' as const,
          complete: true,
          paths: { capacities: 'case-a/net-capacities.json' },
          files: [],
        },
      },
      {
        scenario: { name: 'case-b', analyses: [] },
        analysis: {
          kind: 'flow' as const,
          valueType: 'float64' as const,
          complete: true,
          paths: { capacities: 'case-b/net-capacities.json' },
          files: [],
        },
      },
    ];
  }
}

describe('FlowWorkbenchStore', () => {
  let store: FlowWorkbenchStore;
  let httpMock: HttpTestingController;
  let cache: ScenarioCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NetworkContextService, useClass: FakeNetworkContextService },
      ],
    });
    store = TestBed.inject(FlowWorkbenchStore);
    httpMock = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(ScenarioCacheService);
    cache.clear();
  });

  afterEach(() => httpMock.verify());

  it('derives the capacities scenarios from the loaded network', () => {
    expect(store.scenarios().map((s) => s.id)).toEqual(['case-a', 'case-b']);
    expect(store.selectedScenario()?.id).toBe('case-a');
    expect(store.canRun()).toBe(true);
  });

  it('sends the selected scenario to /flow-analysis and records the run', () => {
    store.select('case-b');
    store.run();

    const req = httpMock.expectOne(FLOW_URL);
    const body = req.request.body as {
      capacitiesPath: string;
      analysisOptions: { algorithm: string };
    };
    expect(body.capacitiesPath).toBe('case-b/net-capacities.json');
    expect(body.analysisOptions.algorithm).toBe('dinic');
    req.flush(response());

    expect(store.runState()).toBe('success');
    expect(store.capacityResult()?.flow.max_flow).toBe(10);

    const runs = cache.runsForToolkit('flow');
    expect(runs).toHaveLength(1);
    expect(runs[0].scenarioName).toBe('case-b');
    expect(runs[0].valueType).toBe('float64');
    const throughput = runs[0].metrics.find(
      (m) => m.label === 'Maximum throughput',
    );
    expect(throughput?.value).toBe(10);
    const minCut = runs[0].metrics.find(
      (m) => m.label === 'Minimum-cut capacity',
    );
    expect(minCut?.value).toBe(7);
  });

  it('surfaces a server error without recording a run', () => {
    store.run();
    httpMock
      .expectOne(FLOW_URL)
      .flush(
        { success: false, message: 'bad capacities file' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.runState()).toBe('error');
    expect(store.error()).toContain('bad capacities file');
    expect(cache.runsForToolkit('flow')).toHaveLength(0);
  });
});
