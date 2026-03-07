import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  CapacityV2AnalysisType,
  CapacityV2BottleneckEntity,
  CapacityV2ComparativeEntity,
  CapacityV2DeterministicEntity,
  CapacityV2FlowEdge,
  CapacityV2FlowNode,
  CapacityV2InputRow,
  CapacityV2Interval,
  CapacityV2IntervalEntity,
  CapacityV2ResultEntity,
  CapacityV2RunInputs,
  CapacityV2UpgradeEntity,
  CapacityV2Validation
} from './capacity-v2.models';

interface CapacityV2ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class CapacityV2Service {
  private readonly apiBase = 'http://localhost:8080';
  private readonly http = inject(HttpClient);

  analyze(inputs: CapacityV2RunInputs): Observable<CapacityV2ResultEntity> {
    const payload = this.buildRequestPayload(inputs);

    console.log('🚀 CAPACITY V2 REQUEST PAYLOAD DEBUG:');
    console.log('📋 Complete payload object:', JSON.stringify(payload, null, 2));
    console.log('🔍 Key fields:');
    console.log(`  networkPath: '${payload['networkPath']}' (type: ${typeof payload['networkPath']})`);
    console.log(`  edgesFilePath: '${payload['edgesFilePath']}' (type: ${typeof payload['edgesFilePath']})`);
    console.log(`  capacitiesPath: '${payload['capacitiesPath']}' (type: ${typeof payload['capacitiesPath']})`);
    console.log(`  uncertaintyMode: '${payload['uncertaintyMode']}'`);
    console.log('📊 Options:', payload['options']);
    console.log('🚀 Sending HTTP POST to:', `${this.apiBase}/capacity-analysis`);

    return this.http
      .post<CapacityV2ApiResponse>(`${this.apiBase}/capacity-analysis`, payload)
      .pipe(map((response) => this.normalizeResponse(response, inputs.analysisType)));
  }

  normalizeInputRowValue(value: unknown, fallback = 0): { deterministic: number; interval: CapacityV2Interval } {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return {
        deterministic: value,
        interval: { min: value, max: value }
      };
    }

    const interval = this.normalizeIntervalLike(value);
    if (interval) {
      return {
        deterministic: (interval.min + interval.max) / 2,
        interval
      };
    }

