import { Component, OnInit, OnDestroy, computed, signal, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { ReachabilityAnalysisService } from '../../shared/services/reachability-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import {
  ScenarioInfo,
  NetworkStructure,
  AnalysisResponse,
  PboxData,
  IntervalData,
  BeliefValue,
  ReachabilityFileGroup
} from '../../shared/models/network-analysis.models';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface InferenceScenario {
  name: string;
  dataType: 'float' | 'interval' | 'pbox';
  path: string;
  displayName: string;
  description: string;
  networkPath: string | undefined;
  nodePriorsFile: any;
  linkProbabilitiesFile: any;
}

interface InferenceResult {
  nodeId: number;
  belief: BeliefValue;
  prior: BeliefValue;
  inferenceMethod: 'Source Node' | 'Tree Propagation' | 'Inclusion-Exclusion' | 'Diamond Enumeration';
  methodColor: string;
  complexityLevel: 'Source' | 'Simple' | 'Moderate' | 'Complex';
  sensitivityScore: number;
  uncertaintyWidth: number | null;
}

interface InferenceMetrics {
  totalNodes: number;
  sourceNodes: number;
  joinNodes: number;
  diamondNodes: number;
  computationTime: number;
  averageBelief: number;
  algorithmComplexity: string;
}

interface ScenarioTabState {
  scenario: InferenceScenario;
  status: 'idle' | 'computing' | 'computed' | 'error';
  results: InferenceResult[];
  metrics: InferenceMetrics | null;
  error: string | null;
  rawResponse: any;
  // Per-tab UI state
  searchTerm: string;
  selectedNodeTypes: string[];
  pageIndex: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
}

interface HistogramBin {
  label: string;
  count: number;
  percentage: number;
}

interface ComparisonRow {
  nodeId: number;
  baseBelief: BeliefValue | null;
  compareBelief: BeliefValue | null;
  delta: number | null;
  deltaPercent: number | null;
  nodeType: string;
}

interface NodeTypeStats {
  type: string;
  count: number;
  avgBelief: number;
  icon: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-exact-inference',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatSelectModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatPaginatorModule,
    MatMenuModule
  ],
  templateUrl: './exact-inference.component.html',
  styleUrl: './exact-inference.component.scss'
})
export class ExactInferenceComponent implements OnInit, OnDestroy, ScenarioAwareComponent {

  // ─── Service injection ────────────────────────────────────────────────────
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private reachabilityAnalysisService = inject(ReachabilityAnalysisService);
  private sessionService = inject(NetworkSessionService);
  private cdr = inject(ChangeDetectorRef);

  // ─── ScenarioAwareComponent interface ─────────────────────────────────────
  networkData: NetworkStructure | null = null;
  analysisResults: AnalysisResponse | null = null;
  isLoading = false;
  error: string | null = null;
  availableScenarios: ScenarioInfo[] = [];
  currentScenario: string | null = null;
  scenarioResults: Map<string, any> = new Map();

  // ─── Tab state management ─────────────────────────────────────────────────
  scenarioTabs = signal<Map<string, ScenarioTabState>>(new Map());
  activeTabIndex = signal(0);

  // Active tab UI state (lightweight signals for frequent updates)
  activeSearchTerm = signal('');
  activeSelectedNodeTypes = signal<string[]>([]);
  activePageIndex = signal(0);
  activePageSize = signal(25);
  activeSortColumn = signal('nodeId');
  activeSortDirection = signal<'asc' | 'desc' | ''>('');


  // ─── Comparison state ─────────────────────────────────────────────────────
  comparisonMode = signal(false);
  baseScenarioName = signal('');
  compareScenarioName = signal('');

  // ─── Node detail state ────────────────────────────────────────────────────
  selectedNodeForComparison = signal<number | null>(null);

  // ─── Copy feedback state ──────────────────────────────────────────────────
  copiedCellKey = signal('');

  // ─── Computed: scenario names (tab order) ─────────────────────────────────
  scenarioNames = computed(() => Array.from(this.scenarioTabs().keys()));

  // ─── Computed: active tab state ───────────────────────────────────────────
  activeTab = computed((): ScenarioTabState | null => {
    const tabs = this.scenarioTabs();
    const keys = Array.from(tabs.keys());
    const idx = this.activeTabIndex();
    if (idx < 0 || idx >= keys.length) return null;
    return tabs.get(keys[idx]) || null;
  });

  // ─── Computed: network info ───────────────────────────────────────────────
  networkInfo = computed(() => {
    const ns = this.analysisStateService.networkData();
    if (!ns) return null;
    return {
      totalNodes: ns.total_nodes || 0,
      totalEdges: ns.total_edges || 0,
      sourceNodes: ns.source_nodes || [],
      sinkNodes: ns.sink_nodes || [],
      forkNodes: ns.fork_nodes || [],
      joinNodes: ns.join_nodes || [],
      iterationSets: ns.iteration_sets || []
    };
  });

