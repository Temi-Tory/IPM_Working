import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  NetworkStructure,
  CapacityFileGroup,
  CapacityScenario,
  MultiScenarioCapacityResults,
  ScenarioInfo
} from '../../shared/models/network-analysis.models';
import {
  CapacityV2AnalysisType,
  CapacityV2DetailSource,
  CapacityV2HighlightMode,
  CapacityV2InputRow,
  CapacityV2NetworkOption,
  CapacityV2ResultEntity,
  CapacityV2RunInputs,
  CapacityV2RunState,
  CapacityV2Validation
} from './capacity-v2.models';
import { CapacityV2Service } from './capacity-v2.service';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';

interface CapacityV2ScenarioRunSnapshot {
  key: string;
  label: string;
  status: CapacityV2RunState;
  error: string | null;
  updatedAt: string | null;
  hasResult: boolean;
}

@Injectable({ providedIn: 'root' })
export class CapacityV2Store {
  private readonly service = inject(CapacityV2Service);
  private readonly analysisState = inject(AnalysisStateService);

  private readonly runStateSignal = signal<CapacityV2RunState>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private readonly networkDataSignal = signal<NetworkStructure | null>(null);
  private readonly networkOptionsSignal = signal<CapacityV2NetworkOption[]>([]);
  private readonly inputsSignal = signal<CapacityV2RunInputs>(this.createEmptyInputs());
  private readonly resultSignal = signal<CapacityV2ResultEntity | null>(null);
  private readonly selectedDetailSourceSignal = signal<CapacityV2DetailSource>('worst');
  private readonly highlightModeSignal = signal<CapacityV2HighlightMode>('bottlenecks');
  private readonly selectedNodeIdSignal = signal<string | null>(null);
  private readonly viewModeSignal = signal<'single' | 'all' | 'comparison'>('single');
  private readonly capacityGroupsSignal = signal<CapacityFileGroup[]>([]);
  private readonly scenarioRunStatesSignal = signal<Map<string, CapacityV2RunState>>(new Map());
  private readonly scenarioErrorsSignal = signal<Map<string, string | null>>(new Map());
  private readonly scenarioUpdatedAtSignal = signal<Map<string, string>>(new Map());
  private readonly scenarioResultsSignal = signal<Map<string, CapacityV2ResultEntity>>(new Map());

  readonly runState = computed(() => this.runStateSignal());
  readonly error = computed(() => this.errorSignal());
  readonly networkData = computed(() => this.networkDataSignal());
  readonly networkOptions = computed(() => this.networkOptionsSignal());
  readonly selectedNetworkOption = computed(() => {
    const options = this.networkOptionsSignal();
    const inputs = this.inputsSignal();

    return (
      options.find(
        (option) =>
          option.capacitiesPath === inputs.capacitiesPath &&
          option.edgesFilePath === inputs.edgesFilePath
      ) ?? options[0] ?? null
    );
  });
  readonly inputs = computed(() => this.inputsSignal());
  readonly result = computed(() => this.resultSignal());
  readonly selectedDetailSource = computed(() => this.selectedDetailSourceSignal());
  readonly highlightMode = computed(() => this.highlightModeSignal());
  readonly selectedNodeId = computed(() => this.selectedNodeIdSignal());
  readonly viewMode = computed(() => this.viewModeSignal());

  readonly activeDeterministicDetail = computed(() => {
    const current = this.resultSignal();
    if (!current) {
      return null;
    }

    if (current.kind === 'deterministic') {
      return current.deterministic;
    }

    return this.selectedDetailSourceSignal() === 'best'
      ? current.interval.bestCase
      : current.interval.worstCase;
  });

  readonly summary = computed(() => {
    const current = this.resultSignal();
    if (!current) {
      return null;
    }

    if (current.kind === 'deterministic') {
      return current.deterministic.summary;
    }

    return current.interval.summary;
  });

  readonly validation = computed<CapacityV2Validation | null>(() => {
    const detail = this.activeDeterministicDetail();
    return detail?.validation ?? null;
  });

