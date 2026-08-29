import { AnalysisEnvelope } from './envelope';
import { BeliefValue } from '../value-types';

/**
 * Diamond decomposition is a PRE-PROCESSING STEP for the reliability toolkit,
 * not a fourth analysis. It is surfaced for inspection from within a reliability
 * result, never as a top-level nav peer. A single identified diamond is itself a
 * valid sub-network and can be "promoted" to a standalone upload (see
 * `feature/reliability`) — that needs no new endpoint.
 *
 * SHAPE NOTE: the current algorithm (`new_identify`) is factorised — one join
 * node can carry MORE THAN ONE independent diamond (from different forks), so
 * the wire shape is an ARRAY per join: `Record<number, DiamondsAtNode[]>`. The
 * server's serialisers still emit the old one-per-join shape; the server-fixes
 * track (05) is responsible for correcting them. Build and test against the
 * array-per-join shape below; swap the mock for the live call once track 05
 * confirms it is live.
 */

export interface DiamondSubgraph {
  conditioning_nodes: number[];
  relevant_nodes: number[];
  edgelist: [number, number][];
  edge_count: number;
  node_count: number;
}

export interface DiamondsAtNode {
  join_node: number;
  diamond: DiamondSubgraph;
  non_diamond_parents: number[];
}

export interface UniqueDiamond {
  diamond_hash: string;
  is_root_diamond: boolean;
  sub_sources: number[];
  sub_fork_nodes: number[];
  sub_join_nodes: number[];
  sub_iteration_sets_count: number;
  /** array per join, matching the factorised producer */
  sub_diamond_structures: Record<number, DiamondsAtNode[]>;
  diamond: DiamondSubgraph;
}

export interface DiamondAnalysisRequest {
  networkPath: string;
  edgesFilePath?: string;
  nodepriorsPath?: string;
}

export interface DiamondAnalysisResult {
  computation_time: number;
  cache_hit: boolean;
  root_diamonds_count: number;
  unique_diamonds_count: number;
  join_nodes_with_diamonds: number[];
  /** array per join */
  raw_root_diamonds: Record<number, DiamondsAtNode[]>;
  raw_unique_diamonds: Record<string, UniqueDiamond>;
}

export interface DiamondAnalysisResponse extends AnalysisEnvelope {
  edges_file_path: string;
  nodepriors_path: string;
  diamond_analysis: DiamondAnalysisResult;
}

/** `POST /diamond-subgraph-analysis` — run selected analyses inside one diamond. */
export interface DiamondSubgraphRequest {
  networkPath: string;
  edgesFilePath?: string;
  nodepriorsPath?: string;
  linkprobsPath?: string;
  capacitiesPath?: string;
  cpmPath?: string;
  /** UInt64 hash string from /diamond-analysis. */
  diamondHash: string;
  analyses: Array<'reachability' | 'flow' | 'capacity' | 'cpm'>;
  /** e.g. `{ reachability: { "2": 0.8 } }` — substitute a source node's value. */
  sourceOverrides?: Record<string, Record<string, number>>;
}

export interface DiamondSubgraphResponse {
  success: boolean;
  diamond_hash: string;
  diamond_info: {
    join_nodes: number[];
    conditioning_nodes: number[];
    node_count: number;
    edge_count: number;
    source_nodes: number[];
    fork_nodes: number[];
    is_root_diamond: boolean;
  };
  reachability_result?: {
    beliefs: Record<string, BeliefValue>;
    cache?: unknown;
  };
  flow_result?: unknown;
  cpm_result?: unknown;
}