  // ─── Computed: filtered + sorted results for active tab ───────────────────
  activeFilteredResults = computed((): InferenceResult[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    let results = [...tab.results];
    const search = this.activeSearchTerm().toLowerCase();
    const types = this.activeSelectedNodeTypes();
    const ni = this.networkInfo();

    // Search filter
    if (search) {
      results = results.filter(r => r.nodeId.toString().includes(search));
    }

    // Node type filter
    if (types.length > 0 && ni) {
      results = results.filter(r => {
        const nodeType = this.getNodeType(r.nodeId, ni);
        return types.some(t => nodeType.includes(t));
      });
    }

    // Sorting
    const col = this.activeSortColumn();
    const dir = this.activeSortDirection();
    if (col && dir) {
      results.sort((a, b) => {
        const valA = this.getSortValue(a, col);
        const valB = this.getSortValue(b, col);
        return dir === 'asc' ? valA - valB : valB - valA;
      });
    }

    return results;
  });

  // ─── Computed: paginated results ──────────────────────────────────────────
  activePaginatedResults = computed((): InferenceResult[] => {
    const filtered = this.activeFilteredResults();
    const start = this.activePageIndex() * this.activePageSize();
    return filtered.slice(start, start + this.activePageSize());
  });

  // ─── Computed: belief histogram ───────────────────────────────────────────
  beliefHistogram = computed((): HistogramBin[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    const buckets = Array(10).fill(0);
    for (const r of tab.results) {
      const v = this.getNumericBelief(r.belief);
      if (v !== null) {
        const bucket = Math.min(Math.floor(v * 10), 9);
        buckets[bucket]++;
      }
    }

    // Trim empty leading/trailing bins
    let firstNonZero = buckets.findIndex(c => c > 0);
    let lastNonZero = buckets.length - 1;
    while (lastNonZero > 0 && buckets[lastNonZero] === 0) lastNonZero--;
    if (firstNonZero === -1) return []; // all empty

    const trimmed = buckets.slice(firstNonZero, lastNonZero + 1);
    const maxCount = Math.max(...trimmed, 1);
    return trimmed.map((count, i) => ({
      label: `${((firstNonZero + i) * 0.1).toFixed(1)}`,
      count,
      percentage: (count / maxCount) * 100
    }));
  });

  // ─── Computed: sink node summary ──────────────────────────────────────────
  sinkNodeSummary = computed(() => {
    const tab = this.activeTab();
    const ni = this.networkInfo();
    if (!tab || !ni || tab.status !== 'computed' || ni.sinkNodes.length === 0) return null;

    const sinkResults = tab.results
      .filter(r => ni.sinkNodes.includes(r.nodeId))
      .sort((a, b) => (this.getNumericBelief(a.belief) ?? 0) - (this.getNumericBelief(b.belief) ?? 0));

    if (sinkResults.length === 0) return null;

    const beliefs = sinkResults.map(r => this.getNumericBelief(r.belief) ?? 0);
    return {
      nodes: sinkResults,
      worst: sinkResults[0],
      best: sinkResults[sinkResults.length - 1],
      average: beliefs.reduce((a, b) => a + b, 0) / beliefs.length
    };
  });

