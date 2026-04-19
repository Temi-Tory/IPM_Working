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
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { CapacityAnalysisService } from '../../shared/services/capacity-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import {
  ScenarioInfo,
  NetworkStructure,
  AnalysisResponse,
  CapacityScenario,
  CapacityFileGroup,
  ComparativeAnalysis,
  EdgeUtilization
} from '../../shared/models/network-analysis.models';

// ─── Interfaces ───────────────────────────────────────────────────────────────

type ValueLike = number | { lower: number; upper: number } | { mean_lower: number; mean_upper: number };
type BottleneckClass = 'definite' | 'conditional' | 'not';

interface CapacityNodeResult {
  nodeId: number;
  capacity: number;
  maxFlow: number;
  utilization: number;
  spareCapacity: number;
  nodeType: string;
  isBottleneck: boolean;
  bottleneckClass: BottleneckClass;
  // Raw values before midpoint conversion
  rawCapacity?: ValueLike;
  rawMaxFlow?: ValueLike;
  rawUtilization?: ValueLike;
}

interface CapacityEdgeResult {
  edgeKey: string;
  from: number;
  to: number;
  capacity: number;
  flow: number;
  utilization: number;
  spare: number;
  isBottleneck: boolean;
  bottleneckClass: BottleneckClass;
  // Raw values
  rawCapacity?: ValueLike;
  rawFlow?: ValueLike;
  rawUtilization?: ValueLike;
}

interface CapacityMetrics {
  computationTime: number;
  networkUtilization: number;
  totalSourceInput: number;
  totalTargetOutput: number;
  bottleneckCount: number;
  definiteBottlenecks: number;
  conditionalBottlenecks: number;
  sourceCount: number;
  sinkCount: number;
  // Raw values
  rawNetworkUtilization?: ValueLike;
  rawTotalSourceInput?: ValueLike;
  rawTotalTargetOutput?: ValueLike;
}

interface ScenarioTabState {
  scenario: { name: string; path: string; displayName: string; networkPath: string | undefined };
  status: 'idle' | 'computing' | 'computed' | 'error';
  nodeResults: CapacityNodeResult[];
  edgeResults: CapacityEdgeResult[];
  metrics: CapacityMetrics | null;
  rawScenario: CapacityScenario | null;
  error: string | null;
  searchTerm: string;
  selectedNodeTypes: string[];
  pageIndex: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
}

interface NodeTypeStats {
  type: string;
  count: number;
  avgUtilization: number;
  icon: string;
}

interface ComparisonRow {
  nodeId: number;
  baseFlow: number | null;
  compareFlow: number | null;
  deltaFlow: number | null;
  baseUtilization: number | null;
  compareUtilization: number | null;
  deltaUtilization: number | null;
  nodeType: string;
}

interface ComparisonEdgeRow {
  edgeKey: string;
  from: number;
  to: number;
  baseFlow: number | null;
  compareFlow: number | null;
  deltaFlow: number | null;
  baseUtilization: number | null;
  compareUtilization: number | null;
  deltaUtilization: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SummaryObservation {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'good';
}

@Component({
  selector: 'app-capacity-analysis',
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
  templateUrl: './capacity-analysis.component.html',
  styleUrl: './capacity-analysis.component.scss'
})
export class CapacityAnalysisComponent implements OnInit, OnDestroy, ScenarioAwareComponent {

  // ─── Service injection ────────────────────────────────────────────────────
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private capacityAnalysisService = inject(CapacityAnalysisService);
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

