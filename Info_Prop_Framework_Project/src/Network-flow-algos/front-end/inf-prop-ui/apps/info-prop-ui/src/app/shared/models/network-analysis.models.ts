export interface PboxData {
  type: 'pbox';
  discretization_size: number;
  mean_lower: number;
  mean_upper: number;
  var_lower: number;
  var_upper: number;
  shape: string;
  name: string;
  bounded: boolean;
  bounds_summary: {
    left_min: number;
    left_max: number;
    right_min: number;
    right_max: number;
  };
}

export interface IntervalData {
  lower: number;
  upper: number;
  type: 'interval';
}

export type BeliefValue = number | IntervalData | PboxData;

export interface NetworkStructure {
  computation_time: number;
  total_nodes: number;
  total_edges: number;
  nodes: number[];
  edges: [number, number][];
  source_nodes: number[];
  sink_nodes: number[];
  fork_nodes: number[];
  join_nodes: number[];
  iteration_sets: number[][];
  iteration_sets_count: number;
  ancestors: Record<string, number[]>;
  descendants: Record<string, number[]>;
  outgoing_index: Record<string, number[]>;
  incoming_index: Record<string, number[]>;
}

export interface RootDiamondStructure {
  join_node: number;
  diamond: {
    conditioning_nodes: number[];
    relevant_nodes: number[];
    edgelist: [number, number][];
    edge_count: number;
    node_count: number;
  };
  non_diamond_parents: number[];
}

export interface UniqueDiamondStructure {
  diamond_hash: string;
  is_root_diamond: boolean;
  sub_outgoing_index: Record<string, number[]>;
  sub_incoming_index: Record<string, number[]>;
  sub_sources: number[];
  sub_fork_nodes: number[];
  sub_join_nodes: number[];
  sub_ancestors: Record<string, number[]>;
  sub_descendants: Record<string, number[]>;
  sub_iteration_sets: number[][];
  sub_iteration_sets_count: number;
  sub_node_priors: Record<string, BeliefValue>;
  node_count: number;
}

export interface DiamondAnalysisResult {
  root_diamonds_count: number;
  unique_diamonds_count: number;
  join_nodes_with_diamonds: number[];
  root_computation_time: number;
  unique_computation_time: number;
  total_computation_time: number;
  diamond_efficiency: number;
  note?: string;
  // **NEW: Raw diamond structures (two different types)**
  raw_root_diamonds?: Record<string, RootDiamondStructure>;
  raw_unique_diamonds?: Record<string, UniqueDiamondStructure>;
}

export interface ExactInferenceResult {
  beliefs: Record<string, BeliefValue>;
  computation_time: number;
  total_nodes_processed: number;
  belief_statistics: {
    mean: number;
    min: number;
    max: number;
  };
}

export interface ReachabilityScenario {
  diamond_analysis?: DiamondAnalysisResult;
  exact_inference?: ExactInferenceResult;
  scenario_computation_time: number;
  input_files: {
    nodepriors_path: string;
    linkprobs_path: string;
  };
}

export interface RawCapacityResult {
  node_max_flows: Record<string, number>;
  bottlenecks: Record<string, any[]>; // Vector of mixed types (nodes, edges, symbols)
  critical_paths: Record<string, number[][]>; // Multiple paths per target
  network_utilization: number;
  analysis_type: string;
  computation_time: number;
  convergence_info: Record<string, any>;
}

export interface CapacityScenario {
  computation_time: number;
  network_utilization: number;
  total_source_input: number;
  total_target_output: number;
  target_flows: Record<string, number>;
  source_inputs?: Record<string, number>;
  active_sources: number[];
  target_nodes: number[];
  node_capacities_count: number;
  edge_capacities_count: number;
  input_files: {
    capacities_path: string;
  };
  // **NEW: Complete raw capacity results**
  raw_capacity_result?: RawCapacityResult;
}

export interface CpmScenario {
  computation_time: number;
  time_result: {
    critical_value: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  cost_result: {
    critical_value: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  node_durations_count: number;
  edge_delays_count: number;
  node_costs_count: number;
  edge_costs_count: number;
  input_files: {
    cpm_path: string;
  };
}

export interface AnalysisResponse {
  success: boolean;
  message: string;
  network_name?: string;
  timestamp?: string;
  analysis_config?: {
    reachabilityScenarios: ReachabilityScenarioConfig[];
    capacityScenarios: CapacityScenarioConfig[];
    cpmScenarios: CpmScenarioConfig[];
    networkPath: string;
    analysisConfig: AnalysisRequestConfig;
  };
  results?: {
    network_structure: NetworkStructure;
    reachability_scenarios?: Record<string, ReachabilityScenario>;
    diamond_analysis?: DiamondAnalysisResult;
    capacity_scenarios?: Record<string, CapacityScenario>;
    cpm_scenarios?: Record<string, CpmScenario>;
    analysis_summary: {
      network_name: string;
      total_computation_time: number;
      reachability_scenarios_count: number;
      capacity_scenarios_count: number;
      cpm_scenarios_count: number;
      timestamp: string;
    };
  };
  error?: string;
}

export interface ReachabilityScenarioConfig {
  name: string;
  nodepriors_path: string;
  linkprobs_path: string;
}

export interface CapacityScenarioConfig {
  name: string;
  capacities_path: string;
}

export interface CpmScenarioConfig {
  name: string;
  cpm_path: string;
}

export interface AnalysisRequestConfig {
  exactInference: boolean;
  diamondAnalysis: boolean;
  flowAnalysis: boolean;
  criticalPath: boolean;
}

export interface AnalysisRequest {
  networkPath: string;
  reachabilityScenarios: ReachabilityScenarioConfig[];
  capacityScenarios: CapacityScenarioConfig[];
  cpmScenarios: CpmScenarioConfig[];
  analysisConfig: AnalysisRequestConfig;
}

export interface HealthResponse {
  status: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  network_path?: string;
  validation_results?: {
    is_valid: boolean;
    message: string;
    structure_info?: {
      total_nodes: number;
      total_edges: number;
      source_nodes: number[];
      sink_nodes: number[];
    };
  };
}

export interface TabState {
  enabled: boolean;
  completed: boolean;
  hasData: boolean;
}

export interface AnalysisState {
  currentStep: string;
  completedSteps: Set<string>;
  networkData: NetworkStructure | null;
  analysisResults: AnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
}

export interface NetworkNode {
  id: number;
  type: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  x?: number;
  y?: number;
  belief?: BeliefValue;
  flow?: number;
  capacity?: number;
  duration?: number;
  cost?: number;
  isCritical?: boolean;
}

export interface NetworkEdge {
  source: number;
  target: number;
  probability?: number;
  capacity?: number;
  delay?: number;
  cost?: number;
  flow?: number;
  isCritical?: boolean;
}

export type VisualizationMode = 'structure' | 'beliefs' | 'flows' | 'critical-path';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}