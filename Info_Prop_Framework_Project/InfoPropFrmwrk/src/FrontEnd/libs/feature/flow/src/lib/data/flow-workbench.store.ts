import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  ApiRequestError,
  CapacityResult,
  FlowAnalysisRequest,
  FlowAnalysisResponse,
} from '@inf-prop/shared/api-client';
import {
  NetworkContext,
  NetworkContextService,
  ScenarioCacheService,
  ScenarioMetric,
  ScenarioOverlay,
  scenarioRunId,
} from '@inf-prop/shared/data-access';
import { CapacityScenario, toCapacityScenarios } from './capacity-scenario';
import {
  DEFAULT_FLOW_RUN_OPTIONS,
  FlowRunOptions,
  toAnalysisOptions,
} from './flow-run-options';
import { FlowAnalysisClient } from './flow-analysis.client';

export type FlowRunState = 'idle' | 'loading' | 'success' | 'error';

/**
 * The flow workbench's shared state: the capacities scenarios the loaded
 * network carries, the run options, and the last `/flow-analysis` result. One
 * app-wide instance, so the picked scenario and the last result survive
 * navigating between the sub-views (and away and back). A change of loaded
 * network clears the stale result.
 *
 * Every value read downstream is a real field of the response — nothing here
 * invents a score, ranking or recommendation.
 */
@Injectable({ providedIn: 'root' })
export class FlowWorkbenchStore {
  private readonly client = inject(FlowAnalysisClient);
  private readonly ctx = inject(NetworkContextService);
  private readonly scenarioCache = inject(ScenarioCacheService);

  private readonly _selectedId = signal<string | null>(null);
  private readonly _options = signal<FlowRunOptions>({
    ...DEFAULT_FLOW_RUN_OPTIONS,
  });
  private readonly _runState = signal<FlowRunState>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _result = signal<FlowAnalysisResponse | null>(null);
  private readonly _ranScenarioName = signal<string | null>(null);
  private readonly _ranAt = signal<number | null>(null);

  /** networkPath the current result belongs to. */
  private resultNetworkPath: string | null = null;

  readonly options = this._options.asReadonly();
  readonly runState = this._runState.asReadonly();
  readonly error = this._error.asReadonly();
  readonly result = this._result.asReadonly();
  readonly ranScenarioName = this._ranScenarioName.asReadonly();
  readonly ranAt = this._ranAt.asReadonly();

  /** Capacities scenarios on the loaded network (reacts to the loaded upload). */
  readonly scenarios = computed<CapacityScenario[]>(() =>
    toCapacityScenarios(this.ctx.scenariosFor('flow')),
  );

  readonly selectedScenario = computed<CapacityScenario | null>(() => {
    const list = this.scenarios();
    return list.find((s) => s.id === this._selectedId()) ?? list[0] ?? null;
  });

  readonly hasScenarios = computed(() => this.scenarios().length > 0);
  readonly hasResult = computed(() => this._result() !== null);
  readonly isRunning = computed(() => this._runState() === 'loading');

  readonly capacityResult = computed<CapacityResult | null>(
    () => this._result()?.capacity_result ?? null,
  );

  readonly canRun = computed(
    () => this.selectedScenario() !== null && !this.isRunning(),
  );

  /** Flow runs recorded this session for the loaded network, newest first. */
  readonly recordedRuns = computed(() => {
    const path = this.ctx.context()?.networkPath;
    return this.scenarioCache
      .runsForToolkit('flow')
      .filter((r) => !path || r.networkPath === path)
      .sort((a, b) => b.ranAt - a.ranAt);
  });

  constructor() {
    // A different network is loaded — drop a result that no longer applies.
    effect(() => {
      const path = this.ctx.context()?.networkPath ?? null;
      if (this.resultNetworkPath !== null && path !== this.resultNetworkPath) {
        this._result.set(null);
        this._ranScenarioName.set(null);
        this._ranAt.set(null);
        this._runState.set('idle');
        this._error.set(null);
        this._selectedId.set(null);
        this.resultNetworkPath = null;
      }
    });
  }

