/**
 * Diamond Data Models for Network Analysis Framework
 * 
 * This module defines the core data structures for diamond detection,
 * classification, and analysis in network flow systems.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Enumeration of diamond structure types
 */
export enum DiamondType {
  SIMPLE = 'simple',
  NESTED = 'nested',
  OVERLAPPING = 'overlapping',
  CASCADE = 'cascade',
  PARALLEL = 'parallel'
}

/**
 * Enumeration of diamond analysis status states
 */
export enum DiamondAnalysisStatus {
  PENDING = 'pending',
  DETECTING = 'detecting',
  CLASSIFYING = 'classifying',
  COMPLETE = 'complete',
  ERROR = 'error'
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Node identifier type for diamond structures
 */
export type NodeId = string | number;

/**
 * Path representation through a diamond structure
 */
export type DiamondPath = NodeId[];

/**
 * Array of paths representing different routes through the diamond
 */
export type DiamondPaths = DiamondPath[];

/**
 * Diamond characteristics descriptor
 */
export type DiamondCharacteristic = string;

/**
 * Collection of diamond characteristics
 */
export type DiamondCharacteristics = DiamondCharacteristic[];

/**
 * Diamond metadata for additional properties
 */
export type DiamondMetadata = Record<string, unknown>;

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Core diamond structure definition
 * 
 * Represents the fundamental structure of a diamond pattern in a network,
 * including all constituent nodes and their relationships.
 */
export interface DiamondStructure {
  /** Unique identifier for the diamond */
  id: string;
  
  /** Array of all node identifiers that form the diamond */
  nodes: NodeId[];
  
  /** Identifier for the diamond's source node (entry point) */
  source: NodeId;
  
  /** Identifier for the diamond's sink node (exit point) */
  sink: NodeId;
  
  /** Array of fork node identifiers (divergence points) */
  forks: NodeId[];
  
  /** Array of join node identifiers (convergence points) */
  joins: NodeId[];
  
  /** Array of path arrays representing different routes through the diamond */
  paths: DiamondPaths;
  
  /** Optional metadata for additional diamond properties */
  metadata?: DiamondMetadata;
}

/**
 * Diamond classification and analysis results
 * 
 * Contains the classification details and structural analysis
 * of a detected diamond pattern.
 */
export interface DiamondClassification {
  /** Diamond structure identifier */
  diamondId: string;
  
  /** Enum value for diamond types */
  type: DiamondType;
  
  /** Numerical indicator of structural complexity (0-100) */
  complexity: number;
  
  /** Numerical indicator of nesting level (0 = top-level) */
  depth: number;
  
  /** Array of string descriptors for diamond characteristics */
  characteristics: DiamondCharacteristics;
  
  /** Confidence score for the classification (0-1) */
  confidence?: number;
  
  /** Timestamp of when classification was performed */
  classifiedAt?: Date;
}

// ============================================================================
// DETECTION AND ANALYSIS INTERFACES
// ============================================================================

/**
 * Result of diamond detection operation
 * 
 * Contains all detected diamonds and associated metadata
 * from a network analysis operation.
 */
export interface DiamondDetectionResult {
  /** Array of detected diamond structures */
  diamonds: DiamondStructure[];
  
  /** Array of diamond classifications */
  classifications: DiamondClassification[];
  
  /** Total number of diamonds detected */
  totalCount: number;
  
  /** Count by diamond type */
  typeDistribution: Record<DiamondType, number>;
  
  /** Analysis execution time in milliseconds */
  executionTime: number;
  
  /** Analysis status */
  status: DiamondAnalysisStatus;
  
  /** Optional error message if analysis failed */
  error?: string;
  
  /** Timestamp of analysis completion */
  analyzedAt: Date;
  
  /** Additional metadata about the detection process */
  metadata?: DiamondMetadata;
}

/**
 * Configuration parameters for diamond analysis
 * 
 * Defines the parameters and settings for diamond detection
 * and classification operations.
 */
export interface DiamondAnalysisConfig {
  /** Maximum depth to search for nested diamonds */
  maxDepth?: number;
  
  /** Minimum number of nodes required to form a diamond */
  minNodes?: number;
  
  /** Maximum number of nodes allowed in a diamond */
  maxNodes?: number;
  
  /** Whether to detect overlapping diamonds */
  detectOverlapping?: boolean;
  
  /** Whether to classify detected diamonds */
  performClassification?: boolean;
  
  /** Minimum confidence threshold for classification */
  confidenceThreshold?: number;
  
  /** Types of diamonds to detect */
  targetTypes?: DiamondType[];
  
  /** Whether to include detailed path analysis */
  includePathAnalysis?: boolean;
  
  /** Timeout for analysis operation in milliseconds */
  timeout?: number;
  
  /** Additional configuration options */
  options?: DiamondMetadata;
}

// ============================================================================
// UTILITY INTERFACES
// ============================================================================

/**
 * Diamond analysis progress tracking
 */
export interface DiamondAnalysisProgress {
  /** Current analysis status */
  status: DiamondAnalysisStatus;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Current operation description */
  currentOperation: string;
  
  /** Number of diamonds detected so far */
  diamondsDetected: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

/**
 * Diamond validation result
 */
export interface DiamondValidationResult {
  /** Whether the diamond structure is valid */
  isValid: boolean;
  
  /** Array of validation errors if any */
  errors: string[];
  
  /** Array of validation warnings if any */
  warnings: string[];
  
  /** Validation score (0-1) */
  score: number;
}

/**
 * Diamond comparison result
 */
export interface DiamondComparisonResult {
  /** First diamond being compared */
  diamond1: DiamondStructure;
  
  /** Second diamond being compared */
  diamond2: DiamondStructure;
  
  /** Similarity score (0-1) */
  similarity: number;
  
  /** Common nodes between diamonds */
  commonNodes: NodeId[];
  
  /** Differences between diamonds */
  differences: string[];
  
  /** Whether diamonds overlap */
  overlapping: boolean;
}

// ============================================================================
// EXPORT COLLECTIONS
// ============================================================================

/**
 * Collection of all diamond-related types for easy importing
 */
export type DiamondTypes = {
  DiamondStructure: DiamondStructure;
  DiamondClassification: DiamondClassification;
  DiamondDetectionResult: DiamondDetectionResult;
  DiamondAnalysisConfig: DiamondAnalysisConfig;
  DiamondAnalysisProgress: DiamondAnalysisProgress;
  DiamondValidationResult: DiamondValidationResult;
  DiamondComparisonResult: DiamondComparisonResult;
};

/**
 * Collection of all diamond-related enums
 */
export const DiamondEnums = {
  DiamondType,
  DiamondAnalysisStatus
} as const;