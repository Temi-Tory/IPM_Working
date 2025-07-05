/**
 * Network Models for JSON-based Information Propagation Analysis
 * Comprehensive TypeScript interfaces matching Julia framework JSON structures
 */

// ===== PROBABILITY VALUE TYPES =====

/**
 * Base interface for all probability value types
 */
export interface ProbabilityValueBase {
  type: 'Float64' | 'Interval' | 'P-box';
}

/**
 * Simple floating-point probability value
 */
export interface Float64ProbabilityValue extends ProbabilityValueBase {
  type: 'Float64';
  value: number;
}

/**
 * Interval-based probability value with lower and upper bounds
 */
export interface IntervalProbabilityValue extends ProbabilityValueBase {
  type: 'Interval';
  lower: number;
  upper: number;
}

/**
 * P-box (Probability box) with distribution parameters
 */
export interface PBoxProbabilityValue extends ProbabilityValueBase {
  type: 'P-box';
  distribution: string;
  parameters: Record<string, number>;
  bounds?: {
    lower: number;
    upper: number;
  };
}

/**
 * Union type for all probability value types
 */
export type ProbabilityValue = Float64ProbabilityValue | IntervalProbabilityValue | PBoxProbabilityValue;

// ===== JSON INPUT STRUCTURES =====

/**
 * Node priors structure for JSON input
 */
export interface NodePriorsJson {
  [nodeId: string]: ProbabilityValue;
}

/**
 * Link probabilities structure for JSON input
 */
export interface LinkProbabilitiesJson {
  [edgeKey: string]: ProbabilityValue; // Format: "source,target" or "(source,target)"
}

/**
 * Edge list entry for JSON input
 */
export interface EdgeListEntry {
  source: number;
  target: number;
  probability?: ProbabilityValue;
}

/**
 * Complete JSON network input structure (matches Julia server expectations)
 */
export interface NetworkJsonInput {
  edges: Array<{ source: number; destination: number }>;
  nodePriors?: {
    nodes: NodePriorsJson;
    data_type: string;
  };
  edgeProbabilities?: {
    links: LinkProbabilitiesJson;
    data_type: string;
  };
  metadata?: {
    name?: string;
    description?: string;
    created?: string;
    version?: string;
  };
}

// ===== ENHANCED NETWORK DATA STRUCTURES =====

/**
 * Enhanced node interface supporting probability values
 */
export interface NetworkNode {
  id: number;
  label: string;
  probability?: ProbabilityValue;
  type?: 'source' | 'fork' | 'join' | 'sink' | 'regular';
  metadata?: {
    position?: { x: number; y: number };
    group?: string;
    importance?: number;
  };
}

/**
 * Enhanced edge interface supporting probability values
 */
export interface NetworkEdge {
  id: string;
  source: number;
  target: number;
  probability?: ProbabilityValue;
  metadata?: {
    weight?: number;
    capacity?: number;
    type?: string;
  };
}

/**
 * Comprehensive network data structure
 */
export interface EnhancedNetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  adjacencyMatrix: number[][];
  sourceNodes: number[];
  sinkNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  outgoingIndex: Record<number, number[]>;
  incomingIndex: Record<number, number[]>;
  
  // Enhanced metadata
  metadata?: {
    name?: string;
    description?: string;
    created?: string;
    version?: string;
    probabilityTypes: {
      nodes: Array<'Float64' | 'Interval' | 'P-box'>;
      edges: Array<'Float64' | 'Interval' | 'P-box'>;
    };
  };
  
  // Statistics from API
  statistics?: {
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
    probabilityDistribution: {
      nodeTypes: Record<string, number>;
      edgeTypes: Record<string, number>;
    };
  };
}

// ===== FILE UPLOAD TYPES =====

/**
 * Supported file types for network input
 */
export type NetworkFileType = 'edge' | 'json' | 'csv';

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  type: NetworkFileType;
  accept: string[];
  maxSize: number; // in bytes
  description: string;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileSize: number;
    lineCount?: number;
    nodeCount?: number;
    edgeCount?: number;
    probabilityTypes?: Array<'Float64' | 'Interval' | 'P-box'>;
  };
}

/**
 * Uploaded file data
 */
export interface UploadedFileData {
  file: File;
  type: NetworkFileType;
  content: string;
  validation: FileValidationResult;
  parsed?: NetworkJsonInput;
}

/**
 * Collection of uploaded files
 */
