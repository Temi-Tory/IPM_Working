import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, retry, catchError, timeout } from 'rxjs';

// API Request/Response Interfaces
export interface ProcessInputRequest {
  csvContent: string;
}

export interface ProcessInputResponse {
  success: boolean;
  data: {
    networkData: {
      edgelist: number[][];
      outgoingIndex: Record<string, number[]>;
      incomingIndex: Record<string, number[]>;
      sourceNodes: number[];
      nodePriors: Record<string, number>;
      edgeProbabilities: Record<string, number>;
      forkNodes: number[];
      joinNodes: number[];
      iterationSets: number[][];
      ancestors: Record<string, number[]>;
      descendants: Record<string, number[]>;
      nodeCount: number;
      edgeCount: number;
      graphDensity: number;
      maxIterationDepth: number;
    };
    statistics: {
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
      connectivity: {
        stronglyConnectedComponents: number;
        avgPathLength: number;
        hasIsolatedNodes: boolean;
      };
    };
    summary: {
      analysisType: string;
      nodes: number;
      edges: number;
      sources: number;
      sinks: number;
      forks: number;
      joins: number;
      density: number;
      maxDepth: number;
      processingTime: string;
    };
  };
  message?: string;
  error?: string;
}

export interface ReachabilityRequest {
  csvContent: string;
  nodePrior?: number;
  edgeProb?: number;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  useIndividualOverrides?: boolean;
  individualNodePriors?: Record<string, number>;
  individualEdgeProbabilities?: Record<string, number>;
}

export interface ReachabilityResponse {
  success: boolean;
  data: {
    results: Array<{ node: number; probability: number }>;
    networkData: any;
    originalParameters: {
      nodePriors: Record<string, number>;
      edgeProbabilities: Record<string, number>;
    };
    parameterModifications: {
      appliedNodeOverrides: Record<string, number>;
      appliedEdgeOverrides: Record<string, number>;
      globalModifications: {
        nodeOverride: boolean;
        edgeOverride: boolean;
      };
    };
    resultStatistics: {
      totalNodes: number;
      probabilityDistribution: Record<string, number>;
      nodeTypeAnalysis: any;
      reachabilityMetrics: {
        overallMean: number;
        overallMin: number;
        overallMax: number;
        standardDeviation: number;
        highReachabilityNodes: number;
        lowReachabilityNodes: number;
        perfectReachabilityNodes: number;
        unreachableNodes: number;
      };
      insights: string[];
    };
    summary: {
      analysisType: string;
      nodes: number;
      edges: number;
      diamonds: number;
      resultsGenerated: number;
      parametersModified: boolean;
      maxIterationDepth: number;
      processingTime: string;
    };
  };
  message?: string;
  error?: string;
}

export interface DiamondProcessingRequest {
  csvContent: string;
}

export interface DiamondProcessingResponse {
  success: boolean;
  data: {
    diamondStructures: Array<{
      id: string;
      nodes: number[];
      edges: Array<{ source: number; target: number }>;
      type: string;
      size: number;
      depth: number;
    }>;
    statistics: {
      totalDiamonds: number;
      averageSize: number;
      maxDepth: number;
      typeDistribution: Record<string, number>;
    };
    summary: {
      analysisType: string;
      diamonds: number;
      avgSize: number;
      maxDepth: number;
      processingTime: string;
    };
  };
  message?: string;
  error?: string;
}

export interface MonteCarloRequest {
  csvContent: string;
  iterations?: number;
  nodePrior?: number;
  edgeProb?: number;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  useIndividualOverrides?: boolean;
  individualNodePriors?: Record<string, number>;
  individualEdgeProbabilities?: Record<string, number>;
}

export interface MonteCarloResponse {
  success: boolean;
  data: {
    results: Array<{ node: number; probability: number; confidence: number }>;
    simulationMetrics: {
      iterations: number;
      convergence: boolean;
      executionTime: number;
    };
    summary: {
      analysisType: string;
      iterations: number;
      nodes: number;
      converged: boolean;
      processingTime: string;
    };
  };
  message?: string;
  error?: string;
}

