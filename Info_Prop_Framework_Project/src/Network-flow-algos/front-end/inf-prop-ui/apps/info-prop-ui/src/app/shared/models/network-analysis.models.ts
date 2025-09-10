export interface PboxData {
  type: 'pbox';
  discretization_size: number;
  mean_lower: number;
  mean_upper: number;
  var_lower: number;
  var_upper: number;
  shape: string;
  name: string;
  bounded: boolean;
  bounds_summary: {
    left_min: number;
    left_max: number;
    right_min: number;
    right_max: number;
  };
}

export interface IntervalData {
  lower: number;
  upper: number;
  type: 'interval';
}

export type BeliefValue = number | IntervalData | PboxData;

// New interfaces for available data files (paths only, not content)
export interface AvailableDataFiles {
  float?: {
    nodepriors?: string;
    linkprobabilities?: string;
  };
  pbox?: {
    nodepriors?: string;
    linkprobabilities?: string;
  };
  interval?: {
    nodepriors?: string;
    linkprobabilities?: string;
  };
  capacity?: {
    capacities?: string;
  };
  cpm?: {
    'cpm-inputs'?: string;
  };
}

// Interfaces for locally parsed data content
export interface ParsedFloatData {
  node_priors?: Record<string, number>;
  edge_probabilities?: Record<string, number>;
}

export interface ParsedPboxData {
  node_priors?: Record<string, PboxData>;
  edge_probabilities?: Record<string, PboxData>;
}

export interface ParsedIntervalData {
  node_priors?: Record<string, IntervalData>;
  edge_probabilities?: Record<string, IntervalData>;
}

export interface ParsedCapacityData {
  capacities: {
    nodes?: Record<string, number>;
    edges?: Record<string, number>;
    source_rates?: Record<string, number>;
  };
}

export interface ParsedCpmData {
  cpm_data: any; // Complete CPM analysis data structure
}

// Core NetworkStructure - matches what /network-structure endpoint actually returns
export interface NetworkStructure {
  computation_time: number;
  uploaded_data_time?: number;
  total_nodes: number;
  total_edges: number;
  nodes: number[];
  edges: [number, number][];
  source_nodes: number[];
  sink_nodes: number[];
  fork_nodes: number[];
  join_nodes: number[];
  iteration_sets: number[][];
  iteration_sets_count: number;
  ancestors: Record<string, number[]>;
  descendants: Record<string, number[]>;
  outgoing_index: Record<string, number[]>;
  incoming_index: Record<string, number[]>;
  // Available data file paths from backend (only what backend actually returns)
  available_data_files?: AvailableDataFiles;
}

// Enhanced NetworkStructure with fast lookup capabilities for UI components
export interface EnhancedNetworkStructure extends NetworkStructure {
  // Fast lookup maps for UI components
  node_lookup: {
    [nodeId: string]: {
      float_prior?: number;
      interval_prior?: IntervalData;
      pbox_prior?: PboxData;
      capacity?: number;
      type: 'source' | 'sink' | 'fork' | 'join' | 'regular';
    };
  };
  edge_lookup: {
    [edgeKey: string]: { // Format: "(source,target)" - keep original format!
      float_probability?: number;
      interval_probability?: IntervalData;
      pbox_probability?: PboxData;
      capacity?: number;
    };
  };
}

export interface RootDiamondStructure {
  join_node: number;
  diamond: {
    conditioning_nodes: number[];
    relevant_nodes: number[];
    edgelist: [number, number][];
    edge_count: number;
    node_count: number;
  };
  non_diamond_parents: number[];
}

