import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, retry, catchError, timeout } from 'rxjs';

// Import the new API interfaces
import {
  ProcessInputRequest,
  ProcessInputResponse,
  ReachabilityRequest,
  ReachabilityResponse,
  DiamondProcessingRequest,
  DiamondProcessingResponse,
  MonteCarloRequest,
  MonteCarloResponse
} from '../models/api.models';

// Import diamond models for new endpoints
import {
  DiamondStructure,
  DiamondDetectionResult,
  DiamondAnalysisConfig,
  DiamondAnalysisProgress,
  DiamondClassification as DiamondClassificationModel
} from '../models/diamond.models';

import { NetworkJsonInput } from '../models/network.models';

// ===== NEW DIAMOND DETECTION API INTERFACES =====

/**
 * Diamond Detection Request
 */
export interface DiamondDetectionRequest {
  // Input data
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  networkData?: NetworkJsonInput; // For processed network data
  
  // Detection configuration
  config?: DiamondAnalysisConfig;
  
  // Processing options
  options?: {
    includeProgress?: boolean;
    validateInput?: boolean;
    timeout?: number;
  };
}

/**
 * Diamond Detection Response
 */
export interface DiamondDetectionResponse {
  success: boolean;
  data?: DiamondDetectionResult;
  error?: string;
  message?: string;
  timestamp?: string;
  processingTime?: string;
}

/**
 * Diamond Classification Request (for classify endpoint)
 */
export interface DiamondClassifyRequest {
  // Input diamonds to classify
  diamonds: DiamondStructure[];
  
  // Classification configuration
  config?: DiamondAnalysisConfig;
  
  // Processing options
  options?: {
    includeProgress?: boolean;
    confidenceThreshold?: number;
    timeout?: number;
  };
}

/**
 * Diamond Classification Response (for classify endpoint)
 */
export interface DiamondClassifyResponse {
  success: boolean;
  data?: {
    classifications: DiamondClassificationModel[];
    summary: {
      totalDiamonds: number;
      classifiedCount: number;
      averageConfidence: number;
      typeDistribution: Record<string, number>;
      processingTime: string;
    };
  };
  error?: string;
  message?: string;
  timestamp?: string;
  processingTime?: string;
}

/**
 * Multi-Level Diamond Analysis Request
 */
export interface MultiLevelDiamondRequest {
  // Input data
  csvContent?: string;
  jsonData?: NetworkJsonInput;
  networkData?: NetworkJsonInput; // For processed network data
  
  // Multi-level analysis configuration
  config?: DiamondAnalysisConfig & {
    maxLevels?: number;
    levelAnalysisDepth?: number;
    crossLevelAnalysis?: boolean;
  };
  
  // Processing options
  options?: {
    includeProgress?: boolean;
    validateInput?: boolean;
    timeout?: number;
    parallelProcessing?: boolean;
  };
}

/**
 * Multi-Level Diamond Analysis Response
 */
export interface MultiLevelDiamondResponse {
  success: boolean;
  data?: {
    levels: Array<{
      level: number;
      diamonds: DiamondStructure[];
      classifications: DiamondClassificationModel[];
      statistics: {
        diamondCount: number;
        averageComplexity: number;
        typeDistribution: Record<string, number>;
      };
    }>;
    crossLevelAnalysis?: {
      interactions: Array<{
        level1: number;
        level2: number;
        interactionType: string;
        strength: number;
      }>;
      hierarchicalStructure: Record<string, unknown>;
    };
    summary: {
      totalLevels: number;
      totalDiamonds: number;
      maxDepth: number;
      analysisComplexity: number;
      processingTime: string;
    };
  };
  error?: string;
  message?: string;
  timestamp?: string;
  processingTime?: string;
}

