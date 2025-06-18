import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// Import specialized services for the new architecture
import { MessageBusService } from './services/message-bus.service';
import { GraphStateManagementService } from './services/graph-state-management.service';
import { ParameterManagementService } from './services/parameter-management.service';
import { AnalysisService } from './services/analysis.service';
import { VisualizationService } from './services/visualization.service';
import { GraphServiceOrchestrator } from './services/graph-service-orchestrator';

// Import service configuration tokens
import {
  MESSAGE_BUS_CONFIG,
  PARAMETER_VALIDATION_CONFIG,
  ANALYSIS_CONFIG,
  VISUALIZATION_CONFIG,
  STATE_MANAGEMENT_CONFIG
} from './config/service-config';

// Import environment-specific configurations
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // Core Angular providers
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    
    // Service configuration tokens with environment-specific values
    { provide: MESSAGE_BUS_CONFIG, useValue: environment.services?.messageBus || {
      maxBatchSize: 50,
      maxBatchDelay: 100,
      priorityThreshold: 2,
      enableBatching: true,
      enableCorrelationTracking: !environment.production,
      maxCorrelationHistory: environment.production ? 500 : 1000
    }},
    
    { provide: PARAMETER_VALIDATION_CONFIG, useValue: environment.services?.parameterManagement || {
      enableRealTimeValidation: true,
      validationDebounceMs: environment.production ? 500 : 300,
      maxNodeOverrides: environment.production ? 2000 : 1000,
      maxEdgeOverrides: environment.production ? 10000 : 5000,
      enablePerformanceWarnings: !environment.production,
      strictValidation: !environment.production
    }},
    
    { provide: ANALYSIS_CONFIG, useValue: environment.services?.analysis || {
      defaultTimeout: 30000,
      enableProgressTracking: true,
      enableCancellation: true,
      maxConcurrentOperations: environment.production ? 5 : 3,
      enableCaching: environment.production,
      cacheSize: environment.production ? 100 : 0
    }},
    
    { provide: VISUALIZATION_CONFIG, useValue: environment.services?.visualization || {
      defaultLayout: 'hierarchical',
      enableAnimations: !environment.production,
      animationDuration: environment.production ? 0 : 500,
      maxNodes: environment.production ? 5000 : 1000,
      maxEdges: environment.production ? 25000 : 5000,
      enableWebGL: environment.production
    }},
    
    { provide: STATE_MANAGEMENT_CONFIG, useValue: environment.services?.stateManagement || {
      maxHistorySize: environment.production ? 50 : 20,
      enableSnapshots: true,
      enableStateValidation: !environment.production,
      enableMetrics: !environment.production
    }},
    
    // Specialized services in dependency order
    // MessageBusService must be first as other services depend on it
    MessageBusService,
    
    // Core state and parameter management
    GraphStateManagementService,
    ParameterManagementService,
    
    // Analysis and visualization services
    AnalysisService,
    VisualizationService,
    
    // Orchestrator for backward compatibility and coordinated operations
    GraphServiceOrchestrator,
    
    // Health monitoring service
    // Note: Import will be added when HealthMonitorService is ready
    // HealthMonitorService,
    
    // Keep legacy service for gradual migration support (optional)
    // Uncomment if you need backward compatibility during migration
    // GraphStateService
  ],
};
