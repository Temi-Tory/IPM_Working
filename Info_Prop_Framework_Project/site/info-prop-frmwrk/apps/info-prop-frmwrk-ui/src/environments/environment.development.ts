// src/environments/environment.development.ts
import { ServiceConfigurations } from '../app/config/service-config';

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  
  // Service-specific configurations for development
  services: {
    messageBus: {
      maxBatchSize: 25, // Smaller batches for development
      maxBatchDelay: 50, // Faster processing for development
      priorityThreshold: 1, // Lower threshold for debugging
      enableBatching: true,
      enableCorrelationTracking: true, // Enable for debugging
      maxCorrelationHistory: 1000
    },
    
    parameterManagement: {
      enableRealTimeValidation: true,
      validationDebounceMs: 100, // Faster validation feedback
      maxNodeOverrides: 500, // Lower limits for development
      maxEdgeOverrides: 2000,
      enablePerformanceWarnings: true, // Enable warnings in development
      strictValidation: true // Strict validation for development
    },
    
    analysis: {
      defaultTimeout: 60000, // Longer timeout for debugging
      enableProgressTracking: true,
      enableCancellation: true,
      maxConcurrentOperations: 2, // Limit for development
      enableCaching: false, // Disable caching for development
      cacheSize: 0
    },
    
    visualization: {
      defaultLayout: 'hierarchical',
      enableAnimations: true, // Enable animations in development
      animationDuration: 500,
      maxNodes: 1000, // Development limits
      maxEdges: 5000,
      enableWebGL: false // Disable WebGL for compatibility
    },
    
    stateManagement: {
      maxHistorySize: 20, // Smaller history for development
      enableSnapshots: true,
      enableStateValidation: true, // Enable validation in development
      enableMetrics: true // Enable metrics for debugging
    }
  } as ServiceConfigurations
};