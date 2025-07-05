import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { FileHandlerService, NetworkFileData, FileValidationResult } from './file-handler.service';
import { ProcessInputResponse } from '../models/api.models';

// Types and interfaces
export interface NetworkData {
  nodes: Node[];
  edges: Edge[];
  adjacencyMatrix: number[][];
  sourceNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  outgoingIndex: Record<number, number[]>;
  incomingIndex: Record<number, number[]>;
  // Additional metadata from API
  statistics?: {
    basic: {
      nodes: number;
      edges: number;
      density: number;
      maxDepth: number;
    };
    nodeTypes: Record<string, number>;
    structural: {
      isolatedNodes: number;
      highDegreeNodes: number;
      iterationSets: number;
    };
  };
}

export interface Node {
  id: number;
  label: string;
  probability?: number;
  type?: 'source' | 'fork' | 'join' | 'sink' | 'regular';
}

export interface Edge {
  id: string;
  source: number;
  target: number;
  probability?: number;
}

export interface UploadedFiles {
  dag?: File;
  nodeProbabilities?: File;
  edgeProbabilities?: File;
  adjacency?: File;
  edgelist?: File;
  nodeprobs?: File;
  edgeprobs?: File;
}

export type FileType = 'dag' | 'nodeProbabilities' | 'edgeProbabilities' | 'adjacency' | 'edgelist' | 'nodeprobs' | 'edgeprobs';

export interface NetworkProcessingResult {
  networkData: NetworkData;
  processedFiles: NetworkFileData;
  apiResponse: ProcessInputResponse;
}

/**
 * Network State Service using Angular 20 Native Signals
 * Manages all network-related state with reactive signals
 * FILE UPLOAD FUNCTIONALITY DISABLED - Test networks only
 */
@Injectable({ providedIn: 'root' })
export class NetworkStateService {
  // Inject services
  private readonly apiService = inject(ApiService);
  private readonly fileHandler = inject(FileHandlerService);

  // Private signals for internal state management
  private _networkData = signal<NetworkData | null>(null);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _uploadedFiles = signal<UploadedFiles>({});
  private _isProcessing = signal(false);
  private _lastProcessingResult = signal<NetworkProcessingResult | null>(null);
  private _fileValidationResults = signal<Record<FileType, FileValidationResult>>({} as Record<FileType, FileValidationResult>);

  // Public readonly signals - external components can only read
  readonly networkData = this._networkData.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly uploadedFiles = this._uploadedFiles.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly lastProcessingResult = this._lastProcessingResult.asReadonly();
  readonly fileValidationResults = this._fileValidationResults.asReadonly();
  
  // File handler signals (disabled)
  readonly fileProcessingProgress = this.fileHandler.processingProgress;
  readonly fileProcessingMessage = this.fileHandler.processingMessage;
  readonly isFileProcessing = this.fileHandler.isProcessing;

  // Computed signals - automatically update when dependencies change
  readonly isNetworkLoaded = computed(() => this._networkData() !== null);
  readonly nodeCount = computed(() => this._networkData()?.nodes.length ?? 0);
  readonly edgeCount = computed(() => this._networkData()?.edges.length ?? 0);
  readonly hasUploadedFiles = computed(() => Object.keys(this._uploadedFiles()).length > 0);
  readonly canAnalyze = computed(() => this.isNetworkLoaded() && !this._isLoading() && !this._error());

  constructor() {
    console.log('🚫 NetworkStateService: File upload functionality DISABLED - using test networks only');
    
    // Load any saved network data from localStorage
    this.loadFromLocalStorage();
    
    // Effect for auto-saving network data
    effect(() => {
      const data = this._networkData();
      if (data) {
        this.saveToLocalStorage(data);
      }
    });
  }

  // State management methods
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  setError(error: string | null): void {
    this._error.set(error);
  }

  setProcessing(processing: boolean): void {
    this._isProcessing.set(processing);
  }

  addUploadedFile(): void {
    console.warn('🚫 File upload functionality is DISABLED - using test networks only');
    // File upload disabled - do nothing
  }

  loadNetwork(networkData: NetworkData): void {
    this._networkData.set(networkData);
    this._error.set(null);
    console.log('Network loaded directly:', networkData);
  }

  clearNetwork(): void {
    this._networkData.set(null);
    this._uploadedFiles.set({});
    this._error.set(null);
    this._isLoading.set(false);
    this._isProcessing.set(false);
    this.clearLocalStorage();
    console.log('Network state cleared');
  }

  updateNodeProbability(nodeId: number, probability: number): void {
    this._networkData.update(data => {
      if (!data) return data;
      
      return {
        ...data,
        nodes: data.nodes.map(node => 
          node.id === nodeId 
            ? { ...node, probability }
            : node
        )
      };
    });
  }

