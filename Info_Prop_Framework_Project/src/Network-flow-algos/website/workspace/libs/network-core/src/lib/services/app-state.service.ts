import { Injectable, computed, effect, inject } from '@angular/core';
import { NetworkStateService, NetworkData } from './network-state.service';
import { AnalysisStateService, AnalysisType } from './analysis-state.service';
import { UIStateService } from './ui-state.service';

/**
 * Centralized App State Service using Angular 20 Native Signals
 * Coordinates all state services and provides global computed signals
 */
@Injectable({ providedIn: 'root' })
export class AppStateService {
  public readonly network = inject(NetworkStateService);
  public readonly analysis = inject(AnalysisStateService);
  public readonly ui = inject(UIStateService);

  constructor() {
    // Global effects for cross-service coordination
    this.setupGlobalEffects();
  }

  // Global computed signals that combine multiple services
  readonly isAppReady = computed(() => 
    !this.network.isLoading() && 
    !this.analysis.isRunning() && 
    !this.ui.globalLoading().isLoading
  );

  readonly hasData = computed(() => 
    this.network.isNetworkLoaded() || this.analysis.hasResults()
  );

  readonly canPerformActions = computed(() => 
    this.isAppReady() && 
    !this.network.error() && 
    !this.analysis.error()
  );

  readonly appStatus = computed(() => {
    if (this.network.isLoading()) return 'loading-network';
    if (this.analysis.isRunning()) return 'running-analysis';
    if (this.ui.globalLoading().isLoading) return 'loading';
    if (this.network.error() || this.analysis.error()) return 'error';
    if (this.hasData()) return 'ready';
    return 'idle';
  });

  readonly globalError = computed(() => 
    this.network.error() || this.analysis.error()
  );

  readonly loadingState = computed(() => {
    if (this.network.isLoading()) {
      return { isLoading: true, message: 'Loading network data...' };
    }
    if (this.analysis.isRunning()) {
      return { 
        isLoading: true, 
        message: 'Running analysis...', 
        progress: this.analysis.progress() 
      };
    }
    if (this.ui.globalLoading().isLoading) {
      return this.ui.globalLoading();
    }
    return { isLoading: false };
  });

  readonly appSummary = computed(() => ({
    network: {
      loaded: this.network.isNetworkLoaded(),
      nodeCount: this.network.nodeCount(),
      edgeCount: this.network.edgeCount(),
      hasFiles: this.network.hasUploadedFiles()
    },
    analysis: {
      hasResults: this.analysis.hasResults(),
      isRunning: this.analysis.isRunning(),
      analysisCount: this.analysis.analysisCount(),
      lastAnalysis: this.analysis.lastAnalysisTime()
    },
    ui: {
      theme: this.ui.theme(),
      sidenavOpen: this.ui.sidenavOpen(),
      screenSize: this.ui.screenSize(),
      notificationCount: this.ui.unreadNotificationCount()
    }
  }));

  // Global action methods
  resetApplication(): void {
    this.network.clearNetwork();
    this.analysis.clearHistory();
    this.ui.clearAllNotifications();
    this.ui.showInfo('Application Reset', 'All data has been cleared');
  }

  handleGlobalError(error: string, context?: string): void {
    console.error(`Global Error${context ? ` (${context})` : ''}:`, error);
    this.ui.showError(
      'Application Error',
      error,
      true // persistent
    );
  }

  showGlobalLoading(message: string, progress?: number): void {
    this.ui.setGlobalLoading(true, message, progress);
  }

  hideGlobalLoading(): void {
    this.ui.setGlobalLoading(false);
  }

