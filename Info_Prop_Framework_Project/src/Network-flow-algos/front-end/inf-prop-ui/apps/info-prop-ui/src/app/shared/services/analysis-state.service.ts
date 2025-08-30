import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { 
  NetworkStructure, 
  AnalysisResponse, 
  TabState,
  AnalysisRequest 
} from '../models/network-analysis.models';
import { NetworkBackendService } from './network-backend.service';

@Injectable({ providedIn: 'root' })
export class AnalysisStateService {
  private networkBackendService = inject(NetworkBackendService);

  // Core state signals
  private networkDataSignal = signal<NetworkStructure | null>(null);
  private analysisResultsSignal = signal<AnalysisResponse | null>(null);
  private isLoadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private currentNetworkPathSignal = signal<string | null>(null);

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
  readonly analysisResults = computed(() => this.analysisResultsSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly error = computed(() => this.errorSignal());
  readonly currentNetworkPath = computed(() => this.currentNetworkPathSignal());

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

  setAnalysisResults(results: AnalysisResponse | null): void {
    this.analysisResultsSignal.set(results);
    
    if (results?.results) {
      // Update network structure data
      this.setNetworkData(results.results.network_structure);
      
      // Mark tabs as completed based on available results
      if (results.results.network_structure) {
        this.markTabCompleted('network-structure');
      }
      
      if (results.results.diamond_analysis || 
          (results.results.reachability_scenarios && 
           Object.values(results.results.reachability_scenarios).some(s => s.diamond_analysis))) {
        this.markTabCompleted('diamonds');
      }
      
      if (results.results.reachability_scenarios && 
          Object.values(results.results.reachability_scenarios).some(s => s.exact_inference)) {
        this.markTabCompleted('exact-inference');
      }
      
      if (results.results.capacity_scenarios && 
          Object.keys(results.results.capacity_scenarios).length > 0) {
        this.markTabCompleted('flow');
      }
      
      if (results.results.cpm_scenarios && 
          Object.keys(results.results.cpm_scenarios).length > 0) {
        this.markTabCompleted('critical-path');
      }
      
      // System profile is completed when we have any analysis results
      if (results.results) {
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
    switch (tabName) {
      case 'upload':
        this.uploadTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'network-structure':
        this.networkStructureTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'diamonds':
        this.diamondAnalysisTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'exact-inference':
        this.exactInferenceTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'flow':
        this.flowAnalysisTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'critical-path':
        this.criticalPathTabSignal.update(tab => ({ ...tab, completed: true }));
        break;
      case 'system-profile':
        this.systemProfileTabSignal.update(tab => ({ ...tab, completed: true }));
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
    
    if (results?.network_name) {
      return { networkName: results.network_name };
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
  }
}