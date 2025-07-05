import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, ProcessInputRequest, ProcessInputResponse } from './api.service';
import { FileHandlerService, NetworkFileData, FileValidationResult, SupportedFileType } from './file-handler.service';

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
}

export type FileType = 'dag' | 'nodeProbabilities' | 'edgeProbabilities';

export interface NetworkProcessingResult {
  networkData: NetworkData;
  processedFiles: NetworkFileData;
  apiResponse: ProcessInputResponse;
}

/**
 * Network State Service using Angular 20 Native Signals
 * Manages all network-related state with reactive signals
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
  
  // File handler signals
  readonly fileProcessingProgress = this.fileHandler.processingProgress;
  readonly fileProcessingMessage = this.fileHandler.processingMessage;
  readonly isFileProcessing = this.fileHandler.isProcessing;

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

  // ===== NEW API INTEGRATION METHODS =====

  /**
   * Validate and upload a file
   */
  async validateAndUploadFile(file: File, fileType: SupportedFileType): Promise<void> {
    try {
      // Validate file
      const validation = this.fileHandler.validateFile(file, fileType);
      
      // Update validation results
      this._fileValidationResults.update(results => ({
        ...results,
        [fileType]: validation
      }));

      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`File warnings for ${fileType}:`, validation.warnings);
      }

      // Add to uploaded files
      this.addUploadedFile(fileType, file);
      
      console.log(`File ${fileType} validated and uploaded successfully`);
    } catch (error) {
      this.setError(`File upload failed: ${error}`);
      throw error;
    }
  }

  /**
   * Process uploaded files and send to Julia backend
   */
  async processUploadedFiles(): Promise<NetworkProcessingResult> {
    const files = this._uploadedFiles();
    
    if (!files.dag) {
      throw new Error('DAG file is required for processing');
    }

    this.setProcessing(true);
    this._error.set(null);

    try {
      // Process files using file handler
      const processedFiles = await this.fileHandler.processNetworkFiles(files);
      
      if (!processedFiles.dagFile) {
        throw new Error('Failed to process DAG file');
      }

      // Prepare API request
      const apiRequest: ProcessInputRequest = {
        csvContent: processedFiles.dagFile.content
      };

      // Validate CSV content
      const csvValidation = this.apiService.validateCsvContent(apiRequest.csvContent);
      if (!csvValidation.isValid) {
        throw new Error(`Invalid CSV content: ${csvValidation.errors.join(', ')}`);
      }

      // Send to Julia backend
      const apiResponse = await firstValueFrom(this.apiService.processInput(apiRequest));

      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'API processing failed');
      }

      // Convert API response to NetworkData
      const networkData = this.convertApiResponseToNetworkData(apiResponse, processedFiles);
      
      // Update state
      this._networkData.set(networkData);
      
      const result: NetworkProcessingResult = {
        networkData,
        processedFiles,
        apiResponse
      };
      
      this._lastProcessingResult.set(result);
      
      console.log('Network processing completed successfully:', {
        nodes: networkData.nodes.length,
        edges: networkData.edges.length
      });

      return result;

    } catch (error) {
      const errorMessage = `Network processing failed: ${error}`;
      this.setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * Load a sample network for testing
   */
  async loadSampleNetwork(sampleName: string): Promise<void> {
    this.setLoading(true);
    this._error.set(null);

    try {
      const samples = this.fileHandler.generateSampleFiles();
      const sample = samples[sampleName];
      
      if (!sample) {
        throw new Error(`Sample network '${sampleName}' not found`);
      }

      // Create a File object from sample content
      const blob = new Blob([sample.content], { type: 'text/csv' });
      const file = new File([blob], sample.name, { type: 'text/csv' });

      // Process as DAG file
      await this.validateAndUploadFile(file, 'dag');
      await this.processUploadedFiles();

      console.log(`Sample network '${sampleName}' loaded successfully`);
    } catch (error) {
      this.setError(`Failed to load sample network: ${error}`);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Test connection to Julia backend
   */
  async testBackendConnection(): Promise<boolean> {
    try {
      await firstValueFrom(this.apiService.testConnection());
      return true;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }

  /**
   * Get available sample networks
   */
  getAvailableSampleNetworks(): Array<{ key: string; name: string; description: string }> {
    return [
      {
        key: 'simpleDag',
        name: 'Simple DAG',
        description: 'A basic 5-node directed acyclic graph for testing'
      },
      {
        key: 'complexDag',
        name: 'Complex DAG',
        description: 'A more complex 9-node network with multiple paths'
      },
      {
        key: 'diamondDag',
        name: 'Diamond DAG',
        description: 'A network containing diamond structures for advanced analysis'
      }
    ];
  }

  /**
   * Convert API response to internal NetworkData format
   */
  private convertApiResponseToNetworkData(
    apiResponse: ProcessInputResponse,
    processedFiles: NetworkFileData
  ): NetworkData {
    const apiData = apiResponse.data.networkData;
    
    // Convert edges from API format to internal format
    const edges: Edge[] = apiData.edgelist.map(([source, target], index) => ({
      id: `${source}-${target}`,
      source,
      target,
      probability: apiData.edgeProbabilities[`${source},${target}`] ||
                   apiData.edgeProbabilities[`(${source},${target})`] ||
                   undefined
    }));

    // Convert nodes from API format to internal format
    const allNodeIds = new Set<number>();
    apiData.edgelist.forEach(([source, target]) => {
      allNodeIds.add(source);
      allNodeIds.add(target);
    });

    const nodes: Node[] = Array.from(allNodeIds).map(id => {
      let type: Node['type'] = 'regular';
      
      if (apiData.sourceNodes.includes(id)) type = 'source';
      else if (apiData.forkNodes.includes(id)) type = 'fork';
      else if (apiData.joinNodes.includes(id)) type = 'join';
      // Note: sink nodes would need to be calculated from the graph structure
      
      return {
        id,
        label: `Node ${id}`,
        probability: apiData.nodePriors[id.toString()] || apiData.nodePriors[id] || undefined,
        type
      };
    });

    // Convert indices from string keys to number keys
    const outgoingIndex: Record<number, number[]> = {};
    const incomingIndex: Record<number, number[]> = {};
    
    Object.entries(apiData.outgoingIndex).forEach(([key, value]) => {
      outgoingIndex[parseInt(key)] = value;
    });
    
    Object.entries(apiData.incomingIndex).forEach(([key, value]) => {
      incomingIndex[parseInt(key)] = value;
    });

    // Create adjacency matrix
    const maxNode = Math.max(...Array.from(allNodeIds));
    const adjacencyMatrix: number[][] = Array(maxNode + 1).fill(null).map(() => Array(maxNode + 1).fill(0));
    
    apiData.edgelist.forEach(([source, target]) => {
      adjacencyMatrix[source][target] = 1;
    });

    return {
      nodes,
      edges,
      adjacencyMatrix,
      sourceNodes: apiData.sourceNodes,
      forkNodes: apiData.forkNodes,
      joinNodes: apiData.joinNodes,
      outgoingIndex,
      incomingIndex,
      statistics: apiResponse.data.statistics
    };
  }
}