  // ─── Computed: sensitivity top 10 ─────────────────────────────────────────
  topSensitiveNodes = computed((): InferenceResult[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];
    return [...tab.results]
      .sort((a, b) => b.sensitivityScore - a.sensitivityScore)
      .slice(0, 10);
  });

  // ─── Computed: quick stats per node type ──────────────────────────────────
  nodeTypeStats = computed((): NodeTypeStats[] => {
    const tab = this.activeTab();
    const ni = this.networkInfo();
    if (!tab || !ni || tab.status !== 'computed') return [];

    const typeConfig = [
      { type: 'Source', icon: 'radio_button_checked' },
      { type: 'Sink', icon: 'flag' },
      { type: 'Fork', icon: 'call_split' },
      { type: 'Join', icon: 'merge_type' },
      { type: 'Regular', icon: 'lens' }
    ];

    return typeConfig.map(({ type, icon }) => {
      const nodes = tab.results.filter(r => {
        const nt = this.getNodeType(r.nodeId, ni);
        return type === 'Regular' ? nt === 'Regular' : nt.includes(type);
      });
      const beliefs = nodes.map(r => this.getNumericBelief(r.belief) ?? 0);
      const avg = beliefs.length > 0 ? beliefs.reduce((a, b) => a + b, 0) / beliefs.length : 0;
      return { type, count: nodes.length, avgBelief: avg, icon };
    }).filter(s => s.count > 0);
  });


  // ─── Computed: interval/pbox width stats ──────────────────────────────────
  widthStats = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return null;
    if (tab.scenario.dataType === 'float') return null;

    const widths = tab.results
      .map(r => r.uncertaintyWidth)
      .filter((w): w is number => w !== null);

    if (widths.length === 0) return null;

    const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
    const max = Math.max(...widths);
    const maxNode = tab.results.find(r => r.uncertaintyWidth === max);

    return { average: avg, max, maxNodeId: maxNode?.nodeId ?? 0, count: widths.length };
  });

  // ─── Computed: comparison results ─────────────────────────────────────────
  comparisonResults = computed((): ComparisonRow[] => {
    if (!this.comparisonMode()) return [];
    const tabs = this.scenarioTabs();
    const baseTab = tabs.get(this.baseScenarioName());
    const compareTab = tabs.get(this.compareScenarioName());
    if (!baseTab || !compareTab || baseTab.status !== 'computed' || compareTab.status !== 'computed') return [];

    const baseMap = new Map(baseTab.results.map(r => [r.nodeId, r]));
    const compareMap = new Map(compareTab.results.map(r => [r.nodeId, r]));
    const allIds = new Set([...baseMap.keys(), ...compareMap.keys()]);
    const ni = this.networkInfo();

    return Array.from(allIds).sort((a, b) => a - b).map(nodeId => {
      const base = baseMap.get(nodeId);
      const compare = compareMap.get(nodeId);
      const bv = base ? this.getNumericBelief(base.belief) : null;
      const cv = compare ? this.getNumericBelief(compare.belief) : null;
      let delta: number | null = null;
      let deltaPercent: number | null = null;
      if (bv !== null && cv !== null) {
        delta = cv - bv;
        deltaPercent = bv !== 0 ? (delta / bv) * 100 : null;
      }
      return {
        nodeId,
        baseBelief: base?.belief ?? null,
        compareBelief: compare?.belief ?? null,
        delta,
        deltaPercent,
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Unknown'
      };
    });
  });

  // ─── Computed: node comparison across scenarios ───────────────────────────
  nodeComparisonData = computed(() => {
    const nodeId = this.selectedNodeForComparison();
    if (nodeId === null) return null;
    const tabs = this.scenarioTabs();
    const data: { scenarioName: string; dataType: string; prior: BeliefValue; belief: BeliefValue; sensitivity: number }[] = [];
    for (const [name, tab] of tabs.entries()) {
      if (tab.status !== 'computed') continue;
      const r = tab.results.find(r => r.nodeId === nodeId);
      if (r) {
        data.push({
          scenarioName: name,
          dataType: tab.scenario.dataType,
          prior: r.prior,
          belief: r.belief,
          sensitivity: r.sensitivityScore
        });
      }
    }
    return data.length > 0 ? data : null;
  });

  // ─── Computed: comparison tab states (for summary cards) ────────────────
  baseTabState = computed(() => this.scenarioTabs().get(this.baseScenarioName()) || null);
  compareTabState = computed(() => this.scenarioTabs().get(this.compareScenarioName()) || null);

  // ─── Computed: completed scenario count ───────────────────────────────────
  completedCount = computed((): number => {
    let count = 0;
    for (const tab of this.scenarioTabs().values()) {
      if (tab.status === 'computed') count++;
    }
    return count;
  });

  // Table columns
  displayedColumns: string[] = ['nodeId', 'prior', 'belief', 'nodeType'];
  comparisonColumns: string[] = ['nodeId', 'baseBelief', 'compareBelief', 'delta', 'nodeType'];

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  private static readonly VIEW_KEY = 'exact-inference';

  ngOnInit(): void {
    this.loadData();

    // Restore cached state from previous navigation (avoids unnecessary re-run)
    const cached = this.analysisStateService.restoreViewState(ExactInferenceComponent.VIEW_KEY);
    if (cached && cached.tabs.size > 0) {
      this.scenarioTabs.set(cached.tabs as Map<string, ScenarioTabState>);
      this.activeTabIndex.set(cached.activeTabIndex);
      if (cached.uiState) {
        this.activeSearchTerm.set(cached.uiState.searchTerm || '');
        this.activeSelectedNodeTypes.set(cached.uiState.selectedNodeTypes || []);
        this.activePageIndex.set(cached.uiState.pageIndex || 0);
        this.activePageSize.set(cached.uiState.pageSize || 25);
        this.activeSortColumn.set(cached.uiState.sortColumn || 'nodeId');
        this.activeSortDirection.set(cached.uiState.sortDirection || '');
        this.comparisonMode.set(cached.uiState.comparisonMode || false);
        this.baseScenarioName.set(cached.uiState.baseScenarioName || '');
        this.compareScenarioName.set(cached.uiState.compareScenarioName || '');
      }
      // Rebuild availableScenarios and scenarioResults from tabs
      for (const [name, tab] of cached.tabs.entries()) {
        if (tab.rawResponse) this.scenarioResults.set(name, tab.rawResponse);
      }
      return;
    }

    this.loadScenarios();
    this.runAllScenarios();
  }

  ngOnDestroy(): void {
    // Save state so navigating back restores results without re-running
    this.saveActiveTabUIState();
    this.analysisStateService.saveViewState(
      ExactInferenceComponent.VIEW_KEY,
      this.scenarioTabs(),
      this.activeTabIndex(),
      {
        searchTerm: this.activeSearchTerm(),
        selectedNodeTypes: this.activeSelectedNodeTypes(),
        pageIndex: this.activePageIndex(),
        pageSize: this.activePageSize(),
        sortColumn: this.activeSortColumn(),
        sortDirection: this.activeSortDirection(),
        comparisonMode: this.comparisonMode(),
        baseScenarioName: this.baseScenarioName(),
        compareScenarioName: this.compareScenarioName()
      }
    );
  }

  // ─── ScenarioAwareComponent implementation ────────────────────────────────

  loadScenarios(): void {
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const validGroups = reachabilityGroups.filter(
      g => g.dataType === 'float' || g.dataType === 'interval' || g.dataType === 'pbox'
    );

    this.availableScenarios = validGroups.map((group, index) => ({
      name: group.scenarioName || `${group.dataType}-${index}`,
      dataType: group.dataType as 'float' | 'interval' | 'pbox',
      path: group.nodePriorsFile?.path || '',
      displayName: group.scenarioName
        ? `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})`
        : this.getDataTypeDisplayName(group.dataType),
      analysisType: 'reachability' as const,
      description: this.getScenarioDescription(group.dataType)
    }));

    // Initialize tab state for each scenario
    const tabs = new Map<string, ScenarioTabState>();
    validGroups.forEach((group, index) => {
      const name = group.scenarioName || `${group.dataType}-${index}`;
      tabs.set(name, {
        scenario: {
          name,
          dataType: group.dataType as 'float' | 'interval' | 'pbox',
          path: group.nodePriorsFile?.path || '',
          displayName: group.scenarioName
            ? `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})`
            : this.getDataTypeDisplayName(group.dataType),
          description: this.getScenarioDescription(group.dataType),
          networkPath: group.networkPath,
          nodePriorsFile: group.nodePriorsFile,
          linkProbabilitiesFile: group.linkProbabilitiesFile
        },
        status: 'idle',
        results: [],
        metrics: null,
        error: null,
        rawResponse: null,
        searchTerm: '',
        selectedNodeTypes: [],
        pageIndex: 0,
        pageSize: 25,
        sortColumn: 'nodeId',
        sortDirection: ''
      });
    });
    this.scenarioTabs.set(tabs);

    if (this.availableScenarios.length > 0) {
      this.currentScenario = this.availableScenarios[0].name;
    }
  }

  setCurrentScenario(scenarioName: string): void {
    this.currentScenario = scenarioName;
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    const tabs = new Map(this.scenarioTabs());
    for (const [name, tab] of tabs.entries()) {
      tabs.set(name, { ...tab, status: 'idle', results: [], metrics: null, error: null, rawResponse: null });
    }
    this.scenarioTabs.set(tabs);
    this.scenarioResults.clear();
  }

  // ─── Auto-run all scenarios ───────────────────────────────────────────────

  async runAllScenarios(): Promise<void> {
    const tabs = this.scenarioTabs();
    if (tabs.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const name of tabs.keys()) {
      promises.push(this.runScenario(name));
    }
    await Promise.allSettled(promises);
  }

  async rerunScenario(scenarioName: string): Promise<void> {
    await this.runScenario(scenarioName);
  }

  private async runScenario(scenarioName: string): Promise<void> {
    const tabs = this.scenarioTabs();
    const tabState = tabs.get(scenarioName);
    if (!tabState) return;

    // Set computing status
    this.updateTabState(scenarioName, { status: 'computing', error: null });

    try {
      const scenario = tabState.scenario;
      const request = this.buildRequest(scenario);
      if (!request) {
        throw new Error('Could not build request: missing file paths');
      }

      const results = await this.reachabilityAnalysisService.analyzeReachability(request).toPromise();

      if (!results?.reachability_result) {
        throw new Error(results?.message || 'No results returned from backend');
      }

      const processed = this.processInferenceResults(results, scenario.dataType);
      const metrics = this.calculateInferenceMetrics(results, processed);

      this.updateTabState(scenarioName, {
        status: 'computed',
        results: processed,
        metrics,
        rawResponse: results,
        error: null
      });

      this.scenarioResults.set(scenarioName, results.reachability_result);
      this.cdr.detectChanges();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Inference execution failed';
      this.updateTabState(scenarioName, { status: 'error', error: msg });
      this.cdr.detectChanges();
    }
  }

  private buildRequest(scenario: InferenceScenario): any | null {
    let networkPath = scenario.networkPath;
    if (!networkPath) {
      networkPath = this.sessionService.getCurrentSession()?.networkPath;
    }
    if (!networkPath) return null;
    if (!scenario.nodePriorsFile?.path || !scenario.linkProbabilitiesFile?.path) return null;

    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const matchingGroup = reachabilityGroups.find(
      g => g.scenarioName === scenario.name && g.dataType === scenario.dataType
    );

    const edgesNetworkName = (matchingGroup?.networkPath || networkPath).split('/').pop() || 'network';
    let edgesFilePath = matchingGroup?.edgesFile?.path || `${edgesNetworkName}.EDGES`;
    if (edgesFilePath.includes('/')) {
      edgesFilePath = edgesFilePath.split('/').pop() || `${edgesNetworkName}.EDGES`;
    }

    const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
    const baseNetworkPath = (sessionNetworkPath || matchingGroup?.networkPath || networkPath).replace(/\\/g, '/');
    const networkName = baseNetworkPath.split('/').pop() || '';

    let relativeNodePriorsPath = scenario.nodePriorsFile.path;
    let relativeLinkProbsPath = scenario.linkProbabilitiesFile.path;

    if (networkName && relativeNodePriorsPath.startsWith(networkName + '/')) {
      relativeNodePriorsPath = relativeNodePriorsPath.substring(networkName.length + 1);
    }
    if (networkName && relativeLinkProbsPath.startsWith(networkName + '/')) {
      relativeLinkProbsPath = relativeLinkProbsPath.substring(networkName.length + 1);
    }

    return {
      networkPath: baseNetworkPath,
      edgesFilePath,
      nodepriorsPath: relativeNodePriorsPath,
      linkprobsPath: relativeLinkProbsPath,
      includeExactInference: true,
      includeDiamondAnalysis: false
    };
  }

  // ─── Results processing ───────────────────────────────────────────────────

  private processInferenceResults(results: any, dataType: string): InferenceResult[] {
    if (!results?.reachability_result?.exact_inference?.beliefs) return [];

    const exactInference = results.reachability_result.exact_inference;
    const beliefs = exactInference.beliefs;
    const nodePriors = exactInference.node_priors || {};
    const ni = this.networkInfo();
    if (!ni) return [];

    const sourceSet = new Set(ni.sourceNodes);
    const joinSet = new Set(ni.joinNodes);

    return Object.entries(beliefs).map(([nodeIdStr, belief]: [string, any]) => {
      const nodeId = parseInt(nodeIdStr);
      const prior = nodePriors[nodeIdStr] ?? 0.5;

      let inferenceMethod: InferenceResult['inferenceMethod'];
      let methodColor: string;
      let complexityLevel: InferenceResult['complexityLevel'];

      if (sourceSet.has(nodeId)) {
        inferenceMethod = 'Source Node';
        methodColor = 'source-method';
        complexityLevel = 'Source';
      } else if (joinSet.has(nodeId)) {
        inferenceMethod = 'Inclusion-Exclusion';
        methodColor = 'inclusion-method';
        complexityLevel = ni.sourceNodes.length <= 2 ? 'Simple' : ni.sourceNodes.length <= 5 ? 'Moderate' : 'Complex';
      } else {
        inferenceMethod = 'Tree Propagation';
        methodColor = 'tree-method';
        complexityLevel = 'Simple';
      }

      const sensitivityScore = this.computeSensitivity(belief, prior);
      const uncertaintyWidth = this.computeWidth(belief);

      return { nodeId, belief, prior, inferenceMethod, methodColor, complexityLevel, sensitivityScore, uncertaintyWidth };
    }).sort((a, b) => a.nodeId - b.nodeId);
  }

  private calculateInferenceMetrics(results: any, processed: InferenceResult[]): InferenceMetrics {
    const computationTime = results?.reachability_result?.exact_inference?.computation_time || 0;
    const ni = this.networkInfo();

    let averageBelief = 0;
    let numericCount = 0;
    for (const r of processed) {
      const v = this.getNumericBelief(r.belief);
      if (v !== null) { averageBelief += v; numericCount++; }
    }
    if (numericCount > 0) averageBelief /= numericCount;

    const sourceNodes = processed.filter(r => r.inferenceMethod === 'Source Node').length;
    const joinNodes = processed.filter(r => r.inferenceMethod === 'Inclusion-Exclusion').length;
    const diamondNodes = processed.filter(r => r.inferenceMethod === 'Diamond Enumeration').length;

    const joinRatio = ni ? ni.joinNodes.length / Math.max(1, ni.totalNodes) : 0;
    let algorithmComplexity = 'Unknown';
    if (joinRatio === 0) algorithmComplexity = 'Linear (Tree Structure)';
    else if (joinRatio < 0.1) algorithmComplexity = 'Low (Few Join Nodes)';
    else if (joinRatio < 0.3) algorithmComplexity = 'Moderate (Multiple Convergence)';
    else algorithmComplexity = 'High (Complex Diamond Structures)';

    return { totalNodes: processed.length, sourceNodes, joinNodes, diamondNodes, computationTime, averageBelief, algorithmComplexity };
  }

  // ─── Formatting (raw probabilities, 6 significant figures) ────────────────

  formatNumber(value: number): string {
    if (value === 0) return '0.00000';
    if (value === 1) return '1.00000';
    return value.toPrecision(6);
  }

  formatBelief(belief: BeliefValue): string {
    if (typeof belief === 'number') {
      return this.formatNumber(belief);
    }
    if (belief && typeof belief === 'object') {
      // P-box
      if ('type' in belief && belief.type === 'pbox') {
        return this.formatPbox(belief as PboxData);
      }
      // Interval (with or without type field)
      if ('lower' in belief && 'upper' in belief) {
        const lo = this.formatNumber((belief as any).lower);
        const hi = this.formatNumber((belief as any).upper);
        return `[${lo}, ${hi}]`;
      }
    }
    return 'N/A';
  }

  private formatPbox(pbox: PboxData): string {
    const ml = this.formatNumber(pbox.mean_lower);
    const mh = this.formatNumber(pbox.mean_upper);
    return `μ∈[${ml}, ${mh}]`;
  }

  getPboxTooltip(belief: BeliefValue): string {
    if (!belief || typeof belief !== 'object' || !('type' in belief) || belief.type !== 'pbox') return '';
    const p = belief as PboxData;
    const bs = p.bounds_summary;
    return `Shape: ${p.shape || 'none'}, Discretization: ${p.discretization_size}\n` +
      `Mean: [${this.formatNumber(p.mean_lower)}, ${this.formatNumber(p.mean_upper)}]\n` +
      `Variance: [${this.formatNumber(p.var_lower)}, ${this.formatNumber(p.var_upper)}]\n` +
      `Bounds: [${this.formatNumber(bs.left_min)}, ${this.formatNumber(bs.right_max)}]`;
  }

  // ─── Numeric extraction helpers ───────────────────────────────────────────

  getNumericBelief(belief: BeliefValue): number | null {
    if (typeof belief === 'number') return belief;
    if (belief && typeof belief === 'object') {
      if ('lower' in belief && 'upper' in belief) {
        return ((belief as any).lower + (belief as any).upper) / 2;
      }
      if ('type' in belief && belief.type === 'pbox') {
        const p = belief as PboxData;
        return (p.mean_lower + p.mean_upper) / 2;
      }
    }
    return null;
  }

  private computeSensitivity(belief: BeliefValue, prior: BeliefValue): number {
    const bv = this.getNumericBelief(belief);
    const pv = this.getNumericBelief(prior);
    if (bv === null || pv === null) return 0;
    return Math.abs(bv - pv);
  }

  computeWidth(belief: BeliefValue): number | null {
    if (typeof belief === 'number') return null;
    if (belief && typeof belief === 'object') {
      if ('lower' in belief && 'upper' in belief) {
        return (belief as any).upper - (belief as any).lower;
      }
      if ('type' in belief && belief.type === 'pbox') {
        const p = belief as PboxData;
        if (p.bounds_summary) {
          return p.bounds_summary.right_max - p.bounds_summary.left_min;
        }
      }
    }
    return null;
  }

  // ─── Sorting ──────────────────────────────────────────────────────────────

  private getSortValue(result: InferenceResult, column: string): number {
    switch (column) {
      case 'nodeId': return result.nodeId;
      case 'belief': return this.getNumericBelief(result.belief) ?? 0;
      case 'prior': return this.getNumericBelief(result.prior) ?? 0;
      case 'sensitivity': return result.sensitivityScore;
      case 'width': return result.uncertaintyWidth ?? 0;
      case 'nodeType': return 0; // String sort handled separately
      default: return 0;
    }
  }

  toggleSort(column: string): void {
    const current = this.activeSortColumn();
    const dir = this.activeSortDirection();
    if (current === column) {
      // Cycle: '' → 'asc' → 'desc' → ''
      if (dir === '') this.activeSortDirection.set('asc');
      else if (dir === 'asc') this.activeSortDirection.set('desc');
      else this.activeSortDirection.set('');
    } else {
      this.activeSortColumn.set(column);
      this.activeSortDirection.set('asc');
    }
    this.activePageIndex.set(0);
  }

  getSortIcon(column: string): string {
    if (this.activeSortColumn() !== column || !this.activeSortDirection()) return 'unfold_more';
    return this.activeSortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  exportCSV(): void {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return;
    const ni = this.networkInfo();

    let csv = '';
    const dt = tab.scenario.dataType;

    if (dt === 'float') {
      csv = 'NodeID,Prior,Belief,NodeType,InferenceMethod,Sensitivity\n';
      for (const r of tab.results) {
        const nt = ni ? this.getNodeType(r.nodeId, ni) : '';
        csv += `${r.nodeId},${r.prior},${r.belief},${nt},${r.inferenceMethod},${r.sensitivityScore}\n`;
      }
    } else if (dt === 'interval') {
      csv = 'NodeID,PriorLower,PriorUpper,BeliefLower,BeliefUpper,NodeType,InferenceMethod,Sensitivity,Width\n';
      for (const r of tab.results) {
        const nt = ni ? this.getNodeType(r.nodeId, ni) : '';
        const pl = (r.prior as any)?.lower ?? r.prior;
        const pu = (r.prior as any)?.upper ?? r.prior;
        const bl = (r.belief as any)?.lower ?? r.belief;
        const bu = (r.belief as any)?.upper ?? r.belief;
        csv += `${r.nodeId},${pl},${pu},${bl},${bu},${nt},${r.inferenceMethod},${r.sensitivityScore},${r.uncertaintyWidth ?? ''}\n`;
      }
    } else {
      csv = 'NodeID,PriorMeanLo,PriorMeanHi,BeliefMeanLo,BeliefMeanHi,BeliefBoundsLo,BeliefBoundsHi,NodeType,InferenceMethod,Sensitivity,Width\n';
      for (const r of tab.results) {
        const nt = ni ? this.getNodeType(r.nodeId, ni) : '';
        const pp = r.prior as any;
        const bp = r.belief as any;
        const pml = pp?.mean_lower ?? pp;
        const pmh = pp?.mean_upper ?? pp;
        const bml = bp?.mean_lower ?? bp;
        const bmh = bp?.mean_upper ?? bp;
        const bbl = bp?.bounds_summary?.left_min ?? '';
        const bbh = bp?.bounds_summary?.right_max ?? '';
        csv += `${r.nodeId},${pml},${pmh},${bml},${bmh},${bbl},${bbh},${nt},${r.inferenceMethod},${r.sensitivityScore},${r.uncertaintyWidth ?? ''}\n`;
      }
    }

    this.downloadFile(csv, `exact-inference-${tab.scenario.name}.csv`, 'text/csv');
  }

  exportJSON(): void {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return;
    const data = { scenario: tab.scenario.name, dataType: tab.scenario.dataType, results: tab.results, metrics: tab.metrics };
    this.downloadFile(JSON.stringify(data, null, 2), `exact-inference-${tab.scenario.name}.json`, 'application/json');
  }

  exportAllJSON(): void {
    const allData: any = {};
    for (const [name, tab] of this.scenarioTabs().entries()) {
      if (tab.status === 'computed') {
        allData[name] = { dataType: tab.scenario.dataType, results: tab.results, metrics: tab.metrics };
      }
    }
    this.downloadFile(JSON.stringify(allData, null, 2), 'exact-inference-all-scenarios.json', 'application/json');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }


  // ─── Heat-map coloring ────────────────────────────────────────────────────

  getBeliefHeatColor(belief: BeliefValue): string {
    const v = this.getNumericBelief(belief);
    if (v === null) return 'transparent';
    const hue = v * 120; // 0=red, 60=yellow, 120=green
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      return `hsla(${hue}, 50%, 25%, 0.4)`;
    }
    return `hsl(${hue}, 65%, 92%)`;
  }

  // ─── Copy to clipboard ────────────────────────────────────────────────────

  async copyToClipboard(value: BeliefValue, nodeId: number, field: string, event: Event): Promise<void> {
    event.stopPropagation();
    let text: string;
    if (typeof value === 'number') {
      text = value.toString();
    } else if (value && typeof value === 'object') {
      text = JSON.stringify(value);
    } else {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.copiedCellKey.set(`${nodeId}-${field}`);
      setTimeout(() => this.copiedCellKey.set(''), 1500);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.copiedCellKey.set(`${nodeId}-${field}`);
      setTimeout(() => this.copiedCellKey.set(''), 1500);
    }
  }

  isCopied(nodeId: number, field: string): boolean {
    return this.copiedCellKey() === `${nodeId}-${field}`;
  }

  // ─── Comparison mode ──────────────────────────────────────────────────────

  toggleComparisonMode(): void {
    this.comparisonMode.set(!this.comparisonMode());
    if (this.comparisonMode()) {
      const names = this.scenarioNames();
      const computed = names.filter(n => this.getTabStatus(n) === 'computed');
      if (computed.length >= 2) {
        this.baseScenarioName.set(computed[0]);
        this.compareScenarioName.set(computed[1]);
      }
    }
  }

  onBaseScenarioChange(name: string): void {
    this.baseScenarioName.set(name);
  }

  onCompareScenarioChange(name: string): void {
    this.compareScenarioName.set(name);
  }

  // ─── Node comparison ──────────────────────────────────────────────────────

  toggleNodeComparison(nodeId: number): void {
    this.selectedNodeForComparison.set(
      this.selectedNodeForComparison() === nodeId ? null : nodeId
    );
  }

  // ─── Tab management ───────────────────────────────────────────────────────

  onTabChange(newIndex: number): void {
    this.saveActiveTabUIState();
    this.activeTabIndex.set(newIndex);
    this.restoreActiveTabUIState();
  }

  private saveActiveTabUIState(): void {
    const keys = Array.from(this.scenarioTabs().keys());
    const currentKey = keys[this.activeTabIndex()];
    if (!currentKey) return;
    this.updateTabState(currentKey, {
      searchTerm: this.activeSearchTerm(),
      selectedNodeTypes: this.activeSelectedNodeTypes(),
      pageIndex: this.activePageIndex(),
      pageSize: this.activePageSize(),
      sortColumn: this.activeSortColumn(),
      sortDirection: this.activeSortDirection()
    });
  }

  private restoreActiveTabUIState(): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.activeSearchTerm.set(tab.searchTerm);
    this.activeSelectedNodeTypes.set(tab.selectedNodeTypes);
    this.activePageIndex.set(tab.pageIndex);
    this.activePageSize.set(tab.pageSize);
    this.activeSortColumn.set(tab.sortColumn);
    this.activeSortDirection.set(tab.sortDirection);
  }

  private updateTabState(name: string, update: Partial<ScenarioTabState>): void {
    const current = new Map(this.scenarioTabs());
    const existing = current.get(name);
    if (existing) {
      current.set(name, { ...existing, ...update });
      this.scenarioTabs.set(current);
    }
  }

  // ─── Tab helpers (for template access) ────────────────────────────────────

  getTabStatus(name: string): string {
    return this.scenarioTabs().get(name)?.status || 'idle';
  }

  getTabError(name: string): string {
    return this.scenarioTabs().get(name)?.error || '';
  }

  getTabDisplayName(name: string): string {
    return this.scenarioTabs().get(name)?.scenario.displayName || name;
  }

  getTabDataType(name: string): string {
    return this.scenarioTabs().get(name)?.scenario.dataType || '';
  }

  getTabMetrics(name: string): InferenceMetrics | null {
    return this.scenarioTabs().get(name)?.metrics || null;
  }

  // ─── Node type helpers ────────────────────────────────────────────────────

  getNodeType(nodeId: number, networkInfo: any): string {
    const types: string[] = [];
    if (networkInfo.sourceNodes.includes(nodeId)) types.push('Source');
    if (networkInfo.sinkNodes.includes(nodeId)) types.push('Sink');
    if (networkInfo.forkNodes.includes(nodeId)) types.push('Fork');
    if (networkInfo.joinNodes.includes(nodeId)) types.push('Join');
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  getNodeTypeIcon(nodeType: string): string {
    if (nodeType.includes('Source')) return 'radio_button_checked';
    if (nodeType.includes('Sink')) return 'flag';
    if (nodeType.includes('Fork')) return 'call_split';
    if (nodeType.includes('Join')) return 'merge_type';
    return 'lens';
  }

  // ─── Scenario description helpers ─────────────────────────────────────────

  getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Precise)';
      case 'interval': return 'Interval (Bounded)';
      case 'pbox': return 'P-Box (Distributional)';
      default: return dataType;
    }
  }

  private getScenarioDescription(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Precise probabilistic inference with exact numerical values';
      case 'interval': return 'Interval arithmetic for bounded uncertainty propagation';
      case 'pbox': return 'Probability box for comprehensive uncertainty quantification';
      default: return 'Probabilistic reachability analysis';
    }
  }

  getDataTypeBadgeClass(dataType: string): string {
    return `data-type-${dataType}`;
  }

  // ─── Pagination and filtering handlers ────────────────────────────────────

  onPageChange(event: PageEvent): void {
    this.activePageIndex.set(event.pageIndex);
    this.activePageSize.set(event.pageSize);
  }

  onSearch(event: Event): void {
    this.activeSearchTerm.set((event.target as HTMLInputElement).value);
    this.activePageIndex.set(0);
  }

  onNodeTypeFilter(types: string[]): void {
    this.activeSelectedNodeTypes.set(types);
    this.activePageIndex.set(0);
  }

  toggleNodeTypeFilter(nodeType: string): void {
    const current = this.activeSelectedNodeTypes();
    if (current.includes(nodeType)) {
      this.onNodeTypeFilter(current.filter(t => t !== nodeType));
    } else {
      this.onNodeTypeFilter([...current, nodeType]);
    }
  }

  // ─── P-box / Interval type checks ────────────────────────────────────────

  isPboxData(belief: BeliefValue): boolean {
    return typeof belief === 'object' && belief !== null && 'type' in belief && belief.type === 'pbox';
  }

  clearResults(): void {
    this.clearScenarioData();
    this.selectedNodeForComparison.set(null);
    this.comparisonMode.set(false);
    this.analysisStateService.clearViewState(ExactInferenceComponent.VIEW_KEY);
  }

  hasScenarioResults(scenarioName: string): boolean {
    return this.scenarioResults.has(scenarioName);
  }

  // ─── Computed scenarios for comparison dropdowns ──────────────────────────

  computedScenarioNames(): string[] {
    return this.scenarioNames().filter(n => this.getTabStatus(n) === 'computed');
  }
}
