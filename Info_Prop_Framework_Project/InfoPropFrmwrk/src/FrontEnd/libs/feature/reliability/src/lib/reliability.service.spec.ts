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
      'Mean belief',
      'Min belief',
      'Max belief',
      'Nodes analysed',
    ]);
    expect(run.overlays?.[0].focus).toBe('diamond-fixed-nodes');
    expect(run.overlays?.[0].label).toBe('Diamond fixed nodes');
    expect(run.overlays?.[0].nodeIds).toEqual([2]);
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