// All interfaces now imported from models

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
   * Process network input - supports both CSV and JSON formats
   */
  processInput(request: ProcessInputRequest): Observable<ProcessInputResponse> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Debug: Log the request being sent
    console.log('🔧 API SERVICE: Sending request to Julia server:', request);
    
    // Manually stringify the JSON to ensure proper serialization
    const requestBody = JSON.stringify(request);
    console.log('🔧 API SERVICE: Stringified request body:', requestBody);
    console.log('🔧 API SERVICE: Request body length:', requestBody.length);
    
    return this.http.post<ProcessInputResponse>(`${this.baseUrl}/api/processinput`, requestBody, { headers })
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

  // ===== NEW DIAMOND DETECTION API METHODS =====

  /**
   * Detect diamonds in network data
   * Calls the /diamonds/detect endpoint for diamond detection
   */
  detectDiamonds(networkData: NetworkJsonInput, config?: DiamondAnalysisConfig): Observable<DiamondDetectionResponse> {
    const request: DiamondDetectionRequest = {
      networkData,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 60000
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Detecting diamonds:', request);

    return this.http.post<DiamondDetectionResponse>(`${this.baseUrl}/diamonds/detect`, request, { headers })
      .pipe(
        timeout(config?.timeout || 60000), // Configurable timeout for complex detection
        retry(2), // Fewer retries for analysis operations
        catchError(this.handleError<DiamondDetectionResponse>('detectDiamonds'))
      );
  }

  /**
   * Classify detected diamonds
   * Calls the /diamonds/classify endpoint for diamond classification
   */
  classifyDiamonds(diamonds: DiamondStructure[], config?: DiamondAnalysisConfig): Observable<DiamondClassifyResponse> {
    const request: DiamondClassifyRequest = {
      diamonds,
      config,
      options: {
        includeProgress: true,
        confidenceThreshold: config?.confidenceThreshold || 0.7,
        timeout: config?.timeout || 45000
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Classifying diamonds:', request);

    return this.http.post<DiamondClassifyResponse>(`${this.baseUrl}/diamonds/classify`, request, { headers })
      .pipe(
        timeout(config?.timeout || 45000), // Configurable timeout for classification
        retry(2), // Fewer retries for analysis operations
        catchError(this.handleError<DiamondClassifyResponse>('classifyDiamonds'))
      );
  }

  /**
   * Analyze multi-level diamonds in network data
   * Calls the /diamonds/multi-level endpoint for comprehensive diamond analysis
   */
  analyzeMultiLevelDiamonds(networkData: NetworkJsonInput, config?: DiamondAnalysisConfig & { maxLevels?: number; levelAnalysisDepth?: number; crossLevelAnalysis?: boolean }): Observable<MultiLevelDiamondResponse> {
    const request: MultiLevelDiamondRequest = {
      networkData,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 90000,
        parallelProcessing: true
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Analyzing multi-level diamonds:', request);

    return this.http.post<MultiLevelDiamondResponse>(`${this.baseUrl}/diamonds/multi-level`, request, { headers })
      .pipe(
        timeout(config?.timeout || 90000), // Longer timeout for complex multi-level analysis
        retry(1), // Single retry for long-running analysis
        catchError(this.handleError<MultiLevelDiamondResponse>('analyzeMultiLevelDiamonds'))
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

  // ===== OVERLOADED METHODS FOR DIFFERENT INPUT FORMATS =====

  /**
   * Detect diamonds from CSV content
   */
  detectDiamondsFromCsv(csvContent: string, config?: DiamondAnalysisConfig): Observable<DiamondDetectionResponse> {
    const request: DiamondDetectionRequest = {
      csvContent,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 60000
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Detecting diamonds from CSV:', { csvLength: csvContent.length, config });

    return this.http.post<DiamondDetectionResponse>(`${this.baseUrl}/diamonds/detect`, request, { headers })
      .pipe(
        timeout(config?.timeout || 60000),
        retry(2),
        catchError(this.handleError<DiamondDetectionResponse>('detectDiamondsFromCsv'))
      );
  }

  /**
   * Detect diamonds from JSON network data
   */
  detectDiamondsFromJson(jsonData: NetworkJsonInput, config?: DiamondAnalysisConfig): Observable<DiamondDetectionResponse> {
    const request: DiamondDetectionRequest = {
      jsonData,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 60000
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Detecting diamonds from JSON:', { edgeCount: jsonData.edges?.length, hasNodePriors: !!jsonData.nodePriors, config });

    return this.http.post<DiamondDetectionResponse>(`${this.baseUrl}/diamonds/detect`, request, { headers })
      .pipe(
        timeout(config?.timeout || 60000),
        retry(2),
        catchError(this.handleError<DiamondDetectionResponse>('detectDiamondsFromJson'))
      );
  }

  /**
   * Analyze multi-level diamonds from CSV content
   */
  analyzeMultiLevelDiamondsFromCsv(csvContent: string, config?: DiamondAnalysisConfig & { maxLevels?: number; levelAnalysisDepth?: number; crossLevelAnalysis?: boolean }): Observable<MultiLevelDiamondResponse> {
    const request: MultiLevelDiamondRequest = {
      csvContent,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 90000,
        parallelProcessing: true
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Analyzing multi-level diamonds from CSV:', { csvLength: csvContent.length, config });

    return this.http.post<MultiLevelDiamondResponse>(`${this.baseUrl}/diamonds/multi-level`, request, { headers })
      .pipe(
        timeout(config?.timeout || 90000),
        retry(1),
        catchError(this.handleError<MultiLevelDiamondResponse>('analyzeMultiLevelDiamondsFromCsv'))
      );
  }

  /**
   * Analyze multi-level diamonds from JSON network data
   */
  analyzeMultiLevelDiamondsFromJson(jsonData: NetworkJsonInput, config?: DiamondAnalysisConfig & { maxLevels?: number; levelAnalysisDepth?: number; crossLevelAnalysis?: boolean }): Observable<MultiLevelDiamondResponse> {
    const request: MultiLevelDiamondRequest = {
      jsonData,
      config,
      options: {
        includeProgress: true,
        validateInput: true,
        timeout: config?.timeout || 90000,
        parallelProcessing: true
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('🔧 API SERVICE: Analyzing multi-level diamonds from JSON:', { edgeCount: jsonData.edges?.length, hasNodePriors: !!jsonData.nodePriors, config });

    return this.http.post<MultiLevelDiamondResponse>(`${this.baseUrl}/diamonds/multi-level`, request, { headers })
      .pipe(
        timeout(config?.timeout || 90000),
        retry(1),
        catchError(this.handleError<MultiLevelDiamondResponse>('analyzeMultiLevelDiamondsFromJson'))
      );
  }

  // ===== DIAMOND ANALYSIS UTILITY METHODS =====

  /**
   * Validate diamond analysis configuration
   */
  validateDiamondConfig(config: DiamondAnalysisConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxDepth !== undefined && config.maxDepth < 0) {
      errors.push('maxDepth must be non-negative');
    }

    if (config.minNodes !== undefined && config.minNodes < 2) {
      errors.push('minNodes must be at least 2');
    }

    if (config.maxNodes !== undefined && config.minNodes !== undefined && config.maxNodes < config.minNodes) {
      errors.push('maxNodes must be greater than or equal to minNodes');
    }

    if (config.confidenceThreshold !== undefined && (config.confidenceThreshold < 0 || config.confidenceThreshold > 1)) {
      errors.push('confidenceThreshold must be between 0 and 1');
    }

    if (config.timeout !== undefined && config.timeout < 1000) {
      errors.push('timeout must be at least 1000ms');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Create default diamond analysis configuration
   */
  createDefaultDiamondConfig(): DiamondAnalysisConfig {
    return {
      maxDepth: 5,
      minNodes: 4,
      maxNodes: 50,
      detectOverlapping: true,
      performClassification: true,
      confidenceThreshold: 0.7,
      includePathAnalysis: true,
      timeout: 60000
    };
  }

  /**
   * Validate diamond structures before classification
   */
  validateDiamondStructures(diamonds: DiamondStructure[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!diamonds || diamonds.length === 0) {
      errors.push('No diamonds provided for classification');
      return { isValid: false, errors };
    }

    diamonds.forEach((diamond, index) => {
      if (!diamond.id) {
        errors.push(`Diamond at index ${index} missing required id`);
      }

      if (!diamond.nodes || diamond.nodes.length < 2) {
        errors.push(`Diamond ${diamond.id || index} must have at least 2 nodes`);
      }

      if (!diamond.source) {
        errors.push(`Diamond ${diamond.id || index} missing required source node`);
      }

      if (!diamond.sink) {
        errors.push(`Diamond ${diamond.id || index} missing required sink node`);
      }

      if (!diamond.paths || diamond.paths.length === 0) {
        errors.push(`Diamond ${diamond.id || index} must have at least one path`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Get progress tracking for long-running diamond analysis
   */
  getDiamondAnalysisProgress(analysisId: string): Observable<DiamondAnalysisProgress> {
    return this.http.get<DiamondAnalysisProgress>(`${this.baseUrl}/diamonds/progress/${analysisId}`)
      .pipe(
        timeout(5000),
        catchError(this.handleError<DiamondAnalysisProgress>('getDiamondAnalysisProgress'))
      );
  }

  /**
   * Cancel a running diamond analysis operation
   */
  cancelDiamondAnalysis(analysisId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/diamonds/analysis/${analysisId}`)
      .pipe(
        timeout(5000),
        catchError(this.handleError<{ success: boolean; message: string }>('cancelDiamondAnalysis'))
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
  getServerInfo(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/api/info`)
      .pipe(
        timeout(5000),
        catchError(this.handleError('getServerInfo'))
      ) as Observable<Record<string, unknown>>;
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