    return {
      deterministic: fallback,
      interval: { min: fallback, max: fallback }
    };
  }

  private buildRequestPayload(inputs: CapacityV2RunInputs): Record<string, unknown> {
    const buildMap = (rows: CapacityV2InputRow[]): Record<string, number | { min: number; max: number }> => {
      return rows.reduce<Record<string, number | { min: number; max: number }>>((acc, row) => {
        if (inputs.analysisType === 'interval') {
          acc[row.key] = { min: row.interval.min, max: row.interval.max };
        } else {
          acc[row.key] = row.deterministic;
        }
        return acc;
      }, {});
    };

    const nodeMap = buildMap(inputs.nodeCapacities);
    const edgeMap = buildMap(inputs.edgeCapacities);
    const sourceMap = buildMap(inputs.sourceRates);

    // LEGACY-STYLE PATH SHAPING: Match exact pattern from capacity-analysis.component.ts
    // 1. networkPath: use full session/analysis path as-is (e.g., temp_uploads/.../water)
    const baseNetworkPath = this.normalizePath(inputs.networkPath);
    
    // 2. edgesFilePath: just the filename (backend will joinpath)
    const edgesFilePath = this.extractFilename(inputs.edgesFilePath);
    
    // 3. capacitiesPath: relative path after stripping network folder prefix if present
    const networkName = baseNetworkPath.split('/').filter(p => p.length > 0).pop() || '';
    let capacitiesPath = this.normalizePath(inputs.capacitiesPath);
    if (networkName && capacitiesPath.startsWith(`${networkName}/`)) {
      capacitiesPath = capacitiesPath.substring(networkName.length + 1);
    }

    const payload = {
      networkPath: baseNetworkPath,
      edgesFilePath,
      capacitiesPath,
      uncertaintyMode: inputs.analysisType,
      targetNodes: inputs.targetNodes,
      options: {
        compute_all_min_cuts: inputs.options.computeAllMinCuts,
        enumerate_critical_paths: inputs.options.enumerateCriticalPaths,
        compute_upgrade_priorities: inputs.options.computeUpgradePriorities,
        include_classical_comparison: inputs.options.includeClassicalComparison,
        verbosity: inputs.options.verbosity
      },
      nodeCapacities: nodeMap,
      edgeCapacities: edgeMap,
      sourceRates: sourceMap
    };

    // Debug logging
    console.log('🔸 CAPACITY API REQUEST:', {
      uncertaintyMode: payload.uncertaintyMode,
      paths: {
        networkPath: baseNetworkPath.substring(0, 50) + (baseNetworkPath.length > 50 ? '...' : ''),
        edgesFilePath,
        capacitiesPath
      },
      capacities: {
        nodeCount: Object.keys(nodeMap).length,
        edgeCount: Object.keys(edgeMap).length,
        sourceCount: Object.keys(sourceMap).length,
        firstNode: Object.entries(nodeMap).slice(0, 1),
        firstEdge: Object.entries(edgeMap).slice(0, 1)
      }
    });

    return payload;
  }

  private normalizeResponse(response: CapacityV2ApiResponse, requestedType: CapacityV2AnalysisType): CapacityV2ResultEntity {
    if (response.success === false) {
      throw new Error(response.message || response.error || 'Capacity analysis failed');
    }

    const isInterval = requestedType === 'interval' || this.hasIntervalFields(response);
    return isInterval
      ? { kind: 'interval', interval: this.normalizeIntervalEntity(response) }
      : { kind: 'deterministic', deterministic: this.normalizeDeterministicEntity(response) };
  }

  private hasIntervalFields(response: Record<string, unknown>): boolean {
    return (
      typeof response['guaranteed_min_flow'] === 'number' ||
      typeof response['possible_max_flow'] === 'number' ||
      typeof response['expected_flow'] === 'number'
    );
  }

  private normalizeIntervalEntity(raw: Record<string, unknown>): CapacityV2IntervalEntity {
    const worstRaw = this.asRecord(raw['worst_case_scenario']);
    const bestRaw = this.asRecord(raw['best_case_scenario']);

    return {
      summary: {
        throughput: {
          min: this.num(raw['guaranteed_min_flow']),
          max: this.num(raw['possible_max_flow'])
        },
        utilization: this.normalizeDeterministicEntity(worstRaw).summary.utilization,
        computationTimeMs: this.num(raw['computation_time_ms']),
        expectedFlow: this.num(raw['expected_flow']),
        uncertaintyRange: this.num(raw['uncertainty_range'])
      },
      robustBottlenecks: this.asStringArray(raw['robust_bottlenecks']),
      potentialBottlenecks: this.asStringArray(raw['potential_bottlenecks']),
      componentsMostUncertain: this.asArray(raw['components_most_uncertain']).map((item) => {
        const rec = this.asRecord(item);
        return {
          component: this.str(rec['component']),
          impact: this.num(rec['impact'])
        };
      }),
      worstCase: this.normalizeDeterministicEntity(worstRaw),
      bestCase: this.normalizeDeterministicEntity(bestRaw)
    };
  }

  private normalizeDeterministicEntity(raw: Record<string, unknown>): CapacityV2DeterministicEntity {
    const bottlenecksRaw = this.asRecord(raw['bottlenecks']);
    const upgradesRaw = this.asRecord(raw['upgrade_priorities']);
    const pathsRaw = this.asRecord(raw['critical_paths']);
    const comparativeRaw = this.asRecord(raw['comparative_analysis']);
    const metadataRaw = this.asRecord(raw['metadata']);

    return {
      summary: {
        throughput: this.num(raw['total_max_flow']),
        utilization: this.num(raw['network_utilization']),
        computationTimeMs: this.num(metadataRaw['computation_time_ms'])
      },
      targetFlows: this.toNumberRecord(raw['target_flows']),
      bottlenecks: this.normalizeBottlenecks(bottlenecksRaw),
      upgrades: this.normalizeUpgrades(upgradesRaw),
      criticalPaths: {
        criticalPaths: this.asArray(pathsRaw['critical_paths']).map((entry) => {
          const item = this.asRecord(entry);
          return {
            path: this.asNumberArray(item['path']),
            capacity: this.num(item['capacity']),
            flow: this.num(item['flow']),
            isSaturated: Boolean(item['is_saturated']),
            spareCapacity: this.num(item['spare_capacity']),
            length: this.num(item['length']),
            bottleneckLocation: this.str(item['bottleneck_location'])
          };
        }),
        pathRedundancy: this.toNumberRecord(pathsRaw['path_redundancy']),
        singlePointsOfFailure: this.asStringArray(pathsRaw['single_points_of_failure'])
      },
      comparative: this.normalizeComparative(comparativeRaw),
      nodeFlows: this.normalizeNodeFlows(raw['node_flows'], bottlenecksRaw),
      edgeFlows: this.normalizeEdgeFlows(raw['edge_flows'], raw['edge_utilization'], bottlenecksRaw),
      validation: this.normalizeValidation(raw['validation']),
      metadata: {
        algorithmUsed: this.str(metadataRaw['algorithm_used']),
        exactnessGuaranteed: Boolean(metadataRaw['exactness_guaranteed']),
        timestamp: this.str(metadataRaw['timestamp'])
      }
    };
  }

  private normalizeBottlenecks(raw: Record<string, unknown>): CapacityV2BottleneckEntity {
    return {
      minCutCapacity: this.num(raw['min_cut_capacity']),
      bottleneckType: this.str(raw['bottleneck_type']),
      minCutEdges: this.normalizeEdgeTupleArray(raw['min_cut_edges']),
      minCutNodes: this.asNumberArray(raw['min_cut_nodes']),
      saturatedEdges: this.normalizeEdgeTupleArray(raw['saturated_edges']),
      saturatedNodes: this.asNumberArray(raw['saturated_nodes']),
      nearSaturatedEdges: this.asArray(raw['near_saturated_edges']).map((entry) => {
        const item = this.asRecord(entry);
        return {
          edge: this.normalizeEdgeTuple(item['edge']),
          utilization: this.num(item['utilization'])
        };
      }),
      nearSaturatedNodes: this.asArray(raw['near_saturated_nodes']).map((entry) => {
        const item = this.asRecord(entry);
        return {
          node: this.num(item['node']),
          utilization: this.num(item['utilization'])
        };
      }),
      totalSpareEdgeCapacity: this.num(raw['total_spare_edge_capacity']),
      totalSpareNodeCapacity: this.num(raw['total_spare_node_capacity'])
    };
  }

  private normalizeUpgrades(raw: Record<string, unknown>): CapacityV2UpgradeEntity {
    return {
      edgePriorities: this.asArray(raw['edge_priorities']).map((entry) => {
        const item = this.asRecord(entry);
        return {
          edge: this.normalizeEdgeTuple(item['edge']),
          currentCapacity: this.num(item['current_capacity']),
          currentFlow: this.num(item['current_flow']),
          currentUtilization: this.num(item['current_utilization']),
          marginalValue: this.num(item['marginal_value']),
          recommendedCapacity: this.num(item['recommended_capacity']),
          expectedFlowIncrease: this.num(item['expected_flow_increase']),
          priorityScore: this.num(item['priority_score']),
          rationale: this.str(item['rationale'])
        };
      }),
      nodePriorities: this.asArray(raw['node_priorities']).map((entry) => {
        const item = this.asRecord(entry);
        return {
          node: this.num(item['node']),
          currentCapacity: this.num(item['current_capacity']),
          currentFlow: this.num(item['current_flow']),
          currentUtilization: this.num(item['current_utilization']),
          marginalValue: this.num(item['marginal_value']),
          recommendedCapacity: this.num(item['recommended_capacity']),
          expectedFlowIncrease: this.num(item['expected_flow_increase']),
          priorityScore: this.num(item['priority_score']),
          rationale: this.str(item['rationale'])
        };
      }),
      primaryBottleneck: this.str(raw['primary_bottleneck']),
      recommendedAction: this.str(raw['recommended_action'])
    };
  }

  private normalizeComparative(raw: Record<string, unknown>): CapacityV2ComparativeEntity {
    return {
      realisticMaxFlow: this.num(raw['realistic_max_flow']),
      classicalMaxFlow: this.num(raw['classical_max_flow']),
      efficiencyLoss: this.num(raw['efficiency_loss']),
      primaryLimitation: this.str(raw['primary_limitation']),
      strategicRecommendation: this.str(raw['strategic_recommendation'])
    };
  }

  private normalizeValidation(rawValue: unknown): CapacityV2Validation {
    const raw = this.asRecord(rawValue);
    return {
      allChecksPassed: Boolean(raw['all_checks_passed']),
      flowConservationSatisfied: Boolean(raw['flow_conservation_satisfied']),
      maxConservationError: this.num(raw['max_conservation_error']),
      capacityConstraintsSatisfied: Boolean(raw['capacity_constraints_satisfied']),
      optimalityVerified: Boolean(raw['optimality_verified']),
      warnings: this.asStringArray(raw['warnings']),
      errors: this.asStringArray(raw['errors'])
    };
  }

  private normalizeNodeFlows(rawValue: unknown, bottlenecksRaw: Record<string, unknown>): CapacityV2FlowNode[] {
    const record = this.asRecord(rawValue);
    const utilByComponent = this.toNumberRecord(this.asRecord(bottlenecksRaw['utilization_by_component']));

    return Object.keys(record).map((key) => ({
      nodeId: this.num(key),
      flow: this.num(record[key]),
      utilization: this.num(utilByComponent[key])
    }));
  }

  private normalizeEdgeFlows(
    rawValue: unknown,
    edgeUtilizationRaw: unknown,
    bottlenecksRaw: Record<string, unknown>
  ): CapacityV2FlowEdge[] {
    const record = this.asRecord(rawValue);
    const utilByComponent = this.toNumberRecord(this.asRecord(bottlenecksRaw['utilization_by_component']));
    const edgeUtilizationLookup = this.buildEdgeUtilizationLookup(edgeUtilizationRaw);

    return Object.keys(record).map((edgeKey) => {
      const tuple = this.parseEdgeKey(edgeKey);
      const normalizedEdgeKeyNoSpaces = `(${tuple[0]},${tuple[1]})`;
      const normalizedEdgeKeyWithSpaces = `(${tuple[0]}, ${tuple[1]})`;
      const canonicalEdgeKey = normalizedEdgeKeyNoSpaces;

      const fromEdgeUtilization = this.num(
        edgeUtilizationLookup[canonicalEdgeKey] ??
          edgeUtilizationLookup[normalizedEdgeKeyWithSpaces] ??
          edgeUtilizationLookup[edgeKey]
      );

      const fromUtilizationByComponent = this.num(
        utilByComponent[normalizedEdgeKeyWithSpaces] ?? utilByComponent[normalizedEdgeKeyNoSpaces]
      );

      return {
        edgeKey,
        from: tuple[0],
        to: tuple[1],
        flow: this.num(record[edgeKey]),
        utilization:
          fromEdgeUtilization > 0
            ? fromEdgeUtilization
            : fromUtilizationByComponent > 0
              ? fromUtilizationByComponent
              : this.computeUtilizationFromEdgeRecord(edgeUtilizationRaw, edgeKey, normalizedEdgeKeyNoSpaces, normalizedEdgeKeyWithSpaces)
      };
    });
  }

  private buildEdgeUtilizationLookup(rawValue: unknown): Record<string, number> {
    const edgeUtilization = this.asRecord(rawValue);
    const lookup: Record<string, number> = {};

    for (const key of Object.keys(edgeUtilization)) {
      const entry = this.asRecord(edgeUtilization[key]);
      const tuple = this.parseEdgeKey(key);
      const canonicalKey = `(${tuple[0]},${tuple[1]})`;
      const directUtilization = this.num(entry['utilization']);
      const fallbackUtilization = this.computeUtilizationFromFlowAndCapacity(entry);
      const utilization = directUtilization > 0 ? directUtilization : fallbackUtilization;

      if (utilization > 0) {
        lookup[key] = utilization;
        lookup[canonicalKey] = utilization;
        lookup[`(${tuple[0]}, ${tuple[1]})`] = utilization;
      }
    }

    return lookup;
  }

  private computeUtilizationFromEdgeRecord(
    edgeUtilizationRaw: unknown,
    edgeKey: string,
    normalizedEdgeKeyNoSpaces: string,
    normalizedEdgeKeyWithSpaces: string
  ): number {
    const edgeUtilization = this.asRecord(edgeUtilizationRaw);
    const entry = this.asRecord(
      edgeUtilization[edgeKey] ??
        edgeUtilization[normalizedEdgeKeyNoSpaces] ??
        edgeUtilization[normalizedEdgeKeyWithSpaces]
    );
    return this.computeUtilizationFromFlowAndCapacity(entry);
  }

  private computeUtilizationFromFlowAndCapacity(edgeRecord: Record<string, unknown>): number {
    const flow = this.num(edgeRecord['flow']);
    const capacity = this.num(edgeRecord['capacity']);
    if (capacity <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(flow / capacity, 1));
  }

  private normalizeEdgeTupleArray(raw: unknown): [number, number][] {
    return this.asArray(raw).map((entry) => this.normalizeEdgeTuple(entry));
  }

  private normalizeEdgeTuple(raw: unknown): [number, number] {
    const arr = this.asArray(raw);
    return [this.num(arr[0]), this.num(arr[1])];
  }

  private parseEdgeKey(edgeKey: string): [number, number] {
    const cleaned = edgeKey.replace(/[()\s]/g, '');
    const [left, right] = cleaned.split(',');
    return [this.num(left), this.num(right)];
  }

  private normalizeIntervalLike(value: unknown): CapacityV2Interval | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const source = value as Record<string, unknown>;
    const min = this.num(source['min'] ?? source['lower']);
    const max = this.num(source['max'] ?? source['upper']);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return null;
    }

    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  private normalizePath(value: string): string {
    return (value || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  }

  private extractFilename(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    if (!normalized) {
      return '';
    }
    const parts = normalized.split('/').filter((part) => part.length > 0);
    return parts[parts.length - 1] || normalized;
  }

  private normalizeEdgesFilePath(edgesFilePathRaw: string): string {
    return this.extractFilename(edgesFilePathRaw);
  }

  private extractNetworkNameFromEdgesFile(edgesFilePath: string): string {
    const fileName = this.extractFilename(edgesFilePath);
    if (!fileName.toLowerCase().endsWith('.edges')) {
      return '';
    }
    return fileName.substring(0, fileName.length - '.EDGES'.length);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asStringArray(value: unknown): string[] {
    return this.asArray(value).map((item) => this.str(item)).filter((item) => item.length > 0);
  }

  private asNumberArray(value: unknown): number[] {
    return this.asArray(value).map((item) => this.num(item));
  }

  private toNumberRecord(value: unknown): Record<string, number> {
    const record = this.asRecord(value);
    return Object.keys(record).reduce<Record<string, number>>((acc, key) => {
      acc[key] = this.num(record[key]);
      return acc;
    }, {});
  }

  private num(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private str(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