  updateEdgeProbability(edgeId: string, probability: number): void {
    this._networkData.update(data => {
      if (!data) return data;
      
      return {
        ...data,
        edges: data.edges.map(edge => 
          edge.id === edgeId 
            ? { ...edge, probability }
            : edge
        )
      };
    });
  }

  // Utility methods
  getNodeById(nodeId: number): Node | undefined {
    const data = this._networkData();
    return data?.nodes.find(node => node.id === nodeId);
  }

  getEdgeById(edgeId: string): Edge | undefined {
    const data = this._networkData();
    return data?.edges.find(edge => edge.id === edgeId);
  }

  getConnectedNodes(nodeId: number): number[] {
    const data = this._networkData();
    if (!data) return [];
    
    return data.outgoingIndex[nodeId] || [];
  }

  // FILE UPLOAD METHODS - DISABLED
  async validateAndUploadFile(): Promise<void> {
    console.warn('🚫 File upload functionality is DISABLED - using test networks only');
    throw new Error('File upload functionality has been disabled. Please use test networks instead.');
  }

  async processUploadedFiles(): Promise<NetworkProcessingResult> {
    console.warn('🚫 File processing functionality is DISABLED - using test networks only');
    throw new Error('File processing functionality has been disabled. Please use test networks instead.');
  }

