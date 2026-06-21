export type FlowAlgorithm = 'dinic' | 'edmonds_karp' | 'push_relabel';

export interface FlowAnalysisInputRef {
  networkPath: string;
  edgesFilePath?: string;
  capacitiesPath: string;
}

export interface FlowAnalysisRunOptions {
  algorithm: FlowAlgorithm;
  tol: number;
  kFailure: number;
  cutLimit: number;
  pathLimit: number;
  combinationLimit: number;
  maxDepth: number;
  targetFlow?: number;
  includeNodeCapacities: boolean;
  degradationScenarios?: number[];
}

export interface FlowAnalysisRunDraft {
  input: FlowAnalysisInputRef;
  options: FlowAnalysisRunOptions;
}

export interface FlowMetadata {
  algorithm: string;
  tol: number;
  baselineMaxFlow: number;
}

export interface FlowSummary {
  maxFlow: number;
  mincutCapacity: number;
  sinkFlow: Array<{ sinkNode: number; flow: number }>;
  saturatedEdges: Array<[number, number]>;
  mincutS: number[];
  mincutT: number[];
  isUnbounded: boolean;
}

export interface FlowSensitivity {
  criticalEdges: Array<{
    edge: [number, number];
    drop: number;
    baselineFlow: number;
    perturbedFlow: number;
  }>;
  marginalCapacity: Array<{ edge: [number, number]; value: number }>;
  birnbaum: Array<{ edge: [number, number]; value: number }>;
}

export interface FlowFailureImpact {
  minCutEdges: Array<[number, number]>;
  singleEdgeFailures: Array<{
    edge: [number, number];
    drop: number;
    perturbedFlow: number;
    isCritical: boolean;
    isUnbounded: boolean;
  }>;
  kEdgeFailures: Array<{
    edges: Array<[number, number]>;
    drop: number;
    perturbedFlow: number;
    isUnbounded: boolean;
  }>;
  degradationResults: Array<{
    scenarioId: number;
    maxFlow: number;
    dropFromBaseline: number;
    sinkFlow: Array<{ sinkNode: number; flow: number }>;
    isUnbounded: boolean;
  }>;
}

export interface FlowStructure {
  spofEdges: Array<[number, number]>;
  spofNodes: number[];
  paths: number[][];
  edgeRedundancy: Array<{ edge: [number, number]; score: number }>;
  bottleneckRanking: Array<{
    edge: [number, number];
    rank: number;
    flow: number;
    capacity: number;
    residualCapacity: number;
  }>;
  nodePositions: Record<string, string>;
}

export interface FlowDecomposition {
  totalFlow: number;
  isUnique: boolean;
  components: Array<{
    path: number[];
    flowValue: number;
    bottleneckEdge: [number, number];
  }>;
}

export interface FlowParametricThresholds {
  baselineFlow: number;
  targetFlow: number;
  degradationThresholds: Array<{
    targetEdge: [number, number];
    originalCapacity: number;
    thresholdCapacity: number;
    degradationMargin: number;
    targetAchievable: boolean;
    targetReachableAtZero: boolean;
    solverCalls: number;
  }>;
}

export interface FlowMinCutAnalysis {
  maxFlow: number;
  minCutCapacity: number;
  representativeCut: {
    s: number[];
    t: number[];
    crossingEdges: Array<[number, number]>;
    capacity: number;
  };
  edgesInSomeCut: Array<[number, number]>;
  edgesInEveryCut: Array<[number, number]>;
  enumeration: {
    totalCuts: number;
    isComplete: boolean;
    freeZoneSize: number;
  };
}

export interface NodeCapacitatedSummary {
  maxFlow: number;
  sinkFlow: Array<{ sinkNode: number; flow: number }>;
  saturatedNodes: number[];
  spofNodes: number[];
}

export interface FlowAnalysisDomainResult {
  metadata: FlowMetadata;
  flow: FlowSummary;
  sensitivity: FlowSensitivity;
  failureImpact: FlowFailureImpact;
  structure: FlowStructure;
  flowDecomposition: FlowDecomposition;
  parametricThresholds: FlowParametricThresholds;
  minCutAnalysis: FlowMinCutAnalysis;
  nodeCapacitated?: NodeCapacitatedSummary;
}

export interface FlowScenarioPatch {
  edgeOverrides?: Record<string, number>;
  nodeOverrides?: Record<string, number>;
  sourceRateOverrides?: Record<string, number>;
}

export interface FlowGraphSelectionPatch {
  nodeIds: number[];
  edgeIds: string[];
  operation: 'set' | 'scale';
  value: number;
}

export interface FlowScenarioDraft {
  id: string;
  name: string;
  baseCapacitiesPath: string;
  patch: FlowScenarioPatch;
  resourceType?: string;
  resourceUnit?: string;
  notes?: string;
}

export interface FlowScenarioSaveRequest {
  sessionId: string;
  saveAsName: string;
  draft: FlowScenarioDraft;
  persistAsAdditionalScenario: boolean;
}