  // Convenience methods for common operations
  async loadNetworkAndAnalyze(networkData: NetworkData, analysisType?: AnalysisType): Promise<void> {
    try {
      this.showGlobalLoading('Loading network and running analysis...');
      
      // Load network
      this.network.loadNetwork(networkData);
      
      // Wait a bit for network to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Run analysis if specified
      if (analysisType) {
        await this.analysis.runAnalysis(analysisType);
      }
      
      this.ui.showSuccess(
        'Success',
        'Network loaded and analysis completed'
      );
    } catch (error) {
      this.handleGlobalError(
        error instanceof Error ? error.message : 'Failed to load network and run analysis',
        'loadNetworkAndAnalyze'
      );
    } finally {
      this.hideGlobalLoading();
    }
  }

  exportAppState(): string {
    const state = {
      network: {
        data: this.network.networkData(),
        uploadedFiles: Object.keys(this.network.uploadedFiles())
      },
      analysis: {
        current: this.analysis.currentAnalysis(),
        history: this.analysis.analysisHistory(),
        parameters: this.analysis.parameters()
      },
      ui: {
        theme: this.ui.theme(),
        compactMode: this.ui.compactMode(),
        sidenavOpen: this.ui.sidenavOpen()
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    return JSON.stringify(state, null, 2);
  }

  async importAppState(stateJson: string): Promise<void> {
    try {
      this.showGlobalLoading('Importing application state...');
      
      const state = JSON.parse(stateJson);
      
      // Validate state structure
      if (!state.network || !state.analysis || !state.ui) {
        throw new Error('Invalid state format');
      }
      
      // Import network data
      if (state.network.data) {
        this.network.loadNetwork(state.network.data);
      }
      
      // Import analysis parameters
      if (state.analysis.parameters) {
        this.analysis.setParameters(state.analysis.parameters);
      }
      
      // Import UI preferences
      if (state.ui.theme) {
        this.ui.setTheme(state.ui.theme);
      }
      if (typeof state.ui.compactMode === 'boolean') {
        this.ui.setCompactMode(state.ui.compactMode);
      }
      
      this.ui.showSuccess(
        'Import Successful',
        'Application state has been restored'
      );
    } catch (error) {
      this.handleGlobalError(
        error instanceof Error ? error.message : 'Failed to import state',
        'importAppState'
      );
    } finally {
      this.hideGlobalLoading();
    }
  }

  // Development/debugging methods
  logCurrentState(): void {
    console.group('🔍 Current Application State');
    console.log('📊 Summary:', this.appSummary());
    console.log('🌐 Network:', {
      loaded: this.network.isNetworkLoaded(),
      data: this.network.networkData(),
      error: this.network.error()
    });
    console.log('🔬 Analysis:', {
      hasResults: this.analysis.hasResults(),
      current: this.analysis.currentAnalysis(),
      running: this.analysis.isRunning()
    });
    console.log('🎨 UI:', {
      theme: this.ui.theme(),
      loading: this.ui.globalLoading(),
      notifications: this.ui.notifications().length
    });
    console.groupEnd();
  }

  private setupGlobalEffects(): void {
    // Effect: Auto-show notifications for errors
    effect(() => {
      const networkError = this.network.error();
      if (networkError) {
        this.ui.showError('Network Error', networkError);
      }
    });

    effect(() => {
      const analysisError = this.analysis.error();
      if (analysisError) {
        this.ui.showError('Analysis Error', analysisError);
      }
    });

    // Effect: Auto-hide global loading when individual services finish
    effect(() => {
      const networkLoading = this.network.isLoading();
      const analysisRunning = this.analysis.isRunning();
      const globalLoading = this.ui.globalLoading().isLoading;
      
      if (globalLoading && !networkLoading && !analysisRunning) {
        // Auto-hide global loading if no individual services are loading
        setTimeout(() => {
          if (!this.network.isLoading() && !this.analysis.isRunning()) {
            this.hideGlobalLoading();
          }
        }, 500);
      }
    });

    // Effect: Log major state changes in development
    if (!environment.production) {
      effect(() => {
        const status = this.appStatus();
        console.log(`🔄 App Status Changed: ${status}`);
      });
    }
  }
}

// Environment check (fallback if not available)
const environment = {
  production: false // This should be imported from actual environment
};