export interface UniqueDiamondStructure {
  diamond_hash: string;
  is_root_diamond: boolean;
  sub_outgoing_index: Record<string, number[]>;
  sub_incoming_index: Record<string, number[]>;
  sub_sources: number[];
  sub_fork_nodes: number[];
  sub_join_nodes: number[];
  sub_ancestors: Record<string, number[]>;
  sub_descendants: Record<string, number[]>;
  sub_iteration_sets: number[][];
  sub_iteration_sets_count: number;
  sub_node_priors: Record<string, BeliefValue>;
  node_count: number;
  // NEW: Missing fields from DiamondComputationData struct
  sub_diamond_structures: Record<string, SubDiamondStructure>;
  diamond: {
    conditioning_nodes: number[];
    relevant_nodes: number[];
    edgelist: [number, number][];
    edge_count: number;
    node_count: number;
  };
  // **NEW: Optional join_node field for sub-diamonds that are serialized as top-level entries**
  join_node?: number;
  non_diamond_parents?: number[];
}

// **NEW: Interface for sub-diamond structures within parent diamonds**
export interface SubDiamondStructure {
  join_node: number;
  sub_diamond_hash: string; // **NEW: Hash for direct lookup**
  diamond: {
    conditioning_nodes: number[];
    relevant_nodes: number[];
    edgelist: [number, number][];
    edge_count: number;
    node_count: number;
  };
  non_diamond_parents: number[];
}

export interface DiamondAnalysisResult {
  root_diamonds_count: number;
  unique_diamonds_count: number;
  join_nodes_with_diamonds: number[];
  root_computation_time: number;
  unique_computation_time: number;
  total_computation_time: number;
  diamond_efficiency: number;
  note?: string;
  // **NEW: Raw diamond structures (two different types)**
  raw_root_diamonds?: Record<string, RootDiamondStructure>;
  raw_unique_diamonds?: Record<string, UniqueDiamondStructure>;
}

// **NEW: Enhanced scenario-aware interfaces for multi-scenario analysis**
export interface ScenarioInfo {
  name: string;
  dataType: 'float' | 'interval' | 'pbox';
  path: string;
  displayName?: string;
  // **NEW: Additional scenario metadata**
  analysisType?: 'reachability' | 'capacity' | 'cpm';
  isValid?: boolean;
  fileSize?: number;
  lastModified?: number;
  description?: string;
}

export interface MultiScenarioDiamondResults {
  scenarios: Map<string, DiamondAnalysisResult>;
  currentScenario: string;
  availableScenarios: ScenarioInfo[];
}

// **NEW: Multi-scenario results for all analysis types**
export interface MultiScenarioReachabilityResults {
  scenarios: Map<string, ReachabilityScenario>;
  currentScenario: string;
  availableScenarios: ScenarioInfo[];
}

export interface MultiScenarioCapacityResults {
  scenarios: Map<string, CapacityScenario>;
  currentScenario: string;
  availableScenarios: ScenarioInfo[];
}

export interface MultiScenarioCpmResults {
  scenarios: Map<string, CpmScenario>;
  currentScenario: string;
  availableScenarios: ScenarioInfo[];
}

// **NEW: Comprehensive multi-scenario state**
export interface ComprehensiveScenarioState {
  reachability: MultiScenarioReachabilityResults;
  diamond: MultiScenarioDiamondResults;
  capacity: MultiScenarioCapacityResults;
  cpm: MultiScenarioCpmResults;
  globalCurrentScenario: string;
  scenarioSyncEnabled: boolean;
}

// **NEW: Scenario comparison interfaces**
export interface ScenarioComparison {
  scenarios: string[];
  comparisonType: 'side-by-side' | 'overlay' | 'difference';
  metrics: ScenarioComparisonMetrics;
}

export interface ScenarioComparisonMetrics {
  reachability?: {
    beliefDifferences: Record<string, number>;
    computationTimeDifference: number;
    nodeProcessingDifference: number;
  };
  diamond?: {
    diamondCountDifference: number;
    efficiencyDifference: number;
    complexityDifference: number;
  };
  capacity?: {
    utilizationDifference: number;
    flowDifferences: Record<string, number>;
    bottleneckChanges: string[];
  };
  cpm?: {
    criticalPathDifference: number;
    costDifference: number;
    timeDifference: number;
  };
}

