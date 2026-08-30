import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  NetworkContextService,
  ScenarioCacheService,
} from '@inf-prop/shared/data-access';
import { FeatureReliability } from './feature-reliability';
import { ReliabilityService } from '../reliability.service';
import { mockFloatResponse } from '../reliability.mocks';

describe('FeatureReliability', () => {
  let fixture: ComponentFixture<FeatureReliability>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureReliability],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeatureReliability);
    await fixture.whenStable();
  });

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the empty state when the loaded network has no reliability inputs', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No reliability inputs on this network');
  });

  it('lists a discovered scenario and rehydrates a cached run', () => {
    const ctx = TestBed.inject(NetworkContextService);
    const cache = TestBed.inject(ScenarioCacheService);
    ctx.setContext({
      sessionId: 's1',
      networkPath: 'temp_uploads/abc/KarlNetwork',
      networkName: 'KarlNetwork',
      edgesFilePath: 'KarlNetwork.EDGES',
    });
    ctx.setUploadFromPaths('KarlNetwork', [
      'KarlNetwork/KarlNetwork.EDGES',
      'KarlNetwork/float/KarlNetwork-nodepriors.json',
      'KarlNetwork/float/KarlNetwork-linkprobabilities.json',
    ]);
    cache.record({
      id: 'reliability:temp_uploads/abc/KarlNetwork:float:float64',
      networkPath: 'temp_uploads/abc/KarlNetwork',
      networkName: 'KarlNetwork',
      toolkit: 'reliability',
      scenarioName: 'float',
      valueType: 'float64',
      ranAt: Date.now(),
      computationTimeMs: 12,
      inputFiles: {},
      metrics: [],
      raw: mockFloatResponse(),
    });

    const svc = TestBed.inject(ReliabilityService);
    expect(svc.scenarios().map((s) => s.name)).toEqual(['float']);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Belief tab is the default
    expect(el.textContent).toContain('Belief per node');

    // Diamond structure lives on its own tab, reachable without re-running
    const diamondsTab = el.querySelector<HTMLButtonElement>('#tab-diamonds');
    diamondsTab?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Diamond structure');
  });

  it('runs every pending scenario chained on "Run all", then compares them', () => {
    const http = TestBed.inject(HttpTestingController);
    const ctx = TestBed.inject(NetworkContextService);
    ctx.setContext({
      sessionId: 's1',
      networkPath: 'temp_uploads/abc/KarlNetwork',
      networkName: 'KarlNetwork',
      edgesFilePath: 'KarlNetwork.EDGES',
    });
    ctx.setUploadFromPaths('KarlNetwork', [
      'KarlNetwork/KarlNetwork.EDGES',
      'KarlNetwork/float/KarlNetwork-nodepriors.json',
      'KarlNetwork/float/KarlNetwork-linkprobabilities.json',
      'KarlNetwork/Degraded/KarlNetwork-nodepriors.json',
      'KarlNetwork/Degraded/KarlNetwork-linkprobabilities.json',
    ]);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('#tab-compare')?.click();
    fixture.detectChanges();

    const runAllBtn = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Run selected'),
    ) as HTMLButtonElement | undefined;
    expect(runAllBtn).toBeTruthy();
    runAllBtn?.click();
    fixture.detectChanges();

    // chained, not parallel: one request at a time
    http
      .expectOne('http://localhost:8080/probability-propagation')
      .flush(mockFloatResponse());
    fixture.detectChanges();
    http
      .expectOne('http://localhost:8080/probability-propagation')
      .flush(mockFloatResponse());
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Running');
    expect(el.textContent).toContain('float');
    expect(el.textContent).toContain('Degraded');

    const cache = TestBed.inject(ScenarioCacheService);
    expect(cache.runsForToolkit('reliability').map((r) => r.scenarioName).sort()).toEqual(
      ['Degraded', 'float'],
    );
  });
});
