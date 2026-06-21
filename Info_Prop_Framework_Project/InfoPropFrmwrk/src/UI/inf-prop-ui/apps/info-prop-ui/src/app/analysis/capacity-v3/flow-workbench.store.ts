import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { CapacityFileGroup, NetworkStructure } from '../../shared/models/network-analysis.models';
import { FlowAnalysisDomainResult } from './flow-domain.models';
import {
  EditableCapacityRow,
  FlowScenarioDraftRecord,
  FlowScenarioOption,
  FlowScenarioRun,
  FlowWorkbenchOptions,
  WorkbenchRunState
} from './flow-workbench.models';
import { FlowWorkbenchService } from './flow-workbench.service';

@Injectable({ providedIn: 'root' })
export class FlowWorkbenchStore {
  private readonly analysisState = inject(AnalysisStateService);
  private readonly fileManager = inject(FileManagerService);
  private readonly sessionService = inject(NetworkSessionService);
  private readonly service = inject(FlowWorkbenchService);

  private readonly networkSignal = signal<NetworkStructure | null>(null);
  private readonly scenarioOptionsSignal = signal<FlowScenarioOption[]>([]);
  private readonly selectedScenarioSignal = signal<string>('');
  private readonly rowsNodeSignal = signal<EditableCapacityRow[]>([]);
  private readonly rowsEdgeSignal = signal<EditableCapacityRow[]>([]);
  private readonly rowsSourceSignal = signal<EditableCapacityRow[]>([]);
  private readonly runStateSignal = signal<WorkbenchRunState>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private readonly resultSignal = signal<FlowAnalysisDomainResult | null>(null);
  private readonly runsSignal = signal<Map<string, FlowScenarioRun>>(new Map());
  private readonly draftsSignal = signal<FlowScenarioDraftRecord[]>([]);
  private readonly filterSignal = signal({ node: '', edge: '', source: '' });
  private readonly graphRenderSignal = signal({ maxNodes: 600, maxEdges: 2500 });

  private readonly optionsSignal = signal<FlowWorkbenchOptions>({
    algorithm: 'dinic',
    tol: 1e-10,
    kFailure: 2,
    cutLimit: 1000,
    pathLimit: 10000,
    combinationLimit: 10000,
    maxDepth: 64,
    includeNodeCapacities: true
  });

  readonly network = computed(() => this.networkSignal());
  readonly scenarioOptions = computed(() => this.scenarioOptionsSignal());
  readonly selectedScenario = computed(() => this.selectedScenarioSignal());
  readonly runState = computed(() => this.runStateSignal());
  readonly error = computed(() => this.errorSignal());
  readonly result = computed(() => this.resultSignal());
  readonly options = computed(() => this.optionsSignal());
  readonly drafts = computed(() => this.draftsSignal());
  readonly graphRender = computed(() => this.graphRenderSignal());
  readonly runs = computed(() => this.runsSignal());

  readonly filteredNodeRows = computed(() => this.applyFilter(this.rowsNodeSignal(), this.filterSignal().node));
  readonly filteredEdgeRows = computed(() => this.applyFilter(this.rowsEdgeSignal(), this.filterSignal().edge));
  readonly filteredSourceRows = computed(() => this.applyFilter(this.rowsSourceSignal(), this.filterSignal().source));

  readonly selectedCounts = computed(() => ({
    nodes: this.rowsNodeSignal().filter((r) => r.selected).length,
    edges: this.rowsEdgeSignal().filter((r) => r.selected).length,
    sources: this.rowsSourceSignal().filter((r) => r.selected).length
  }));

  readonly selectedNodeKeys = computed(() =>
    new Set(this.rowsNodeSignal().filter((r) => r.selected).map((r) => r.key))
  );

  initialize(): void {
    this.analysisState.loadParsedDataFromSession();

    if (!this.analysisState.networkData()) {
      this.analysisState.loadNetworkDataFromFileManager();
    }

    const networkData = this.analysisState.networkData();
    this.networkSignal.set(networkData);

    const groups = this.fileManager.analysisGroups().capacity;
    const options = this.buildScenarioOptions(groups);
    this.scenarioOptionsSignal.set(options);

    if (options.length > 0) {
      this.selectedScenarioSignal.set(options[0].name);
      this.loadScenarioRows(options[0]);
    }

    this.loadDraftsFromSession();
  }

