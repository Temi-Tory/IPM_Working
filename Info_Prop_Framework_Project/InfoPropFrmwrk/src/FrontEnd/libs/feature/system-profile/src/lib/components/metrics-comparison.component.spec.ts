import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { MetricsComparisonComponent } from './metrics-comparison.component';

function run(
  id: string,
  metrics: ScenarioRun['metrics'],
  scenarioName = id,
  valueType: ScenarioRun['valueType'] = 'interval',
): ScenarioRun {
  return {
    id,
    networkPath: '/n',
    networkName: 'N',
    toolkit: 'reliability',
    scenarioName,
    valueType,
    ranAt: 0,
    computationTimeMs: 10,
    inputFiles: {},
    metrics,
    raw: null,
  };
}

describe('MetricsComparisonComponent', () => {
  let fixture: ComponentFixture<MetricsComparisonComponent>;

  async function render(runs: ScenarioRun[]) {
    await TestBed.configureTestingModule({
      imports: [MetricsComparisonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MetricsComparisonComponent);
    fixture.componentRef.setInput('runs', runs);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an interval belief without flattening it to a midpoint', async () => {
    const el = await render([
      run('s1', [
        {
          label: 'Mean belief',
          value: { type: 'interval', lower: 0.4, upper: 0.9 },
          direction: 'higher-better',
        },
      ]),
    ]);
    expect(el.textContent).toContain('[0.4, 0.9]');
    expect(el.textContent).not.toContain('0.65');
  });

  it('lays many human-named scenarios of one toolkit side by side, value type disambiguated', async () => {
    const el = await render([
      run('a', [{ label: 'Mean belief', value: 0.8 }], 'Degraded', 'float64'),
      run('b', [{ label: 'Mean belief', value: 0.6 }], 'Degraded', 'interval'),
      run('c', [{ label: 'Mean belief', value: 0.9 }], '01 Source Limited', 'float64'),
    ]);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(el.textContent).toContain('Degraded');
    expect(el.textContent).toContain('01 Source Limited');
    // both value-type variants of "Degraded" are present and labelled
    expect(el.textContent).toContain('float64');
    expect(el.textContent).toContain('interval');
  });
});
