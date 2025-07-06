/**
 * Service Contract Interfaces for GraphStateService Architecture
 * 
 * Defines method contracts, result types, and operation interfaces for the
 * specialized services in the refactored architecture.
 */

import { Observable } from 'rxjs';
import { GraphStructure, GraphState } from './graph-structure-interface';
import { AnalysisResult, DiamondData, NetworkData } from './main-sever-interface';
import { ServiceEvent, EventPriority } from './service-events.interface';

// Generic service operation result
export interface ServiceOperationResult<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly warnings?: string[];
  readonly metadata?: {
    readonly executionTime: number;
    readonly timestamp: Date;
    readonly version?: string;
    readonly cacheHit?: boolean;
  };
}

// Async operation with cancellation support
export interface CancellableOperation<T> {
  readonly result: Promise<ServiceOperationResult<T>>;
  readonly cancel: () => void;
  readonly progress?: Observable<number>;
}

// Generic service interface
export interface BaseService {
  readonly serviceName: string;
  readonly version: string;
  readonly isHealthy: () => boolean;
  readonly getStatus: () => ServiceStatus;
}

export interface ServiceStatus {
  readonly service: string;
  readonly status: 'online' | 'offline' | 'degraded' | 'maintenance';
  readonly health: number; // 0-100
  readonly lastActivity: Date;
  readonly metrics?: ServiceMetrics;
}

export interface ServiceMetrics {
  readonly operationsPerformed: number;
  readonly averageResponseTime: number;
  readonly errorRate: number;
  readonly cacheHitRate?: number;
  readonly memoryUsage?: number;
}

// Graph State Management Service Contract
export interface GraphStateManagementContract extends BaseService {
  // State queries
  readonly getCurrentState: () => GraphState;
  readonly getGraphStructure: () => GraphStructure | null;
  readonly isGraphLoaded: () => boolean;
  readonly getStateHistory: () => GraphStateSnapshot[];
  
  // State mutations
  readonly updateState: (updates: Partial<GraphState>) => ServiceOperationResult<GraphState>;
  readonly clearState: () => ServiceOperationResult<void>;
  readonly restoreState: (snapshot: GraphStateSnapshot) => ServiceOperationResult<GraphState>;
  
  // State subscriptions
  readonly onStateChange: () => Observable<GraphStateChangeNotification>;
  readonly onStructureChange: () => Observable<GraphStructureChangeNotification>;
}

export interface GraphStateSnapshot {
  readonly id: string;
  readonly timestamp: Date;
  readonly state: GraphState;
  readonly description?: string;
  readonly tags?: string[];
}

export interface GraphStateChangeNotification {
  readonly previousState: Partial<GraphState>;
  readonly newState: Partial<GraphState>;
  readonly changedFields: (keyof GraphState)[];
  readonly timestamp: Date;
}

export interface GraphStructureChangeNotification {
  readonly previousStructure: GraphStructure | null;
  readonly newStructure: GraphStructure | null;
  readonly changeType: 'loaded' | 'cleared' | 'updated';
  readonly timestamp: Date;
}

// Parameter Management Service Contract
export interface ParameterManagementContract extends BaseService {
  // Parameter queries
  readonly getNodePriors: () => { [nodeId: string]: number };
  readonly getEdgeProbabilities: () => { [edgeKey: string]: number };
  readonly getGlobalParameters: () => GlobalParameters;
  readonly validateParameters: () => ParameterValidationResult;
  
  // Parameter mutations
  readonly updateNodePriors: (updates: { [nodeId: string]: number }) => ServiceOperationResult<void>;
  readonly updateEdgeProbabilities: (updates: { [edgeKey: string]: number }) => ServiceOperationResult<void>;
  readonly updateGlobalParameters: (updates: Partial<GlobalParameters>) => ServiceOperationResult<void>;
  readonly resetToDefaults: () => ServiceOperationResult<void>;
  
  // Parameter operations
  readonly markParametersStale: () => void;
  readonly isParameterSetStale: () => boolean;
  readonly getLastModified: () => Date | null;
  
  // Parameter subscriptions
  readonly onParameterChange: () => Observable<ParameterChangeNotification>;
  readonly onValidationChange: () => Observable<ParameterValidationResult>;
}

export interface GlobalParameters {
  readonly defaultNodePrior: number;
  readonly defaultEdgeProbability: number;
  readonly overrideNodePrior: boolean;
  readonly overrideEdgeProbability: boolean;
  readonly enableMonteCarlo: boolean;
  readonly includeClassification: boolean;
  readonly useIndividualOverrides: boolean;
}

