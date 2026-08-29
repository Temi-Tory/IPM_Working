import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CriticalPathRequest } from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  ScenarioCacheService,
} from '@inf-prop/shared/data-access';
import {
  floatLongestPassMock,
  intervalConservativePassMock,
  responseWith,
} from '../data-access/mock-responses';
import { FeatureSchedule } from './feature-schedule';

interface Setup {
  fixture: ComponentFixture<FeatureSchedule>;
  ctx: NetworkContextService;
  http: HttpTestingController;
  cache: ScenarioCacheService;
  text: () => string;
}

async function setup(opts?: {
  loaded?: boolean;
  withSchedule?: boolean;
}): Promise<Setup> {
  await TestBed.configureTestingModule({
    imports: [FeatureSchedule],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  }).compileComponents();

  const ctx = TestBed.inject(NetworkContextService);
  if (opts?.loaded) {
    ctx.setContext({
      sessionId: 's1',
      networkPath: 'KarlNetwork',
      networkName: 'KarlNetwork',
      edgesFilePath: 'KarlNetwork.EDGES',
    });
  }
  if (opts?.withSchedule) {
    ctx.setUploadFromPaths('KarlNetwork', [
      'KarlNetwork/cpm/KarlNetwork-cpm-inputs.json',
    ]);
  }

  const fixture = TestBed.createComponent(FeatureSchedule);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    fixture,
    ctx,
    http: TestBed.inject(HttpTestingController),
    cache: TestBed.inject(ScenarioCacheService),
    text: () => fixture.nativeElement.textContent ?? '',
  };
}

describe('FeatureSchedule', () => {
  it('creates and prompts to upload when no network is loaded', async () => {
    const { fixture, text } = await setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(text()).toContain('No network loaded');
  });

  it('explains the gap when the network has no CPM inputs file', async () => {
    const { text } = await setup({ loaded: true });
    expect(text()).toContain('No CPM inputs file');
  });

  it('offers exactly Float64 and Interval in the value-type selector', async () => {
    const { fixture } = await setup({ loaded: true, withSchedule: true });
    const selector = fixture.nativeElement.querySelector(
      'ipf-value-type-selector',
    );
    expect(selector).toBeTruthy();
    const labels = Array.from(
      selector.querySelectorAll('.opt .label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['Deterministic', 'Interval', 'Probability box']);
    // p-box is shown but disabled
    const pbox = Array.from(selector.querySelectorAll('.opt')).find((o) =>
      (o as HTMLElement).textContent?.includes('Probability box'),
    ) as HTMLElement;
    expect(pbox.classList.contains('disabled')).toBe(true);
  });

  it('runs the analysis against the picked scenario and records the run', async () => {
    const { fixture, http, cache, text } = await setup({
      loaded: true,
      withSchedule: true,
    });

    expect(fixture.nativeElement.querySelector('#cpm-scenario')).toBeTruthy();

    fixture.nativeElement.querySelector('button.run').click();
    fixture.detectChanges();

    const req = http.expectOne(
      'http://localhost:8080/critical-path-analysis',
    );
    const body = req.request.body as CriticalPathRequest;
    expect(body.networkPath).toBe('KarlNetwork');
    expect(body.cpmPath).toBe('cpm/KarlNetwork-cpm-inputs.json');
    req.flush(responseWith(floatLongestPassMock, floatLongestPassMock));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Critical path');
    expect(text()).toContain('Cost'); // both tabs available

    const runs = cache.runs();
    expect(runs).toHaveLength(1);
    expect(runs[0].toolkit).toBe('schedule');
    expect(runs[0].scenarioName).toBe('cpm');
    expect(runs[0].valueType).toBe('float64');
    expect(runs[0].metrics.map((m) => m.label)).toContain(
      'Critical path length',
    );
    http.verify();
  });

  it('notes when the file resolved to a different value type than pre-selected', async () => {
    const { fixture, http, text } = await setup({
      loaded: true,
      withSchedule: true,
    });

    fixture.nativeElement.querySelector('button.run').click();
    fixture.detectChanges();

    http
      .expectOne('http://localhost:8080/critical-path-analysis')
      .flush(responseWith(intervalConservativePassMock));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('resolved to Interval');
    http.verify();
  });
});