  readonly hasIntervalResult = computed(() => this.resultSignal()?.kind === 'interval');
  readonly scenarioRunSnapshots = computed<CapacityV2ScenarioRunSnapshot[]>(() => {
    const options = this.networkOptionsSignal();
    const statuses = this.scenarioRunStatesSignal();
    const errors = this.scenarioErrorsSignal();
    const updatedAt = this.scenarioUpdatedAtSignal();
    const results = this.scenarioResultsSignal();

    return options.map((option) => {
      const key = option.scenarioName;
      return {
        key,
        label: option.label,
        status: statuses.get(key) ?? 'idle',
        error: errors.get(key) ?? null,
        updatedAt: updatedAt.get(key) ?? null,
        hasResult: results.has(key)
      };
    });
  });
  readonly completedCount = computed(() =>
    this.scenarioRunSnapshots().filter((snapshot) => snapshot.status === 'success').length
  );
  readonly runningCount = computed(() =>
    this.scenarioRunSnapshots().filter((snapshot) => snapshot.status === 'running').length
  );
  readonly errorCount = computed(() =>
    this.scenarioRunSnapshots().filter((snapshot) => snapshot.status === 'error').length
  );
  readonly totalScenarioCount = computed(() => this.scenarioRunSnapshots().length);
  readonly hasPendingScenarios = computed(() =>
    this.scenarioRunSnapshots().some((snapshot) => snapshot.status !== 'success')
  );
  readonly hasAnyRunResults = computed(() => this.completedCount() > 0);
  readonly scenarioResults = computed(() => this.scenarioResultsSignal());

  initializeFromSession(
    networkData: NetworkStructure | null,
    parsedData: unknown,
    capacityGroups: CapacityFileGroup[],
    preferredNetworkPath?: string
  ): void {
    this.networkDataSignal.set(networkData);
    this.capacityGroupsSignal.set(capacityGroups);

    const options = this.buildNetworkOptions(capacityGroups);
    this.networkOptionsSignal.set(options);

    const selectedOption = options[0];

    // CRITICAL FIX: Load actual capacity file content from first group instead of using parsedData
    let defaults = this.extractCapacityDefaults(parsedData);
    
    if (capacityGroups.length > 0 && capacityGroups[0].capacitiesFile?.content) {
      try {
        const actualCapacityData = JSON.parse(capacityGroups[0].capacitiesFile.content);
        defaults = this.extractCapacityDefaults(actualCapacityData);
        console.log('✅ Loaded capacity data from file:', {
          scenarioName: capacityGroups[0].scenarioName,
          analysisType: defaults.analysisType,
          nodeCount: Object.keys(defaults.nodes).length,
          edgeCount: Object.keys(defaults.edges).length,
          sourceCount: Object.keys(defaults.sourceRates).length
        });
      } catch (error) {
        console.error('❌ Failed to parse capacity file, using defaults:', error);
      }
    } else {
      console.warn('⚠️ No capacity file content available, using fallback defaults');
    }

    const fallbackNodes = networkData?.nodes?.map((nodeId) => nodeId.toString()) ?? [];
    const fallbackEdges = (networkData?.edges ?? []).map((edge) => `(${edge[0]},${edge[1]})`);

    const nodeRows = this.buildRows(defaults.nodes, fallbackNodes, 0);
    const edgeRows = this.buildRows(defaults.edges, fallbackEdges, 0);
    const sourceRows = this.buildRows(defaults.sourceRates, networkData?.source_nodes?.map((nodeId) => nodeId.toString()) ?? [], 0);

    console.log('📊 Built input rows:', {
      nodeRows: nodeRows.length,
      edgeRows: edgeRows.length,
      sourceRows: sourceRows.length,
      sampleNodeRow: nodeRows[0],
      sampleEdgeRow: edgeRows[0],
      sampleSourceRow: sourceRows[0]
    });

    const sinkTargets = networkData?.sink_nodes ?? [];

    // CRITICAL: Always use session/analysis network path - never fall back to file manager relative paths
    const initialNetworkPath = preferredNetworkPath || '';

    this.inputsSignal.set({
      networkPath: initialNetworkPath,
      edgesFilePath: selectedOption?.edgesFilePath ?? capacityGroups[0]?.edgesFile?.name ?? '',
      capacitiesPath: selectedOption?.capacitiesPath ?? capacityGroups[0]?.capacitiesFile?.name ?? '',
      analysisType: defaults.analysisType,
      targetNodes: sinkTargets,
      nodeCapacities: nodeRows,
      edgeCapacities: edgeRows,
      sourceRates: sourceRows,
      options: {
        computeAllMinCuts: true,
        enumerateCriticalPaths: true,
        computeUpgradePriorities: true,
        includeClassicalComparison: true,
        verbosity: 'standard'
      }
    });

    this.resultSignal.set(null);
    this.errorSignal.set(null);
    this.runStateSignal.set('idle');
    this.selectedDetailSourceSignal.set('worst');
    this.highlightModeSignal.set('bottlenecks');
    this.selectedNodeIdSignal.set(null);

    const statusMap = new Map<string, CapacityV2RunState>();
    const errorMap = new Map<string, string | null>();
    options.forEach((option) => {
      statusMap.set(option.scenarioName, 'idle');
      errorMap.set(option.scenarioName, null);
    });
    this.scenarioRunStatesSignal.set(statusMap);
    this.scenarioErrorsSignal.set(errorMap);
    this.scenarioUpdatedAtSignal.set(new Map());
    this.scenarioResultsSignal.set(new Map());
  }

