import { Component, OnInit, OnDestroy, computed, signal, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { CpmAnalysisService } from '../../shared/services/cpm-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import {
  ScenarioInfo,
  NetworkStructure,
  AnalysisResponse,
  CpmScenario,
  CpmPathResult,
  CpmFileGroup
} from '../../shared/models/network-analysis.models';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CostNodeResult {
  nodeId: number;
  nodeCost: number;         // Activity's own cost (from input_data)
  accumulatedCost: number;  // Total cost along path (from cost_result.node_values)
  budgetShare: number;      // Percentage of total budget
  slack: number;            // Cost slack
  isOnCriticalPath: boolean;
  nodeType: string;
}

interface CostMetrics {
  computationTime: number;
  criticalPathCost: number;
  criticalPathLength: number;
  totalBudget: number;
  averageNodeCost: number;
  criticalCount: number;
  sourceCount: number;
  sinkCount: number;
  totalNodes: number;
}

interface CostBucket {
  label: string;
  count: number;
  heightPercent: number;
}

interface ScenarioTabState {
  scenario: { name: string; path: string; displayName: string; networkPath: string | undefined };
  status: 'idle' | 'computing' | 'computed' | 'error';
  nodeResults: CostNodeResult[];
  metrics: CostMetrics | null;
  rawScenario: CpmScenario | null;
  error: string | null;
  searchTerm: string;
  selectedNodeTypes: string[];
  pageIndex: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
}

interface ComparisonRow {
  nodeId: number;
  baseCost: number | null;
  compareCost: number | null;
  deltaCost: number | null;
  baseSlack: number | null;
  compareSlack: number | null;
  deltaSlack: number | null;
  nodeType: string;
}

interface SummaryObservation {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'good';
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-cost-analysis',
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
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatPaginatorModule,
    MatMenuModule
  ],
  templateUrl: './cost-analysis.component.html',
  styleUrl: './cost-analysis.component.scss'
})
export class CostAnalysisComponent implements OnInit, OnDestroy, ScenarioAwareComponent {

  // ─── Service injection ────────────────────────────────────────────────────
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private cpmAnalysisService = inject(CpmAnalysisService);
  private sessionService = inject(NetworkSessionService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

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

  // Active tab UI state
  activeSearchTerm = signal('');
  activeSelectedNodeTypes = signal<string[]>([]);
  activePageIndex = signal(0);
  activePageSize = signal(25);
  activeSortColumn = signal('nodeId');
  activeSortDirection = signal<'asc' | 'desc' | ''>('');

  // Comparison state
  comparisonMode = signal(false);
  baseScenarioName = signal('');
  compareScenarioName = signal('');

  // Copy feedback
  copiedCellKey = signal('');

  // Number formatter for currency
  private currencyFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

  // ─── Computed: scenario names ─────────────────────────────────────────────
  scenarioNames = computed(() => Array.from(this.scenarioTabs().keys()));

  // ─── Computed: active tab state ───────────────────────────────────────────
  activeTab = computed((): ScenarioTabState | null => {
    const tabs = this.scenarioTabs();
    const keys = Array.from(tabs.keys());
    const scenarioIdx = this.activeTabIndex() - 1; // offset for Summary tab at index 0
    if (scenarioIdx < 0 || scenarioIdx >= keys.length) return null;
    return tabs.get(keys[scenarioIdx]) || null;
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
    };
  });