export interface ParameterValidationResult {
  readonly isValid: boolean;
  readonly errors: ParameterValidationError[];
  readonly warnings: ParameterValidationWarning[];
  readonly affectedNodes: number[];
  readonly affectedEdges: string[];
}

export interface ParameterValidationError {
  readonly type: 'range' | 'type' | 'dependency' | 'constraint';
  readonly field: string;
  readonly value: any;
  readonly message: string;
  readonly suggestion?: string;
}

export interface ParameterValidationWarning {
  readonly type: 'performance' | 'accuracy' | 'compatibility';
  readonly field: string;
  readonly message: string;
  readonly impact: 'low' | 'medium' | 'high';
}

export interface ParameterChangeNotification {
  readonly parameterType: 'node_prior' | 'edge_probability' | 'global_config';
  readonly changes: ParameterChange[];
  readonly timestamp: Date;
  readonly isStale: boolean;
}

export interface ParameterChange {
  readonly field: string;
  readonly previousValue: any;
  readonly newValue: any;
  readonly affectedElements: string[];
}

// Analysis Service Contract
export interface AnalysisServiceContract extends BaseService {
  // Analysis operations
  readonly runStructureAnalysis: (options?: AnalysisOptions) => CancellableOperation<StructureAnalysisResult>;
  readonly runDiamondAnalysis: (options?: AnalysisOptions) => CancellableOperation<DiamondAnalysisResult>;
  readonly runFullAnalysis: (parameters: FullAnalysisParameters) => CancellableOperation<FullAnalysisResult>;
  readonly exportToDot: (options?: ExportOptions) => CancellableOperation<DotExportResult>;
  
  // Analysis queries
  readonly getLastAnalysisResults: () => AnalysisResult[] | null;
  readonly getAnalysisHistory: () => AnalysisHistoryEntry[];
  readonly isAnalysisRunning: () => boolean;
  readonly getAnalysisProgress: () => AnalysisProgress | null;
  
  // Analysis subscriptions
  readonly onAnalysisStart: () => Observable<AnalysisStartedNotification>;
  readonly onAnalysisComplete: () => Observable<AnalysisCompleteNotification>;
  readonly onAnalysisProgress: () => Observable<AnalysisProgress>;
}

export interface AnalysisOptions {
  readonly priority?: EventPriority;
  readonly timeout?: number;
  readonly cacheResults?: boolean;
  readonly validateInput?: boolean;
}

export interface FullAnalysisParameters {
  readonly nodePrior: number;
  readonly edgeProb: number;
  readonly overrideNodePrior: boolean;
  readonly overrideEdgeProb: boolean;
  readonly includeClassification?: boolean;
  readonly enableMonteCarlo?: boolean;
  readonly useIndividualOverrides?: boolean;
  readonly individualNodePriors?: { [nodeId: string]: number };
  readonly individualEdgeProbabilities?: { [edgeKey: string]: number };
}

export interface ExportOptions {
  readonly format: 'dot' | 'graphml' | 'json';
  readonly includeMetadata?: boolean;
  readonly compress?: boolean;
}

export interface StructureAnalysisResult {
  readonly networkData: NetworkData;
  readonly metrics: StructureMetrics;
  readonly timing: AnalysisTiming;
}

export interface DiamondAnalysisResult {
  readonly diamondData: DiamondData;
  readonly metrics: DiamondMetrics;
  readonly timing: AnalysisTiming;
}

export interface FullAnalysisResult {
  readonly results: AnalysisResult[];
  readonly parameterModifications?: {
    readonly totalNodesModified: number;
    readonly totalEdgesModified: number;
    readonly modificationSummary: string;
  };
  readonly metrics: FullAnalysisMetrics;
  readonly timing: AnalysisTiming;
}

export interface DotExportResult {
  readonly dotString: string;
  readonly metadata: ExportMetadata;
  readonly timing: AnalysisTiming;
}

export interface StructureMetrics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly sourceNodeCount: number;
  readonly sinkNodeCount: number;
  readonly forkNodeCount: number;
  readonly joinNodeCount: number;
  readonly complexityScore: number;
}

export interface DiamondMetrics {
  readonly diamondCount: number;
  readonly averageDiamondSize: number;
  readonly maxDiamondSize: number;
  readonly diamondDensity: number;
}

