import {
  BeliefValue,
  DiamondSubgraph,
  ProbabilityPropagationResponse,
  UniqueDiamond,
  ValueType,
  valueFormKind,
} from '@inf-prop/shared/api-client';
import { Scenario, ScenarioAnalysis } from '@inf-prop/shared/data-access';

/**
 * One runnable reliability scenario, taken straight from the shared scenario
 * model (`NetworkContextService.scenariosFor('reliability')`). The paths are
 * already network-relative and go straight into the request fields.
 */
export interface ReliabilityScenarioRef {
  /** scenario folder name — the state key and the label */
  name: string;
  /**
   * Best-effort pre-selection hint for the value-type selector. NOT
   * authoritative — `resolvedValueType(response)` reads the real form back off
   * the result (the response's `value_type` field, falling back to the belief
   * values themselves).
   */
  hintValueType: ValueType;
  nodepriorsPath: string;
  linkprobsPath: string;
}

export function toReliabilityScenario(pair: {
  scenario: Scenario;
  analysis: ScenarioAnalysis;
}): ReliabilityScenarioRef | null {
  const { nodepriors, linkprobs } = pair.analysis.paths;
  if (!nodepriors || !linkprobs) return null;
  return {
    name: pair.scenario.name,
    hintValueType: pair.analysis.valueType,
    nodepriorsPath: nodepriors,
    linkprobsPath: linkprobs,
  };
}

export function toReliabilityScenarios(
  pairs: Array<{ scenario: Scenario; analysis: ScenarioAnalysis }>,
): ReliabilityScenarioRef[] {
  return pairs
    .map(toReliabilityScenario)
    .filter((s): s is ReliabilityScenarioRef => s !== null);
}

const DECLARED_VALUE_TYPE: Record<string, ValueType> = {
  Float64: 'float64',
  Interval: 'interval',
  pbox: 'pbox',
};

/**
 * The authoritative value form of a completed run: the response's top-level
 * `value_type` (from the node-priors file's declared type), falling back to
 * reading the form straight off the belief values when the server did not send
 * one (older fixtures).
 */
export function resolvedValueType(
  res: ProbabilityPropagationResponse,
): ValueType | null {
  const declared = res.value_type
    ? DECLARED_VALUE_TYPE[res.value_type]
    : undefined;
  if (declared) return declared;
  const beliefs = res.probability_result?.exact_inference?.beliefs;
  if (!beliefs) return null;
  const first = Object.values(beliefs)[0];
  return first === undefined ? null : valueFormKind(first);
}

export type NodeRole = 'source' | 'sink' | 'fork' | 'join' | 'regular';

/** A per-node row of a reliability result. The belief value keeps its form. */
export interface BeliefRow {
  nodeId: number;
  belief: BeliefValue;
  prior?: BeliefValue;
  /** primary role for the row's badge */
  role: NodeRole;
  /** every role this node holds (a node can be both a fork and a join) */
  roleTags: NodeRole[];
  /** this node is a diamond join */
  hasDiamond: boolean;
}

/**
 * `probability_result.diamond_analysis` as it arrives on the wire. Diamond
 * decomposition (Diamond chapter §The Diamond Subgraph) returns two views:
 *
 *  - **unique diamonds** — every distinct diamond found at any nesting level,
 *    stored once, keyed by its context-aware hash (`raw_unique_diamonds`);
 *  - **maximal diamonds** — the network-level view of a diamond join: the full
 *    subgraph its reconvergence forms. Every diamond join carries exactly one.
 *    On the wire these are the `raw_unique_diamonds` entries with
 *    `is_root_diamond: true` (legacy field name; the concept is "maximal").
 *
 * The set `C` that isolates a diamond is its **fixed nodes** (wire field:
 * `conditioning_nodes`). The wire keeps the legacy names; the UI uses the
 * chapter's vocabulary throughout.
 */
export interface EmbeddedDiamondAnalysis {
  maximalDiamondCount: number;
  uniqueDiamondCount: number;
  /** join nodes that carry a diamond ("which joins" index) */
  diamondJoinNodes: number[];
  uniqueDiamonds: Record<string, UniqueDiamond>;
}

