/**
 * Capacity Analysis Story Models
 * 
 * These interfaces represent the narrative that each level tells about capacity and bottlenecks.
 * Each level answers a different question aligned with the user's mental model.
 */

// ─── Raw Backend Response (from Float64 backend) ───────────────────────────
export interface RawCapacityResult {
  computation_time: number;
  network_utilization: number;
  total_source_input: number;
  total_target_output: number;
  active_sources?: number[];
  target_nodes?: number[];
  input_files?: string[] | { capacities_path: string };
  
  raw_capacity_result?: {
    node_max_flows: Record<string, number>;
    node_capacities: Record<string, number>;
    edge_utilization: Record<string, { capacity: number; flow: number; utilization: number; spare: number }>;
    source_rates?: Record<string, number>;
    target_flows?: Record<string, number>;
    bottlenecks?: Record<string, unknown>;
  };
}

// ─── Common Data Structures ───────────────────────────────────────────────
export interface NodeMetric {
  nodeId: number;
  capacity: number;
  flow: number;
  utilization: number;
  spare: number;
  nodeType: 'Source' | 'Sink' | 'Fork' | 'Join' | 'Regular';
  isBottleneck: boolean;
}

export interface EdgeMetric {
  edgeKey: string;
  from: number;
  to: number;
  capacity: number;
  flow: number;
  utilization: number;
  spare: number;
  isBottleneck: boolean;
}

export interface UpgradeRecommendation {
  target: 'node' | 'edge';
  id: string; // nodeId or edgeKey
  currentCapacity: number;
  currentUtilization: number;
  recommendedCapacity: number;
  percentIncrease: number;
  impactScore: number; // 0-100: how many downstream nodes benefit
  reason: string; // Why this upgrade helps
}

export interface WhatIfScenario {
  nodeId?: number;
  edgeKey?: string;
  newCapacity: number;
  projectedUtilization: number;
  affectedDownstream: number[]; // Nodes that see changed utilization
  overallNetworkUtilization: number;
}

// ─── Level 0: Health Summary (What story?) ───────────────────────────────
// Story Question: "Is this network healthy? What's the summary status?"
export interface Level0Story {
  isHealthy: boolean; // all utilization < 0.85 and no bottlenecks
  severity: 'good' | 'warning' | 'critical'; // critical = any edge > 0.95
  
  // Adaptive UI: show different detail based on network size
  networkSize: 'small' | 'medium' | 'large'; // <100, 100-1000, >1000 nodes
  
  // Core metrics
  maxUtilization: number; // highest node or edge
  bottleneckCount: number;
  
  // Rich summary (for small networks)
  observations?: Array<{
    icon: string;
    text: string;
    severity: 'info' | 'warning' | 'good';
  }>;
  
  // Quick stats (for any size)
  sourceInputTotal: number;
  sinkOutputTotal: number;
  avgUtilization: number;
}

// ─── Level 1: Bottleneck Explorer (Where's the problem?) ───────────────────
// Story Question: "Where are the bottlenecks? What's the pattern?"
export interface Level1Story {
  // Node type distribution
  nodeTypeStats: Array<{
    type: string;
    count: number;
    avgUtilization: number;
    icon: string;
  }>;
  
  // Bottleneck nodes/edges (full detail, sortable)
  bottleneckNodes: NodeMetric[];
  bottleneckEdges: EdgeMetric[];
  
  // Source → Sink narrative
  sourceFlowPaths: Array<{
    sourceId: number;
    targetSinks: Array<{
      sinkId: number;
      flowAmount: number;
      percentOfSourceOutput: number;
    }>;
    totalOutput: number;
    deliveryRatio: number;
  }>;
  
  // Sink summary (what's limiting each sink?)
  sinkSummary: Array<{
    sinkId: number;
    inputFlow: number;
    inputCapacity: number;
    utilization: number;
    sourceContributions: Array<{ sourceId: number; flow: number; percent: number }>;
  }>;
}

// ─── Level 2: Upgrade Planner (How to fix it?) ──────────────────────────────
// Story Question: "What upgrades would help? What's the priority order?"
export interface Level2Story {
  // Ranked upgrades (prioritized by impact)
  recommendations: UpgradeRecommendation[];
  
  // Current state metrics
  currentState: {
    networkUtilization: number;
    maxUtilization: number;
    bottleneckCount: number;
  };
  
  // What-if simulation results (from backend)
  whatIfResults?: {
    topUpgrade: UpgradeRecommendation;
    projectedNetworkUtilization: number;
    projectedMaxUtilization: number;
    projectedBottleneckCount: number;
  };
}

// ─── Level 3: Engineer Deep-Dive (Show everything) ──────────────────────────
// Story Question: "Give me all the details for validation and documentation"
export interface Level3Story {
  // Complete node and edge tables (for detailed inspection)
  allNodes: NodeMetric[];
  allEdges: EdgeMetric[];
  
  // Flow decomposition narrative
  flowDecomposition: {
    sources: Array<{
      nodeId: number;
      outputRate: number;
      flowDecomposition: Array<{
        pathToSink: string; // e.g., "3 → 11 → 27 → 50"
        flowAmount: number;
        percentOfSource: number;
      }>;
    }>;
  };
  
  // Full scenario data (for export)
  rawData: RawCapacityResult;
}

// ─── Ui State (Navigation & Filtering) ────────────────────────────────────
export interface CapacityUIState {
  // Current navigation
  currentScenario: string;
  currentLevel: 0 | 1 | 2 | 3;
  
  // Filtering & sorting (persisted per level)
  searchTerm: string;
  selectedNodeTypes: string[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
  
  // Comparison mode
  comparisonScenario?: string;
  comparisonLevel?: 0 | 1 | 2 | 3;
  
  // Pagination (Level 1 & 3 tables)
  pageIndex: number;
  pageSize: number;
}

// ─── Complete Story State (All 4 levels for current scenario) ──────────────
export interface CapacityStoryState {
  scenarioName: string;
  status: 'idle' | 'loading' | 'computed' | 'error';
  error?: string;
  
  level0: Level0Story | null;
  level1: Level1Story | null;
  level2: Level2Story | null;
  level3: Level3Story | null;
  
  // For comparison overlay
  comparisonScenarioName?: string;
  comparisonLevel0?: Level0Story;
  comparisonLevel1?: Level1Story;
  comparisonLevel2?: Level2Story;
  comparisonLevel3?: Level3Story;
}
