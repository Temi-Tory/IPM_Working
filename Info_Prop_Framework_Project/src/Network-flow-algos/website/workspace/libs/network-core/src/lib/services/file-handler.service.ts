import { Injectable, signal, computed } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    lastModified: Date;
  };
}

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  content: string;
  rowCount: number;
  columnCount: number;
}

export interface NetworkFileData {
  dagFile?: {
    content: string;
    parsed: ParsedCsvData;
  };
  nodeProbabilities?: {
    content: string;
    parsed: Record<number, number>;
  };
  edgeProbabilities?: {
    content: string;
    parsed: Record<string, number>;
  };
}

export type SupportedFileType = 'dag' | 'nodeProbabilities' | 'edgeProbabilities';

/**
 * File Handler Service for Network Analysis Files
 * Handles file upload, validation, parsing, and processing
 */
@Injectable({ providedIn: 'root' })
export class FileHandlerService {
  // File processing state
  private _isProcessing = signal(false);
  private _processingProgress = signal(0);
  private _processingMessage = signal('');

  // Public readonly signals
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly processingProgress = this._processingProgress.asReadonly();
  readonly processingMessage = this._processingMessage.asReadonly();

  // Configuration
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly supportedExtensions = ['.csv', '.txt', '.json'];
  private readonly supportedMimeTypes = [
    'text/csv',
    'text/plain',
    'application/json',
    'application/vnd.ms-excel'
  ];

  /**
   * Validate uploaded file
   */
  validateFile(file: File, fileType: SupportedFileType): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic file validation
    if (!file) {
      errors.push('No file provided');
      return {
        isValid: false,
        errors,
        warnings,
        fileInfo: {
          name: '',
          size: 0,
          type: '',
          lastModified: new Date()
        }
      };
    }

