import { Injectable, signal, computed, effect } from '@angular/core';
import {
  NetworkSession,
  WorkflowStep,
  WorkflowState,
  NetworkGraph,
  DiamondAnalysisResult,
  ReachabilityResult,
  MonteCarloResult,
  ProbabilityType,
  FileUploadProgress
} from '../models/network.models';

/**
 * Global state management service using Angular 20 native signals
 * Manages the entire application state including workflow, network data, and analysis results
 */
@Injectable({
  providedIn: 'root'
})
export class GlobalStateService {
  // Core session state
  private readonly _currentSession = signal<NetworkSession | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Workflow state
  private readonly _currentStep = signal<WorkflowStep>('network-upload');
  private readonly _completedSteps = signal<WorkflowStep[]>([]);

  // Network data state
  private readonly _networkGraph = signal<NetworkGraph | null>(null);
  private readonly _probabilityType = signal<ProbabilityType>('float');

  // Analysis results state
  private readonly _diamondAnalysis = signal<DiamondAnalysisResult | null>(null);
  private readonly _reachabilityResults = signal<ReachabilityResult[]>([]);
  private readonly _monteCarloResults = signal<MonteCarloResult[]>([]);

  // File upload state
  private readonly _uploadProgress = signal<FileUploadProgress | null>(null);
  private readonly _isUploading = signal<boolean>(false);
  
  // Julia API data storage
  private readonly _juliaData = signal<any>(null);

  // Public readonly signals
  readonly currentSession = this._currentSession.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly currentStep = this._currentStep.asReadonly();
  readonly completedSteps = this._completedSteps.asReadonly();
  readonly networkGraph = this._networkGraph.asReadonly();
  readonly probabilityType = this._probabilityType.asReadonly();
  readonly diamondAnalysis = this._diamondAnalysis.asReadonly();
  readonly reachabilityResults = this._reachabilityResults.asReadonly();
  readonly monteCarloResults = this._monteCarloResults.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly juliaData = this._juliaData.asReadonly();

  // Computed signals for derived state
  readonly hasNetworkData = computed(() => this._networkGraph() !== null);
  readonly hasSession = computed(() => this._currentSession() !== null);
  readonly sessionId = computed(() => this._currentSession()?.sessionId || null);
  readonly networkId = computed(() => this._currentSession()?.networkId || null);

  readonly workflowState = computed<WorkflowState>(() => {
    const current = this._currentStep();
    const completed = this._completedSteps();
    
    return {
      currentStep: current,
      completedSteps: completed,
      canProceedToStep: (step: WorkflowStep) => this.canProceedToStep(step, completed),
      isStepAccessible: (step: WorkflowStep) => this.isStepAccessible(step, completed)
    };
  });

  readonly hasAnalysisResults = computed(() => {
    return this._diamondAnalysis() !== null || 
           this._reachabilityResults().length > 0 || 
           this._monteCarloResults().length > 0;
  });

  readonly networkSummary = computed(() => {
    const graph = this._networkGraph();
    if (!graph) return null;
    
    return {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      isDirected: graph.directed,
      name: graph.metadata?.name || 'Unnamed Network'
    };
  });

  constructor() {
    // Effect to persist session data when it changes
    effect(() => {
      const session = this._currentSession();
      if (session) {
        this.persistSessionToStorage(session);
      }
    });

    // Effect to clear error after a delay
    effect(() => {
      const error = this._error();
      if (error) {
        setTimeout(() => this.clearError(), 5000);
      }
    });

    // Initialize from stored session on startup
    this.initializeFromStorage();
  }

  // Session management methods
  createSession(sessionId: string, networkId: string, probabilityType: ProbabilityType): void {
    const session: NetworkSession = {
      sessionId,
      networkId,
      createdAt: new Date(),
      lastAccessed: new Date(),
      probabilityType,
      analysisResults: {}
    };

    this._currentSession.set(session);
    this._probabilityType.set(probabilityType);
    this.clearError();
  }

  updateSession(updates: Partial<NetworkSession>): void {
    const current = this._currentSession();
    if (current) {
      this._currentSession.set({
        ...current,
        ...updates,
        lastAccessed: new Date()
      });
    }
  }

  clearSession(): void {
    this._currentSession.set(null);
    this._networkGraph.set(null);
    this._diamondAnalysis.set(null);
    this._reachabilityResults.set([]);
    this._monteCarloResults.set([]);
    this._currentStep.set('network-upload');
    this._completedSteps.set([]);
    this.clearStoredSession();
  }

  // Network data methods
  setNetworkGraph(graph: NetworkGraph): void {
    this._networkGraph.set(graph);
    this.updateSession({ networkGraph: graph });
    this.markStepCompleted('network-upload');
  }

  // Analysis results methods
  setDiamondAnalysis(result: DiamondAnalysisResult): void {
    this._diamondAnalysis.set(result);
    const session = this._currentSession();
    if (session) {
      this.updateSession({
        analysisResults: {
          ...session.analysisResults,
          diamond: result
        }
      });
    }
    this.markStepCompleted('diamond-analysis');
  }

