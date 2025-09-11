import { 
  ScenarioInfo, 
  DiamondAnalysisResult, 
  ExactInferenceResult, 
  CapacityScenario, 
  CpmScenario,
  NetworkStructure 
} from './network-analysis.models';

/**
 * System Profile Data Models
 * 
 * Comprehensive interfaces for system-wide analysis aggregation
 * and visualization across multiple scenarios and analysis types.
 */

export interface SystemProfileData {
  networkInfo: NetworkInfo;
  scenarioResults: Map<string, ScenarioAnalysisResult>;
  aggregatedMetrics: SystemMetrics;
  visualizationData: VisualizationDataPoint[];
  recommendations: SystemRecommendation[];
  generatedAt: string;
  computationTime: number;
}

export interface NetworkInfo {
  name: string;
  totalNodes: number;
  totalEdges: number;
  sourceNodes: number[];
  sinkNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  complexity: NetworkComplexity;
  topology: NetworkTopology;
}

export interface NetworkComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'very-complex';
  score: number;
  edgeNodeRatio: number;
  averageDegree: number;
  maxDegree: number;
  clustering: number;
}

export interface NetworkTopology {
  type: 'tree' | 'dag' | 'cyclic' | 'mixed';
  layers: number;
  maxWidth: number;
  branchingFactor: number;
  convergencePoints: number;
}

export interface ScenarioAnalysisResult {
  scenarioName: string;
  analysisType: 'reachability' | 'capacity' | 'cpm';
  dataType: 'float' | 'interval' | 'pbox';
  computationTime: number;
  keyMetrics: Record<string, number>;
  riskAssessment: RiskAssessment;
  performanceMetrics: PerformanceMetrics;
  // Raw analysis results
  diamondAnalysis?: DiamondAnalysisResult;
  exactInference?: ExactInferenceResult;
  capacityAnalysis?: CapacityScenario;
  cpmAnalysis?: CpmScenario;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
}

export interface RiskFactor {
  type: 'bottleneck' | 'single-point-failure' | 'cascade' | 'complexity' | 'uncertainty';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedNodes: number[];
  likelihood: number;
  impact: number;
}

export interface PerformanceMetrics {
  throughput: number;
  latency: number;
  reliability: number;
  efficiency: number;
  scalability: number;
  robustness: number;
}

export interface SystemMetrics {
  // Network-wide metrics
  networkUtilization: number;
  averageComplexity: number;
  maxComplexity: number;
  bottleneckCount: number;
  singlePointFailures: number;
  
  // Performance metrics
  averageComputationTime: number;
  totalComputationTime: number;
  memoryUsage: number;
  
  // Risk metrics
  overallRiskScore: number;
  criticalPathRisk: 'low' | 'medium' | 'high' | 'critical';
  cascadeRisk: number;
  uncertaintyLevel: number;
  
  // Reliability metrics
  systemReliability: number;
  redundancyLevel: number;
  failureResistance: number;
  
  // Efficiency metrics
  resourceUtilization: number;
  pathEfficiency: number;
  informationFlow: number;
}

export interface VisualizationDataPoint {
  id: string;
  type: 'bar' | 'histogram' | 'heatmap' | 'network' | 'radar' | 'scatter' | 'line';
  category: 'performance' | 'risk' | 'topology' | 'comparison' | 'trend';
  title: string;
  description: string;
  data: any; // Flexible data structure for different chart types
  config: VisualizationConfig;
  metadata: {
    scenarios: string[];
    analysisTypes: string[];
    generatedAt: string;
    dataPoints: number;
  };
}

export interface VisualizationConfig {
  width?: number;
  height?: number;
  margins?: { top: number; right: number; bottom: number; left: number; };
  colors?: string[];
  scales?: {
    x?: 'linear' | 'ordinal' | 'time' | 'log';
    y?: 'linear' | 'ordinal' | 'time' | 'log';
  };
  axes?: {
    x?: { label: string; format?: string; };
    y?: { label: string; format?: string; };
  };
  legend?: boolean;
  interactive?: boolean;
  animations?: boolean;
}

export interface SystemRecommendation {
  id: string;
  type: 'optimization' | 'risk-mitigation' | 'performance' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  affectedComponents: string[];
  expectedBenefit: number;
  implementationSteps: string[];
}

export interface ScenarioComparison {
  scenarios: string[];
  comparisonType: 'side-by-side' | 'overlay' | 'difference' | 'trend';
  metrics: ComparisonMetrics;
  visualizations: VisualizationDataPoint[];
  insights: ComparisonInsight[];
}

export interface ComparisonMetrics {
  performanceDelta: Record<string, number>;
  riskDelta: Record<string, number>;
  reliabilityDelta: Record<string, number>;
  efficiencyDelta: Record<string, number>;
  computationTimeDelta: Record<string, number>;
}

export interface ComparisonInsight {
  type: 'improvement' | 'degradation' | 'trade-off' | 'anomaly';
  severity: 'minor' | 'moderate' | 'significant' | 'critical';
  description: string;
  affectedMetrics: string[];
  recommendation?: string;
}

export interface SystemHealthStatus {
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  score: number;
  components: {
    performance: HealthComponent;
    reliability: HealthComponent;
    efficiency: HealthComponent;
    risk: HealthComponent;
  };
  trends: {
    improving: string[];
    degrading: string[];
    stable: string[];
  };
}

export interface HealthComponent {
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  score: number;
  factors: string[];
  recommendations: string[];
}

export interface D3VisualizationData {
  // Bar Chart Data
  barData?: {
    categories: string[];
    values: number[];
    colors?: string[];
    labels?: string[];
  };
  
  // Histogram Data
  histogramData?: {
    bins: { x0: number; x1: number; count: number; }[];
    statistics: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
    };
  };
  
  // Heatmap Data
  heatmapData?: {
    matrix: number[][];
    rowLabels: string[];
    columnLabels: string[];
    colorScale: { min: number; max: number; };
  };
  
  // Network Data
  networkData?: {
    nodes: { id: string; group: number; value: number; }[];
    links: { source: string; target: string; value: number; }[];
    clusters?: { id: string; nodes: string[]; }[];
  };
  
  // Radar Chart Data
  radarData?: {
    axes: string[];
    datasets: {
      name: string;
      values: number[];
      color: string;
    }[];
  };
  
  // Scatter Plot Data
  scatterData?: {
    points: { x: number; y: number; label: string; category: string; }[];
    xAxis: { label: string; domain: [number, number]; };
    yAxis: { label: string; domain: [number, number]; };
  };
  
  // Line Chart Data
  lineData?: {
    series: {
      name: string;
      data: { x: number | string; y: number; }[];
      color: string;
    }[];
    xAxis: { label: string; type: 'linear' | 'time' | 'ordinal'; };
    yAxis: { label: string; type: 'linear' | 'log'; };
  };
}

export interface SystemProfileRequest {
  networkPath: string;
  scenarios: ScenarioInfo[];
  analysisTypes: ('reachability' | 'capacity' | 'cpm')[];
  includeVisualizations: boolean;
  includeRecommendations: boolean;
  comparisonMode?: boolean;
  selectedScenarios?: string[];
}

export interface SystemProfileResponse {
  success: boolean;
  data?: SystemProfileData;
  error?: string;
  warnings?: string[];
  metadata: {
    generatedAt: string;
    computationTime: number;
    scenariosProcessed: number;
    visualizationsGenerated: number;
  };
}