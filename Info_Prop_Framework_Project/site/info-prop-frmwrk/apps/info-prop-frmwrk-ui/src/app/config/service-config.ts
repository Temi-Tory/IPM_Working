import { InjectionToken } from '@angular/core';

// MessageBusService Configuration
export interface MessageBusConfig {
  maxBatchSize: number;
  maxBatchDelay: number;
  priorityThreshold: number;
  enableBatching: boolean;
  enableCorrelationTracking?: boolean;
  maxCorrelationHistory?: number;
}

export const MESSAGE_BUS_CONFIG = new InjectionToken<MessageBusConfig>('MESSAGE_BUS_CONFIG');

// ParameterManagementService Configuration
export interface ParameterValidationConfig {
  enableRealTimeValidation: boolean;
  validationDebounceMs: number;
  maxNodeOverrides: number;
  maxEdgeOverrides: number;
  enablePerformanceWarnings?: boolean;
  strictValidation?: boolean;
}

export const PARAMETER_VALIDATION_CONFIG = new InjectionToken<ParameterValidationConfig>('PARAMETER_VALIDATION_CONFIG');

// AnalysisService Configuration
export interface AnalysisConfig {
  defaultTimeout: number;
  enableProgressTracking: boolean;
  enableCancellation: boolean;
  maxConcurrentOperations: number;
  enableCaching?: boolean;
  cacheSize?: number;
}

export const ANALYSIS_CONFIG = new InjectionToken<AnalysisConfig>('ANALYSIS_CONFIG');

// VisualizationService Configuration
export interface VisualizationConfig {
  defaultLayout: string;
  enableAnimations: boolean;
  animationDuration: number;
  maxNodes: number;
  maxEdges: number;
  enableWebGL?: boolean;
}

export const VISUALIZATION_CONFIG = new InjectionToken<VisualizationConfig>('VISUALIZATION_CONFIG');

// GraphStateManagementService Configuration
export interface StateManagementConfig {
  maxHistorySize: number;
  enableSnapshots: boolean;
  enableStateValidation: boolean;
  enableMetrics?: boolean;
}

export const STATE_MANAGEMENT_CONFIG = new InjectionToken<StateManagementConfig>('STATE_MANAGEMENT_CONFIG');

// Service configuration interface for environment files
export interface ServiceConfigurations {
  messageBus: MessageBusConfig;
  parameterManagement: ParameterValidationConfig;
  analysis: AnalysisConfig;
  visualization: VisualizationConfig;
  stateManagement: StateManagementConfig;
}