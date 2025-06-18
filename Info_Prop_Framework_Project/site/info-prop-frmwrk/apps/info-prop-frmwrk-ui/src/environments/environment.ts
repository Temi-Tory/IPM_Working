// src/environments/environment.ts (production)
import { ServiceConfigurations } from '../app/config/service-config';

export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:8080', //TODO: need to Update this for production
  
  // Service-specific configurations for production
  services: {
    messageBus: {
      maxBatchSize: 100, // Larger batches for efficiency
      maxBatchDelay: 200, // Optimize for throughput
      priorityThreshold: 2,
      enableBatching: true,
      enableCorrelationTracking: false, // Disable for performance
      maxCorrelationHistory: 500
    },
    
    parameterManagement: {
      enableRealTimeValidation: true,
      validationDebounceMs: 500, // Longer debounce for performance
      maxNodeOverrides: 2000, // Production limits
      maxEdgeOverrides: 10000,
      enablePerformanceWarnings: false, // Disable warnings in production
      strictValidation: false // Relaxed validation for performance
    },
    
    analysis: {
      defaultTimeout: 30000, // Standard timeout
      enableProgressTracking: true,
      enableCancellation: true,
      maxConcurrentOperations: 5, // Higher concurrency for production
      enableCaching: true, // Enable caching for performance
      cacheSize: 100
    },
    
    visualization: {
      defaultLayout: 'force-directed',
      enableAnimations: false, // Disable animations for performance
      animationDuration: 0,
      maxNodes: 5000, // Production limits
      maxEdges: 25000,
      enableWebGL: true // Enable WebGL for performance
    },
    
    stateManagement: {
      maxHistorySize: 50, // Larger history for production
      enableSnapshots: true,
      enableStateValidation: false, // Disable validation for performance
      enableMetrics: false // Disable metrics for performance
    }
  } as ServiceConfigurations
};

