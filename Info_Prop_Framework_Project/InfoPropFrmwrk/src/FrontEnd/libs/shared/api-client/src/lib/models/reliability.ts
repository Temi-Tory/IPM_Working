import { AnalysisEnvelope } from './envelope';
import { BeliefValue } from '../value-types';

/**
 * `POST /probability-propagation` (canonical) / `/reachability-analysis` (alias).
 * Computes belief `b(v)` for every node: the probability the node operates AND
 * is reachable from at least one source, given independent node/edge failure.
 *
 * Reliability is the one toolkit that spans all three value forms:
 * `BeliefValue = number | IntervalData | PboxData`, per the requested input
 * value type. Never flattened to a point for display.
 *
 * BLOCKED ON TRACK 05: this endpoint 500s today because diamond identification
 * calls retired functions. Build against a mocked response in this shape; swap
 * to the live call once track 05 confirms `new_identify` is wired.
 */
export interface ProbabilityPropagationRequest {
  networkPath: string;
  edgesFilePath?: string;
  nodepriorsPath: string;
  linkprobsPath: string;
  includeExactInference?: boolean;
  includeDiamondAnalysis?: boolean;
}

export interface BeliefStatistics {
  mean: number;
  min: number;
  max: number;
  numeric_count: number;
  total_count: number;
}

export interface ExactInferenceResult {
  beliefs: Record<string, BeliefValue>;
  node_priors: Record<string, BeliefValue>;
  computation_time: number;
  total_nodes_processed: number;
  belief_statistics: BeliefStatistics;
  cache?: unknown;
}

export interface ProbabilityResult {
  exact_inference?: ExactInferenceResult;
  diamond_analysis?: {
    root_diamonds_count: number;
    unique_diamonds_count: number;
    join_nodes_with_diamonds: number[];
    raw_root_diamonds: unknown;
    raw_unique_diamonds: unknown;
  };
}

export interface ProbabilityPropagationResponse extends AnalysisEnvelope {
  network_path: string;
  edges_file_path: string;
  nodepriors_path: string;
  linkprobs_path: string;
  /**
   * Authoritative value form of this run, from the node-priors file's type.
   * Optional for back-compat with fixtures written before it was added; the
   * live server always sends it. When absent, derive from the belief values.
   */
  value_type?: 'Float64' | 'Interval' | 'pbox';
  source_nodes: number[];
  sink_nodes: number[];
  diamond_cache_hit: boolean;
  diamond_cache_status: string;
  diamond_cache_source: string;
  probability_result: ProbabilityResult;
}
