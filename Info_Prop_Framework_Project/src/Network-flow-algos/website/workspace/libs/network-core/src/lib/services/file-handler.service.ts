/**
 * FileHandlerService
 * 
 * Handles file upload, validation, and processing for network analysis.
 * Supports CSV adjacency matrices, edge lists, and JSON probability files.
 */

import { Injectable, signal, computed, effect } from '@angular/core';
// RxJS imports removed as they're not currently used

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileType?: 'adjacency' | 'edgelist' | 'nodeprobs' | 'edgeprobs' | 'unknown';
  metadata?: {
    nodes?: number;
    edges?: number;
    format?: string;
  };
}

export interface ProcessedFile {
  name: string;
  type: 'adjacency' | 'edgelist' | 'nodeprobs' | 'edgeprobs' | 'dag' | 'nodeProbabilities' | 'edgeProbabilities';
  content: string;
  validation: FileValidationResult;
  size: number;
  lastModified: number;
  parsed?: Record<string, unknown>;
}

export interface NetworkFiles {
  adjacency?: ProcessedFile;
  edgelist?: ProcessedFile;
  nodeProbs?: ProcessedFile;
  edgeProbs?: ProcessedFile;
}

export type SupportedFileType = 'adjacency' | 'edgelist' | 'nodeprobs' | 'edgeprobs' | 'dag' | 'nodeProbabilities' | 'edgeProbabilities';

export interface NetworkFileData {
  dagFile?: ProcessedFile;
  nodeProbs?: ProcessedFile;
  edgeProbs?: ProcessedFile;
  nodeProbabilities?: ProcessedFile;
  edgeProbabilities?: ProcessedFile;
}

@Injectable({
  providedIn: 'root'
})
export class FileHandlerService {
  // Reactive state using signals
  private _uploadedFiles = signal<ProcessedFile[]>([]);
  private _isProcessing = signal<boolean>(false);
  private _processingProgress = signal<number>(0);
  private _processingMessage = signal<string>('');
  private _validationErrors = signal<string[]>([]);

  // Computed signals
  readonly uploadedFiles = this._uploadedFiles.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly processingProgress = this._processingProgress.asReadonly();
  readonly processingMessage = this._processingMessage.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();

  readonly hasValidFiles = computed(() => 
    this._uploadedFiles().some(file => file.validation.isValid)
  );

  readonly networkFiles = computed((): NetworkFiles => {
    const files = this._uploadedFiles();
    return {
      adjacency: files.find(f => f.type === 'adjacency'),
      edgelist: files.find(f => f.type === 'edgelist'),
      nodeProbs: files.find(f => f.type === 'nodeprobs'),
      edgeProbs: files.find(f => f.type === 'edgeprobs')
    };
  });

  constructor() {
    // File upload functionality DISABLED
    console.log('🚫 FileHandlerService: File upload functionality is DISABLED - using test networks only');
    
    // Effect for validation error logging (disabled)
    effect(() => {
      const errors = this._validationErrors();
      if (errors.length > 0) {
        console.warn('🚫 File validation errors (DISABLED):', errors);
      }
    });
  }

  /**
   * Upload and process files - DISABLED
   */
  async uploadFiles(): Promise<ProcessedFile[]> {
    console.warn('🚫 File upload functionality is DISABLED - using test networks only');
    this._validationErrors.set(['File upload functionality has been disabled. Please use test networks instead.']);
    throw new Error('File upload functionality has been disabled. Please use test networks instead.');
  }

  /**
   * Process a single file
   */
  private async processFile(file: File): Promise<ProcessedFile> {
    const content = await this.readFileAsText(file);
    const fileType = this.detectFileType(file.name, content);
    const validation = this.validateFile(content, fileType);

    return {
      name: file.name,
      type: fileType,
      content,
      validation,
      size: file.size,
      lastModified: file.lastModified
    };
  }