// **ENHANCED: DiamondPattern with proper identification**
export interface DiamondPattern {
  id: string;
  displayId: string; // **NEW: Human-readable identifier**
  nodeCount: number;
  isRoot: boolean;
  complexity: number;
  joinNodes: number[];
  sourceNodes: number[];
  forkNodes: number[];
  // **ENHANCED: Proper diamond identification fields**
  conditioningNodes: number[];
  joinNode?: number; // For root diamonds (DiamondsAtNode)
  diamondHash?: string; // For unique diamonds (DiamondComputationData)
  relevantNodes: number[];
  edgeList: [number, number][];
  subDiamonds?: DiamondPattern[];
  // **NEW: Risk and structural metrics**
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  structuralType?: 'simple' | 'convergent' | 'divergent' | 'complex';
  pathDensity?: number;
}

export interface DiamondSummary {
  totalDiamonds: number;
  rootDiamonds: number;
  averageComplexity: number;
  maxComplexity: number;
  networkCoverage: number;
  commonCausePatterns: number;
  // Enhanced risk assessment properties
  singlePointsOfFailure?: number;
  cascadePotential?: string;
}

export interface ConvergenceInsight {
  patternType: 'simple' | 'complex' | 'nested' | 'convergent' | 'cascade';
  frequency: number;
  averageNodeCount: number;
  criticalJoinNodes: number[];
  // Enhanced risk assessment properties
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  description?: string;
  businessImpact?: string;
}

