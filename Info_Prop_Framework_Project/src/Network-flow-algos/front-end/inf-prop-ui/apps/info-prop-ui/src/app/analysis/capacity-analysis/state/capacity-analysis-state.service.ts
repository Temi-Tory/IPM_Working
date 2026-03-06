/**
 * Capacity Analysis State Service
 * 
 * Manages all state and transformations for the capacity analysis view.
 * Converts raw backend responses into story narratives for each level.
 * Handles multi-scenario management, upgrades, and what-if simulations.
 */

import { Injectable, computed, signal, inject } from '@angular/core';
import { CapacityAnalysisService } from '../../../shared/services/capacity-analysis.service';
import { NetworkSessionService } from '../../../shared/services/network-session.service';
import { FileManagerService } from '../../../shared/services/file-manager.service';
import {
  Level0Story,
  Level1Story,
  Level2Story,
  Level3Story,
  CapacityStoryState,
  CapacityUIState,
  RawCapacityResult,
  UpgradeRecommendation,
  NodeMetric,
  EdgeMetric,
} from './capacity-story.models';
import {
  CapacityAnalysisRequest,
  ScenarioInfo,
  CapacityFileGroup,
  CapacityScenario,
} from '../../../shared/models/network-analysis.models';

interface CapacityCoreResult {
  node_max_flows: Record<string, number>;
  node_capacities: Record<string, number>;
  edge_utilization: Record<string, { capacity: number; flow: number; utilization: number; spare: number }>;
  source_rates?: Record<string, number>;
  target_flows?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class CapacityAnalysisStateService {
  private capacityService = inject(CapacityAnalysisService);
  private sessionService = inject(NetworkSessionService);
  private fileManagerService = inject(FileManagerService);

  // ─── Main State Signals ────────────────────────────────────────────────
  private scenarioStorageSignal = signal<Map<string, CapacityStoryState>>(new Map());
  private uiStateSignal = signal<CapacityUIState>({
    currentScenario: '',
    currentLevel: 0,
    searchTerm: '',
    selectedNodeTypes: [],
    sortColumn: '',
    sortDirection: '',
    pageIndex: 0,
    pageSize: 25,
  });

  private availableScenariosSignal = signal<ScenarioInfo[]>([]);
  // ─── Computed: Current Story State ──────────────────────────────────────
  readonly currentStory = computed((): CapacityStoryState | null => {
    const scenario = this.uiStateSignal().currentScenario;
    const storage = this.scenarioStorageSignal();
    return storage.get(scenario) || null;
  });

  readonly currentLevel = computed(() => this.uiStateSignal().currentLevel);
  readonly currentScenarioName = computed(() => this.uiStateSignal().currentScenario);

  readonly level0Data = computed((): Level0Story | null => this.currentStory()?.level0 || null);
  readonly level1Data = computed((): Level1Story | null => this.currentStory()?.level1 || null);
  readonly level2Data = computed((): Level2Story | null => this.currentStory()?.level2 || null);
  readonly level3Data = computed((): Level3Story | null => this.currentStory()?.level3 || null);

  readonly isLoading = computed((): boolean => this.currentStory()?.status === 'loading' || false);
  readonly error = computed((): string | null => this.currentStory()?.error || null);

  readonly availableScenarios = computed(() => this.availableScenariosSignal());
  readonly uiState = computed(() => this.uiStateSignal());

  // ─── API: Navigation ─────────────────────────────────────────────────────

  setScenario(scenarioName: string): void {
    const current = this.uiStateSignal();
    this.uiStateSignal.set({ ...current, currentScenario: scenarioName, currentLevel: 0, pageIndex: 0 });
  }

  setLevel(level: 0 | 1 | 2 | 3): void {
    const current = this.uiStateSignal();
    this.uiStateSignal.set({ ...current, currentLevel: level, pageIndex: 0 });
  }

  setComparison(scenarioName: string | null, level?: 0 | 1 | 2 | 3): void {
    const current = this.uiStateSignal();
    this.uiStateSignal.set({
      ...current,
      comparisonScenario: scenarioName || undefined,
      comparisonLevel: level ?? current.currentLevel,
    });
  }

  // ─── API: Scenario Management ────────────────────────────────────────────

  async loadScenarios(): Promise<void> {
    const groups = this.fileManagerService.analysisGroups().capacity as CapacityFileGroup[];
    const scenarios: ScenarioInfo[] = groups
      .filter((g: CapacityFileGroup) => !!g.capacitiesFile)
      .map((group, index) => ({
        name: group.scenarioName || `capacity-${index}`,
        dataType: 'float' as const,
        path: group.capacitiesFile?.path || '',
        displayName: group.scenarioName || `Capacity Scenario ${index + 1}`,
        analysisType: 'capacity' as const,
      }));

    this.availableScenariosSignal.set(scenarios);

    // Initialize storage for each scenario
    const storage = new Map<string, CapacityStoryState>();
    scenarios.forEach((s: ScenarioInfo) => {
      storage.set(s.name, {
        scenarioName: s.name,
        status: 'idle',
        level0: null,
        level1: null,
        level2: null,
        level3: null,
      });
    });
    this.scenarioStorageSignal.set(storage);

    if (scenarios.length > 0) {
      this.setScenario(scenarios[0].name);
    }
  }

  async computeScenario(scenarioName: string): Promise<void> {
    const scenarios = this.availableScenariosSignal();
    const scenario = scenarios.find(s => s.name === scenarioName);
    if (!scenario) return;

    this.updateScenarioStatus(scenarioName, 'loading');

    try {
      const sessionNetwork = this.sessionService.getCurrentSession()?.networkPath;
      const baseNetworkPath = (sessionNetwork || '').replace(/\\/g, '/');
      if (!baseNetworkPath) throw new Error('No network path available');

      const networkName = baseNetworkPath.split('/').pop() || '';
      const edgesFilePath = `${networkName}.EDGES`;
      let capacitiesPath = scenario.path;
      if (networkName && capacitiesPath.startsWith(networkName + '/')) {
        capacitiesPath = capacitiesPath.substring(networkName.length + 1);
      }

      const request: CapacityAnalysisRequest = { networkPath: baseNetworkPath, edgesFilePath, capacitiesPath };
      const response = await this.capacityService.analyzeCapacity(request).toPromise();

      if (!response?.success || !response.capacity_result) {
        throw new Error(response?.message || 'Analysis failed');
      }

      const raw = response.capacity_result;
      const stories = this.transformToStories(raw);

      this.updateScenarioData(scenarioName, { ...stories, status: 'computed' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.updateScenarioStatus(scenarioName, 'error', errMsg);
    }
  }

  // ─── Transformation: Raw Response → Story ────────────────────────────────

  private transformToStories(raw: CapacityScenario): Omit<CapacityStoryState, 'status' | 'scenarioName'> {
    return {
      level0: this.buildLevel0(raw),
      level1: this.buildLevel1(raw),
      level2: this.buildLevel2(raw),
      level3: this.buildLevel3(raw),
    };
  }

  // ─── Level 0: Health Summary (Is it healthy?) ────────────────────────────

  private buildLevel0(raw: CapacityScenario): Level0Story {
    const rcr = raw.raw_capacity_result as CapacityCoreResult | undefined;
    if (!rcr) return this.defaultLevel0();

    const nodeMetrics = this.extractNodeMetrics(rcr);
    const edgeMetrics = this.extractEdgeMetrics(rcr);
    
    const maxNodeUtil = Math.max(...nodeMetrics.map(n => n.utilization), 0);
    const maxEdgeUtil = Math.max(...edgeMetrics.map(e => e.utilization), 0);
    const maxUtilization = Math.max(maxNodeUtil, maxEdgeUtil);

    const bottleneckCount = [...nodeMetrics, ...edgeMetrics].filter(m => m.isBottleneck).length;
    const avgUtilization = (nodeMetrics.reduce((s, n) => s + n.utilization, 0) + edgeMetrics.reduce((s, e) => s + e.utilization, 0)) / (nodeMetrics.length + edgeMetrics.length || 1);

    const severity = maxUtilization > 0.95 ? 'critical' : maxUtilization > 0.85 ? 'warning' : 'good';
    const isHealthy = severity === 'good' && bottleneckCount === 0;

    const networkSize = nodeMetrics.length <= 100 ? 'small' : nodeMetrics.length <= 1000 ? 'medium' : 'large';

    // Build observations for small networks
    const observations = networkSize === 'small' ? this.buildObservations(raw as RawCapacityResult, maxUtilization, bottleneckCount, severity) : undefined;

    return {
      isHealthy,
      severity,
      networkSize,
      maxUtilization,
      bottleneckCount,
      observations,
      sourceInputTotal: raw.total_source_input,
      sinkOutputTotal: raw.total_target_output,
      avgUtilization,
    };
  }

  private buildObservations(
    _raw: RawCapacityResult,
    maxUtil: number,
    bnCount: number,
    severity: Level0Story['severity']
  ): NonNullable<Level0Story['observations']> {
    const obs: NonNullable<Level0Story['observations']> = [];
    const statusSeverity: 'good' | 'warning' | 'info' = severity === 'good' ? 'good' : 'warning';
    obs.push({
      icon: severity === 'good' ? 'check_circle' : severity === 'warning' ? 'warning' : 'error',
      text: `Network status: ${severity === 'good' ? 'Healthy' : severity === 'warning' ? 'Stressed' : 'Critical'}`,
      severity: statusSeverity,
    });
    obs.push({
      icon: 'speed',
      text: `Max utilization: ${(maxUtil * 100).toFixed(1)}%`,
      severity: maxUtil > 0.9 ? 'warning' : 'info',
    });
    if (bnCount > 0) {
      obs.push({ icon: 'block', text: `${bnCount} bottleneck(s) detected`, severity: 'warning' });
    }
    return obs;
  }

  private defaultLevel0(): Level0Story {
    return {
      isHealthy: true,
      severity: 'good',
      networkSize: 'medium',
      maxUtilization: 0,
      bottleneckCount: 0,
      sourceInputTotal: 0,
      sinkOutputTotal: 0,
      avgUtilization: 0,
    };
  }

  // ─── Level 1: Bottleneck Explorer (Where's the problem?) ──────────────────

  private buildLevel1(raw: CapacityScenario): Level1Story {
    const rcr = raw.raw_capacity_result as CapacityCoreResult | undefined;
    if (!rcr) return this.defaultLevel1();

    const nodeMetrics = this.extractNodeMetrics(rcr);
    const edgeMetrics = this.extractEdgeMetrics(rcr);

    const nodeTypeStats = this.computeNodeTypeStats(nodeMetrics);
    const bottleneckNodes = nodeMetrics.filter(n => n.isBottleneck).sort((a, b) => b.utilization - a.utilization);
    const bottleneckEdges = edgeMetrics.filter(e => e.isBottleneck).sort((a, b) => b.utilization - a.utilization);

    const sourceFlowPaths = this.computeSourceFlowPaths(rcr, raw.active_sources || []);
    const sinkSummary = this.computeSinkSummary(rcr, raw.target_nodes || []);

    return { nodeTypeStats, bottleneckNodes, bottleneckEdges, sourceFlowPaths, sinkSummary };
  }

  private defaultLevel1(): Level1Story {
    return {
      nodeTypeStats: [],
      bottleneckNodes: [],
      bottleneckEdges: [],
      sourceFlowPaths: [],
      sinkSummary: [],
    };
  }

  // ─── Level 2: Upgrade Planner (How to fix?) ───────────────────────────────

  private buildLevel2(raw: CapacityScenario): Level2Story {
    const rcr = raw.raw_capacity_result as CapacityCoreResult | undefined;
    if (!rcr) return this.defaultLevel2();

    const nodeMetrics = this.extractNodeMetrics(rcr);
    const edgeMetrics = this.extractEdgeMetrics(rcr);

    const maxNodeUtil = Math.max(...nodeMetrics.map(n => n.utilization), 0);
    const maxEdgeUtil = Math.max(...edgeMetrics.map(e => e.utilization), 0);
    const maxUtilization = Math.max(maxNodeUtil, maxEdgeUtil);
    const bottleneckCount = [...nodeMetrics, ...edgeMetrics].filter(m => m.isBottleneck).length;

    const recommendations = this.computeUpgradeRecommendations([...nodeMetrics, ...edgeMetrics]);

    return {
      recommendations,
      currentState: {
        networkUtilization: raw.network_utilization,
        maxUtilization,
        bottleneckCount,
      },
    };
  }

  private defaultLevel2(): Level2Story {
    return { recommendations: [], currentState: { networkUtilization: 0, maxUtilization: 0, bottleneckCount: 0 } };
  }

  // ─── Level 3: Engineer Deep-Dive (Full details) ────────────────────────────

  private buildLevel3(raw: CapacityScenario): Level3Story {
    const rcr = raw.raw_capacity_result as CapacityCoreResult | undefined;
    if (!rcr) return this.defaultLevel3();

    const allNodes = this.extractNodeMetrics(rcr);
    const allEdges = this.extractEdgeMetrics(rcr);
    const flowDecomposition = this.computeFlowDecomposition(rcr);

    return { allNodes, allEdges, flowDecomposition, rawData: raw as unknown as RawCapacityResult };
  }

  private defaultLevel3(): Level3Story {
    return { allNodes: [], allEdges: [], flowDecomposition: { sources: [] }, rawData: {} as RawCapacityResult };
  }

  // ─── Helpers: Extract Metrics ──────────────────────────────────────────────

  private extractNodeMetrics(rcr: CapacityCoreResult): NodeMetric[] {
    if (!rcr.node_max_flows) return [];

    return Object.entries(rcr.node_max_flows).map(([nodeIdStr, flow]: [string, number]) => {
      const nodeId = parseInt(nodeIdStr);
      const capacity = rcr.node_capacities?.[nodeIdStr] ?? 0;
      const utilization = capacity > 0 ? flow / capacity : 0;
      const spare = Math.max(0, capacity - flow);

      return {
        nodeId,
        capacity,
        flow,
        utilization,
        spare,
        nodeType: this.getNodeType(nodeId),
        isBottleneck: utilization > 0.95,
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  }

  private extractEdgeMetrics(rcr: CapacityCoreResult): EdgeMetric[] {
    if (!rcr.edge_utilization) return [];

    return Object.entries(rcr.edge_utilization).map(([edgeKey, data]) => {
      const match = edgeKey.match(/\((\d+),\s*(\d+)\)/);
      const from = match ? parseInt(match[1]) : 0;
      const to = match ? parseInt(match[2]) : 0;

      return {
        edgeKey,
        from,
        to,
        capacity: data.capacity ?? 0,
        flow: data.flow ?? 0,
        utilization: data.utilization ?? 0,
        spare: data.spare ?? 0,
        isBottleneck: (data.utilization ?? 0) > 0.95,
      };
    });
  }

  private computeNodeTypeStats(metrics: NodeMetric[]): Array<{ type: string; count: number; avgUtilization: number; icon: string }> {
    const types = new Map<string, { count: number; totalUtil: number }>();

    metrics.forEach(m => {
      const entry = types.get(m.nodeType) || { count: 0, totalUtil: 0 };
      entry.count++;
      entry.totalUtil += m.utilization;
      types.set(m.nodeType, entry);
    });

    const iconMap: Record<string, string> = {
      Source: 'login',
      Sink: 'logout',
      Fork: 'call_split',
      Join: 'call_merge',
      Regular: 'radio_button_unchecked',
    };

    return Array.from(types.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgUtilization: data.totalUtil / data.count,
      icon: iconMap[type] || 'circle',
    }));
  }

  private computeSourceFlowPaths(
    rcr: CapacityCoreResult,
    sources: number[]
  ): Level1Story['sourceFlowPaths'] {
    return sources.map(sourceId => {
      const sourceRate = rcr.source_rates?.[String(sourceId)] ?? 0;
      const actualFlow = rcr.node_max_flows?.[String(sourceId)] ?? 0;
      const targetSinks = Object.entries(rcr.target_flows || {})
        .map(([sinkIdStr, flow]: [string, number]) => {
          const sinkId = parseInt(sinkIdStr);
          const totalFlow = rcr.target_flows
            ? Object.values(rcr.target_flows as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
            : 1;
          return { sinkId, flowAmount: flow, percentOfSourceOutput: (flow / Math.max(1, totalFlow)) * 100 };
        });

      return {
        sourceId,
        targetSinks,
        totalOutput: actualFlow,
        deliveryRatio: sourceRate > 0 ? actualFlow / sourceRate : 0,
      };
    });
  }

  private computeSinkSummary(
    rcr: CapacityCoreResult,
    sinks: number[]
  ): Level1Story['sinkSummary'] {
    return sinks.map(sinkId => ({
      sinkId,
      inputFlow: rcr.target_flows?.[String(sinkId)] ?? 0,
      inputCapacity: rcr.node_capacities?.[String(sinkId)] ?? 0,
      utilization: (rcr.target_flows?.[String(sinkId)] ?? 0) / Math.max(1, rcr.node_capacities?.[String(sinkId)] ?? 1),
      sourceContributions: [],
    }));
  }

  private computeUpgradeRecommendations(allMetrics: Array<NodeMetric | EdgeMetric>): UpgradeRecommendation[] {
    const target095 = 0.7; // Target utilization after upgrade

    return allMetrics
      .filter(m => m.utilization > 0.75)
      .map((m) => {
        const isNode = 'nodeId' in m;
        const target: 'node' | 'edge' = isNode ? 'node' : 'edge';
        const recommendedCapacity = m.flow / target095;
        const percentIncrease = m.capacity > 0 ? ((recommendedCapacity - m.capacity) / m.capacity) * 100 : 0;

        return {
          target,
          id: isNode ? String(m.nodeId) : m.edgeKey,
          currentCapacity: m.capacity,
          currentUtilization: m.utilization,
          recommendedCapacity,
          percentIncrease,
          impactScore: Math.min(100, (m.utilization - 0.75) * 400), // Empirical scaling
          reason: `Reduce ${isNode ? 'node' : 'edge'} bottleneck by increasing capacity`,
        };
      })
      .sort((a, b) => b.impactScore - a.impactScore);
  }

  private computeFlowDecomposition(rcr: CapacityCoreResult): Level3Story['flowDecomposition'] {
    return {
      sources: Object.entries(rcr.source_rates || {})
        .map(([nodeIdStr, rate]: [string, number]) => ({
          nodeId: parseInt(nodeIdStr),
          outputRate: rate,
          flowDecomposition: [],
        })),
    };
  }

  // ─── Helpers: Utilities ────────────────────────────────────────────────────

  private getNodeType(_nodeId: number): NodeMetric['nodeType'] {
    void _nodeId;
    return 'Regular'; // TODO: Integrate with network structure data
  }

  private updateScenarioStatus(scenarioName: string, status: CapacityStoryState['status'], error?: string): void {
    const storage = new Map(this.scenarioStorageSignal());
    const current = storage.get(scenarioName);
    if (current) {
      storage.set(scenarioName, { ...current, status, error });
      this.scenarioStorageSignal.set(storage);
    }
  }

  private updateScenarioData(scenarioName: string, updates: Partial<CapacityStoryState>): void {
    const storage = new Map(this.scenarioStorageSignal());
    const current = storage.get(scenarioName);
    if (current) {
      storage.set(scenarioName, { ...current, ...updates });
      this.scenarioStorageSignal.set(storage);
    }
  }
}