/** A maximal diamond, resolved into the chapter's vocabulary. */
export interface MaximalDiamond {
  /** UInt64 hash string — the `unique_subgraphs` key and the
   *  `/diamond-subgraph-analysis` identifier */
  hash: string;
  /** the diamond join this maximal diamond reconverges at */
  joinNode: number;
  /** the set `C` of fixed nodes that isolate the pattern */
  fixedNodes: number[];
  /** the span `R`: the diamond join, its correlated parents, and everything
   *  upstream of them */
  relevantNodes: number[];
  edgelist: [number, number][];
  nodeCount: number;
  edgeCount: number;
  /** local sources of the diamond as a standalone subgraph (wire: sub_sources) */
  localSources: number[];
  localForks: number[];
  localJoins: number[];
  /** nested sub-diamonds; 0 ⇒ this maximal diamond is itself an induced diamond */
  subDiamondCount: number;
  isInduced: boolean;
  raw: UniqueDiamond;
}

export function readEmbeddedDiamondAnalysis(
  res: ProbabilityPropagationResponse,
): EmbeddedDiamondAnalysis | null {
  const d = res.probability_result?.diamond_analysis as
    | Partial<{
        root_diamonds_count: number;
        unique_diamonds_count: number;
        join_nodes_with_diamonds: number[];
        raw_unique_diamonds: Record<string, UniqueDiamond>;
      }>
    | undefined;
  if (!d) return null;
  return {
    maximalDiamondCount: d.root_diamonds_count ?? 0,
    uniqueDiamondCount: d.unique_diamonds_count ?? 0,
    diamondJoinNodes: d.join_nodes_with_diamonds ?? [],
    uniqueDiamonds: d.raw_unique_diamonds ?? {},
  };
}

/**
 * The diamond join a diamond reconverges at: the unique sink of its own edge
 * list. Prop. identity (ii) of the Diamond chapter guarantees this is
 * well-defined — the join is "the unique endpoint of `ED` that every other
 * endpoint precedes in the closure". Fixed nodes act as local sources of the
 * diamond, so the sink is always the join.
 */
function diamondJoinNode(d: DiamondSubgraph): number {
  const hasOutgoing = new Set<number>();
  const all = new Set<number>();
  for (const [u, v] of d.edgelist ?? []) {
    all.add(u);
    all.add(v);
    hasOutgoing.add(u);
  }
  const sinks = [...all].filter((n) => !hasOutgoing.has(n));
  if (sinks.length === 1) return sinks[0];
  if (sinks.length > 1) return Math.max(...sinks);
  const rel = d.relevant_nodes ?? [];
  return rel.length ? Math.max(...rel) : Number.NaN;
}

function subDiamondCount(u: UniqueDiamond): number {
  const structures = u.sub_diamond_structures ?? {};
  let n = 0;
  for (const value of Object.values(structures)) {
    n += Array.isArray(value) ? value.length : value ? 1 : 0;
  }
  return n;
}

/**
 * The maximal diamonds — one per diamond join — read directly off
 * `raw_unique_diamonds` by filtering `is_root_diamond`. Their hash key is the
 * `/diamond-subgraph-analysis` identifier, no matching needed.
 */
export function maximalDiamonds(
  analysis: EmbeddedDiamondAnalysis,
): MaximalDiamond[] {
  const out: MaximalDiamond[] = [];
  for (const [key, u] of Object.entries(analysis.uniqueDiamonds)) {
    if (!u.is_root_diamond || !u.diamond) continue;
    const subs = subDiamondCount(u);
    out.push({
      hash: u.diamond_hash || key,
      joinNode: diamondJoinNode(u.diamond),
      fixedNodes: u.diamond.conditioning_nodes ?? [],
      relevantNodes: u.diamond.relevant_nodes ?? [],
      edgelist: u.diamond.edgelist ?? [],
      nodeCount: u.diamond.node_count ?? u.diamond.relevant_nodes?.length ?? 0,
      edgeCount: u.diamond.edge_count ?? u.diamond.edgelist?.length ?? 0,
      localSources: u.sub_sources ?? [],
      localForks: u.sub_fork_nodes ?? [],
      localJoins: u.sub_join_nodes ?? [],
      subDiamondCount: subs,
      isInduced: subs === 0,
      raw: u,
    });
  }
  return out.sort((a, b) => a.joinNode - b.joinNode);
}

/** Every fixed node named across every maximal diamond, de-duplicated. */
export function fixedNodeUnion(analysis: EmbeddedDiamondAnalysis): number[] {
  const set = new Set<number>();
  for (const u of Object.values(analysis.uniqueDiamonds)) {
    if (!u.is_root_diamond) continue;
    for (const n of u.diamond?.conditioning_nodes ?? []) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
