/**
 * Service Event Interfaces for MessageBusService
 * 
 * Defines all event types and message structures used for inter-service communication
 * in the GraphStateService refactoring architecture.
 */

import { GraphStructure, GraphState } from './graph-structure-interface';
import { AnalysisResult } from './main-sever-interface';

// Base event interface
export interface BaseServiceEvent {
  readonly type: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly correlationId?: string;
}

// Event priorities for message batching
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// Graph State Change Events
export interface GraphStateChangeEvent extends BaseServiceEvent {
  readonly type: 'GRAPH_STATE_CHANGE';
  readonly payload: {
    readonly previousState: Partial<GraphState>;
    readonly newState: Partial<GraphState>;
    readonly changedFields: (keyof GraphState)[];
  };
  readonly priority: EventPriority;
}

export interface GraphLoadedEvent extends BaseServiceEvent {
  readonly type: 'GRAPH_LOADED';
  readonly payload: {
    readonly structure: GraphStructure;
    readonly csvContent: string;
    readonly nodeCount: number;
    readonly edgeCount: number;
  };
  readonly priority: EventPriority;
}

export interface GraphClearedEvent extends BaseServiceEvent {
  readonly type: 'GRAPH_CLEARED';
  readonly payload: {
    readonly reason: 'user_action' | 'error' | 'reload';
  };
  readonly priority: EventPriority;
}

// Parameter Change Events
export interface ParameterChangeEvent extends BaseServiceEvent {
  readonly type: 'PARAMETER_CHANGE';
  readonly payload: {
    readonly parameterType: 'node_prior' | 'edge_probability' | 'global_config';
    readonly nodeUpdates?: { [nodeId: string]: number };
    readonly edgeUpdates?: { [edgeKey: string]: number };
    readonly globalUpdates?: { [key: string]: any };
    readonly isStale: boolean;
  };
  readonly priority: EventPriority;
}

export interface ParameterValidationEvent extends BaseServiceEvent {
  readonly type: 'PARAMETER_VALIDATION';
  readonly payload: {
    readonly isValid: boolean;
    readonly errors: string[];
    readonly warnings: string[];
    readonly affectedNodes: number[];
    readonly affectedEdges: string[];
  };
  readonly priority: EventPriority;
}

// Analysis Events
export interface AnalysisStartedEvent extends BaseServiceEvent {
  readonly type: 'ANALYSIS_STARTED';
  readonly payload: {
    readonly analysisType: 'structure' | 'diamond' | 'full' | 'export';
    readonly parameters?: any;
    readonly estimatedDuration?: number;
  };
  readonly priority: EventPriority;
}

export interface AnalysisCompleteEvent extends BaseServiceEvent {
  readonly type: 'ANALYSIS_COMPLETE';
  readonly payload: {
    readonly analysisType: 'structure' | 'diamond' | 'full' | 'export';
    readonly success: boolean;
    readonly results?: AnalysisResult[] | any;
    readonly duration: number;
    readonly error?: string;
  };
  readonly priority: EventPriority;
}

export interface AnalysisProgressEvent extends BaseServiceEvent {
  readonly type: 'ANALYSIS_PROGRESS';
  readonly payload: {
    readonly analysisType: string;
    readonly progress: number; // 0-100
    readonly currentStep: string;
    readonly estimatedTimeRemaining?: number;
  };
  readonly priority: EventPriority;
}

// Visualization Events
export interface VisualizationUpdateEvent extends BaseServiceEvent {
  readonly type: 'VISUALIZATION_UPDATE';
  readonly payload: {
    readonly updateType: 'highlight' | 'filter' | 'layout' | 'zoom' | 'selection';
    readonly targetNodes?: number[];
    readonly targetEdges?: string[];
    readonly properties?: { [key: string]: any };
  };
  readonly priority: EventPriority;
}

export interface VisualizationStateEvent extends BaseServiceEvent {
  readonly type: 'VISUALIZATION_STATE';
  readonly payload: {
    readonly isReady: boolean;
    readonly renderMode: 'force' | 'hierarchical' | 'circular';
    readonly visibleNodes: number[];
    readonly visibleEdges: string[];
    readonly selectedElements: string[];
  };
  readonly priority: EventPriority;
}

