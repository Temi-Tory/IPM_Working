import { BeliefValue } from '../models/network-analysis.models';

/**
 * Performance-optimized data structures for dialog components
 * Designed to handle large DAGs (1000+ nodes) efficiently
 */

export interface NodeConnectivityInfo {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  directParents: number[];
  directChildren: number[];
  // Paginated for performance with large lists
  ancestorCount: number;
  descendantCount: number;
  // Only load full lists when needed
  ancestors?: number[];
  descendants?: number[];
}

export interface NodeTopologyInfo {
  iterationSets: number[];
  topologicalLevel: number;
  criticalPathNodes: number[];
  bottleneckScore: number;
  hubScore: number;
  bridgeScore: number;
}

export interface NodeClassificationInfo {
  primaryType: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  allTypes: string[];
  isMultiType: boolean;
  specialClassifications: {
    isHub: boolean;
    isBridge: boolean;
    isBottleneck: boolean;
    isCriticalPath: boolean;
    isOrphan: boolean;
  };
}

export interface NodeRawDataInfo {
  hasNodePriors: boolean;
  nodePriors?: BeliefValue;
  hasCapacityData: boolean;
  capacity?: number;
  hasCpmData: boolean;
  duration?: number;
  cost?: number;
  hasFlowData: boolean;
  maxFlow?: number;
  additionalMetrics?: Record<string, any>;
  // NEW: Uploaded data for raw data tab
  uploadedNodeData?: {
    float?: number;
    interval?: { lower: number; upper: number };
    pbox?: any;
    capacity?: number;
    cpm?: any;
  };
}

export interface NodeDialogData {
  // Basic Information
  nodeId: number;
  displayName: string;
  
  // Connectivity (optimized for large networks)
  connectivity: NodeConnectivityInfo;
  
  // Topology Analysis
  topology: NodeTopologyInfo;
  
  // Classifications
  classification: NodeClassificationInfo;
  
  // Raw Data (lazy-loaded)
  rawData: NodeRawDataInfo;
  
  // Performance metadata
  metadata: {
    networkSize: number;
    loadTime: number;
    cacheKey: string;
  };
}

export interface EdgeConnectionInfo {
  sourceNodeId: number;
  targetNodeId: number;
  sourceType: string;
  targetType: string;
  edgeType: string;
  connectionStrength: number; // Based on degrees and network position
}

export interface EdgeClassificationInfo {
  isCriticalPath: boolean;
  isBottleneck: boolean;
  flowImportance: 'high' | 'medium' | 'low';
  topologicalImportance: 'high' | 'medium' | 'low';
  structuralRole: 'bridge' | 'redundant' | 'critical' | 'normal';
}

export interface EdgeRawDataInfo {
  hasLinkProbabilities: boolean;
  probability?: number;
  hasCapacityData: boolean;
  capacity?: number;
  hasCpmData: boolean;
  delay?: number;
  cost?: number;
  hasFlowData: boolean;
  flow?: number;
  utilization?: number;
  additionalMetrics?: Record<string, any>;
  // NEW: Uploaded data for raw data tab
  uploadedEdgeData?: {
    float?: number;
    interval?: { lower: number; upper: number };
    pbox?: any;
    capacity?: number;
    cpm?: any;
  };
}

export interface EdgeDialogData {
  // Connection Information
  connection: EdgeConnectionInfo;
  
  // Classifications
  classification: EdgeClassificationInfo;
  
  // Raw Data (lazy-loaded)
  rawData: EdgeRawDataInfo;
  
  // Navigation helpers
  navigation: {
    canNavigateToSource: boolean;
    canNavigateToTarget: boolean;
    relatedEdges: {
      sourceId: number;
      targetId: number;
      relationship: 'parallel' | 'series' | 'alternative';
    }[];
  };
  
  // Performance metadata
  metadata: {
    networkSize: number;
    loadTime: number;
    cacheKey: string;
  };
}

/**
 * Dialog configuration interfaces
 */
export interface DialogDisplayOptions {
  showRawData: boolean;
  enableVirtualScrolling: boolean;
  maxListItems: number;
  enableCaching: boolean;
  responsiveBreakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface DialogPerformanceConfig {
  virtualScrollingThreshold: number; // Start virtual scrolling when list > this size
  cacheTimeout: number; // Cache timeout in milliseconds
  lazyLoadThreshold: number; // Lazy load when network > this size
  maxConcurrentRequests: number;
}

/**
 * Virtual scrolling interfaces for large lists
 */
export interface VirtualScrollItem {
  id: number;
  displayText: string;
  metadata?: any;
}

export interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize: number;
  viewportHeight: number;
  totalItems: number;
}

/**
 * Cache interfaces for performance optimization
 */
export interface DialogCacheEntry<T> {
  data: T;
  timestamp: number;
  networkHash: string;
  accessCount: number;
}

export interface DialogCacheConfig {
  maxEntries: number;
  ttl: number; // Time to live in milliseconds
  cleanupInterval: number;
}

/**
 * Responsive design interfaces
 */
export interface ResponsiveDialogConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  layouts: {
    mobile: DialogLayoutConfig;
    tablet: DialogLayoutConfig;
    desktop: DialogLayoutConfig;
  };
}

export interface DialogLayoutConfig {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  tabOrientation: 'horizontal' | 'vertical';
  showFullLists: boolean;
  compactMode: boolean;
}

/**
 * Event interfaces for dialog interactions
 */
export interface NodeDialogEvent {
  type: 'navigate' | 'expand' | 'filter' | 'export';
  nodeId: number;
  data?: any;
}

export interface EdgeDialogEvent {
  type: 'navigate' | 'expand' | 'filter' | 'export';
  sourceId: number;
  targetId: number;
  data?: any;
}

/**
 * Export interfaces for data sharing
 */
export interface DialogExportData {
  type: 'node' | 'edge';
  format: 'json' | 'csv' | 'txt';
  data: NodeDialogData | EdgeDialogData;
  timestamp: string;
  networkName: string;
}