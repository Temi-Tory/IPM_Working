/**
 * Core network analysis data models and interfaces
 */

// Base network structure interfaces
export interface NetworkNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  metadata?: Record<string, any>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
  probability?: number;
  metadata?: Record<string, any>;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  directed: boolean;
  metadata?: {
    name?: string;
    description?: string;
    nodeCount: number;
    edgeCount: number;
    [key: string]: any;
  };
}

// Probability type definitions
export type ProbabilityType = 'float' | 'interval' | 'pbox';

export interface IntervalProbability {
  lower: number;
  upper: number;
}

export interface PBoxProbability {
  bounds: number[];
  weights: number[];
}

export type ProbabilityValue = number | IntervalProbability | PBoxProbability;

// Network upload and processing
export interface NetworkUploadRequest {
  networkFile: File;
  probabilityType: ProbabilityType;
  nodePriorsFile?: File;
  linkProbabilitiesFile?: File;
}

export interface NetworkUploadResponse {
  success: boolean;
  sessionId: string;
  networkId: string;
  message: string;
  networkSummary?: {
    nodeCount: number;
    edgeCount: number;
    isDirected: boolean;
  };
}

// Diamond analysis interfaces
export interface DiamondNode {
  nodeId: string;
  classification: 'source' | 'sink' | 'intermediate' | 'isolated';
  inDegree: number;
  outDegree: number;
  reachableNodes: string[];
  reachingNodes: string[];
}

export interface DiamondAnalysisResult {
  sessionId: string;
  networkId: string;
  nodes: DiamondNode[];
  summary: {
    sourceCount: number;
    sinkCount: number;
    intermediateCount: number;
    isolatedCount: number;
  };
  processingTime: number;
}

// Reachability analysis interfaces
export interface ReachabilityQuery {
  sourceNodes: string[];
  targetNodes: string[];
  maxDepth?: number;
}

export interface ReachabilityPath {
  path: string[];
  probability: ProbabilityValue;
  length: number;
}

export interface ReachabilityResult {
  sessionId: string;
  networkId: string;
  query: ReachabilityQuery;
  paths: ReachabilityPath[];
  totalProbability: ProbabilityValue;
  summary: {
    pathCount: number;
    averageLength: number;
    maxLength: number;
    minLength: number;
  };
  processingTime: number;
}

// Monte Carlo simulation interfaces
export interface MonteCarloConfig {
  iterations: number;
  seed?: number;
  convergenceThreshold?: number;
  maxIterations?: number;
}

export interface MonteCarloResult {
  sessionId: string;
  networkId: string;
  config: MonteCarloConfig;
  results: {
    meanProbability: number;
    standardDeviation: number;
    confidenceInterval: {
      lower: number;
      upper: number;
      level: number;
    };
    convergenceAchieved: boolean;
    actualIterations: number;
  };
  processingTime: number;
}

// Session and state management
export interface NetworkSession {
  sessionId: string;
  networkId: string;
  createdAt: Date;
  lastAccessed: Date;
  networkGraph?: NetworkGraph;
  probabilityType: ProbabilityType;
  analysisResults: {
    diamond?: DiamondAnalysisResult;
    reachability?: ReachabilityResult[];
    monteCarlo?: MonteCarloResult[];
  };
}

// API response wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Workflow state definitions
export type WorkflowStep = 
  | 'network-upload'
  | 'network-structure'
  | 'diamond-analysis'
  | 'reachability-analysis'
  | 'monte-carlo'
  | 'results';

export interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  canProceedToStep: (step: WorkflowStep) => boolean;
  isStepAccessible: (step: WorkflowStep) => boolean;
}

// File upload interfaces
export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}