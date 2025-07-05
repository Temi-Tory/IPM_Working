/**
 * API Models for Julia Backend Integration
 * Request/Response interfaces for all 6 API endpoints with JSON payload support
 */

import {
  ProbabilityValue,
  NetworkJsonInput,
  EnhancedNetworkData,
  NodeAnalysisResult
} from './network.models';

// ===== BASE API TYPES =====

/**
 * Base API response structure
 */
export interface BaseApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
  processingTime?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: {
    code?: string;
    field?: string;
    value?: unknown;
  };
  timestamp: string;
}

// ===== PROCESS INPUT ENDPOINT =====

/**
 * Process Input Request - supports both CSV and JSON formats
 */
export interface ProcessInputRequest {
  // Legacy CSV support
  csvContent?: string;
  
  // New JSON support - FIXED: Direct format expected by Julia server
  edges?: Array<{source: number; destination: number}>;
  nodePriors?: {
    nodes: Record<string, number>;
    data_type: string;
  };
  edgeProbabilities?: {
    links: Record<string, number>;
    data_type: string;
  };
  
  // Alternative nested format (for backward compatibility)
  jsonData?: NetworkJsonInput;
  
  // Processing options
  options?: {
    validateProbabilities?: boolean;
    normalizeValues?: boolean;
    generateMissingProbabilities?: boolean;
    defaultNodePrior?: ProbabilityValue;
    defaultEdgeProbability?: ProbabilityValue;
  };
}

/**
 * Network data structure from process input
 */
export interface ProcessedNetworkData {
  // Core network structure
  edgelist: number[][];
  outgoingIndex: Record<string, number[]>;
  incomingIndex: Record<string, number[]>;
  sourceNodes: number[];
  sinkNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  
  // Enhanced probability data
  nodePriors: Record<string, ProbabilityValue>;
  edgeProbabilities: Record<string, ProbabilityValue>;
  
  // Network analysis
  iterationSets: number[][];
  ancestors: Record<string, number[]>;
  descendants: Record<string, number[]>;
  
  // Metrics
  nodeCount: number;
  edgeCount: number;
  graphDensity: number;
  maxIterationDepth: number;
  
  // Probability type analysis
  probabilityTypes: {
    nodes: Record<string, Array<'Float64' | 'Interval' | 'P-box'>>;
    edges: Record<string, Array<'Float64' | 'Interval' | 'P-box'>>;
    summary: {
      nodeTypeDistribution: Record<string, number>;
      edgeTypeDistribution: Record<string, number>;
    };
  };
}

/**
 * Statistics from process input
 */
export interface ProcessInputStatistics {
  basic: {
    nodes: number;
    edges: number;
    density: number;
    maxDepth: number;
  };
  nodeTypes: Record<string, number>;
  structural: {
    isolatedNodes: number;
    highDegreeNodes: number;
    iterationSets: number;
  };
  connectivity: {
    stronglyConnectedComponents: number;
    avgPathLength: number;
    hasIsolatedNodes: boolean;
  };
  probabilityAnalysis: {
    nodeUncertaintyMetrics: {
      totalUncertainNodes: number;
      intervalNodes: number;
      pboxNodes: number;
      avgUncertaintyWidth: number;
    };
    edgeUncertaintyMetrics: {
      totalUncertainEdges: number;
      intervalEdges: number;
      pboxEdges: number;
      avgUncertaintyWidth: number;
    };
  };
}

/**
 * Summary from process input
 */
export interface ProcessInputSummary {
  analysisType: string;
  inputFormat: 'CSV' | 'JSON';
  nodes: number;
  edges: number;
  sources: number;
  sinks: number;
  forks: number;
  joins: number;
  density: number;
  maxDepth: number;
  probabilityComplexity: 'Simple' | 'Interval' | 'P-box' | 'Mixed';
  processingTime: string;
}

/**
 * Enhanced Process Input Response with comprehensive network data
 */
export interface ProcessInputResponse extends BaseApiResponse {
  data: {
    networkData: ProcessedNetworkData;
    statistics: ProcessInputStatistics;
    summary: ProcessInputSummary;
  };
}

// ===== REACHABILITY ANALYSIS ENDPOINT =====

/**
 * Reachability Analysis Request with enhanced probability support
 */
export interface ReachabilityRequest {
  // Input data
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  
  // Parameter overrides
  nodePrior?: ProbabilityValue;
  edgeProb?: ProbabilityValue;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  
  // Individual overrides
  useIndividualOverrides?: boolean;
  individualNodePriors?: Record<string, ProbabilityValue>;
  individualEdgeProbabilities?: Record<string, ProbabilityValue>;
  
  // Analysis options
  options?: {
    uncertaintyPropagation?: 'monte_carlo' | 'interval_arithmetic' | 'pbox_arithmetic';
    monteCarloSamples?: number;
    confidenceLevel?: number;
    convergenceThreshold?: number;
  };
}

/**
 * Parameter modifications for reachability
 */
export interface ReachabilityParameterModifications {
  appliedNodeOverrides: Record<string, ProbabilityValue>;
  appliedEdgeOverrides: Record<string, ProbabilityValue>;
  globalModifications: {
    nodeOverride: boolean;
    edgeOverride: boolean;
  };
}

