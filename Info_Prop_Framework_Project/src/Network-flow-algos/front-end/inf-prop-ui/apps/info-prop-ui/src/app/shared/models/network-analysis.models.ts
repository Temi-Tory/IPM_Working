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

export interface NetworkAnalysisResponse {
  success: boolean;
  network_name?: string;
  timestamp: string;
  error?: string;
  analysis_config?: AnalysisConfiguration;
  results?: {
    network_structure?: {
      total_nodes: number;
      total_edges: number;
      source_nodes: number[];
      sink_nodes: number[];
      fork_nodes: number[];
      join_nodes: number[];
      iteration_sets_count: number;
    };
    exact_inference?: {
      node_beliefs: Record<string, number>;
      top_beliefs: Record<string, number>;
      execution_time: number;
      data_type: DataType;
      algorithm_type: string;
      error?: string;
    };
    diamond_analysis?: {
      root_diamonds_count: number;
      unique_diamonds_count: number;
      join_nodes_with_diamonds: number[];
      classifications: Record<string, any>;
      diamond_efficiency: number;
      has_complex_diamonds: boolean;
    };
    flow_analysis?: {
      network_utilization: number;
      target_flows: Record<string, number>;
      total_source_input: number;
      total_target_output: number;
      active_sources: number[];
      execution_time: number;
      error?: string;
    };
    critical_path?: {
      time_analysis?: {
        critical_duration: number;
        critical_nodes: number[];
        node_values: Record<string, number>;
      };
      cost_analysis?: {
        total_cost: number;
        critical_nodes: number[];
        node_values: Record<string, number>;
      };
      execution_time: number;
      error?: string;
    };
  };
}

export interface BackendHealthResponse {
  status: 'healthy' | 'error';
  timestamp: string;
  server?: string;
  version?: string;
  error?: string;
  details?: any;
}