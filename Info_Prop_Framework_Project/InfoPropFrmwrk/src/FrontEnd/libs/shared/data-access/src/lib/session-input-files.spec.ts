import {
  buildCapacitiesContent,
  buildCpmInputsContent,
  buildEdgesFileContent,
  buildLinkProbabilitiesContent,
  buildNodePriorsContent,
  toUploadFile,
} from './session-input-files';

describe('session-input-files — hand-entered values in the exact server-parsed shape', () => {
  it('builds edges content as "source,destination" CSV, matching the structure endpoint edge shape', () => {
    expect(buildEdgesFileContent([[1, 2], [2, 3]])).toBe(
      'source,destination\n1,2\n2,3\n',
    );
  });

  it('builds nodepriors with string node keys, per data_type, exactly as diamond-promotion writes', () => {
    const content = buildNodePriorsContent({ 1: 0.9, 2: 0.75 }, 'float64', 'x');
    const parsed = JSON.parse(content);
    expect(parsed).toEqual({
      nodes: { '1': 0.9, '2': 0.75 },
      data_type: 'Float64',
      serialization: 'compact',
      description: 'x',
    });
  });

  it('builds linkprobabilities with "(u,v)" keys from the editor\'s "u-v" internal key', () => {
    const content = buildLinkProbabilitiesContent({ '1-2': 0.8, '2-3': 0.6 }, 'interval', 'x');
    const parsed = JSON.parse(content);
    expect(parsed.links).toEqual({ '(1,2)': 0.8, '(2,3)': 0.6 });
    expect(parsed.data_type).toBe('Interval');
  });

  it('builds capacities in the toolkit-edges-array schema, Float64 only, node capacities optional', () => {
    const withoutNodes = JSON.parse(
      buildCapacitiesContent({ '1-2': 10 }, undefined, 'x'),
    );
    expect(withoutNodes).toEqual({
      data_type: 'Float64',
      edges: [{ source: 1, destination: 2, capacity: 10 }],
      description: 'x',
    });

    const withNodes = JSON.parse(
      buildCapacitiesContent({ '1-2': 10 }, { 1: 5 }, 'x'),
    );
    expect(withNodes.nodes).toEqual([{ node: 1, capacity: 5 }]);
  });

  it('builds cpm-inputs under time_analysis (required key name) with cost_analysis only when cost values are given', () => {
    const timeOnly = JSON.parse(
      buildCpmInputsContent({
        valueType: 'float64',
        nodeDurations: { 1: 2, 2: 3 },
        edgeDelays: { '1-2': 0 },
      }),
    );
    expect(timeOnly).toEqual({
      data_type: 'Float64',
      time_analysis: {
        node_durations: { '1': 2, '2': 3 },
        edge_delays: { '(1,2)': 0 },
        initial_time: 0,
      },
    });
    expect(timeOnly.cost_analysis).toBeUndefined();

    const withCost = JSON.parse(
      buildCpmInputsContent({
        valueType: 'float64',
        nodeDurations: { 1: 2 },
        edgeDelays: {},
        nodeCosts: { 1: 100 },
        edgeCosts: { '1-2': 5 },
      }),
    );
    expect(withCost.cost_analysis).toEqual({
      node_costs: { '1': 100 },
      edge_costs: { '(1,2)': 5 },
      initial_cost: 0,
    });
  });

  it('toUploadFile sets webkitRelativePath so the server\'s naming convention sorts it correctly', () => {
    const file = toUploadFile('Net/float/Net-nodepriors.json', '{}', 'application/json');
    expect(file.name).toBe('Net-nodepriors.json');
    expect((file as File & { webkitRelativePath: string }).webkitRelativePath).toBe(
      'Net/float/Net-nodepriors.json',
    );
  });
});
