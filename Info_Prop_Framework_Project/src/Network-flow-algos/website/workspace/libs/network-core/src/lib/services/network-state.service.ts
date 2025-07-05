import { Injectable, signal, computed, effect } from '@angular/core';

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
}

export interface Node {
  id: number;
  label: string;
  probability?: number;
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
}

export type FileType = 'dag' | 'nodeProbabilities' | 'edgeProbabilities';

/**
 * Network State Service using Angular 20 Native Signals
 * Manages all network-related state with reactive signals
 */
@Injectable({ providedIn: 'root' })
export class NetworkStateService {
  // Private signals for internal state management
  private _networkData = signal<NetworkData | null>(null);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _uploadedFiles = signal<UploadedFiles>({});
  private _isProcessing = signal(false);

  // Public readonly signals - external components can only read
  readonly networkData = this._networkData.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly uploadedFiles = this._uploadedFiles.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();

  // Computed signals - automatically update when dependencies change
  readonly isNetworkLoaded = computed(() => this._networkData() !== null);
  readonly nodeCount = computed(() => this._networkData()?.nodes.length ?? 0);
  readonly edgeCount = computed(() => this._networkData()?.edges.length ?? 0);
  readonly hasUploadedFiles = computed(() => 
    Object.keys(this._uploadedFiles()).length > 0
  );
  readonly canAnalyze = computed(() => 
    this.isNetworkLoaded() && 
    !this.isLoading() && 
    !this.isProcessing() && 
    !this.error()
  );
  readonly networkSummary = computed(() => {
    const data = this._networkData();
    if (!data) return null;
    
    return {
      nodeCount: data.nodes.length,
      edgeCount: data.edges.length,
      sourceCount: data.sourceNodes.length,
      forkCount: data.forkNodes.length,
      joinCount: data.joinNodes.length,
      hasNodeProbabilities: data.nodes.some(n => n.probability !== undefined),
      hasEdgeProbabilities: data.edges.some(e => e.probability !== undefined)
    };
  });

  constructor() {
    // Effect for auto-saving network data to localStorage
    effect(() => {
      const data = this._networkData();
      if (data) {
        this.saveToLocalStorage(data);
      }
    });

    // Effect for error logging
    effect(() => {
      const error = this._error();
      if (error) {
        console.error('Network State Error:', error);
      }
    });

    // Effect for loading state management
    effect(() => {
      const isLoading = this._isLoading();
      const isProcessing = this._isProcessing();
      
      if (isLoading || isProcessing) {
        // Clear any existing errors when starting new operations
        this._error.set(null);
      }
    });

    // Load saved network data on initialization
    this.loadFromLocalStorage();
  }

  // State mutation methods
  loadNetwork(data: NetworkData): void {
    this._networkData.set(data);
    this._error.set(null);
    console.log('Network loaded:', {
      nodes: data.nodes.length,
      edges: data.edges.length
    });
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  setProcessing(processing: boolean): void {
    this._isProcessing.set(processing);
  }

  setError(error: string): void {
    this._error.set(error);
    this._isLoading.set(false);
    this._isProcessing.set(false);
  }

  addUploadedFile(type: FileType, file: File): void {
    this._uploadedFiles.update(files => ({
      ...files,
      [type]: file
    }));
    console.log(`File uploaded: ${type}`, file.name);
  }

  removeUploadedFile(type: FileType): void {
    this._uploadedFiles.update(files => {
      const updated = { ...files };
      delete updated[type];
      return updated;
    });
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
      Array.isArray((data as Record<string, unknown>)['adjacencyMatrix']) &&
      Array.isArray((data as Record<string, unknown>)['sourceNodes'])
    );
  }
}