  addReachabilityResult(result: ReachabilityResult): void {
    const current = this._reachabilityResults();
    this._reachabilityResults.set([...current, result]);
    
    const session = this._currentSession();
    if (session) {
      this.updateSession({
        analysisResults: {
          ...session.analysisResults,
          reachability: [...current, result]
        }
      });
    }
    this.markStepCompleted('reachability-analysis');
  }

  addMonteCarloResult(result: MonteCarloResult): void {
    const current = this._monteCarloResults();
    this._monteCarloResults.set([...current, result]);
    
    const session = this._currentSession();
    if (session) {
      this.updateSession({
        analysisResults: {
          ...session.analysisResults,
          monteCarlo: [...current, result]
        }
      });
    }
    this.markStepCompleted('monte-carlo');
  }

  // Workflow management methods
  setCurrentStep(step: WorkflowStep): void {
    if (this.canProceedToStep(step, this._completedSteps())) {
      this._currentStep.set(step);
    }
  }

  markStepCompleted(step: WorkflowStep): void {
    const completed = this._completedSteps();
    if (!completed.includes(step)) {
      this._completedSteps.set([...completed, step]);
    }
  }

  // Loading and error state methods
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  setError(error: string): void {
    this._error.set(error);
  }

  clearError(): void {
    this._error.set(null);
  }

  // File upload state methods
  setUploadProgress(progress: FileUploadProgress | null): void {
    this._uploadProgress.set(progress);
  }

  setUploading(uploading: boolean): void {
    this._isUploading.set(uploading);
  }

  // Julia data methods
  setJuliaData(data: any): void {
    this._juliaData.set(data);
  }

  getJuliaData(): any {
    return this._juliaData();
  }

  // Private helper methods
  private canProceedToStep(step: WorkflowStep, completed: WorkflowStep[]): boolean {
    const stepOrder: WorkflowStep[] = [
      'network-upload',
      'network-structure',
      'diamond-analysis',
      'reachability-analysis',
      'monte-carlo',
      'results'
    ];

    const stepIndex = stepOrder.indexOf(step);
    if (stepIndex === 0) return true; // Can always go to first step

    // Check if previous step is completed
    const previousStep = stepOrder[stepIndex - 1];
    return completed.includes(previousStep);
  }

  private isStepAccessible(step: WorkflowStep, completed: WorkflowStep[]): boolean {
    // Network structure is accessible after upload
    if (step === 'network-structure') {
      return completed.includes('network-upload');
    }
    
    // Analysis steps require network structure to be viewed
    if (['diamond-analysis', 'reachability-analysis', 'monte-carlo'].includes(step)) {
      return completed.includes('network-upload');
    }
    
    // Results accessible if any analysis is completed
    if (step === 'results') {
      return completed.some(s => ['diamond-analysis', 'reachability-analysis', 'monte-carlo'].includes(s));
    }
    
    return true;
  }

  private persistSessionToStorage(session: NetworkSession): void {
    try {
      localStorage.setItem('network-analysis-session', JSON.stringify({
        ...session,
        createdAt: session.createdAt.toISOString(),
        lastAccessed: session.lastAccessed.toISOString()
      }));
    } catch (error) {
      console.warn('Failed to persist session to storage:', error);
    }
  }

  private initializeFromStorage(): void {
    try {
      const stored = localStorage.getItem('network-analysis-session');
      if (stored) {
        const session = JSON.parse(stored);
        session.createdAt = new Date(session.createdAt);
        session.lastAccessed = new Date(session.lastAccessed);
        
        // Check if session is not too old (24 hours)
        const now = new Date();
        const hoursSinceAccess = (now.getTime() - session.lastAccessed.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceAccess < 24) {
          this._currentSession.set(session);
          if (session.networkGraph) {
            this._networkGraph.set(session.networkGraph);
          }
          if (session.probabilityType) {
            this._probabilityType.set(session.probabilityType);
          }
          if (session.analysisResults?.diamond) {
            this._diamondAnalysis.set(session.analysisResults.diamond);
          }
          if (session.analysisResults?.reachability) {
            this._reachabilityResults.set(session.analysisResults.reachability);
          }
          if (session.analysisResults?.monteCarlo) {
            this._monteCarloResults.set(session.analysisResults.monteCarlo);
          }
          
          // Restore completed steps based on available data
          const completed: WorkflowStep[] = ['network-upload'];
          if (session.analysisResults?.diamond) completed.push('diamond-analysis');
          if (session.analysisResults?.reachability?.length > 0) completed.push('reachability-analysis');
          if (session.analysisResults?.monteCarlo?.length > 0) completed.push('monte-carlo');
          this._completedSteps.set(completed);
        } else {
          this.clearStoredSession();
        }
      }
    } catch (error) {
      console.warn('Failed to initialize from storage:', error);
      this.clearStoredSession();
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem('network-analysis-session');
    } catch (error) {
      console.warn('Failed to clear stored session:', error);
    }
  }
}