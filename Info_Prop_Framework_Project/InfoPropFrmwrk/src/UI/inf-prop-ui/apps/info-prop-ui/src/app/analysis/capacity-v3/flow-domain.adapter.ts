import { FlowAnalysisDomainResult } from './flow-domain.models';

interface RecordLike {
  [key: string]: unknown;
}

const asRecord = (value: unknown): RecordLike =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asEdge = (value: unknown): [number, number] => {
  const tuple = asArray(value);
  return [asNumber(tuple[0]), asNumber(tuple[1])];
};

const asSinkFlow = (value: unknown): Array<{ sinkNode: number; flow: number }> => {
  return asArray(value).map((entry) => {
    const pair = asArray(entry);
    return { sinkNode: asNumber(pair[0]), flow: asNumber(pair[1]) };
  });
};

export function mapFlowAnalysisResponseToDomain(raw: unknown): FlowAnalysisDomainResult {
  const payload = asRecord(raw);
  const capacityResult = asRecord(payload['capacity_result']);

  const metadata = asRecord(capacityResult['metadata']);
  const flow = asRecord(capacityResult['flow']);
  const sensitivity = asRecord(capacityResult['sensitivity']);
  const failureImpact = asRecord(capacityResult['failure_impact']);
  const structure = asRecord(capacityResult['structure']);
  const flowDecomposition = asRecord(capacityResult['flow_decomposition']);
  const parametricThresholds = asRecord(capacityResult['parametric_thresholds']);
  const minCutAnalysis = asRecord(capacityResult['min_cut_analysis']);
  const nodeCapacitated = asRecord(capacityResult['node_capacitated']);

  const representativeCut = asRecord(minCutAnalysis['representative_cut']);
  const enumeration = asRecord(minCutAnalysis['enumeration']);

  const result: FlowAnalysisDomainResult = {
    metadata: {
      algorithm: asString(metadata['algorithm']),
      tol: asNumber(metadata['tol']),
      baselineMaxFlow: asNumber(metadata['baseline_max_flow'])
    },
    flow: {
      maxFlow: asNumber(flow['max_flow']),
      mincutCapacity: asNumber(flow['mincut_capacity']),
      sinkFlow: asSinkFlow(flow['sink_flow']),
      saturatedEdges: asArray(flow['saturated_edges']).map(asEdge),
      mincutS: asArray(flow['mincut_S']).map(asNumber),
      mincutT: asArray(flow['mincut_T']).map(asNumber),
      isUnbounded: Boolean(flow['is_unbounded'])
    },
    sensitivity: {
      criticalEdges: asArray(sensitivity['critical_edges']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          drop: asNumber(row['drop']),
          baselineFlow: asNumber(row['baseline_flow']),
          perturbedFlow: asNumber(row['perturbed_flow'])
        };
      }),
      marginalCapacity: asArray(sensitivity['marginal_capacity']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          value: asNumber(row['value'])
        };
      }),
      birnbaum: asArray(sensitivity['birnbaum']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          value: asNumber(row['value'])
        };
      })
    },
    failureImpact: {
      minCutEdges: asArray(failureImpact['min_cut_edges']).map(asEdge),
      singleEdgeFailures: asArray(failureImpact['single_edge_failures']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          drop: asNumber(row['drop']),
          perturbedFlow: asNumber(row['perturbed_flow']),
          isCritical: Boolean(row['is_critical']),
          isUnbounded: Boolean(row['is_unbounded'])
        };
      }),
      kEdgeFailures: asArray(failureImpact['k_edge_failures']).map((item) => {
        const row = asRecord(item);
        return {
          edges: asArray(row['edges']).map(asEdge),
          drop: asNumber(row['drop']),
          perturbedFlow: asNumber(row['perturbed_flow']),
          isUnbounded: Boolean(row['is_unbounded'])
        };
      }),
      degradationResults: asArray(failureImpact['degradation_results']).map((item) => {
        const row = asRecord(item);
        return {
          scenarioId: asNumber(row['scenario_id']),
          maxFlow: asNumber(row['max_flow']),
          dropFromBaseline: asNumber(row['drop_from_baseline']),
          sinkFlow: asSinkFlow(row['sink_flow']),
          isUnbounded: Boolean(row['is_unbounded'])
        };
      })
    },
    structure: {
      spofEdges: asArray(structure['spof_edges']).map(asEdge),
      spofNodes: asArray(structure['spof_nodes']).map(asNumber),
      paths: asArray(structure['paths']).map((path) => asArray(path).map(asNumber)),
      edgeRedundancy: asArray(structure['edge_redundancy']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          score: asNumber(row['score'])
        };
      }),
      bottleneckRanking: asArray(structure['bottleneck_ranking']).map((item) => {
        const row = asRecord(item);
        return {
          edge: asEdge(row['edge']),
          rank: asNumber(row['rank']),
          flow: asNumber(row['flow']),
          capacity: asNumber(row['capacity']),
          residualCapacity: asNumber(row['residual_capacity'])
        };
      }),
      nodePositions: Object.fromEntries(
        Object.entries(asRecord(structure['node_positions'])).map(([k, v]) => [k, asString(v)])
      )
    },
    flowDecomposition: {
      totalFlow: asNumber(flowDecomposition['total_flow']),
      isUnique: Boolean(flowDecomposition['is_unique']),
      components: asArray(flowDecomposition['components']).map((item) => {
        const row = asRecord(item);
        return {
          path: asArray(row['path']).map(asNumber),
          flowValue: asNumber(row['flow_value']),
          bottleneckEdge: asEdge(row['bottleneck_edge'])
        };
      })
    },
    parametricThresholds: {
      baselineFlow: asNumber(parametricThresholds['baseline_flow']),
      targetFlow: asNumber(parametricThresholds['target_flow']),
      degradationThresholds: asArray(parametricThresholds['degradation_thresholds']).map((item) => {
        const row = asRecord(item);
        return {
          targetEdge: asEdge(row['target_edge']),
          originalCapacity: asNumber(row['original_capacity']),
          thresholdCapacity: asNumber(row['threshold_capacity']),
          degradationMargin: asNumber(row['degradation_margin']),
          targetAchievable: Boolean(row['target_achievable']),
          targetReachableAtZero: Boolean(row['target_reachable_at_zero']),
          solverCalls: asNumber(row['solver_calls'])
        };
      })
    },
    minCutAnalysis: {
      maxFlow: asNumber(minCutAnalysis['max_flow']),
      minCutCapacity: asNumber(minCutAnalysis['min_cut_capacity']),
      representativeCut: {
        s: asArray(representativeCut['S']).map(asNumber),
        t: asArray(representativeCut['T']).map(asNumber),
        crossingEdges: asArray(representativeCut['crossing_edges']).map(asEdge),
        capacity: asNumber(representativeCut['capacity'])
      },
      edgesInSomeCut: asArray(minCutAnalysis['edges_in_some_cut']).map(asEdge),
      edgesInEveryCut: asArray(minCutAnalysis['edges_in_every_cut']).map(asEdge),
      enumeration: {
        totalCuts: asNumber(enumeration['total_cuts']),
        isComplete: Boolean(enumeration['is_complete']),
        freeZoneSize: asNumber(enumeration['free_zone_size'])
      }
    }
  };

  if (Object.keys(nodeCapacitated).length > 0) {
    result.nodeCapacitated = {
      maxFlow: asNumber(nodeCapacitated['max_flow']),
      sinkFlow: asSinkFlow(nodeCapacitated['sink_flow']),
      saturatedNodes: asArray(nodeCapacitated['saturated_nodes']).map(asNumber),
      spofNodes: asArray(nodeCapacitated['spof_nodes']).map(asNumber)
    };
  }

  return result;
}