  setAnalysisType(type: CapacityV2AnalysisType): void {
    this.inputsSignal.update((state) => ({ ...state, analysisType: type }));
  }

  setNetworkOption(option: CapacityV2NetworkOption): void {
    // Keep existing networkPath from state (session path) - only update scenario-specific fields
    this.inputsSignal.update((state) => ({
      ...state,
      analysisType: option.analysisType,
      edgesFilePath: option.edgesFilePath,
      capacitiesPath: option.capacitiesPath
    }));
  }

  async setNetworkOptionAndReload(option: CapacityV2NetworkOption): Promise<void> {
    console.log('🔄 RELOADING SCENARIO:', {
      scenarioName: option.scenarioName,
      capacitiesPath: option.capacitiesPath
    });

    try {
      // Find the matching capacity group from already-loaded data
      const capacityGroups = this.capacityGroupsSignal();
      const matchingGroup = capacityGroups.find(
        group => group.scenarioName === option.scenarioName ||
                 group.capacitiesFile?.path === option.capacitiesPath
      );

      if (!matchingGroup?.capacitiesFile?.content) {
        throw new Error(`Capacity file content not found for scenario: ${option.scenarioName}`);
      }

      // Parse the already-loaded content
      const parsedData = JSON.parse(matchingGroup.capacitiesFile.content);

      // Extract capacity defaults from the new file
      const defaults = this.extractCapacityDefaults(parsedData);
      
      const networkData = this.networkDataSignal();
      const fallbackNodes = networkData?.nodes?.map((nodeId) => nodeId.toString()) ?? [];
      const fallbackEdges = (networkData?.edges ?? []).map((edge) => `(${edge[0]},${edge[1]})`);
      const fallbackSources = networkData?.source_nodes?.map((nodeId) => nodeId.toString()) ?? [];

      // Rebuild capacity rows with new values
      const nodeRows = this.buildRows(defaults.nodes, fallbackNodes, 0);
      const edgeRows = this.buildRows(defaults.edges, fallbackEdges, 0);
      const sourceRows = this.buildRows(defaults.sourceRates, fallbackSources, 0);

      // Update inputs with new scenario data
      this.inputsSignal.update((state) => ({
        ...state,
        analysisType: defaults.analysisType,
        edgesFilePath: option.edgesFilePath,
        capacitiesPath: option.capacitiesPath,
        nodeCapacities: nodeRows,
        edgeCapacities: edgeRows,
        sourceRates: sourceRows
      }));

      console.log('✅ Scenario reloaded:', {
        analysisType: defaults.analysisType,
        nodeCount: nodeRows.length,
        edgeCount: edgeRows.length,
        sourceCount: sourceRows.length
      });

      this.applyCachedScenarioView(option.scenarioName);

    } catch (error) {
      console.error('❌ Failed to reload scenario:', error);
      // Fall back to just updating paths without reloading values
      this.setNetworkOption(option);
      this.applyCachedScenarioView(option.scenarioName);
    }
  }

  setTargetNodes(targetNodes: number[]): void {
    this.inputsSignal.update((state) => ({ ...state, targetNodes }));
  }

  setOptions(options: Partial<CapacityV2RunInputs['options']>): void {
    this.inputsSignal.update((state) => ({
      ...state,
      options: {
        ...state.options,
        ...options
      }
    }));
  }

