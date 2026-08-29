import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Belief per node');
    expect(text).toContain('Diamond structure');
  });
});
