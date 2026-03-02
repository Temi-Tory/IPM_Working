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

interface TimeNodeResult {
  nodeId: number;
  duration: number;        // Activity duration (from input_data)
  earlyStart: number;      // ES
  earlyFinish: number;     // EF (node_values)
  lateStart: number;       // LS (from backward pass, or EF+slack fallback)
  lateFinish: number;      // LF (from backward pass)
  slack: number;           // True slack = LS - ES
  isOnCriticalPath: boolean;
  nodeType: string;
}

interface TimeMetrics {
  computationTime: number;
  criticalPathDuration: number;
  criticalPathLength: number;
  averageSlack: number;
  maxSlack: number;
  criticalCount: number;
  nearCriticalCount: number;
  sourceCount: number;
  sinkCount: number;
  totalNodes: number;
}

interface SlackBucket {
  label: string;
  count: number;
  heightPercent: number;
}

interface ScenarioTabState {
  scenario: { name: string; path: string; displayName: string; networkPath: string | undefined };
  status: 'idle' | 'computing' | 'computed' | 'error';
  nodeResults: TimeNodeResult[];
  metrics: TimeMetrics | null;
  rawScenario: CpmScenario | null;
  error: string | null;
  searchTerm: string;
  selectedNodeTypes: string[];
  pageIndex: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
  showAdvancedColumns: boolean;
}

interface ComparisonRow {
  nodeId: number;
  baseEF: number | null;
  compareEF: number | null;
  deltaEF: number | null;
  baseSlack: number | null;
  compareSlack: number | null;
  deltaSlack: number | null;
  nodeType: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SummaryObservation {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'good';
}

@Component({
  selector: 'app-time-analysis',
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
  templateUrl: './time-analysis.component.html',
  styleUrl: './time-analysis.component.scss'
})
export class TimeAnalysisComponent implements OnInit, OnDestroy, ScenarioAwareComponent {

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
  showAdvancedColumns = signal(false);

  // Comparison state
  comparisonMode = signal(false);
  baseScenarioName = signal('');
  compareScenarioName = signal('');

  // Copy feedback
  copiedCellKey = signal('');

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
  activeFilteredResults = computed((): TimeNodeResult[] => {
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
  activePaginatedResults = computed((): TimeNodeResult[] => {
    const filtered = this.activeFilteredResults();
    const start = this.activePageIndex() * this.activePageSize();
    return filtered.slice(start, start + this.activePageSize());
  });

  // ─── Computed: slack histogram ────────────────────────────────────────────
  slackHistogram = computed((): SlackBucket[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed' || !tab.metrics) return [];

    const results = tab.nodeResults;
    const maxSlack = tab.metrics.criticalPathDuration;
    if (maxSlack <= 0) return [];

    const bucketCount = 10;
    const bucketWidth = maxSlack / bucketCount;
    const counts: number[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const lo = i * bucketWidth;
      const hi = (i + 1) * bucketWidth;
      counts.push(results.filter(r => r.slack >= lo && (i === bucketCount - 1 ? r.slack <= hi : r.slack < hi)).length);
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
        label: `${this.cleanValue(lo).toFixed(1)}-${this.cleanValue(hi).toFixed(1)}`,
        count,
        heightPercent: (count / maxCount) * 100
      };
    });
  });

  // ─── Computed: critical path comparison (time vs cost) ────────────────────
  pathComparison = computed(() => {
    const tab = this.activeTab();
    if (!tab || !tab.rawScenario) return null;

    const timeCritical = tab.rawScenario.time_result?.critical_nodes || [];
    const costCritical = tab.rawScenario.cost_result?.critical_nodes || [];

    if (timeCritical.length === 0 || costCritical.length === 0) return null;

    const timeSet = new Set(timeCritical);
    const costSet = new Set(costCritical);
    const common = timeCritical.filter(n => costSet.has(n));
    const timeOnly = timeCritical.filter(n => !costSet.has(n));
    const costOnly = costCritical.filter(n => !timeSet.has(n));

    return {
      timePath: timeCritical,
      costPath: costCritical,
      commonNodes: common,
      timeOnlyNodes: timeOnly,
      costOnlyNodes: costOnly,
      identical: timeOnly.length === 0 && costOnly.length === 0
    };
  });

  // ─── Computed: node type stats ────────────────────────────────────────────
  nodeTypeStats = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    const typeMap = new Map<string, { count: number; totalSlack: number }>();
    for (const r of tab.nodeResults) {
      const entry = typeMap.get(r.nodeType) || { count: 0, totalSlack: 0 };
      entry.count++;
      entry.totalSlack += r.slack;
      typeMap.set(r.nodeType, entry);
    }

    const iconMap: Record<string, string> = {
      Source: 'login', Sink: 'logout', Fork: 'call_split', Join: 'call_merge', Regular: 'radio_button_unchecked'
    };

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgSlack: data.totalSlack / data.count,
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
        baseEF: base?.earlyFinish ?? null,
        compareEF: comp?.earlyFinish ?? null,
        deltaEF: (base && comp) ? comp.earlyFinish - base.earlyFinish : null,
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

