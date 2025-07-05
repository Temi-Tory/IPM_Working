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