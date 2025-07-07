import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, map, catchError, throwError, tap, switchMap } from 'rxjs';
import {
  NetworkUploadRequest,
  NetworkUploadResponse,
  NetworkGraph,
  NetworkNode,
  NetworkEdge,
  DiamondAnalysisResult,
  DiamondNode,
  DiamondStructure,
  DiamondClassification,
  ReachabilityQuery,
  ReachabilityResult,
  ReachabilityPath,
  MonteCarloConfig,
  MonteCarloResult,
  ApiResponse,
  FileUploadProgress,
  ProbabilityType
} from '../models/network.models';
import { GlobalStateService } from './global-state.service';

/**
 * Service for communicating with the network analysis backend API
 * Handles all HTTP requests and integrates with global state management
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly globalState = inject(GlobalStateService);
  
  // API base URL - should be configurable via environment
  private readonly baseUrl = 'http://localhost:9090/api';

  /**
   * Upload network files and initialize analysis session
   */
  uploadNetwork(request: NetworkUploadRequest): Observable<NetworkUploadResponse> {
    // Convert files to the format Julia expects
    return this.convertFilesToJuliaFormat(request).pipe(
      switchMap(juliaData => {
        this.globalState.setUploading(true);
        this.globalState.setUploadProgress(null);

        // Log validation data being sent to verify user data is included
        this.logDataValidation('Network Upload', juliaData);

        return this.http.post<any>(`${this.baseUrl}/processinput`, juliaData).pipe(
          map(response => this.transformJuliaResponse(response, request.probabilityType)),
          tap(uploadResponse => {
            if (uploadResponse.success) {
              // Create a session ID from timestamp since Julia doesn't provide one
              const sessionId = `session_${Date.now()}`;
              const networkId = `network_${Date.now()}`;
              
              console.log('✅ Network upload completed:', {
                sessionId,
                networkId,
                probabilityType: request.probabilityType,
                networkSummary: uploadResponse.networkSummary
              });
              
              this.globalState.createSession(sessionId, networkId, request.probabilityType);
              
              // Store the Julia data for future requests
              this.globalState.setJuliaData(juliaData);
            }
            this.globalState.setUploading(false);
            this.globalState.setUploadProgress(null);
          }),
          catchError(error => {
            this.globalState.setUploading(false);
            this.globalState.setUploadProgress(null);
            this.globalState.setError(`Upload failed: ${error.message}`);
            return throwError(() => error);
          })
        );
      })
    );
  }

  /**
   * Get complete network structure and details
   */
  getNetworkStructure(sessionId: string): Observable<NetworkGraph> {
    this.globalState.setLoading(true);
    
    // Get the stored Julia data format and call processinput to get network structure
    const juliaData = this.globalState.getJuliaData();
    if (!juliaData) {
      this.globalState.setLoading(false);
      this.globalState.setError('No network data available. Please upload network files first.');
      return throwError(() => new Error('No network data available'));
    }
    
    // Log validation data being sent to verify user data is included
    this.logDataValidation('Network Structure', juliaData);
    
    return this.http.post<any>(`${this.baseUrl}/processinput`, juliaData).pipe(
      map(response => this.transformNetworkResponse(response)),
      tap(networkGraph => {
        console.log('✅ Network structure loaded:', {
          sessionId,
          nodeCount: networkGraph.nodes.length,
          edgeCount: networkGraph.edges.length,
          directed: networkGraph.directed,
          metadata: networkGraph.metadata
        });
        
        this.globalState.setNetworkGraph(networkGraph);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Failed to load network structure: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform diamond processing analysis
   */
  performDiamondProcessing(sessionId: string): Observable<DiamondAnalysisResult> {
    this.globalState.setLoading(true);
    
    // Get the stored Julia data format
    const juliaData = this.globalState.getJuliaData();
    if (!juliaData) {
      this.globalState.setLoading(false);
      this.globalState.setError('No network data available. Please upload network files first.');
      return throwError(() => new Error('No network data available'));
    }
    
    // Log validation data being sent to verify user data is included
    this.logDataValidation('Diamond Processing', juliaData);
    
    return this.http.post<any>(`${this.baseUrl}/diamondprocessing`, juliaData).pipe(
      map(response => this.transformDiamondResponse(response, sessionId)),
      tap(result => {
        console.log('✅ Diamond processing completed:', {
          sessionId: result.sessionId,
          diamondCount: result.summary.diamondCount,
          joinNodeCount: result.summary.joinNodeCount,
          nodeCount: result.nodes.length
        });
        
        // Store the transformed response in global state
        this.globalState.setDiamondAnalysis(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Diamond processing failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform diamond classification analysis
   */
  performDiamondClassification(sessionId: string): Observable<DiamondAnalysisResult> {
    this.globalState.setLoading(true);
    
    // Get the stored Julia data format
    const juliaData = this.globalState.getJuliaData();
    if (!juliaData) {
      this.globalState.setLoading(false);
      this.globalState.setError('No network data available. Please upload network files first.');
      return throwError(() => new Error('No network data available'));
    }
    
    // Log validation data being sent to verify user data is included
    this.logDataValidation('Diamond Classification', juliaData);
    
    return this.http.post<any>(`${this.baseUrl}/diamondclassification`, juliaData).pipe(
      map(response => this.transformDiamondResponse(response, sessionId)),
      tap(result => {
        console.log('✅ Diamond classification completed:', {
          sessionId: result.sessionId,
          diamondCount: result.summary.diamondCount,
          joinNodeCount: result.summary.joinNodeCount,
          nodeCount: result.nodes.length,
          classificationsFound: result.diamondClassifications?.length || 0,
          hasClassifications: result.diamondClassifications ? 'Yes' : 'No',
          classificationBreakdown: result.diamondClassifications ?
            result.diamondClassifications.reduce((acc: any, c) => {
              acc[c.internalStructure] = (acc[c.internalStructure] || 0) + 1;
              return acc;
            }, {}) : 'None'
        });
        
        // Store the transformed response in global state
        this.globalState.setDiamondAnalysis(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Diamond classification failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform reachability analysis with belief propagation
   * Note: Reachability analysis runs on ALL nodes and returns results for all nodes
   */
  performReachabilityAnalysis(sessionId: string): Observable<ReachabilityResult> {
    this.globalState.setLoading(true);
    
    // Get the stored Julia data format
    const juliaData = this.globalState.getJuliaData();
    if (!juliaData) {
      this.globalState.setLoading(false);
      this.globalState.setError('No network data available. Please upload network files first.');
      return throwError(() => new Error('No network data available'));
    }
    
    // Log validation data being sent to verify user data is included
    this.logDataValidation('Reachability Analysis', juliaData);
    
    return this.http.post<any>(`${this.baseUrl}/reachabilitymodule`, juliaData).pipe(
      map(response => this.transformReachabilityResponse(response, sessionId)),
      tap(result => {
        console.log('✅ Reachability analysis completed:', {
          sessionId: result.sessionId,
          pathCount: result.summary.pathCount,
          nodesAnalyzed: (result as any).metadata?.nodesAnalyzed || 0,
          totalNodes: (result as any).metadata?.totalNodes || 0
        });
        
        this.globalState.addReachabilityResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Reachability analysis failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform path enumeration between nodes
   */
  performPathEnumeration(
    sessionId: string,
    query: ReachabilityQuery
  ): Observable<ReachabilityResult> {
    this.globalState.setLoading(true);
    
    return this.http.post<ApiResponse<ReachabilityResult>>(
      `${this.baseUrl}/pathenum`,
      { sessionId, ...query }
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        this.globalState.addReachabilityResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Path enumeration failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Perform Monte Carlo validation analysis
   */
  performMonteCarloAnalysis(
    sessionId: string,
    config: MonteCarloConfig,
    query: ReachabilityQuery
  ): Observable<MonteCarloResult> {
    this.globalState.setLoading(true);
    
    const requestBody = {
      sessionId,
      config,
      query
    };
    
    // Log the Monte Carlo configuration being sent
    console.log('🎲 Monte Carlo Analysis - Configuration:', {
      sessionId,
      config,
      query,
      timestamp: new Date().toISOString()
    });
    
    return this.http.post<ApiResponse<MonteCarloResult>>(
      `${this.baseUrl}/montecarlo`,
      requestBody
    ).pipe(
      map(response => this.extractData(response)),
      tap(result => {
        console.log('✅ Monte Carlo analysis completed:', {
          sessionId: result.sessionId,
          iterations: result.config.iterations,
          convergenceAchieved: result.results.convergenceAchieved,
          meanProbability: result.results.meanProbability,
          processingTime: result.processingTime
        });
        
        this.globalState.addMonteCarloResult(result);
        this.globalState.setLoading(false);
      }),
      catchError(error => {
        this.globalState.setLoading(false);
        this.globalState.setError(`Monte Carlo analysis failed: ${error.message}`);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all available probability types from the server
   */
  getProbabilityTypes(): Observable<ProbabilityType[]> {
    return this.http.get<ApiResponse<ProbabilityType[]>>(`${this.baseUrl}/probability-types`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        console.warn('Failed to load probability types, using defaults:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Validate uploaded files before processing
   */
  validateFiles(files: {
    networkFile: File;
    nodePriorsFile?: File;
    linkProbabilitiesFile?: File;
  }): Observable<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const formData = new FormData();
    formData.append('network_file', files.networkFile);
    
    if (files.nodePriorsFile) {
      formData.append('node_priors_file', files.nodePriorsFile);
    }
    
    if (files.linkProbabilitiesFile) {
      formData.append('link_probabilities_file', files.linkProbabilitiesFile);
    }

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/validate`, formData).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Get session status and health check
   */
  getSessionStatus(sessionId: string): Observable<{ isActive: boolean; lastAccessed: string }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/session/${sessionId}/status`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete session and cleanup resources
   */
  deleteSession(sessionId: string): Observable<{ success: boolean }> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/session/${sessionId}`).pipe(
      map(response => this.extractData(response)),
      tap(() => {
        this.globalState.clearSession();
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Get server health and version information
   */
  getServerInfo(): Observable<{ version: string; status: string; timestamp: string }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/health`).pipe(
      map(response => this.extractData(response)),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  // Private helper methods

  /**
   * Convert uploaded files to Julia API format
   */
  private convertFilesToJuliaFormat(request: NetworkUploadRequest): Observable<any> {
    return new Observable(observer => {
      const reader1 = new FileReader();
      const reader2 = request.nodePriorsFile ? new FileReader() : null;
      const reader3 = request.linkProbabilitiesFile ? new FileReader() : null;
      
      let csvContent = '';
      let nodePriors = {};
      let edgeProbabilities = {};
      let filesRead = 0;
      const totalFiles = 1 + (reader2 ? 1 : 0) + (reader3 ? 1 : 0);
      
      const checkComplete = () => {
        filesRead++;
        if (filesRead === totalFiles) {
          observer.next({
            csvContent,
            nodePriors,
            edgeProbabilities
          });
          observer.complete();
        }
      };
      
      // Read network file (CSV)
      reader1.onload = () => {
        csvContent = reader1.result as string;
        checkComplete();
      };
      reader1.onerror = () => observer.error(new Error('Failed to read network file'));
      reader1.readAsText(request.networkFile);
      
      // Read node priors file (JSON)
      if (reader2 && request.nodePriorsFile) {
        reader2.onload = () => {
          try {
            nodePriors = JSON.parse(reader2.result as string);
            checkComplete();
          } catch (e) {
            observer.error(new Error('Invalid JSON in node priors file'));
          }
        };
        reader2.onerror = () => observer.error(new Error('Failed to read node priors file'));
        reader2.readAsText(request.nodePriorsFile);
      }
      
      // Read edge probabilities file (JSON)
      if (reader3 && request.linkProbabilitiesFile) {
        reader3.onload = () => {
          try {
            edgeProbabilities = JSON.parse(reader3.result as string);
            checkComplete();
          } catch (e) {
            observer.error(new Error('Invalid JSON in link probabilities file'));
          }
        };
        reader3.onerror = () => observer.error(new Error('Failed to read link probabilities file'));
        reader3.readAsText(request.linkProbabilitiesFile);
      }
    });
  }

  /**
   * Transform Julia API response to Angular expected format
   */
  private transformJuliaResponse(juliaResponse: any, probabilityType: ProbabilityType): NetworkUploadResponse {
    // Julia returns: { success, endpointType, data: { networkData, summary, ... }, timestamp }
    // Angular expects: { success, sessionId, networkId, message, networkSummary }
    
    const networkData = juliaResponse.data?.networkData;
    
    return {
      success: juliaResponse.success || false,
      sessionId: `session_${Date.now()}`, // Generate since Julia doesn't provide
      networkId: `network_${Date.now()}`, // Generate since Julia doesn't provide
      message: juliaResponse.data?.summary || 'Network processed successfully',
      networkSummary: networkData ? {
        nodeCount: networkData.nodeCount || 0,
        edgeCount: networkData.edgeCount || 0,
        isDirected: true // Metro network is directed
      } : undefined
    };
  }

  /**
   * Transform Julia diamond processing response to Angular format
   */
  private transformDiamondResponse(juliaResponse: any, sessionId: string): DiamondAnalysisResult {
    // Julia returns: { success, endpointType, data: { diamondData, networkData, summary, ... }, timestamp }
    
    const diamondData = juliaResponse.data?.diamondData;
    const networkData = juliaResponse.data?.networkData;
    const diamondStructures = diamondData?.diamondStructures || {};
    const diamondCount = diamondData?.diamondCount || 0;
    
    // Extract diamond classifications from API response
    const rawClassifications = diamondData?.diamondClassifications || [];
    const diamondClassifications: DiamondClassification[] = rawClassifications.map((classification: any) => ({
      joinNode: classification.joinNode,
      internalStructure: classification.internalStructure,
      pathTopology: classification.pathTopology,
      complexityScore: classification.complexityScore
    }));
    
    // Log classification data extraction for validation
    console.log('🔍 Diamond Classification Data Extraction:', {
      rawClassificationsCount: rawClassifications.length,
      transformedClassifications: diamondClassifications,
      sampleClassification: diamondClassifications[0] || 'None found'
    });
    
    // Transform Julia diamond structures (1-indexed) to Angular format (0-indexed)
    const transformedDiamondStructures: DiamondStructure[] = [];
    const joinNodeIds = new Set<string>();
    const allDiamondNodeIds = new Set<string>();
    
    Object.keys(diamondStructures).forEach(joinNodeId => {
      const diamondInfo = diamondStructures[joinNodeId];
      
      // Convert Julia 1-indexed node ID to 0-indexed (subtract 1)
      const zeroIndexedJoinNodeId = (parseInt(joinNodeId) - 1).toString();
      joinNodeIds.add(zeroIndexedJoinNodeId);
      
      // Extract diamond nodes and edges from the diamonds array
      const diamondNodes: string[] = [];
      const diamondEdges: any[] = [];
      
      if (diamondInfo.diamonds && Array.isArray(diamondInfo.diamonds)) {
        diamondInfo.diamonds.forEach((diamond: any) => {
          // Extract relevant nodes (convert from 1-indexed to 0-indexed)
          if (diamond.relevantNodes && Array.isArray(diamond.relevantNodes)) {
            diamond.relevantNodes.forEach((nodeId: number) => {
              const zeroIndexedNodeId = (nodeId - 1).toString();
              diamondNodes.push(zeroIndexedNodeId);
              allDiamondNodeIds.add(zeroIndexedNodeId);
            });
          }
          
          // Extract edge list (convert from 1-indexed to 0-indexed)
          if (diamond.edgeList && Array.isArray(diamond.edgeList)) {
            diamond.edgeList.forEach((edge: any) => {
              if (Array.isArray(edge) && edge.length >= 2) {
                diamondEdges.push([edge[0] - 1, edge[1] - 1]); // Convert to 0-indexed
              }
            });
          }
        });
      }
      
      transformedDiamondStructures.push({
        joinNodeId: zeroIndexedJoinNodeId,
        diamonds: diamondInfo.diamonds || [],
        nonDiamondParents: diamondInfo.nonDiamondParents || [],
        diamondNodes: [...new Set(diamondNodes)], // Remove duplicates
        diamondEdges
      });
    });
    
    // Create DiamondNode objects for all nodes in the network
    const nodes: DiamondNode[] = [];
    const sourceNodes = networkData?.sourceNodes || [];
    const sinkNodes = networkData?.sinkNodes || [];
    const joinNodes = networkData?.joinNodes || [];
    
    // Process all nodes in the network
    if (networkData?.nodes) {
      Object.keys(networkData.nodes).forEach(nodeId => {
        // Convert Julia 1-indexed to 0-indexed
        const zeroIndexedNodeId = (parseInt(nodeId) - 1).toString();
        
        // Determine node classification
        let classification: 'source' | 'sink' | 'intermediate' | 'isolated' | 'join' = 'intermediate';
        const isJoinNode = joinNodeIds.has(zeroIndexedNodeId);
        const isDiamondNode = allDiamondNodeIds.has(zeroIndexedNodeId);
        
        if (sourceNodes.includes(parseInt(nodeId))) {
          classification = 'source';
        } else if (sinkNodes.includes(parseInt(nodeId))) {
          classification = 'sink';
        } else if (isJoinNode) {
          classification = 'join';
        }
        // Note: Diamond nodes can have any classification (source, sink, intermediate, join)
        // The diamond participation is tracked separately
        
        // Find diamond structures this node participates in (either as join node or diamond node)
        const nodeDiamondStructures = transformedDiamondStructures.filter(
          ds => ds.joinNodeId === zeroIndexedNodeId || ds.diamondNodes.includes(zeroIndexedNodeId)
        );
        
        nodes.push({
          nodeId: zeroIndexedNodeId,
          classification,
          inDegree: 0, // Would need to calculate from edges
          outDegree: 0, // Would need to calculate from edges
          reachableNodes: [],
          reachingNodes: [],
          isJoinNode,
          diamondStructures: nodeDiamondStructures
        });
      });
    }
    
    return {
      sessionId,
      networkId: `network_${Date.now()}`,
      nodes,
      diamondStructures: transformedDiamondStructures,
      diamondClassifications, // Include the extracted classification data
      summary: {
        sourceCount: sourceNodes.length,
        sinkCount: sinkNodes.length,
        intermediateCount: nodes.filter(n => n.classification === 'intermediate').length,
        isolatedCount: nodes.filter(n => n.classification === 'isolated').length,
        joinNodeCount: joinNodeIds.size,
        diamondCount
      },
      processingTime: 0 // Julia doesn't provide this
    };
  }

  /**
   * Transform Julia reachability response to Angular format
   */
  private transformReachabilityResponse(juliaResponse: any, sessionId: string): ReachabilityResult {
    // Julia returns: { success, endpointType, data: { results, networkData, analysisMetadata, summary, ... }, timestamp }
    
    console.log('🔍 Transforming reachability response:', {
      success: juliaResponse.success,
      endpointType: juliaResponse.endpointType,
      dataKeys: Object.keys(juliaResponse.data || {}),
      resultsType: typeof juliaResponse.data?.results,
      resultsKeys: juliaResponse.data?.results ? Object.keys(juliaResponse.data.results) : 'No results'
    });
    
    const data = juliaResponse.data || {};
    const results = data.results || {};
    const summary = data.summary || {};
    const analysisMetadata = data.analysisMetadata || {};
    
    // Transform results - Julia returns results for all nodes
    const paths: ReachabilityPath[] = [];
    let totalNodes = 0;
    let totalProbabilitySum = 0;
    const pathLengths: number[] = [];
    
    // Process results object which contains reachability data for all nodes
    if (typeof results === 'object' && results !== null) {
      Object.keys(results).forEach(nodeId => {
        const nodeResults = results[nodeId];
        if (nodeResults && typeof nodeResults === 'object') {
          totalNodes++;
          
          // Extract reachability paths for this node
          if (nodeResults.paths && Array.isArray(nodeResults.paths)) {
            nodeResults.paths.forEach((pathData: any) => {
              const pathLength = pathData.path ? pathData.path.length : 1;
              const probability = pathData.probability || 0;
              
              paths.push({
                path: pathData.path || [nodeId],
                probability: probability,
                length: pathLength
              });
              
              pathLengths.push(pathLength);
              if (typeof probability === 'number') {
                totalProbabilitySum += probability;
              }
            });
          } else {
            // If no specific paths, create a single-node path
            paths.push({
              path: [nodeId],
              probability: nodeResults.probability || 0,
              length: 1
            });
            pathLengths.push(1);
            if (typeof nodeResults.probability === 'number') {
              totalProbabilitySum += nodeResults.probability;
            }
          }
        }
      });
    }
    
    // Calculate summary statistics
    const pathCount = paths.length;
    const averageLength = pathLengths.length > 0 ? pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length : 0;
    const maxLength = pathLengths.length > 0 ? Math.max(...pathLengths) : 0;
    const minLength = pathLengths.length > 0 ? Math.min(...pathLengths) : 0;
    
    return {
      sessionId,
      networkId: `network_${Date.now()}`,
      query: { sourceNodes: [], targetNodes: [] }, // No specific query since it runs on all nodes
      paths,
      totalProbability: totalProbabilitySum,
      summary: {
        pathCount,
        averageLength,
        maxLength,
        minLength
      },
      processingTime: analysisMetadata.processingTime || 0,
      metadata: {
        analysisType: analysisMetadata.analysisType || 'reachability',
        iterationSets: analysisMetadata.iterationSets || 0,
        resultsGenerated: summary.resultsGenerated || totalNodes,
        totalNodes,
        nodesAnalyzed: analysisMetadata.nodesAnalyzed || totalNodes,
        diamondsProcessed: analysisMetadata.diamondsProcessed || 0
      }
    } as ReachabilityResult & { metadata: any };
  }

  /**
   * Transform Julia network response to Angular NetworkGraph format
   */
  private transformNetworkResponse(juliaResponse: any): NetworkGraph {
    // Julia returns: { success, endpointType, data: { networkData, ... }, timestamp }
    
    const networkData = juliaResponse.data?.networkData;
    
    // Transform Julia network data to Angular format
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    
    if (networkData?.nodes) {
      // Transform nodes
      Object.keys(networkData.nodes).forEach((nodeId, index) => {
        nodes.push({
          id: nodeId,
          label: nodeId,
          x: Math.random() * 800, // Random positioning for now
          y: Math.random() * 600,
          metadata: {}
        });
      });
    }
    
    if (networkData?.edges) {
      // Transform edges
      networkData.edges.forEach((edge: any, index: number) => {
        edges.push({
          id: `edge_${index}`,
          source: edge.source || edge[0],
          target: edge.target || edge[1],
          weight: edge.weight || 1,
          probability: edge.probability || 0.5,
          metadata: {}
        });
      });
    }
    
    return {
      nodes,
      edges,
      directed: true, // Metro network is directed
      metadata: {
        name: 'Metro Network',
        description: 'Uploaded metro network data',
        nodeCount: networkData?.nodeCount || nodes.length,
        edgeCount: networkData?.edgeCount || edges.length
      }
    };
  }

  private handleUploadProgress(event: HttpEvent<ApiResponse<NetworkUploadResponse>>): ApiResponse<NetworkUploadResponse> | null {
    switch (event.type) {
      case HttpEventType.UploadProgress:
        if (event.total) {
          const progress: FileUploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round(100 * event.loaded / event.total)
          };
          this.globalState.setUploadProgress(progress);
        }
        return null;

      case HttpEventType.Response:
        return event.body;

      default:
        return null;
    }
  }

  private extractData<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.error || response.message || 'API request failed');
    }
    
    if (response.data === undefined) {
      throw new Error('No data in API response');
    }
    
    return response.data;
  }

  /**
   * Create a reusable error handler for HTTP requests
   */
  private handleError(operation: string) {
    return (error: any): Observable<never> => {
      console.error(`${operation} failed:`, error);
      
      let errorMessage = `${operation} failed`;
      if (error.error?.message) {
        errorMessage += `: ${error.error.message}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      this.globalState.setError(errorMessage);
      return throwError(() => new Error(errorMessage));
    };
  }

  /**
   * Retry logic for failed requests
   */
  private retryRequest<T>(
    requestFn: () => Observable<T>,
    maxRetries = 3,
    delay = 1000
  ): Observable<T> {
    return requestFn().pipe(
      catchError((error) => {
        if (maxRetries > 0) {
          return new Observable<T>(subscriber => {
            setTimeout(() => {
              this.retryRequest(requestFn, maxRetries - 1, delay * 2)
                .subscribe(subscriber);
            }, delay);
          });
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Log validation data being sent to verify user data is included
   */
  private logDataValidation(operation: string, juliaData: any): void {
    console.log(`🔍 ${operation} - Data validation:`, {
      operation,
      hasCSVContent: !!juliaData.csvContent,
      csvContentLength: juliaData.csvContent?.length || 0,
      hasNodePriors: !!juliaData.nodePriors && Object.keys(juliaData.nodePriors).length > 0,
      nodePriorsCount: juliaData.nodePriors ? Object.keys(juliaData.nodePriors).length : 0,
      hasEdgeProbabilities: !!juliaData.edgeProbabilities && Object.keys(juliaData.edgeProbabilities).length > 0,
      edgeProbabilitiesCount: juliaData.edgeProbabilities ? Object.keys(juliaData.edgeProbabilities).length : 0,
      dataKeys: Object.keys(juliaData || {}),
      timestamp: new Date().toISOString()
    });

    // Validate that user-uploaded data is present
    if (!juliaData.csvContent) {
      console.warn(`⚠️ ${operation} - Missing network CSV content`);
    }
    
    if (juliaData.nodePriors && Object.keys(juliaData.nodePriors).length === 0) {
      console.warn(`⚠️ ${operation} - Node priors object is empty`);
    }
    
    if (juliaData.edgeProbabilities && Object.keys(juliaData.edgeProbabilities).length === 0) {
      console.warn(`⚠️ ${operation} - Edge probabilities object is empty`);
    }

    // Log sample of user data (first few entries for verification)
    if (juliaData.nodePriors && Object.keys(juliaData.nodePriors).length > 0) {
      const sampleNodePriors = Object.keys(juliaData.nodePriors).slice(0, 3).reduce((acc: any, key) => {
        acc[key] = juliaData.nodePriors[key];
        return acc;
      }, {});
      console.log(`📊 ${operation} - Sample node priors:`, sampleNodePriors);
    }

    if (juliaData.edgeProbabilities && Object.keys(juliaData.edgeProbabilities).length > 0) {
      const sampleEdgeProbs = Object.keys(juliaData.edgeProbabilities).slice(0, 3).reduce((acc: any, key) => {
        acc[key] = juliaData.edgeProbabilities[key];
        return acc;
      }, {});
      console.log(`📊 ${operation} - Sample edge probabilities:`, sampleEdgeProbs);
    }
  }

  /**
   * Enhanced transformer for diamond analysis responses
   */
  private transformDiamondAnalysisResponse(juliaResponse: any, sessionId: string): DiamondAnalysisResult {
    console.log('🔄 Transforming diamond analysis response:', {
      success: juliaResponse.success,
      endpointType: juliaResponse.endpointType,
      dataKeys: Object.keys(juliaResponse.data || {}),
      diamondDataKeys: juliaResponse.data?.diamondData ? Object.keys(juliaResponse.data.diamondData) : 'No diamondData'
    });

    // Use the existing transformDiamondResponse method but with enhanced logging
    const result = this.transformDiamondResponse(juliaResponse, sessionId);
    
    console.log('✅ Diamond analysis transformation completed:', {
      sessionId: result.sessionId,
      networkId: result.networkId,
      totalNodes: result.nodes.length,
      diamondStructures: result.diamondStructures.length,
      summary: result.summary
    });

    return result;
  }

  /**
   * Enhanced transformer for reachability analysis responses
   */
  private transformReachabilityAnalysisResponse(juliaResponse: any, sessionId: string): ReachabilityResult {
    console.log('🔄 Transforming reachability analysis response:', {
      success: juliaResponse.success,
      endpointType: juliaResponse.endpointType,
      dataKeys: Object.keys(juliaResponse.data || {}),
      resultsType: typeof juliaResponse.data?.results,
      resultsKeys: juliaResponse.data?.results ? Object.keys(juliaResponse.data.results) : 'No results'
    });

    // Use the existing transformReachabilityResponse method but with enhanced logging
    const result = this.transformReachabilityResponse(juliaResponse, sessionId);
    
    console.log('✅ Reachability analysis transformation completed:', {
      sessionId: result.sessionId,
      networkId: result.networkId,
      pathCount: result.summary.pathCount,
      metadata: (result as any).metadata
    });

    return result;
  }
}