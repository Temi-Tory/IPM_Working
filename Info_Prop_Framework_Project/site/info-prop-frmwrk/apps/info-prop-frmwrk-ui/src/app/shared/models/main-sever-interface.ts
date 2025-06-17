// Basic Analysis Request
export interface BasicAnalysisRequest {
  csvContent: string;
  nodePrior: number;
  edgeProb: number;
  overrideNodePrior: boolean;
  overrideEdgeProb: boolean;
}

export interface EnhancedAnalysisRequest extends BasicAnalysisRequest {
  includeClassification?: boolean;
  enableMonteCarlo?: boolean;
  useIndividualOverrides?: boolean;
  individualNodePriors?: { [nodeId: string]: number };
  individualEdgeProbabilities?: { [edgeKey: string]: number };
}

// Structure-only Analysis Request

export interface StructureAnalysisRequest {
  csvContent: string;
}

export interface DiamondSubsetAnalysisRequest {
  diamondData: {
    joinNode: string;
    structure: DiamondStructureData;
  };
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  nodePrior?: number;
  edgeProb?: number;
  useIndividualOverrides?: boolean;
  individualNodePriors?: { [nodeId: string]: number };
  individualEdgeProbabilities?: { [edgeKey: string]: number };
}

export interface DotExportRequest {
  networkData: NetworkData;
}

// Response Interfaces
export interface AnalysisResult {
  node: number;
  probability: number;
}

export interface NetworkData {
  nodes: number[];
  edges: [number, number][];
  sourceNodes: number[];
  sinkNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  iterationSets: number[][];
  nodeCount: number;
  edgeCount: number;
  ancestors: { [key: string]: number[] };
  descendants: { [key: string]: number[] };
  maxIterationDepth?: number;
  graphDensity?: number;
  nodeTypeDistribution?: { [key: string]: number };
}



export interface DiamondClassification {
  join_node: number;
  diamond_index: number;
  fork_structure: string;
  internal_structure: string;
  path_topology: string;
  join_structure: string;
  external_connectivity: string;
  degeneracy: string;
  fork_count: number;
  subgraph_size: number;
  internal_forks: number[];
  internal_joins: number[];
  path_count: number;
  complexity_score: number;
  optimization_potential: number;
  bottleneck_risk: number;
}
export interface DiamondGroup {
  relevant_nodes: number[];
  highest_nodes: number[];
  edgelist: [number, number][];
}

export interface DiamondStructureData {
  join_node: number;
  non_diamond_parents: number[];
  diamond: DiamondGroup[];
}

export interface DiamondStructures {
  [joinNodeId: string]: DiamondStructureData;
}

export interface DiamondData {
  diamondClassifications: DiamondClassification[];
  diamondStructures: DiamondStructures;
}

export interface MonteCarloResult {
  node: number;
  algorithmValue: number;
  monteCarloValue: number;
  difference: number;
}

export interface ParameterModifications {
  nodesIndividuallyModified: number;
  edgesIndividuallyModified: number;
  nodesGloballyModified: number;
  edgesGloballyModified: number;
  totalNodesModified: number;
  totalEdgesModified: number;
  useIndividualOverrides: boolean;
}

export interface AnalysisSummary {
  nodes: number;
  edges: number;
  diamonds?: number;
  nodePrior: string | number;
  edgeProbability: string | number;
  analysisType?: string;
  density?: number;
  maxDepth?: number;
  hasDiamonds?: boolean;
  hasResults?: boolean;
}

export interface Statistics {
  basic: {
    nodes: number;
    edges: number;
    density: number;
    maxDepth: number;
  };
  nodeTypes: { [key: string]: number };
  structural: {
    diamonds?: number;
    isolatedNodes: number;
    highDegreeNodes: number;
    iterationSets: number;
  };
  connectivity: {
    stronglyConnectedComponents: number;
    avgPathLength: number;
    hasIsolatedNodes: boolean;
  };
}


// Base Analysis Response
export interface BaseAnalysisResponse {
  success: boolean;
  mode: string;
  networkData: NetworkData;
  originalData: {
    nodePriors: { [key: string]: number };
    edgeProbabilities: { [key: string]: number };
  };
  summary: AnalysisSummary;
  error?: string;
}


// Structure Analysis Response (Tier 1)
export interface StructureAnalysisResponse extends BaseAnalysisResponse {
  analysisType: string;
  diamondData: null;
  statistics: Statistics;
}

// Diamond Analysis Response (Tier 2)
export interface DiamondAnalysisResponse extends BaseAnalysisResponse {
  analysisType: string;
  diamondData: DiamondData | null;
  statistics: Statistics;
}

// Full Analysis Response (Tier 3)
export interface FullAnalysisResponse extends BaseAnalysisResponse {
  results: AnalysisResult[];
  diamondData?: DiamondData | null;
  monteCarloResults?: MonteCarloResult[] | null;
  parameterModifications?: ParameterModifications;
}

// Diamond Subset Analysis Response
export interface DiamondSubsetAnalysisResponse {
  success: boolean;
  results: AnalysisResult[];
  summary: {
    nodes: number;
    edges: number;
    sources: number;
    joinNode: string;
    usedIndividualOverrides: boolean;
  };
  error?: string;
}

// DOT Export Response
export interface DotExportResponse {
  success: boolean;
  dotString: string;
  error?: string;
}