  // TEST NETWORK METHODS - ENABLED
  async loadSampleNetwork(sampleName: string): Promise<void> {
    this.setLoading(true);
    this._error.set(null);
    
    try {
      const samples = this.fileHandler.generateSampleFiles();
      const sample = samples[sampleName];
      
      if (!sample) {
        throw new Error(`Sample network '${sampleName}' not found`);
      }

      // Create a test network directly without file processing
      const testNetworkData = this.createTestNetworkData(sampleName);
      this._networkData.set(testNetworkData);
      
      console.log(`Sample network '${sampleName}' loaded successfully`);
    } catch (error) {
      this.setError(`Failed to load sample network: ${error}`);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async testBackendConnection(): Promise<boolean> {
    try {
      await firstValueFrom(this.apiService.testConnection());
      return true;
    } catch (error) {
      console.warn('Backend connection failed:', error);
      return false;
    }
  }

  getAvailableSampleNetworks(): Array<{ key: string; name: string; description: string }> {
    return [
      { key: 'simpleDag', name: 'Simple Network', description: '5 nodes, basic structure' },
      { key: 'complexDag', name: 'Complex Network', description: '9 nodes, multiple paths' },
      { key: 'diamondDag', name: 'Diamond Network', description: '8 nodes, diamond structure' },
      { key: 'gridDag', name: 'Grid Network', description: '16 nodes, grid layout' },
      { key: 'powerDistributionDag', name: 'Power Distribution Network', description: '23 nodes, power grid structure' }
    ];
  }

  // Create test network data without file processing
  private createTestNetworkData(sampleName: string): NetworkData {
    const networks = {
      simpleDag: {
        nodes: [
          { id: 1, label: 'Node 1', probability: 0.8, type: 'source' as const },
          { id: 2, label: 'Node 2', probability: 0.7, type: 'regular' as const },
          { id: 3, label: 'Node 3', probability: 0.6, type: 'regular' as const },
          { id: 4, label: 'Node 4', probability: 0.5, type: 'regular' as const },
          { id: 5, label: 'Node 5', probability: 0.9, type: 'sink' as const }
        ],
        edges: [
          { id: '1-2', source: 1, target: 2, probability: 0.8 },
          { id: '1-3', source: 1, target: 3, probability: 0.7 },
          { id: '2-4', source: 2, target: 4, probability: 0.6 },
          { id: '3-4', source: 3, target: 4, probability: 0.5 },
          { id: '4-5', source: 4, target: 5, probability: 0.9 }
        ]
      },
      complexDag: {
        nodes: Array.from({ length: 9 }, (_, i) => ({
          id: i + 1,
          label: `Node ${i + 1}`,
          probability: 0.5 + (i * 0.05),
          type: i === 0 ? 'source' as const : i === 8 ? 'sink' as const : 'regular' as const
        })),
        edges: [
          { id: '1-2', source: 1, target: 2, probability: 0.8 },
          { id: '1-3', source: 1, target: 3, probability: 0.7 },
          { id: '2-4', source: 2, target: 4, probability: 0.6 },
          { id: '2-5', source: 2, target: 5, probability: 0.5 },
          { id: '3-5', source: 3, target: 5, probability: 0.7 },
          { id: '3-6', source: 3, target: 6, probability: 0.6 },
          { id: '4-7', source: 4, target: 7, probability: 0.8 },
          { id: '5-7', source: 5, target: 7, probability: 0.7 },
          { id: '5-8', source: 5, target: 8, probability: 0.6 },
          { id: '6-8', source: 6, target: 8, probability: 0.5 },
          { id: '7-9', source: 7, target: 9, probability: 0.9 },
          { id: '8-9', source: 8, target: 9, probability: 0.8 }
        ]
      },
      diamondDag: {
        nodes: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          label: `Node ${i + 1}`,
          probability: 0.6 + (i * 0.03),
          type: i === 0 ? 'source' as const : i === 7 ? 'sink' as const : 'regular' as const
        })),
        edges: [
          { id: '1-2', source: 1, target: 2, probability: 0.8 },
          { id: '1-3', source: 1, target: 3, probability: 0.7 },
          { id: '2-4', source: 2, target: 4, probability: 0.6 },
          { id: '2-5', source: 2, target: 5, probability: 0.5 },
          { id: '3-5', source: 3, target: 5, probability: 0.7 },
          { id: '3-6', source: 3, target: 6, probability: 0.6 },
          { id: '4-7', source: 4, target: 7, probability: 0.8 },
          { id: '5-7', source: 5, target: 7, probability: 0.7 },
          { id: '6-8', source: 6, target: 8, probability: 0.9 },
          { id: '7-8', source: 7, target: 8, probability: 0.8 }
        ]
      },
      gridDag: {
        nodes: Array.from({ length: 16 }, (_, i) => ({
          id: i + 1,
          label: `Node ${i + 1}`,
          probability: 0.5 + ((i % 4) * 0.1),
          type: i === 0 ? 'source' as const : i === 15 ? 'sink' as const : 'regular' as const
        })),
        edges: [
          // Grid connections (4x4 grid)
          { id: '1-2', source: 1, target: 2, probability: 0.7 },
          { id: '1-5', source: 1, target: 5, probability: 0.6 },
          { id: '2-3', source: 2, target: 3, probability: 0.8 },
          { id: '2-6', source: 2, target: 6, probability: 0.5 },
          { id: '3-4', source: 3, target: 4, probability: 0.7 },
          { id: '3-7', source: 3, target: 7, probability: 0.6 },
          { id: '4-8', source: 4, target: 8, probability: 0.8 },
          { id: '5-6', source: 5, target: 6, probability: 0.7 },
          { id: '5-9', source: 5, target: 9, probability: 0.6 },
          { id: '6-7', source: 6, target: 7, probability: 0.8 },
          { id: '6-10', source: 6, target: 10, probability: 0.5 },
          { id: '7-8', source: 7, target: 8, probability: 0.7 },
          { id: '7-11', source: 7, target: 11, probability: 0.6 },
          { id: '8-12', source: 8, target: 12, probability: 0.8 },
          { id: '9-10', source: 9, target: 10, probability: 0.7 },
          { id: '9-13', source: 9, target: 13, probability: 0.6 },
          { id: '10-11', source: 10, target: 11, probability: 0.8 },
          { id: '10-14', source: 10, target: 14, probability: 0.5 },
          { id: '11-12', source: 11, target: 12, probability: 0.7 },
          { id: '11-15', source: 11, target: 15, probability: 0.6 },
          { id: '12-16', source: 12, target: 16, probability: 0.8 },
          { id: '13-14', source: 13, target: 14, probability: 0.7 },
          { id: '14-15', source: 14, target: 15, probability: 0.8 },
          { id: '15-16', source: 15, target: 16, probability: 0.9 }
        ]
      },
      powerDistributionDag: {
        nodes: Array.from({ length: 23 }, (_, i) => ({
          id: i + 1,
          label: `Node ${i + 1}`,
          probability: 0.8 + ((i % 3) * 0.05), // Alternating probabilities: 0.8, 0.85, 0.9
          type: i === 0 ? 'source' as const : i === 22 ? 'sink' as const : 'regular' as const
        })),
        edges: [
          // Power Distribution Network edges based on the adjacency matrix
          { id: '1-2', source: 1, target: 2, probability: 0.9 },
          { id: '2-3', source: 2, target: 3, probability: 0.85 },
          { id: '2-6', source: 2, target: 6, probability: 0.85 },
          { id: '2-10', source: 2, target: 10, probability: 0.85 },
          { id: '3-4', source: 3, target: 4, probability: 0.9 },
          { id: '4-5', source: 4, target: 5, probability: 0.85 },
          { id: '5-13', source: 5, target: 13, probability: 0.8 },
          { id: '6-5', source: 6, target: 5, probability: 0.85 },
          { id: '7-8', source: 7, target: 8, probability: 0.9 },
          { id: '8-9', source: 8, target: 9, probability: 0.85 },
          { id: '8-12', source: 8, target: 12, probability: 0.85 },
          { id: '9-10', source: 9, target: 10, probability: 0.9 },
          { id: '11-19', source: 11, target: 19, probability: 0.8 },
          { id: '12-11', source: 12, target: 11, probability: 0.85 },
          { id: '13-14', source: 13, target: 14, probability: 0.9 },
          { id: '14-21', source: 14, target: 21, probability: 0.85 },
          { id: '15-13', source: 15, target: 13, probability: 0.8 },
          { id: '16-15', source: 16, target: 15, probability: 0.85 },
          { id: '16-17', source: 16, target: 17, probability: 0.85 },
          { id: '17-14', source: 17, target: 14, probability: 0.9 },
          { id: '18-16', source: 18, target: 16, probability: 0.85 },
          { id: '19-20', source: 19, target: 20, probability: 0.9 },
          { id: '19-22', source: 19, target: 22, probability: 0.85 },
          { id: '20-21', source: 20, target: 21, probability: 0.85 },
          { id: '21-22', source: 21, target: 22, probability: 0.9 },
          { id: '22-23', source: 22, target: 23, probability: 0.85 }
        ]
      }
    };

