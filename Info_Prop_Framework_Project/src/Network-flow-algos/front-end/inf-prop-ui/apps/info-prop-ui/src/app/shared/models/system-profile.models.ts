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
 * Interfaces for the system profile executive dashboard.
 * All metrics are factual (directly from API responses) — no fabricated scores.
 */

// ─── Core Profile Data ───────────────────────────────────────────────

export interface SystemProfileData {
  networkInfo: NetworkInfo;
  scenarioResults: Map<string, ScenarioAnalysisResult>;
  aggregatedMetrics: AggregatedMetrics;
  metricRows: ScenarioMetricRow[];
  hotspotAlerts: HotspotAlert[];
  visualizationData: VisualizationDataPoint[];
  generatedAt: string;
  computationTime: number;
}

// ─── Network Identity ────────────────────────────────────────────────

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
}

export interface NetworkTopology {
  type: 'tree' | 'dag' | 'cyclic' | 'mixed';
  layers: number;
  maxWidth: number;
  branchingFactor: number;
  convergencePoints: number;
}

// ─── Per-Scenario Results ────────────────────────────────────────────

export interface ScenarioAnalysisResult {
  scenarioName: string;
  analysisType: 'reachability' | 'capacity' | 'cpm';
  dataType: 'float' | 'interval' | 'pbox';
  computationTime: number;
  status: 'complete' | 'partial' | 'failed';
  keyMetrics: Record<string, number | string | null>;
  // Raw analysis results for drilldown
  diamondAnalysis?: DiamondAnalysisResult;
  exactInference?: ExactInferenceResult;
  capacityAnalysis?: CapacityScenario;
  cpmAnalysis?: CpmScenario;
}

// ─── Heatmap Data ────────────────────────────────────────────────────

export interface ProfileMetricDefinition {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  source: 'capacity' | 'cpm' | 'reachability' | 'diamond';
  higherIsBetter: boolean;
  format: 'percent' | 'number' | 'integer' | 'duration' | 'probability';
}

export interface ScenarioMetricRow {
  scenario: string;
  analysisTypes: string[];
  dataType: string;
  status: 'complete' | 'partial' | 'failed';
  metrics: Record<string, number | string | null>;
  computationTime: number;
}

// ─── Aggregated Metrics (factual min/max/mean across scenarios) ─────

export interface AggregatedMetrics {
  scenarioCount: number;
  totalComputationTime: number;
  averageComputationTime: number;
  // Per-metric aggregation for heatmap normalisation
  metricRanges: Record<string, MetricRange>;
}

export interface MetricRange {
  min: number;
  max: number;
  mean: number;
  values: { scenario: string; value: number }[];
}

// ─── Hotspot Alerts ──────────────────────────────────────────────────

export interface HotspotAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  scenario: string;
  value: number | string;
  message: string;
  drilldownRoute: string;
  drilldownParams: Record<string, string>;
}

// ─── Scenario Comparison ─────────────────────────────────────────────

export interface ScenarioComparison {
  baselineScenario: string;
  scenarios: string[];
  deltas: Map<string, Record<string, number | null>>;
  insights: ComparisonInsight[];
}

export interface ComparisonInsight {
  type: 'improvement' | 'degradation' | 'trade-off' | 'anomaly';
  severity: 'minor' | 'moderate' | 'significant' | 'critical';
  description: string;
  affectedMetrics: string[];
}

// ─── Visualization Types ─────────────────────────────────────────────

export interface VisualizationDataPoint {
  id: string;
  type: 'bar' | 'grouped-bar' | 'heatmap' | 'radar';
  category: 'comparison' | 'fingerprint' | 'overview';
  title: string;
  description: string;
  data: any;
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
  margins?: { top: number; right: number; bottom: number; left: number };
  colors?: string[];
  interactive?: boolean;
  animations?: boolean;
}

export interface D3VisualizationData {
  // Heatmap Table — scenarios × metrics with heat coloring
  heatmapTableData?: {
    rows: ScenarioMetricRow[];
    columns: ProfileMetricDefinition[];
    colorScale: { min: number; max: number; colorRange: [string, string] };
  };
}

// ─── Request/Response ────────────────────────────────────────────────

export interface SystemProfileRequest {
  networkPath: string;
  scenarios: ScenarioInfo[];
  analysisTypes: ('reachability' | 'capacity' | 'cpm')[];
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
  };
}

// ─── Metric Definitions (constant, drives heatmap columns) ──────────

export const PROFILE_METRICS: ProfileMetricDefinition[] = [
  {
    key: 'networkUtilization',
    label: 'Throughput Ratio (Sink Output / Source Input)',
    shortLabel: 'Throughput',
    unit: 'ratio',
    source: 'capacity',
    higherIsBetter: true,
    format: 'number'
  },
  {
    key: 'bottleneckCount',
    label: 'Bottlenecks',
    shortLabel: 'Bottl.',
    unit: 'count',
    source: 'capacity',
    higherIsBetter: false,
    format: 'integer'
  },
  {
    key: 'criticalPathDuration',
    label: 'Critical Path Duration',
    shortLabel: 'Crit. Path',
    unit: 'time',
    source: 'cpm',
    higherIsBetter: false,
    format: 'number'
  },
  {
    key: 'totalSlack',
    label: 'Total Slack',
    shortLabel: 'Slack',
    unit: 'time',
    source: 'cpm',
    higherIsBetter: true,
    format: 'number'
  },
  {
    key: 'criticalNodeCount',
    label: 'Critical Nodes',
    shortLabel: 'Crit. Nodes',
    unit: 'count',
    source: 'cpm',
    higherIsBetter: false,
    format: 'integer'
  },
  {
    key: 'meanBelief',
    label: 'Sink Reachability (Mean)',
    shortLabel: 'Belief',
    unit: 'probability',
    source: 'reachability',
    higherIsBetter: true,
    format: 'probability'
  },
  {
    key: 'beliefSpread',
    label: 'Belief Spread',
    shortLabel: 'Spread',
    unit: 'probability',
    source: 'reachability',
    higherIsBetter: false,
    format: 'probability'
  },
  {
    key: 'diamondEfficiency',
    label: 'Diamond Efficiency',
    shortLabel: 'Dia. Eff.',
    unit: 'ratio',
    source: 'diamond',
    higherIsBetter: true,
    format: 'number'
  },
  {
    key: 'rootDiamondCount',
    label: 'Root Diamonds',
    shortLabel: 'Diamonds',
    unit: 'count',
    source: 'diamond',
    higherIsBetter: false,
    format: 'integer'
  },
  {
    key: 'computationTime',
    label: 'Computation Time',
    shortLabel: 'Time',
    unit: 's',
    source: 'reachability',
    higherIsBetter: false,
    format: 'duration'
  }
];
