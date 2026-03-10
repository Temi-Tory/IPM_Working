import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import {
  NetworkStructure,
  AnalysisResponse,
  TabState,
  AnalysisRequest,
  EnhancedNetworkStructure,
  DiamondAnalysisResponse,
  ReachabilityAnalysisResponse,
  CapacityAnalysisResponse,
  CpmAnalysisResponse,
  ScenarioInfo,
  MultiScenarioDiamondResults,
  MultiScenarioReachabilityResults,
  MultiScenarioCapacityResults,
  MultiScenarioCpmResults,
  ComprehensiveScenarioState,
  AnalysisFileGroup,
  ReachabilityFileGroup,
  CapacityFileGroup,
  CpmFileGroup
} from '../models/network-analysis.models';
import { NetworkBackendService } from './network-backend.service';
import { NetworkStructureService } from './network-structure.service';
import { DiamondAnalysisService } from './diamond-analysis.service';
import { ReachabilityAnalysisService } from './reachability-analysis.service';
import { CapacityAnalysisService } from './capacity-analysis.service';
import { CpmAnalysisService } from './cpm-analysis.service';
import { EnhancedDataParsingService } from './enhanced-data-parsing.service';
import { NetworkSessionService } from './network-session.service';
import { FileManagerService } from './file-manager.service';

@Injectable({ providedIn: 'root' })
export class AnalysisStateService {
  private networkBackendService = inject(NetworkBackendService);
  private networkStructureService = inject(NetworkStructureService);
  private diamondAnalysisService = inject(DiamondAnalysisService);
  private reachabilityAnalysisService = inject(ReachabilityAnalysisService);
  private capacityAnalysisService = inject(CapacityAnalysisService);
  private cpmAnalysisService = inject(CpmAnalysisService);
  private enhancedDataParsingService = inject(EnhancedDataParsingService);
  private sessionService = inject(NetworkSessionService);
  private fileManagerService = inject(FileManagerService);

  // Core state signals
  private networkDataSignal = signal<NetworkStructure | null>(null);
  private enhancedNetworkDataSignal = signal<EnhancedNetworkStructure | null>(null);
  private analysisResultsSignal = signal<AnalysisResponse | null>(null);
  private isLoadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private currentNetworkPathSignal = signal<string | null>(null);
  
  // Individual analysis results
  private diamondAnalysisSignal = signal<DiamondAnalysisResponse | null>(null);
  private reachabilityAnalysisSignal = signal<ReachabilityAnalysisResponse | null>(null);
  private capacityAnalysisSignal = signal<CapacityAnalysisResponse | null>(null);
  private cpmAnalysisSignal = signal<CpmAnalysisResponse | null>(null);
  
  // Local parsed data for fast lookups
  private parsedDataSignal = signal<any>(null);
  
  // **ENHANCED: Comprehensive scenario management for all analysis types**
  private availableScenariosSignal = signal<{
    reachability: ScenarioInfo[];
    capacity: ScenarioInfo[];
    cpm: ScenarioInfo[];
    diamond: ScenarioInfo[];
  }>({
    reachability: [],
    capacity: [],
    cpm: [],
    diamond: []
  });

  // **NEW: Multi-scenario results for all analysis types**
  private multiScenarioDiamondResultsSignal = signal<MultiScenarioDiamondResults | null>(null);
  private multiScenarioReachabilityResultsSignal = signal<MultiScenarioReachabilityResults | null>(null);
  private multiScenarioCapacityResultsSignal = signal<MultiScenarioCapacityResults | null>(null);
  private multiScenarioCpmResultsSignal = signal<MultiScenarioCpmResults | null>(null);

  // **NEW: Global scenario synchronization**
  private globalCurrentScenarioSignal = signal<string>('');
  private scenarioSyncEnabledSignal = signal<boolean>(true);

  // ─── View state cache (persists across route navigation) ─────────────────
  // Stores each analysis component's full tab state map so navigating away
  // and back restores results, filters, sort, pagination without re-running.
  private viewStateCache = new Map<string, { tabs: Map<string, any>; activeTabIndex: number; uiState: any }>();

  /** Save a component's tab state to survive route navigation */
  saveViewState(viewKey: string, tabs: Map<string, any>, activeTabIndex: number, uiState?: any): void {
    this.viewStateCache.set(viewKey, { tabs: new Map(tabs), activeTabIndex, uiState: uiState ?? {} });
  }

  /** Restore a component's tab state after route navigation. Returns null if no cache. */
  restoreViewState(viewKey: string): { tabs: Map<string, any>; activeTabIndex: number; uiState: any } | null {
    return this.viewStateCache.get(viewKey) || null;
  }

  /** Clear view cache for a specific view */
  clearViewState(viewKey: string): void {
    this.viewStateCache.delete(viewKey);
  }

