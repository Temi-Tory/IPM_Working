import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  NetworkStructure,
  AnalysisResponse,
  TabState,
  AnalysisRequest,
  EnhancedNetworkStructure,
  DiamondAnalysisResponse,
  ReachabilityAnalysisResponse,
  CapacityAnalysisResponse,
  CpmAnalysisResponse
} from '../models/network-analysis.models';
import { NetworkBackendService } from './network-backend.service';
import { NetworkStructureService } from './network-structure.service';
import { DiamondAnalysisService } from './diamond-analysis.service';
import { ReachabilityAnalysisService } from './reachability-analysis.service';
import { CapacityAnalysisService } from './capacity-analysis.service';
import { CpmAnalysisService } from './cpm-analysis.service';
import { EnhancedDataParsingService } from './enhanced-data-parsing.service';
import { NetworkSessionService } from './network-session.service';

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

  // Tab state signals
  private uploadTabSignal = signal<TabState>({ enabled: true, completed: false, hasData: false });
  private networkStructureTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private diamondAnalysisTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private exactInferenceTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
  private flowAnalysisTabSignal = signal<TabState>({ enabled: false, completed: false, hasData: false });
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

  readonly uploadTab = computed(() => this.uploadTabSignal());
  readonly networkStructureTab = computed(() => this.networkStructureTabSignal());
  readonly diamondAnalysisTab = computed(() => this.diamondAnalysisTabSignal());
  readonly exactInferenceTab = computed(() => this.exactInferenceTabSignal());
  readonly flowAnalysisTab = computed(() => this.flowAnalysisTabSignal());
  readonly criticalPathTab = computed(() => this.criticalPathTabSignal());
  readonly systemProfileTab = computed(() => this.systemProfileTabSignal());

  // State mutations
  setNetworkData(data: NetworkStructure | null): void {
    this.networkDataSignal.set(data);
    
    if (data) {
      this.networkStructureTabSignal.update(tab => ({ ...tab, enabled: true, hasData: true }));
      this.diamondAnalysisTabSignal.update(tab => ({ ...tab, enabled: true }));
      this.exactInferenceTabSignal.update(tab => ({ ...tab, enabled: true }));
      this.flowAnalysisTabSignal.update(tab => ({ ...tab, enabled: true }));
      this.criticalPathTabSignal.update(tab => ({ ...tab, enabled: true }));
      this.systemProfileTabSignal.update(tab => ({ ...tab, enabled: true }));
    }
  }

  setParsedData(data: any): void {
    this.parsedDataSignal.set(data);
  }

  // Load parsed data from session if available
  loadParsedDataFromSession(): void {
    const currentSession = this.sessionService.getCurrentSession();
    if (currentSession?.parsedData) {
      console.log('🔄 Loading parsed data from session:', currentSession.parsedData);
      this.parsedDataSignal.set(currentSession.parsedData);
    }
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

  // Analysis execution methods
  runAnalysis(request: AnalysisRequest): Observable<AnalysisResponse> {
    this.setLoading(true);
    this.setError(null);

    return new Observable(subscriber => {
      this.networkBackendService.analyzeNetwork(request).subscribe({
        next: (response) => {
          this.setAnalysisResults(response);
          this.setLoading(false);
          subscriber.next(response);
          subscriber.complete();
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
              this.networkDataSignal.set(response.network_structure);
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

  clearState(): void {
    this.networkDataSignal.set(null);
    this.analysisResultsSignal.set(null);
    this.isLoadingSignal.set(false);
    this.errorSignal.set(null);
    this.currentNetworkPathSignal.set(null);

    // Reset all tabs
    this.uploadTabSignal.set({ enabled: true, completed: false, hasData: false });
    this.networkStructureTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.diamondAnalysisTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.exactInferenceTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.flowAnalysisTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.criticalPathTabSignal.set({ enabled: false, completed: false, hasData: false });
    this.systemProfileTabSignal.set({ enabled: false, completed: false, hasData: false });
  }
}