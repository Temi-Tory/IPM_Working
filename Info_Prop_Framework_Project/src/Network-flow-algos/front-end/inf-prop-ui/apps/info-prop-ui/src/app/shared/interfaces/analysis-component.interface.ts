import { NetworkStructure, AnalysisResponse, ScenarioInfo } from '../models/network-analysis.models';

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

// **NEW: Enhanced interfaces for scenario-aware components**
export interface ScenarioAwareComponent extends AnalysisComponent {
  availableScenarios: ScenarioInfo[];
  currentScenario: string | null;
  scenarioResults: Map<string, any>;

  loadScenarios(): void;
  setCurrentScenario(scenarioName: string): void;
  loadScenarioData(scenarioName: string): void;
  clearScenarioData?(): void;
}

export interface MultiScenarioVisualizationComponent extends ScenarioAwareComponent {
  visualizationMode: string;
  showScenarioComparison: boolean;

  updateVisualization(): void;
  updateScenarioVisualization(scenarioName: string): void;
  compareScenarios(scenarios: string[]): void;
  resetView?(): void;
  zoomIn?(): void;
  zoomOut?(): void;
}

// **NEW: Scenario management interface for services**
export interface ScenarioManagerService {
  detectAvailableScenarios(): ScenarioInfo[];
  extractScenariosFromFiles(files: any[]): ScenarioInfo[];
  groupScenariosByType(scenarios: ScenarioInfo[]): Record<string, ScenarioInfo[]>;
  validateScenarioData(scenario: ScenarioInfo): boolean;
}