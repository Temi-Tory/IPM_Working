import { FlowAnalysisRequest } from '@inf-prop/shared/api-client';

/** Solver + diagnostic limits for one `/flow-analysis` run. */
export interface FlowRunOptions {
  algorithm: 'dinic' | 'edmonds_karp' | 'push_relabel';
  tol: number;
  kFailure: number;
  cutLimit: number;
  pathLimit: number;
  combinationLimit: number;
  maxDepth: number;
  /** optional throughput target for the parametric threshold search */
  targetFlow: number | null;
  /** optional degradation multipliers for the failure-impact sweep */
  degradationScenarios: number[] | null;
  includeNodeCapacities: boolean;
}

export const DEFAULT_FLOW_RUN_OPTIONS: FlowRunOptions = {
  algorithm: 'dinic',
  tol: 1e-10,
  kFailure: 2,
  cutLimit: 1000,
  pathLimit: 10_000,
  combinationLimit: 10_000,
  maxDepth: 64,
  targetFlow: null,
  degradationScenarios: null,
  includeNodeCapacities: true,
};

export const FLOW_ALGORITHMS: ReadonlyArray<{
  value: FlowRunOptions['algorithm'];
  label: string;
  hint: string;
}> = [
  {
    value: 'dinic',
    label: 'Dinic',
    hint: 'The default for most layered DAGs.',
  },
  {
    value: 'edmonds_karp',
    label: 'Edmonds–Karp',
    hint: 'Most useful for smaller networks and debugging.',
  },
  {
    value: 'push_relabel',
    label: 'Push–Relabel',
    hint: 'Particularly useful in dense or high fan-out networks.',
  },
];

/** Parse the comma-separated degradation field into a clean number list. */
export function parseDegradationScenarios(raw: string): number[] | null {
  const values = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number(token))
    .filter((n) => Number.isFinite(n));
  return values.length ? values : null;
}

/** Map the view-model options onto the frozen request contract. */
export function toAnalysisOptions(
  options: FlowRunOptions,
): NonNullable<FlowAnalysisRequest['analysisOptions']> {
  return {
    algorithm: options.algorithm,
    tol: options.tol,
    kFailure: options.kFailure,
    cutLimit: options.cutLimit,
    pathLimit: options.pathLimit,
    combinationLimit: options.combinationLimit,
    maxDepth: options.maxDepth,
    targetFlow: options.targetFlow,
    degradationScenarios: options.degradationScenarios,
    includeNodeCapacities: options.includeNodeCapacities,
  };
}
