import { ScenarioRun } from '@inf-prop/shared/data-access';
import {
  collectOverlays,
  distinctScenarioNames,
  groupByToolkit,
  metricColumns,
  numericDelta,
  scenarioRoster,
} from './profile-view';

function run(partial: Partial<ScenarioRun>): ScenarioRun {
  return {
    id: partial.id ?? 'x',
    networkPath: '/n',
    networkName: 'N',
    toolkit: partial.toolkit ?? 'flow',
    scenarioName: partial.scenarioName ?? 'default',
    valueType: partial.valueType ?? 'float64',
    ranAt: partial.ranAt ?? 0,
    computationTimeMs: partial.computationTimeMs ?? 0,
    inputFiles: {},
    metrics: partial.metrics ?? [],
    overlays: partial.overlays,
    raw: null,
  };
}

describe('profile-view — mechanical reshaping only, no judgement', () => {
  it('collects distinct metric labels in first-seen order', () => {
    const cols = metricColumns([
      run({ metrics: [{ label: 'Max flow', value: 1, unit: 'u' }] }),
      run({
        metrics: [
          { label: 'Max flow', value: 2 },
          { label: 'Min-cut', value: 3, direction: 'lower-better' },
        ],
      }),
    ]);
    expect(cols.map((c) => c.label)).toEqual(['Max flow', 'Min-cut']);
    expect(cols[0].unit).toBe('u');
    expect(cols[1].direction).toBe('lower-better');
  });

  it('groups runs by toolkit in a fixed order, oldest first', () => {
    const groups = groupByToolkit([
      run({ id: 'f2', toolkit: 'flow', ranAt: 200 }),
      run({ id: 's1', toolkit: 'schedule', ranAt: 50 }),
      run({ id: 'f1', toolkit: 'flow', ranAt: 100 }),
    ]);
    expect(groups.map((g) => g.toolkit)).toEqual(['flow', 'schedule']);
    expect(groups[0].runs.map((r) => r.id)).toEqual(['f1', 'f2']);
  });

  it('only produces a delta for number/number pairs — never flattens an interval', () => {
    expect(numericDelta(5, 3)).toBe(2);
    expect(
      numericDelta({ type: 'interval', lower: 1, upper: 2 }, 3),
    ).toBeNull();
    expect(
      numericDelta(3, { type: 'interval', lower: 1, upper: 2 }),
    ).toBeNull();
  });

  it('counts distinct scenario NAMES, not runs — one name run under two toolkits is one scenario', () => {
    const names = distinctScenarioNames([
      run({ id: 'a', toolkit: 'flow', scenarioName: 'Degraded' }),
      run({ id: 'b', toolkit: 'reliability', scenarioName: 'Degraded' }),
      run({ id: 'c', toolkit: 'flow', scenarioName: 'Nominal' }),
    ]);
    expect(names).toEqual(['Degraded', 'Nominal']);
  });

  it('rosters which toolkits have run each scenario, keeping the latest run per toolkit', () => {
    const rows = scenarioRoster([
      run({
        id: 'a1',
        toolkit: 'flow',
        scenarioName: 'Degraded',
        valueType: 'float64',
        ranAt: 100,
      }),
      run({
        id: 'a2',
        toolkit: 'flow',
        scenarioName: 'Degraded',
        valueType: 'float64',
        ranAt: 200, // a re-run — should win over a1
      }),
      run({
        id: 'b',
        toolkit: 'reliability',
        scenarioName: 'Degraded',
        valueType: 'interval',
        ranAt: 150,
      }),
      run({
        id: 'c',
        toolkit: 'flow',
        scenarioName: 'Nominal',
        valueType: 'float64',
        ranAt: 50,
      }),
    ]);
    expect(rows.map((r) => r.scenarioName)).toEqual(['Degraded', 'Nominal']);

    const [degraded, nominal] = rows;
    expect(degraded.byToolkit.flow).toEqual({ valueType: 'float64', ranAt: 200 });
    expect(degraded.byToolkit.reliability).toEqual({
      valueType: 'interval',
      ranAt: 150,
    });
    expect(degraded.byToolkit.schedule).toBeUndefined();
    expect(nominal.byToolkit.flow).toEqual({ valueType: 'float64', ranAt: 50 });
    expect(nominal.byToolkit.reliability).toBeUndefined();
  });

  it('collects only overlays the runs carry — invents none', () => {
    const refs = collectOverlays([
      run({
        id: 'a',
        overlays: [
          { focus: 'bn', label: 'Bottlenecks', nodeIds: [1, 2, 3] },
          { focus: 'se', label: 'Saturated', edges: [[1, 2]] },
        ],
      }),
      run({ id: 'b' }),
    ]);
    expect(refs).toHaveLength(2);
    expect(refs[0].nodeCount).toBe(3);
    expect(refs[1].edgeCount).toBe(1);
    expect(refs[0].key).toBe('a::bn');
  });
});
