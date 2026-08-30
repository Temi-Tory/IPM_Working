import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  NetworkContextService,
  ScenarioCacheService,
} from '@inf-prop/shared/data-access';
import { ReliabilityService } from './reliability.service';
import { ReliabilityScenarioRef } from './reliability.types';
import {
  MOCK_PARENT_LINKS,
  MOCK_PARENT_PRIORS,
  mockFloatResponse,
  mockIntervalResponse,
} from './reliability.mocks';

const scenario: ReliabilityScenarioRef = {
  name: 'float',
  hintValueType: 'float64',
  nodepriorsPath: 'float/KarlNetwork-nodepriors.json',
  linkprobsPath: 'float/KarlNetwork-linkprobabilities.json',
};

describe('ReliabilityService', () => {
  let svc: ReliabilityService;
  let http: HttpTestingController;
  let ctx: NetworkContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(ReliabilityService);
    http = TestBed.inject(HttpTestingController);
    ctx = TestBed.inject(NetworkContextService);
    ctx.setContext({
      sessionId: 's1',
      networkPath: 'temp_uploads/abc/KarlNetwork',
      networkName: 'KarlNetwork',
      edgesFilePath: 'KarlNetwork.EDGES',
    });
  });

  afterEach(() => http.verify());

  it('posts /probability-propagation with diamond identification on', () => {
    svc.run(scenario).subscribe();
    const req = http.expectOne(
      'http://localhost:8080/probability-propagation',
    );
    expect(req.request.body).toMatchObject({
      networkPath: 'temp_uploads/abc/KarlNetwork',
      nodepriorsPath: 'float/KarlNetwork-nodepriors.json',
      linkprobsPath: 'float/KarlNetwork-linkprobabilities.json',
      includeExactInference: true,
      includeDiamondAnalysis: true,
    });
    req.flush(mockFloatResponse());
  });

  it('records a run into the scenario cache with real metrics only', () => {
    const cache = TestBed.inject(ScenarioCacheService);
    svc.record(scenario, mockFloatResponse());
    const run = cache.runs()[0];
    expect(run.toolkit).toBe('reliability');
    expect(run.valueType).toBe('float64');
    expect(run.metrics.map((m) => m.label)).toEqual([
      'Nodes analysed',
      'Conditioning width',
      'Mean belief',
      'Mean belief at sinks',
      'Min belief',
      'Max belief',
      'Mean band width',
      'Max band width',
      'Computation time',
    ]);
    // sink node 5's belief is 0.7 on the float fixture
    const atSinks = run.metrics.find((m) => m.label === 'Mean belief at sinks');
    expect(atSinks?.value).toBeCloseTo(0.7, 10);
    // the maximal diamond's own conditioning set has one node ({2})
    expect(run.metrics.find((m) => m.label === 'Conditioning width')?.value).toBe(1);
    // float64 has no band at all
    expect(run.metrics.find((m) => m.label === 'Max band width')?.value).toBe(0);

    expect(run.overlays?.[0].focus).toBe('diamond-fixed-nodes');
    expect(run.overlays?.[0].label).toBe(
      'Conditioning set, union across 1 diamond (maximal + nested)',
    );
    expect(run.overlays?.[0].nodeIds).toEqual([2]);
  });

  it('reports a real band width for interval scenarios and omits sink belief when the network has no sinks', () => {
    const cache = TestBed.inject(ScenarioCacheService);
    const res = mockIntervalResponse();
    res.sink_nodes = [];
    svc.record(scenario, res);
    const run = cache.runs()[0];
    expect(run.metrics.find((m) => m.label === 'Mean belief at sinks')).toBeUndefined();
    const maxBand = run.metrics.find((m) => m.label === 'Max band width');
    // node 5's belief is [0.55, 0.8] on the interval fixture — the widest band
    expect(maxBand?.value).toBeCloseTo(0.25, 10);
  });

  it('identifies diamonds without belief propagation on', () => {
    svc.identifyDiamonds(scenario).subscribe();
    const req = http.expectOne(
      'http://localhost:8080/probability-propagation',
    );
    expect(req.request.body).toMatchObject({
      includeExactInference: false,
      includeDiamondAnalysis: true,
    });
    req.flush(mockFloatResponse());
  });

  it('promotes a diamond: fetches parent files then uploads three subgraph files', () => {
    svc
      .promoteDiamond({
        scenario,
        valueType: 'float64',
        edgelist: [
          [2, 3],
          [2, 4],
          [3, 5],
          [4, 5],
        ],
        relevantNodes: [2, 3, 4, 5],
        label: 'join-5',
      })
      .subscribe((res) => {
        expect(res.success).toBe(true);
      });

    http
      .expectOne(
        'http://localhost:8080/files/temp_uploads/abc/KarlNetwork/float/KarlNetwork-nodepriors.json',
      )
      .flush(MOCK_PARENT_PRIORS);
    http
      .expectOne(
        'http://localhost:8080/files/temp_uploads/abc/KarlNetwork/float/KarlNetwork-linkprobabilities.json',
      )
      .flush(MOCK_PARENT_LINKS);

    const uploadReq = http.expectOne('http://localhost:8080/upload');
    const uploaded = uploadReq.request.body as FormData;
    const names = uploaded
      .getAll('files')
      .map((f) => (f as File).name)
      .sort();
    expect(names).toEqual([
      'KarlNetwork-join-5/KarlNetwork-join-5.EDGES',
      'KarlNetwork-join-5/float/KarlNetwork-join-5-linkprobabilities.json',
      'KarlNetwork-join-5/float/KarlNetwork-join-5-nodepriors.json',
    ]);
    uploadReq.flush({
      success: true,
      message: 'ok',
      network_path: 'temp_uploads/def/KarlNetwork-join-5',
      network_name: 'KarlNetwork-join-5',
      upload_id: 'def',
      files_count: 3,
      uploaded_files: [],
      edges_files: ['KarlNetwork-join-5/KarlNetwork-join-5.EDGES'],
    });
  });
});
