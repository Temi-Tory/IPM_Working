import {
  BeliefValue,
  DiamondsAtNode,
  ProbabilityPropagationResponse,
  UniqueDiamond,
} from '@inf-prop/shared/api-client';

/**
 * Response fixtures in the `models/reliability.ts` shape, one per value form.
 * Test-only — excluded from the library build.
 */

function beliefStats(values: number[]) {
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    numeric_count: values.length,
    total_count: values.length,
  };
}

const DIAMOND_SUBGRAPH = {
  // wire keeps the legacy name; the concept is "fixed nodes" (the set C)
  conditioning_nodes: [2],
  relevant_nodes: [2, 3, 4, 5],
  edgelist: [
    [2, 3],
    [2, 4],
    [3, 5],
    [4, 5],
  ] as [number, number][],
  edge_count: 4,
  node_count: 4,
};

const MAXIMAL_DIAMOND_HASH = '12345678901234567890';

/** Legacy per-join view; the UI reads `raw_unique_diamonds` instead. */
const ROOT_DIAMOND: DiamondsAtNode = {
  join_node: 5,
  diamond: DIAMOND_SUBGRAPH,
  non_diamond_parents: [],
};

/** The maximal diamond at join 5 — `is_root_diamond: true`, keyed by its hash. */
const MAXIMAL_DIAMOND: UniqueDiamond = {
  diamond_hash: MAXIMAL_DIAMOND_HASH,
  is_root_diamond: true,
  sub_sources: [2],
  sub_fork_nodes: [2],
  sub_join_nodes: [5],
  sub_iteration_sets_count: 3,
  sub_diamond_structures: {},
  diamond: DIAMOND_SUBGRAPH,
};

function envelope(
  valueType: 'Float64' | 'Interval' | 'pbox',
  beliefs: Record<string, BeliefValue>,
  priors: Record<string, BeliefValue>,
  numeric: number[],
): ProbabilityPropagationResponse {
  return {
    success: true,
    message: 'Probability propagation analysis completed',
    endpoint: 'probability-propagation',
    timestamp: '2026-08-29T00:00:00',
    network_path: 'temp_uploads/abc/KarlNetwork',
    edges_file_path: 'KarlNetwork.EDGES',
    nodepriors_path: 'float/KarlNetwork-nodepriors.json',
    linkprobs_path: 'float/KarlNetwork-linkprobabilities.json',
    value_type: valueType,
    source_nodes: [1, 2],
    sink_nodes: [5],
    diamond_cache_hit: false,
    diamond_cache_status: 'created',
    diamond_cache_source: 'new',
    probability_result: {
      exact_inference: {
        beliefs,
        node_priors: priors,
        computation_time: 0.012,
        total_nodes_processed: Object.keys(beliefs).length,
        belief_statistics: beliefStats(numeric),
      },
      diamond_analysis: {
        root_diamonds_count: 1,
        unique_diamonds_count: 1,
        join_nodes_with_diamonds: [5],
        raw_root_diamonds: { 5: [ROOT_DIAMOND] },
        raw_unique_diamonds: { [MAXIMAL_DIAMOND_HASH]: MAXIMAL_DIAMOND },
      },
    },
  };
}

export function mockFloatResponse(): ProbabilityPropagationResponse {
  return envelope(
    'Float64',
    { 1: 0.9, 2: 0.9, 3: 0.81, 4: 0.81, 5: 0.7 },
    { 1: 0.9, 2: 0.9, 3: 0.9, 4: 0.9, 5: 0.9 },
    [0.9, 0.9, 0.81, 0.81, 0.7],
  );
}

export function mockIntervalResponse(): ProbabilityPropagationResponse {
  const iv = (lower: number, upper: number): BeliefValue => ({
    type: 'interval',
    lower,
    upper,
  });
  return envelope(
    'Interval',
    {
      1: iv(0.85, 0.95),
      2: iv(0.85, 0.95),
      3: iv(0.7, 0.88),
      4: iv(0.7, 0.88),
      5: iv(0.55, 0.8),
    },
    {
      1: iv(0.85, 0.95),
      2: iv(0.85, 0.95),
      3: iv(0.85, 0.95),
      4: iv(0.85, 0.95),
      5: iv(0.85, 0.95),
    },
    [0.9, 0.9, 0.79, 0.79, 0.675],
  );
}

export function mockPboxResponse(): ProbabilityPropagationResponse {
  const pb = (ml: number, mh: number): BeliefValue => ({
    type: 'pbox',
    mean_lower: ml,
    mean_upper: mh,
    var_lower: 0,
    var_upper: 0.02,
    shape: 'normal',
    name: '',
    bounded: true,
    discretization_size: 200,
    bounds_summary: { left_min: 0, left_max: 1, right_min: 0, right_max: 1 },
  });
  return envelope(
    'pbox',
    {
      1: pb(0.88, 0.92),
      2: pb(0.88, 0.92),
      3: pb(0.74, 0.84),
      4: pb(0.74, 0.84),
      5: pb(0.6, 0.76),
    },
    {
      1: pb(0.88, 0.92),
      2: pb(0.88, 0.92),
      3: pb(0.88, 0.92),
      4: pb(0.88, 0.92),
      5: pb(0.88, 0.92),
    },
    [0.9, 0.9, 0.79, 0.79, 0.68],
  );
}

/** Float response with the `value_type` field stripped — for the fallback test. */
export function mockResponseWithoutValueType(): ProbabilityPropagationResponse {
  const res = mockIntervalResponse();
  delete res.value_type;
  return res;
}

export const MOCK_PARENT_PRIORS = {
  nodes: { '2': 0.9, '3': 0.9, '4': 0.9, '5': 0.9, '9': 0.5 },
  data_type: 'Float64',
  serialization: 'compact',
  description: 'x',
};

export const MOCK_PARENT_LINKS = {
  links: {
    '(2,3)': 0.9,
    '(2, 4)': 0.8,
    '(3,5)': 0.7,
    '(4,5)': 0.6,
    '(9,2)': 0.5,
  },
  data_type: 'Float64',
  serialization: 'compact',
  description: 'x',
};