  updateNodeCapacity(rowIndex: number, updated: CapacityV2InputRow): void {
    this.updateRows('nodeCapacities', rowIndex, updated);
  }

  updateEdgeCapacity(rowIndex: number, updated: CapacityV2InputRow): void {
    this.updateRows('edgeCapacities', rowIndex, updated);
  }

  updateSourceRate(rowIndex: number, updated: CapacityV2InputRow): void {
    this.updateRows('sourceRates', rowIndex, updated);
  }

  setDetailSource(source: CapacityV2DetailSource): void {
    this.selectedDetailSourceSignal.set(source);
  }

  setHighlightMode(mode: CapacityV2HighlightMode): void {
    this.highlightModeSignal.set(mode);
  }

  setSelectedNode(nodeId: string | null): void {
    this.selectedNodeIdSignal.set(nodeId);
  }

  setViewMode(mode: 'single' | 'all' | 'comparison'): void {
    this.viewModeSignal.set(mode);
  }

  async runAnalysis(): Promise<void> {
    const inputs = this.inputsSignal();
    const scenarioKey = this.selectedNetworkOption()?.scenarioName || this.getScenarioKeyFromInputs(inputs);

    if (!inputs.networkPath || !inputs.capacitiesPath) {
      this.runStateSignal.set('error');
      this.errorSignal.set('Network path and capacities file are required.');
      this.updateScenarioStatus(scenarioKey, 'error', 'Network path and capacities file are required.');
      return;
    }

    this.runStateSignal.set('running');
    this.errorSignal.set(null);
    this.updateScenarioStatus(scenarioKey, 'running', null);

    try {
      const normalized = await firstValueFrom(this.service.analyze(inputs));
      this.resultSignal.set(normalized);
      this.runStateSignal.set('success');
      this.selectedDetailSourceSignal.set('worst');
      this.scenarioResultsSignal.update((state) => {
        const next = new Map(state);
        next.set(scenarioKey, normalized);
        return next;
      });
      this.updateScenarioStatus(scenarioKey, 'success', null);
      this.syncSharedCapacityState(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capacity analysis failed';
      this.runStateSignal.set('error');
      this.resultSignal.set(null);
      this.errorSignal.set(message);
      this.updateScenarioStatus(scenarioKey, 'error', message);
    }
  }

  async runAllScenarios(): Promise<void> {
    const options = this.networkOptionsSignal();
    if (options.length === 0) {
      return;
    }

    const originallySelected = this.selectedNetworkOption();

    for (const option of options) {
      await this.setNetworkOptionAndReload(option);
      await this.runAnalysis();
    }

    if (originallySelected) {
      await this.setNetworkOptionAndReload(originallySelected);
    }
  }

  async runRemainingScenarios(): Promise<void> {
    const options = this.networkOptionsSignal();
    const statuses = this.scenarioRunStatesSignal();
    const remaining = options.filter((option) => statuses.get(option.scenarioName) !== 'success');

    if (remaining.length === 0) {
      return;
    }

    const originallySelected = this.selectedNetworkOption();

    for (const option of remaining) {
      await this.setNetworkOptionAndReload(option);
      await this.runAnalysis();
    }

    if (originallySelected) {
      await this.setNetworkOptionAndReload(originallySelected);
    }
  }

  async selectScenarioByName(scenarioName: string): Promise<void> {
    const option = this.networkOptionsSignal().find((candidate) => candidate.scenarioName === scenarioName);
    if (!option) {
      return;
    }

    await this.setNetworkOptionAndReload(option);
  }

  getExportPayload(): Record<string, unknown> | null {
    const result = this.resultSignal();
    if (!result) {
      return null;
    }

    return {
      generatedAt: new Date().toISOString(),
      inputs: this.inputsSignal(),
      selectedDetailSource: this.selectedDetailSourceSignal(),
      result
    };
  }

  private updateRows(
    key: 'nodeCapacities' | 'edgeCapacities' | 'sourceRates',
    rowIndex: number,
    updated: CapacityV2InputRow
  ): void {
    this.inputsSignal.update((state) => {
      const rows = [...state[key]];
      if (rowIndex < 0 || rowIndex >= rows.length) {
        return state;
      }
      rows[rowIndex] = updated;
      return {
        ...state,
        [key]: rows
      };
    });
  }

  private buildNetworkOptions(capacityGroups: CapacityFileGroup[]): CapacityV2NetworkOption[] {
    return capacityGroups.map((group, index) => {
      // Extract just the filename for edges
      const edgesFileName = group.edgesFile?.name ?? group.edgesFile?.path?.split('/').pop() ?? '';
      
      // For capacities path, extract relative path without network name prefix
      let capacitiesPath = group.capacitiesFile?.path ?? group.capacitiesFile?.name ?? '';
      const originalCapacitiesPath = capacitiesPath;
      const pathParts = capacitiesPath.split('/').filter(p => p.length > 0);
      // If path starts with network base name (e.g., "water/Storm Event/..."), strip it
      if (pathParts.length > 1 && pathParts[0] && !capacitiesPath.includes('temp_uploads')) {
        capacitiesPath = pathParts.slice(1).join('/');
      }
      
      console.log(`📦 Network Option ${index + 1} [${group.scenarioName}]:`, {
        originalCapacitiesPath,
        strippedCapacitiesPath: capacitiesPath,
        edgesFileName
      });
      
      return {
        label: group.scenarioName || `Capacity Scenario ${index + 1}`,
        networkPath: group.networkPath ?? '',
        edgesFilePath: edgesFileName,
        capacitiesPath,
        scenarioName: group.scenarioName || `scenario-${index + 1}`,
        analysisType: this.inferOptionAnalysisType(group)
      };
    });
  }

  private resolveBaseNetworkPath(networkPath: string, scenarioName: string): string {
    const normalized = (networkPath || '').replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!normalized) {
      return '';
    }

    const scenario = (scenarioName || '').trim();
    if (scenario && normalized.endsWith(`/${scenario}`)) {
      return normalized.slice(0, -(scenario.length + 1));
    }

    return normalized;
  }