export interface JoinNodeAnalysis {
  nodeId: number;
  diamondCount: number;
  centralityScore: number;
  convergencePatterns: string[];
  isBottleneck: boolean;
  // Enhanced analysis properties
  pathCount?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

// **NEW: Enhanced interfaces for diamond details**
export interface DiamondDetailsData {
  diamondId: string;
  displayId: string;
  conditioningNodes: number[];
  joinNode?: number; // For root diamonds
  diamondHash?: string; // For unique diamonds
  diamond: RootDiamondStructure | UniqueDiamondStructure;
  networkSubset: {
    nodes: number[];
    edges: [number, number][];
    conditioningNodes: number[];
    bridgeEdges: [number, number][];
    diamondJoinEdges: [number, number][];
  };
  subDiamonds: DiamondPattern[];
  hierarchyPath: string[];
  structuralInfo: {
    nodeCount: number;
    edgeCount: number;
    complexity: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    isBottleneck: boolean;
  };
}

export interface NodeDetail {
  nodeId: number;
  type: string;
  role: 'root' | 'leaf' | 'conditioning' | 'bridge' | 'internal';
  inDegree: number;
  outDegree: number;
  pathCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  // **NEW: Enhanced node information**
  isBottleneck: boolean;
  centrality: number;
  influence: number;
}

export interface EdgeDetail {
  source: number;
  target: number;
  type: 'diamond-internal' | 'bridge' | 'diamond-join' | 'conditioning';
  role: string;
  pathContribution: number;
  isCritical: boolean;
  // **NEW: Enhanced edge information**
  reliability: number;
  capacity: number;
}

export interface ExactInferenceResult {
  beliefs: Record<string, BeliefValue>;
  computation_time: number;
  total_nodes_processed: number;
  belief_statistics: {
    mean: number;
    min: number;
    max: number;
  };
}

export interface ReachabilityScenario {
  diamond_analysis?: DiamondAnalysisResult;
  exact_inference?: ExactInferenceResult;
  scenario_computation_time: number;
  input_files: {
    nodepriors_path: string;
    linkprobs_path: string;
  };
}

export interface RawCapacityResult {
  node_max_flows: Record<string, number>;
  edge_flows?: Record<string, number>; // Optional edge flow data
  bottlenecks: Record<string, any[]>; // Vector of mixed types (nodes, edges, symbols)
  critical_paths: Record<string, number[][]>; // Multiple paths per target
  network_utilization: number;
  analysis_type: string;
  computation_time: number;
  convergence_info: Record<string, any>;
}

export interface CapacityScenario {
  computation_time: number;
  network_utilization: number;
  total_source_input: number;
  total_target_output: number;
  target_flows: Record<string, number>;
  source_inputs?: Record<string, number>;
  active_sources: number[];
  target_nodes: number[];
  node_capacities_count: number;
  edge_capacities_count: number;
  input_files: {
    capacities_path: string;
  };
  // **NEW: Complete raw capacity results**
  raw_capacity_result?: RawCapacityResult;
}

export interface CpmScenario {
  computation_time: number;
  time_result: {
    critical_value: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  cost_result: {
    critical_value: number;
    critical_nodes: number[];
    node_values: Record<string, number>;
  };
  node_durations_count: number;
  edge_delays_count: number;
  node_costs_count: number;
  edge_costs_count: number;
  input_files: {
    cpm_path: string;
  };
}

export interface AnalysisResponse {
  success: boolean;
  message: string;
  network_name?: string;
  timestamp?: string;
  analysis_config?: {
    reachabilityScenarios: ReachabilityScenarioConfig[];
    capacityScenarios: CapacityScenarioConfig[];
    cpmScenarios: CpmScenarioConfig[];
    networkPath: string;
    analysisConfig: AnalysisRequestConfig;
  };
  results?: {
    network_structure: NetworkStructure;
    reachability_scenarios?: Record<string, ReachabilityScenario>;
    diamond_analysis?: DiamondAnalysisResult;
    capacity_scenarios?: Record<string, CapacityScenario>;
    cpm_scenarios?: Record<string, CpmScenario>;
    analysis_summary: {
      network_name: string;
      total_computation_time: number;
      reachability_scenarios_count: number;
      capacity_scenarios_count: number;
      cpm_scenarios_count: number;
      timestamp: string;
    };
  };
  error?: string;
}

export interface ReachabilityScenarioConfig {
  name: string;
  nodepriors_path: string;
  linkprobs_path: string;
}

export interface CapacityScenarioConfig {
  name: string;
  capacities_path: string;
}

export interface CpmScenarioConfig {
  name: string;
  cpm_path: string;
}

export interface AnalysisRequestConfig {
  exactInference: boolean;
  diamondAnalysis: boolean;
  flowAnalysis: boolean;
  criticalPath: boolean;
}

export interface AnalysisRequest {
  networkPath: string;
  reachabilityScenarios: ReachabilityScenarioConfig[];
  capacityScenarios: CapacityScenarioConfig[];
  cpmScenarios: CpmScenarioConfig[];
  analysisConfig: AnalysisRequestConfig;
}

// Clean Individual Endpoint Request/Response DTOs - Match Backend Exactly

export interface NetworkStructureRequest {
  networkPath: string;
  edgesFilePath?: string;
}

export interface NetworkStructureResponse {
  success: boolean;
  message: string;
  network_name: string;
  timestamp: string;
  network_structure: NetworkStructure;
}

export interface DiamondAnalysisRequest {
  networkPath: string;
  edgesFilePath?: string;
  nodepriorsPath?: string;
}

export interface DiamondAnalysisResponse {
  success: boolean;
  message: string;
  network_name: string;
  timestamp: string;
  diamond_analysis: DiamondAnalysisResult;
}

export interface ReachabilityAnalysisRequest {
  networkPath: string;
  edgesFilePath: string;
  nodepriorsPath: string;
  linkprobsPath: string;
  includeExactInference?: boolean;
  includeDiamondAnalysis?: boolean;
}

export interface ReachabilityAnalysisResponse {
  success: boolean;
  message: string;
  network_name: string;
  timestamp: string;
  reachability_result: ReachabilityScenario;
}

export interface CapacityAnalysisRequest {
  networkPath: string;
  edgesFilePath: string;
  capacitiesPath: string;
}

export interface CapacityAnalysisResponse {
  success: boolean;
  message: string;
  network_name: string;
  timestamp: string;
  capacity_result: CapacityScenario;
}

export interface CpmAnalysisRequest {
  networkPath: string;
  edgesFilePath: string;
  cpmPath: string;
}

export interface CpmAnalysisResponse {
  success: boolean;
  message: string;
  network_name: string;
  timestamp: string;
  cmp_result: CpmScenario;
}

export interface HealthResponse {
  status: string;
}

// Upload Response DTO - Matches Backend Exactly
export interface UploadResponse {
  success: boolean;
  message: string;
  network_path: string;
  uploaded_files: string[];
  edges_files: string[];
}

// File Management Models for Upload Component

export type AnalysisType = 'reachability' | 'capacity' | 'cpm' | 'network' | 'mapping' | 'unknown';
export type DataType = 'float' | 'interval' | 'pbox' | 'capacity' | 'cpm' | 'edges' | 'mapping';

export interface UploadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
  content?: string; // For small files that can be previewed
}

export interface CategorizedFile extends UploadedFile {
  analysisType: AnalysisType;
  dataType: DataType;
  confidence: number; // 0-1, how confident the categorization is
  suggestedRole: string; // e.g., "Node Priors", "Edge Probabilities", "Capacities"
  isUserAssigned: boolean; // true if user manually assigned this file
  validationErrors: string[];
  validationWarnings: string[];
}

export interface AnalysisFileGroup {
  analysisType: AnalysisType;
  networkPath?: string;
  edgesFile?: CategorizedFile;
  files: CategorizedFile[];
  isComplete: boolean;
  missingFiles: string[];
  canRunAnalysis: boolean;
  scenarioName?: string; // Name of the scenario folder
}

export interface ReachabilityFileGroup extends AnalysisFileGroup {
  analysisType: 'reachability';
  dataType: DataType; // float, interval, or pbox
  nodePriorsFile?: CategorizedFile;
  linkProbabilitiesFile?: CategorizedFile;
  scenarioName?: string; // NEW: Name of the scenario (e.g., "optimized", "degraded", "Breakdown 214")
}

export interface CapacityFileGroup extends AnalysisFileGroup {
  analysisType: 'capacity';
  capacitiesFile?: CategorizedFile;
}

export interface CpmFileGroup extends AnalysisFileGroup {
  analysisType: 'cpm';
  cpmInputsFile?: CategorizedFile;
  hasTimeAnalysis: boolean;
  hasCostAnalysis: boolean;
}

export interface NetworkFileGroup extends AnalysisFileGroup {
  analysisType: 'network';
  edgesFile?: CategorizedFile;
  nodeMappingFile?: CategorizedFile;
}

export interface FileManagerState {
  uploadedFiles: CategorizedFile[];
  analysisGroups: {
    reachability: ReachabilityFileGroup[];
    capacity: CapacityFileGroup[];
    cpm: CpmFileGroup[];
    network: NetworkFileGroup;
  };
  selectedNetworkPath: string | null;
  isUploading: boolean;
  uploadProgress: number;
  validationResults: {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  };
}

export interface FileCategorization {
  patterns: {
    edges: RegExp[];
    nodepriors: RegExp[];
    linkprobs: RegExp[];
    capacities: RegExp[];
    cpm: RegExp[];
    mapping: RegExp[];
  };
  folderPatterns: {
    float: RegExp[];
    interval: RegExp[];
    pbox: RegExp[];
    capacity: RegExp[];
    cpm: RegExp[];
  };
}

export interface FileValidationRule {
  analysisType: AnalysisType;
  requiredFiles: string[];
  optionalFiles: string[];
  fileExtensions: string[];
  contentValidation?: (content: string) => { isValid: boolean; errors: string[] };
}

export interface TabState {
  enabled: boolean;
  completed: boolean;
  hasData: boolean;
}

export interface AnalysisState {
  currentStep: string;
  completedSteps: Set<string>;
  networkData: NetworkStructure | null;
  analysisResults: AnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
}

export interface NetworkNode {
  id: number;
  type: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  x?: number;
  y?: number;
  belief?: BeliefValue;
  flow?: number;
  capacity?: number;
  duration?: number;
  cost?: number;
  isCritical?: boolean;
}

export interface NetworkEdge {
  source: number;
  target: number;
  probability?: number;
  capacity?: number;
  delay?: number;
  cost?: number;
  flow?: number;
  isCritical?: boolean;
}

export type VisualizationMode = 'structure' | 'beliefs' | 'flows' | 'critical-path';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}