  // ─── Computed: filtered + sorted results for active tab ───────────────────
  activeFilteredResults = computed((): CostNodeResult[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    let results = [...tab.nodeResults];
    const search = this.activeSearchTerm().toLowerCase();
    const types = this.activeSelectedNodeTypes();

    if (search) {
      results = results.filter(r => r.nodeId.toString().includes(search));
    }
    if (types.length > 0) {
      results = results.filter(r => types.includes(r.nodeType));
    }

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
  activePaginatedResults = computed((): CostNodeResult[] => {
    const filtered = this.activeFilteredResults();
    const start = this.activePageIndex() * this.activePageSize();
    return filtered.slice(start, start + this.activePageSize());
  });

  // ─── Computed: cost distribution histogram ────────────────────────────────
  costHistogram = computed((): CostBucket[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed' || !tab.metrics) return [];

    const results = tab.nodeResults;
    const maxCost = Math.max(...results.map(r => r.accumulatedCost), 1);
    const bucketCount = 10;
    const bucketWidth = maxCost / bucketCount;
    const counts: number[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const lo = i * bucketWidth;
      const hi = (i + 1) * bucketWidth;
      counts.push(results.filter(r => r.accumulatedCost >= lo && (i === bucketCount - 1 ? r.accumulatedCost <= hi : r.accumulatedCost < hi)).length);
    }

    // Trim empty leading/trailing bins (same pattern as exact-inference)
    let firstNonZero = counts.findIndex(c => c > 0);
    let lastNonZero = counts.length - 1;
    while (lastNonZero > 0 && counts[lastNonZero] === 0) lastNonZero--;
    if (firstNonZero === -1) return [];

    const trimmed = counts.slice(firstNonZero, lastNonZero + 1);
    const maxCount = Math.max(...trimmed, 1);

    return trimmed.map((count, i) => {
      const idx = firstNonZero + i;
      const lo = idx * bucketWidth;
      const hi = (idx + 1) * bucketWidth;
      return {
        label: this.formatCostShort(lo) + '-' + this.formatCostShort(hi),
        count,
        heightPercent: (count / maxCount) * 100
      };
    });
  });

  // ─── Computed: cost vs time path comparison ───────────────────────────────
  pathComparison = computed(() => {
    const tab = this.activeTab();
    if (!tab || !tab.rawScenario) return null;

    const costCritical = tab.rawScenario.cost_result?.critical_nodes || [];
    const timeCritical = tab.rawScenario.time_result?.critical_nodes || [];

    if (costCritical.length === 0 || timeCritical.length === 0) return null;

    const costSet = new Set(costCritical);
    const timeSet = new Set(timeCritical);
    const common = costCritical.filter(n => timeSet.has(n));
    const costOnly = costCritical.filter(n => !timeSet.has(n));
    const timeOnly = timeCritical.filter(n => !costSet.has(n));

    return {
      costPath: costCritical,
      timePath: timeCritical,
      commonNodes: common,
      costOnlyNodes: costOnly,
      timeOnlyNodes: timeOnly,
      identical: costOnly.length === 0 && timeOnly.length === 0
    };
  });

  // ─── Computed: node type stats ────────────────────────────────────────────
  nodeTypeStats = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    const typeMap = new Map<string, { count: number; totalCost: number }>();
    for (const r of tab.nodeResults) {
      const entry = typeMap.get(r.nodeType) || { count: 0, totalCost: 0 };
      entry.count++;
      entry.totalCost += r.nodeCost;
      typeMap.set(r.nodeType, entry);
    }

    const iconMap: Record<string, string> = {
      Source: 'login', Sink: 'logout', Fork: 'call_split', Join: 'call_merge', Regular: 'radio_button_unchecked'
    };

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgCost: data.totalCost / data.count,
      icon: iconMap[type] || 'circle'
    }));
  });

  // ─── Computed: comparison rows ────────────────────────────────────────────
  comparisonRows = computed((): ComparisonRow[] => {
    if (!this.comparisonMode()) return [];
    const tabs = this.scenarioTabs();
    const baseTab = tabs.get(this.baseScenarioName());
    const compTab = tabs.get(this.compareScenarioName());
    if (!baseTab || !compTab || baseTab.status !== 'computed' || compTab.status !== 'computed') return [];

    const baseMap = new Map(baseTab.nodeResults.map(r => [r.nodeId, r]));
    const compMap = new Map(compTab.nodeResults.map(r => [r.nodeId, r]));
    const allNodeIds = new Set([...baseMap.keys(), ...compMap.keys()]);
    const ni = this.networkInfo();

    return Array.from(allNodeIds).sort((a, b) => a - b).map(nodeId => {
      const base = baseMap.get(nodeId);
      const comp = compMap.get(nodeId);
      return {
        nodeId,
        baseCost: base?.accumulatedCost ?? null,
        compareCost: comp?.accumulatedCost ?? null,
        deltaCost: (base && comp) ? comp.accumulatedCost - base.accumulatedCost : null,
        baseSlack: base?.slack ?? null,
        compareSlack: comp?.slack ?? null,
        deltaSlack: (base && comp) ? comp.slack - base.slack : null,
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Regular'
      };
    });
  });

  // ─── Computed: completed scenario count ───────────────────────────────────
  completedCount = computed((): number => {
    let count = 0;
    for (const tab of this.scenarioTabs().values()) {
      if (tab.status === 'computed') count++;
    }
    return count;
  });

  // ─── Computed: comparison tab states (for summary cards) ────────────────
  baseTabState = computed(() => this.scenarioTabs().get(this.baseScenarioName()) || null);
  compareTabState = computed(() => this.scenarioTabs().get(this.compareScenarioName()) || null);

  // ─── Computed: cross-scenario summary ────────────────────────────────────
  crossScenarioSummary = computed((): { observations: SummaryObservation[] } | null => {
    const tabs = this.scenarioTabs();
    const computedTabs = Array.from(tabs.entries()).filter(([, t]) => t.status === 'computed');
    if (computedTabs.length === 0) return null;

    const observations: SummaryObservation[] = [];

    observations.push({
      icon: 'assessment',
      text: `${computedTabs.length}/${tabs.size} scenarios computed`,
      severity: computedTabs.length === tabs.size ? 'good' : 'info'
    });

    // Total budget comparison
    const budgetRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, budget: tab.metrics?.totalBudget ?? 0 }))
      .sort((a, b) => a.budget - b.budget);

    if (budgetRanking.length >= 2) {
      const cheapest = budgetRanking[0];
      const most = budgetRanking[budgetRanking.length - 1];
      observations.push({
        icon: 'payments',
        text: `Budget: lowest ${cheapest.name} (${cheapest.budget.toFixed(0)}), highest ${most.name} (${most.budget.toFixed(0)})`,
        severity: 'info'
      });

      if (cheapest.budget > 0) {
        const pctDiff = ((most.budget - cheapest.budget) / cheapest.budget * 100).toFixed(0);
        observations.push({
          icon: 'trending_up',
          text: `${most.name} costs ${pctDiff}% more than ${cheapest.name}`,
          severity: 'info'
        });
      }
    }

    // Critical path cost comparison
    const cpCostRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, cost: tab.metrics?.criticalPathCost ?? 0 }))
      .sort((a, b) => a.cost - b.cost);

    if (cpCostRanking.length >= 2) {
      observations.push({
        icon: 'route',
        text: `Critical path cost: ${cpCostRanking.map(v => `${v.cost.toFixed(0)} (${v.name})`).join(' < ')}`,
        severity: 'info'
      });
    }

    // Critical count comparison
    const critRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, critCount: tab.metrics?.criticalCount ?? 0 }))
      .sort((a, b) => b.critCount - a.critCount);

    if (critRanking.length >= 2) {
      observations.push({
        icon: 'priority_high',
        text: `Critical activities: ${critRanking.map(v => `${v.critCount} (${v.name})`).join(', ')}`,
        severity: 'info'
      });
    }

    return { observations };
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  private static readonly VIEW_KEY = 'cost-analysis';

  ngOnInit(): void {
    this.loadData();

    // Restore cached state from previous navigation (avoids unnecessary re-run)
    const cached = this.analysisStateService.restoreViewState(CostAnalysisComponent.VIEW_KEY);
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
      for (const [name, tab] of cached.tabs.entries()) {
        if ((tab as any).rawScenario) this.scenarioResults.set(name, (tab as any).rawScenario);
      }
      this.pushToCentralizedState();
    } else {
      this.loadScenarios();
    }

    // Drilldown support: if navigated from system profile with ?scenario=X, select that tab
    const scenarioParam = this.route.snapshot.queryParamMap.get('scenario');
    if (scenarioParam) {
      const idx = this.scenarioNames().indexOf(scenarioParam);
      if (idx >= 0) this.activeTabIndex.set(idx + 1);
    }
  }

  ngOnDestroy(): void {
    // Save current tab's UI state before persisting
    const currentName = this.scenarioNames()[this.activeTabIndex() - 1];
    if (currentName) {
      this.updateTabState(currentName, {
        searchTerm: this.activeSearchTerm(),
        selectedNodeTypes: this.activeSelectedNodeTypes(),
        pageIndex: this.activePageIndex(),
        pageSize: this.activePageSize(),
        sortColumn: this.activeSortColumn(),
        sortDirection: this.activeSortDirection()
      });
    }
    this.analysisStateService.saveViewState(
      CostAnalysisComponent.VIEW_KEY,
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

  // ─── Push results to centralized state (for System Profile) ──────────────

  private pushToCentralizedState(): void {
    if (this.scenarioResults.size === 0) return;
    this.analysisStateService.setMultiScenarioCpmResults({
      scenarios: new Map(this.scenarioResults) as Map<string, CpmScenario>,
      currentScenario: this.currentScenario || this.scenarioNames()[Math.max(0, this.activeTabIndex() - 1)] || '',
      availableScenarios: this.availableScenarios
    });
  }

  // ─── ScenarioAwareComponent implementation ────────────────────────────────

  loadScenarios(): void {
    const cpmGroups: CpmFileGroup[] = this.fileManagerService.analysisGroups().cpm;
    const validGroups = cpmGroups.filter(g => g.cpmInputsFile);

    this.availableScenarios = validGroups.map((group, index) => ({
      name: group.scenarioName || `cpm-cost-${index}`,
      dataType: 'cpm' as any,
      path: group.cpmInputsFile?.path || '',
      displayName: group.scenarioName || `Cost Scenario ${index + 1}`,
      analysisType: 'cpm' as const,
    }));

    const tabs = new Map<string, ScenarioTabState>();
    validGroups.forEach((group, index) => {
      const name = group.scenarioName || `cpm-cost-${index}`;
      tabs.set(name, {
        scenario: {
          name,
          path: group.cpmInputsFile?.path || '',
          displayName: group.scenarioName || `Cost Scenario ${index + 1}`,
          networkPath: group.networkPath,
        },
        status: 'idle',
        nodeResults: [],
        metrics: null,
        rawScenario: null,
        error: null,
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
      tabs.set(name, { ...tab, status: 'idle', nodeResults: [], metrics: null, error: null, rawScenario: null });
    }
    this.scenarioTabs.set(tabs);
    this.scenarioResults.clear();
    this.cpmAnalysisService.clearCache();
    this.analysisStateService.clearViewState(CostAnalysisComponent.VIEW_KEY);
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
    await this.runScenario(scenarioName, true);
  }

  private async runScenario(scenarioName: string, bypassCache = false): Promise<void> {
    const tabs = this.scenarioTabs();
    const tabState = tabs.get(scenarioName);
    if (!tabState) return;

    this.updateTabState(scenarioName, { status: 'computing', error: null });

    try {
      const scenario = tabState.scenario;
      const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
      const baseNetworkPath = (sessionNetworkPath || scenario.networkPath || '').replace(/\\/g, '/');
      if (!baseNetworkPath) throw new Error('No network path available');

      const networkName = baseNetworkPath.split('/').pop() || '';
      const edgesFilePath = `${networkName}.EDGES`;

      let cpmPath = scenario.path;
      if (networkName && cpmPath.startsWith(networkName + '/')) {
        cpmPath = cpmPath.substring(networkName.length + 1);
      }

      const request = { networkPath: baseNetworkPath, edgesFilePath, cpmPath };

      const response = await this.cpmAnalysisService.analyzeCpm(request, bypassCache).toPromise();

      if (!response?.success) {
        throw new Error(response?.message || 'CPM analysis failed');
      }

      const raw = response.cpm_result;
      if (!raw?.cost_result) {
        throw new Error('No cost results in CPM response');
      }

      const nodeResults = this.processCostResults(raw);
      const metrics = this.calculateMetrics(raw, nodeResults);

      this.updateTabState(scenarioName, {
        status: 'computed',
        nodeResults,
        metrics,
        rawScenario: raw,
        error: null
      });

      this.scenarioResults.set(scenarioName, raw);
      this.pushToCentralizedState();
      this.cdr.detectChanges();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Cost analysis failed';
      this.updateTabState(scenarioName, { status: 'error', error: msg });
      this.cdr.detectChanges();
    }
  }

  // ─── Results processing ─────────────────────────────────────────────────

  private processCostResults(raw: CpmScenario): CostNodeResult[] {
    const costResult = raw.cost_result;
    if (!costResult?.node_values) return [];

    const ni = this.networkInfo();
    const criticalSet = new Set(costResult.critical_nodes || []);
    const criticalValue = costResult.critical_value || 0;

    // Input data for individual node costs
    const nodeCosts = raw.input_data?.node_costs || {};

    // Backward pass data
    const totalSlackData = costResult.total_slack || {};
    const hasBackwardPass = Object.keys(totalSlackData).length > 0;

    // Compute total budget from individual node costs
    const totalBudget = Object.values(nodeCosts).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0);

    return Object.entries(costResult.node_values).map(([nodeIdStr, accValue]) => {
      const nodeId = parseInt(nodeIdStr);
      const accumulatedCost = this.cleanValue(typeof accValue === 'number' ? accValue : parseFloat(accValue as string) || 0);
      const nodeCost = this.cleanValue(nodeCosts[nodeIdStr] ?? 0);
      const isOnCriticalPath = criticalSet.has(nodeId);

      let slack: number;
      if (hasBackwardPass) {
        slack = this.cleanValue(totalSlackData[nodeIdStr] ?? 0);
      } else {
        slack = isOnCriticalPath ? 0 : Math.max(0, criticalValue - accumulatedCost);
      }

      const budgetShare = totalBudget > 0 ? (nodeCost / totalBudget) * 100 : 0;

      return {
        nodeId,
        nodeCost,
        accumulatedCost,
        budgetShare: this.cleanValue(budgetShare),
        slack: Math.max(0, slack),
        isOnCriticalPath,
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Regular'
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  }

  private calculateMetrics(raw: CpmScenario, results: CostNodeResult[]): CostMetrics {
    const costResult = raw.cost_result;
    const criticalValue = costResult?.critical_value || 0;
    const criticalNodes = costResult?.critical_nodes || [];
    const ni = this.networkInfo();

    const totalBudget = results.reduce((sum, r) => sum + r.nodeCost, 0);
    const avgCost = results.length > 0 ? totalBudget / results.length : 0;

    return {
      computationTime: raw.computation_time || 0,
      criticalPathCost: criticalValue,
      criticalPathLength: criticalNodes.length,
      totalBudget,
      averageNodeCost: avgCost,
      criticalCount: criticalNodes.length,
      sourceCount: ni?.sourceNodes.length || 0,
      sinkCount: ni?.sinkNodes.length || 0,
      totalNodes: results.length
    };
  }

  // ─── Tab state management ─────────────────────────────────────────────────

  private updateTabState(name: string, updates: Partial<ScenarioTabState>): void {
    const tabs = new Map(this.scenarioTabs());
    const tab = tabs.get(name);
    if (tab) {
      tabs.set(name, { ...tab, ...updates });
      this.scenarioTabs.set(tabs);
    }
  }

  onTabChange(index: number): void {
    // Save current tab's UI state (skip for Summary tab)
    if (this.activeTabIndex() > 0) {
      const currentName = this.scenarioNames()[this.activeTabIndex() - 1];
      if (currentName) {
        this.updateTabState(currentName, {
          searchTerm: this.activeSearchTerm(),
          selectedNodeTypes: this.activeSelectedNodeTypes(),
          pageIndex: this.activePageIndex(),
          pageSize: this.activePageSize(),
          sortColumn: this.activeSortColumn(),
          sortDirection: this.activeSortDirection()
        });
      }
    }

    this.activeTabIndex.set(index);

    // Restore new tab's UI state (skip for Summary tab)
    if (index > 0) {
      const newName = this.scenarioNames()[index - 1];
      const newTab = this.scenarioTabs().get(newName);
      if (newTab) {
        this.activeSearchTerm.set(newTab.searchTerm);
        this.activeSelectedNodeTypes.set(newTab.selectedNodeTypes);
        this.activePageIndex.set(newTab.pageIndex);
        this.activePageSize.set(newTab.pageSize);
        this.activeSortColumn.set(newTab.sortColumn);
        this.activeSortDirection.set(newTab.sortDirection);
      }
    }
  }

  // ─── UI event handlers ──────────────────────────────────────────────────

  onSearchChange(event: Event): void {
    this.activeSearchTerm.set((event.target as HTMLInputElement).value);
    this.activePageIndex.set(0);
  }

  toggleNodeTypeFilter(type: string): void {
    const current = this.activeSelectedNodeTypes();
    if (current.includes(type)) {
      this.activeSelectedNodeTypes.set(current.filter(t => t !== type));
    } else {
      this.activeSelectedNodeTypes.set([...current, type]);
    }
    this.activePageIndex.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.activePageIndex.set(event.pageIndex);
    this.activePageSize.set(event.pageSize);
  }

  onSort(column: string): void {
    const current = this.activeSortColumn();
    const dir = this.activeSortDirection();
    if (current === column) {
      this.activeSortDirection.set(dir === 'asc' ? 'desc' : dir === 'desc' ? '' : 'asc');
    } else {
      this.activeSortColumn.set(column);
      this.activeSortDirection.set('asc');
    }
  }

  getSortIcon(column: string): string {
    if (this.activeSortColumn() !== column) return 'unfold_more';
    return this.activeSortDirection() === 'asc' ? 'arrow_upward' : this.activeSortDirection() === 'desc' ? 'arrow_downward' : 'unfold_more';
  }

  toggleComparisonMode(): void {
    this.comparisonMode.set(!this.comparisonMode());
    if (this.comparisonMode()) {
      const names = this.scenarioNames();
      if (names.length >= 2) {
        this.baseScenarioName.set(names[0]);
        this.compareScenarioName.set(names[1]);
      }
    }
  }

  copyToClipboard(value: any, key: string): void {
    navigator.clipboard.writeText(String(value));
    this.copiedCellKey.set(key);
    setTimeout(() => this.copiedCellKey.set(''), 1500);
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  exportCSV(): void {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return;

    let csv = 'Node ID,Node Cost,Accumulated Cost,Budget Share %,Slack,Critical Path,Node Type\n';
    csv += tab.nodeResults.map(r =>
      `${r.nodeId},${r.nodeCost},${r.accumulatedCost},${r.budgetShare.toFixed(1)},${r.slack},${r.isOnCriticalPath},${r.nodeType}`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-analysis-${tab.scenario.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJSON(): void {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return;

    const data = { scenario: tab.scenario.name, metrics: tab.metrics, nodeResults: tab.nodeResults };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-analysis-${tab.scenario.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Formatting helpers ─────────────────────────────────────────────────

  cleanValue(val: number): number {
    return parseFloat(val.toPrecision(10));
  }

  formatCost(val: number): string {
    return this.currencyFormatter.format(this.cleanValue(val));
  }

  formatCostShort(val: number): string {
    const v = this.cleanValue(val);
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toFixed(0);
  }

  formatBudgetShare(val: number): string {
    return this.cleanValue(val).toFixed(1) + '%';
  }

  getCostHeatColor(accumulatedCost: number): string {
    const tab = this.activeTab();
    const maxCost = tab?.metrics?.criticalPathCost || 1;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const ratio = Math.max(0, Math.min(1, accumulatedCost / maxCost));
    const hue = (1 - ratio) * 120;
    const lightness = isDark ? 25 : 90;
    return `hsl(${hue}, 70%, ${lightness}%)`;
  }

  getTabStatus(name: string): string {
    return this.scenarioTabs().get(name)?.status || 'idle';
  }

  getNodeType(nodeId: number, ni: any): string {
    if (ni.sourceNodes.includes(nodeId)) return 'Source';
    if (ni.sinkNodes.includes(nodeId)) return 'Sink';
    if (ni.forkNodes.includes(nodeId)) return 'Fork';
    if (ni.joinNodes.includes(nodeId)) return 'Join';
    return 'Regular';
  }

  private getSortValue(r: CostNodeResult, col: string): number {
    switch (col) {
      case 'nodeId': return r.nodeId;
      case 'nodeCost': return r.nodeCost;
      case 'accumulatedCost': return r.accumulatedCost;
      case 'budgetShare': return r.budgetShare;
      case 'slack': return r.slack;
      default: return r.nodeId;
    }
  }
}
