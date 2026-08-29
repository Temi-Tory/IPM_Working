import { AnalysisEnvelope } from './envelope';

/**
 * `POST /flow-analysis` (canonical) / `/capacity-analysis` (alias).
 *
 * FLOAT64 ONLY. `CapacityAnalysisKit.jl`'s `parse_capacity_input_file` throws
 * unless `data_type == "Float64"`. Do NOT add an interval or p-box branch to
 * this contract or to any UI that consumes it — inventing that capability in
 * the UI is exactly the `/capacity-analysis-v2` mistake this rebuild removes.
 *
 * This endpoint is live and current — no server-fixes-track dependency.
 */
export interface FlowAnalysisRequest {
  networkPath: string;
  edgesFilePath?: string;
  capacitiesPath: string;
  analysisOptions?: {
    algorithm?: 'dinic' | 'edmonds_karp' | 'push_relabel';
    tol?: number;
    kFailure?: number;
    cutLimit?: number;
    pathLimit?: number;
    combinationLimit?: number;
    maxDepth?: number;
    targetFlow?: number | null;
    degradationScenarios?: number[] | null;
    includeNodeCapacities?: boolean;
  };
}

type Edge = [number, number];

export interface FlowState {
  max_flow: number;
  is_unbounded: boolean;
  mincut_capacity: number;
  sink_flow: [number, number][];
  saturated_edges: Edge[];
  mincut_S: number[];
  mincut_T: number[];
}

export interface SensitivityResult {
  critical_edges: Array<{
    edge: Edge;
    drop: number;
    baseline_flow: number;
    perturbed_flow: number;
  }>;
  marginal_capacity: Array<{ edge: Edge; value: number }>;
  birnbaum: Array<{ edge: Edge; value: number }>;
}

export interface FailureImpactResult {
  min_cut_edges: Edge[];
  single_edge_failures: Array<{
    edge: Edge;
    drop: number;
    perturbed_flow: number;
    is_critical: boolean;
    is_unbounded: boolean;
  }>;
  k_edge_failures: Array<{
    edges: Edge[];
    drop: number;
    perturbed_flow: number;
    is_unbounded: boolean;
  }>;
  degradation_results: Array<{
    scenario_id: number | string;
    max_flow: number;
    drop_from_baseline: number;
    sink_flow: [number, number][];
    is_unbounded: boolean;
  }>;
}

export interface StructuralResult {
  spof_edges: Edge[];
  spof_nodes: number[];
  paths_count: number;
  paths: number[][];
  edge_redundancy: Array<{ edge: Edge; score: number }>;
  bottleneck_ranking: Array<{
    edge: Edge;
    rank: number;
    flow: number;
    capacity: number;
    residual_capacity: number;
  }>;
  node_positions: Record<string, string>;
}

export interface FlowDecompositionResult {
  total_flow: number;
  is_unique: boolean;
  components: Array<{
    path: number[];
    flow_value: number;
    bottleneck_edge: Edge;
  }>;
}

export interface ParametricThresholdResult {
  baseline_flow: number;
  target_flow: number | null;
  degradation_thresholds: Array<{
    target_edge: Edge;
    original_capacity: number;
    threshold_capacity: number;
    degradation_margin: number;
    target_achievable: boolean;
    target_reachable_at_zero: boolean;
    solver_calls: number;
  }>;
}

export interface CutRecord {
  S: number[];
  T: number[];
  crossing_edges: Edge[];
  capacity: number;
}

export interface MinCutAnalysisResult {
  max_flow: number;
  min_cut_capacity: number;
  representative_cut: CutRecord;
  edges_in_some_cut: Edge[];
  edges_in_every_cut: Edge[];
  enumeration: {
    total_cuts: number;
    is_complete: boolean;
    free_zone_size: number;
    cuts: CutRecord[];
  };
}

export interface GlobalConnectivityResult {
  edge_connectivity: {
    lambda: number;
    achieving_source: number;
    achieving_sink: number;
    min_cut_edges: Edge[];
    solver_calls: number;
  };
  node_connectivity: {
    kappa: number;
    achieving_source: number;
    achieving_sink: number;
    min_cut_nodes: number[];
    solver_calls: number;
  };
  global_min_cut: {
    min_cut_capacity: number;
    achieving_source: number;
    achieving_sink: number;
    min_cut_edges: Edge[];
    cut_S: number[];
    cut_T: number[];
    solver_calls: number;
  };
}

export interface CapacityResult {
  metadata: { algorithm: string; tol: number; baseline_max_flow: number };
  flow: FlowState;
  sensitivity: SensitivityResult;
  failure_impact: FailureImpactResult;
  structure: StructuralResult;
  flow_decomposition: FlowDecompositionResult;
  parametric_thresholds: ParametricThresholdResult;
  min_cut_analysis: MinCutAnalysisResult;
  global_connectivity: GlobalConnectivityResult;
  node_capacitated: {
    max_flow: number;
    sink_flow: [number, number][];
    saturated_nodes: number[];
    spof_nodes: number[];
  } | null;
}

export interface FlowAnalysisResponse extends AnalysisEnvelope {
  input: {
    edges_file_path: string;
    capacities_path: string;
    capacity_schema: string;
    source_nodes: number[];
    sink_nodes: number[];
    target_nodes_from_file: number[];
    source_rates_from_file: [number, number][];
  };
  computation_time: number;
  capacity_result: CapacityResult;
}
