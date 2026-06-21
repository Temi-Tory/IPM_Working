import { FlowAnalysisDomainResult } from './flow-domain.models';

export type WorkbenchRunState = 'idle' | 'running' | 'success' | 'error';

export interface EditableCapacityRow {
  key: string;
  value: number;
  selected: boolean;
}

export interface FlowScenarioOption {
  name: string;
  label: string;
  networkPath: string;
  edgesFilePath: string;
  capacitiesPath: string;
}

export interface FlowWorkbenchOptions {
  algorithm: 'dinic' | 'edmonds_karp' | 'push_relabel';
  tol: number;
  kFailure: number;
  cutLimit: number;
  pathLimit: number;
  combinationLimit: number;
  maxDepth: number;
  targetFlow?: number;
  includeNodeCapacities: boolean;
}

export interface FlowScenarioRun {
  scenario: FlowScenarioOption;
  status: WorkbenchRunState;
  error: string | null;
  updatedAt: string | null;
  result: FlowAnalysisDomainResult | null;
}

export interface FlowScenarioDraftRecord {
  id: string;
  name: string;
  createdAt: string;
  sourceScenario: string;
  nodeOverrides: Record<string, number>;
  edgeOverrides: Record<string, number>;
  sourceOverrides: Record<string, number>;
}
