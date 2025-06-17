import { DiamondData, AnalysisResult } from "./main-sever-interface";

// Graph structure interfaces
export interface GraphStructure {
  edgelist: [number, number][];
  iteration_sets: number[][];
  outgoing_index: { [key: number]: number[] };
  incoming_index: { [key: number]: number[] };
  source_nodes: number[];
  descendants: { [key: string]: number[] };
  ancestors: { [key: string]: number[] };
  join_nodes: number[];
  fork_nodes: number[];
  node_priors: { [key: string]: number };
  edge_probabilities: { [key: string]: number };
  diamond_structures: DiamondData | null;
}

export interface GraphState {
  isLoaded: boolean;
  csvContent: string;
  structure: GraphStructure | null;
  lastAnalysisResults: AnalysisResult[] | null;
  lastAnalysisType: 'structure' | 'diamond' | 'full' | null;
  error: string | null;
  loadedAt: Date | null;
}