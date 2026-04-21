import { Component, computed, inject, signal, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisService } from '../../shared/services/diamond-analysis.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import {
  ScenarioInfo,
  DiamondAnalysisResult,
  DiamondSummary,
  ConvergenceInsight,
  JoinNodeAnalysis,
  DiamondPattern,
  MultiScenarioDiamondResults,
  ScenarioComparison,
  ReachabilityFileGroup,
  UniqueDiamondStructure
} from '../../shared/models/network-analysis.models';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import { DiamondDetailsComponent } from './diamond-details/diamond-details.component';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface DiamondScenario {
  name: string;
  dataType: 'float' | 'interval' | 'pbox';
  displayName: string;
  networkPath: string | undefined;
  nodePriorsFile: any;
}

interface DiamondScenarioTabState {
  scenario: DiamondScenario;
  status: 'idle' | 'computing' | 'computed' | 'error';
  diamondResult: DiamondAnalysisResult | null;
  error: string | null;
  // Per-tab UI state
  selectedPatternType: string;
  innerTabIndex: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatSortModule,
    MatExpansionModule,
    MatMenuModule,
    FormsModule
  ],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent implements OnInit, OnDestroy, AfterViewInit, ScenarioAwareComponent {
  private analysisStateService = inject(AnalysisStateService);
  private diamondAnalysisService = inject(DiamondAnalysisService);
  private fileManagerService = inject(FileManagerService);
  private sessionService = inject(NetworkSessionService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private activatedRoute = inject(ActivatedRoute);
  private isDestroyed = false;

  @ViewChild(MatPaginator) set paginatorRef(paginator: MatPaginator) {
    if (paginator && this.dataSource) {
      this.dataSource.paginator = paginator;
    }
  }
  @ViewChild(MatSort) set sortRef(sort: MatSort) {
    if (sort && this.dataSource) {
      this.dataSource.sort = sort;
    }
  }

  // ─── ScenarioAwareComponent interface ─────────────────────────────────────
  currentScenario = '';
  availableScenarios: ScenarioInfo[] = [];
  isLoading = false;
  error: string | null = null;
  networkData: any = null;
  analysisResults: any = null;
  scenarioResults = new Map<string, any>();

  // ─── Tab state management (same pattern as exact-inference) ───────────────
  scenarioTabs = signal<Map<string, DiamondScenarioTabState>>(new Map());
  activeTabIndex = signal(0);

  // Per-tab UI state signals
  selectedPatternType = signal('');
  innerTabIndex = signal(0);

  // Comparison state
  comparisonMode = signal(false);

  // Filter state
  minNodeCount = signal(0);
  maxNodeCount = signal(100);

  // Table data source
  dataSource = new MatTableDataSource<DiamondPattern>([]);

  // ─── Computed: scenario names (tab order) ─────────────────────────────────
  scenarioNames = computed(() => Array.from(this.scenarioTabs().keys()));

  // ─── Computed: active tab state ───────────────────────────────────────────
  activeTab = computed((): DiamondScenarioTabState | null => {
    const tabs = this.scenarioTabs();
    const keys = Array.from(tabs.keys());
    const idx = this.activeTabIndex();
    if (idx < 0 || idx >= keys.length) return null;
    return tabs.get(keys[idx]) || null;
  });

  // ─── Computed: completed scenario count ───────────────────────────────────
  completedCount = computed((): number => {
    let count = 0;
    for (const tab of this.scenarioTabs().values()) {
      if (tab.status === 'computed') count++;
    }
    return count;
  });

  // ─── Computed: current diamond results from active tab ────────────────────
  currentDiamondResults = computed(() => {
    const tab = this.activeTab();
    if (!tab || tab.status !== 'computed') return null;
    return tab.diamondResult;
  });

  currentDiamondAnalysis = computed(() => this.currentDiamondResults());

  // ─── Computed: diamond summary ────────────────────────────────────────────
  diamondSummary = computed(() => {
    const results = this.currentDiamondResults();
    if (!results) return null;
    return this.diamondAnalysisService.processDiamondSummary(results);
  });

  // ─── Computed: convergence insights ───────────────────────────────────────
  convergenceInsights = computed(() => {
    const results = this.currentDiamondResults();
    if (!results) return [];
    return this.diamondAnalysisService.analyzeConvergencePatterns(results);
  });

  // ─── Computed: coverage metrics ───────────────────────────────────────────
  coverageMetrics = computed(() => this.calculateNetworkCoverage());

  // ─── Computed: join node analysis ─────────────────────────────────────────
  joinNodeAnalysis = computed(() => {
    const results = this.currentDiamondResults();
    if (!results) return [];
    return this.diamondAnalysisService.analyzeJoinNodes(results);
  });

  // ─── Computed: diamond patterns ───────────────────────────────────────────
  diamondPatterns = computed(() => {
    const currentResults = this.currentDiamondResults();
    if (!currentResults) return [];

    const patterns = this.diamondAnalysisService.extractDiamondPatterns(currentResults);
    if (currentResults.raw_unique_diamonds && patterns) {
      const rawUnique = currentResults.raw_unique_diamonds;
      return patterns.map((pattern, index) => {
        const diamondEntries = Object.entries(rawUnique);
        const [, diamondData] = diamondEntries[index] || ['', undefined as unknown as UniqueDiamondStructure];
        const isRootDiamond = diamondData?.is_root_diamond || false;
        const joinNode = diamondData?.join_node;
        return {
          ...pattern,
          diamondType: isRootDiamond ? 'Root' : 'Nested',
          joinNode: joinNode ?? pattern.joinNode
        };
      });
    }
    return patterns;
  });

  // ─── Computed: filtered diamond patterns ──────────────────────────────────
  filteredDiamondPatterns = computed(() => {
    const patterns = this.diamondPatterns();
    if (!patterns) return [];

    const minNodes = this.minNodeCount();
    const maxNodes = this.maxNodeCount();
    const patternType = this.selectedPatternType();

    const filtered = patterns.filter(pattern => {
      if (pattern.nodeCount < minNodes || pattern.nodeCount > maxNodes) return false;
      if (patternType) {
        switch (patternType) {
          case 'root': return pattern.isRoot;
          case 'nested': return !pattern.isRoot;
          case 'complex': return pattern.complexity > 50;
          case 'critical': return pattern.riskLevel === 'critical' || pattern.riskLevel === 'high';
          default: return true;
        }
      }
      return true;
    });

    setTimeout(() => this.updateDataSource(), 0);
    return filtered;
  });

  // Table columns
  displayedColumns: string[] = ['joinNode', 'diamondType', 'conditioningNodes', 'diamondComplexity', 'cascadeRisk', 'systemRole', 'actions'];

  private static readonly VIEW_KEY = 'diamond-analysis';

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Restore cached state
    const cached = this.analysisStateService.restoreViewState(DiamondAnalysisComponent.VIEW_KEY);
    if (cached && cached.tabs.size > 0) {
      this.scenarioTabs.set(cached.tabs as Map<string, DiamondScenarioTabState>);
      this.availableScenarios = Array.from(cached.tabs.values()).map((tab) => ({
        name: tab.scenario.name,
        dataType: tab.scenario.dataType,
        path: tab.scenario.nodePriorsFile?.path || '',
        displayName: tab.scenario.displayName,
        analysisType: 'reachability' as const,
        description: ''
      }));
      this.activeTabIndex.set(cached.activeTabIndex);
      if (cached.uiState) {
        this.selectedPatternType.set(cached.uiState.selectedPatternType || '');
        this.innerTabIndex.set(cached.uiState.innerTabIndex || 0);
        this.comparisonMode.set(cached.uiState.comparisonMode || false);
      }
      this.syncResultsFromTabs();
      this.pushToCentralizedState();
      this.restoreActiveTabUIState();
      this.updateFilterRanges();
    } else {
      // Normal initialization
      this.loadScenarios();
      // Manual trigger — don't auto-run. Tabs start as 'idle'.
    }

    // Drilldown support: if navigated from system profile with ?scenario=X, select that tab
    const scenarioParam = this.activatedRoute.snapshot.queryParamMap.get('scenario');
    if (scenarioParam) {
      const idx = this.scenarioNames().indexOf(scenarioParam);
      if (idx >= 0) this.activeTabIndex.set(idx);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.saveActiveTabUIState();
    this.persistViewState();
  }

  ngAfterViewInit(): void {
    this.updateDataSource();
  }

  // ─── ScenarioAwareComponent implementation ────────────────────────────────

  loadScenarios(): void {
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const validGroups = reachabilityGroups.filter(
      (g: ReachabilityFileGroup) => g.dataType === 'float' || g.dataType === 'interval' || g.dataType === 'pbox'
    );

    this.availableScenarios = validGroups.map((group: ReachabilityFileGroup, index: number) => ({
      name: group.scenarioName || `${group.dataType}-${index}`,
      dataType: group.dataType as 'float' | 'interval' | 'pbox',
      path: group.nodePriorsFile?.path || '',
      displayName: group.scenarioName
        ? `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})`
        : this.getDataTypeDisplayName(group.dataType),
      analysisType: 'reachability' as const,
      description: ''
    }));

    // Initialize tab state for each scenario
    const tabs = new Map<string, DiamondScenarioTabState>();
    validGroups.forEach((group: ReachabilityFileGroup, index: number) => {
      const name = group.scenarioName || `${group.dataType}-${index}`;
      tabs.set(name, {
        scenario: {
          name,
          dataType: group.dataType as 'float' | 'interval' | 'pbox',
          displayName: group.scenarioName
            ? `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})`
            : this.getDataTypeDisplayName(group.dataType),
          networkPath: group.networkPath,
          nodePriorsFile: group.nodePriorsFile
        },
        status: 'idle',
        diamondResult: null,
        error: null,
        selectedPatternType: '',
        innerTabIndex: 0
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
    this.loadScenarios();
  }

  clearScenarioData(): void {
    const tabs = new Map(this.scenarioTabs());
    for (const [name, tab] of tabs.entries()) {
      tabs.set(name, { ...tab, status: 'idle', diamondResult: null, error: null });
    }
    this.scenarioTabs.set(tabs);
    this.scenarioResults.clear();
    this.pushToCentralizedState();
    this.analysisStateService.clearViewState(DiamondAnalysisComponent.VIEW_KEY);
  }

  // ─── Run scenarios ────────────────────────────────────────────────────────

  async runAllScenarios(): Promise<void> {
    const tabs = this.scenarioTabs();
    if (tabs.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const name of tabs.keys()) {
      const tab = tabs.get(name);
      if (tab && (tab.status === 'idle' || tab.status === 'error')) {
        promises.push(this.runScenario(name));
      }
    }
    await Promise.allSettled(promises);
  }

  async runScenario(scenarioName: string): Promise<void> {
    const tabs = this.scenarioTabs();
    const tabState = tabs.get(scenarioName);
    if (!tabState) return;

    this.updateTabState(scenarioName, { status: 'computing', error: null });

    try {
      const scenario = tabState.scenario;
      const request = this.buildDiamondRequest(scenario);
      if (!request) {
        throw new Error('Could not build request: missing file paths');
      }

      const response = await this.diamondAnalysisService.analyzeDiamonds(request).toPromise();

      if (!response?.success || !response?.diamond_analysis) {
        throw new Error(response?.message || 'No results returned from backend');
      }

      this.updateTabState(scenarioName, {
        status: 'computed',
        diamondResult: response.diamond_analysis,
        error: null
      });

      this.scenarioResults.set(scenarioName, response.diamond_analysis);
      this.pushToCentralizedState();
      this.updateFilterRanges();
      if (!this.isDestroyed) {
        this.cdr.detectChanges();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Diamond analysis failed';
      this.updateTabState(scenarioName, { status: 'error', error: msg });
      if (!this.isDestroyed) {
        this.cdr.detectChanges();
      }
    }
  }

  async rerunScenario(scenarioName: string): Promise<void> {
    this.updateTabState(scenarioName, { status: 'idle', diamondResult: null, error: null });
    await this.runScenario(scenarioName);
  }

  private buildDiamondRequest(scenario: DiamondScenario): any | null {
    let networkPath = scenario.networkPath;
    if (!networkPath) {
      networkPath = this.sessionService.getCurrentSession()?.networkPath;
    }
    if (!networkPath) return null;

    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const matchingGroup = reachabilityGroups.find(
      g => g.scenarioName === scenario.name && g.dataType === scenario.dataType
    );

    const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
    const baseNetworkPath = (sessionNetworkPath || matchingGroup?.networkPath || networkPath).replace(/\\/g, '/');
    const networkName = baseNetworkPath.split('/').pop() || '';

    let relativeNodePriorsPath = scenario.nodePriorsFile?.path || '';

    // Strip network name prefix if present
    if (networkName && relativeNodePriorsPath.startsWith(networkName + '/')) {
      relativeNodePriorsPath = relativeNodePriorsPath.substring(networkName.length + 1);
    }
    // Remove duplicate network prefixes
    const pathParts = relativeNodePriorsPath.split('/');
    while (pathParts.length > 0 && pathParts[0] === networkName) {
      pathParts.shift();
    }
    relativeNodePriorsPath = pathParts.join('/');

    return {
      networkPath: baseNetworkPath,
      nodepriorsPath: relativeNodePriorsPath || undefined
    };
  }

  // ─── Tab management ───────────────────────────────────────────────────────

  onScenarioTabChange(newIndex: number): void {
    this.saveActiveTabUIState();
    this.activeTabIndex.set(newIndex);
    this.restoreActiveTabUIState();
    this.updateFilterRanges();
    this.updateDataSource();
  }

  onInnerTabChange(index: number): void {
    this.innerTabIndex.set(index);
  }

  private saveActiveTabUIState(): void {
    const keys = Array.from(this.scenarioTabs().keys());
    const currentKey = keys[this.activeTabIndex()];
    if (!currentKey) return;
    this.updateTabState(currentKey, {
      selectedPatternType: this.selectedPatternType(),
      innerTabIndex: this.innerTabIndex()
    });
  }

  private restoreActiveTabUIState(): void {
    const tab = this.activeTab();
    if (!tab) return;
    this.selectedPatternType.set(tab.selectedPatternType);
    this.innerTabIndex.set(tab.innerTabIndex);
  }

  private updateTabState(name: string, update: Partial<DiamondScenarioTabState>): void {
    const current = new Map(this.scenarioTabs());
    const existing = current.get(name);
    if (existing) {
      current.set(name, { ...existing, ...update });
      this.scenarioTabs.set(current);
      this.persistViewState();
    }
  }

  private syncResultsFromTabs(): void {
    this.scenarioResults.clear();
    for (const [scenarioName, tab] of this.scenarioTabs().entries()) {
      if (tab.status === 'computed' && tab.diamondResult) {
        this.scenarioResults.set(scenarioName, tab.diamondResult);
      }
    }
  }

  private pushToCentralizedState(): void {
    this.analysisStateService.setMultiScenarioDiamondResults({
      scenarios: new Map(this.scenarioResults),
      currentScenario: this.currentScenario || this.scenarioNames()[Math.max(0, this.activeTabIndex())] || '',
      availableScenarios: this.availableScenarios
    });
  }

  private persistViewState(): void {
    this.analysisStateService.saveViewState(
      DiamondAnalysisComponent.VIEW_KEY,
      this.scenarioTabs(),
      this.activeTabIndex(),
      {
        selectedPatternType: this.selectedPatternType(),
        innerTabIndex: this.innerTabIndex(),
        comparisonMode: this.comparisonMode()
      }
    );
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
    return this.scenarioTabs().get(name)?.scenario.dataType || 'float';
  }

  // ─── Data source and filters ──────────────────────────────────────────────

  private updateDataSource(): void {
    const patterns = this.filteredDiamondPatterns();
    this.dataSource.data = patterns || [];
  }

  private updateFilterRanges(): void {
    const patterns = this.diamondPatterns();
    if (patterns && patterns.length > 0) {
      const nodeCounts = patterns.map(p => p.nodeCount);
      this.minNodeCount.set(Math.min(...nodeCounts));
      this.maxNodeCount.set(Math.max(...nodeCounts));
    }
  }

  setMinNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.minNodeCount.set(Math.max(0, Number(target.value)));
  }

  setMaxNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.maxNodeCount.set(Math.max(1, Number(target.value)));
  }

  setPatternType(value: string): void {
    this.selectedPatternType.set(value);
  }

  applyFilters(): void {
    this.updateDataSource();
  }

  clearFilters(): void {
    const patterns = this.diamondPatterns();
    if (patterns && patterns.length > 0) {
      const nodeCounts = patterns.map(p => p.nodeCount);
      this.minNodeCount.set(Math.min(...nodeCounts));
      this.maxNodeCount.set(Math.max(...nodeCounts));
    } else {
      this.minNodeCount.set(0);
      this.maxNodeCount.set(100);
    }
    this.selectedPatternType.set('');
  }

  // ─── Formatting helpers ───────────────────────────────────────────────────

  getScenarioDisplayName(scenario: ScenarioInfo): string {
    return scenario.displayName || `${scenario.name} (${scenario.dataType.toUpperCase()})`;
  }

  getDataTypeColor(dataType: string): string {
    switch (dataType) {
      case 'float': return 'primary';
      case 'interval': return 'accent';
      case 'pbox': return 'warn';
      default: return 'primary';
    }
  }

  private getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Deterministic)';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-Box';
      default: return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    }
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds.toFixed(0)}ms`;
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  // ─── Network coverage ─────────────────────────────────────────────────────

  private calculateNetworkCoverage(): { covered: number; total: number; percentage: number } {
    const results = this.currentDiamondResults();
    if (!results) return { covered: 0, total: 0, percentage: 0 };

    const joinNodesWithDiamonds = results.join_nodes_with_diamonds || [];
    const covered = joinNodesWithDiamonds.length;
    const rootCount = this.getCurrentUniqueDiamonds(results).filter(d => d.is_root_diamond).length;
    const estimatedTotal = rootCount > 0 ? Math.max(rootCount * 8, covered) : covered;

    return {
      covered,
      total: estimatedTotal,
      percentage: estimatedTotal > 0 ? (covered / estimatedTotal) * 100 : 0
    };
  }

  // ─── Diamond details modal ────────────────────────────────────────────────

  openDiamondDetailsModal(pattern: DiamondPattern): void {
    const tab = this.activeTab();
    const request = tab ? this.buildDiamondRequest(tab.scenario) : null;

    // Gather file paths from file manager
    const groups = this.fileManagerService.analysisGroups();

    // Get link probabilities path from the matching reachability group
    const reachabilityGroups = groups.reachability;
    const matchingGroup = tab ? reachabilityGroups.find(
      g => g.scenarioName === tab.scenario.name && g.dataType === tab.scenario.dataType
    ) : null;

    // Helper: strip network name prefix from a file path to make it relative
    const networkName = request?.networkPath?.split('/').pop() || '';
    const makeRelative = (rawPath: string | undefined): string | undefined => {
      if (!rawPath || !networkName) return rawPath;
      let rel = rawPath;
      if (rel.startsWith(networkName + '/')) {
        rel = rel.substring(networkName.length + 1);
      }
      return rel;
    };

    const linkprobsPath = makeRelative(matchingGroup?.linkProbabilitiesFile?.path);

    // Build all available reachability groups with relativized paths
    const reachGroups = reachabilityGroups
      .filter((g: any) => g.nodePriorsFile?.path && g.linkProbabilitiesFile?.path)
      .map((g: any) => ({
        scenarioName: g.scenarioName || `${g.dataType}`,
        dataType: g.dataType,
        nodepriorsPath: makeRelative(g.nodePriorsFile?.path),
        linkprobsPath: makeRelative(g.linkProbabilitiesFile?.path),
        networkPath: g.networkPath
      }));

    // Build all available capacity groups with relativized paths
    const capacityGroups = (groups.capacity || []).map((g: any) => ({
      scenarioName: g.scenarioName || 'Default',
      capacitiesPath: makeRelative(g.capacitiesFile?.path),
      networkPath: g.networkPath
    })).filter((g: any) => g.capacitiesPath);

    // Build all available CPM groups with relativized paths
    const cpmGroups = (groups.cpm || []).map((g: any) => ({
      scenarioName: g.scenarioName || 'Default',
      cpmPath: makeRelative(g.cpmInputsFile?.path),
      networkPath: g.networkPath,
      hasTimeAnalysis: g.hasTimeAnalysis ?? true,
      hasCostAnalysis: g.hasCostAnalysis ?? true
    })).filter((g: any) => g.cpmPath);

    // Determine which reachability group is the current/active one
    const activeReachIndex = reachGroups.findIndex(
      g => g.scenarioName === tab?.scenario.name && g.dataType === tab?.scenario.dataType
    );

    this.dialog.open(DiamondDetailsComponent, {
      width: '80%',
      height: '80%',
      maxWidth: '80%',
      maxHeight: '80%',
      data: {
        diamondId: pattern.id,
        conditioningNodes: pattern.conditioningNodes,
        joinNode: pattern.joinNode,
        diamondHash: pattern.diamondHash,
        diamondAnalysisResult: tab?.diamondResult || null,
        networkPath: request?.networkPath,
        // All available scenario groups for dropdown selection
        reachabilityGroups: reachGroups,
        activeReachabilityIndex: Math.max(0, activeReachIndex),
        capacityGroups,
        cpmGroups,
        activeDataType: tab?.scenario.dataType || 'float'
      },
      panelClass: 'diamond-details-dialog'
    });
  }

  // ─── Node analysis methods ────────────────────────────────────────────────

  openNodeAnalysis(nodeId: number): void {
    const networkStructure = this.analysisStateService.networkData();
    if (!networkStructure) return;

    const nodeDetails = this.buildNodeDetails(nodeId, networkStructure);
    if (!nodeDetails) return;

    import('../network-structure/node-details-dialog.component').then(({ NodeDetailsDialogComponent }) => {
      this.dialog.open(NodeDetailsDialogComponent, {
        data: { nodeId, nodeDetails, networkData: networkStructure },
        width: '700px',
        maxWidth: '95vw'
      });
    });
  }

  openConditioningNodeAnalysis(conditioningNodes: number[]): void {
    if (conditioningNodes.length === 0) return;
    if (conditioningNodes.length === 1) {
      this.openNodeAnalysis(conditioningNodes[0]);
    } else {
      this.showNodeSelectorDialog(conditioningNodes);
    }
  }

  private showNodeSelectorDialog(nodes: number[]): void {
    const networkStructure = this.analysisStateService.networkData();
    import('./node-selector-dialog.component').then(({ NodeSelectorDialogComponent }) => {
      const dialogRef = this.dialog.open(NodeSelectorDialogComponent, {
        data: {
          title: 'Select Conditioning Node',
          subtitle: 'Choose which conditioning node to analyze in detail',
          nodes,
          networkStructure
        },
        width: '500px',
        maxWidth: '95vw'
      });
      dialogRef.afterClosed().subscribe(result => {
        if (result?.selectedNode) this.openNodeAnalysis(result.selectedNode);
      });
    });
  }

  private buildNodeDetails(nodeId: number, networkStructure: any) {
    if (!networkStructure.nodes?.includes(nodeId)) return null;

    const parents = networkStructure.incoming_index?.[nodeId.toString()] || [];
    const children = networkStructure.outgoing_index?.[nodeId.toString()] || [];
    const ancestors = networkStructure.ancestors?.[nodeId.toString()] || [];
    const descendants = networkStructure.descendants?.[nodeId.toString()] || [];

    const types: string[] = [];
    if (networkStructure.source_nodes?.includes(nodeId)) types.push('Source');
    if (networkStructure.sink_nodes?.includes(nodeId)) types.push('Sink');
    if (networkStructure.fork_nodes?.includes(nodeId)) types.push('Fork');
    if (networkStructure.join_nodes?.includes(nodeId)) types.push('Join');
    if (types.length === 0) types.push('Regular');

    let iterationSet = -1;
    if (networkStructure.iteration_sets) {
      for (let i = 0; i < networkStructure.iteration_sets.length; i++) {
        if (networkStructure.iteration_sets[i].includes(nodeId)) { iterationSet = i; break; }
      }
    }

    const isChokepoint = networkStructure.join_nodes?.includes(nodeId) && parents.length > 2;

    return {
      nodeId, types, inDegree: parents.length, outDegree: children.length,
      parents, children, ancestors, descendants, iterationSet, isChokepoint,
      connectivity: {
        totalConnections: parents.length + children.length,
        connectivityRatio: (parents.length + children.length) / networkStructure.total_nodes
      }
    };
  }

  openJoinNodeDiamondAnalysis(joinNodeData: any): void {
    import('./join-node-diamond-analysis-dialog.component').then(({ JoinNodeDiamondAnalysisDialogComponent }) => {
      this.dialog.open(JoinNodeDiamondAnalysisDialogComponent, {
        data: joinNodeData,
        width: '700px',
        maxWidth: '95vw'
      });
    });
  }

  // ─── Risk assessment ──────────────────────────────────────────────────────

  getRiskLevel(pattern: DiamondPattern): string {
    if (pattern.riskLevel) return pattern.riskLevel;
    const riskScore = this.calculateRiskScore(pattern);
    if (riskScore >= 7) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }

  getRiskIcon(pattern: DiamondPattern): string {
    const riskLevel = pattern.riskLevel || this.getRiskLevel(pattern);
    switch (riskLevel) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
      default: return 'help';
    }
  }

  calculateRiskScore(pattern: DiamondPattern): number {
    let score = 0;
    if (pattern.conditioningNodes.length === 1) score += 5;
    else if (pattern.conditioningNodes.length === 0) score += 3;
    score += Math.min(pattern.nodeCount / 10, 3);
    score += Math.min(pattern.complexity / 20, 4);
    if (pattern.isRoot) score += 2;
    if (pattern.joinNodes.length > 0) {
      score += (pattern.joinNodes.length / pattern.nodeCount) * 2;
    }
    return Math.min(score, 10);
  }

  getMaxComplexity(): number {
    const patterns = this.diamondPatterns();
    if (!patterns || patterns.length === 0) return 100;
    return Math.max(...patterns.map(p => p.complexity));
  }

  getComplexityLevel(pattern: DiamondPattern): string {
    const ratio = pattern.complexity / this.getMaxComplexity();
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }

  getPatternIcon(patternType: string): string {
    switch (patternType.toLowerCase()) {
      case 'convergent': return 'merge_type';
      case 'divergent': return 'call_split';
      case 'cascade': return 'waterfall_chart';
      case 'complex': return 'device_hub';
      case 'simple': return 'radio_button_unchecked';
      case 'nested': return 'account_tree';
      default: return 'diamond';
    }
  }

  // ─── High risk pattern analysis ───────────────────────────────────────────

  getHighRiskPatterns(): Array<{
    id: string; level: 'low' | 'medium' | 'high'; icon: string;
    title: string; description: string; interpretation: string;
  }> {
    const summary = this.diamondSummary();
    const results = this.currentDiamondResults();
    if (!summary || !results) return [];

    const riskPatterns: Array<{
      id: string; level: 'low' | 'medium' | 'high'; icon: string;
      title: string; description: string; interpretation: string;
    }> = [];

    const singleConditioningNodes = this.analyzeSingleConditioningNodes();
    if (singleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'single-conditioning', level: 'high', icon: 'error',
        title: 'Single Points of Failure',
        description: `${singleConditioningNodes.count} diamonds with single conditioning nodes`,
        interpretation: 'Complete failure if conditioning node fails - no redundancy available'
      });
    }

    const deepNesting = this.analyzeDeepNesting();
    if (deepNesting.maxDepth >= 3) {
      riskPatterns.push({
        id: 'deep-nesting', level: deepNesting.maxDepth >= 4 ? 'high' : 'medium', icon: 'waterfall_chart',
        title: 'Cascading Failure Chains',
        description: `Maximum nesting depth: ${deepNesting.maxDepth} levels`,
        interpretation: 'Deep nesting creates cascading failure chains'
      });
    }

    const joinOverlap = this.analyzeJoinNodeOverlap();
    if (joinOverlap.overlapRatio > 0.6) {
      riskPatterns.push({
        id: 'join-overlap', level: 'medium', icon: 'device_hub',
        title: 'System-wide Bottlenecks',
        description: `${Math.round(joinOverlap.overlapRatio * 100)}% of diamonds share join nodes`,
        interpretation: 'High join node overlap creates system-wide bottlenecks'
      });
    }

    const multipleConditioningNodes = this.analyzeMultipleConditioningNodes();
    if (multipleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'multiple-conditioning', level: 'low', icon: 'check_circle',
        title: 'Resilient Structures',
        description: `${multipleConditioningNodes.count} diamonds with multiple conditioning nodes`,
        interpretation: 'Multiple conditioning nodes provide redundancy and graceful degradation'
      });
    }

    return riskPatterns;
  }

  private analyzeSingleConditioningNodes(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, diamonds: [] };
    let count = 0; const diamonds: string[] = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (diamond.is_root_diamond && diamond.diamond?.conditioning_nodes?.length === 1) { count++; diamonds.push(key); }
    });
    return { count, diamonds };
  }

  private analyzeDeepNesting(): { maxDepth: number; deepDiamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { maxDepth: 0, deepDiamonds: [] };
    let maxDepth = 0; const deepDiamonds: string[] = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      const depth = diamond.sub_iteration_sets_count || 0;
      if (depth > maxDepth) maxDepth = depth;
      if (depth >= 3) deepDiamonds.push(key);
    });
    return { maxDepth, deepDiamonds };
  }

  private analyzeJoinNodeOverlap(): { overlapRatio: number; sharedNodes: number[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { overlapRatio: 0, sharedNodes: [] };
    const joinNodeCounts = new Map<number, number>();
    const rootDiamonds = Object.values(results.raw_unique_diamonds).filter(d => d.is_root_diamond);
    const totalDiamonds = rootDiamonds.length;
    rootDiamonds.forEach(diamond => {
      if (diamond.join_node !== undefined) {
        joinNodeCounts.set(diamond.join_node, (joinNodeCounts.get(diamond.join_node) || 0) + 1);
      }
    });
    const sharedNodes = Array.from(joinNodeCounts.entries())
      .filter(([_, count]) => count > 1).map(([node]) => node);
    return { overlapRatio: totalDiamonds > 0 ? sharedNodes.length / totalDiamonds : 0, sharedNodes };
  }

  private analyzeMultipleConditioningNodes(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, diamonds: [] };
    let count = 0; const diamonds: string[] = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (diamond.is_root_diamond && diamond.diamond?.conditioning_nodes?.length > 1) { count++; diamonds.push(key); }
    });
    return { count, diamonds };
  }

  // ─── Optimization insights ────────────────────────────────────────────────

  getOptimizationInsights(): Array<{
    id: string; type: 'symmetry' | 'asymmetry' | 'isolation' | 'merge' | 'redundancy';
    priority: 'high' | 'medium' | 'low'; title: string; description: string;
    interpretation: string; count: number; recommendations: string[];
  }> {
    const results = this.currentDiamondResults();
    if (!results) return [];

    const insights: Array<{
      id: string; type: 'symmetry' | 'asymmetry' | 'isolation' | 'merge' | 'redundancy';
      priority: 'high' | 'medium' | 'low'; title: string; description: string;
      interpretation: string; count: number; recommendations: string[];
    }> = [];

    const symmetricDiamonds = this.analyzeSymmetricDiamonds();
    if (symmetricDiamonds.count > 0) {
      insights.push({
        id: 'symmetric-diamonds', type: 'symmetry', priority: 'low',
        title: 'Well-Balanced Structures',
        description: `${symmetricDiamonds.count} symmetric diamonds detected`,
        interpretation: 'Symmetric diamonds provide good redundancy and balanced load distribution',
        count: symmetricDiamonds.count,
        recommendations: ['Maintain current structure', 'Monitor performance', 'Use as template for optimization']
      });
    }

    const mergeCandidates = this.analyzeMergeCandidates();
    if (mergeCandidates.count > 0) {
      insights.push({
        id: 'merge-candidates', type: 'merge', priority: 'medium',
        title: 'Diamond Consolidation Opportunities',
        description: `${mergeCandidates.count} diamond pairs with identical conditioning patterns`,
        interpretation: 'Diamonds with same conditioning nodes can be consolidated to reduce complexity',
        count: mergeCandidates.count,
        recommendations: ['Merge similar diamonds', 'Consolidate conditioning logic', 'Reduce structural complexity']
      });
    }

    const redundancyOpportunities = this.analyzeRedundancyOpportunities();
    if (redundancyOpportunities.count > 0) {
      insights.push({
        id: 'redundancy-opportunities', type: 'redundancy', priority: 'high',
        title: 'Critical Path Redundancy Needed',
        description: `${redundancyOpportunities.count} critical paths need backup mechanisms`,
        interpretation: 'Adding redundancy to critical paths will improve system resilience',
        count: redundancyOpportunities.count,
        recommendations: ['Add backup paths', 'Implement failover mechanisms', 'Create redundant conditioning nodes']
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }

  private analyzeSymmetricDiamonds(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, diamonds: [] };
    let count = 0; const diamonds: string[] = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (!diamond.is_root_diamond) return;
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const relevantNodes = diamond.diamond?.relevant_nodes || [];
      if (conditioningNodes.length >= 2 && relevantNodes.length > conditioningNodes.length * 2) {
        count++; diamonds.push(key);
      }
    });
    return { count, diamonds };
  }

  private analyzeMergeCandidates(): { count: number; pairs: Array<[string, string]> } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, pairs: [] };
    const conditioningNodeGroups = new Map<string, string[]>();
    const pairs: Array<[string, string]> = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (!diamond.is_root_diamond) return;
      const nodeKey = (diamond.diamond?.conditioning_nodes || []).sort().join(',');
      if (!conditioningNodeGroups.has(nodeKey)) conditioningNodeGroups.set(nodeKey, []);
      conditioningNodeGroups.get(nodeKey)!.push(key);
    });
    conditioningNodeGroups.forEach(diamonds => {
      if (diamonds.length >= 2) {
        for (let i = 0; i < diamonds.length - 1; i++) pairs.push([diamonds[i], diamonds[i + 1]]);
      }
    });
    return { count: pairs.length, pairs };
  }

  private analyzeRedundancyOpportunities(): { count: number; criticalPaths: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, criticalPaths: [] };
    let count = 0; const criticalPaths: string[] = [];
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (!diamond.is_root_diamond) return;
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      if (conditioningNodes.length === 1) {
        count++; criticalPaths.push(key);
      }
    });
    return { count, criticalPaths };
  }

  getOptimizationIcon(type: string): string {
    switch (type) {
      case 'symmetry': return 'balance';
      case 'asymmetry': return 'tune';
      case 'isolation': return 'widgets';
      case 'merge': return 'merge';
      case 'redundancy': return 'backup';
      default: return 'auto_fix_high';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      case 'low': return 'primary';
      default: return 'primary';
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  exportDiamondData(): void {
    const patterns = this.diamondPatterns();
    const summary = this.diamondSummary();
    const tab = this.activeTab();

    const exportData = {
      scenario: tab?.scenario.name || 'unknown',
      summary,
      patterns: patterns.map(p => ({
        displayId: p.displayId,
        nodeCount: p.nodeCount,
        isRoot: p.isRoot,
        conditioningNodes: p.conditioningNodes,
        joinNodes: p.joinNodes,
        complexity: p.complexity,
        riskLevel: p.riskLevel || this.getRiskLevel(p)
      })),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diamond-analysis-${tab?.scenario.name || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportAllJSON(): void {
    const allData: any = {};
    for (const [name, tab] of this.scenarioTabs().entries()) {
      if (tab.status === 'computed') {
        allData[name] = { dataType: tab.scenario.dataType, diamondResult: tab.diamondResult };
      }
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diamond-analysis-all-scenarios.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Quick stat methods used by template ──────────────────────────────────

  hasInnerDiamonds(): boolean {
    const analysis = this.currentDiamondAnalysis();
    if (!analysis?.raw_unique_diamonds) return false;
    return Object.values(analysis.raw_unique_diamonds).some(diamond =>
      diamond.sub_diamond_structures && Object.keys(diamond.sub_diamond_structures).length > 0
    );
  }

  getRootDiamondsCount(): number {
    return this.getCurrentUniqueDiamonds().filter(d => d.is_root_diamond).length;
  }

  getUniqueDiamondsCount(): number {
    return Object.keys(this.currentDiamondResults()?.raw_unique_diamonds || {}).length;
  }

  getSingleConditioningCount(): number {
    return this.getCurrentUniqueDiamonds()
      .filter(d => d.is_root_diamond && d.diamond?.conditioning_nodes?.length === 1).length;
  }

  getHierarchicalComplexity(): string {
    const uniqueDiamonds = this.currentDiamondResults()?.raw_unique_diamonds || {};
    const rootCount = Object.values(uniqueDiamonds).filter(d => d.is_root_diamond).length;
    const totalCount = Object.keys(uniqueDiamonds).length;
    return rootCount > 0 ? `${totalCount}:${rootCount}` : '0:0';
  }

  getCriticalSharedDependencies(): number {
    const conditioningNodeFreq = new Map<number, number>();
    this.getCurrentUniqueDiamonds().forEach(diamond => {
      if (!diamond.is_root_diamond) return;
      diamond.diamond?.conditioning_nodes?.forEach((node: number) => {
        conditioningNodeFreq.set(node, (conditioningNodeFreq.get(node) || 0) + 1);
      });
    });
    return Array.from(conditioningNodeFreq.values()).filter(count => count > 1).length;
  }

  getBottleneckJoinNodes(): number {
    const joinNodeFreq = new Map<number, number>();
    this.getCurrentUniqueDiamonds().forEach(diamond => {
      if (!diamond.is_root_diamond) return;
      if (diamond.join_node !== undefined) {
        joinNodeFreq.set(diamond.join_node, (joinNodeFreq.get(diamond.join_node) || 0) + 1);
      }
    });
    return Array.from(joinNodeFreq.values()).filter(count => count > 1).length;
  }

  getSharedConditioningNodes(): Array<{nodeId: number, affectedDiamonds: string[]}> | null {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return null;
    const nodeToDiamonds = new Map<number, string[]>();
    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      if (!diamond.is_root_diamond) return;
      diamond.diamond?.conditioning_nodes?.forEach((node: number) => {
        if (!nodeToDiamonds.has(node)) nodeToDiamonds.set(node, []);
        nodeToDiamonds.get(node)!.push(key);
      });
    });
    const sharedNodes = Array.from(nodeToDiamonds.entries())
      .filter(([_, diamonds]) => diamonds.length > 1)
      .map(([nodeId, affectedDiamonds]) => ({ nodeId, affectedDiamonds }));
    return sharedNodes.length > 0 ? sharedNodes : null;
  }

  getIndependentConvergences(): number {
    const sharedNodes = this.getSharedConditioningNodes();
    const totalConvergences = this.getCurrentUniqueDiamonds().filter(d => d.is_root_diamond).length;
    if (!sharedNodes) return totalConvergences;
    const dependentConvergences = sharedNodes.reduce((sum, node) => sum + node.affectedDiamonds.length, 0);
    return Math.max(0, totalConvergences - dependentConvergences);
  }

  private getCurrentUniqueDiamonds(result?: DiamondAnalysisResult | null): UniqueDiamondStructure[] {
    const diamondResult = result ?? this.currentDiamondResults();
    if (!diamondResult?.raw_unique_diamonds) return [];
    return Object.values(diamondResult.raw_unique_diamonds);
  }

  getDependentConvergences(): number {
    const sharedNodes = this.getSharedConditioningNodes();
    if (!sharedNodes) return 0;
    return sharedNodes.reduce((sum, node) => sum + node.affectedDiamonds.length, 0);
  }

  getSinglePointFailures(): number {
    const patterns = this.diamondPatterns();
    if (!patterns) return 0;
    return patterns.filter(pattern => pattern.conditioningNodes.length === 1).length;
  }

  getSystemRiskClass(): string {
    const singlePoints = this.getSinglePointFailures();
    const totalDiamonds = this.diamondPatterns()?.length || 0;
    if (totalDiamonds === 0) return 'risk-low';
    const riskRatio = singlePoints / totalDiamonds;
    if (riskRatio > 0.7) return 'risk-high';
    if (riskRatio > 0.3) return 'risk-medium';
    return 'risk-low';
  }

  getSystemHealth(): 'good' | 'fair' | 'poor' {
    const patterns = this.diamondPatterns();
    if (!patterns || patterns.length === 0) return 'good';
    const singlePoints = this.getSinglePointFailures();
    const singlePointRatio = singlePoints / patterns.length;
    const summary = this.diamondSummary();
    const avgComplexity = summary?.averageComplexity || 0;
    if (singlePointRatio > 0.6 || avgComplexity > 20) return 'poor';
    if (singlePointRatio > 0.3 || avgComplexity > 10) return 'fair';
    return 'good';
  }

  getSystemHealthIcon(): string {
    switch (this.getSystemHealth()) {
      case 'good': return 'check_circle';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'help';
    }
  }

  getSystemRole(pattern: DiamondPattern): string {
    if (pattern.conditioningNodes.length === 1) return 'Critical Path';
    if (pattern.nodeCount >= 10) return 'Complex Hub';
    if (pattern.subDiamonds && pattern.subDiamonds.length > 0) return 'Hierarchical';
    return 'Standard';
  }

  getSystemRoleClass(pattern: DiamondPattern): string {
    switch (this.getSystemRole(pattern)) {
      case 'Critical Path': return 'role-critical';
      case 'Complex Hub': return 'role-complex';
      case 'Hierarchical': return 'role-hierarchical';
      default: return 'role-standard';
    }
  }

  hasCommonCauseVulnerabilities(): boolean {
    return this.getSingleConditioningCount() > 0;
  }

  hasSharedConditioningNodes(): boolean {
    return this.getCriticalSharedDependencies() > 0;
  }
}