/**
 * Result statistics for reachability
 */
export interface ReachabilityResultStatistics {
  totalNodes: number;
  probabilityDistribution: Record<string, number>;
  nodeTypeAnalysis: Record<string, unknown>;
  reachabilityMetrics: {
    overallMean: number;
    overallMin: number;
    overallMax: number;
    standardDeviation: number;
    highReachabilityNodes: number;
    lowReachabilityNodes: number;
    perfectReachabilityNodes: number;
    unreachableNodes: number;
  };
  uncertaintyMetrics?: {
    avgUncertaintyWidth: number;
    maxUncertaintyWidth: number;
    nodesWithUncertainty: number;
    uncertaintyDistribution: Record<string, number>;
  };
  insights: string[];
}

/**
 * Enhanced Reachability Analysis Response
 */
export interface ReachabilityResponse extends BaseApiResponse {
  data: {
    results: NodeAnalysisResult[];
    networkData: EnhancedNetworkData;
    originalParameters: {
      nodePriors: Record<string, ProbabilityValue>;
      edgeProbabilities: Record<string, ProbabilityValue>;
    };
    parameterModifications: ReachabilityParameterModifications;
    resultStatistics: ReachabilityResultStatistics;
    summary: {
      analysisType: string;
      uncertaintyMethod: string;
      nodes: number;
      edges: number;
      diamonds: number;
      resultsGenerated: number;
      parametersModified: boolean;
      maxIterationDepth: number;
      processingTime: string;
    };
  };
}

// ===== DIAMOND PROCESSING ENDPOINT =====

/**
 * Diamond Processing Request
 */
export interface DiamondProcessingRequest {
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  
  options?: {
    includeNestedDiamonds?: boolean;
    minDiamondSize?: number;
    maxDiamondSize?: number;
    analyzeProbabilityFlow?: boolean;
  };
}

/**
 * Diamond structure data
 */
export interface DiamondStructure {
  id: string;
  nodes: number[];
  edges: Array<{ source: number; target: number; probability?: ProbabilityValue }>;
  type: string;
  size: number;
  depth: number;
  probabilityFlow?: {
    inputProbability: ProbabilityValue;
    outputProbability: ProbabilityValue;
    flowEfficiency: number;
  };
}

/**
 * Enhanced Diamond Processing Response
 */
export interface DiamondProcessingResponse extends BaseApiResponse {
  data: {
    diamondStructures: DiamondStructure[];
    statistics: {
      totalDiamonds: number;
      averageSize: number;
      maxDepth: number;
      typeDistribution: Record<string, number>;
      probabilityFlowAnalysis?: {
        avgFlowEfficiency: number;
        highEfficiencyDiamonds: number;
        lowEfficiencyDiamonds: number;
      };
    };
    summary: {
      analysisType: string;
      diamonds: number;
      avgSize: number;
      maxDepth: number;
      probabilityAnalysis: boolean;
      processingTime: string;
    };
  };
}

// ===== MONTE CARLO ENDPOINT =====

/**
 * Monte Carlo Analysis Request
 */
export interface MonteCarloRequest {
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  
  // Simulation parameters
  iterations?: number;
  confidenceLevel?: number;
  convergenceThreshold?: number;
  
  // Parameter overrides
  nodePrior?: ProbabilityValue;
  edgeProb?: ProbabilityValue;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  
  // Individual overrides
  useIndividualOverrides?: boolean;
  individualNodePriors?: Record<string, ProbabilityValue>;
  individualEdgeProbabilities?: Record<string, ProbabilityValue>;
  
  // Advanced options
  options?: {
    samplingMethod?: 'uniform' | 'latin_hypercube' | 'sobol';
    parallelization?: boolean;
    seedValue?: number;
    outputDistributions?: boolean;
  };
}

/**
 * Monte Carlo result with distribution data
 */
export interface MonteCarloNodeResult extends NodeAnalysisResult {
  distribution?: {
    samples: number[];
    histogram: { bins: number[]; counts: number[] };
    percentiles: Record<string, number>;
  };
}

/**
 * Enhanced Monte Carlo Analysis Response
 */
export interface MonteCarloResponse extends BaseApiResponse {
  data: {
    results: MonteCarloNodeResult[];
    simulationMetrics: {
      iterations: number;
      convergence: boolean;
      executionTime: number;
      samplingMethod: string;
      effectiveSampleSize: number;
      convergenceIteration?: number;
    };
    uncertaintyAnalysis: {
      totalUncertaintyContribution: Record<string, number>;
      sensitivityAnalysis: Array<{
        parameter: string;
        type: 'node' | 'edge';
        sensitivity: number;
        contribution: number;
      }>;
      correlationMatrix?: number[][];
    };
    summary: {
      analysisType: string;
      iterations: number;
      nodes: number;
      converged: boolean;
      samplingMethod: string;
      processingTime: string;
    };
  };
}

// ===== PATH ENUMERATION ENDPOINT =====

/**
 * Path Enumeration Request
 */