  private pickBestNetworkPath(
    preferredNetworkPath: string | undefined,
    optionNetworkPath: string | undefined,
    groupNetworkPath: string | undefined,
    scenarioName: string
  ): string {
    const candidates = [preferredNetworkPath, optionNetworkPath, groupNetworkPath]
      .map((value) => this.resolveBaseNetworkPath(value ?? '', scenarioName))
      .filter((value) => value.length > 0);

    if (candidates.length === 0) {
      return '';
    }

    const uploadPath = candidates.find((value) => value.includes('temp_uploads/'));
    if (uploadPath) {
      return uploadPath;
    }

    const nestedPath = candidates.find((value) => value.includes('/'));
    if (nestedPath) {
      return nestedPath;
    }

    return candidates[0];
  }

  private inferOptionAnalysisType(group: CapacityFileGroup): CapacityV2AnalysisType {
    const marker = `${group.scenarioName ?? ''} ${group.capacitiesFile?.path ?? ''} ${group.capacitiesFile?.name ?? ''}`.toLowerCase();
    return marker.includes('interval') ? 'interval' : 'deterministic';
  }

  private extractCapacityDefaults(parsedData: unknown): {
    analysisType: CapacityV2AnalysisType;
    nodes: Record<string, unknown>;
    edges: Record<string, unknown>;
    sourceRates: Record<string, unknown>;
  } {
    const parsed = this.asRecord(parsedData);
    
    console.log('🔍 EXTRACT: Root keys =', Object.keys(parsed));
    console.log('🔍 EXTRACT: Full data =', JSON.stringify(parsed, null, 2).substring(0, 500));

    // Get capacities object (should be at parsed['capacities'])
    const capacitiesData = this.asRecord(parsed['capacities'] || parsed);
    
    console.log('📦 CAPACITIES DATA keys =', Object.keys(capacitiesData));

    // Extract the three dictionaries
    const nodes = this.asRecord(capacitiesData['nodes']);
    const edges = this.asRecord(capacitiesData['edges']);
    const sourceRates = this.asRecord(capacitiesData['source_rates']);

    console.log('✅ EXTRACTED:', {
      nodeCount: Object.keys(nodes).length,
      edgeCount: Object.keys(edges).length,
      sourceCount: Object.keys(sourceRates).length,
      firstNode: Object.entries(nodes).slice(0, 1),
      firstEdge: Object.entries(edges).slice(0, 1),
      sources: Object.entries(sourceRates)
    });

    const analysisType = this.detectAnalysisType(capacitiesData, nodes, edges, sourceRates);
    return { analysisType, nodes, edges, sourceRates };
  }

