import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, tap, throwError } from 'rxjs';
import {
  ApiClient,
  DiamondSubgraphRequest,
  DiamondSubgraphResponse,
  ProbabilityPropagationRequest,
  ProbabilityPropagationResponse,
  UploadResponse,
  ValueType,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  ScenarioCacheService,
  ScenarioMetric,
  ScenarioOverlay,
  UploadService,
  classifyFiles,
  scenarioRunId,
} from '@inf-prop/shared/data-access';
import {
  ReliabilityScenarioRef,
  conditioningWidth,
  fixedNodeUnion,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  toReliabilityScenarios,
} from './reliability.types';
import { beliefBandWidth, beliefMidpoint } from './belief-rows';
import {
  DiamondPromotionInput,
  ParentLinksFile,
  ParentPriorsFile,
  buildDiamondUploadFiles,
  sanitiseNetworkName,
} from './diamond-promotion';

export interface DiamondPromotionOptions {
  scenario: ReliabilityScenarioRef;
  /** value form of the parent run, as resolved from its response */
  valueType: ValueType;
  edgelist: [number, number][];
  relevantNodes: number[];
  /** short label for the new network, e.g. `join-7` */
  label: string;
  priorOverrides?: Record<number, unknown>;
}

/**
 * The one place `feature/reliability` talks to the server. Wraps
 * `/probability-propagation`, `/diamond-subgraph-analysis`, and (for diamond
 * promotion) `GET /files/…` + `POST /upload` — all via the shared `ApiClient`,
 * never a hand-built URL.
 */
@Injectable({ providedIn: 'root' })
export class ReliabilityService {
  private readonly api = inject(ApiClient);
  private readonly ctx = inject(NetworkContextService);
  private readonly cache = inject(ScenarioCacheService);
  private readonly uploads = inject(UploadService);

  /**
   * Reliability scenarios on the loaded network — a nodepriors + linkprobs pair
   * each, straight from the shared scenario model. Reactive: call inside a
   * `computed`.
   */
  scenarios(): ReliabilityScenarioRef[] {
    return toReliabilityScenarios(this.ctx.scenariosFor('reliability'));
  }

  /** Run `/probability-propagation` for one scenario, with diamond identification. */
  run(
    scenario: ReliabilityScenarioRef,
  ): Observable<ProbabilityPropagationResponse> {
    return this.request(scenario, true);
  }

  /**
   * Identify diamond structure only — no belief propagation. The Diamonds tab
   * is reachable without first running a full reliability pass: decomposition
   * is genuinely a lighter, separate server call (`includeExactInference:
   * false`), not a byproduct that requires the belief computation to exist.
   */
  identifyDiamonds(
    scenario: ReliabilityScenarioRef,
  ): Observable<ProbabilityPropagationResponse> {
    return this.request(scenario, false);
  }

  private request(
    scenario: ReliabilityScenarioRef,
    includeExactInference: boolean,
  ): Observable<ProbabilityPropagationResponse> {
    const ctx = this.ctx.context();
    if (!ctx) return throwError(() => new Error('No network is loaded.'));
    const request: ProbabilityPropagationRequest = {
      networkPath: ctx.networkPath,
      edgesFilePath: ctx.edgesFilePath,
      nodepriorsPath: scenario.nodepriorsPath,
      linkprobsPath: scenario.linkprobsPath,
      includeExactInference,
      includeDiamondAnalysis: true,
    };
    return this.api.post<ProbabilityPropagationResponse>(
      '/probability-propagation',
      request,
    );
  }

  /** Run one analysis inside a single diamond, treated as a standalone subgraph. */
  analyseDiamondInIsolation(
    scenario: ReliabilityScenarioRef,
    diamondHash: string,
    sourceOverrides?: Record<string, number>,
  ): Observable<DiamondSubgraphResponse> {
    const ctx = this.ctx.context();
    if (!ctx) return throwError(() => new Error('No network is loaded.'));
    const request: DiamondSubgraphRequest = {
      networkPath: ctx.networkPath,
      edgesFilePath: ctx.edgesFilePath,
      nodepriorsPath: scenario.nodepriorsPath,
      linkprobsPath: scenario.linkprobsPath,
      diamondHash,
      analyses: ['reachability'],
      sourceOverrides: sourceOverrides
        ? { reachability: sourceOverrides }
        : undefined,
    };
    return this.api.post<DiamondSubgraphResponse>(
      '/diamond-subgraph-analysis',
      request,
    );
  }

  /**
   * Promote a diamond to a new independent network, upload it, and switch the
   * app's network context to the new session — the same "classify what we
   * already have locally, don't re-derive it from a fallible round-trip" rule
   * the main upload page follows. We built the `File`s ourselves, so
   * `classifyFiles` on them is instant and 100% correct (the scenario folder is
   * always a value-form keyword here — see `scenarioFolderFor`), unlike
   * re-deriving via `setUploadFromPaths` + an async `/files/` guess.
   */
  promoteDiamond(
    options: DiamondPromotionOptions,
  ): Observable<UploadResponse> {
    const ctx = this.ctx.context();
    if (!ctx) return throwError(() => new Error('No network is loaded.'));
    const base = `/files/${ctx.networkPath}`.replace(/\\/g, '/');
    const priors$ = this.api.get<ParentPriorsFile>(
      encodeURI(`${base}/${options.scenario.nodepriorsPath}`),
    );
    const links$ = this.api.get<ParentLinksFile>(
      encodeURI(`${base}/${options.scenario.linkprobsPath}`),
    );

    return forkJoin([priors$, links$]).pipe(
      switchMap(([parentPriors, parentLinks]) => {
        const input: DiamondPromotionInput = {
          networkName: `${sanitiseNetworkName(ctx.networkName)}-${sanitiseNetworkName(options.label)}`,
          valueType: options.valueType,
          edgelist: options.edgelist,
          relevantNodes: options.relevantNodes,
          parentPriors,
          parentLinks,
          priorOverrides: options.priorOverrides,
        };
        const files = buildDiamondUploadFiles(input);
        return this.uploads.upload(files).pipe(
          tap((res) => {
            if (!res.success) return;
            this.ctx.setContext({
              sessionId: res.upload_id,
              networkPath: res.network_path,
              networkName: res.network_name,
              edgesFilePath: res.edges_files?.[0],
            });
            this.ctx.setUpload(classifyFiles(files));
          }),
        );
      }),
    );
  }

