import { Injectable, computed, signal } from '@angular/core';
import { 
  NodeDialogData, 
  EdgeDialogData, 
  NodeConnectivityInfo,
  NodeTopologyInfo,
  NodeClassificationInfo,
  NodeRawDataInfo,
  EdgeConnectionInfo,
  EdgeClassificationInfo,
  EdgeRawDataInfo,
  DialogCacheEntry,
  DialogCacheConfig,
  DialogPerformanceConfig,
  VirtualScrollItem
} from '../interfaces/network-dialog.interfaces';
import { NetworkStructure, BeliefValue } from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class NetworkDialogService {
  private nodeCache = new Map<string, DialogCacheEntry<NodeDialogData>>();
  private edgeCache = new Map<string, DialogCacheEntry<EdgeDialogData>>();
  private ancestorCache = new Map<string, number[]>();
  private descendantCache = new Map<string, number[]>();
  
  // Performance configuration
  private performanceConfig: DialogPerformanceConfig = {
    virtualScrollingThreshold: 100,
    cacheTimeout: 300000, // 5 minutes
    lazyLoadThreshold: 1000,
    maxConcurrentRequests: 3
  };

  private cacheConfig: DialogCacheConfig = {
    maxEntries: 500,
    ttl: 300000, // 5 minutes
    cleanupInterval: 60000 // 1 minute
  };

  // Current network data signal
  private currentNetworkData = signal<NetworkStructure | null>(null);
  private networkHash = signal<string>('');

  constructor() {
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), this.cacheConfig.cleanupInterval);
  }

  /**
   * Set the current network data for dialog operations
   */
  setNetworkData(networkData: NetworkStructure): void {
    console.log('🔍 [NetworkDialogService] Raw API Response - setNetworkData called with:', {
      networkData: networkData,
      hasNetworkData: !!networkData,
      totalNodes: networkData?.total_nodes,
      totalEdges: networkData?.total_edges,
      nodes: networkData?.nodes,
      edges: networkData?.edges,
      ancestors: networkData?.ancestors,
      descendants: networkData?.descendants,
      rawDataKeys: networkData?.raw_data ? Object.keys(networkData.raw_data) : 'No raw_data'
    });

    this.currentNetworkData.set(networkData);
    const hash = this.generateNetworkHash(networkData);
    this.networkHash.set(hash);
    
    // Clear cache if network changed
    if (this.nodeCache.size > 0 &&
        Array.from(this.nodeCache.values())[0]?.networkHash !== hash) {
      this.clearCache();
    }
  }

  /**
   * Get comprehensive node dialog data with performance optimizations
   */
  async getNodeDialogData(nodeId: number): Promise<NodeDialogData | null> {
    console.log('🔍 [NetworkDialogService] getNodeDialogData called with:', {
      nodeId: nodeId,
      nodeIdType: typeof nodeId,
      isNodeIdValid: nodeId !== null && nodeId !== undefined && !isNaN(nodeId)
    });

    // Critical validation and conversion of nodeId
    if (nodeId === null || nodeId === undefined) {
      console.error('🚨 [NetworkDialogService] CRITICAL ERROR: nodeId is null or undefined:', nodeId);
      return null;
    }

    // Convert nodeId to number if it's not already
    let validNodeId: number;
    if (typeof nodeId === 'number') {
      validNodeId = nodeId;
    } else if (typeof nodeId === 'string') {
      validNodeId = parseInt(nodeId, 10);
    } else if (typeof nodeId === 'object' && nodeId !== null) {
      console.error('🚨 [NetworkDialogService] CRITICAL ERROR: nodeId is an object:', {
        nodeId: nodeId,
        nodeIdType: typeof nodeId,
        nodeIdConstructor: (nodeId as any).constructor?.name,
        nodeIdKeys: Object.keys(nodeId as any)
      });
      return null;
    } else {
      validNodeId = parseInt(String(nodeId), 10);
    }

    if (isNaN(validNodeId)) {
      console.error('🚨 [NetworkDialogService] CRITICAL ERROR: Could not convert nodeId to valid number:', {
        originalNodeId: nodeId,
        convertedNodeId: validNodeId
      });
      return null;
    }

    const networkData = this.currentNetworkData();
    console.log('🔍 [NetworkDialogService] Current network data:', {
      hasNetworkData: !!networkData,
      networkDataKeys: networkData ? Object.keys(networkData) : 'No network data'
    });

    if (!networkData) return null;

    const cacheKey = `node_${validNodeId}_${this.networkHash()}`;
    
    // Check cache first
    const cached = this.nodeCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      cached.accessCount++;
      return cached.data;
    }

    const startTime = performance.now();
    
    try {
      // Build node dialog data
      console.log('🔍 [NetworkDialogService] About to call buildNodeConnectivity with:', {
        nodeId: validNodeId,
        nodeIdType: typeof validNodeId,
        networkDataStructure: {
          hasAncestors: !!networkData.ancestors,
          hasDescendants: !!networkData.descendants,
          ancestorsType: typeof networkData.ancestors,
          descendantsType: typeof networkData.descendants
        }
      });

      const connectivity = await this.buildNodeConnectivity(validNodeId, networkData);
      const topology = this.buildNodeTopology(validNodeId, networkData);
      const classification = this.buildNodeClassification(validNodeId, networkData);
      const rawData = await this.buildNodeRawData(validNodeId, networkData);
      
      const dialogData: NodeDialogData = {
        nodeId: validNodeId,
        displayName: `Node ${validNodeId}`,
        connectivity,
        topology,
        classification,
        rawData,
        metadata: {
          networkSize: networkData.total_nodes,
          loadTime: performance.now() - startTime,
          cacheKey
        }
      };

      // Cache the result
      this.cacheNodeData(cacheKey, dialogData);
      
      return dialogData;
    } catch (error) {
      console.error('🚨 [NetworkDialogService] Error building node dialog data:', {
        error: error,
        nodeId: validNodeId,
        nodeIdType: typeof validNodeId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return null;
    }
  }

  /**
   * Get comprehensive edge dialog data with performance optimizations
   */
  async getEdgeDialogData(sourceId: number, targetId: number): Promise<EdgeDialogData | null> {
    const networkData = this.currentNetworkData();
    if (!networkData) return null;

    const cacheKey = `edge_${sourceId}_${targetId}_${this.networkHash()}`;
    
    // Check cache first
    const cached = this.edgeCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      cached.accessCount++;
      return cached.data;
    }

    const startTime = performance.now();
    
    try {
      const connection = this.buildEdgeConnection(sourceId, targetId, networkData);
      const classification = this.buildEdgeClassification(sourceId, targetId, networkData);
      
      const dialogData: EdgeDialogData = {
        connection,
        classification,
        rawData: {
          hasLinkProbabilities: false,
          probability: undefined,
          hasCapacityData: false,
          capacity: undefined,
          hasCpmData: false,
          delay: undefined,
          cost: undefined,
          hasFlowData: false,
          flow: undefined,
          utilization: undefined,
          additionalMetrics: undefined
        },
        navigation: {
          canNavigateToSource: true,
          canNavigateToTarget: true,
          relatedEdges: this.findRelatedEdges(sourceId, targetId, networkData)
        },
        metadata: {
          networkSize: networkData.total_nodes,
          loadTime: performance.now() - startTime,
          cacheKey
        }
      };

      // Cache the result
      this.cacheEdgeData(cacheKey, dialogData);
      
      return dialogData;
    } catch (error) {
      console.error('Error building edge dialog data:', error);
      return null;
    }
  }

  /**
   * Get paginated ancestors for virtual scrolling
   */
  async getPaginatedAncestors(nodeId: number, page: number, pageSize: number): Promise<VirtualScrollItem[]> {
    const networkData = this.currentNetworkData();
    if (!networkData) return [];

    const cacheKey = `ancestors_${nodeId}`;
    let ancestors = this.ancestorCache.get(cacheKey);
    
    if (!ancestors) {
      ancestors = networkData.ancestors[nodeId.toString()] || [];
      this.ancestorCache.set(cacheKey, ancestors);
    }

    const start = page * pageSize;
    const end = start + pageSize;
    const pageItems = ancestors.slice(start, end);

    return pageItems.map(ancestorId => ({
      id: ancestorId,
      displayText: `Node ${ancestorId}`,
      metadata: { nodeId: ancestorId }
    }));
  }

  /**
   * Get paginated descendants for virtual scrolling
   */
  async getPaginatedDescendants(nodeId: number, page: number, pageSize: number): Promise<VirtualScrollItem[]> {
    const networkData = this.currentNetworkData();
    if (!networkData) return [];

    const cacheKey = `descendants_${nodeId}`;
    let descendants = this.descendantCache.get(cacheKey);
    
    if (!descendants) {
      descendants = networkData.descendants[nodeId.toString()] || [];
      this.descendantCache.set(cacheKey, descendants);
    }

    const start = page * pageSize;
    const end = start + pageSize;
    const pageItems = descendants.slice(start, end);

    return pageItems.map(descendantId => ({
      id: descendantId,
      displayText: `Node ${descendantId}`,
      metadata: { nodeId: descendantId }
    }));
  }

  /**
   * Build node connectivity information with performance optimizations
   */
  private async buildNodeConnectivity(nodeId: number, networkData: NetworkStructure): Promise<NodeConnectivityInfo> {
    console.log('🔍 [NetworkDialogService] buildNodeConnectivity called with:', {
      nodeId: nodeId,
      nodeIdType: typeof nodeId,
      isNodeIdValid: nodeId !== null && nodeId !== undefined && !isNaN(nodeId),
      networkData: {
        hasAncestors: !!networkData?.ancestors,
        hasDescendants: !!networkData?.descendants,
        ancestorsKeys: networkData?.ancestors ? Object.keys(networkData.ancestors).slice(0, 5) : 'No ancestors',
        descendantsKeys: networkData?.descendants ? Object.keys(networkData.descendants).slice(0, 5) : 'No descendants',
        totalNodes: networkData?.total_nodes,
        totalEdges: networkData?.total_edges
      }
    });

    // Critical validation before calling toString()
    if (nodeId === null || nodeId === undefined || isNaN(nodeId)) {
      console.error('🚨 [NetworkDialogService] CRITICAL ERROR: nodeId is invalid:', {
        nodeId: nodeId,
        nodeIdType: typeof nodeId,
        isNull: nodeId === null,
        isUndefined: nodeId === undefined,
        isNaN: isNaN(nodeId)
      });
      throw new Error(`Invalid nodeId: ${nodeId} (type: ${typeof nodeId})`);
    }

    const directParents = this.getDirectParents(nodeId, networkData);
    const directChildren = this.getDirectChildren(nodeId, networkData);
    
    // This is line 222 where the error occurs - adding extra logging
    console.log('🔍 [NetworkDialogService] About to access ancestors with nodeId.toString():', {
      nodeId: nodeId,
      nodeIdString: nodeId.toString(),
      hasAncestors: !!networkData?.ancestors,
      ancestorsType: typeof networkData?.ancestors
    });

    const ancestors = networkData.ancestors[nodeId.toString()] || [];
    
    console.log('🔍 [NetworkDialogService] About to access descendants with nodeId.toString():', {
      nodeId: nodeId,
      nodeIdString: nodeId.toString(),
      hasDescendants: !!networkData?.descendants,
      descendantsType: typeof networkData?.descendants
    });

    const descendants = networkData.descendants[nodeId.toString()] || [];

    console.log('🔍 [NetworkDialogService] Successfully retrieved connectivity data:', {
      nodeId: nodeId,
      directParentsCount: directParents.length,
      directChildrenCount: directChildren.length,
      ancestorsCount: ancestors.length,
      descendantsCount: descendants.length
    });

    return {
      inDegree: directParents.length,
      outDegree: directChildren.length,
      totalDegree: directParents.length + directChildren.length,
      directParents: directParents.sort((a, b) => a - b),
      directChildren: directChildren.sort((a, b) => a - b),
      ancestorCount: ancestors.length,
      descendantCount: descendants.length,
      // Only include full lists for small networks or when specifically requested
      ...(networkData.total_nodes <= this.performanceConfig.lazyLoadThreshold ? {
        ancestors: ancestors.sort((a, b) => a - b),
        descendants: descendants.sort((a, b) => a - b)
      } : {})
    };
  }

  /**
   * Build node topology information with enhanced critical path analysis
   */
  private buildNodeTopology(nodeId: number, networkData: NetworkStructure): NodeTopologyInfo {
    const iterationSets = this.getNodeIterationSets(nodeId, networkData);
    const topologicalLevel = iterationSets.length > 0 ? Math.min(...iterationSets) : 0;
    
    // Enhanced critical path detection
    const criticalPathNodes = this.identifyCriticalPathNodes(nodeId, networkData);
    
    return {
      iterationSets,
      topologicalLevel,
      criticalPathNodes,
      bottleneckScore: this.calculateBottleneckScore(nodeId, networkData),
      hubScore: this.calculateHubScore(nodeId, networkData),
      bridgeScore: this.calculateBridgeScore(nodeId, networkData)
    };
  }

  /**
   * Build node classification information
   */
  private buildNodeClassification(nodeId: number, networkData: NetworkStructure): NodeClassificationInfo {
    const allTypes = this.getNodeTypes(nodeId, networkData);
    const primaryType = this.getPrimaryNodeType(nodeId, networkData);
    
    const inDegree = this.getDirectParents(nodeId, networkData).length;
    const outDegree = this.getDirectChildren(nodeId, networkData).length;
    const totalDegree = inDegree + outDegree;
    
    // Calculate degree statistics for classification
    const allDegrees = networkData.nodes.map(nId => {
      const inD = this.getDirectParents(nId, networkData).length;
      const outD = this.getDirectChildren(nId, networkData).length;
      return inD + outD;
    });
    const avgDegree = allDegrees.reduce((sum, d) => sum + d, 0) / allDegrees.length;
    const sortedDegrees = allDegrees.sort((a, b) => a - b);
    const q3Index = Math.floor(sortedDegrees.length * 0.75);
    const q3Degree = sortedDegrees[q3Index];

    return {
      primaryType,
      allTypes,
      isMultiType: allTypes.length > 1,
      specialClassifications: {
        isHub: totalDegree >= q3Degree,
        isBridge: inDegree === 1 && outDegree === 1,
        isBottleneck: (inDegree >= 2 && outDegree <= 1) || (outDegree >= 2 && inDegree <= 1),
        isCriticalPath: false, // TODO: Implement when critical path data is available
        isOrphan: totalDegree === 0
      }
    };
  }

  /**
   * Build node raw data information with enhanced backend integration
   */
  private async buildNodeRawData(nodeId: number, networkData: NetworkStructure): Promise<NodeRawDataInfo> {
    const rawData = networkData.raw_data;
    const uploadedData = networkData.uploaded_data;
    const nodeKey = nodeId.toString();
    
    // Enhanced raw data processing with support for multiple data types
    // Check both legacy raw_data and new uploaded_data
    const hasNodePriors = !!(rawData?.node_priors?.[nodeKey]) ||
                          !!(uploadedData?.float?.node_priors?.[nodeKey]) ||
                          !!(uploadedData?.interval?.node_priors?.[nodeKey]) ||
                          !!(uploadedData?.pbox?.node_priors?.[nodeKey]);
    
    // Get node priors from uploaded data (prioritize uploaded data over legacy)
    const nodePriors = uploadedData?.float?.node_priors?.[nodeKey] ||
                     uploadedData?.interval?.node_priors?.[nodeKey] ||
                     uploadedData?.pbox?.node_priors?.[nodeKey] ||
                     rawData?.node_priors?.[nodeKey];
    
    // Check for capacity data from uploaded data and analysis results
    const hasCapacityData = !!(uploadedData?.capacity?.capacities?.nodes?.[nodeKey]) ||
                           this.hasCapacityDataForNode(nodeId, rawData);
    const capacity = uploadedData?.capacity?.capacities?.nodes?.[nodeKey] ||
                    this.extractNodeCapacity(nodeId, rawData);
    
    // Check for CPM data from uploaded data and analysis results
    const hasCpmData = !!(uploadedData?.cpm?.cmp_data) ||
                      this.hasCpmDataForNode(nodeId, rawData);
    const duration = this.extractNodeDuration(nodeId, rawData);
    const cost = this.extractNodeCost(nodeId, rawData);
    
    // Check for flow data from analysis results
    const hasFlowData = this.hasFlowDataForNode(nodeId, rawData);
    const maxFlow = this.extractNodeMaxFlow(nodeId, rawData);
    
    return {
      hasNodePriors,
      nodePriors,
      hasCapacityData,
      capacity,
      hasCpmData,
      duration,
      cost,
      hasFlowData,
      maxFlow,
      additionalMetrics: this.extractAdditionalNodeMetrics(nodeId, rawData),
      // NEW: Include uploaded data for raw data tab
      uploadedNodeData: this.extractUploadedNodeData(nodeId, uploadedData)
    };
  }

  /**
   * Build edge connection information
   */
  private buildEdgeConnection(sourceId: number, targetId: number, networkData: NetworkStructure): EdgeConnectionInfo {
    const sourceType = this.getNodeTypes(sourceId, networkData).join(' + ');
    const targetType = this.getNodeTypes(targetId, networkData).join(' + ');
    const edgeType = this.getEdgeType(sourceId, targetId, sourceType, targetType);
    
    const sourceInDegree = this.getDirectParents(sourceId, networkData).length;
    const sourceOutDegree = this.getDirectChildren(sourceId, networkData).length;
    const targetInDegree = this.getDirectParents(targetId, networkData).length;
    const targetOutDegree = this.getDirectChildren(targetId, networkData).length;
    
    // Calculate connection strength based on node degrees
    const connectionStrength = Math.min(sourceOutDegree, targetInDegree) / 
                              Math.max(sourceOutDegree, targetInDegree, 1);

    return {
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceType,
      targetType,
      edgeType,
      connectionStrength
    };
  }

  /**
   * Build edge classification information with enhanced analysis
   */
  private buildEdgeClassification(sourceId: number, targetId: number, networkData: NetworkStructure): EdgeClassificationInfo {
    const sourceOutDegree = this.getDirectChildren(sourceId, networkData).length;
    const targetInDegree = this.getDirectParents(targetId, networkData).length;
    
    // Enhanced critical path detection
    const isCriticalPath = this.isEdgeOnCriticalPath(sourceId, targetId, networkData);
    
    return {
      isCriticalPath,
      isBottleneck: sourceOutDegree === 1 || targetInDegree === 1,
      flowImportance: this.calculateFlowImportance(sourceId, targetId, networkData),
      topologicalImportance: this.calculateTopologicalImportance(sourceId, targetId, networkData),
      structuralRole: this.calculateStructuralRole(sourceId, targetId, networkData)
    };
  }

  /**
   * Build edge raw data information with enhanced backend integration
   */
  private async buildEdgeRawData(sourceId: number, targetId: number, networkData: NetworkStructure): Promise<EdgeRawDataInfo> {
    const rawData = networkData.raw_data;
    const uploadedData = networkData.uploaded_data;
    const edgeKey = `${sourceId}_${targetId}`;
    const altEdgeKey = `${sourceId}->${targetId}`;
    
    // Enhanced raw data processing for edges
    // Check both legacy raw_data and new uploaded_data
    const hasLinkProbabilities = !!(rawData?.edge_probabilities?.[edgeKey]) ||
                                !!(rawData?.edge_probabilities?.[altEdgeKey]) ||
                                !!(uploadedData?.float?.edge_probabilities?.[edgeKey]) ||
                                !!(uploadedData?.float?.edge_probabilities?.[altEdgeKey]) ||
                                !!(uploadedData?.interval?.edge_probabilities?.[edgeKey]) ||
                                !!(uploadedData?.interval?.edge_probabilities?.[altEdgeKey]) ||
                                !!(uploadedData?.pbox?.edge_probabilities?.[edgeKey]) ||
                                !!(uploadedData?.pbox?.edge_probabilities?.[altEdgeKey]);
    
    // Get edge probabilities from uploaded data (prioritize uploaded data over legacy)
    const probability = uploadedData?.float?.edge_probabilities?.[edgeKey] ||
                       uploadedData?.float?.edge_probabilities?.[altEdgeKey] ||
                       uploadedData?.interval?.edge_probabilities?.[edgeKey] ||
                       uploadedData?.interval?.edge_probabilities?.[altEdgeKey] ||
                       uploadedData?.pbox?.edge_probabilities?.[edgeKey] ||
                       uploadedData?.pbox?.edge_probabilities?.[altEdgeKey] ||
                       rawData?.edge_probabilities?.[edgeKey] ||
                       rawData?.edge_probabilities?.[altEdgeKey];
    
    // Check for capacity data from uploaded data and analysis results
    const hasCapacityData = !!(uploadedData?.capacity?.capacities?.edges?.[edgeKey]) ||
                           !!(uploadedData?.capacity?.capacities?.edges?.[altEdgeKey]) ||
                           this.hasCapacityDataForEdge(sourceId, targetId, rawData);
    const capacity = uploadedData?.capacity?.capacities?.edges?.[edgeKey] ||
                    uploadedData?.capacity?.capacities?.edges?.[altEdgeKey] ||
                    this.extractEdgeCapacity(sourceId, targetId, rawData);
    
    // Check for CPM data from uploaded data and analysis results
    const hasCpmData = !!(uploadedData?.cpm?.cmp_data) ||
                      this.hasCpmDataForEdge(sourceId, targetId, rawData);
    const delay = this.extractEdgeDelay(sourceId, targetId, rawData);
    const cost = this.extractEdgeCost(sourceId, targetId, rawData);
    
    // Check for flow data from analysis results
    const hasFlowData = this.hasFlowDataForEdge(sourceId, targetId, rawData);
    const flow = this.extractEdgeFlow(sourceId, targetId, rawData);
    const utilization = this.calculateEdgeUtilization(flow, capacity);
    
    return {
      hasLinkProbabilities,
      probability,
      hasCapacityData,
      capacity,
      hasCpmData,
      delay,
      cost,
      hasFlowData,
      flow,
      utilization,
      additionalMetrics: this.extractAdditionalEdgeMetrics(sourceId, targetId, rawData),
      // NEW: Include uploaded data for raw data tab
      uploadedEdgeData: this.extractUploadedEdgeData(sourceId, targetId, uploadedData)
    };
  }

  // Helper methods
  private getDirectParents(nodeId: number, networkData: NetworkStructure): number[] {
    return networkData.edges
      .filter(([_, target]) => target === nodeId)
      .map(([source, _]) => source);
  }

  private getDirectChildren(nodeId: number, networkData: NetworkStructure): number[] {
    return networkData.edges
      .filter(([source, _]) => source === nodeId)
      .map(([_, target]) => target);
  }

  private getNodeTypes(nodeId: number, networkData: NetworkStructure): string[] {
    const types: string[] = [];
    if (networkData.source_nodes.includes(nodeId)) types.push('Source');
    if (networkData.sink_nodes.includes(nodeId)) types.push('Sink');
    if (networkData.fork_nodes.includes(nodeId)) types.push('Fork');
    if (networkData.join_nodes.includes(nodeId)) types.push('Join');
    return types.length > 0 ? types : ['Regular'];
  }

  private getPrimaryNodeType(nodeId: number, networkData: NetworkStructure): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    if (networkData.source_nodes.includes(nodeId)) return 'source';
    if (networkData.sink_nodes.includes(nodeId)) return 'sink';
    if (networkData.fork_nodes.includes(nodeId)) return 'fork';
    if (networkData.join_nodes.includes(nodeId)) return 'join';
    return 'regular';
  }

  private getNodeIterationSets(nodeId: number, networkData: NetworkStructure): number[] {
    return networkData.iteration_sets
      .map((set, index) => ({ set, index }))
      .filter(({ set }) => set.includes(nodeId))
      .map(({ index }) => index + 1);
  }

  private getEdgeType(sourceId: number, targetId: number, sourceType: string, targetType: string): string {
    if (sourceType.includes('Source')) return `Source → ${targetType}`;
    if (targetType.includes('Sink')) return `${sourceType} → Sink`;
    if (sourceType.includes('Fork')) return `Fork → ${targetType}`;
    if (targetType.includes('Join')) return `${sourceType} → Join`;
    return 'Regular';
  }

  private calculateBottleneckScore(nodeId: number, networkData: NetworkStructure): number {
    const inDegree = this.getDirectParents(nodeId, networkData).length;
    const outDegree = this.getDirectChildren(nodeId, networkData).length;
    
    if (inDegree === 0 || outDegree === 0) return 0;
    
    const ratio = Math.min(inDegree, outDegree) / Math.max(inDegree, outDegree);
    return 1 - ratio; // Higher score means more bottleneck-like
  }

  private calculateHubScore(nodeId: number, networkData: NetworkStructure): number {
    const totalDegree = this.getDirectParents(nodeId, networkData).length + 
                       this.getDirectChildren(nodeId, networkData).length;
    
    const allDegrees = networkData.nodes.map(nId => {
      const inD = this.getDirectParents(nId, networkData).length;
      const outD = this.getDirectChildren(nId, networkData).length;
      return inD + outD;
    });
    
    const maxDegree = Math.max(...allDegrees);
    return maxDegree > 0 ? totalDegree / maxDegree : 0;
  }

  private calculateBridgeScore(nodeId: number, networkData: NetworkStructure): number {
    const inDegree = this.getDirectParents(nodeId, networkData).length;
    const outDegree = this.getDirectChildren(nodeId, networkData).length;
    
    // Perfect bridge has exactly 1 in and 1 out
    if (inDegree === 1 && outDegree === 1) return 1.0;
    
    // Partial bridge score based on how close to 1-1 connection
    const bridgeness = 1 / (Math.abs(inDegree - 1) + Math.abs(outDegree - 1) + 1);
    return bridgeness;
  }

  private calculateFlowImportance(sourceId: number, targetId: number, networkData: NetworkStructure): 'high' | 'medium' | 'low' {
    const sourceOutDegree = this.getDirectChildren(sourceId, networkData).length;
    const targetInDegree = this.getDirectParents(targetId, networkData).length;
    
    if (sourceOutDegree === 1 || targetInDegree === 1) return 'high';
    if (sourceOutDegree <= 3 || targetInDegree <= 3) return 'medium';
    return 'low';
  }

  private calculateTopologicalImportance(sourceId: number, targetId: number, networkData: NetworkStructure): 'high' | 'medium' | 'low' {
    const sourceIterations = this.getNodeIterationSets(sourceId, networkData);
    const targetIterations = this.getNodeIterationSets(targetId, networkData);
    
    const iterationGap = Math.abs((targetIterations[0] || 0) - (sourceIterations[0] || 0));
    
    if (iterationGap <= 1) return 'high';
    if (iterationGap <= 3) return 'medium';
    return 'low';
  }

  private calculateStructuralRole(sourceId: number, targetId: number, networkData: NetworkStructure): 'bridge' | 'redundant' | 'critical' | 'normal' {
    const sourceOutDegree = this.getDirectChildren(sourceId, networkData).length;
    const targetInDegree = this.getDirectParents(targetId, networkData).length;
    
    if (sourceOutDegree === 1 && targetInDegree === 1) return 'bridge';
    if (sourceOutDegree === 1 || targetInDegree === 1) return 'critical';
    if (sourceOutDegree > 3 && targetInDegree > 3) return 'redundant';
    return 'normal';
  }

  private findRelatedEdges(sourceId: number, targetId: number, networkData: NetworkStructure): any[] {
    const related: any[] = [];
    
    // Find parallel edges (same source, different targets)
    const sourceEdges = networkData.edges.filter(([s, t]) => s === sourceId && t !== targetId);
    sourceEdges.forEach(([s, t]) => {
      related.push({ sourceId: s, targetId: t, relationship: 'parallel' });
    });
    
    // Find series edges (target becomes source)
    const seriesEdges = networkData.edges.filter(([s, t]) => s === targetId);
    seriesEdges.forEach(([s, t]) => {
      related.push({ sourceId: s, targetId: t, relationship: 'series' });
    });
    
    return related.slice(0, 10); // Limit to prevent UI overload
  }

  // Cache management methods
  private generateNetworkHash(networkData: NetworkStructure): string {
    const hashInput = `${networkData.total_nodes}_${networkData.total_edges}_${networkData.computation_time}`;
    return btoa(hashInput).substring(0, 16);
  }

  private cacheNodeData(key: string, data: NodeDialogData): void {
    if (this.nodeCache.size >= this.cacheConfig.maxEntries) {
      this.evictLeastUsedCache(this.nodeCache);
    }
    
    this.nodeCache.set(key, {
      data,
      timestamp: Date.now(),
      networkHash: this.networkHash(),
      accessCount: 1
    });
  }

  private cacheEdgeData(key: string, data: EdgeDialogData): void {
    if (this.edgeCache.size >= this.cacheConfig.maxEntries) {
      this.evictLeastUsedCache(this.edgeCache);
    }
    
    this.edgeCache.set(key, {
      data,
      timestamp: Date.now(),
      networkHash: this.networkHash(),
      accessCount: 1
    });
  }

  private isCacheValid<T>(entry: DialogCacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.cacheConfig.ttl &&
           entry.networkHash === this.networkHash();
  }

  private evictLeastUsedCache<T>(cache: Map<string, DialogCacheEntry<T>>): void {
    let leastUsedKey = '';
    let leastAccessCount = Infinity;
    
    for (const [key, entry] of cache.entries()) {
      if (entry.accessCount < leastAccessCount) {
        leastAccessCount = entry.accessCount;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      cache.delete(leastUsedKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    // Cleanup node cache
    for (const [key, entry] of this.nodeCache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.nodeCache.delete(key);
      }
    }
    
    // Cleanup edge cache
    for (const [key, entry] of this.edgeCache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.edgeCache.delete(key);
      }
    }
    
    // Cleanup ancestor/descendant cache
    this.ancestorCache.clear();
    this.descendantCache.clear();
  }

  private clearCache(): void {
    this.nodeCache.clear();
    this.edgeCache.clear();
    this.ancestorCache.clear();
    this.descendantCache.clear();
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig(): DialogPerformanceConfig {
    return { ...this.performanceConfig };
  }

  /**
   * Update performance configuration
   */
  updatePerformanceConfig(config: Partial<DialogPerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...config };
  }

  // Enhanced analysis methods for critical path and structural analysis

  /**
   * Identify critical path nodes for a given node
   */
  private identifyCriticalPathNodes(nodeId: number, networkData: NetworkStructure): number[] {
    const ancestors = networkData.ancestors[nodeId.toString()] || [];
    const descendants = networkData.descendants[nodeId.toString()] || [];
    
    // Find nodes that are on the longest paths through this node
    const criticalNodes: number[] = [];
    
    // Add nodes that have the maximum path length to this node
    const maxAncestorDepth = this.calculateMaxDepthFromSources(nodeId, networkData);
    ancestors.forEach(ancestorId => {
      const depth = this.calculateMaxDepthFromSources(ancestorId, networkData);
      if (depth >= maxAncestorDepth - 1) {
        criticalNodes.push(ancestorId);
      }
    });
    
    // Add nodes that have the maximum path length from this node
    const maxDescendantDepth = this.calculateMaxDepthToSinks(nodeId, networkData);
    descendants.forEach(descendantId => {
      const depth = this.calculateMaxDepthToSinks(descendantId, networkData);
      if (depth >= maxDescendantDepth - 1) {
        criticalNodes.push(descendantId);
      }
    });
    
    return [...new Set(criticalNodes)].sort((a, b) => a - b);
  }

  /**
   * Check if an edge is on a critical path
   */
  private isEdgeOnCriticalPath(sourceId: number, targetId: number, networkData: NetworkStructure): boolean {
    // An edge is critical if removing it would increase the longest path length
    const sourceDepth = this.calculateMaxDepthFromSources(sourceId, networkData);
    const targetDepth = this.calculateMaxDepthFromSources(targetId, networkData);
    
    // Edge is critical if target depth is exactly source depth + 1 and both are on longest paths
    return targetDepth === sourceDepth + 1;
  }

  /**
   * Calculate maximum depth from sources to a node with cycle detection
   */
  private calculateMaxDepthFromSources(nodeId: number, networkData: NetworkStructure, memo: Map<number, number> = new Map(), recursionStack: Set<number> = new Set()): number {
    // Validate nodeId parameter
    if (nodeId === null || nodeId === undefined || isNaN(nodeId)) {
      console.error('🚨 [NetworkDialogService] Invalid nodeId in calculateMaxDepthFromSources:', nodeId);
      return 0;
    }

    // Convert to number if it's somehow not a number
    const validNodeId = typeof nodeId === 'number' ? nodeId : parseInt(String(nodeId), 10);
    if (isNaN(validNodeId)) {
      console.error('🚨 [NetworkDialogService] Could not convert nodeId to number:', nodeId);
      return 0;
    }

    // Return memoized result if available (before cycle check to avoid redundant work)
    if (memo.has(validNodeId)) {
      return memo.get(validNodeId)!;
    }

    // Check for actual cycles (only during current recursion path)
    if (recursionStack.has(validNodeId)) {
      // Cycle detected - return 0 and don't memoize to avoid infinite loops
      return 0;
    }

    // Source nodes have depth 0
    if (networkData.source_nodes.includes(validNodeId)) {
      memo.set(validNodeId, 0);
      return 0;
    }
    
    const ancestors = networkData.ancestors[validNodeId.toString()] || [];
    if (ancestors.length === 0) {
      memo.set(validNodeId, 0);
      return 0;
    }
    
    // Add current node to recursion stack
    recursionStack.add(validNodeId);
    
    let maxDepth = 0;
    try {
      ancestors.forEach(ancestorId => {
        // Validate ancestorId
        const validAncestorId = typeof ancestorId === 'number' ? ancestorId : parseInt(String(ancestorId), 10);
        if (!isNaN(validAncestorId)) {
          const depth = this.calculateMaxDepthFromSources(validAncestorId, networkData, memo, recursionStack) + 1;
          maxDepth = Math.max(maxDepth, depth);
        }
      });
    } finally {
      // Always remove from recursion stack, even if an error occurs
      recursionStack.delete(validNodeId);
    }
    
    // Memoize result
    recursionStack.delete(validNodeId);
    memo.set(validNodeId, maxDepth);
    
    return maxDepth;
  }

  /**
   * Calculate maximum depth from a node to sinks with cycle detection
   */
  private calculateMaxDepthToSinks(nodeId: number, networkData: NetworkStructure, memo: Map<number, number> = new Map(), recursionStack: Set<number> = new Set()): number {
    // Validate nodeId parameter
    if (nodeId === null || nodeId === undefined || isNaN(nodeId)) {
      console.error('🚨 [NetworkDialogService] Invalid nodeId in calculateMaxDepthToSinks:', nodeId);
      return 0;
    }

    // Convert to number if it's somehow not a number
    const validNodeId = typeof nodeId === 'number' ? nodeId : parseInt(String(nodeId), 10);
    if (isNaN(validNodeId)) {
      console.error('🚨 [NetworkDialogService] Could not convert nodeId to number:', nodeId);
      return 0;
    }

    // Return memoized result if available (before cycle check to avoid redundant work)
    if (memo.has(validNodeId)) {
      return memo.get(validNodeId)!;
    }

    // Check for actual cycles (only during current recursion path)
    if (recursionStack.has(validNodeId)) {
      // Cycle detected - return 0 and don't memoize to avoid infinite loops
      return 0;
    }

    // Sink nodes have depth 0
    if (networkData.sink_nodes.includes(validNodeId)) {
      memo.set(validNodeId, 0);
      return 0;
    }
    
    const descendants = networkData.descendants[validNodeId.toString()] || [];
    if (descendants.length === 0) {
      memo.set(validNodeId, 0);
      return 0;
    }
    
    // Add current node to recursion stack
    recursionStack.add(validNodeId);
    
    let maxDepth = 0;
    try {
      descendants.forEach(descendantId => {
        // Validate descendantId
        const validDescendantId = typeof descendantId === 'number' ? descendantId : parseInt(String(descendantId), 10);
        if (!isNaN(validDescendantId)) {
          const depth = this.calculateMaxDepthToSinks(validDescendantId, networkData, memo, recursionStack) + 1;
          maxDepth = Math.max(maxDepth, depth);
        }
      });
    } finally {
      // Always remove from recursion stack, even if an error occurs
      recursionStack.delete(validNodeId);
    }
    
    // Memoize result
    memo.set(validNodeId, maxDepth);
    
    return maxDepth;
  }

  // Raw data extraction methods for backend integration

  private hasCapacityDataForNode(nodeId: number, rawData: any): boolean {
    return !!(rawData?.capacity_analysis?.node_capacities?.[nodeId.toString()] ||
              rawData?.capacity_scenarios?.some((scenario: any) =>
                scenario.raw_capacity_result?.node_max_flows?.[nodeId.toString()]));
  }

  private extractNodeCapacity(nodeId: number, rawData: any): number | undefined {
    const nodeKey = nodeId.toString();
    
    // Try capacity analysis first
    if (rawData?.capacity_analysis?.node_capacities?.[nodeKey]) {
      return rawData.capacity_analysis.node_capacities[nodeKey];
    }
    
    // Try capacity scenarios
    for (const scenario of rawData?.capacity_scenarios || []) {
      const maxFlow = scenario.raw_capacity_result?.node_max_flows?.[nodeKey];
      if (maxFlow !== undefined) return maxFlow;
    }
    
    return undefined;
  }

  private hasCpmDataForNode(nodeId: number, rawData: any): boolean {
    return !!(rawData?.cpm_scenarios?.some((scenario: any) =>
      scenario.time_result?.node_values?.[nodeId.toString()] !== undefined ||
      scenario.cost_result?.node_values?.[nodeId.toString()] !== undefined));
  }

  private extractNodeDuration(nodeId: number, rawData: any): number | undefined {
    const nodeKey = nodeId.toString();
    
    for (const scenario of rawData?.cpm_scenarios || []) {
      const duration = scenario.time_result?.node_values?.[nodeKey];
      if (duration !== undefined) return duration;
    }
    
    return undefined;
  }

  private extractNodeCost(nodeId: number, rawData: any): number | undefined {
    const nodeKey = nodeId.toString();
    
    for (const scenario of rawData?.cpm_scenarios || []) {
      const cost = scenario.cost_result?.node_values?.[nodeKey];
      if (cost !== undefined) return cost;
    }
    
    return undefined;
  }

  private hasFlowDataForNode(nodeId: number, rawData: any): boolean {
    return this.hasCapacityDataForNode(nodeId, rawData);
  }

  private extractNodeMaxFlow(nodeId: number, rawData: any): number | undefined {
    return this.extractNodeCapacity(nodeId, rawData);
  }

  private extractAdditionalNodeMetrics(nodeId: number, rawData: any): Record<string, any> | undefined {
    const metrics: Record<string, any> = {};
    const nodeKey = nodeId.toString();
    
    // Extract belief values from reachability scenarios
    if (rawData?.reachability_scenarios) {
      Object.entries(rawData.reachability_scenarios).forEach(([scenarioName, scenario]: [string, any]) => {
        const belief = scenario.exact_inference?.beliefs?.[nodeKey];
        if (belief !== undefined) {
          metrics[`belief_${scenarioName}`] = belief;
        }
      });
    }
    
    // Extract diamond analysis data
    if (rawData?.diamond_analysis) {
      const isInDiamond = Object.values(rawData.diamond_analysis.raw_root_diamonds || {})
        .some((diamond: any) => diamond.diamond?.relevant_nodes?.includes(nodeId));
      if (isInDiamond) {
        metrics['isInDiamond'] = true;
      }
    }
    
    return Object.keys(metrics).length > 0 ? metrics : undefined;
  }

  // Edge raw data extraction methods

  private hasCapacityDataForEdge(sourceId: number, targetId: number, rawData: any): boolean {
    // Check if edge has capacity constraints or flow data
    return !!(rawData?.capacity_scenarios?.some((scenario: any) =>
      scenario.raw_capacity_result?.bottlenecks?.[`${sourceId}_${targetId}`]));
  }

  private extractEdgeCapacity(sourceId: number, targetId: number, rawData: any): number | undefined {
    // Extract edge capacity from capacity analysis
    const edgeKey = `${sourceId}_${targetId}`;
    
    for (const scenario of rawData?.capacity_scenarios || []) {
      const bottleneck = scenario.raw_capacity_result?.bottlenecks?.[edgeKey];
      if (bottleneck !== undefined) return bottleneck;
    }
    
    return undefined;
  }

  private hasCpmDataForEdge(sourceId: number, targetId: number, rawData: any): boolean {
    // Check if edge has CPM delay or cost data
    return !!(rawData?.cpm_scenarios?.some((scenario: any) =>
      scenario.edge_delays?.[`${sourceId}_${targetId}`] !== undefined ||
      scenario.edge_costs?.[`${sourceId}_${targetId}`] !== undefined));
  }

  private extractEdgeDelay(sourceId: number, targetId: number, rawData: any): number | undefined {
    const edgeKey = `${sourceId}_${targetId}`;
    
    for (const scenario of rawData?.cmp_scenarios || []) {
      const delay = scenario.edge_delays?.[edgeKey];
      if (delay !== undefined) return delay;
    }
    
    return undefined;
  }

  private extractEdgeCost(sourceId: number, targetId: number, rawData: any): number | undefined {
    const edgeKey = `${sourceId}_${targetId}`;
    
    for (const scenario of rawData?.cmp_scenarios || []) {
      const cost = scenario.edge_costs?.[edgeKey];
      if (cost !== undefined) return cost;
    }
    
    return undefined;
  }

  private hasFlowDataForEdge(sourceId: number, targetId: number, rawData: any): boolean {
    return this.hasCapacityDataForEdge(sourceId, targetId, rawData);
  }

  private extractEdgeFlow(sourceId: number, targetId: number, rawData: any): number | undefined {
    // Extract actual flow through edge from capacity analysis
    const edgeKey = `${sourceId}_${targetId}`;
    
    for (const scenario of rawData?.capacity_scenarios || []) {
      const flow = scenario.raw_capacity_result?.edge_flows?.[edgeKey];
      if (flow !== undefined) return flow;
    }
    
    return undefined;
  }

  private calculateEdgeUtilization(flow?: number, capacity?: number): number | undefined {
    if (flow !== undefined && capacity !== undefined && capacity > 0) {
      return flow / capacity;
    }
    return undefined;
  }

  private extractAdditionalEdgeMetrics(sourceId: number, targetId: number, rawData: any): Record<string, any> | undefined {
    const metrics: Record<string, any> = {};
    const edgeKey = `${sourceId}_${targetId}`;
    
    // Extract critical path information
    if (rawData?.capacity_scenarios) {
      rawData.capacity_scenarios.forEach((scenario: any, index: number) => {
        const criticalPaths = scenario.raw_capacity_result?.critical_paths;
        if (criticalPaths) {
          Object.entries(criticalPaths).forEach(([target, paths]: [string, any]) => {
            if (Array.isArray(paths)) {
              const isOnCriticalPath = paths.some((path: number[]) => {
                for (let i = 0; i < path.length - 1; i++) {
                  if (path[i] === sourceId && path[i + 1] === targetId) {
                    return true;
                  }
                }
                return false;
              });
              if (isOnCriticalPath) {
                metrics[`critical_path_scenario_${index}`] = true;
              }
            }
          });
        }
      });
    }
    
    return Object.keys(metrics).length > 0 ? metrics : undefined;
  }

  /**
   * Extract uploaded node data for raw data display
   */
  private extractUploadedNodeData(nodeId: number, uploadedData: any): any {
    if (!uploadedData) return undefined;
    
    const nodeKey = nodeId.toString();
    const result: any = {};
    
    // Extract float data
    if (uploadedData.float?.node_priors?.[nodeKey] !== undefined) {
      result.float = uploadedData.float.node_priors[nodeKey];
    }
    
    // Extract interval data
    if (uploadedData.interval?.node_priors?.[nodeKey] !== undefined) {
      result.interval = uploadedData.interval.node_priors[nodeKey];
    }
    
    // Extract pbox data
    if (uploadedData.pbox?.node_priors?.[nodeKey] !== undefined) {
      result.pbox = uploadedData.pbox.node_priors[nodeKey];
    }
    
    // Extract capacity data
    if (uploadedData.capacity?.capacities?.nodes?.[nodeKey] !== undefined) {
      result.capacity = uploadedData.capacity.capacities.nodes[nodeKey];
    }
    
    // Extract CPM data
    if (uploadedData.cpm?.cmp_data) {
      result.cpm = uploadedData.cmp_data;
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Extract uploaded edge data for raw data display
   */
  private extractUploadedEdgeData(sourceId: number, targetId: number, uploadedData: any): any {
    if (!uploadedData) return undefined;
    
    const edgeKey = `${sourceId}_${targetId}`;
    const altEdgeKey = `${sourceId}->${targetId}`;
    const result: any = {};
    
    // Extract float data
    const floatProb = uploadedData.float?.edge_probabilities?.[edgeKey] ||
                     uploadedData.float?.edge_probabilities?.[altEdgeKey];
    if (floatProb !== undefined) {
      result.float = floatProb;
    }
    
    // Extract interval data
    const intervalProb = uploadedData.interval?.edge_probabilities?.[edgeKey] ||
                        uploadedData.interval?.edge_probabilities?.[altEdgeKey];
    if (intervalProb !== undefined) {
      result.interval = intervalProb;
    }
    
    // Extract pbox data
    const pboxProb = uploadedData.pbox?.edge_probabilities?.[edgeKey] ||
                    uploadedData.pbox?.edge_probabilities?.[altEdgeKey];
    if (pboxProb !== undefined) {
      result.pbox = pboxProb;
    }
    
    // Extract capacity data
    const capacity = uploadedData.capacity?.capacities?.edges?.[edgeKey] ||
                    uploadedData.capacity?.capacities?.edges?.[altEdgeKey];
    if (capacity !== undefined) {
      result.capacity = capacity;
    }
    
    // Extract CPM data
    if (uploadedData.cpm?.cmp_data) {
      result.cmp = uploadedData.cmp_data;
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  }
}