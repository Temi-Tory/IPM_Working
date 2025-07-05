import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  NetworkStateService,
  AnalysisStateService,
  UIStateService,
  AppStateService,
  NetworkData
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

  // Computed signal for uploaded files as array for template iteration
  protected readonly uploadedFilesArray = computed(() => {
    const files = this.networkState.uploadedFiles();
    return Object.entries(files)
      .filter(([, file]) => file !== undefined)
      .map(([type, file]) => ({ type, file: file as File }));
  });

  // Backend connection status
  protected backendConnected = false;
  protected checkingConnection = false;

  ngOnInit(): void {
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
    } catch (error) {
      this.backendConnected = false;
      this.uiState.showError('Connection Error', 'Failed to connect to Julia server');
    } finally {
      this.checkingConnection = false;
    }
  }

  // Component methods for handling user interactions
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.handleFileUpload(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  }

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

  private async handleFileUpload(file: File): Promise<void> {
    try {
      this.networkState.setLoading(true);
      this.uiState.showInfo('Processing File', `Processing ${file.name}...`);

      // Determine file type based on name or content
      const fileType = this.determineFileType(file.name);
      
      // Add to uploaded files using NetworkStateService
      await this.networkState.validateAndUploadFile(file, fileType);

      // If this is a DAG file, process all uploaded files through Julia backend
      if (fileType === 'dag') {
        this.uiState.showInfo('Connecting to Server', 'Sending data to Julia backend for processing...');
        
        // Process files through Julia server
        const result = await this.networkState.processUploadedFiles();
        
        this.uiState.showSuccess(
          'Network Processed',
          `Successfully processed network via Julia server. Nodes: ${result.networkData.nodes.length}, Edges: ${result.networkData.edges.length}`
        );
      } else {
        this.uiState.showInfo(
          'File Added',
          `${fileType} file added. Upload DAG file to complete network setup and process via Julia server.`
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.networkState.setError(`Failed to process file: ${errorMessage}`);
      this.uiState.showError('File Processing Error', errorMessage);
    } finally {
      this.networkState.setLoading(false);
    }
  }

  private determineFileType(filename: string): 'dag' | 'nodeProbabilities' | 'edgeProbabilities' {
    const lower = filename.toLowerCase();
    
    if (lower.includes('node') || lower.includes('prob')) {
      return 'nodeProbabilities';
    } else if (lower.includes('edge')) {
      return 'edgeProbabilities';
    } else {
      return 'dag';
    }
  }

  // Note: Local parsing methods removed - now using Julia backend via NetworkStateService
}