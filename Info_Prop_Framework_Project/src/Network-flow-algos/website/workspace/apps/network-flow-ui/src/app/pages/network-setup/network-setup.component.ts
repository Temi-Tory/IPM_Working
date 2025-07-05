import { Component, inject, computed } from '@angular/core';
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
export class NetworkSetupComponent {
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

  loadSampleNetwork(networkId: string): void {
    // Generate sample network data
    const sampleNetwork = this.generateSampleNetwork(networkId);
    
    this.networkState.setLoading(true);
    
    // Simulate loading delay
    setTimeout(() => {
      this.networkState.loadNetwork(sampleNetwork);
      this.uiState.showSuccess(
        'Sample Network Loaded',
        `Successfully loaded ${networkId} sample network`
      );
    }, 1000);
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
      
      // Add to uploaded files
      this.networkState.addUploadedFile(fileType, file);

      // Parse file content
      const content = await this.parseFile(file);
      
      // Process based on file type
      if (fileType === 'dag') {
        const networkData = this.parseNetworkFile(content);
        this.networkState.loadNetwork(networkData);
        
        this.uiState.showSuccess(
          'Network Loaded',
          `Successfully loaded network from ${file.name}`
        );
      } else {
        this.uiState.showInfo(
          'File Added',
          `${fileType} file added. Upload DAG file to complete network setup.`
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.networkState.setError(`Failed to process file: ${errorMessage}`);
      this.uiState.showError('File Processing Error', errorMessage);
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

  private async parseFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private parseNetworkFile(content: string): NetworkData {
    // Simple CSV parser for network data
    const lines = content.trim().split('\n');
    const edges: Array<{ id: string; source: number; target: number; probability?: number }> = [];
    const nodes = new Set<number>();

    // Skip header if present
    const startIndex = lines[0].includes('source') || lines[0].includes('from') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      
      if (parts.length >= 2) {
        const source = parseInt(parts[0]);
        const target = parseInt(parts[1]);
        const probability = parts.length > 2 ? parseFloat(parts[2]) : undefined;

        if (!isNaN(source) && !isNaN(target)) {
          edges.push({
            id: `${source}-${target}`,
            source,
            target,
            probability
          });
          
          nodes.add(source);
          nodes.add(target);
        }
      }
    }

    // Create network data structure
    const nodeArray = Array.from(nodes).map(id => ({
      id,
      label: `Node ${id}`
    }));

    // Create adjacency matrix
    const maxNode = Math.max(...nodes);
    const adjacencyMatrix = Array(maxNode + 1).fill(null).map(() => Array(maxNode + 1).fill(0));
    
    edges.forEach(edge => {
      adjacencyMatrix[edge.source][edge.target] = 1;
    });

    // Find source nodes (no incoming edges)
    const sourceNodes = nodeArray
      .filter(node => !edges.some(edge => edge.target === node.id))
      .map(node => node.id);

    return {
      nodes: nodeArray,
      edges,
      adjacencyMatrix,
      sourceNodes,
      forkNodes: [], // TODO: Implement fork detection
      joinNodes: [], // TODO: Implement join detection
      outgoingIndex: {}, // TODO: Implement indexing
      incomingIndex: {} // TODO: Implement indexing
    };
  }

  private generateSampleNetwork(networkId: string): NetworkData {
    // Generate different sample networks based on ID
    switch (networkId) {
      case 'simple':
        return {
          nodes: [
            { id: 1, label: 'Start' },
            { id: 2, label: 'Process A' },
            { id: 3, label: 'Process B' },
            { id: 4, label: 'End' }
          ],
          edges: [
            { id: '1-2', source: 1, target: 2, probability: 0.8 },
            { id: '1-3', source: 1, target: 3, probability: 0.6 },
            { id: '2-4', source: 2, target: 4, probability: 0.9 },
            { id: '3-4', source: 3, target: 4, probability: 0.7 }
          ],
          adjacencyMatrix: [
            [0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0]
          ],
          sourceNodes: [1],
          forkNodes: [1],
          joinNodes: [4],
          outgoingIndex: { 1: [2, 3], 2: [4], 3: [4] },
          incomingIndex: { 2: [1], 3: [1], 4: [2, 3] }
        };

      case 'complex':
        return {
          nodes: Array.from({ length: 8 }, (_, i) => ({
            id: i + 1,
            label: `Node ${i + 1}`
          })),
          edges: [
            { id: '1-2', source: 1, target: 2, probability: 0.8 },
            { id: '1-3', source: 1, target: 3, probability: 0.7 },
            { id: '2-4', source: 2, target: 4, probability: 0.9 },
            { id: '2-5', source: 2, target: 5, probability: 0.6 },
            { id: '3-5', source: 3, target: 5, probability: 0.8 },
            { id: '3-6', source: 3, target: 6, probability: 0.5 },
            { id: '4-7', source: 4, target: 7, probability: 0.9 },
            { id: '5-7', source: 5, target: 7, probability: 0.8 },
            { id: '6-8', source: 6, target: 8, probability: 0.7 },
            { id: '7-8', source: 7, target: 8, probability: 0.9 }
          ],
          adjacencyMatrix: Array(9).fill(null).map(() => Array(9).fill(0)),
          sourceNodes: [1],
          forkNodes: [1, 2, 3],
          joinNodes: [5, 7, 8],
          outgoingIndex: {},
          incomingIndex: {}
        };

      default:
        return this.generateSampleNetwork('simple');
    }
  }
}