  /**
   * Read file as text with proper encoding handling
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };
      
      // Read as text with UTF-8 encoding
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Detect file type based on name and content
   */
  private detectFileType(fileName: string, content: string): ProcessedFile['type'] {
    const lowerName = fileName.toLowerCase();
    
    // Check file extension and name patterns
    if (lowerName.includes('adjacency') || lowerName.includes('matrix')) {
      return 'adjacency';
    }
    
    if (lowerName.includes('edge') && (lowerName.endsWith('.csv') || lowerName.endsWith('.txt'))) {
      return 'edgelist';
    }
    
    if (lowerName.includes('node') && lowerName.includes('prob')) {
      return 'nodeprobs';
    }
    
    if (lowerName.includes('edge') && lowerName.includes('prob')) {
      return 'edgeprobs';
    }

    // Analyze content structure
    const lines = content.trim().split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      
      // Check for edge list format
      if (firstLine.toLowerCase().includes('source') && firstLine.toLowerCase().includes('destination')) {
        return 'edgelist';
      }
      
      // Check for node probabilities format
      if (firstLine.toLowerCase().includes('node') && firstLine.toLowerCase().includes('probability')) {
        return 'nodeprobs';
      }
      
      // Check for edge probabilities format
      if (firstLine.toLowerCase().includes('source') && firstLine.toLowerCase().includes('target') && firstLine.toLowerCase().includes('probability')) {
        return 'edgeprobs';
      }
      
      // Check for adjacency matrix (square matrix of numbers)
      const values = firstLine.split(',');
      if (values.length > 1 && values.every(v => /^[0-1]$/.test(v.trim()))) {
        console.log('📊 Detected adjacency matrix format');
        return 'adjacency';
      }
    }
    
    // Default to adjacency if CSV
    if (lowerName.endsWith('.csv')) {
      return 'adjacency';
    }
    