// Computation Events
export interface ComputationRequestEvent extends BaseServiceEvent {
  readonly type: 'COMPUTATION_REQUEST';
  readonly payload: {
    readonly computationType: 'reachability' | 'critical_path' | 'diamond_analysis';
    readonly parameters: any;
    readonly options?: { [key: string]: any };
  };
  readonly priority: EventPriority;
}

export interface ComputationResultEvent extends BaseServiceEvent {
  readonly type: 'COMPUTATION_RESULT';
  readonly payload: {
    readonly computationType: string;
    readonly requestId: string;
    readonly success: boolean;
    readonly results?: any;
    readonly error?: string;
    readonly metrics?: {
      readonly executionTime: number;
      readonly memoryUsage?: number;
      readonly cacheHit?: boolean;
    };
  };
  readonly priority: EventPriority;
}

// Error and Status Events
export interface ServiceErrorEvent extends BaseServiceEvent {
  readonly type: 'SERVICE_ERROR';
  readonly payload: {
    readonly errorType: 'network' | 'validation' | 'computation' | 'system';
    readonly error: Error | string;
    readonly context?: any;
    readonly recoverable: boolean;
    readonly retryCount?: number;
  };
  readonly priority: EventPriority;
}

export interface ServiceStatusEvent extends BaseServiceEvent {
  readonly type: 'SERVICE_STATUS';
  readonly payload: {
    readonly service: string;
    readonly status: 'online' | 'offline' | 'degraded' | 'maintenance';
    readonly health: number; // 0-100
    readonly lastHeartbeat: Date;
  };
  readonly priority: EventPriority;
}

// Cache Events
export interface CacheEvent extends BaseServiceEvent {
  readonly type: 'CACHE_EVENT';
  readonly payload: {
    readonly action: 'hit' | 'miss' | 'invalidate' | 'clear';
    readonly cacheKey: string;
    readonly service: string;
    readonly size?: number;
  };
  readonly priority: EventPriority;
}

// Union type of all service events
export type ServiceEvent = 
  | GraphStateChangeEvent
  | GraphLoadedEvent
  | GraphClearedEvent
  | ParameterChangeEvent
  | ParameterValidationEvent
  | AnalysisStartedEvent
  | AnalysisCompleteEvent
  | AnalysisProgressEvent
  | VisualizationUpdateEvent
  | VisualizationStateEvent
  | ComputationRequestEvent
  | ComputationResultEvent
  | ServiceErrorEvent
  | ServiceStatusEvent
  | CacheEvent;

// Event type strings for type safety
export const SERVICE_EVENT_TYPES = {
  GRAPH_STATE_CHANGE: 'GRAPH_STATE_CHANGE',
  GRAPH_LOADED: 'GRAPH_LOADED',
  GRAPH_CLEARED: 'GRAPH_CLEARED',
  PARAMETER_CHANGE: 'PARAMETER_CHANGE',
  PARAMETER_VALIDATION: 'PARAMETER_VALIDATION',
  ANALYSIS_STARTED: 'ANALYSIS_STARTED',
  ANALYSIS_COMPLETE: 'ANALYSIS_COMPLETE',
  ANALYSIS_PROGRESS: 'ANALYSIS_PROGRESS',
  VISUALIZATION_UPDATE: 'VISUALIZATION_UPDATE',
  VISUALIZATION_STATE: 'VISUALIZATION_STATE',
  COMPUTATION_REQUEST: 'COMPUTATION_REQUEST',
  COMPUTATION_RESULT: 'COMPUTATION_RESULT',
  SERVICE_ERROR: 'SERVICE_ERROR',
  SERVICE_STATUS: 'SERVICE_STATUS',
  CACHE_EVENT: 'CACHE_EVENT'
} as const;

export type ServiceEventType = typeof SERVICE_EVENT_TYPES[keyof typeof SERVICE_EVENT_TYPES];

// Event listener function type
export type ServiceEventListener<T extends ServiceEvent = ServiceEvent> = (event: T) => void | Promise<void>;

// Event subscription options
export interface EventSubscriptionOptions {
  readonly priority?: EventPriority;
  readonly once?: boolean;
  readonly filter?: (event: ServiceEvent) => boolean;
  readonly debounceMs?: number;
  readonly throttleMs?: number;
}