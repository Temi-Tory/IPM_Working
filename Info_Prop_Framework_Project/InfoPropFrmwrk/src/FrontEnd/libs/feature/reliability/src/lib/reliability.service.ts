import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, throwError } from 'rxjs';
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
  scenarioRunId,
} from '@inf-prop/shared/data-access';
import {
  ReliabilityScenarioRef,
  fixedNodeUnion,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  toReliabilityScenarios,
} from './reliability.types';
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
    const ctx = this.ctx.context();
    if (!ctx) return throwError(() => new Error('No network is loaded.'));
    const request: ProbabilityPropagationRequest = {
      networkPath: ctx.networkPath,
      edgesFilePath: ctx.edgesFilePath,
      nodepriorsPath: scenario.nodepriorsPath,
      linkprobsPath: scenario.linkprobsPath,
      includeExactInference: true,
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
   * Promote a diamond to a new independent network and upload it. The caller
   * gets the `UploadResponse` and is responsible for switching the app's network
   * context to the new session.
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
        return this.uploads.upload(buildDiamondUploadFiles(input));
      }),
    );
  }

  /** Record a completed run in the cross-scenario cache (Track 4 reads these). */
  record(
    scenario: ReliabilityScenarioRef,
    res: ProbabilityPropagationResponse,
  ): void {
    const ctx = this.ctx.context();
    const ei = res.probability_result?.exact_inference;
    if (!ctx || !ei) return;
    const stats = ei.belief_statistics;
    const valueType: ValueType = resolvedValueType(res) ?? scenario.hintValueType;

    const metrics: ScenarioMetric[] = [
      {
        label: 'Mean belief',
        value: stats.mean,
        direction: 'higher-better',
      },
      { label: 'Min belief', value: stats.min, direction: 'higher-better' },
      { label: 'Max belief', value: stats.max, direction: 'higher-better' },
      {
        label: 'Nodes analysed',
        value: stats.total_count,
        direction: 'neutral',
      },
    ];

    const diamonds = readEmbeddedDiamondAnalysis(res);
    const overlays: ScenarioOverlay[] | undefined = diamonds
      ? [
          {
            focus: 'diamond-fixed-nodes',
            label: 'Diamond fixed nodes',
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