export interface PathEnumerationRequest {
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  
  // Path analysis options
  sourceNodes?: number[];
  targetNodes?: number[];
  maxPathLength?: number;
  maxPaths?: number;
  
  options?: {
    includeProbabilities?: boolean;
    sortByProbability?: boolean;
    filterMinProbability?: number;
    analyzePathReliability?: boolean;
  };
}

/**
 * Network path data
 */
export interface NetworkPath {
  id: string;
  nodes: number[];
  edges: Array<{ source: number; target: number }>;
  length: number;
  probability?: ProbabilityValue;
  reliability?: number;
}

/**
 * Path Enumeration Response
 */
export interface PathEnumerationResponse extends BaseApiResponse {
  data: {
    paths: NetworkPath[];
    pathStatistics: {
      totalPaths: number;
      averageLength: number;
      maxLength: number;
      probabilityDistribution: Record<string, number>;
      reliabilityMetrics?: {
        avgReliability: number;
        highReliabilityPaths: number;
        criticalPaths: number;
      };
    };
    summary: {
      analysisType: string;
      totalPaths: number;
      avgLength: number;
      maxLength: number;
      probabilityAnalysis: boolean;
      processingTime: string;
    };
  };
}

// ===== DIAMOND CLASSIFICATION ENDPOINT =====

/**
 * Diamond Classification Request
 */
export interface DiamondClassificationRequest {
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  
  options?: {
    classificationCriteria?: Array<'size' | 'depth' | 'probability' | 'topology'>;
    includeSubDiamonds?: boolean;
    probabilityThresholds?: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

/**
 * Diamond classification data
 */
export interface DiamondClassification {
  diamondId: string;
  class: string;
  confidence: number;
  features: {
    size: number;
    depth: number;
    topology: string;
    probabilityMetrics?: {
      avgProbability: ProbabilityValue;
      probabilityVariance: number;
      criticalityScore: number;
    };
  };
}

/**
 * Diamond Classification Response
 */
export interface DiamondClassificationResponse extends BaseApiResponse {
  data: {
    classifications: DiamondClassification[];
    classificationSummary: {
      totalDiamonds: number;
      classDistribution: Record<string, number>;
      avgConfidence: number;
      featureImportance: Record<string, number>;
    };
    summary: {
      analysisType: string;
      diamonds: number;
      classes: number;
      avgConfidence: number;
      processingTime: string;
    };
  };
}

// ===== UTILITY TYPES AND FUNCTIONS =====

/**
 * Union type for all API request types
 */
export type ApiRequest = 
  | ProcessInputRequest
  | ReachabilityRequest
  | DiamondProcessingRequest
  | MonteCarloRequest
  | PathEnumerationRequest
  | DiamondClassificationRequest;

/**
 * Union type for all API response types
 */
export type ApiResponse = 
  | ProcessInputResponse
  | ReachabilityResponse
  | DiamondProcessingResponse
  | MonteCarloResponse
  | PathEnumerationResponse
  | DiamondClassificationResponse;

/**
 * API endpoint configuration
 */
export interface ApiEndpointConfig {
  path: string;
  method: 'GET' | 'POST';
  timeout: number;
  retries: number;
  description: string;
}

/**
 * All available API endpoints
 */
export const API_ENDPOINTS: Record<string, ApiEndpointConfig> = {
  processInput: {
    path: '/api/processinput',
    method: 'POST',
    timeout: 30000,
    retries: 3,
    description: 'Process network input and generate network structure'
  },
  reachability: {
    path: '/api/reachabilitymodule',
    method: 'POST',
    timeout: 60000,
    retries: 2,
    description: 'Run reachability analysis with uncertainty propagation'
  },
  diamondProcessing: {
    path: '/api/diamondprocessing',
    method: 'POST',
    timeout: 45000,
    retries: 2,
    description: 'Identify and analyze diamond structures'
  },
  monteCarlo: {
    path: '/api/montecarlo',
    method: 'POST',
    timeout: 120000,
    retries: 1,
    description: 'Run Monte Carlo simulation analysis'
  },
  pathEnumeration: {
    path: '/api/pathenum',
    method: 'POST',
    timeout: 60000,
    retries: 2,
    description: 'Enumerate and analyze network paths'
  },
  diamondClassification: {
    path: '/api/diamondclassification',
    method: 'POST',
    timeout: 45000,
    retries: 2,
    description: 'Classify diamond structures by type and properties'
  }
};

/**
 * Type guard for successful API responses
 */
export function isSuccessfulResponse<T>(response: BaseApiResponse<T>): response is BaseApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard for error API responses
 */
export function isErrorResponse(response: BaseApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Extract error message from API response
 */
export function extractErrorMessage(response: BaseApiResponse): string {
  if (isErrorResponse(response)) {
    return response.error;
  }
  return response.error || 'Unknown API error';
}

/**
 * Create default request options
 */
export function createDefaultRequestOptions(): {
  validateProbabilities: boolean;
  normalizeValues: boolean;
  generateMissingProbabilities: boolean;
} {
  return {
    validateProbabilities: true,
    normalizeValues: true,
    generateMissingProbabilities: false
  };
}