    // Critical path duration comparison
    const durationRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, duration: this.cleanValue(tab.metrics?.criticalPathDuration ?? 0) }))
      .sort((a, b) => a.duration - b.duration);

    if (durationRanking.length >= 2) {
      const fastest = durationRanking[0];
      const slowest = durationRanking[durationRanking.length - 1];
      observations.push({
        icon: 'timer',
        text: `Critical path: shortest ${fastest.name} (${fastest.duration.toFixed(1)}), longest ${slowest.name} (${slowest.duration.toFixed(1)})`,
        severity: 'info'
      });

      if (fastest.duration > 0) {
        const pctDiff = ((slowest.duration - fastest.duration) / fastest.duration * 100).toFixed(0);
        observations.push({
          icon: 'trending_up',
          text: `${slowest.name} is ${pctDiff}% longer than ${fastest.name}`,
          severity: 'info'
        });
      }
    }

    // Average slack comparison
    const slackRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, slack: this.cleanValue(tab.metrics?.averageSlack ?? 0) }))
      .sort((a, b) => b.slack - a.slack);

    if (slackRanking.length >= 2) {
      observations.push({
        icon: 'schedule',
        text: `Most slack: ${slackRanking[0].name} (avg ${slackRanking[0].slack.toFixed(1)}), least: ${slackRanking[slackRanking.length - 1].name} (${slackRanking[slackRanking.length - 1].slack.toFixed(1)})`,
        severity: slackRanking[slackRanking.length - 1].slack <= 0 ? 'warning' : 'info'
      });
    }

    // Critical node count
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

  private static readonly VIEW_KEY = 'time-analysis';

  ngOnInit(): void {
    this.loadData();

    // Restore cached state from previous navigation (avoids unnecessary re-run)
    const cached = this.analysisStateService.restoreViewState(TimeAnalysisComponent.VIEW_KEY);
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
        this.showAdvancedColumns.set(cached.uiState.showAdvancedColumns || false);
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
    // Reset any in-flight computations to idle (prevents stuck "computing" on return)
    for (const [name, tab] of this.scenarioTabs()) {
      if (tab.status === 'computing') {
        this.updateTabState(name, { status: 'idle' });
      }
    }
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
      TimeAnalysisComponent.VIEW_KEY,
      this.scenarioTabs(),
      this.activeTabIndex(),
      {
        searchTerm: this.activeSearchTerm(),
        selectedNodeTypes: this.activeSelectedNodeTypes(),
        pageIndex: this.activePageIndex(),
        pageSize: this.activePageSize(),
        sortColumn: this.activeSortColumn(),
        sortDirection: this.activeSortDirection(),
        showAdvancedColumns: this.showAdvancedColumns(),
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
      name: group.scenarioName || `cpm-time-${index}`,
      dataType: 'cpm' as any,
      path: group.cpmInputsFile?.path || '',
      displayName: group.scenarioName || `Time Scenario ${index + 1}`,
      analysisType: 'cpm' as const,
    }));

    const tabs = new Map<string, ScenarioTabState>();
    validGroups.forEach((group, index) => {
      const name = group.scenarioName || `cpm-time-${index}`;
      tabs.set(name, {
        scenario: {
          name,
          path: group.cpmInputsFile?.path || '',
          displayName: group.scenarioName || `Time Scenario ${index + 1}`,
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
        sortDirection: '',
        showAdvancedColumns: false
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
    this.analysisStateService.clearViewState(TimeAnalysisComponent.VIEW_KEY);
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
      if (!raw?.time_result) {
        throw new Error('No time results in CPM response');
      }

      const nodeResults = this.processTimeResults(raw);
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
      const msg = error instanceof Error ? error.message : 'Time analysis failed';
      this.updateTabState(scenarioName, { status: 'error', error: msg });
      this.cdr.detectChanges();
    }
  }

  // ─── Results processing ─────────────────────────────────────────────────

  private processTimeResults(raw: CpmScenario): TimeNodeResult[] {
    const timeResult = raw.time_result;
    if (!timeResult?.node_values) return [];

    const ni = this.networkInfo();
    const criticalSet = new Set(timeResult.critical_nodes || []);
    const criticalValue = timeResult.critical_value || 0;

    // Input data for durations
    const nodeDurations = raw.input_data?.node_durations || {};

    // Backward pass data (from enhanced backend)
    const earlyStartData = timeResult.early_start || {};
    const lateFinishData = timeResult.late_finish || {};
    const lateStartData = timeResult.late_start || {};
    const totalSlackData = timeResult.total_slack || {};

    const hasBackwardPass = Object.keys(lateFinishData).length > 0;

    return Object.entries(timeResult.node_values).map(([nodeIdStr, efValue]) => {
      const nodeId = parseInt(nodeIdStr);
      const ef = this.cleanValue(typeof efValue === 'number' ? efValue : parseFloat(efValue as string) || 0);
      const duration = this.cleanValue(nodeDurations[nodeIdStr] ?? 0);
      const isOnCriticalPath = criticalSet.has(nodeId);

      let es: number, ls: number, lf: number, slack: number;

      if (hasBackwardPass) {
        es = this.cleanValue(earlyStartData[nodeIdStr] ?? (ef - duration));
        lf = this.cleanValue(lateFinishData[nodeIdStr] ?? ef);
        ls = this.cleanValue(lateStartData[nodeIdStr] ?? (lf - duration));
        slack = this.cleanValue(totalSlackData[nodeIdStr] ?? (ls - es));
      } else {
        // Graceful degradation: compute from forward pass only
        es = this.cleanValue(ef - duration);
        slack = isOnCriticalPath ? 0 : Math.max(0, criticalValue - ef);
        ls = es + slack;
        lf = ef + slack;
      }

      return {
        nodeId,
        duration,
        earlyStart: es,
        earlyFinish: ef,
        lateStart: ls,
        lateFinish: lf,
        slack: Math.max(0, slack),
        isOnCriticalPath,
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Regular'
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  }

  private calculateMetrics(raw: CpmScenario, results: TimeNodeResult[]): TimeMetrics {
    const timeResult = raw.time_result;
    const criticalValue = timeResult?.critical_value || 0;
    const criticalNodes = timeResult?.critical_nodes || [];
    const ni = this.networkInfo();

    const slackValues = results.map(r => r.slack);
    const nearCriticalThreshold = criticalValue * 0.05;

    return {
      computationTime: raw.computation_time || 0,
      criticalPathDuration: criticalValue,
      criticalPathLength: criticalNodes.length,
      averageSlack: slackValues.length > 0 ? slackValues.reduce((a, b) => a + b, 0) / slackValues.length : 0,
      maxSlack: slackValues.length > 0 ? Math.max(...slackValues) : 0,
      criticalCount: criticalNodes.length,
      nearCriticalCount: results.filter(r => !r.isOnCriticalPath && r.slack > 0 && r.slack < nearCriticalThreshold).length,
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

  toggleAdvancedColumns(): void {
    this.showAdvancedColumns.set(!this.showAdvancedColumns());
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

    let csv = 'Node ID,Duration,Early Start,Early Finish,Late Start,Late Finish,Slack,Critical Path,Node Type\n';
    csv += tab.nodeResults.map(r =>
      `${r.nodeId},${r.duration},${r.earlyStart.toFixed(1)},${r.earlyFinish.toFixed(1)},${r.lateStart.toFixed(1)},${r.lateFinish.toFixed(1)},${r.slack.toFixed(1)},${r.isOnCriticalPath},${r.nodeType}`
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-analysis-${tab.scenario.name}.csv`;
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
    a.download = `time-analysis-${tab.scenario.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getTabStatus(name: string): string {
    return this.scenarioTabs().get(name)?.status || 'idle';
  }

  // ─── Formatting helpers ─────────────────────────────────────────────────

  cleanValue(val: any): number {
    if (typeof val === 'number') return parseFloat(val.toFixed(10));
    if (val && typeof val === 'object') {
      if (typeof val.lower === 'number' && typeof val.upper === 'number') return (val.lower + val.upper) / 2;
      if (typeof val.mean_lower === 'number' && typeof val.mean_upper === 'number') return (val.mean_lower + val.mean_upper) / 2;
    }
    return 0;
  }

  formatTime(val: number): string {
    return this.cleanValue(val).toFixed(1);
  }

  getSlackClass(slack: number): string {
    const tab = this.activeTab();
    const criticalValue = tab?.metrics?.criticalPathDuration || 1;
    if (slack === 0) return 'slack-critical';
    if (slack < criticalValue * 0.05) return 'slack-near-critical';
    return 'slack-safe';
  }

  getGanttLeftPercent(result: TimeNodeResult): number {
    const criticalValue = this.activeTab()?.metrics?.criticalPathDuration || 1;
    return (result.earlyStart / criticalValue) * 100;
  }

  getGanttWidthPercent(result: TimeNodeResult): number {
    const criticalValue = this.activeTab()?.metrics?.criticalPathDuration || 1;
    const duration = result.earlyFinish - result.earlyStart;
    return Math.max(1, (duration / criticalValue) * 100);
  }

  getNodeType(nodeId: number, ni: any): string {
    if (ni.sourceNodes.includes(nodeId)) return 'Source';
    if (ni.sinkNodes.includes(nodeId)) return 'Sink';
    if (ni.forkNodes.includes(nodeId)) return 'Fork';
    if (ni.joinNodes.includes(nodeId)) return 'Join';
    return 'Regular';
  }

  private getSortValue(r: TimeNodeResult, col: string): number {
    switch (col) {
      case 'nodeId': return r.nodeId;
      case 'duration': return r.duration;
      case 'earlyStart': return r.earlyStart;
      case 'earlyFinish': return r.earlyFinish;
      case 'lateStart': return r.lateStart;
      case 'lateFinish': return r.lateFinish;
      case 'slack': return r.slack;
      default: return r.nodeId;
    }
  }
}