export interface NetworkFileCollection {
  primary?: UploadedFileData; // Main network file (.json or .edge)
  nodeProbs?: UploadedFileData; // Optional node probabilities
  edgeProbs?: UploadedFileData; // Optional edge probabilities
  metadata?: {
    uploadedAt: string;
    totalFiles: number;
    primaryFormat: NetworkFileType;
  };
}

// ===== ANALYSIS RESULT TYPES =====

/**
 * Node analysis result with probability value
 */
export interface NodeAnalysisResult {
  nodeId: number;
  probability: ProbabilityValue;
  confidence?: number;
  metadata?: {
    iterations?: number;
    convergence?: boolean;
    bounds?: { lower: number; upper: number };
  };
}

/**
 * Edge analysis result with probability value
 */
export interface EdgeAnalysisResult {
  edgeId: string;
  source: number;
  target: number;
  probability: ProbabilityValue;
  utilization?: number;
  metadata?: {
    capacity?: number;
    flow?: number;
    criticality?: number;
  };
}

/**
 * Comprehensive analysis results
 */
export interface NetworkAnalysisResults {
  nodes: NodeAnalysisResult[];
  edges: EdgeAnalysisResult[];
  summary: {
    analysisType: string;
    totalNodes: number;
    totalEdges: number;
    processingTime: string;
    convergence?: boolean;
    iterations?: number;
  };
  statistics: {
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
    probabilityDistribution: Record<string, number>;
    nodeTypeAnalysis: Record<string, unknown>;
    insights: string[];
  };
}

// ===== UTILITY TYPES =====

/**
 * Type guard for Float64 probability values
 */
export function isFloat64Probability(value: ProbabilityValue): value is Float64ProbabilityValue {
  return value.type === 'Float64';
}

/**
 * Type guard for Interval probability values
 */
export function isIntervalProbability(value: ProbabilityValue): value is IntervalProbabilityValue {
  return value.type === 'Interval';
}

/**
 * Type guard for P-box probability values
 */
export function isPBoxProbability(value: ProbabilityValue): value is PBoxProbabilityValue {
  return value.type === 'P-box';
}

/**
 * Extract numeric value from probability (for display/calculation)
 */
export function extractProbabilityValue(prob: ProbabilityValue): number {
  switch (prob.type) {
    case 'Float64':
      return prob.value;
    case 'Interval':
      return (prob.lower + prob.upper) / 2; // Use midpoint
    case 'P-box':
      return prob.bounds ? (prob.bounds.lower + prob.bounds.upper) / 2 : 0.5;
    default:
      return 0;
  }
}

/**
 * Convert simple number to Float64 probability value
 */
export function createFloat64Probability(value: number): Float64ProbabilityValue {
  return {
    type: 'Float64',
    value: Math.max(0, Math.min(1, value)) // Clamp to [0,1]
  };
}

/**
 * Convert bounds to Interval probability value
 */
export function createIntervalProbability(lower: number, upper: number): IntervalProbabilityValue {
  return {
    type: 'Interval',
    lower: Math.max(0, Math.min(1, lower)),
    upper: Math.max(0, Math.min(1, upper))
  };
}

/**
 * Create P-box probability value
 */
export function createPBoxProbability(
  distribution: string,
  parameters: Record<string, number>,
  bounds?: { lower: number; upper: number }
): PBoxProbabilityValue {
  return {
    type: 'P-box',
    distribution,
    parameters,
    bounds: bounds ? {
      lower: Math.max(0, Math.min(1, bounds.lower)),
      upper: Math.max(0, Math.min(1, bounds.upper))
    } : undefined
  };
}

// ===== CONSTANTS =====

/**
 * File upload configurations
 */
export const FILE_UPLOAD_CONFIGS: Record<NetworkFileType, FileUploadConfig> = {
  json: {
    type: 'json',
    accept: ['.json'],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'JSON network file with nodes, edges, and probability values'
  },
  edge: {
    type: 'edge',
    accept: ['.edge', '.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'Edge list file with source-target pairs'
  },
  csv: {
    type: 'csv',
    accept: ['.csv'],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'CSV file with network data (legacy format)'
  }
};

/**
 * Supported probability distributions for P-box
 */
export const SUPPORTED_DISTRIBUTIONS = [
  'uniform',
  'normal',
  'beta',
  'gamma',
  'exponential',
  'weibull',
  'lognormal'
] as const;

export type SupportedDistribution = typeof SUPPORTED_DISTRIBUTIONS[number];