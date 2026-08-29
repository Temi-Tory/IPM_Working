import {
  Scenario,
  availableInputsFrom,
  classifyFiles,
  classifyPaths,
  detectAvailableInputs,
  enrichValueTypesWith,
  scenariosFor,
} from './file-convention';

function fakeFile(relativePath: string): File {
  const name = relativePath.split('/').pop() ?? relativePath;
  const f = new File(['{}'], name, { type: 'application/json' });
  Object.defineProperty(f, 'webkitRelativePath', { value: relativePath });
  return f;
}

function named(scenarios: Scenario[], name: string): Scenario {
  const s = scenarios.find((x) => x.name === name);
  if (!s) throw new Error(`no scenario "${name}"`);
  return s;
}

describe('file-convention', () => {
  it('value-form folders become one scenario each, keyed by value type', () => {
    const upload = classifyFiles([
      fakeFile('KarlNetwork/KarlNetwork.EDGES'),
      fakeFile('KarlNetwork/float/KarlNetwork-nodepriors.json'),
      fakeFile('KarlNetwork/float/KarlNetwork-linkprobabilities.json'),
      fakeFile('KarlNetwork/interval/KarlNetwork-nodepriors.json'),
      fakeFile('KarlNetwork/interval/KarlNetwork-linkprobabilities.json'),
      fakeFile('KarlNetwork/capacity/KarlNetwork-capacities.json'),
      fakeFile('KarlNetwork/cpm/KarlNetwork-cpm-inputs.json'),
    ]);

    expect(upload.networkName).toBe('KarlNetwork');
    expect(upload.edges?.role).toBe('edges');
    expect(upload.scenarios.map((s) => s.name).sort()).toEqual([
      'capacity',
      'cpm',
      'float',
      'interval',
    ]);
    const float = named(upload.scenarios, 'float');
    expect(float.folderValueType).toBe('float64');
    expect(float.analyses[0].kind).toBe('reliability');
    expect(float.analyses[0].complete).toBe(true);
    expect(float.analyses[0].paths).toEqual({
      nodepriors: 'float/KarlNetwork-nodepriors.json',
      linkprobs: 'float/KarlNetwork-linkprobabilities.json',
    });
    expect(named(upload.scenarios, 'interval').analyses[0].valueType).toBe(
      'interval',
    );
  });

  it('keeps named operating-case scenarios distinct (does not collapse them)', () => {
    const mk = (scen: string) => [
      fakeFile(`water/${scen}/water-nodepriors.json`),
      fakeFile(`water/${scen}/water-linkprobabilities.json`),
      fakeFile(`water/${scen}/water-capacities.json`),
      fakeFile(`water/${scen}/water-cpm-inputs.json`),
    ];
    const upload = classifyFiles([
      fakeFile('water/water.EDGES'),
      ...mk('Edge Bottleneck Demo'),
      ...mk('Interval Conservative'),
      ...mk('Source Limited Demo'),
    ]);

    expect(upload.scenarios).toHaveLength(3);
    const reliability = scenariosFor(upload, 'reliability');
    const flow = scenariosFor(upload, 'flow');
    expect(reliability.map((r) => r.scenario.name).sort()).toEqual([
      'Edge Bottleneck Demo',
      'Interval Conservative',
      'Source Limited Demo',
    ]);
    expect(flow).toHaveLength(3);
    // each scenario bundle carries all three analyses
    const edge = named(upload.scenarios, 'Edge Bottleneck Demo');
    expect(edge.analyses.map((a) => a.kind).sort()).toEqual([
      'flow',
      'reliability',
      'schedule',
    ]);
    const edgeFlow = edge.analyses.find((a) => a.kind === 'flow');
    expect(edgeFlow?.paths.capacities).toBe(
      'Edge Bottleneck Demo/water-capacities.json',
    );
  });

  it('enrichValueTypesWith resolves operating-case folders from data_type', async () => {
    const upload = classifyPaths('water', [
      'water/water.EDGES',
      'water/Interval Conservative/water-nodepriors.json',
      'water/Interval Conservative/water-linkprobabilities.json',
      'water/Interval Conservative/water-cpm-inputs.json',
    ]);
    // folder name isn't a value-type keyword -> defaults to float64
    expect(named(upload.scenarios, 'Interval Conservative').analyses[0].valueType).toBe(
      'float64',
    );

    await enrichValueTypesWith(upload, async (rel) =>
      rel.includes('cpm')
        ? { data_type: 'Interval' }
        : { data_type: 'Interval' },
    );

    const s = named(upload.scenarios, 'Interval Conservative');
    expect(s.analyses.find((a) => a.kind === 'reliability')?.valueType).toBe(
      'interval',
    );
    expect(s.analyses.find((a) => a.kind === 'schedule')?.valueType).toBe(
      'interval',
    );
  });

  it('scenarios with only reliability inputs do not claim flow / schedule', () => {
    const upload = classifyFiles([
      fakeFile('grid-graph/grid-graph.EDGES'),
      fakeFile('grid-graph/Degraded/grid-graph-nodepriors.json'),
      fakeFile('grid-graph/Degraded/grid-graph-linkprobabilities.json'),
    ]);
    const s = named(upload.scenarios, 'Degraded');
    expect(s.analyses.map((a) => a.kind)).toEqual(['reliability']);
    expect(availableInputsFrom(upload)).toEqual({
      reliability: true,
      flow: false,
      schedule: false,
    });
  });

  it('classifyPaths reconstructs the same structure from server paths', () => {
    const upload = classifyPaths('KarlNetwork', [
      'KarlNetwork/KarlNetwork.EDGES',
      'KarlNetwork/float/KarlNetwork-nodepriors.json',
      'KarlNetwork/float/KarlNetwork-linkprobabilities.json',
      'KarlNetwork/capacity/KarlNetwork-capacities.json',
    ]);
    expect(upload.scenarios.map((s) => s.name).sort()).toEqual([
      'capacity',
      'float',
    ]);
    expect(detectAvailableInputs(['n/n.EDGES', 'n/capacity/n-capacities.json'])).toEqual(
      { reliability: false, flow: true, schedule: false },
    );
  });
});