  select(id: string): void {
    this._selectedId.set(id);
  }

  patchOptions(patch: Partial<FlowRunOptions>): void {
    this._options.update((current) => ({ ...current, ...patch }));
  }

  clearError(): void {
    this._error.set(null);
    if (this._runState() === 'error') {
      this._runState.set(this._result() ? 'success' : 'idle');
    }
  }

  /** Run `/flow-analysis` for the selected scenario. */
  run(): void {
    const scenario = this.selectedScenario();
    const context = this.ctx.context();
    if (!scenario || !context) {
      this._error.set('Pick a capacities scenario first.');
      this._runState.set('error');
      return;
    }

    const request: FlowAnalysisRequest = {
      networkPath: context.networkPath,
      edgesFilePath: context.edgesFilePath,
      capacitiesPath: scenario.capacitiesPath,
      analysisOptions: toAnalysisOptions(this._options()),
    };

    this._runState.set('loading');
    this._error.set(null);

    this.client.analyze(request).subscribe({
      next: (response) => {
        if (!response.success) {
          this._error.set(response.message || 'Flow analysis failed.');
          this._runState.set('error');
          return;
        }
        const ranAt = Date.now();
        this._result.set(response);
        this._ranScenarioName.set(scenario.name);
        this._ranAt.set(ranAt);
        this._runState.set('success');
        this.resultNetworkPath = context.networkPath;
        this.record(response, scenario, context, ranAt);
      },
      error: (e: ApiRequestError) => {
        this._error.set(e.message);
        this._runState.set('error');
      },
    });
  }

  /** Hand the run to the cross-scenario cache — labelled real outputs only. */
  private record(
    response: FlowAnalysisResponse,
    scenario: CapacityScenario,
    context: NetworkContext,
    ranAt: number,
  ): void {
    const cr = response.capacity_result;
    const flow = cr.flow;

    const metrics: ScenarioMetric[] = [
      {
        label: 'Maximum throughput',
        value: flow.max_flow,
        direction: 'higher-better',
      },
      {
        label: 'Minimum-cut capacity',
        value: cr.min_cut_analysis.min_cut_capacity,
        direction: 'higher-better',
      },
      {
        label: 'Saturated edges',
        value: flow.saturated_edges.length,
        direction: 'neutral',
      },
      {
        label: 'Edges in every minimum cut',
        value: cr.min_cut_analysis.edges_in_every_cut.length,
        direction: 'neutral',
      },
      {
        label: 'Free-zone size',
        value: cr.min_cut_analysis.enumeration.free_zone_size,
        direction: 'neutral',
      },
      {
        label: 'Structural SPOF nodes',
        value: cr.structure.spof_nodes.length,
        direction: 'lower-better',
      },
      {
        label: 'Contributing path components',
        value: cr.flow_decomposition.components.length,
        direction: 'neutral',
      },
    ];

    const overlays: ScenarioOverlay[] = [
      {
        focus: 'saturated-edges',
        label: 'Saturated edges',
        edges: flow.saturated_edges,
      },
      {
        focus: 'min-cut-edges',
        label: 'Edges in every minimum cut',
        edges: cr.min_cut_analysis.edges_in_every_cut,
      },
      {
        focus: 'spof-nodes',
        label: 'Structural SPOF nodes',
        nodeIds: cr.structure.spof_nodes,
      },
    ];

    this.scenarioCache.record({
      id: scenarioRunId('flow', context.networkPath, scenario.name, 'float64'),
      networkPath: context.networkPath,
      networkName: context.networkName,
      toolkit: 'flow',
      scenarioName: scenario.name,
      valueType: 'float64',
      ranAt,
      computationTimeMs: response.computation_time * 1000,
      inputFiles: {
        edges: response.input.edges_file_path,
        capacities: response.input.capacities_path,
      },
      metrics,
      overlays,
      raw: response,
    });
  }
}
