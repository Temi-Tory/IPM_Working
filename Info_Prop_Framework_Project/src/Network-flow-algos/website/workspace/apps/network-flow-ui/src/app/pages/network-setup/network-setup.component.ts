import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  NetworkStateService,
  AnalysisStateService,
  UIStateService,
  AppStateService
} from '@network-analysis/network-core';

@Component({
  selector: 'app-network-setup',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './network-setup.component.html',
  styleUrl: './network-setup.component.scss'
})
export class NetworkSetupComponent implements OnInit {
  // Inject signal-based state services using Angular 20 inject() function
  protected readonly appState = inject(AppStateService);
  protected readonly networkState = inject(NetworkStateService);
  protected readonly analysisState = inject(AnalysisStateService);
  protected readonly uiState = inject(UIStateService);

  // File upload functionality REMOVED - using test networks only

  // Backend connection status
  protected backendConnected = false;
  protected checkingConnection = false;

  ngOnInit(): void {
    // File upload functionality REMOVED - using test networks only
    console.log('🚫 NetworkSetupComponent: File upload functionality DISABLED - using test networks only');
    
    // Check backend connection on component initialization
    this.checkBackendConnection();
  }

  // Backend connection methods
  async checkBackendConnection(): Promise<void> {
    this.checkingConnection = true;
    try {
      this.backendConnected = await this.networkState.testBackendConnection();
      if (this.backendConnected) {
        this.uiState.showSuccess('Backend Connected', 'Julia server is running on port 9090');
      } else {
        this.uiState.showWarning('Backend Disconnected', 'Julia server not responding. Please ensure it\'s running on port 9090');
      }
    } catch {
      this.backendConnected = false;
      this.uiState.showError('Connection Error', 'Failed to connect to Julia server');
    } finally {
      this.checkingConnection = false;
    }
  }

  // File upload methods REMOVED - using test networks only

  async loadSampleNetwork(networkId: string): Promise<void> {
    try {
      this.networkState.setLoading(true);
      this.uiState.showInfo('Loading Sample', `Loading ${networkId} sample network via Julia server...`);
      
      // Use NetworkStateService to load sample through Julia backend
      await this.networkState.loadSampleNetwork(networkId);
      
      this.uiState.showSuccess(
        'Sample Network Loaded',
        `Successfully loaded ${networkId} sample network via Julia server`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.networkState.setError(`Failed to load sample network: ${errorMessage}`);
      this.uiState.showError('Sample Loading Error', errorMessage);
    }
  }

  startAnalysis(): void {
    if (this.networkState.canAnalyze()) {
      this.analysisState.runAnalysis('reachability');
    }
  }

  clearNetwork(): void {
    this.networkState.clearNetwork();
    this.uiState.showInfo('Network Cleared', 'All network data has been removed');
  }

  // All file upload methods REMOVED - using test networks only
}