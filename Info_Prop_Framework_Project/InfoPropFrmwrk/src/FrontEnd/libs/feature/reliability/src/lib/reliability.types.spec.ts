import { UniqueDiamond } from '@inf-prop/shared/api-client';
import { Scenario, ScenarioAnalysis } from '@inf-prop/shared/data-access';
import {
  EmbeddedDiamondAnalysis,
  conditioningWidth,
  fixedNodeUnion,
  maximalDiamonds,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  subDiamondsOf,
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

describe('fixedNodeUnion — unions across every diamond posed, not just maximal ones', () => {
  // The Diamond chapter's own worked example: a nested diamond can fix a node
  // its enclosing maximal diamond never does (maximal D2 at a join has
  // C={1}; its nested D3, posed inside it, has its own C={3}). A union
  // scoped to `is_root_diamond` alone would report {1} and miss node 3.
  const MAXIMAL: UniqueDiamond = {
    diamond_hash: 'maximal',
    is_root_diamond: true,
    sub_sources: [1],
    sub_fork_nodes: [1],
    sub_join_nodes: [6],
    sub_iteration_sets_count: 3,
    sub_diamond_structures: {},
    diamond: {
      conditioning_nodes: [1],
      relevant_nodes: [1, 3, 4, 5, 6],
      edgelist: [
        [1, 3],
        [3, 4],
        [3, 5],
        [4, 6],
        [5, 6],
      ],
      edge_count: 5,
      node_count: 5,
    },
  };
  const NESTED: UniqueDiamond = {
    diamond_hash: 'nested',
    is_root_diamond: false,
    sub_sources: [3],
    sub_fork_nodes: [3],
    sub_join_nodes: [6],
    sub_iteration_sets_count: 2,
    sub_diamond_structures: {},
    diamond: {
      conditioning_nodes: [3],
      relevant_nodes: [3, 4, 5, 6],
      edgelist: [
        [3, 4],
        [3, 5],
        [4, 6],
        [5, 6],
      ],
      edge_count: 4,
      node_count: 4,
    },
  };
  const ANALYSIS: EmbeddedDiamondAnalysis = {
    maximalDiamondCount: 1,
    uniqueDiamondCount: 2,
    diamondJoinNodes: [6],
    uniqueDiamonds: { maximal: MAXIMAL, nested: NESTED },
  };

  it('includes the nested diamond\'s own conditioning node, not just the maximal\'s', () => {
    expect(fixedNodeUnion(ANALYSIS)).toEqual([1, 3]);
  });

  it('conditioningWidth already used this scope — the two agree', () => {
    expect(conditioningWidth(ANALYSIS)).toBe(1); // both diamonds carry |C|=1
  });
});

describe('subDiamondsOf — recursive drill-down', () => {
  // A maximal diamond at join 9 with two nested joins in its
  // sub_diamond_structures: join 5 (matched by a real raw_unique_diamonds
  // entry, itself induced — no further nesting) and join 7 (unmatched — its
  // geometry is on the wire but no raw_unique_diamonds entry corresponds to
  // it, so it falls back to a "partial" node).
  const MATCHED_SUB: UniqueDiamond = {
    diamond_hash: 'sub-hash-5',
    is_root_diamond: false,
    sub_sources: [1],
    sub_fork_nodes: [1],
    sub_join_nodes: [5],
    sub_iteration_sets_count: 2,
    sub_diamond_structures: {},
    diamond: {
      conditioning_nodes: [1],
      relevant_nodes: [1, 2, 5],
      edgelist: [
        [1, 2],
        [2, 5],
      ],
      edge_count: 2,
      node_count: 3,
    },
  };

  const MAXIMAL: UniqueDiamond = {
    diamond_hash: 'maximal-hash-9',
    is_root_diamond: true,
    sub_sources: [1],
    sub_fork_nodes: [1],
    sub_join_nodes: [5, 9],
    sub_iteration_sets_count: 4,
    sub_diamond_structures: {
      5: [
        {
          join_node: 5,
          diamond: MATCHED_SUB.diamond,
          non_diamond_parents: [],
        },
      ],
      7: [
        {
          join_node: 7,
          diamond: {
            conditioning_nodes: [6],
            relevant_nodes: [6, 7],
            edgelist: [[6, 7]],
            edge_count: 1,
            node_count: 2,
          },
          non_diamond_parents: [],
        },
      ],
    },
    diamond: {
      conditioning_nodes: [1, 6],
      relevant_nodes: [1, 2, 5, 6, 7, 9],
      edgelist: [
        [1, 2],
        [2, 5],
        [5, 9],
        [6, 7],
        [7, 9],
      ],
      edge_count: 5,
      node_count: 6,
    },
  };

  const ANALYSIS: EmbeddedDiamondAnalysis = {
    maximalDiamondCount: 1,
    uniqueDiamondCount: 2,
    diamondJoinNodes: [9],
    uniqueDiamonds: {
      'maximal-hash-9': MAXIMAL,
      'sub-hash-5': MATCHED_SUB,
    },
  };

  it('resolves a matched sub-diamond to its own full identification', () => {
    const [maximal] = maximalDiamonds(ANALYSIS);
    // sorted by join node — [0] is join 5, [1] is join 7 (asserted below)
    const subs = subDiamondsOf(maximal, ANALYSIS);
    expect(subs.map((s) => s.joinNode)).toEqual([5, 7]);

    const [matched] = subs;
    expect(matched.identified).toBe(true);
    expect(matched.hash).toBe('sub-hash-5');
    expect(matched.fixedNodes).toEqual([1]);
    expect(matched.isInduced).toBe(true);
    // drilling further into an induced sub-diamond finds nothing more
    expect(subDiamondsOf(matched, ANALYSIS)).toEqual([]);
  });

  it('falls back to a partial node when no raw_unique_diamonds entry matches', () => {
    const [maximal] = maximalDiamonds(ANALYSIS);
    const subs = subDiamondsOf(maximal, ANALYSIS);
    expect(subs.map((s) => s.joinNode)).toEqual([5, 7]);

    const [, unmatched] = subs;
    expect(unmatched.identified).toBe(false);
    expect(unmatched.fixedNodes).toEqual([6]);
    expect(unmatched.nodeCount).toBe(2);
    // a distinct, non-empty synthesised hash — never a real wire value
    expect(unmatched.hash).toContain('7');
  });

  it('returns nothing for a diamond with no recorded sub-structure', () => {
    expect(subDiamondsOf(maximalDiamonds(analysisOf())[0], analysisOf())).toEqual(
      [],
    );
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
