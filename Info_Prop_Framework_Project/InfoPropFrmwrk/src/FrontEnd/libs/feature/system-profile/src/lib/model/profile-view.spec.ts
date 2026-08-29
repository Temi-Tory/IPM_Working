import { ScenarioRun } from '@inf-prop/shared/data-access';
import {
  collectOverlays,
  groupByToolkit,
  metricColumns,
  numericDelta,
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