  setScenario(name: string): void {
    const option = this.scenarioOptionsSignal().find((s) => s.name === name);
    if (!option) return;
    this.selectedScenarioSignal.set(name);
    this.errorSignal.set(null);
    this.loadScenarioRows(option);

    const run = this.runsSignal().get(name);
    this.resultSignal.set(run?.result ?? null);
    this.runStateSignal.set(run?.status ?? 'idle');
  }

  setOptionPatch(patch: Partial<FlowWorkbenchOptions>): void {
    this.optionsSignal.update((state) => ({ ...state, ...patch }));
  }

  setFilter(type: 'node' | 'edge' | 'source', value: string): void {
    this.filterSignal.update((state) => ({ ...state, [type]: value }));
  }

  setGraphRender(patch: Partial<{ maxNodes: number; maxEdges: number }>): void {
    this.graphRenderSignal.update((s) => ({ ...s, ...patch }));
  }

  toggleRow(type: 'node' | 'edge' | 'source', key: string): void {
    this.patchRows(type, (rows) => rows.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
  }

  updateRowValue(type: 'node' | 'edge' | 'source', key: string, value: number): void {
    if (!Number.isFinite(value)) return;
    this.patchRows(type, (rows) => rows.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  applyBatch(type: 'node' | 'edge' | 'source', mode: 'set' | 'scale', value: number): void {
    if (!Number.isFinite(value)) return;
    this.patchRows(type, (rows) =>
      rows.map((r) => {
        if (!r.selected) return r;
        const next = mode === 'set' ? value : r.value * value;
        return { ...r, value: Math.max(0, Number(next.toFixed(6))) };
      })
    );
  }

  selectVisible(type: 'node' | 'edge' | 'source', selected: boolean): void {
    const filterValue = this.filterSignal()[type].toLowerCase().trim();
    this.patchRows(type, (rows) =>
      rows.map((row) =>
        filterValue && !row.key.toLowerCase().includes(filterValue) ? row : { ...row, selected }
      )
    );
  }

  async runSelectedScenario(): Promise<void> {
    const scenario = this.currentScenarioOption();
    if (!scenario) {
      this.errorSignal.set('No flow scenario selected.');
      this.runStateSignal.set('error');
      return;
    }

    this.runStateSignal.set('running');
    this.errorSignal.set(null);

    try {
      const response = await firstValueFrom(
        this.service.analyze(
          scenario.networkPath,
          scenario.capacitiesPath,
          scenario.edgesFilePath,
          this.optionsSignal()
        )
      );

      this.resultSignal.set(response);
      this.runStateSignal.set('success');

      this.runsSignal.update((state) => {
        const next = new Map(state);
        next.set(scenario.name, {
          scenario,
          status: 'success',
          error: null,
          updatedAt: new Date().toISOString(),
          result: response
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Flow analysis failed.';
      this.runStateSignal.set('error');
      this.errorSignal.set(message);
      this.runsSignal.update((state) => {
        const next = new Map(state);
        next.set(scenario.name, {
          scenario,
          status: 'error',
          error: message,
          updatedAt: new Date().toISOString(),
          result: null
        });
        return next;
      });
    }
  }

  async runAllScenarios(): Promise<void> {
    const options = this.scenarioOptionsSignal();
    if (options.length === 0) return;

    const original = this.selectedScenarioSignal();

    for (const option of options) {
      this.setScenario(option.name);
      await this.runSelectedScenario();
    }

    if (original) {
      this.setScenario(original);
    }
  }

  saveDraftScenario(name: string, persistToSession: boolean): void {
    const scenario = this.currentScenarioOption();
    if (!scenario || !name.trim()) return;

    const record: FlowScenarioDraftRecord = {
      id: `draft-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      sourceScenario: scenario.name,
      nodeOverrides: Object.fromEntries(this.rowsNodeSignal().map((r) => [r.key, r.value])),
      edgeOverrides: Object.fromEntries(this.rowsEdgeSignal().map((r) => [r.key, r.value])),
      sourceOverrides: Object.fromEntries(this.rowsSourceSignal().map((r) => [r.key, r.value]))
    };

    this.draftsSignal.update((drafts) => [record, ...drafts]);

    if (persistToSession) {
      const session = this.sessionService.getCurrentSession();
      if (!session) return;

      const parsedData = session.parsedData ?? {};
      const existing = Array.isArray(parsedData.flowScenarioDrafts) ? parsedData.flowScenarioDrafts : [];
      this.sessionService.updateSession({
        parsedData: {
          ...parsedData,
          flowScenarioDrafts: [record, ...existing]
        }
      });
    }
  }

  private loadDraftsFromSession(): void {
    const session = this.sessionService.getCurrentSession();
    const parsedData = session?.parsedData ?? {};
    const drafts = Array.isArray(parsedData.flowScenarioDrafts) ? parsedData.flowScenarioDrafts : [];
    this.draftsSignal.set(drafts as FlowScenarioDraftRecord[]);
  }

  private loadScenarioRows(option: FlowScenarioOption): void {
    const groups = this.fileManager.analysisGroups().capacity;
    const group = groups.find((g) => (g.scenarioName || g.capacitiesFile?.name || '') === option.name);

    let payload: any = {};
    if (group?.capacitiesFile?.content) {
      try {
        payload = JSON.parse(group.capacitiesFile.content);
      } catch {
        payload = {};
      }
    }

    const capacities = payload?.capacities ?? {};
    const nodes = this.toRows(capacities?.nodes);
    const edges = this.toRows(capacities?.edges);
    const sources = this.toRows(capacities?.source_rates);

    this.rowsNodeSignal.set(nodes.length > 0 ? nodes : this.fallbackNodeRows());
    this.rowsEdgeSignal.set(edges.length > 0 ? edges : this.fallbackEdgeRows());
    this.rowsSourceSignal.set(sources.length > 0 ? sources : this.fallbackSourceRows());
  }

  private toRows(raw: unknown): EditableCapacityRow[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return { key, value: num, selected: false };
      })
      .filter((row): row is EditableCapacityRow => Boolean(row));
  }

  private fallbackNodeRows(): EditableCapacityRow[] {
    const nodes = this.networkSignal()?.nodes ?? [];
    return nodes.slice(0, 2000).map((n) => ({ key: String(n), value: 0, selected: false }));
  }

  private fallbackEdgeRows(): EditableCapacityRow[] {
    const edges = this.networkSignal()?.edges ?? [];
    return edges.slice(0, 8000).map(([u, v]) => ({ key: `(${u},${v})`, value: 0, selected: false }));
  }

  private fallbackSourceRows(): EditableCapacityRow[] {
    const sources = this.networkSignal()?.source_nodes ?? [];
    return sources.map((s) => ({ key: String(s), value: 0, selected: false }));
  }

  private buildScenarioOptions(groups: CapacityFileGroup[]): FlowScenarioOption[] {
    const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath || '';

    return groups.map((group, index) => {
      const name = group.scenarioName || group.capacitiesFile?.name || `scenario-${index + 1}`;
      const edgesName = group.edgesFile?.name || group.edgesFile?.path?.split('/').pop() || '';
      const capacitiesRelative = this.makeRelativeToNetwork(sessionNetworkPath, group.capacitiesFile?.path || group.capacitiesFile?.name || '');

      return {
        name,
        label: name,
        networkPath: sessionNetworkPath || group.networkPath || '',
        edgesFilePath: edgesName,
        capacitiesPath: capacitiesRelative
      };
    });
  }

  private makeRelativeToNetwork(networkPath: string, fullPath: string): string {
    const networkSegments = (networkPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const fileSegments = (fullPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    if (networkSegments.length === 0 || fileSegments.length === 0) return fullPath;

    const networkName = networkSegments[networkSegments.length - 1];
    const idx = fileSegments.indexOf(networkName);
    if (idx >= 0) {
      return fileSegments.slice(idx + 1).join('/');
    }

    return fullPath;
  }

  private currentScenarioOption(): FlowScenarioOption | null {
    return this.scenarioOptionsSignal().find((s) => s.name === this.selectedScenarioSignal()) ?? null;
  }

  private patchRows(type: 'node' | 'edge' | 'source', fn: (rows: EditableCapacityRow[]) => EditableCapacityRow[]): void {
    if (type === 'node') {
      this.rowsNodeSignal.update(fn);
      return;
    }
    if (type === 'edge') {
      this.rowsEdgeSignal.update(fn);
      return;
    }
    this.rowsSourceSignal.update(fn);
  }

  private applyFilter(rows: EditableCapacityRow[], filter: string): EditableCapacityRow[] {
    const q = filter.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((row) => row.key.toLowerCase().includes(q));
  }
}