export interface FullAnalysisMetrics extends StructureMetrics, DiamondMetrics {
  readonly totalComputationTime: number;
  readonly memoryPeakUsage: number;
  readonly iterationCount: number;
  readonly convergenceAchieved: boolean;
}

export interface ExportMetadata {
  readonly format: string;
  readonly size: number;
  readonly checksum?: string;
  readonly compression?: string;
}

export interface AnalysisTiming {
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly phases?: { [phaseName: string]: number };
}

export interface AnalysisProgress {
  readonly analysisType: string;
  readonly phase: string;
  readonly progress: number; // 0-100
  readonly currentStep: string;
  readonly estimatedTimeRemaining?: number;
  readonly throughput?: number;
}

export interface AnalysisHistoryEntry {
  readonly id: string;
  readonly type: 'structure' | 'diamond' | 'full' | 'export';
  readonly timestamp: Date;
  readonly duration: number;
  readonly success: boolean;
  readonly parameters?: any;
  readonly resultSummary?: string;
  readonly error?: string;
}

export interface AnalysisStartedNotification {
  readonly analysisType: string;
  readonly parameters: any;
  readonly estimatedDuration?: number;
  readonly timestamp: Date;
}

export interface AnalysisCompleteNotification {
  readonly analysisType: string;
  readonly success: boolean;
  readonly duration: number;
  readonly resultSummary?: string;
  readonly error?: string;
  readonly timestamp: Date;
}

// Visualization Service Contract
export interface VisualizationServiceContract extends BaseService {
  // Visualization state
  readonly isVisualizationReady: () => boolean;
  readonly getCurrentRenderMode: () => RenderMode;
  readonly getVisibleElements: () => VisibleElements;
  readonly getSelectedElements: () => string[];
  
  // Visualization operations
  readonly updateVisualization: (update: VisualizationUpdate) => ServiceOperationResult<void>;
  readonly highlightElements: (elements: ElementSelection) => ServiceOperationResult<void>;
  readonly clearHighlights: () => ServiceOperationResult<void>;
  readonly setRenderMode: (mode: RenderMode) => ServiceOperationResult<void>;
  readonly fitToView: () => ServiceOperationResult<void>;
  readonly exportVisualization: (format: ImageFormat) => ServiceOperationResult<string>;
  
  // Visualization subscriptions
  readonly onVisualizationUpdate: () => Observable<VisualizationUpdateNotification>;
  readonly onSelectionChange: () => Observable<SelectionChangeNotification>;
  readonly onRenderComplete: () => Observable<RenderCompleteNotification>;
}

export type RenderMode = 'force' | 'hierarchical' | 'circular' | 'layered';
export type ImageFormat = 'png' | 'svg' | 'jpg' | 'pdf';

export interface VisibleElements {
  readonly nodes: number[];
  readonly edges: string[];
  readonly totalNodes: number;
  readonly totalEdges: number;
}

export interface VisualizationUpdate {
  readonly type: 'highlight' | 'filter' | 'layout' | 'zoom' | 'selection';
  readonly targetNodes?: number[];
  readonly targetEdges?: string[];
  readonly properties?: { [key: string]: any };
  readonly animate?: boolean;
  readonly duration?: number;
}

export interface ElementSelection {
  readonly nodes?: number[];
  readonly edges?: string[];
  readonly style?: ElementStyle;
  readonly temporary?: boolean;
}

export interface ElementStyle {
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
  readonly borderWidth?: number;
  readonly borderColor?: string;
}

export interface VisualizationUpdateNotification {
  readonly updateType: string;
  readonly affectedElements: string[];
  readonly timestamp: Date;
  readonly renderTime: number;
}

export interface SelectionChangeNotification {
  readonly selectedNodes: number[];
  readonly selectedEdges: string[];
  readonly selectionType: 'single' | 'multiple' | 'range';
  readonly timestamp: Date;
}

export interface RenderCompleteNotification {
  readonly renderMode: RenderMode;
  readonly elementCount: number;
  readonly renderTime: number;
  readonly timestamp: Date;
}

// Message batching configuration
export interface MessageBatchConfig {
  readonly maxBatchSize: number;
  readonly maxBatchDelay: number; // milliseconds
  readonly priorityThreshold: EventPriority;
  readonly enableBatching: boolean;
}

// Service registry for dependency injection
export interface ServiceRegistry {
  readonly registerService: <T extends BaseService>(service: T) => void;
  readonly getService: <T extends BaseService>(serviceName: string) => T | null;
  readonly getAllServices: () => BaseService[];
  readonly unregisterService: (serviceName: string) => boolean;
}