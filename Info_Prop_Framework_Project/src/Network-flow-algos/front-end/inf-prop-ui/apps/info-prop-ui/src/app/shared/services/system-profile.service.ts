
import { Injectable, inject } from '@angular/core';
import { Observable, of, map, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import {
  SystemProfileData,
  AggregatedMetrics,
  MetricRange,
  ScenarioAnalysisResult,
  ScenarioMetricRow,
  NetworkInfo,
  VisualizationDataPoint,
  HotspotAlert,
  PROFILE_METRICS
} from '../models/system-profile.models';

import {
  NetworkStructure,
  ReachabilityScenario,
  CapacityScenario,
  CpmScenario
} from '../models/network-analysis.models';

import { AnalysisStateService } from './analysis-state.service';

/**
 * System Profile Service
 *
 * Aggregates analysis results that the user has ALREADY computed.
 * Reads from cached multi-scenario results in AnalysisStateService —
 * never makes its own backend calls for analysis.
 * All metrics are factual — extracted directly from cached responses.
 */
@Injectable({
  providedIn: 'root'
})
export class SystemProfileService {
  private http = inject(HttpClient);
  private analysisStateService = inject(AnalysisStateService);

  private readonly baseUrl = 'http://localhost:8080';

  /**
   * Generate system profile from CACHED analysis results.
   * Only includes scenarios that the user has already analysed.
   */
  generateSystemProfile(
    networkPath: string
  ): Observable<SystemProfileData> {
    const startTime = Date.now();

    return this.getNetworkStructure(networkPath).pipe(
      map(networkStructure => {
        const networkInfo = this.extractNetworkInfo(networkStructure, networkPath);

        // Collect results from cached multi-scenario state
        const scenarioMap = this.collectCachedResults();

        if (scenarioMap.size === 0) {
          throw new Error('No analysis results available. Run analyses first, then return here.');
        }

        const metricRows = this.buildMetricRows(scenarioMap);
        const aggregatedMetrics = this.calculateAggregatedMetrics(metricRows);
        const hotspotAlerts = this.generateHotspotAlerts(metricRows, networkInfo);
        const visualizationData = this.generateVisualizationData(metricRows, aggregatedMetrics);

        const computationTime = Date.now() - startTime;

        return {
          networkInfo,
          scenarioResults: scenarioMap,
          aggregatedMetrics,
          metricRows,
          hotspotAlerts,
          visualizationData,
          generatedAt: new Date().toISOString(),
          computationTime
        };
      })
    );
  }

  // ─── Collect from Cached Results ────────────────────────────────

  private collectCachedResults(): Map<string, ScenarioAnalysisResult> {
    const scenarioMap = new Map<string, ScenarioAnalysisResult>();

    /** Merge new metrics into an existing scenario entry, or create one */
    const mergeInto = (
      name: string,
      analysisType: 'reachability' | 'capacity' | 'cpm',
      dataType: string,
      computationTime: number,
      metrics: Record<string, number | string | null>,
      extras: Partial<ScenarioAnalysisResult>
    ) => {
      const existing = scenarioMap.get(name);
      if (existing) {
        // Merge: combine analysis types, accumulate computation time, merge metrics
        if (!existing.analysisType.includes(analysisType as any)) {
          // analysisType becomes the first one set — keep it as primary
        }
        // Prefer the most specific reachability dataType (interval/pbox > float)
        const validDataTypes = ['float', 'interval', 'pbox'];
        if (validDataTypes.includes(dataType) && dataType !== 'float') {
          existing.dataType = dataType as any;
        } else if (!validDataTypes.includes(existing.dataType) && validDataTypes.includes(dataType)) {
          existing.dataType = dataType as any;
        }
        existing.computationTime += computationTime;
        Object.entries(metrics).forEach(([k, v]) => {
          if (v != null) existing.keyMetrics[k] = v;
        });
        if (extras.diamondAnalysis) existing.diamondAnalysis = extras.diamondAnalysis;
        if (extras.exactInference) existing.exactInference = extras.exactInference;
        if (extras.capacityAnalysis) existing.capacityAnalysis = extras.capacityAnalysis;
        if (extras.cpmAnalysis) existing.cpmAnalysis = extras.cpmAnalysis;
      } else {
        scenarioMap.set(name, {
          scenarioName: name,
          analysisType,
          dataType: dataType as any,
          computationTime,
          status: 'complete',
          keyMetrics: { ...metrics },
          ...extras
        });
      }
    };

    // Reachability scenarios (from Exact Inference / Diamond Analysis views)
    const reachabilityResults = this.analysisStateService.multiScenarioReachabilityResults();
    if (reachabilityResults) {
      for (const [scenarioName, scenario] of reachabilityResults.scenarios) {
        const scenarioInfo = reachabilityResults.availableScenarios.find(s => s.name === scenarioName);
        const da = scenario.diamond_analysis;
        const ei = scenario.exact_inference;
        const beliefStats = ei?.belief_statistics;

        mergeInto(scenarioName, 'reachability', scenarioInfo?.dataType || 'float',
          Math.round(scenario.scenario_computation_time * 1000),
          {
            meanBelief: this.extractNumericValue(beliefStats?.mean),
            beliefSpread: beliefStats != null ? this.extractNumericValue(beliefStats.max) != null && this.extractNumericValue(beliefStats.min) != null
              ? this.extractNumericValue(beliefStats.max)! - this.extractNumericValue(beliefStats.min)!
              : null : null,
            diamondEfficiency: da?.diamond_efficiency ?? null,
            rootDiamondCount: da?.root_diamonds_count ?? null,
            computationTime: scenario.scenario_computation_time ?? null
          },
          { diamondAnalysis: da, exactInference: ei }
        );
      }
    }

    // Capacity scenarios
    const capacityResults = this.analysisStateService.multiScenarioCapacityResults();
    if (capacityResults) {
      for (const [scenarioName, scenario] of capacityResults.scenarios) {
        const utilization = this.extractNumericValue(scenario.network_utilization);
        const bottleneckCount = Object.keys(scenario.raw_capacity_result?.bottlenecks || {}).length;

        mergeInto(scenarioName, 'capacity', 'float',
          Math.round(scenario.computation_time * 1000),
          {
            networkUtilization: utilization != null ? utilization * 100 : null,
            bottleneckCount,
          },
          { capacityAnalysis: scenario }
        );
      }
    }

    // CPM scenarios
    const cpmResults = this.analysisStateService.multiScenarioCpmResults();
    if (cpmResults) {
      for (const [scenarioName, scenario] of cpmResults.scenarios) {
        const timeResult = scenario.time_result;
        const criticalValue = this.extractNumericValue(timeResult?.critical_value);
        const criticalNodes = timeResult?.critical_nodes?.length ?? null;

        let totalSlack: number | null = null;
        if (timeResult?.total_slack) {
          const slackValues = Object.values(timeResult.total_slack)
            .map((v: any) => this.extractNumericValue(v))
            .filter((v): v is number => v != null);
          if (slackValues.length > 0) {
            totalSlack = slackValues.reduce((a, b) => a + b, 0);
          }
        }

        const totalCost = this.extractNumericValue(scenario.cost_result?.critical_value);

        mergeInto(scenarioName, 'cpm', 'float',
          Math.round(scenario.computation_time * 1000),
          {
            criticalPathDuration: criticalValue,
            totalSlack,
            criticalNodeCount: criticalNodes,
            totalCost,
          },
          { cpmAnalysis: scenario }
        );
      }
    }

    // Update computationTime metric to be total across all analysis types
    for (const [, result] of scenarioMap) {
      result.keyMetrics['computationTime'] = result.computationTime / 1000;
    }

    return scenarioMap;
  }

  // ─── Metric Row Building ─────────────────────────────────────────

  private buildMetricRows(
    scenarioResults: Map<string, ScenarioAnalysisResult>
  ): ScenarioMetricRow[] {
    return Array.from(scenarioResults.entries()).map(([name, result]) => {
      // Determine which analysis types contributed data for this scenario
      const types: string[] = [];
      if (result.diamondAnalysis || result.exactInference) types.push('reachability');
      if (result.capacityAnalysis) types.push('capacity');
      if (result.cpmAnalysis) types.push('cpm');
      if (types.length === 0) types.push(result.analysisType);

      return {
        scenario: name,
        analysisTypes: types,
        dataType: result.dataType,
        status: result.status,
        metrics: { ...result.keyMetrics },
        computationTime: result.computationTime
      };
    });
  }

  // ─── Aggregated Metrics (for heatmap normalisation) ──────────────

  private calculateAggregatedMetrics(rows: ScenarioMetricRow[]): AggregatedMetrics {
    const times = rows.map(r => r.computationTime);
    const metricRanges: Record<string, MetricRange> = {};

    for (const metricDef of PROFILE_METRICS) {
      const values: { scenario: string; value: number }[] = [];
      for (const row of rows) {
        const raw = row.metrics[metricDef.key];
        if (raw != null && typeof raw === 'number' && isFinite(raw)) {
          values.push({ scenario: row.scenario, value: raw });
        }
      }

      if (values.length > 0) {
        const nums = values.map(v => v.value);
        metricRanges[metricDef.key] = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: nums.reduce((a, b) => a + b, 0) / nums.length,
          values
        };
      }
    }

    return {
      scenarioCount: rows.length,
      totalComputationTime: times.reduce((a, b) => a + b, 0),
      averageComputationTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      metricRanges
    };
  }

  // ─── Hotspot Alert Generation ────────────────────────────────────

  private generateHotspotAlerts(
    rows: ScenarioMetricRow[],
    networkInfo: NetworkInfo
  ): HotspotAlert[] {
    const alerts: HotspotAlert[] = [];
    let alertId = 0;

    for (const row of rows) {
      // High utilisation (>90%)
      const util = row.metrics['networkUtilization'];
      if (typeof util === 'number' && util > 90) {
        alerts.push({
          id: `alert-${alertId++}`,
          severity: util > 95 ? 'critical' : 'warning',
          metric: 'Network Utilisation',
          scenario: row.scenario,
          value: `${util.toFixed(1)}%`,
          message: `Network utilisation at ${util.toFixed(1)}% — near saturation`,
          drilldownRoute: '/capacity-analysis',
          drilldownParams: { scenario: row.scenario, highlight: 'utilization' }
        });
      }

      // Many bottlenecks (>3)
      const bottlenecks = row.metrics['bottleneckCount'];
      if (typeof bottlenecks === 'number' && bottlenecks > 3) {
        alerts.push({
          id: `alert-${alertId++}`,
          severity: bottlenecks > 5 ? 'critical' : 'warning',
          metric: 'Bottlenecks',
          scenario: row.scenario,
          value: bottlenecks,
          message: `${bottlenecks} bottleneck nodes detected`,
          drilldownRoute: '/capacity-analysis',
          drilldownParams: { scenario: row.scenario, highlight: 'bottlenecks' }
        });
      }

      // Low total slack (<= 0 means no scheduling buffer)
      const slack = row.metrics['totalSlack'];
      if (typeof slack === 'number' && slack <= 0) {
        alerts.push({
          id: `alert-${alertId++}`,
          severity: 'critical',
          metric: 'Total Slack',
          scenario: row.scenario,
          value: slack.toFixed(1),
          message: `Zero or negative total slack — no scheduling buffer`,
          drilldownRoute: '/time-analysis',
          drilldownParams: { scenario: row.scenario, highlight: 'slack' }
        });
      } else if (typeof slack === 'number' && slack < 5) {
        alerts.push({
          id: `alert-${alertId++}`,
          severity: 'warning',
          metric: 'Total Slack',
          scenario: row.scenario,
          value: slack.toFixed(1),
          message: `Low total slack (${slack.toFixed(1)}) — limited scheduling flexibility`,
          drilldownRoute: '/time-analysis',
          drilldownParams: { scenario: row.scenario, highlight: 'slack' }
        });
      }

      // Low mean belief (< 0.5 means poor reachability)
      const belief = row.metrics['meanBelief'];
      if (typeof belief === 'number' && belief < 0.5) {
        alerts.push({
          id: `alert-${alertId++}`,
          severity: belief < 0.3 ? 'critical' : 'warning',
          metric: 'Mean Belief',
          scenario: row.scenario,
          value: belief.toFixed(3),
          message: `Low mean sink reachability (${belief.toFixed(3)})`,
          drilldownRoute: '/exact-inference',
          drilldownParams: { scenario: row.scenario }
        });
      }

      // High critical node ratio (> 30% of nodes on critical path)
      const critNodes = row.metrics['criticalNodeCount'];
      if (typeof critNodes === 'number' && critNodes > 0) {
        const ratio = critNodes / networkInfo.totalNodes;
        if (ratio > 0.3) {
          alerts.push({
            id: `alert-${alertId++}`,
            severity: ratio > 0.5 ? 'critical' : 'warning',
            metric: 'Critical Nodes',
            scenario: row.scenario,
            value: critNodes,
            message: `${critNodes} critical nodes (${(ratio * 100).toFixed(0)}% of network)`,
            drilldownRoute: '/time-analysis',
            drilldownParams: { scenario: row.scenario, highlight: 'critical-path' }
          });
        }
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  }

  // ─── Visualization Data Generation ───────────────────────────────

  private generateVisualizationData(
    _rows: ScenarioMetricRow[],
    _aggregated: AggregatedMetrics
  ): VisualizationDataPoint[] {
    // Scenario cards and heatmap table are rendered directly from metricRows + aggregatedMetrics.
    // No D3 visualization data needed.
    return [];
  }

  // ─── Network Structure ───────────────────────────────────────────

  private getNetworkStructure(networkPath: string): Observable<NetworkStructure> {
    const cached = this.analysisStateService.networkData();
    if (cached) {
      return of(cached);
    }

    return this.http.post<{ network_structure: NetworkStructure }>(
      `${this.baseUrl}/network-structure`,
      { network_path: networkPath }
    ).pipe(
      map(response => response.network_structure)
    );
  }

  private extractNetworkInfo(networkStructure: NetworkStructure, networkPath: string): NetworkInfo {
    const edgeNodeRatio = networkStructure.total_edges / networkStructure.total_nodes;
    const averageDegree = (networkStructure.total_edges * 2) / networkStructure.total_nodes;

    // Compute max degree from outgoing + incoming indices
    let maxDegree = 0;
    for (const node of networkStructure.nodes) {
      const nodeStr = String(node);
      const outDeg = (networkStructure.outgoing_index?.[nodeStr] || []).length;
      const inDeg = (networkStructure.incoming_index?.[nodeStr] || []).length;
      maxDegree = Math.max(maxDegree, outDeg + inDeg);
    }

    let complexityLevel: 'simple' | 'moderate' | 'complex' | 'very-complex';
    if (edgeNodeRatio < 1.2) complexityLevel = 'simple';
    else if (edgeNodeRatio < 1.8) complexityLevel = 'moderate';
    else if (edgeNodeRatio < 2.5) complexityLevel = 'complex';
    else complexityLevel = 'very-complex';

    // Detect topology type from structure
    // If the backend computed iteration_sets, the graph is a DAG (topological ordering
    // only exists for acyclic graphs). A "tree" is a DAG with no forks or joins.
    const hasIterationSets = (networkStructure.iteration_sets?.length ?? 0) > 0;
    const isTree = networkStructure.fork_nodes.length === 0 && networkStructure.join_nodes.length === 0;
    const topologyType: 'tree' | 'dag' | 'cyclic' | 'mixed' =
      hasIterationSets ? (isTree ? 'tree' : 'dag') : 'cyclic';

    return {
      name: networkPath.split('/').pop() || 'Unknown Network',
      totalNodes: networkStructure.total_nodes,
      totalEdges: networkStructure.total_edges,
      sourceNodes: networkStructure.source_nodes,
      sinkNodes: networkStructure.sink_nodes,
      forkNodes: networkStructure.fork_nodes,
      joinNodes: networkStructure.join_nodes,
      complexity: {
        level: complexityLevel,
        score: Math.min(100, edgeNodeRatio * 40),
        edgeNodeRatio,
        averageDegree,
        maxDegree
      },
      topology: {
        type: topologyType,
        layers: networkStructure.iteration_sets_count,
        maxWidth: Math.max(...networkStructure.iteration_sets.map(set => set.length)),
        branchingFactor: networkStructure.fork_nodes.length / Math.max(networkStructure.source_nodes.length, 1),
        convergencePoints: networkStructure.join_nodes.length
      }
    };
  }

  // ─── Utility ─────────────────────────────────────────────────────

  /**
   * Extract a numeric value from a response field that may be a float,
   * interval (take midpoint), or pbox (take mean midpoint).
   */
  private extractNumericValue(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value === 'object') {
      // Interval: { lower, upper } (with or without type field)
      if (typeof value.lower === 'number' && typeof value.upper === 'number') {
        return (value.lower + value.upper) / 2;
      }
      // Pbox: { type: 'pbox', mean_lower, mean_upper }
      if (typeof value.mean_lower === 'number' && typeof value.mean_upper === 'number') {
        return (value.mean_lower + value.mean_upper) / 2;
      }
    }
    return null;
  }
}
