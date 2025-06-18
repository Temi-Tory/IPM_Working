import { DiamondData, AnalysisResult } from "./main-sever-interface";

// Graph structure interfaces
export interface GraphStructure {
  edgelist: [number, number][];
  iteration_sets: number[][];
  outgoing_index: { [key: number]: number[] };
  incoming_index: { [key: number]: number[] };
  source_nodes: number[];
  descendants: { [key: string]: number[] };
  ancestors: { [key: string]: number[] };
  join_nodes: number[];
  fork_nodes: number[];
  node_priors: { [key: string]: number };
  edge_probabilities: { [key: string]: number };
  diamond_structures: DiamondData | null;
  
  // Enhanced metadata for new architecture
  readonly metadata?: GraphMetadata;
}

export interface GraphMetadata {
  readonly version: string;
  readonly createdAt: Date;
  readonly lastModified: Date;
  readonly source: 'csv_upload' | 'api_import' | 'manual_creation';
  readonly checksum?: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly complexity: GraphComplexity;
  readonly tags?: string[];
}

export interface GraphComplexity {
  readonly score: number; // 0-100
  readonly factors: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly diamondCount: number;
    readonly cycleCount: number;
    readonly maxDepth: number;
    readonly branchingFactor: number;
  };
}

export interface GraphState {
  isLoaded: boolean;
  csvContent: string;
  structure: GraphStructure | null;
  lastAnalysisResults: AnalysisResult[] | null;
  lastAnalysisType: 'structure' | 'diamond' | 'full' | null;
  error: string | null;
  loadedAt: Date | null;
  
  // Enhanced state tracking for new architecture
  readonly stateVersion?: number;
  readonly isDirty?: boolean;
  readonly lastSavedAt?: Date | null;
  readonly changeHistory?: GraphStateChange[];
}

export interface GraphStateChange {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: 'structure' | 'parameters' | 'analysis' | 'metadata';
  readonly description: string;
  readonly changes: { [field: string]: { previous: any; current: any } };
  readonly source: string;
  readonly correlationId?: string;
}

// Utility types for graph operations
export type NodeId = number;
export type EdgeId = string;
export type NodePriorMap = { [nodeId: string]: number };
export type EdgeProbabilityMap = { [edgeKey: string]: number };

// Graph validation interfaces
export interface GraphValidationResult {
  readonly isValid: boolean;
  readonly errors: GraphValidationError[];
  readonly warnings: GraphValidationWarning[];
  readonly suggestions: GraphValidationSuggestion[];
}

export interface GraphValidationError {
  readonly type: 'structure' | 'data' | 'consistency';
  readonly code: string;
  readonly message: string;
  readonly affectedElements: string[];
  readonly severity: 'critical' | 'error';
}

export interface GraphValidationWarning {
  readonly type: 'performance' | 'best_practice' | 'compatibility';
  readonly code: string;
  readonly message: string;
  readonly affectedElements: string[];
  readonly impact: 'low' | 'medium' | 'high';
}

export interface GraphValidationSuggestion {
  readonly type: 'optimization' | 'enhancement' | 'cleanup';
  readonly message: string;
  readonly action: string;
  readonly benefit: string;
  readonly effort: 'low' | 'medium' | 'high';
}

// Graph query interfaces for advanced operations
export interface GraphQuery {
  readonly type: 'path' | 'reachability' | 'subgraph' | 'pattern';
  readonly parameters: { [key: string]: any };
  readonly options?: GraphQueryOptions;
}

export interface GraphQueryOptions {
  readonly maxResults?: number;
  readonly timeout?: number;
  readonly includeMetadata?: boolean;
  readonly cacheResults?: boolean;
}

export interface GraphQueryResult<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly count: number;
  readonly executionTime: number;
  readonly fromCache: boolean;
  readonly error?: string;
}