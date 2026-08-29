import { Scenario, ScenarioAnalysis } from '@inf-prop/shared/data-access';
import {
  fixedNodeUnion,
  maximalDiamonds,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  toReliabilityScenarios,
} from './reliability.types';
import {
  mockFloatResponse,
  mockIntervalResponse,
  mockPboxResponse,
  mockResponseWithoutValueType,
} from './reliability.mocks';

function analysisOf(res = mockFloatResponse()) {
  const a = readEmbeddedDiamondAnalysis(res);
  if (!a) throw new Error('expected a diamond_analysis block');
  return a;
}

describe('readEmbeddedDiamondAnalysis', () => {
  it('reads the maximal / unique counts and the diamond-join index', () => {
    const a = analysisOf();
    expect(a.maximalDiamondCount).toBe(1);
    expect(a.uniqueDiamondCount).toBe(1);
    expect(a.diamondJoinNodes).toEqual([5]);
    expect(Object.keys(a.uniqueDiamonds)).toEqual(['12345678901234567890']);
  });

  it('returns null when there is no diamond_analysis block', () => {
    const res = mockFloatResponse();
    delete res.probability_result.diamond_analysis;
    expect(readEmbeddedDiamondAnalysis(res)).toBeNull();
  });
});

describe('maximalDiamonds — read straight off raw_unique_diamonds', () => {
  it('filters is_root_diamond and keeps the hash key for /diamond-subgraph-analysis', () => {
    const diamonds = maximalDiamonds(analysisOf());
    expect(diamonds).toHaveLength(1);
    const d = diamonds[0];
    expect(d.hash).toBe('12345678901234567890');
    expect(d.joinNode).toBe(5); // sink of the diamond's own edge list
    expect(d.fixedNodes).toEqual([2]);
    expect(d.localSources).toEqual([2]);
    expect(d.isInduced).toBe(true);
    expect(d.subDiamondCount).toBe(0);
  });

  it('collects the fixed-node union', () => {
    expect(fixedNodeUnion(analysisOf())).toEqual([2]);
  });
});

describe('resolvedValueType', () => {
  it('trusts the response value_type field', () => {
    expect(resolvedValueType(mockFloatResponse())).toBe('float64');
    expect(resolvedValueType(mockIntervalResponse())).toBe('interval');
    expect(resolvedValueType(mockPboxResponse())).toBe('pbox');
  });

  it('falls back to the belief form when value_type is absent', () => {
    const res = mockResponseWithoutValueType();
    expect(res.value_type).toBeUndefined();
    expect(resolvedValueType(res)).toBe('interval');
  });
});

describe('toReliabilityScenarios', () => {
  it('keeps only complete pairs and carries the network-relative paths', () => {
    const scenario: Scenario = { name: 'float', analyses: [] };
    const analysis: ScenarioAnalysis = {
      kind: 'reliability',
      valueType: 'float64',
      complete: true,
      paths: {
        nodepriors: 'float/KarlNetwork-nodepriors.json',
        linkprobs: 'float/KarlNetwork-linkprobabilities.json',
      },
      files: [],
    };
    const incomplete: ScenarioAnalysis = {
      ...analysis,
      paths: { nodepriors: 'x/np.json' },
    };
    const out = toReliabilityScenarios([
      { scenario, analysis },
      { scenario: { name: 'bad', analyses: [] }, analysis: incomplete },
    ]);
    expect(out).toEqual([
      {
        name: 'float',
        hintValueType: 'float64',
        nodepriorsPath: 'float/KarlNetwork-nodepriors.json',
        linkprobsPath: 'float/KarlNetwork-linkprobabilities.json',
      },
    ]);
  });
});
