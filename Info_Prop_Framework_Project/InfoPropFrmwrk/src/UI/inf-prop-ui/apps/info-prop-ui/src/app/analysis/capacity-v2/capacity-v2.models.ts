export type CapacityV2AnalysisType = 'deterministic' | 'interval';
export type CapacityV2RunState = 'idle' | 'running' | 'success' | 'error';
export type CapacityV2DetailSource = 'worst' | 'best';
export type CapacityV2HighlightMode = 'bottlenecks' | 'saturated' | 'all' | 'none';

export interface CapacityV2Interval {
  min: number;
  max: number;
}

export interface CapacityV2InputRow {
  key: string;
  deterministic: number;
  interval: CapacityV2Interval;
}

export interface CapacityV2InputOptions {
  computeAllMinCuts: boolean;
  enumerateCriticalPaths: boolean;
  computeUpgradePriorities: boolean;
  includeClassicalComparison: boolean;
  verbosity: 'minimal' | 'standard' | 'detailed';
}

export interface CapacityV2RunInputs {
  networkPath: string;
  edgesFilePath: string;
  capacitiesPath: string;
  analysisType: CapacityV2AnalysisType;
  targetNodes: number[];
  nodeCapacities: CapacityV2InputRow[];
  edgeCapacities: CapacityV2InputRow[];
  sourceRates: CapacityV2InputRow[];
  options: CapacityV2InputOptions;
}

export interface CapacityV2Validation {
  allChecksPassed: boolean;
  flowConservationSatisfied: boolean;
  maxConservationError: number;
  capacityConstraintsSatisfied: boolean;
  optimalityVerified: boolean;
  warnings: string[];
  errors: string[];
}

export interface CapacityV2NearSaturatedEdge {
  edge: [number, number];
  utilization: number;
}

export interface CapacityV2NearSaturatedNode {
  node: number;
  utilization: number;
}

export interface CapacityV2BottleneckEntity {
  minCutCapacity: number;
  bottleneckType: string;
  minCutEdges: [number, number][];
  minCutNodes: number[];
  saturatedEdges: [number, number][];
  saturatedNodes: number[];
  nearSaturatedEdges: CapacityV2NearSaturatedEdge[];
  nearSaturatedNodes: CapacityV2NearSaturatedNode[];
  totalSpareEdgeCapacity: number;
  totalSpareNodeCapacity: number;
}

export interface CapacityV2UpgradeRecommendationEdge {
  edge: [number, number];
  currentCapacity: number;
  currentFlow: number;
  currentUtilization: number;
  marginalValue: number;
  recommendedCapacity: number;
  expectedFlowIncrease: number;
  priorityScore: number;
  rationale: string;
}

export interface CapacityV2UpgradeRecommendationNode {
  node: number;
  currentCapacity: number;
  currentFlow: number;
  currentUtilization: number;
  marginalValue: number;
  recommendedCapacity: number;
  expectedFlowIncrease: number;
  priorityScore: number;
  rationale: string;
}

export interface CapacityV2UpgradeEntity {
  edgePriorities: CapacityV2UpgradeRecommendationEdge[];
  nodePriorities: CapacityV2UpgradeRecommendationNode[];
  primaryBottleneck: string;
  recommendedAction: string;
}

export interface CapacityV2CriticalPath {
  path: number[];
  capacity: number;
  flow: number;
  isSaturated: boolean;
  spareCapacity: number;
  length: number;
  bottleneckLocation: string;
}

export interface CapacityV2CriticalPathEntity {
  criticalPaths: CapacityV2CriticalPath[];
  pathRedundancy: Record<string, number>;
  singlePointsOfFailure: string[];
}

export interface CapacityV2ComparativeEntity {
  realisticMaxFlow: number;
  classicalMaxFlow: number;
  efficiencyLoss: number;
  primaryLimitation: string;
  strategicRecommendation: string;
}

export interface CapacityV2FlowNode {
  nodeId: number;
  flow: number;
  utilization: number;
}

export interface CapacityV2FlowEdge {
  edgeKey: string;
  from: number;
  to: number;
  flow: number;
  utilization: number;
}

export interface CapacityV2SummaryMetrics {
  throughput: number | CapacityV2Interval;
  utilization: number;
  computationTimeMs: number;
  expectedFlow?: number;
  uncertaintyRange?: number;
}

export interface CapacityV2DeterministicEntity {
  summary: CapacityV2SummaryMetrics;
  targetFlows: Record<string, number>;
  bottlenecks: CapacityV2BottleneckEntity;
  upgrades: CapacityV2UpgradeEntity;
  criticalPaths: CapacityV2CriticalPathEntity;
  comparative: CapacityV2ComparativeEntity;
  nodeFlows: CapacityV2FlowNode[];
  edgeFlows: CapacityV2FlowEdge[];
  validation: CapacityV2Validation;
  metadata: {
    algorithmUsed: string;
    exactnessGuaranteed: boolean;
    timestamp: string;
  };
}

export interface CapacityV2IntervalEntity {
  summary: CapacityV2SummaryMetrics;
  robustBottlenecks: string[];
  potentialBottlenecks: string[];
  componentsMostUncertain: Array<{ component: string; impact: number }>;
  worstCase: CapacityV2DeterministicEntity;
  bestCase: CapacityV2DeterministicEntity;
}

export type CapacityV2ResultEntity =
  | { kind: 'deterministic'; deterministic: CapacityV2DeterministicEntity }
  | { kind: 'interval'; interval: CapacityV2IntervalEntity };

export interface CapacityV2NetworkOption {
  label: string;
  networkPath: string;
  edgesFilePath: string;
  capacitiesPath: string;
  scenarioName: string;
  analysisType: CapacityV2AnalysisType;
}

export interface CapacityV2ViewModel {
  runState: CapacityV2RunState;
  error: string | null;
  inputs: CapacityV2RunInputs;
  result: CapacityV2ResultEntity | null;
  selectedDetailSource: CapacityV2DetailSource;
  highlightMode: CapacityV2HighlightMode;
  selectedNodeId: string | null;
}