  private detectAnalysisType(
    root: Record<string, unknown>,
    nodes: Record<string, unknown>,
    edges: Record<string, unknown>,
    sources: Record<string, unknown>
  ): CapacityV2AnalysisType {
    const dataType = String(root['data_type'] ?? '').toLowerCase();
    if (dataType.includes('interval')) {
      return 'interval';
    }

    const firstValue =
      Object.values(nodes)[0] ??
      Object.values(edges)[0] ??
      Object.values(sources)[0];

    if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
      const record = firstValue as Record<string, unknown>;
      if (
        typeof record['min'] === 'number' ||
        typeof record['max'] === 'number' ||
        typeof record['lower'] === 'number' ||
        typeof record['upper'] === 'number'
      ) {
        return 'interval';
      }
    }

    return 'deterministic';
  }

  private buildRows(source: Record<string, unknown>, fallbackKeys: string[], fallbackValue: number): CapacityV2InputRow[] {
    const sourceKeys = Object.keys(source);
    const keys = sourceKeys.length > 0 ? sourceKeys : fallbackKeys;

    const usingFallback = sourceKeys.length === 0;
    const firstSourceValue = source[sourceKeys[0]];

    if (usingFallback) {
      console.warn('⚠️ No source data found, using fallback keys with value:', fallbackValue);
    } else {
      console.log('📦 Building rows from source:', {
        sourceCount: sourceKeys.length,
        sampleValue: firstSourceValue,
        sampleValueType: typeof firstSourceValue
      });
    }

    const rows = keys.map((key) => {
      const rawValue = source[key];
      const normalized = this.service.normalizeInputRowValue(rawValue, fallbackValue);
      return {
        key,
        deterministic: normalized.deterministic,
        interval: normalized.interval
      };
    });

    console.log('✅ Built rows:', {
      totalRows: rows.length,
      sampleRow: rows[0],
      secondRow: rows[1]
    });

    return rows;
  }

  private createEmptyInputs(): CapacityV2RunInputs {
    return {
      networkPath: '',
      edgesFilePath: '',
      capacitiesPath: '',
      analysisType: 'deterministic',
      targetNodes: [],
      nodeCapacities: [],
      edgeCapacities: [],
      sourceRates: [],
      options: {
        computeAllMinCuts: true,
        enumerateCriticalPaths: true,
        computeUpgradePriorities: true,
        includeClassicalComparison: true,
        verbosity: 'standard'
      }
    };
  }

  private updateScenarioStatus(
    scenarioKey: string,
    status: CapacityV2RunState,
    error: string | null
  ): void {
    this.scenarioRunStatesSignal.update((state) => {
      const next = new Map(state);
      next.set(scenarioKey, status);
      return next;
    });

    this.scenarioErrorsSignal.update((state) => {
      const next = new Map(state);
      next.set(scenarioKey, error);
      return next;
    });

    if (status === 'success') {
      this.scenarioUpdatedAtSignal.update((state) => {
        const next = new Map(state);
        next.set(scenarioKey, new Date().toISOString());
        return next;
      });
    }
  }

  private applyCachedScenarioView(scenarioKey: string): void {
    const cachedResult = this.scenarioResultsSignal().get(scenarioKey) ?? null;
    const cachedStatus = this.scenarioRunStatesSignal().get(scenarioKey) ?? 'idle';
    const cachedError = this.scenarioErrorsSignal().get(scenarioKey) ?? null;

    this.resultSignal.set(cachedResult);
    this.runStateSignal.set(cachedStatus);
    this.errorSignal.set(cachedError);
  }

  private getScenarioKeyFromInputs(inputs: CapacityV2RunInputs): string {
    return this.selectedNetworkOption()?.scenarioName || inputs.capacitiesPath || 'capacity-v2';
  }

  private syncSharedCapacityState(result: CapacityV2ResultEntity): void {
    const scenarioName = this.selectedNetworkOption()?.scenarioName || this.selectedNetworkOption()?.label || 'capacity-v2';
    const currentInputs = this.inputsSignal();
    const detail = result.kind === 'deterministic' ? result.deterministic : result.interval.worstCase;
    const summary = result.kind === 'deterministic' ? result.deterministic.summary : result.interval.summary;

    const saturatedComponents = {
      ...Object.fromEntries(detail.bottlenecks.saturatedNodes.map((node) => [String(node), true])),
      ...Object.fromEntries(
        detail.bottlenecks.saturatedEdges.map((edge) => [`(${edge[0]},${edge[1]})`, true])
      )
    };

    const scenario: CapacityScenario = {
      computation_time: summary.computationTimeMs / 1000,
      network_utilization: summary.utilization,
      total_source_input: currentInputs.sourceRates.reduce((sum, row) => sum + row.deterministic, 0),
      total_target_output:
        typeof summary.throughput === 'number'
          ? summary.throughput
          : summary.throughput.max,
      target_flows: detail.targetFlows,
      source_inputs: Object.fromEntries(
        currentInputs.sourceRates.map((row) => [row.key, row.deterministic])
      ),
      active_sources: currentInputs.sourceRates
        .map((row) => Number(row.key))
        .filter((value) => Number.isFinite(value)),
      target_nodes: currentInputs.targetNodes,
      node_capacities_count: currentInputs.nodeCapacities.length,
      edge_capacities_count: currentInputs.edgeCapacities.length,
      input_files: {
        capacities_path: currentInputs.capacitiesPath
      },
      raw_capacity_result: {
        node_max_flows: Object.fromEntries(
          detail.nodeFlows.map((node) => [String(node.nodeId), node.flow])
        ),
        node_capacities: Object.fromEntries(
          currentInputs.nodeCapacities.map((row) => [row.key, row.deterministic])
        ),
        edge_capacities: Object.fromEntries(
          currentInputs.edgeCapacities.map((row) => [row.key, row.deterministic])
        ),
        source_rates: Object.fromEntries(
          currentInputs.sourceRates.map((row) => [row.key, row.deterministic])
        ),
        edge_flows: Object.fromEntries(detail.edgeFlows.map((edge) => [edge.edgeKey, edge.flow])),
        edge_utilization: Object.fromEntries(
          detail.edgeFlows.map((edge) => [
            edge.edgeKey,
            (() => {
              const inferredCapacity = edge.utilization > 0 ? edge.flow / edge.utilization : edge.flow;
              return {
                capacity: inferredCapacity,
                flow: edge.flow,
                utilization: edge.utilization,
                spare: Math.max(0, inferredCapacity - edge.flow)
              };
            })()
          ])
        ),
        bottlenecks: saturatedComponents as any,
        critical_paths: {
          paths: detail.criticalPaths.criticalPaths.map((path) => path.path)
        } as any,
        network_utilization: summary.utilization,
        analysis_type: currentInputs.analysisType,
        computation_time: summary.computationTimeMs / 1000,
        convergence_info: {}
      }
    };

    const existing = this.analysisState.multiScenarioCapacityResults();
    const scenarios = new Map(existing?.scenarios ?? new Map<string, CapacityScenario>());
    scenarios.set(scenarioName, scenario);

    const availableFromState = existing?.availableScenarios ?? [];
    const availableScenarios = this.mergeScenarioInfo(
      availableFromState,
      this.analysisState.availableScenarios().capacity,
      scenarioName,
      currentInputs.capacitiesPath
    );

    const updated: MultiScenarioCapacityResults = {
      scenarios,
      currentScenario: scenarioName,
      availableScenarios
    };

    this.analysisState.setMultiScenarioCapacityResults(updated);
    this.analysisState.setGlobalCurrentScenario(scenarioName);
  }

  private mergeScenarioInfo(
    current: ScenarioInfo[],
    fromAnalysisState: ScenarioInfo[],
    scenarioName: string,
    path: string
  ): ScenarioInfo[] {
    const merged = new Map<string, ScenarioInfo>();

    [...fromAnalysisState, ...current].forEach((info) => {
      merged.set(info.name, info);
    });

    if (!merged.has(scenarioName)) {
      merged.set(scenarioName, {
        name: scenarioName,
        displayName: scenarioName,
        analysisType: 'capacity',
        dataType: 'float',
        path
      });
    }

    return Array.from(merged.values());
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