    return 'adjacency'; // Default fallback
  }

  /**
   * Validate file content based on type
   */
  validateFile(content: string, type: ProcessedFile['type']): FileValidationResult {
    switch (type) {
      case 'adjacency':
      case 'dag':
        return this.validateAdjacencyMatrix(content);
      case 'edgelist':
        return this.validateEdgeList(content);
      case 'nodeprobs':
      case 'nodeProbabilities':
        return this.validateNodeProbabilities();
      case 'edgeprobs':
      case 'edgeProbabilities':
        return this.validateEdgeProbabilities();
      default:
        return {
          isValid: false,
          errors: ['Unknown file type'],
          warnings: []
        };
    }
  }

  /**
   * Validate adjacency matrix format
   */
  private validateAdjacencyMatrix(content: string): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        errors.push('File is empty');
        return { isValid: false, errors, warnings };
      }

      const numRows = lines.length;
      let numCols = 0;
      
      // Parse and validate each row
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const values = line.split(',').map(v => v.trim());
        
        if (i === 0) {
          numCols = values.length;
        } else if (values.length !== numCols) {
          errors.push(`Row ${i + 1} has ${values.length} columns, expected ${numCols}`);
          continue;
        }
        
        // Validate values are 0 or 1
        for (let j = 0; j < values.length; j++) {
          const value = values[j];
          if (!/^[0-1]$/.test(value)) {
            errors.push(`Invalid value "${value}" at row ${i + 1}, column ${j + 1}. Expected 0 or 1.`);
          }
        }
      }
      
      // Check if matrix is square
      if (numRows !== numCols) {
        errors.push(`Matrix is not square: ${numRows} rows × ${numCols} columns`);
      }
      
      // Check minimum size
      if (numRows < 2) {
        errors.push('Matrix must have at least 2 nodes');
      }
      
      // Performance warning for large matrices
      if (numRows > 100) {
        warnings.push(`Large matrix detected (${numRows}×${numCols}). Processing may be slow.`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fileType: 'adjacency',
        metadata: {
          nodes: numRows,
          edges: this.countEdgesInMatrix(content),
          format: 'adjacency_matrix'
        }
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to parse adjacency matrix: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Validate edge list format
   */
  private validateEdgeList(content: string): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        errors.push('File is empty');
        return { isValid: false, errors, warnings };
      }

      // Check for header
      const hasHeader = lines[0].toLowerCase().includes('source') || lines[0].toLowerCase().includes('destination');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      
      if (dataLines.length === 0) {
        errors.push('No data rows found');
        return { isValid: false, errors, warnings };
      }

      const nodes = new Set<number>();
      let edgeCount = 0;

      // Validate each edge
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length !== 2) {
          errors.push(`Row ${i + (hasHeader ? 2 : 1)}: Expected 2 columns (source,destination), found ${parts.length}`);
          continue;
        }
        
        const [sourceStr, destStr] = parts;
        
        // Validate node IDs are integers
        const source = parseInt(sourceStr);
        const dest = parseInt(destStr);
        
        if (isNaN(source) || isNaN(dest)) {
          errors.push(`Row ${i + (hasHeader ? 2 : 1)}: Invalid node IDs "${sourceStr}", "${destStr}"`);
          continue;
        }
        
        if (source <= 0 || dest <= 0) {
          errors.push(`Row ${i + (hasHeader ? 2 : 1)}: Node IDs must be positive integers`);
          continue;
        }
        
        if (source === dest) {
          errors.push(`Row ${i + (hasHeader ? 2 : 1)}: Self-loops not allowed (${source} -> ${dest})`);
          continue;
        }
        
        nodes.add(source);
        nodes.add(dest);
        edgeCount++;
      }

      if (nodes.size < 2) {
        errors.push('Network must have at least 2 nodes');
      }

      if (edgeCount === 0) {
        errors.push('No valid edges found');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fileType: 'edgelist',
        metadata: {
          nodes: nodes.size,
          edges: edgeCount,
          format: 'edge_list'
        }
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to parse edge list: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Validate node probabilities format
   */
  private validateNodeProbabilities(): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Implementation for node probabilities validation
    // This would validate CSV format with node,probability columns
    
    return {
      isValid: true, // Simplified for now
      errors,
      warnings,
      fileType: 'nodeprobs'
    };
  }

  /**
   * Validate edge probabilities format
   */
  private validateEdgeProbabilities(): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Implementation for edge probabilities validation
    // This would validate CSV format with source,target,probability columns
    
    return {
      isValid: true, // Simplified for now
      errors,
      warnings,
      fileType: 'edgeprobs'
    };
  }

  /**
   * Count edges in adjacency matrix
   */
  private countEdgesInMatrix(content: string): number {
    try {
      const lines = content.trim().split('\n');
      let edgeCount = 0;
      
      for (const line of lines) {
        const values = line.split(',').map(v => v.trim());
        edgeCount += values.filter(v => v === '1').length;
      }
      
      return edgeCount;
    } catch {
      return 0;
    }
  }

  /**
   * Convert adjacency matrix to edge list format
   */
  convertAdjacencyToEdgeList(content: string): { edges: Array<{source: number, destination: number}>, nodeCount: number } {
    const lines = content.trim().split('\n');
    const edges: Array<{source: number, destination: number}> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      for (let j = 0; j < values.length; j++) {
        if (values[j] === '1') {
          edges.push({
            source: i + 1, // Convert to 1-based indexing
            destination: j + 1
          });
        }
      }
    }
    
    return {
      edges,
      nodeCount: lines.length
    };
  }

  /**
   * Process network files and prepare for Julia backend
   */
  async processNetworkFiles(files: NetworkFiles): Promise<{
    edges: Array<{source: number, destination: number}>,
    nodePriors: Record<string, number>,
    edgeProbabilities: Record<string, number>
  }> {
    let edges: Array<{source: number, destination: number}> = [];
    let nodeCount = 0;

    // Process adjacency matrix or edge list
    if (files.adjacency) {
      const result = this.convertAdjacencyToEdgeList(files.adjacency.content);
      edges = result.edges;
      nodeCount = result.nodeCount;
    } else if (files.edgelist) {
      // Parse edge list
      const lines = files.edgelist.content.trim().split('\n');
      const hasHeader = lines[0].toLowerCase().includes('source');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      
      const nodeSet = new Set<number>();
      edges = dataLines.map(line => {
        const [source, dest] = line.split(',').map(s => parseInt(s.trim()));
        nodeSet.add(source);
        nodeSet.add(dest);
        return { source, destination: dest };
      });
      nodeCount = nodeSet.size;
    }

    // Generate default probabilities if not provided
    const nodePriors = this.generateDefaultNodePriors(nodeCount);
    const edgeProbabilities = this.generateDefaultEdgeProbabilities(edges);

    return {
      edges,
      nodePriors,
      edgeProbabilities
    };
  }

  /**
   * Generate default node priors
   */
  private generateDefaultNodePriors(nodeCount: number): Record<string, number> {
    const nodes: Record<string, number> = {};
    for (let i = 1; i <= nodeCount; i++) {
      nodes[i.toString()] = 0.5; // Default 50% probability
    }
    
    return nodes;
  }

  /**
   * Generate default edge probabilities
   */
  private generateDefaultEdgeProbabilities(edges: Array<{source: number, destination: number}>): Record<string, number> {
    const links: Record<string, number> = {};
    
    edges.forEach(edge => {
      const key = `(${edge.source},${edge.destination})`;
      links[key] = 0.8; // Default 80% probability
    });
    
    return links;
  }

  /**
   * Clear uploaded files
   */
  clearFiles(): void {
    this._uploadedFiles.set([]);
    this._validationErrors.set([]);
  }

  /**
   * Remove specific file
   */
  removeFile(fileName: string): void {
    this._uploadedFiles.update(files => files.filter(f => f.name !== fileName));
  }

  /**
   * Get file by name
   */
  getFile(fileName: string): ProcessedFile | undefined {
    return this._uploadedFiles().find(f => f.name === fileName);
  }

  /**
   * Update processing state
   */
  private updateProcessingState(isProcessing: boolean, progress = 0, message = ''): void {
    this._isProcessing.set(isProcessing);
    this._processingProgress.set(progress);
    this._processingMessage.set(message);
    
    if (!isProcessing) {
      // Clear processing state after completion
      setTimeout(() => {
        this._isProcessing.set(false);
        this._processingProgress.set(0);
        this._processingMessage.set('');
      }, 1000); // Show completion message briefly
    }
  }

  /**
   * Generate sample network files for testing
   */
  generateSampleFiles(): { [key: string]: { name: string; content: string } } {
    return {
      simpleDag: {
        name: 'simple_dag.csv',
        content: '0,1,1,0,0\n0,0,0,1,0\n0,0,0,1,0\n0,0,0,0,1\n0,0,0,0,0\n'
      },
      complexDag: {
        name: 'complex_dag.csv',
        content: '0,1,1,0,0,0,0,0,0\n0,0,0,1,1,0,0,0,0\n0,0,0,0,1,1,0,0,0\n0,0,0,0,0,0,1,0,0\n0,0,0,0,0,0,1,1,0\n0,0,0,0,0,0,0,1,0\n0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,0\n'
      },
      diamondDag: {
        name: 'diamond_dag.csv',
        content: '0,1,1,0,0,0,0,0\n0,0,0,1,0,0,0,0\n0,0,0,1,0,0,0,0\n0,0,0,0,1,1,0,0\n0,0,0,0,0,0,1,0\n0,0,0,0,0,0,1,0\n0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0\n'
      },
      gridDag: {
        name: 'grid_dag.csv',
        content: '0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0\n0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0\n0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0\n0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0\n0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0\n0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0\n0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0\n0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0\n0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0\n0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0\n0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n'
      },
      nodeProbs: {
        name: 'node_probabilities.csv',
        content: 'node,probability\n1,0.9\n2,0.8\n3,0.7\n4,0.85\n5,0.75\n'
      },
      edgeProbs: {
        name: 'edge_probabilities.csv',
        content: 'source,target,probability\n1,2,0.9\n1,3,0.8\n2,4,0.85\n3,4,0.9\n4,5,0.95\n'
      }
    };
  }

  // Private helper methods
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private isNumeric(value: string): boolean {
    return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  }

  private isBinary(value: string): boolean {
    return value === '0' || value === '1';
  }
}