    // File size validation
    if (file.size > this.maxFileSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // File extension validation
    const extension = this.getFileExtension(file.name);
    if (!this.supportedExtensions.includes(extension)) {
      errors.push(`Unsupported file extension: ${extension}. Supported: ${this.supportedExtensions.join(', ')}`);
    }

    // MIME type validation (if available)
    if (file.type && !this.supportedMimeTypes.includes(file.type)) {
      warnings.push(`Unexpected MIME type: ${file.type}. File will still be processed.`);
    }

    // File type specific validation
    switch (fileType) {
      case 'dag':
        if (!file.name.toLowerCase().includes('dag') && !file.name.toLowerCase().includes('network')) {
          warnings.push('DAG file name should typically contain "dag" or "network"');
        }
        break;
      case 'nodeProbabilities':
        if (!file.name.toLowerCase().includes('node') && !file.name.toLowerCase().includes('prob')) {
          warnings.push('Node probabilities file name should typically contain "node" or "prob"');
        }
        break;
      case 'edgeProbabilities':
        if (!file.name.toLowerCase().includes('edge') && !file.name.toLowerCase().includes('prob')) {
          warnings.push('Edge probabilities file name should typically contain "edge" or "prob"');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified)
      }
    };
  }

  /**
   * Read file content as text
   */
  readFileAsText(file: File): Observable<string> {
    return from(new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          resolve(content);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('File reading failed'));
      };
      
      reader.readAsText(file);
    }));
  }

  /**
   * Parse CSV file content
   */
  parseCsvFile(content: string): ParsedCsvData {
    const lines = content.trim().split('\n');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = this.parseCsvLine(lines[0]);
    
    // Parse data rows
    const rows: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) { // Skip empty lines
        rows.push(this.parseCsvLine(line));
      }
    }

    return {
      headers,
      rows,
      content,
      rowCount: rows.length,
      columnCount: headers.length
    };
  }

  /**
   * Parse DAG file (supports both adjacency matrix and edge list formats)
   */
  parseDagFile(content: string): ParsedCsvData {
    const parsed = this.parseCsvFile(content);
    
    // Check if this is an adjacency matrix (headerless, all numeric)
    if (this.isAdjacencyMatrix(content)) {
      // For adjacency matrix, we don't need header validation
      console.log('📊 Detected adjacency matrix format');
      return parsed;
    }
    
    // Otherwise, validate as edge list format
    const requiredColumns = ['source', 'target'];
    const headerLower = parsed.headers.map(h => h.toLowerCase().trim());
    
    for (const required of requiredColumns) {
      if (!headerLower.includes(required)) {
        throw new Error(`DAG file must contain '${required}' column. Found columns: ${parsed.headers.join(', ')}`);
      }
    }

    // Validate data rows
    for (let i = 0; i < Math.min(parsed.rows.length, 10); i++) { // Check first 10 rows
      const row = parsed.rows[i];
      if (row.length !== parsed.headers.length) {
        throw new Error(`Row ${i + 2} has ${row.length} columns, expected ${parsed.headers.length}`);
      }
    }

    return parsed;
  }

  /**
   * Check if content is an adjacency matrix (headerless, all numeric 0/1)
   */
  private isAdjacencyMatrix(content: string): boolean {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Check if first line contains only numbers (no text headers)
    const firstLine = lines[0].trim();
    const values = firstLine.split(',').map(v => v.trim());
    
    // All values should be numeric (0 or 1)
    for (const val of values) {
      if (!/^[01]$/.test(val)) {
        return false;
      }
    }
    
    // Check if it's square matrix
    const numCols = values.length;
    if (lines.length !== numCols) {
      return false;
    }
    
    // Validate all rows have same number of columns and are all 0/1
    for (const line of lines) {
      const rowValues = line.trim().split(',').map(v => v.trim());
      if (rowValues.length !== numCols) {
        return false;
      }
      for (const val of rowValues) {
        if (!/^[01]$/.test(val)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Parse node probabilities file (CSV or JSON)
   */
  parseNodeProbabilities(content: string, fileName: string): Record<number, number> {
    const extension = this.getFileExtension(fileName);
    
    if (extension === '.json') {
      return this.parseJsonProbabilities(content);
    } else {
      return this.parseCsvProbabilities(content, 'node');
    }
  }

  /**
   * Parse edge probabilities file (CSV or JSON)
   */
  parseEdgeProbabilities(content: string, fileName: string): Record<string, number> {
    const extension = this.getFileExtension(fileName);
    
    if (extension === '.json') {
      const jsonData = this.parseJsonProbabilities(content);
      // Convert to string keys for edges
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(jsonData)) {
        result[key] = value;
      }
      return result;
    } else {
      const numericData = this.parseCsvProbabilities(content, 'edge');
      // Convert to string keys for edges (source,target format)
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(numericData)) {
        result[key] = value;
      }
      return result;
    }
  }

  /**
   * Process multiple files and return combined network data
   */
  async processNetworkFiles(files: {
    dag?: File;
    nodeProbabilities?: File;
    edgeProbabilities?: File;
  }): Promise<NetworkFileData> {
    this._isProcessing.set(true);
    this._processingProgress.set(0);
    this._processingMessage.set('Starting file processing...');

    try {
      const result: NetworkFileData = {};
      let completedFiles = 0;
      const totalFiles = Object.keys(files).length;

      // Process DAG file
      if (files.dag) {
        this._processingMessage.set('Processing DAG file...');
        const content = await this.readFileAsText(files.dag).toPromise();
        const parsed = this.parseDagFile(content!);
        result.dagFile = { content: content!, parsed };
        completedFiles++;
        this._processingProgress.set((completedFiles / totalFiles) * 100);
      }

      // Process node probabilities
      if (files.nodeProbabilities) {
        this._processingMessage.set('Processing node probabilities...');
        const content = await this.readFileAsText(files.nodeProbabilities).toPromise();
        const parsed = this.parseNodeProbabilities(content!, files.nodeProbabilities.name);
        result.nodeProbabilities = { content: content!, parsed };
        completedFiles++;
        this._processingProgress.set((completedFiles / totalFiles) * 100);
      }

      // Process edge probabilities
      if (files.edgeProbabilities) {
        this._processingMessage.set('Processing edge probabilities...');
        const content = await this.readFileAsText(files.edgeProbabilities).toPromise();
        const parsed = this.parseEdgeProbabilities(content!, files.edgeProbabilities.name);
        result.edgeProbabilities = { content: content!, parsed };
        completedFiles++;
        this._processingProgress.set((completedFiles / totalFiles) * 100);
      }

      this._processingMessage.set('File processing complete!');
      return result;

    } catch (error) {
      this._processingMessage.set(`Processing failed: ${error}`);
      throw error;
    } finally {
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
        content: '0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0\n0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0\n0,1,0,1,0,0,1,0,0,0,0,0,0,0,0,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0\n0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0\n0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0\n0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0\n0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0\n0,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0\n0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1\n0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n'
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

  private parseJsonProbabilities(content: string): Record<number, number> {
    try {
      const data = JSON.parse(content);
      const result: Record<number, number> = {};
      
      for (const [key, value] of Object.entries(data)) {
        const numKey = parseInt(key);
        const numValue = parseFloat(value as string);
        
        if (isNaN(numKey) || isNaN(numValue)) {
          throw new Error(`Invalid probability data: ${key} => ${value}`);
        }
        
        result[numKey] = numValue;
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to parse JSON probabilities: ${error}`);
    }
  }

  private parseCsvProbabilities(content: string, type: 'node' | 'edge'): Record<number, number> {
    const parsed = this.parseCsvFile(content);
    const result: Record<number, number> = {};
    
    if (type === 'node') {
      // Expected format: node,probability
      const nodeIndex = parsed.headers.findIndex(h => h.toLowerCase().includes('node'));
      const probIndex = parsed.headers.findIndex(h => h.toLowerCase().includes('prob'));
      
      if (nodeIndex === -1 || probIndex === -1) {
        throw new Error('Node probabilities CSV must contain "node" and "probability" columns');
      }
      
      for (const row of parsed.rows) {
        const nodeId = parseInt(row[nodeIndex]);
        const probability = parseFloat(row[probIndex]);
        
        if (isNaN(nodeId) || isNaN(probability)) {
          throw new Error(`Invalid node probability data: ${row[nodeIndex]} => ${row[probIndex]}`);
        }
        
        result[nodeId] = probability;
      }
    } else {
      // Expected format: source,target,probability
      const sourceIndex = parsed.headers.findIndex(h => h.toLowerCase().includes('source'));
      const targetIndex = parsed.headers.findIndex(h => h.toLowerCase().includes('target'));
      const probIndex = parsed.headers.findIndex(h => h.toLowerCase().includes('prob'));
      
      if (sourceIndex === -1 || targetIndex === -1 || probIndex === -1) {
        throw new Error('Edge probabilities CSV must contain "source", "target", and "probability" columns');
      }
      
      for (const row of parsed.rows) {
        const source = parseInt(row[sourceIndex]);
        const target = parseInt(row[targetIndex]);
        const probability = parseFloat(row[probIndex]);
        
        if (isNaN(source) || isNaN(target) || isNaN(probability)) {
          throw new Error(`Invalid edge probability data: ${row[sourceIndex]},${row[targetIndex]} => ${row[probIndex]}`);
        }
        
        // Use numeric key for internal processing
        const edgeKey = source * 10000 + target; // Simple encoding for numeric key
        result[edgeKey] = probability;
      }
    }
    
    return result;
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.substring(lastDot).toLowerCase();
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}