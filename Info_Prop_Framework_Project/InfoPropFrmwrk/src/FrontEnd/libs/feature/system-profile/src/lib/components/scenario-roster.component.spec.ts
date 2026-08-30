import { TestBed } from '@angular/core/testing';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { ScenarioRosterComponent } from './scenario-roster.component';

function run(partial: Partial<ScenarioRun>): ScenarioRun {
  return {
    id: partial.id ?? 'x',
    networkPath: '/n',
    networkName: 'N',
    toolkit: partial.toolkit ?? 'flow',
    scenarioName: partial.scenarioName ?? 'default',
    valueType: partial.valueType ?? 'float64',
    ranAt: partial.ranAt ?? 0,
    computationTimeMs: 0,
    inputFiles: {},
    metrics: [],
    raw: null,
  };
}

describe('ScenarioRosterComponent', () => {
  function make(runs: ScenarioRun[]) {
    const fixture = TestBed.createComponent(ScenarioRosterComponent);
    fixture.componentRef.setInput('runs', runs);
    fixture.detectChanges();
    return fixture;
  }

  it('lists one row per distinct scenario name, sorted', () => {
    const f = make([
      run({ scenarioName: 'Nominal', toolkit: 'flow' }),
      run({ scenarioName: 'Degraded', toolkit: 'flow' }),
      run({ scenarioName: 'Degraded', toolkit: 'reliability' }),
    ]);
    const el = f.nativeElement as HTMLElement;
    const rowHeads = Array.from(el.querySelectorAll('tbody th')).map(
      (n) => n.textContent?.trim(),
    );
    expect(rowHeads).toEqual(['Degraded', 'Nominal']);
  });

  it('marks a toolkit run with its value form, and leaves an unrun toolkit blank', () => {
    const f = make([
      run({ scenarioName: 'Degraded', toolkit: 'flow', valueType: 'float64' }),
      run({ scenarioName: 'Degraded', toolkit: 'reliability', valueType: 'interval' }),
    ]);
    const el = f.nativeElement as HTMLElement;
    const cells = Array.from(el.querySelectorAll('tbody td'));
    // Reliability, Flow, Schedule column order
    expect(cells[0].textContent).toContain('interval');
    expect(cells[1].textContent).toContain('deterministic');
    expect(cells[2].querySelector('.not-run')).toBeTruthy();
  });

  it('renders no rows when there are no runs', () => {
    const f = make([]);
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(0);
  });
});
