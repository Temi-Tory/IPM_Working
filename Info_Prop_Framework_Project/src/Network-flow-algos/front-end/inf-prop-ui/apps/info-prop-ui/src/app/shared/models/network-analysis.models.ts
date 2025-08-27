export type DataType = 'float' | 'interval' | 'pbox';

export interface NetworkFile {
  file: File;
  path: string;
  isValid: boolean;
  error?: string;
}

export interface DetectedNetworkStructure {
  networkName: string;
  hasEdgesFile: boolean;
  hasNodeMapping: boolean;
  availableDataTypes: DataType[];
  hasCapacityData: boolean;
  hasCPMData: boolean;
  detectedFiles: {
    edges?: NetworkFile;
    nodeMapping?: NetworkFile;
    inference?: {
      [K in DataType]?: {
        nodepriors?: NetworkFile;
        linkprobabilities?: NetworkFile;
      };
    };
    capacity?: NetworkFile;
    criticalPath?: NetworkFile;
  };
  errors: string[];
  warnings: string[];
}

export interface AnalysisConfiguration {
  basicStructure: boolean;
  diamondAnalysis: boolean;
  exactInference: boolean;
  flowAnalysis: boolean;
  criticalPathAnalysis: boolean;
  nodeVisualization: boolean;
  inferenceDataType?: DataType;
  criticalPathOptions?: {
    enableTime: boolean;
    enableCost: boolean;
  };
}

export interface NetworkAnalysisRequest {
  networkName: string;
  files: {
    edges: File;
    nodeMapping?: File;
    inference?: {
      dataType: DataType;
      nodepriors: File;
      linkprobabilities: File;
    };
    capacity?: {
      capacities: File;
    };
    criticalPath?: {
      enableTime: boolean;
      enableCost: boolean;
      cpmInputs: File;
    };
  };
  analysesToRun: AnalysisConfiguration;
}

export interface UploadProgress {
  uploading: boolean;
  progress: number;
  message: string;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  networkName?: string;
  errors: string[];
  warnings: string[];
  structure?: DetectedNetworkStructure;
}

// API Response Interfaces

export interface AnalysisConfig {
  exactInference: boolean;
  flowAnalysis: boolean;
  diamondAnalysis: boolean;
  inference_data_type: 'float' | 'interval' | 'pbox';
  inferenceDataType: 'float' | 'interval' | 'pbox';
  networkName: string;
  criticalPathAnalysis: boolean;
  basicStructure: boolean;
}

export interface NetworkStructureResult {
  // Basic counts
  total_nodes: number;
  total_edges: number;

  // Node classifications
  source_nodes: number[];
  sink_nodes: number[];
  fork_nodes: number[];
  join_nodes: number[];
  all_nodes: number[];

  // Network topology
  edgelist: [number, number][];
  outgoing_index: Record<number, number[]>;
  incoming_index: Record<number, number[]>;

  // Analysis metadata
  iteration_sets: number[][];
  iteration_sets_count: number;
  ancestors: Record<number, number[]>;
  descendants: Record<number, number[]>;

  // Probabilistic data
  node_priors?: Record<number, number>;
  edge_probabilities?: Record<string, number>; // key format: "from_to"

  // Optional analysis data
  cpm_data?: {
    time_values?: Record<number, number>;
    cost_values?: Record<number, number>;
    [key: string]: any;
  };
  capacity_data?: Record<number, number>;
}

export interface DiamondClassification {
  fork_count: number;
  relevant_nodes: number[];
  fork_nodes: number[];
  fork_structure: string;
  internal_joins: number;
  complexity_score: number;
  internal_structure: string;
  external_connectivity: string;
  subgraph_size: number;
  degeneracy: string;
  path_count: number;
  source_nodes: number[];
  conditioning_nodes: number[];
  bottleneck_risk: string;
  path_topology: string;
  edge_count: number;
  is_maximal: boolean;
  internal_forks: number;
  join_structure: string;
  optimization_potential: string;
}

export interface DiamondAnalysisResult {
  diamond_efficiency: number;
  has_complex_diamonds: boolean;
  total_classifications: number;
  join_nodes_with_diamonds: number[];
  unique_diamonds_count: number;
  root_diamonds_count: number;
  root_classifications: Record<string, DiamondClassification>;
  unique_classifications: Record<string, DiamondClassification>;
}

export type FloatBelief = number;

export interface IntervalBelief {
  lower: number;
  upper: number;
}

export interface PboxBelief {
  type: 'pbox';
  mean_lower: number;
  mean_upper: number;
  var_lower: number;
  var_upper: number;
  shape: string;
  n: number;
  name: string;
}

export interface ExactInferenceResult {
  node_beliefs: Record<string, FloatBelief | IntervalBelief | PboxBelief>;
  execution_time: number;
  data_type: 'float' | 'interval' | 'pbox';
  algorithm_type: 'belief_propagation';
}

export interface FlowAnalysisResult {
  network_utilization: number;
  total_source_input: number;
  active_sources: number[];
  total_target_output: number;
  target_flows: Record<string, number>;
  execution_time: number;
}

export interface CriticalPathResult {
  time_analysis: {
    critical_duration: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  cost_analysis: {
    total_cost: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  execution_time: number;
}

export interface NetworkAnalysisResults {
  network_structure: NetworkStructureResult;
  diamond_analysis?: DiamondAnalysisResult;
  exact_inference?: ExactInferenceResult;
  flow_analysis?: FlowAnalysisResult;
  critical_path?: CriticalPathResult;
}

export interface NetworkAnalysisResponse {
  success: boolean;
  network_name: string;
  timestamp: string;
  analysis_config: AnalysisConfig;
  results: NetworkAnalysisResults;
  error?: string;
}

export interface BackendHealthResponse {
  status: 'healthy' | 'error';
  timestamp: string;
  server?: string;
  version?: string;
  error?: string;
  details?: any;
}