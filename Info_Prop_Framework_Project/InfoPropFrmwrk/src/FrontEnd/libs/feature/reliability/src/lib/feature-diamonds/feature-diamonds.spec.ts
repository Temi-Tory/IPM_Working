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
import { FeatureDiamonds } from './feature-diamonds';
import { mockFloatResponse } from '../reliability.mocks';

describe('FeatureDiamonds', () => {
  let fixture: ComponentFixture<FeatureDiamonds>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureDiamonds],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeatureDiamonds);
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

  it('rehydrates a cached full reliability run instead of asking to re-identify', () => {
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

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Already has a full run recorded — diamond structure shows immediately,
    // no network call, and the "from a full run" hint is shown rather than
    // "no decomposition recorded".
    expect(el.textContent).toContain('full reliability run already');
    expect(el.textContent).toContain('Diamond');
    expect(
      el.querySelector<HTMLButtonElement>('.run-row button.primary')
        ?.textContent,
    ).toContain('Re-identify diamonds');
  });

  it('identifies diamonds on demand for a scenario with no prior run', () => {
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
    ]);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No decomposition recorded yet');

    const runBtn = el.querySelector<HTMLButtonElement>(
      '.run-row button.primary',
    );
    expect(runBtn?.textContent).toContain('Identify diamonds');
    runBtn?.click();
    fixture.detectChanges();

    const req = http.expectOne('http://localhost:8080/probability-propagation');
    expect(req.request.body.includeExactInference).toBe(false);
    // A real identify-only response has no `exact_inference` (the server
    // only computes belief when asked to) — model that here rather than
    // reusing the full-run mock, so `fromFullRun` reads correctly.
    const identifyOnly = mockFloatResponse();
    delete identifyOnly.probability_result.exact_inference;
    req.flush(identifyOnly);
    fixture.detectChanges();

    expect(el.textContent).toContain('Decomposition only');
  });

  it('filters scenarios by value form', () => {
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
      'KarlNetwork/interval/KarlNetwork-nodepriors.json',
      'KarlNetwork/interval/KarlNetwork-linkprobabilities.json',
    ]);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const pills = [...el.querySelectorAll<HTMLButtonElement>('.pill')];
    const intervalPill = pills.find((b) => b.textContent?.includes('interval'));
    expect(intervalPill).toBeTruthy();
    intervalPill?.click();
    fixture.detectChanges();

    const cards = [...el.querySelectorAll('.scenario-card')];
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('interval');
  });
});