  // View toggle: 'node' or 'edge'
  activeViewMode = signal<'node' | 'edge'>('node');

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
  activeFilteredResults = computed((): CapacityNodeResult[] => {
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
        const valA = this.getNodeSortValue(a, col);
        const valB = this.getNodeSortValue(b, col);
        return dir === 'asc' ? valA - valB : valB - valA;
      });
    }
    return results;
  });

  // ─── Computed: filtered edge results ──────────────────────────────────────
  activeFilteredEdgeResults = computed((): CapacityEdgeResult[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    let results = [...tab.edgeResults];
    const search = this.activeSearchTerm().toLowerCase();

    if (search) {
      results = results.filter(r =>
        r.from.toString().includes(search) ||
        r.to.toString().includes(search) ||
        r.edgeKey.includes(search)
      );
    }

    const col = this.activeSortColumn();
    const dir = this.activeSortDirection();
    if (col && dir) {
      results.sort((a, b) => {
        const valA = this.getEdgeSortValue(a, col);
        const valB = this.getEdgeSortValue(b, col);
        return dir === 'asc' ? valA - valB : valB - valA;
      });
    }
    return results;
  });

  // ─── Computed: paginated results ──────────────────────────────────────────
  activePaginatedResults = computed((): CapacityNodeResult[] => {
    const filtered = this.activeFilteredResults();
    const start = this.activePageIndex() * this.activePageSize();
    return filtered.slice(start, start + this.activePageSize());
  });

  activePaginatedEdgeResults = computed((): CapacityEdgeResult[] => {
    const filtered = this.activeFilteredEdgeResults();
    const start = this.activePageIndex() * this.activePageSize();
    return filtered.slice(start, start + this.activePageSize());
  });

  // ─── Computed: node type stats ────────────────────────────────────────────
  nodeTypeStats = computed((): NodeTypeStats[] => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return [];

    const typeMap = new Map<string, { count: number; totalUtil: number }>();
    for (const r of tab.nodeResults) {
      const entry = typeMap.get(r.nodeType) || { count: 0, totalUtil: 0 };
      entry.count++;
      entry.totalUtil += r.utilization;
      typeMap.set(r.nodeType, entry);
    }

    const iconMap: Record<string, string> = {
      Source: 'login', Sink: 'logout', Fork: 'call_split', Join: 'call_merge', Regular: 'radio_button_unchecked'
    };

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgUtilization: data.totalUtil / data.count,
      icon: iconMap[type] || 'circle'
    }));
  });

  // ─── Computed: sink node summary ──────────────────────────────────────────
  sinkNodeSummary = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return null;

    const sinkResults = tab.nodeResults
      .filter(r => r.nodeType === 'Sink')
      .sort((a, b) => a.maxFlow - b.maxFlow);

    if (sinkResults.length === 0) return null;

    const flows = sinkResults.map(r => r.maxFlow);
    return {
      nodes: sinkResults,
      worst: sinkResults[0],
      best: sinkResults[sinkResults.length - 1],
      average: flows.reduce((a, b) => a + b, 0) / flows.length
    };
  });

  // ─── Computed: source flow summary ──────────────────────────────────────
  sourceFlowSummary = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed' || !tab.rawScenario) return null;

    const raw = tab.rawScenario;
    const rcr = raw.raw_capacity_result;
    if (!rcr?.source_rates) return null;

    const ni = this.networkInfo();
    const sinkNodes = ni?.sinkNodes || raw.target_nodes || [];
    const totalTargetOutput = raw.total_target_output || 0;

    const sources = Object.entries(rcr.source_rates).map(([nodeIdStr, rate]) => {
      const nodeId = parseInt(nodeIdStr);
      const actualFlow = rcr.node_max_flows?.[nodeIdStr] ?? 0;
      const deliveryRatio = rate > 0 ? actualFlow / rate : 0;

      // Calculate what % of this source's flow reaches each sink
      const sinkReach: { sinkId: number; flow: number; percent: number }[] = [];
      if (raw.target_flows) {
        for (const sinkId of sinkNodes) {
          const sinkFlow = raw.target_flows[String(sinkId)] ?? 0;
          if (sinkFlow > 0 && totalTargetOutput > 0) {
            sinkReach.push({
              sinkId,
              flow: sinkFlow,
              percent: (sinkFlow / totalTargetOutput) * 100
            });
          }
        }
      }

      return {
        nodeId,
        inputRate: this.cleanValue(rate),
        actualFlow: this.cleanValue(actualFlow),
        deliveryRatio: this.cleanValue(deliveryRatio),
        sinkReach
      };
    });

    return sources.length > 0 ? sources : null;
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
        baseFlow: base?.maxFlow ?? null,
        compareFlow: comp?.maxFlow ?? null,
        deltaFlow: (base && comp) ? comp.maxFlow - base.maxFlow : null,
        baseUtilization: base?.utilization ?? null,
        compareUtilization: comp?.utilization ?? null,
        deltaUtilization: (base && comp) ? comp.utilization - base.utilization : null,
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Regular'
      };
    });
  });

  // ─── Computed: comparison edge rows ──────────────────────────────────────
  comparisonEdgeRows = computed((): ComparisonEdgeRow[] => {
    if (!this.comparisonMode()) return [];
    const tabs = this.scenarioTabs();
    const baseTab = tabs.get(this.baseScenarioName());
    const compTab = tabs.get(this.compareScenarioName());
    if (!baseTab || !compTab || baseTab.status !== 'computed' || compTab.status !== 'computed') return [];

    const baseMap = new Map(baseTab.edgeResults.map(r => [r.edgeKey, r]));
    const compMap = new Map(compTab.edgeResults.map(r => [r.edgeKey, r]));
    const allEdgeKeys = new Set([...baseMap.keys(), ...compMap.keys()]);

    return Array.from(allEdgeKeys).sort().map(edgeKey => {
      const base = baseMap.get(edgeKey);
      const comp = compMap.get(edgeKey);
      return {
        edgeKey,
        from: base?.from ?? comp?.from ?? 0,
        to: base?.to ?? comp?.to ?? 0,
        baseFlow: base?.flow ?? null,
        compareFlow: comp?.flow ?? null,
        deltaFlow: (base && comp) ? comp.flow - base.flow : null,
        baseUtilization: base?.utilization ?? null,
        compareUtilization: comp?.utilization ?? null,
        deltaUtilization: (base && comp) ? comp.utilization - base.utilization : null,
      };
    });
  });

  // ─── Computed: comparison tab states (for summary cards) ────────────────
  baseTabState = computed(() => this.scenarioTabs().get(this.baseScenarioName()) || null);
  compareTabState = computed(() => this.scenarioTabs().get(this.compareScenarioName()) || null);

  // ─── Computed: completed count ────────────────────────────────────────────
  completedCount = computed((): number => {
    let count = 0;
    for (const tab of this.scenarioTabs().values()) {
      if (tab.status === 'computed') count++;
    }
    return count;
  });

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

    // Network utilization ranking
    const utilRanking = computedTabs
      .map(([, tab]) => ({ name: tab.scenario.displayName, util: this.cleanValue(tab.metrics?.networkUtilization ?? 0) }))
      .sort((a, b) => a.util - b.util);

    if (utilRanking.length >= 2) {
      const progression = utilRanking.map(v => `${(v.util * 100).toFixed(1)}% (${v.name})`).join(' < ');
      observations.push({
        icon: 'speed',
        text: `Utilisation: ${progression}`,
        severity: utilRanking[utilRanking.length - 1].util > 0.9 ? 'warning' : 'info'
      });
    } else if (utilRanking.length === 1) {
      observations.push({
        icon: 'speed',
        text: `${utilRanking[0].name}: ${(utilRanking[0].util * 100).toFixed(1)}% utilisation`,
        severity: utilRanking[0].util > 0.9 ? 'warning' : utilRanking[0].util > 0.7 ? 'info' : 'good'
      });
    }

    // Bottleneck count progression - now distinguish  definite vs conditional
    const bnRanking = computedTabs
      .map(([, tab]) => ({
        name: tab.scenario.displayName,
        count: tab.metrics?.bottleneckCount ?? 0,
        definite: tab.metrics?.definiteBottlenecks ?? 0,
        conditional: tab.metrics?.conditionalBottlenecks ?? 0
      }))
      .sort((a, b) => a.definite - b.definite);

    if (bnRanking.length >= 2 && bnRanking.some(r => r.definite > 0)) {
      const progression = bnRanking
        .filter(r => r.definite > 0)
        .map(v => `${v.definite} definite (${v.name})`)
        .join(' < ');
      observations.push({
        icon: 'block',
        text: `Definite bottlenecks: ${progression}`,
        severity: bnRanking[bnRanking.length - 1].definite > 2 ? 'warning' : 'info'
      });
    } else if (bnRanking.length >= 1 && bnRanking.every(v => v.count === 0)) {
      observations.push({ icon: 'check_circle', text: 'No bottlenecks detected in any scenario', severity: 'good' });
    } else if (bnRanking.some(r => r.conditional > 0)) {
      const conditionalSummary = bnRanking.filter(r => r.conditional > 0).map(v => `${v.conditional} (${v.name})`).join(', ');
      observations.push({
        icon: 'help_outline',
        text: `Conditional bottlenecks under uncertainty: ${conditionalSummary}`,
        severity: 'info'
      });
    }

    // Recurring bottleneck edges - now only definite ones
    const bottleneckEdgeCounts = new Map<string, { definite: number; conditional: number }>();
    for (const [, tab] of computedTabs) {
      const definiteBottlenecks = tab.edgeResults.filter(e => e.bottleneckClass === 'definite');
      const conditionalBottlenecks = tab.edgeResults.filter(e => e.bottleneckClass === 'conditional');
      for (const bn of definiteBottlenecks) {
        const entry = bottleneckEdgeCounts.get(bn.edgeKey) || { definite: 0, conditional: 0 };
        entry.definite++;
        bottleneckEdgeCounts.set(bn.edgeKey, entry);
      }
      for (const bn of conditionalBottlenecks) {
        const entry = bottleneckEdgeCounts.get(bn.edgeKey) || { definite: 0, conditional: 0 };
        entry.conditional++;
        bottleneckEdgeCounts.set(bn.edgeKey, entry);
      }
    }
    const recurringDefinite = Array.from(bottleneckEdgeCounts.entries())
      .filter(([, counts]) => counts.definite >= 2)
      .sort((a, b) => b[1].definite - a[1].definite);

    if (recurringDefinite.length > 0) {
      const topEdges = recurringDefinite.slice(0, 3).map(([key, counts]) => `${key} (${counts.definite}x)`).join(', ');
      observations.push({
        icon: 'warning',
        text: `Persistent bottleneck edges: ${topEdges}`,
        severity: 'warning'
      });
    }

    return { observations };
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  private static readonly VIEW_KEY = 'capacity-analysis';

  ngOnInit(): void {
    this.loadData();

    // Restore cached state from previous navigation (avoids unnecessary re-run)
    const cached = this.analysisStateService.restoreViewState(CapacityAnalysisComponent.VIEW_KEY);
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
        this.activeViewMode.set(cached.uiState.viewMode || 'node');
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
      CapacityAnalysisComponent.VIEW_KEY,
      this.scenarioTabs(),
      this.activeTabIndex(),
      {
        searchTerm: this.activeSearchTerm(),
        selectedNodeTypes: this.activeSelectedNodeTypes(),
        pageIndex: this.activePageIndex(),
        pageSize: this.activePageSize(),
        sortColumn: this.activeSortColumn(),
        sortDirection: this.activeSortDirection(),
        viewMode: this.activeViewMode(),
        comparisonMode: this.comparisonMode(),
        baseScenarioName: this.baseScenarioName(),
        compareScenarioName: this.compareScenarioName()
      }
    );
  }

  // ─── Push results to centralized state (for System Profile) ──────────────

  private pushToCentralizedState(): void {
    if (this.scenarioResults.size === 0) return;
    this.analysisStateService.setMultiScenarioCapacityResults({
      scenarios: new Map(this.scenarioResults) as Map<string, CapacityScenario>,
      currentScenario: this.currentScenario || this.scenarioNames()[Math.max(0, this.activeTabIndex() - 1)] || '',
      availableScenarios: this.availableScenarios
    });
  }

  // ─── ScenarioAwareComponent implementation ────────────────────────────────

  loadScenarios(): void {
    const capacityGroups: CapacityFileGroup[] = this.fileManagerService.analysisGroups().capacity;
    const validGroups = capacityGroups.filter(g => g.capacitiesFile);

    this.availableScenarios = validGroups.map((group, index) => ({
      name: group.scenarioName || `capacity-${index}`,
      dataType: 'float' as const,
      path: group.capacitiesFile?.path || '',
      displayName: group.scenarioName || `Capacity Scenario ${index + 1}`,
      analysisType: 'capacity' as const,
    }));

    const tabs = new Map<string, ScenarioTabState>();
    validGroups.forEach((group, index) => {
      const name = group.scenarioName || `capacity-${index}`;
      tabs.set(name, {
        scenario: {
          name,
          path: group.capacitiesFile?.path || '',
          displayName: group.scenarioName || `Capacity Scenario ${index + 1}`,
          networkPath: group.networkPath,
        },
        status: 'idle',
        nodeResults: [],
        edgeResults: [],
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
      tabs.set(name, { ...tab, status: 'idle', nodeResults: [], edgeResults: [], metrics: null, error: null, rawScenario: null });
    }
    this.scenarioTabs.set(tabs);
    this.scenarioResults.clear();
    this.analysisStateService.clearViewState(CapacityAnalysisComponent.VIEW_KEY);
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

    this.updateTabState(scenarioName, { status: 'computing', error: null });

    try {
      const scenario = tabState.scenario;
      const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
      const baseNetworkPath = (sessionNetworkPath || scenario.networkPath || '').replace(/\\/g, '/');
      if (!baseNetworkPath) throw new Error('No network path available');

      const networkName = baseNetworkPath.split('/').pop() || '';
      const edgesFilePath = `${networkName}.EDGES`;

      let capacitiesPath = scenario.path;
      if (networkName && capacitiesPath.startsWith(networkName + '/')) {
        capacitiesPath = capacitiesPath.substring(networkName.length + 1);
      }

      const request = { networkPath: baseNetworkPath, edgesFilePath, capacitiesPath };

      const response = await this.capacityAnalysisService.analyzeCapacity(request).toPromise();

      if (!response?.success || !response.capacity_result) {
        throw new Error(response?.message || 'Capacity analysis failed');
      }

      const raw = response.capacity_result;
      const nodeResults = this.processNodeResults(raw);
      const edgeResults = this.processEdgeResults(raw);
      const metrics = this.calculateMetrics(raw, edgeResults);

      this.updateTabState(scenarioName, {
        status: 'computed',
        nodeResults,
        edgeResults,
        metrics,
        rawScenario: raw,
        error: null
      });

      this.scenarioResults.set(scenarioName, raw);
      this.pushToCentralizedState();
      this.cdr.detectChanges();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Capacity analysis failed';
      this.updateTabState(scenarioName, { status: 'error', error: msg });
      this.cdr.detectChanges();
    }
  }

  // ─── Results processing ─────────────────────────────────────────────────

  private processNodeResults(raw: CapacityScenario): CapacityNodeResult[] {
    const rcr = raw.raw_capacity_result;
    if (!rcr) return [];

    const ni = this.networkInfo();
    const bottleneckNodes = new Set<number>();

    // Extract bottleneck node IDs
    if (rcr.bottlenecks) {
      for (const entries of Object.values(rcr.bottlenecks)) {
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (typeof entry === 'number') bottleneckNodes.add(entry);
            if (Array.isArray(entry)) {
              for (const item of entry) {
                if (typeof item === 'number') bottleneckNodes.add(item);
              }
            }
          }
        }
      }
    }

    return Object.entries(rcr.node_max_flows).map(([nodeIdStr, flow]) => {
      const nodeId = parseInt(nodeIdStr);
      const capacity = rcr.node_capacities?.[nodeIdStr] ?? 0;
      const maxFlow = this.cleanValue(flow);
      const cap = this.cleanValue(capacity);
      const utilization = cap > 0 ? maxFlow / cap : 0;

      const rawFlow = flow;
      const rawCap = capacity;
      const rawUtil = (cap > 0 && typeof flow === 'object' && typeof capacity === 'object')
        ? this.computeIntervalUtilization(flow, capacity)
        : utilization;

      const bottleneckClass = this.classifyBottleneck(rawUtil);

      return {
        nodeId,
        capacity: cap,
        maxFlow,
        utilization,
        spareCapacity: this.cleanValue(cap - maxFlow),
        nodeType: ni ? this.getNodeType(nodeId, ni) : 'Regular',
        isBottleneck: bottleneckNodes.has(nodeId) || bottleneckClass !== 'not',
        bottleneckClass,
        rawCapacity: rawCap,
        rawMaxFlow: rawFlow,
        rawUtilization: rawUtil
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  }

  private computeIntervalUtilization(flow: any, capacity: any): ValueLike {
    if (typeof flow === 'number' && typeof capacity === 'number') {
      return capacity > 0 ? flow / capacity : 0;
    }
    if (typeof flow === 'object' && typeof capacity === 'object') {
      if ('lower' in flow && 'upper' in flow && 'lower' in capacity && 'upper' in capacity) {
        // Interval division: [a,b] / [c,d] ≈ [a/d, b/c] when all positive
        // Preserve raw conservative bounds—do not clip
        const lower = capacity.upper > 0 ? flow.lower / capacity.upper : 0;
        const upper = capacity.lower > 0 ? flow.upper / capacity.lower : Infinity;
        return { lower: Math.max(0, lower), upper: isFinite(upper) ? upper : 999 };
      }
    }
    return this.cleanValue(flow) / this.cleanValue(capacity);
  }

  private processEdgeResults(raw: CapacityScenario): CapacityEdgeResult[] {
    const rcr = raw.raw_capacity_result;
    if (!rcr?.edge_utilization) return [];

    // Collect bottleneck edges
    const bottleneckEdges = new Set<string>();
    if (rcr.bottlenecks) {
      for (const entries of Object.values(rcr.bottlenecks)) {
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
              bottleneckEdges.add(`(${entry[0]}, ${entry[1]})`);
            }
          }
        }
      }
    }

    return Object.entries(rcr.edge_utilization).map(([edgeKey, data]: [string, any]) => {
      const match = edgeKey.match(/\((\d+),\s*(\d+)\)/);
      const from = match ? parseInt(match[1]) : 0;
      const to = match ? parseInt(match[2]) : 0;

      const rawUtil = data.utilization;
      const bottleneckClass = this.classifyBottleneck(rawUtil);

      return {
        edgeKey,
        from,
        to,
        capacity: this.cleanValue(data.capacity),
        flow: this.cleanValue(data.flow),
        utilization: this.cleanValue(data.utilization),
        spare: this.cleanValue(data.spare),
        isBottleneck: bottleneckEdges.has(edgeKey) || bottleneckClass !== 'not',
        bottleneckClass,
        rawCapacity: data.capacity,
        rawFlow: data.flow,
        rawUtilization: rawUtil
      };
    }).sort((a, b) => a.from - b.from || a.to - b.to);
  }

  private calculateMetrics(raw: CapacityScenario, edgeResults: CapacityEdgeResult[]): CapacityMetrics {
    const rcr = raw.raw_capacity_result;
    let bottleneckCount = 0;
    if (rcr?.bottlenecks) {
      for (const entries of Object.values(rcr.bottlenecks)) {
        if (Array.isArray(entries)) bottleneckCount += entries.length;
      }
    }

    const definiteBottlenecks = edgeResults.filter(e => e.bottleneckClass === 'definite').length;
    const conditionalBottlenecks = edgeResults.filter(e => e.bottleneckClass === 'conditional').length;

    return {
      computationTime: raw.computation_time,
      networkUtilization: this.cleanValue(raw.network_utilization),
      totalSourceInput: this.cleanValue(raw.total_source_input),
      totalTargetOutput: this.cleanValue(raw.total_target_output),
      bottleneckCount: definiteBottlenecks + conditionalBottlenecks,
      definiteBottlenecks,
      conditionalBottlenecks,
      sourceCount: raw.active_sources?.length || 0,
      sinkCount: raw.target_nodes?.length || 0,
      rawNetworkUtilization: raw.network_utilization,
      rawTotalSourceInput: raw.total_source_input,
      rawTotalTargetOutput: raw.total_target_output
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

  getTabStatus(name: string): string {
    return this.scenarioTabs().get(name)?.status || 'idle';
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

  toggleViewMode(): void {
    this.activeViewMode.set(this.activeViewMode() === 'node' ? 'edge' : 'node');
    this.activePageIndex.set(0);
    this.activeSortColumn.set(this.activeViewMode() === 'node' ? 'nodeId' : 'from');
    this.activeSortDirection.set('');
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

    const isEdge = this.activeViewMode() === 'edge';
    let csv: string;

    if (isEdge) {
      csv = 'Edge,From,To,Capacity,Flow,Utilization,Spare,Bottleneck\n';
      csv += tab.edgeResults.map(r =>
        `"${r.edgeKey}",${r.from},${r.to},${r.capacity},${r.flow},${r.utilization.toFixed(4)},${r.spare},${r.isBottleneck}`
      ).join('\n');
    } else {
      csv = 'Node ID,Capacity,Max Flow,Utilization,Spare Capacity,Node Type,Bottleneck\n';
      csv += tab.nodeResults.map(r =>
        `${r.nodeId},${r.capacity},${r.maxFlow},${r.utilization.toFixed(4)},${r.spareCapacity},${r.nodeType},${r.isBottleneck}`
      ).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capacity-analysis-${tab.scenario.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJSON(): void {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return;

    const data = { scenario: tab.scenario.name, metrics: tab.metrics, nodeResults: tab.nodeResults, edgeResults: tab.edgeResults };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capacity-analysis-${tab.scenario.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  // NEW: interval-aware formatters
  formatValueSafe(val: ValueLike | number | undefined, decimals = 1): string {
    if (val === undefined || val === null) return '--';
    if (typeof val === 'number') return val.toFixed(decimals);
    if (typeof val === 'object') {
      if ('lower' in val && 'upper' in val) {
        return `[${val.lower.toFixed(decimals)}, ${val.upper.toFixed(decimals)}]`;
      }
      if ('mean_lower' in val && 'mean_upper' in val) {
        return `[${val.mean_lower.toFixed(decimals)}, ${val.mean_upper.toFixed(decimals)}]`;
      }
    }
    return this.cleanValue(val).toFixed(decimals);
  }

  formatUtilizationSafe(val: ValueLike | number | undefined): string {
    if (val === undefined || val === null) return '--';
    if (typeof val === 'number') return (val * 100).toFixed(1) + '%';
    if (typeof val === 'object') {
      if ('lower' in val && 'upper' in val) {
        const lower = (val.lower * 100).toFixed(1);
        const upper = isFinite(val.upper) ? (val.upper * 100).toFixed(1) : '∞';
        return `[${lower}%, ${upper}%]`;
      }
      if ('mean_lower' in val && 'mean_upper' in val) {
        const ml = (val.mean_lower * 100).toFixed(1);
        const mu = (val.mean_upper * 100).toFixed(1);
        return `[${ml}%, ${mu}%]`;
      }
    }
    return (this.cleanValue(val) * 100).toFixed(1) + '%';
  }

  formatValue(val: number, decimals = 1): string {
    return this.cleanValue(val).toFixed(decimals);
  }

  formatUtilization(val: number): string {
    return (this.cleanValue(val) * 100).toFixed(1) + '%';
  }

  // Classify bottleneck certainty
  classifyBottleneck(rawUtil: ValueLike | number | undefined, threshold = 0.95): BottleneckClass {
    if (rawUtil === undefined || rawUtil === null) return 'not';
    if (typeof rawUtil === 'number') {
      return rawUtil >= threshold ? 'definite' : 'not';
    }
    if (typeof rawUtil === 'object') {
      if ('lower' in rawUtil && 'upper' in rawUtil) {
        // Definite: lower bound exceeds threshold
        // Conditional: upper bound exceeds threshold but lower doesn't
        if (rawUtil.lower >= threshold) return 'definite';
        if (rawUtil.upper >= threshold) return 'conditional';
        return 'not';
      }
      if ('mean_lower' in rawUtil && 'mean_upper' in rawUtil) {
        const ml = rawUtil.mean_lower;
        const mu = rawUtil.mean_upper;
        if (ml >= threshold) return 'definite';
        if (mu >= threshold) return 'conditional';
        return 'not';
      }
    }
    return 'not';
  }

  getUtilizationHeatColor(utilization: number): string {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const u = Math.max(0, Math.min(1, utilization));
    // Red (high utilization) → Yellow → Green (low utilization)
    const hue = (1 - u) * 120;
    const saturation = 70;
    const lightness = isDark ? 25 : 90;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  getNodeType(nodeId: number, ni: any): string {
    if (ni.sourceNodes.includes(nodeId)) return 'Source';
    if (ni.sinkNodes.includes(nodeId)) return 'Sink';
    if (ni.forkNodes.includes(nodeId)) return 'Fork';
    if (ni.joinNodes.includes(nodeId)) return 'Join';
    return 'Regular';
  }

  private getNodeSortValue(r: CapacityNodeResult, col: string): number {
    switch (col) {
      case 'nodeId': return r.nodeId;
      case 'capacity': return r.capacity;
      case 'maxFlow': return r.maxFlow;
      case 'utilization': return r.utilization;
      case 'spareCapacity': return r.spareCapacity;
      default: return r.nodeId;
    }
  }

  private getEdgeSortValue(r: CapacityEdgeResult, col: string): number {
    switch (col) {
      case 'from': return r.from;
      case 'to': return r.to;
      case 'capacity': return r.capacity;
      case 'flow': return r.flow;
      case 'utilization': return r.utilization;
      case 'spare': return r.spare;
      default: return r.from;
    }
  }
}
