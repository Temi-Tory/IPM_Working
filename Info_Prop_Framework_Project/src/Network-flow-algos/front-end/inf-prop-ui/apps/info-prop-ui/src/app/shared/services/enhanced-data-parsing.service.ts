import { Injectable } from '@angular/core';
import { 
  NetworkStructure, 
  EnhancedNetworkStructure,
  IntervalData,
  PboxData
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class EnhancedDataParsingService {

  /**
   * Create fast lookup structure for UI components
   * This allows quick access to node/edge data without iterating through arrays
   */
  createFastLookupStructure(
    networkStructure: NetworkStructure,
    parsedData?: any
  ): EnhancedNetworkStructure {
    const node_lookup: any = {};
    const edge_lookup: any = {};
    
    // Build node lookup with type information and data from all scenarios
    networkStructure.nodes.forEach(nodeId => {
      const nodeKey = String(nodeId);
      node_lookup[nodeKey] = {
        type: this.getNodeType(nodeId, networkStructure),
        float_prior: parsedData?.float?.node_priors?.[nodeKey],
        interval_prior: parsedData?.interval?.node_priors?.[nodeKey],
        pbox_prior: parsedData?.pbox?.node_priors?.[nodeKey],
        capacity: parsedData?.capacity?.capacities?.nodes?.[nodeKey]
      };
    });
    
    // Build edge lookup - KEEP ORIGINAL "(source,target)" FORMAT!
    networkStructure.edges.forEach(([source, target]) => {
      const edgeKey = `(${source},${target})`; // Keep this format for consistency!
      edge_lookup[edgeKey] = {
        float_probability: parsedData?.float?.edge_probabilities?.[edgeKey],
        interval_probability: parsedData?.interval?.edge_probabilities?.[edgeKey],
        pbox_probability: parsedData?.pbox?.edge_probabilities?.[edgeKey],
        capacity: parsedData?.capacity?.capacities?.edges?.[edgeKey]
      };
    });
    
    return {
      ...networkStructure,
      node_lookup,
      edge_lookup
    };
  }

  /**
   * Get node type based on network structure
   */
  private getNodeType(nodeId: number, structure: NetworkStructure): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    if (structure.source_nodes.includes(nodeId)) return 'source';
    if (structure.sink_nodes.includes(nodeId)) return 'sink';
    if (structure.fork_nodes.includes(nodeId)) return 'fork';
    if (structure.join_nodes.includes(nodeId)) return 'join';
    return 'regular';
  }

  /**
   * Quick lookup methods for UI components
   */
  getNodePrior(
    enhancedStructure: EnhancedNetworkStructure, 
    nodeId: number, 
    dataType: 'float' | 'interval' | 'pbox'
  ): number | IntervalData | PboxData | undefined {
    const nodeKey = String(nodeId);
    const node = enhancedStructure.node_lookup[nodeKey];
    
    if (!node) return undefined;
    
    switch(dataType) {
      case 'float': return node.float_prior;
      case 'interval': return node.interval_prior;
      case 'pbox': return node.pbox_prior;
    }
  }

  getEdgeProbability(
    enhancedStructure: EnhancedNetworkStructure, 
    source: number, 
    target: number, 
    dataType: 'float' | 'interval' | 'pbox'
  ): number | IntervalData | PboxData | undefined {
    const edgeKey = `(${source},${target})`; // Use correct format!
    const edge = enhancedStructure.edge_lookup[edgeKey];
    
    if (!edge) return undefined;
    
    switch(dataType) {
      case 'float': return edge.float_probability;
      case 'interval': return edge.interval_probability;
      case 'pbox': return edge.pbox_probability;
    }
  }

  getNodeCapacity(enhancedStructure: EnhancedNetworkStructure, nodeId: number): number | undefined {
    const nodeKey = String(nodeId);
    return enhancedStructure.node_lookup[nodeKey]?.capacity;
  }

  getEdgeCapacity(enhancedStructure: EnhancedNetworkStructure, source: number, target: number): number | undefined {
    const edgeKey = `(${source},${target})`;
    return enhancedStructure.edge_lookup[edgeKey]?.capacity;
  }

  getNodeTypeFromStructure(enhancedStructure: EnhancedNetworkStructure, nodeId: number): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    const nodeKey = String(nodeId);
    return enhancedStructure.node_lookup[nodeKey]?.type || 'regular';
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(enhancedStructure: EnhancedNetworkStructure, type: 'source' | 'sink' | 'fork' | 'join' | 'regular'): number[] {
    return Object.entries(enhancedStructure.node_lookup)
      .filter(([_, nodeData]) => nodeData.type === type)
      .map(([nodeId, _]) => parseInt(nodeId));
  }

  /**
   * Get summary statistics for data availability
   */
  getDataSummary(enhancedStructure: EnhancedNetworkStructure): {
    nodes_with_float_priors: number;
    nodes_with_interval_priors: number;
    nodes_with_pbox_priors: number;
    edges_with_float_probabilities: number;
    edges_with_interval_probabilities: number;
    edges_with_pbox_probabilities: number;
    nodes_with_capacity: number;
    edges_with_capacity: number;
  } {
    const nodeEntries = Object.values(enhancedStructure.node_lookup);
    const edgeEntries = Object.values(enhancedStructure.edge_lookup);

    return {
      nodes_with_float_priors: nodeEntries.filter(n => n.float_prior !== undefined).length,
      nodes_with_interval_priors: nodeEntries.filter(n => n.interval_prior !== undefined).length,
      nodes_with_pbox_priors: nodeEntries.filter(n => n.pbox_prior !== undefined).length,
      edges_with_float_probabilities: edgeEntries.filter(e => e.float_probability !== undefined).length,
      edges_with_interval_probabilities: edgeEntries.filter(e => e.interval_probability !== undefined).length,
      edges_with_pbox_probabilities: edgeEntries.filter(e => e.pbox_probability !== undefined).length,
      nodes_with_capacity: nodeEntries.filter(n => n.capacity !== undefined).length,
      edges_with_capacity: edgeEntries.filter(e => e.capacity !== undefined).length
    };
  }
}