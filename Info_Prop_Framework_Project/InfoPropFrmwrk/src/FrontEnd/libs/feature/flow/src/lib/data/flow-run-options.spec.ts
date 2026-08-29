import {
  DEFAULT_FLOW_RUN_OPTIONS,
  parseDegradationScenarios,
  toAnalysisOptions,
} from './flow-run-options';

describe('parseDegradationScenarios', () => {
  it('parses a comma-separated list', () => {
    expect(parseDegradationScenarios('0.9, 0.75 , 0.5')).toEqual([
      0.9, 0.75, 0.5,
    ]);
  });

  it('drops non-numeric tokens', () => {
    expect(parseDegradationScenarios('0.9, nope, 0.5')).toEqual([0.9, 0.5]);
  });

  it('is null when nothing usable is given', () => {
    expect(parseDegradationScenarios('')).toBeNull();
    expect(parseDegradationScenarios('   ,  ')).toBeNull();
  });
});

describe('toAnalysisOptions', () => {
  it('maps every option onto the request contract', () => {
    const options = toAnalysisOptions({
      ...DEFAULT_FLOW_RUN_OPTIONS,
      algorithm: 'push_relabel',
      targetFlow: 42,
      degradationScenarios: [0.5],
    });
    expect(options.algorithm).toBe('push_relabel');
    expect(options.targetFlow).toBe(42);
    expect(options.degradationScenarios).toEqual([0.5]);
    expect(options.includeNodeCapacities).toBe(true);
    expect(options.tol).toBe(DEFAULT_FLOW_RUN_OPTIONS.tol);
  });
});
