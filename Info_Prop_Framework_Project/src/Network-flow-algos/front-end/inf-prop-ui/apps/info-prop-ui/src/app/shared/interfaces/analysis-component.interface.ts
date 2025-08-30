import { NetworkStructure, AnalysisResponse } from '../models/network-analysis.models';

export interface AnalysisComponent {
  networkData: NetworkStructure | null;
  analysisResults: AnalysisResponse | null;
  isLoading: boolean;
  error: string | null;

  loadData(): void;
  exportData?(): void;
  refreshAnalysis?(): void;
}

export interface VisualizationComponent extends AnalysisComponent {
  visualizationMode: string;
  
  updateVisualization(): void;
  resetView?(): void;
  zoomIn?(): void;
  zoomOut?(): void;
}