  /**
   * Record a completed run in the cross-scenario cache (Track 4 reads these,
   * and each toolkit's own in-page Compare tab). Metric selection follows the
   * Probability chapter's own comparison table (§Case Study): structure and
   * conditioning width first (the chapter's cost-governing parameter), then
   * belief levels, then band width (its "different interventions" reading —
   * a confidently-known 0.6 and a 0.56–0.72 band call for different
   * responses), then cost.
   */
  record(
    scenario: ReliabilityScenarioRef,
    res: ProbabilityPropagationResponse,
  ): void {
    const ctx = this.ctx.context();
    const ei = res.probability_result?.exact_inference;
    if (!ctx || !ei) return;
    const stats = ei.belief_statistics;
    const valueType: ValueType = resolvedValueType(res) ?? scenario.hintValueType;
    const diamonds = readEmbeddedDiamondAnalysis(res);
    const beliefs = ei.beliefs ?? {};
    const beliefValues = Object.values(beliefs);
    const bandWidths = beliefValues.map(beliefBandWidth);
    const meanBand = bandWidths.length
      ? bandWidths.reduce((a, b) => a + b, 0) / bandWidths.length
      : 0;
    const maxBand = bandWidths.length ? Math.max(...bandWidths) : 0;

    const metrics: ScenarioMetric[] = [
      { label: 'Nodes analysed', value: stats.total_count, direction: 'neutral' },
      {
        label: 'Conditioning width',
        value: diamonds ? conditioningWidth(diamonds) : 0,
        direction: 'lower-better',
      },
      { label: 'Mean belief', value: stats.mean, direction: 'higher-better' },
      { label: 'Min belief', value: stats.min, direction: 'higher-better' },
      { label: 'Max belief', value: stats.max, direction: 'higher-better' },
      { label: 'Mean band width', value: meanBand, direction: 'lower-better' },
      { label: 'Max band width', value: maxBand, direction: 'lower-better' },
      {
        label: 'Computation time',
        value: ei.computation_time ?? 0,
        unit: 's',
        direction: 'lower-better',
      },
    ];

    const sinkIds = new Set(res.sink_nodes ?? []);
    const sinkVals = Object.entries(beliefs)
      .filter(([id]) => sinkIds.has(Number(id)))
      .map(([, v]) => beliefMidpoint(v));
    if (sinkVals.length) {
      metrics.splice(3, 0, {
        label: 'Mean belief at sinks',
        value: sinkVals.reduce((a, b) => a + b, 0) / sinkVals.length,
        direction: 'higher-better',
      });
    }

    // Scope the label explicitly: this is a UNION across every diamond the
    // decomposition actually posed — maximal AND nested — not one diamond's
    // own conditioning set. A nested diamond can fix a node its enclosing
    // maximal diamond never does (the Diamond chapter's own D2/D3 example),
    // so counting only maximal diamonds here would both undercount the node
    // set and mislabel how many diamonds contributed to it. A viewer with no
    // other context (e.g. the System Profile network lens) must not be able
    // to read this as "the conditioning set of a diamond" without knowing
    // which population. "Conditioning set" is the Probability chapter's own
    // term for the diamond's fixed nodes C, used throughout this toolkit.
    const overlays: ScenarioOverlay[] | undefined =
      diamonds && diamonds.uniqueDiamondCount > 0
        ? [
            {
              focus: 'diamond-fixed-nodes',
              label: `Conditioning set, union across ${diamonds.uniqueDiamondCount} diamond${diamonds.uniqueDiamondCount === 1 ? '' : 's'} (maximal + nested)`,
              nodeIds: fixedNodeUnion(diamonds),
            },
          ]
        : undefined;

    this.cache.record({
      id: scenarioRunId('reliability', ctx.networkPath, scenario.name, valueType),
      networkPath: ctx.networkPath,
      networkName: ctx.networkName,
      toolkit: 'reliability',
      scenarioName: scenario.name,
      valueType,
      ranAt: Date.now(),
      computationTimeMs: (ei.computation_time ?? 0) * 1000,
      inputFiles: {
        nodepriors: scenario.nodepriorsPath,
        linkprobabilities: scenario.linkprobsPath,
      },
      metrics,
      overlays,
      raw: res,
    });
  }

  /** The most recent cached reliability run for a scenario, if any. */
  cachedRun(
    scenario: ReliabilityScenarioRef,
  ): ProbabilityPropagationResponse | null {
    const ctx = this.ctx.context();
    if (!ctx) return null;
    const run = this.cache
      .runs()
      .find(
        (r) =>
          r.toolkit === 'reliability' &&
          r.networkPath === ctx.networkPath &&
          r.scenarioName === scenario.name,
      );
    return (run?.raw as ProbabilityPropagationResponse) ?? null;
  }
}
