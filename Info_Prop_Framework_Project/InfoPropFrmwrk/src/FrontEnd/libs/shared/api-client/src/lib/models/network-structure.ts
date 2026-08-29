import { AnalysisEnvelope } from './envelope';

/**
 * `POST /network-structure`. If `edgesFilePath` is omitted the server
 * reconstructs the edge list from whatever analysis-input files the session
 * holds (their edge keys) — a self-consistent set of analysis files from one
 * upload is enough to drive any toolkit.
 */
export interface NetworkStructureRequest {
  networkPath: string;
  edgesFilePath?: string;
}

/** Roles fall out of graph position, not per-analysis labelling. */
export interface NetworkStructure {
  computation_time: number;
  total_nodes: number;
  total_edges: number;
  nodes: number[];
  edges: [number, number][];
  /** No incoming edge. */
  source_nodes: number[];
  /** No outgoing edge. */
  sink_nodes: number[];
  /** Fan-out >= 2 — how systems distribute and build in redundancy. */
  fork_nodes: number[];
  /** Fan-in >= 2 — where distributed or redundant routes reconverge. */
  join_nodes: number[];
  /** Topological layers; the UI renders the graph from these. */
  iteration_sets: number[][];
  iteration_sets_count: number;
  ancestors: Record<string, number[]>;
  descendants: Record<string, number[]>;
  outgoing_index: Record<string, number[]>;
  incoming_index: Record<string, number[]>;
}

export interface NetworkStructureResponse extends AnalysisEnvelope {
  edges_file_path: string;
  network_structure: NetworkStructure;
}
