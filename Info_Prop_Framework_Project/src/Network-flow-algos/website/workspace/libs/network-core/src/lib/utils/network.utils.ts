import { NetworkNode, NetworkEdge } from '../models/network.models';

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export class NetworkUtils {
  /**
   * Validates network data structure
   */
  static validateNetworkData(data: any): data is NetworkData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return false;
    }

    // Validate nodes
    for (const node of data.nodes) {
      if (!node.id || typeof node.id !== 'string') {
        return false;
      }
    }

    // Validate edges
    for (const edge of data.edges) {
      if (!edge.id || !edge.source || !edge.target) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculates basic network statistics
   */
  static calculateNetworkStats(data: NetworkData) {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;
    
    // Calculate degree distribution
    const degrees = new Map<string, number>();
    data.nodes.forEach(node => degrees.set(node.id, 0));
    
    data.edges.forEach(edge => {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    });

    const degreeValues = Array.from(degrees.values());
    const avgDegree = degreeValues.reduce((sum, deg) => sum + deg, 0) / nodeCount;
    const maxDegree = Math.max(...degreeValues);
    const minDegree = Math.min(...degreeValues);

    return {
      nodeCount,
      edgeCount,
      avgDegree: Math.round(avgDegree * 100) / 100,
      maxDegree,
      minDegree,
      density: (2 * edgeCount) / (nodeCount * (nodeCount - 1))
    };
  }

  /**
   * Generates random network data for testing
   */
  static generateRandomNetwork(nodeCount: number, edgeCount: number): NetworkData {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];

    // Generate nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node_${i}`,
        label: `Node ${i}`,
        x: Math.random() * 100,
        y: Math.random() * 100,
        metadata: {
          size: Math.random() * 10 + 5,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`
        }
      });
    }

    // Generate edges
    const edgeSet = new Set<string>();
    for (let i = 0; i < edgeCount; i++) {
      let source: string, target: string, edgeKey: string;
      
      do {
        source = `node_${Math.floor(Math.random() * nodeCount)}`;
        target = `node_${Math.floor(Math.random() * nodeCount)}`;
        edgeKey = `${source}-${target}`;
      } while (source === target || edgeSet.has(edgeKey));

      edgeSet.add(edgeKey);
      edges.push({
        id: `edge_${i}`,
        source,
        target,
        weight: Math.random(),
        metadata: {
          color: '#999'
        }
      });
    }

    return { nodes, edges };
  }

  /**
   * Formats file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Debounce function for performance optimization
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Deep clone object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => NetworkUtils.deepClone(item)) as unknown as T;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = NetworkUtils.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
}