  // Tab state signals
  private uploadTabSignal = signal<TabState>({ enabled: true, completed: false, hasData: false });
  private networkStructureTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private diamondAnalysisTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private exactInferenceTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private flowAnalysisTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private capacityAnalysisTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private criticalPathTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private systemProfileTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });

  // Computed signals (read-only)
  readonly networkData = computed(() => this.networkDataSignal());
  readonly enhancedNetworkData = computed(() => this.enhancedNetworkDataSignal());
  readonly analysisResults = computed(() => this.analysisResultsSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly error = computed(() => this.errorSignal());
  readonly currentNetworkPath = computed(() => this.currentNetworkPathSignal());
  
  // Individual analysis results
  readonly diamondAnalysis = computed(() => this.diamondAnalysisSignal());
  readonly reachabilityAnalysis = computed(() => this.reachabilityAnalysisSignal());
  readonly capacityAnalysis = computed(() => this.capacityAnalysisSignal());
  readonly cpmAnalysis = computed(() => this.cpmAnalysisSignal());
  
  // Parsed data for additional information
  readonly parsedData = computed(() => this.parsedDataSignal());
  
  // Available scenarios
  readonly availableScenarios = computed(() => this.availableScenariosSignal());
  
  // **NEW: Multi-scenario results for all analysis types**
  readonly multiScenarioDiamondResults = computed(() => this.multiScenarioDiamondResultsSignal());
  readonly multiScenarioReachabilityResults = computed(() => this.multiScenarioReachabilityResultsSignal());
  readonly multiScenarioCapacityResults = computed(() => this.multiScenarioCapacityResultsSignal());
  readonly multiScenarioCpmResults = computed(() => this.multiScenarioCpmResultsSignal());
  
  // **NEW: Global scenario management**
  readonly globalCurrentScenario = computed(() => this.globalCurrentScenarioSignal());
  readonly scenarioSyncEnabled = computed(() => this.scenarioSyncEnabledSignal());
  
  // **NEW: Comprehensive scenario state**
  readonly comprehensiveScenarioState = computed((): ComprehensiveScenarioState => ({
    reachability: this.multiScenarioReachabilityResults() || {
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    },
    diamond: this.multiScenarioDiamondResults() || {
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    },
    capacity: this.multiScenarioCapacityResults() || {
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    },
    cpm: this.multiScenarioCpmResults() || {
      scenarios: new Map(),
      currentScenario: '',
      availableScenarios: []
    },
    globalCurrentScenario: this.globalCurrentScenario(),
    scenarioSyncEnabled: this.scenarioSyncEnabled()
  }));

  readonly uploadTab = computed(() => this.uploadTabSignal());
  readonly networkStructureTab = computed(() => this.networkStructureTabSignal());
  readonly diamondAnalysisTab = computed(() => this.diamondAnalysisTabSignal());
  readonly exactInferenceTab = computed(() => this.exactInferenceTabSignal());
  readonly flowAnalysisTab = computed(() => this.flowAnalysisTabSignal());
  readonly capacityAnalysisTab = computed(() => this.capacityAnalysisTabSignal());
  readonly criticalPathTab = computed(() => this.criticalPathTabSignal());
  readonly systemProfileTab = computed(() => this.systemProfileTabSignal());

  // State mutations
  setNetworkData(data: NetworkStructure | null): void {
    this.networkDataSignal.set(data);
    
    if (data) {
      this.networkStructureTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
    }
  }

  setParsedData(data: any): void {
    this.parsedDataSignal.set(data);
    
    // **CHANGED: Don't enable analysis tabs immediately - wait for visualization step**
    if (data) {
      console.log('🔍 Parsed data available, but waiting for visualization step to enable analysis tabs:', data);
      
      // Just log what data types are available, but don't enable tabs yet
      const hasNodePriors = (data.float?.node_priors) || (data.pbox?.node_priors) || (data.interval?.node_priors);
      const hasEdgeProbabilities = (data.float?.edge_probabilities) || (data.pbox?.edge_probabilities) || (data.interval?.edge_probabilities);
      
      console.log('📊 Data types found (tabs will be enabled after visualization):', {
        float: !!data.float,
        pbox: !!data.pbox,
        interval: !!data.interval,
        capacity: !!data.capacity && Object.keys(data.capacity).length > 0,
        cpm: !!data.cpm && Object.keys(data.cpm).length > 0,
        hasNodePriors,
        hasEdgeProbabilities
      });
    }
  }

  loadParsedDataFromSession(): void {
    const currentSession = this.sessionService.getCurrentSession();
    if (currentSession?.parsedData) {
      this.setParsedData(currentSession.parsedData);
    }
  }

  /**
   * Enable network structure and visualization tabs - called when "Visualize" button is clicked
   */
  enableVisualizationTabs(): void {
    console.log('🎯 Enabling network structure and visualization tabs');
    this.networkStructureTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
  }

  /**
   * Enable analysis tabs based on available parsed data - called after visualization step
   */
  enableAnalysisTabsAfterVisualization(): void {
    const data = this.parsedDataSignal();
    if (!data) {
      console.log('⚠️ No parsed data available to enable analysis tabs');
      return;
    }

    console.log('🎯 Enabling analysis tabs after visualization step:', data);
    
    // Enable diamond analysis and exact inference if we have any probability data (float, pbox, or interval)
    const hasNodePriors = (data.float?.node_priors) || (data.pbox?.node_priors) || (data.interval?.node_priors);
    const hasEdgeProbabilities = (data.float?.edge_probabilities) || (data.pbox?.edge_probabilities) || (data.interval?.edge_probabilities);
    
    if (hasNodePriors || hasEdgeProbabilities) {
      console.log('✅ Enabling diamond analysis and exact inference tabs - probability data available');
      console.log('📊 Data types found:', {
        float: !!data.float,
        pbox: !!data.pbox,
        interval: !!data.interval,
        hasNodePriors,
        hasEdgeProbabilities
      });
      this.diamondAnalysisTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
      this.exactInferenceTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
    }
    
    // Enable capacity analysis if we have capacity data
    if (data.capacity && Object.keys(data.capacity).length > 0) {
      console.log('✅ Enabling capacity analysis tab - capacity data available');
      this.capacityAnalysisTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
      // Also enable flow analysis for backward compatibility
      this.flowAnalysisTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
    }
    
    // Enable critical path if we have CPM data
    if (data.cpm && Object.keys(data.cpm).length > 0) {
      console.log('✅ Enabling critical path tab - CPM data available');
      this.criticalPathTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
    }
    
    // Enable system profile if we have any analysis data
    if (data.float || data.pbox || data.interval || data.capacity || data.cpm) {
      console.log('✅ Enabling system profile tab - analysis data available');
      this.systemProfileTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
    }
  }

  /**
   * Load network data from file manager instead of API endpoints
   */
  loadNetworkDataFromFileManager(): void {
    console.log('🔍 Loading network data from file manager...');
    
    this.fileManagerService.createNetworkStructureFromFiles().subscribe({
      next: (result) => {
        if (result?.networkStructure) {
          console.log('✅ Network structure created from uploaded files:', result.networkStructure);
          
          // Set the network data for visualization
          this.setNetworkData(result.networkStructure);
          
          // Set parsed data for additional information
          if (result.parsedData) {
            console.log('✅ Parsed data created from uploaded files:', result.parsedData);
            this.setParsedData(result.parsedData);
          }
          
          // Mark upload as completed and enable network structure tab
          this.markTabCompleted('upload');
          this.networkStructureTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
          
          console.log('🎯 Network data and parsed data loaded from file manager');
        } else {
          console.warn('⚠️ No network structure could be created from uploaded files');
        }
      },
      error: (error) => {
        console.error('❌ Error loading network data from file manager:', error);
        this.setError('Failed to create network structure from uploaded files');
      }
    });
  }

  setAnalysisResults(results: AnalysisResponse | null): void {
    console.log('🔍 setAnalysisResults called with:', results);
    this.analysisResultsSignal.set(results);
    
    if (results?.results) {
      console.log('✅ Processing results.results:', results.results);
      
      // Handle the nested structure: results.results.results contains the actual analysis data
      const analysisData = (results.results as any).results || results.results;
      console.log('🔍 Analysis data:', analysisData);
      console.log('📊 Network structure exists:', !!analysisData.network_structure);
      console.log('💎 Capacity scenarios:', analysisData.capacity_scenarios);
      console.log('🔄 Reachability scenarios:', analysisData.reachability_scenarios);
      console.log('⏱️ CPM scenarios:', analysisData.cpm_scenarios);
      
      // Update network structure data
      this.setNetworkData(analysisData.network_structure);
      
      // Extract and set individual analysis results
      this.extractAnalysisResults(analysisData);
      
      // **NEW: Extract diamond scenarios from reachability scenarios**
      this.extractDiamondScenarios(results);
      
      // Mark tabs as completed based on available results
      if (analysisData.network_structure) {
        console.log('✅ Marking network-structure as completed');
        this.markTabCompleted('network-structure');
      }
      
      if (analysisData.diamond_analysis ||
          (analysisData.reachability_scenarios &&
           Object.values(analysisData.reachability_scenarios).some((s: any) => s.diamond_analysis))) {
        console.log('✅ Marking diamonds as completed');
        this.markTabCompleted('diamonds');
      }
      
      if (analysisData.reachability_scenarios &&
          Object.values(analysisData.reachability_scenarios).some((s: any) => s.exact_inference)) {
        console.log('✅ Marking exact-inference as completed');
        this.markTabCompleted('exact-inference');
      }
      
      if (analysisData.capacity_scenarios &&
          Object.keys(analysisData.capacity_scenarios).length > 0) {
        console.log('✅ Marking flow as completed');
        this.markTabCompleted('flow');
      }
      
      if (analysisData.cpm_scenarios &&
          Object.keys(analysisData.cpm_scenarios).length > 0) {
        console.log('✅ Marking critical-path as completed');
        this.markTabCompleted('critical-path');
      }
      
      // System profile is completed when we have any analysis results
      if (analysisData) {
        console.log('✅ Marking system-profile as completed');
        this.markTabCompleted('system-profile');
      }
    }
  }

  setLoading(loading: boolean): void {
    this.isLoadingSignal.set(loading);
  }

  setError(error: string | null): void {
    this.errorSignal.set(error);
  }

  setCurrentNetworkPath(path: string | null): void {
    this.currentNetworkPathSignal.set(path);
  }

  markTabCompleted(tabName: string): void {
    console.log(`🎯 markTabCompleted called for: ${tabName}`);
    switch (tabName) {
      case 'upload':
        this.uploadTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Upload tab marked as completed');
        break;
      case 'network-structure':
        this.networkStructureTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Network structure tab marked as completed');
        break;
      case 'diamonds':
        this.diamondAnalysisTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Diamond analysis tab marked as completed');
        break;
      case 'exact-inference':
        this.exactInferenceTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Exact inference tab marked as completed');
        break;
      case 'flow':
        this.flowAnalysisTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Flow analysis tab marked as completed');
        break;
      case 'critical-path':
        this.criticalPathTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ Critical path tab marked as completed');
        break;
      case 'system-profile':
        this.systemProfileTabSignal.update(tab => ({ ...tab, completed: true }));
        console.log('✅ System profile tab marked as completed');
        break;
    }
  }

  // Helper methods for the app component
  hasActiveAnalysis(): boolean {
    return this.networkDataSignal() !== null || this.currentNetworkPathSignal() !== null;
  }

  getCurrentSnapshot(): { networkName: string } | null {
    const results = this.analysisResultsSignal();
    const networkPath = this.currentNetworkPathSignal();
    
    if (results?.results?.analysis_summary?.network_name) {
      return { networkName: results.results.analysis_summary.network_name };
    }
    
    if (networkPath) {
      // Extract network name from path
      const pathParts = networkPath.split(/[\\/]/);
      const networkName = pathParts[pathParts.length - 1] || 'Current Network';
      return { networkName };
    }
    
    return null;
  }

  getComprehensiveStructureData(): NetworkStructure | null {
    return this.networkDataSignal();
  }

  setComprehensiveStructureData(data: NetworkStructure): void {
    this.setNetworkData(data);
  }

  loadComprehensiveNetworkStructure(): Observable<NetworkStructure> {
    const networkPath = this.currentNetworkPathSignal();
    if (!networkPath) {
      return of();
    }

    return this.networkBackendService.quickStructureAnalysis(networkPath);
  }

  // Analysis execution methods - use individual services instead of combined endpoint
  runAnalysis(request: AnalysisRequest): Observable<AnalysisResponse> {
    this.setLoading(true);
    this.setError(null);

    return new Observable(subscriber => {
      // Start with network structure
      this.loadNetworkStructure(request.networkPath).subscribe({
        next: () => {
          // Then run individual analyses based on request
          const analysisPromises: Promise<any>[] = [];
          
          // Diamond analysis if requested
          if (request.analysisConfig?.diamondAnalysis) {
            const diamondPromise = this.loadDiamondAnalysis(request.networkPath).toPromise();
            analysisPromises.push(diamondPromise);
          }
          
          // Capacity analysis if requested and scenarios available
          if (request.analysisConfig?.flowAnalysis && request.capacityScenarios?.length > 0) {
            // Use the first capacity scenario for now
            const firstCapacityScenario = request.capacityScenarios[0];
            const capacityPromise = this.capacityAnalysisService.analyzeCapacity({
              networkPath: request.networkPath,
              edgesFilePath: `${request.networkPath}/${request.networkPath}.EDGES`,
              capacitiesPath: firstCapacityScenario.capacities_path
            }).toPromise();
            analysisPromises.push(capacityPromise);
          }
          
          // CPM analysis if requested and scenarios available
          if (request.analysisConfig?.criticalPath && request.cpmScenarios?.length > 0) {
            // Use the first CPM scenario for now
            const firstCpmScenario = request.cpmScenarios[0];
            const cpmPromise = this.cpmAnalysisService.analyzeCpm({
              networkPath: request.networkPath,
              edgesFilePath: `${request.networkPath}/${request.networkPath}.EDGES`,
              cpmPath: firstCpmScenario.cpm_path
            }).toPromise();
            analysisPromises.push(cpmPromise);
          }
          
          // Wait for all analyses to complete
          Promise.allSettled(analysisPromises).then(results => {
            // Create a combined response
            const response: AnalysisResponse = {
              success: true,
              message: 'Analysis completed using individual services',
              results: {
                network_structure: this.networkData()!,
                diamond_analysis: this.diamondAnalysis()?.diamond_analysis,
                capacity_scenarios: this.capacityAnalysis() ? { 'default': this.capacityAnalysis()!.capacity_result } : undefined,
                cpm_scenarios: this.cpmAnalysis() ? { 'default': this.cpmAnalysis()!.cpm_result } : undefined,
                analysis_summary: {
                  network_name: 'Current Network',
                  total_computation_time: 0,
                  reachability_scenarios_count: 0,
                  capacity_scenarios_count: this.capacityAnalysis() ? 1 : 0,
                  cpm_scenarios_count: this.cpmAnalysis() ? 1 : 0,
                  timestamp: new Date().toISOString()
                }
              }
            };
            
            this.setLoading(false);
            subscriber.next(response);
            subscriber.complete();
          }).catch(error => {
            this.setError(error.message);
            this.setLoading(false);
            subscriber.error(error);
          });
        },
        error: (error) => {
          this.setError(error.message);
          this.setLoading(false);
          subscriber.error(error);
        }
      });
    });
  }

  // New method to load just network structure using individual endpoint
  loadNetworkStructure(networkPath: string): Observable<void> {
    this.setLoading(true);
    this.setError(null);
    this.setCurrentNetworkPath(networkPath);

    return new Observable(observer => {
      this.networkStructureService.analyzeNetworkStructure({ networkPath })
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.setNetworkData(response.network_structure);
              this.markTabCompleted('network-structure');
              observer.next();
              observer.complete();
            } else {
              const error = `Network structure analysis failed: ${response.message}`;
              this.setError(error);
              observer.error(error);
            }
            this.setLoading(false);
          },
          error: (error) => {
            const errorMessage = `Failed to analyze network structure: ${error.message || error}`;
            this.setError(errorMessage);
            this.setLoading(false);
            observer.error(error);
          }
        });
    });
  }

  // Method to load diamond analysis using individual endpoint
  loadDiamondAnalysis(networkPath: string): Observable<void> {
    this.setLoading(true);
    this.setError(null);
    this.setCurrentNetworkPath(networkPath);

    return new Observable(observer => {
      this.diamondAnalysisService.analyzeDiamonds({ networkPath })
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.diamondAnalysisSignal.set(response);
              this.markTabCompleted('diamonds');
              observer.next();
              observer.complete();
            } else {
              const error = `Diamond analysis failed: ${response.message}`;
              this.setError(error);
              observer.error(error);
            }
            this.setLoading(false);
          },
          error: (error) => {
            const errorMessage = `Failed to analyze diamonds: ${error.message || error}`;
            this.setError(errorMessage);
            this.setLoading(false);
            observer.error(error);
          }
        });
    });
  }

  // Extract and set individual analysis results from comprehensive analysis
  private extractAnalysisResults(analysisData: any): void {
    console.log('🔍 Extracting individual analysis results...');
    
    // Extract diamond analysis (either direct or from first reachability scenario)
    let diamondAnalysis = analysisData.diamond_analysis;
    if (!diamondAnalysis && analysisData.reachability_scenarios) {
      const firstScenario = Object.values(analysisData.reachability_scenarios)[0] as any;
      diamondAnalysis = firstScenario?.diamond_analysis;
    }
    
    if (diamondAnalysis) {
      console.log('💎 Setting diamond analysis data:', diamondAnalysis);
      this.diamondAnalysisSignal.set({
        success: true,
        message: 'Diamond analysis completed',
        network_name: analysisData.network_name || 'Current Network',
        timestamp: new Date().toISOString(),
        diamond_analysis: diamondAnalysis
      });
    }
    
    // Extract reachability analysis
    if (analysisData.reachability_scenarios) {
      console.log('🔄 Setting reachability analysis data');
      // For now, we'll set the first scenario as the primary reachability analysis
      const firstScenarioKey = Object.keys(analysisData.reachability_scenarios)[0];
      const firstScenario = analysisData.reachability_scenarios[firstScenarioKey];
      
      this.reachabilityAnalysisSignal.set({
        success: true,
        message: 'Reachability analysis completed',
        network_name: analysisData.network_name || 'Current Network',
        timestamp: new Date().toISOString(),
        reachability_result: firstScenario
      });
    }
    
    // Extract capacity analysis
    if (analysisData.capacity_scenarios) {
      console.log('🔄 Setting capacity analysis data');
      const firstScenarioKey = Object.keys(analysisData.capacity_scenarios)[0];
      const firstScenario = analysisData.capacity_scenarios[firstScenarioKey];
      
      this.capacityAnalysisSignal.set({
        success: true,
        message: 'Capacity analysis completed',
        network_name: analysisData.network_name || 'Current Network',
        timestamp: new Date().toISOString(),
        capacity_result: firstScenario
      });
    }
    
    // Extract CPM analysis
    if (analysisData.cpm_scenarios) {
      console.log('⏱️ Setting CPM analysis data');
      const firstScenarioKey = Object.keys(analysisData.cpm_scenarios)[0];
      const firstScenario = analysisData.cpm_scenarios[firstScenarioKey];
      
      this.cpmAnalysisSignal.set({
        success: true,
        message: 'CPM analysis completed',
        network_name: analysisData.network_name || 'Current Network',
        timestamp: new Date().toISOString(),
        cpm_result: firstScenario
      });
    }
  }

  // **NEW: Extract diamond scenarios from analysis results**
  private extractDiamondScenarios(results: AnalysisResponse): void {
    const scenarios: ScenarioInfo[] = [];
    
    if (results.analysis_config?.reachabilityScenarios) {
      results.analysis_config.reachabilityScenarios.forEach(scenario => {
        const dataType = this.detectDataType(scenario.name);
        scenarios.push({
          name: scenario.name,
          dataType,
          path: scenario.nodepriors_path,
          displayName: this.createDisplayName(scenario.name, dataType)
        });
      });
    }

    this.availableScenariosSignal.update(current => ({
      ...current,
      diamond: scenarios
    }));
  }

  // **NEW: Multi-scenario diamond analysis**
  loadMultiScenarioDiamondAnalysis(networkPath: string): Observable<void> {
    const scenarios = this.availableScenarios().diamond;
    if (scenarios.length === 0) {
      return of();
    }

    this.setLoading(true);
    this.setError(null);

    return new Observable(observer => {
      this.diamondAnalysisService.analyzeMultipleScenarios(networkPath, scenarios)
        .subscribe({
          next: (results) => {
            this.multiScenarioDiamondResultsSignal.set(results);
            this.markTabCompleted('diamonds');
            observer.next();
            observer.complete();
          },
          error: (error) => {
            const errorMessage = `Failed to analyze multiple diamond scenarios: ${error.message || error}`;
            this.setError(errorMessage);
            observer.error(error);
          },
          complete: () => {
            this.setLoading(false);
          }
        });
    });
  }

  // **NEW: Set current diamond scenario**
  setCurrentDiamondScenario(scenarioName: string): void {
    this.diamondAnalysisService.setCurrentScenario(scenarioName);
  }

  // **NEW: Helper methods**
  private detectDataType(scenarioName: string): 'float' | 'interval' | 'pbox' {
    if (scenarioName.includes('pbox')) return 'pbox';
    if (scenarioName.includes('interval')) return 'interval';
    return 'float';
  }

  private createDisplayName(scenarioName: string, dataType: string): string {
    const baseName = scenarioName.replace(/^(float|interval|pbox)_?/, '');
    const typeLabel = dataType.toUpperCase();
    return `${baseName} (${typeLabel})`;
  }

  // NEW: Methods to work with File Manager Service

  /**
   * Run analysis using file groups from file manager
   */
  runAnalysisFromFileGroup(group: AnalysisFileGroup): Observable<void> {
    this.setLoading(true);
    this.setError(null);

    return new Observable(observer => {
      if (!group.canRunAnalysis) {
        const error = `Cannot run ${group.analysisType} analysis: missing files - ${group.missingFiles.join(', ')}`;
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
        return;
      }

      // Run appropriate analysis based on group type
      if (group.analysisType === 'network') {
        this.runNetworkStructureFromGroup(group).subscribe({
          next: () => {
            observer.next();
            observer.complete();
          },
          error: (error) => observer.error(error)
        });
      } else if (group.analysisType === 'reachability') {
        this.runReachabilityFromGroup(group as ReachabilityFileGroup).subscribe({
          next: () => {
            observer.next();
            observer.complete();
          },
          error: (error) => observer.error(error)
        });
      } else if (group.analysisType === 'capacity') {
        this.runCapacityFromGroup(group as CapacityFileGroup).subscribe({
          next: () => {
            observer.next();
            observer.complete();
          },
          error: (error) => observer.error(error)
        });
      } else if (group.analysisType === 'cpm') {
        this.runCpmFromGroup(group as CpmFileGroup).subscribe({
          next: () => {
            observer.next();
            observer.complete();
          },
          error: (error) => observer.error(error)
        });
      } else {
        const error = `Unsupported analysis type: ${group.analysisType}`;
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
      }
    });
  }

  /**
   * Get available analysis groups from file manager
   */
  getAvailableAnalysisGroups(): AnalysisFileGroup[] {
    return this.fileManagerService.getReadyAnalysisGroups();
  }

  /**
   * Check if files are uploaded and ready for analysis
   */
  hasUploadedFiles(): boolean {
    return this.fileManagerService.uploadedFiles().length > 0;
  }

  /**
   * Update tab states based on file manager state
   */
  updateTabStatesFromFileManager(): void {
    const fileState = this.fileManagerService.fileManagerState();
    const groups = fileState.analysisGroups;

    // Upload tab is completed if we have files
    if (fileState.uploadedFiles.length > 0) {
      this.markTabCompleted('upload');
    }

    // Enable tabs based on available analysis groups
    if (groups.network.canRunAnalysis) {
      this.networkStructureTabSignal.update(tab => ({ ...tab, enabled: true }));
    }

    if (groups.reachability.some(g => g.canRunAnalysis)) {
      this.diamondAnalysisTabSignal.update(tab => ({ ...tab, enabled: true }));
      this.exactInferenceTabSignal.update(tab => ({ ...tab, enabled: true }));
    }

    if (groups.capacity.some(g => g.canRunAnalysis)) {
      this.flowAnalysisTabSignal.update(tab => ({ ...tab, enabled: true }));
    }

    if (groups.cpm.some(g => g.canRunAnalysis)) {
      this.criticalPathTabSignal.update(tab => ({ ...tab, enabled: true }));
    }

    // Enable system profile if any analysis can be run
    const hasAnyAnalysis = groups.network.canRunAnalysis ||
                          groups.reachability.some(g => g.canRunAnalysis) ||
                          groups.capacity.some(g => g.canRunAnalysis) ||
                          groups.cpm.some(g => g.canRunAnalysis);
    
    if (hasAnyAnalysis) {
      this.systemProfileTabSignal.update(tab => ({ ...tab, enabled: true }));
    }
  }

  /**
   * Run network structure analysis from file group
   */
  private runNetworkStructureFromGroup(group: AnalysisFileGroup): Observable<void> {
    if (!group.networkPath || !group.edgesFile) {
      return new Observable(observer => {
        const error = 'Network structure analysis requires network path and edges file';
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
      });
    }

    return this.networkStructureService.analyzeNetworkStructure({
      networkPath: group.networkPath,
      edgesFilePath: group.edgesFile.path
    }).pipe(
      tap(response => {
        if (response.success) {
          this.setNetworkData(response.network_structure);
          this.setCurrentNetworkPath(group.networkPath!);
          this.markTabCompleted('network-structure');
        } else {
          this.setError(`Network structure analysis failed: ${response.message}`);
        }
        this.setLoading(false);
      }),
      map(() => void 0)
    );
  }

  /**
   * Run reachability analysis from file group
   */
  private runReachabilityFromGroup(group: ReachabilityFileGroup): Observable<void> {
    if (!group.networkPath || !group.nodePriorsFile || !group.linkProbabilitiesFile) {
      return new Observable(observer => {
        const error = 'Reachability analysis requires network path, node priors, and link probabilities files';
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
      });
    }

    const edgesFilePath = group.edgesFile?.path || `${group.networkPath}/${group.networkPath}.EDGES`;

    return this.reachabilityAnalysisService.analyzeReachability({
      networkPath: group.networkPath,
      edgesFilePath,
      nodepriorsPath: group.nodePriorsFile.path,
      linkprobsPath: group.linkProbabilitiesFile.path
    }).pipe(
      tap(response => {
        if (response.success) {
          this.reachabilityAnalysisSignal.set(response);
          this.markTabCompleted('exact-inference');
        } else {
          this.setError(`Reachability analysis failed: ${response.message}`);
        }
        this.setLoading(false);
      }),
      map(() => void 0)
    );
  }

  /**
   * Run capacity analysis from file group
   */
  private runCapacityFromGroup(group: CapacityFileGroup): Observable<void> {
    if (!group.networkPath || !group.capacitiesFile) {
      return new Observable(observer => {
        const error = 'Capacity analysis requires network path and capacities file';
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
      });
    }

    const edgesFilePath = group.edgesFile?.path || `${group.networkPath}/${group.networkPath}.EDGES`;

    return this.capacityAnalysisService.analyzeCapacity({
      networkPath: group.networkPath,
      edgesFilePath,
      capacitiesPath: group.capacitiesFile.path
    }).pipe(
      tap(response => {
        if (response.success) {
          this.capacityAnalysisSignal.set(response);
          this.markTabCompleted('flow');
        } else {
          this.setError(`Capacity analysis failed: ${response.message}`);
        }
        this.setLoading(false);
      }),
      map(() => void 0)
    );
  }

  /**
   * Run CPM analysis from file group
   */
  private runCpmFromGroup(group: CpmFileGroup): Observable<void> {
    if (!group.networkPath || !group.cpmInputsFile) {
      return new Observable(observer => {
        const error = 'CPM analysis requires network path and CPM inputs file';
        this.setError(error);
        this.setLoading(false);
        observer.error(error);
      });
    }

    const edgesFilePath = group.edgesFile?.path || `${group.networkPath}/${group.networkPath}.EDGES`;

    return this.cpmAnalysisService.analyzeCpm({
      networkPath: group.networkPath,
      edgesFilePath,
      cpmPath: group.cpmInputsFile.path
    }).pipe(
      tap(response => {
        if (response.success) {
          this.cpmAnalysisSignal.set(response);
          this.markTabCompleted('critical-path');
        } else {
          this.setError(`CPM analysis failed: ${response.message}`);
        }
        this.setLoading(false);
      }),
      map(() => void 0)
    );
  }

  clearState(): void {
    this.networkDataSignal.set(null);
    this.enhancedNetworkDataSignal.set(null);
    this.analysisResultsSignal.set(null);
    this.isLoadingSignal.set(false);
    this.errorSignal.set(null);
    this.currentNetworkPathSignal.set(null);
    this.diamondAnalysisSignal.set(null);
    this.reachabilityAnalysisSignal.set(null);
    this.capacityAnalysisSignal.set(null);
    this.cpmAnalysisSignal.set(null);
    this.parsedDataSignal.set(null);
    this.availableScenariosSignal.set({
      reachability: [],
      capacity: [],
      cpm: [],
      diamond: []
    });
    this.multiScenarioDiamondResultsSignal.set(null);
    
    // **NEW: Clear additional multi-scenario states**
    this.multiScenarioReachabilityResultsSignal.set(null);
    this.multiScenarioCapacityResultsSignal.set(null);
    this.multiScenarioCpmResultsSignal.set(null);
    this.globalCurrentScenarioSignal.set('');

    // Clear view state cache (forces re-run on next navigation)
    this.viewStateCache.clear();

    // Reset tab states
    this.uploadTabSignal.set({ enabled: true, completed: false, hasData: false });
    this.networkStructureTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.diamondAnalysisTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.exactInferenceTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.flowAnalysisTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.criticalPathTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.systemProfileTabSignal.set({ enabled: false, completed: false, hasData: false });
    
    console.log('🧹 Analysis state cleared');
  }

  // **NEW: Comprehensive scenario management methods**
  
  /**
   * Set multi-scenario results for reachability analysis
   */
  setMultiScenarioReachabilityResults(results: MultiScenarioReachabilityResults): void {
    this.multiScenarioReachabilityResultsSignal.set(results);
    this.updateGlobalScenario(results.currentScenario);
    console.log('✅ Multi-scenario reachability results set:', {
      scenarios: results.scenarios.size,
      current: results.currentScenario
    });
  }

  /**
   * Set multi-scenario results for diamond analysis
   */
  setMultiScenarioDiamondResults(results: MultiScenarioDiamondResults): void {
    this.multiScenarioDiamondResultsSignal.set(results);
    this.updateGlobalScenario(results.currentScenario);
    console.log('✅ Multi-scenario diamond results set:', {
      scenarios: results.scenarios.size,
      current: results.currentScenario
    });
  }

  /**
   * Set multi-scenario results for capacity analysis
   */
  setMultiScenarioCapacityResults(results: MultiScenarioCapacityResults): void {
    this.multiScenarioCapacityResultsSignal.set(results);
    this.updateGlobalScenario(results.currentScenario);
    console.log('✅ Multi-scenario capacity results set:', {
      scenarios: results.scenarios.size,
      current: results.currentScenario
    });
  }

  /**
   * Set multi-scenario results for CPM analysis
   */
  setMultiScenarioCpmResults(results: MultiScenarioCpmResults): void {
    this.multiScenarioCpmResultsSignal.set(results);
    this.updateGlobalScenario(results.currentScenario);
    console.log('✅ Multi-scenario CPM results set:', {
      scenarios: results.scenarios.size,
      current: results.currentScenario
    });
  }

  /**
   * Set global current scenario and sync across all analysis types
   */
  setGlobalCurrentScenario(scenarioName: string): void {
    this.globalCurrentScenarioSignal.set(scenarioName);
    
    if (this.scenarioSyncEnabled()) {
      // Update current scenario in all multi-scenario results
      this.syncScenarioAcrossAnalyses(scenarioName);
    }
    
    console.log('🎯 Global current scenario set to:', scenarioName);
  }

  /**
   * Toggle scenario synchronization
   */
  toggleScenarioSync(enabled: boolean): void {
    this.scenarioSyncEnabledSignal.set(enabled);
    console.log('🔄 Scenario synchronization:', enabled ? 'ENABLED' : 'DISABLED');
  }

  /**
   * Extract and set available scenarios from file manager
   */
  extractScenariosFromFileManager(): void {
    const fileGroups = this.fileManagerService.analysisGroups();
    const scenarios = {
      reachability: this.extractReachabilityScenarios(fileGroups.reachability),
      capacity: this.extractCapacityScenarios(fileGroups.capacity),
      cpm: this.extractCpmScenarios(fileGroups.cpm),
      diamond: this.extractReachabilityScenarios(fileGroups.reachability) // Diamond uses reachability scenarios
    };
    
    this.availableScenariosSignal.set(scenarios);
    console.log('📊 Scenarios extracted from file manager:', {
      reachability: scenarios.reachability.length,
      capacity: scenarios.capacity.length,
      cpm: scenarios.cpm.length,
      diamond: scenarios.diamond.length
    });
  }

  // **PRIVATE: Helper methods**
  
  private updateGlobalScenario(scenarioName: string): void {
    if (!this.globalCurrentScenario() && scenarioName) {
      this.globalCurrentScenarioSignal.set(scenarioName);
    }
  }

  private syncScenarioAcrossAnalyses(scenarioName: string): void {
    // Update reachability current scenario
    const reachabilityResults = this.multiScenarioReachabilityResults();
    if (reachabilityResults && reachabilityResults.scenarios.has(scenarioName)) {
      this.multiScenarioReachabilityResultsSignal.update(results =>
        results ? { ...results, currentScenario: scenarioName } : results
      );
    }

    // Update diamond current scenario
    const diamondResults = this.multiScenarioDiamondResults();
    if (diamondResults && diamondResults.scenarios.has(scenarioName)) {
      this.multiScenarioDiamondResultsSignal.update(results =>
        results ? { ...results, currentScenario: scenarioName } : results
      );
    }

    // Update capacity current scenario
    const capacityResults = this.multiScenarioCapacityResults();
    if (capacityResults && capacityResults.scenarios.has(scenarioName)) {
      this.multiScenarioCapacityResultsSignal.update(results =>
        results ? { ...results, currentScenario: scenarioName } : results
      );
    }

    // Update CPM current scenario
    const cpmResults = this.multiScenarioCpmResults();
    if (cpmResults && cpmResults.scenarios.has(scenarioName)) {
      this.multiScenarioCpmResultsSignal.update(results =>
        results ? { ...results, currentScenario: scenarioName } : results
      );
    }
  }

  private extractReachabilityScenarios(groups: ReachabilityFileGroup[]): ScenarioInfo[] {
    return groups.map((group, index) => {
      const nodePriorsFile = group.files.find(f => f.suggestedRole === 'Node Priors');
      const scenarioName = this.generateScenarioName(nodePriorsFile?.path || '', index);
      
      return {
        name: scenarioName,
        dataType: this.detectDataTypeFromPath(nodePriorsFile?.path || ''),
        path: nodePriorsFile?.path || '',
        analysisType: 'reachability' as const,
        displayName: scenarioName
      };
    }).filter(scenario => scenario.path);
  }

  private extractCapacityScenarios(groups: CapacityFileGroup[]): ScenarioInfo[] {
    return groups.map((group, index) => {
      const capacitiesFile = group.files.find(f => f.suggestedRole === 'Capacities');
      const scenarioName = this.generateScenarioName(capacitiesFile?.path || '', index);
      
      return {
        name: scenarioName,
        dataType: 'float' as const, // Capacity scenarios are typically float
        path: capacitiesFile?.path || '',
        analysisType: 'capacity' as const,
        displayName: scenarioName
      };
    }).filter(scenario => scenario.path);
  }

  private extractCpmScenarios(groups: CpmFileGroup[]): ScenarioInfo[] {
    return groups.map((group, index) => {
      const cpmFile = group.files.find(f => f.suggestedRole === 'CPM Data');
      const scenarioName = this.generateScenarioName(cpmFile?.path || '', index);
      
      return {
        name: scenarioName,
        dataType: 'float' as const, // CPM scenarios are typically float
        path: cpmFile?.path || '',
        analysisType: 'cpm' as const,
        displayName: scenarioName
      };
    }).filter(scenario => scenario.path);
  }

  private generateScenarioName(filePath: string, index: number): string {
    if (!filePath) return `Scenario ${index + 1}`;
    
    // Extract meaningful name from file path
    const pathParts = filePath.split(/[\\/]/);
    const fileName = pathParts[pathParts.length - 1];
    const folderName = pathParts[pathParts.length - 2];
    
    // Try to extract data type and meaningful name
    if (folderName && folderName !== fileName) {
      return folderName.charAt(0).toUpperCase() + folderName.slice(1);
    }
    
    // Fallback to filename without extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
  }

  private detectDataTypeFromPath(filePath: string): 'float' | 'interval' | 'pbox' {
    const pathLower = filePath.toLowerCase();
    if (pathLower.includes('pbox')) return 'pbox';
    if (pathLower.includes('interval')) return 'interval';
    return 'float';
  }
}