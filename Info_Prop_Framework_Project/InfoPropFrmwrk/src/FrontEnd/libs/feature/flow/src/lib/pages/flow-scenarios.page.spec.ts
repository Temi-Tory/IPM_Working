import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FlowAnalysisResponse, NetworkStructure } from '@inf-prop/shared/api-client';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import { FlowScenariosPage } from './flow-scenarios.page';

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
        saturated_edges: [[1, 2]],
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
        spof_edges: [],
        spof_nodes: [],
        paths_count: 1,
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
        edges_in_every_cut: [],
        enumeration: { total_cuts: 1, is_complete: true, free_zone_size: 0, cuts: [] },
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

describe('FlowScenariosPage', () => {
  let fixture: ComponentFixture<FlowScenariosPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowScenariosPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NetworkContextService, useClass: FakeNetworkContextService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FlowScenariosPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('defaults to both scenarios checked and runs them chained on "Run selected"', () => {
    const el = fixture.nativeElement as HTMLElement;
    const boxes = [...el.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.checked)).toBe(true);

    const runBtn = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Run selected'),
    ) as HTMLButtonElement | undefined;
    expect(runBtn).toBeTruthy();
    runBtn?.click();
    fixture.detectChanges();

    http.expectOne(FLOW_URL).flush(response());
    fixture.detectChanges();
    http.expectOne(FLOW_URL).flush(response());
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Running');
    expect(el.textContent).toContain('case-a');
    expect(el.textContent).toContain('case-b');
  });

  it('unchecking a scenario drops it from the comparison and from "Run selected"', () => {
    const el = fixture.nativeElement as HTMLElement;
    const boxes = [...el.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    boxes[1].click();
    fixture.detectChanges();

    const runBtn = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Run selected'),
    ) as HTMLButtonElement;
    expect(runBtn.textContent).toContain('(1)');
  });
});