/**
 * API Service for Julia Backend Integration
 * Handles all HTTP communication with the Information Propagation Analysis backend
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  
  // Configuration
  private readonly baseUrl = 'http://localhost:9090'; // Julia server default port
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;

  /**
   * Process network input - converts CSV to network structure
   */
  processInput(request: ProcessInputRequest): Observable<ProcessInputResponse> {
    return this.http.post<ProcessInputResponse>(`${this.baseUrl}/api/processinput`, request)
      .pipe(
        timeout(this.defaultTimeout),
        retry(this.maxRetries),
        catchError(this.handleError<ProcessInputResponse>('processInput'))
      );
  }

  /**
   * Run reachability analysis with optional parameter overrides
   */
  runReachabilityAnalysis(request: ReachabilityRequest): Observable<ReachabilityResponse> {
    return this.http.post<ReachabilityResponse>(`${this.baseUrl}/api/reachabilitymodule`, request)
      .pipe(
        timeout(60000), // Longer timeout for analysis
        retry(2), // Fewer retries for analysis
        catchError(this.handleError<ReachabilityResponse>('runReachabilityAnalysis'))
      );
  }

  /**
   * Process diamond structures in the network
   */
  processDiamonds(request: DiamondProcessingRequest): Observable<DiamondProcessingResponse> {
    return this.http.post<DiamondProcessingResponse>(`${this.baseUrl}/api/diamondprocessing`, request)
      .pipe(
        timeout(this.defaultTimeout),
        retry(this.maxRetries),
        catchError(this.handleError<DiamondProcessingResponse>('processDiamonds'))
      );
  }

  /**
   * Run Monte Carlo simulation analysis
   */
  runMonteCarloAnalysis(request: MonteCarloRequest): Observable<MonteCarloResponse> {
    return this.http.post<MonteCarloResponse>(`${this.baseUrl}/api/montecarlo`, request)
      .pipe(
        timeout(120000), // 2 minutes for Monte Carlo
        retry(1), // Single retry for long-running analysis
        catchError(this.handleError<MonteCarloResponse>('runMonteCarloAnalysis'))
      );
  }

  /**
   * Test server connectivity
   */
  testConnection(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(`${this.baseUrl}/`)
      .pipe(
        timeout(5000), // Short timeout for health check
        catchError(this.handleError<{ status: string; timestamp: string }>('testConnection'))
      );
  }

  /**
   * Generic error handler for API calls
   */
  private handleError<T>(operation = 'operation') {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`${operation} failed:`, error);

      let errorMessage = 'An unexpected error occurred';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
      } else {
        // Server-side error
        switch (error.status) {
          case 0:
            errorMessage = 'Unable to connect to server. Please check if the Julia backend is running.';
            break;
          case 400:
            errorMessage = 'Invalid request data. Please check your input.';
            break;
          case 404:
            errorMessage = 'API endpoint not found. Please check server configuration.';
            break;
          case 500:
            errorMessage = 'Server error occurred during processing.';
            break;
          case 503:
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = `Server returned error ${error.status}: ${error.message}`;
        }
      }

      // Return error response in expected format
      const errorResponse = {
        success: false,
        error: errorMessage,
        data: null
      } as T;

      return throwError(() => errorResponse);
    };
  }

  /**
   * Get server configuration and status
   */
  getServerInfo(): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/info`)
      .pipe(
        timeout(5000),
        catchError(this.handleError('getServerInfo'))
      );
  }

  /**
   * Validate CSV content before processing
   */
  validateCsvContent(csvContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!csvContent || csvContent.trim().length === 0) {
      errors.push('CSV content is empty');
      return { isValid: false, errors };
    }

    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      errors.push('CSV must contain at least 2 lines (header + data)');
      return { isValid: false, errors };
    }

    // Basic CSV structure validation
    const headerLine = lines[0];
    if (!headerLine.includes(',')) {
      errors.push('CSV header must contain comma-separated values');
    }

    // Check for consistent column count
    const expectedColumns = headerLine.split(',').length;
    for (let i = 1; i < Math.min(lines.length, 10); i++) { // Check first 10 data lines
      const columns = lines[i].split(',').length;
      if (columns !== expectedColumns) {
        errors.push(`Inconsistent column count at line ${i + 1}`);
        break;
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}