    const selectedNetwork = networks[sampleName as keyof typeof networks] || networks.simpleDag;
    
    // Create adjacency matrix
    const nodeCount = selectedNetwork.nodes.length;
    const adjacencyMatrix = Array(nodeCount).fill(null).map(() => Array(nodeCount).fill(0));
    
    // Build indices
    const outgoingIndex: Record<number, number[]> = {};
    const incomingIndex: Record<number, number[]> = {};
    
    selectedNetwork.edges.forEach(edge => {
      const sourceIdx = edge.source - 1;
      const targetIdx = edge.target - 1;
      
      adjacencyMatrix[sourceIdx][targetIdx] = 1;
      
      if (!outgoingIndex[edge.source]) outgoingIndex[edge.source] = [];
      if (!incomingIndex[edge.target]) incomingIndex[edge.target] = [];
      
      outgoingIndex[edge.source].push(edge.target);
      incomingIndex[edge.target].push(edge.source);
    });

    // Identify node types
    const sourceNodes = selectedNetwork.nodes.filter(n => n.type === 'source').map(n => n.id);
    const forkNodes = selectedNetwork.nodes.filter(n => (outgoingIndex[n.id]?.length || 0) > 1).map(n => n.id);
    const joinNodes = selectedNetwork.nodes.filter(n => (incomingIndex[n.id]?.length || 0) > 1).map(n => n.id);

    return {
      nodes: selectedNetwork.nodes,
      edges: selectedNetwork.edges,
      adjacencyMatrix,
      sourceNodes,
      forkNodes,
      joinNodes,
      outgoingIndex,
      incomingIndex,
      statistics: {
        basic: {
          nodes: nodeCount,
          edges: selectedNetwork.edges.length,
          density: (selectedNetwork.edges.length * 2) / (nodeCount * (nodeCount - 1)),
          maxDepth: Math.ceil(Math.sqrt(nodeCount))
        },
        nodeTypes: {
          source: sourceNodes.length,
          fork: forkNodes.length,
          join: joinNodes.length,
          regular: nodeCount - sourceNodes.length - forkNodes.length - joinNodes.length
        },
        structural: {
          isolatedNodes: 0,
          highDegreeNodes: forkNodes.length + joinNodes.length,
          iterationSets: Math.ceil(nodeCount / 4)
        }
      }
    };
  }

  // Persistence methods
  private saveToLocalStorage(data: NetworkData): void {
    try {
      const serialized = JSON.stringify({
        data,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('network-analysis-data', serialized);
    } catch (error) {
      console.warn('Failed to save network data to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('network-analysis-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data && this.isValidNetworkData(parsed.data)) {
          this._networkData.set(parsed.data);
          console.log('Network data loaded from localStorage');
        }
      }
    } catch (error) {
      console.warn('Failed to load network data from localStorage:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem('network-analysis-data');
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  private isValidNetworkData(data: unknown): data is NetworkData {
    return (
      data !== null &&
      typeof data === 'object' &&
      Array.isArray((data as Record<string, unknown>)['nodes']) &&
      Array.isArray((data as Record<string, unknown>)['edges']) &&
      Array.isArray((data as Record<string, unknown>)['adjacencyMatrix'])
    );
  }
}