import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, from, of, tap } from 'rxjs';
import {
  ApiRequestError,
  DiamondSubgraphResponse,
  ProbabilityPropagationResponse,
  ValueType,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  ScenarioCacheService,
  ScenarioRun,
} from '@inf-prop/shared/data-access';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  GraphHighlight,
  IconComponent,
  LoadingStateComponent,
  NetworkGraphComponent,
  PageHeaderComponent,
  ScenarioComparisonTableComponent,
  StatTileComponent,
} from '@inf-prop/shared/ui';
import {
  MaximalDiamond,
  ReliabilityScenarioRef,
  conditioningWidth,
  fixedNodeUnion,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  subDiamondsOf,
} from '../reliability.types';
import { beliefBandWidth, beliefMidpoint, buildBeliefRows } from '../belief-rows';
import { ReliabilityService } from '../reliability.service';
import { BeliefTableComponent } from '../components/belief-table.component';
import { DiamondStructureComponent } from '../components/diamond-structure.component';
import {
  DiamondDetailComponent,
  IsolatedRequest,
  PromoteRequest,
} from '../components/diamond-detail.component';

const VALUE_TYPE_LABEL: Record<ValueType, string> = {
  float64: 'deterministic',
  interval: 'interval',
  pbox: 'probability box',
};

const VALUE_TYPE_ICON: Record<ValueType, 'value-number' | 'value-interval' | 'value-pbox'> = {
  float64: 'value-number',
  interval: 'value-interval',
  pbox: 'value-pbox',
};

export type ReliabilityTab = 'belief' | 'diamonds' | 'visualisation' | 'compare';

/**
 * Track 1 — Reliability / reachability.
 *
 * Belief `b(v)` per node: the probability the node operates AND is reachable
 * from a source, given independent component failure. One page, all three value
 * forms (Float64 / interval / p-box), rendered honestly through `<ipf-value>`.
 * Diamond structure is surfaced from inside the result, and any diamond can be
 * promoted to a network of its own.
 */
@Component({
  selector: 'ipf-feature-reliability',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    DecimalPipe,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    LoadingStateComponent,
    CardComponent,
    StatTileComponent,
    IconComponent,
    NetworkGraphComponent,
    ScenarioComparisonTableComponent,
    BeliefTableComponent,
    DiamondStructureComponent,
    DiamondDetailComponent,
  ],
  templateUrl: './feature-reliability.html',
  styleUrl: './feature-reliability.scss',
})
export class FeatureReliability {
  private readonly svc = inject(ReliabilityService);
  private readonly ctx = inject(NetworkContextService);
  private readonly cache = inject(ScenarioCacheService);
  private readonly router = inject(Router);

  protected readonly networkName = computed(
    () => this.ctx.context()?.networkName ?? 'network',
  );
  protected readonly structure = this.ctx.structure;

  protected readonly scenarios = computed(() => this.svc.scenarios());
  protected readonly selectedName = signal<string | null>(null);

  /**
   * The value form is a property of a scenario's own input files, not an
   * independent choice — so there is no free-standing "value form" control.
   * This is a FILTER over the scenario list, shown only when the network
   * actually carries more than one form; picking one narrows which scenario
   * cards are visible, it does not itself set anything.
   */
  protected readonly availableForms = computed<ValueType[]>(() => {
    const seen = new Set(this.scenarios().map((s) => s.hintValueType));
    return (['float64', 'interval', 'pbox'] as ValueType[]).filter((v) =>
      seen.has(v),
    );
  });
  protected readonly formFilter = signal<ValueType | 'all'>('all');
  protected readonly visibleScenarios = computed<ReliabilityScenarioRef[]>(
    () => {
      const filter = this.formFilter();
      const list = this.scenarios();
      return filter === 'all'
        ? list
        : list.filter((s) => s.hintValueType === filter);
    },
  );

  protected readonly selectedScenario = computed<ReliabilityScenarioRef | null>(
    () => {
      const list = this.visibleScenarios();
      return (
        list.find((s) => s.name === this.selectedName()) ?? list[0] ?? null
      );
    },
  );

  protected readonly activeTab = signal<ReliabilityTab>('belief');

  /** per-scenario-name results, kept so switching scenarios restores a prior run */
  private readonly results = signal<
    Map<string, ProbabilityPropagationResponse>
  >(new Map());
  private rehydrated = false;

  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly activeResult = computed<ProbabilityPropagationResponse | null>(
    () => {
      const s = this.selectedScenario();
      return s ? (this.results().get(s.name) ?? null) : null;
    },
  );

  protected readonly activeValueType = computed<ValueType>(() => {
    const res = this.activeResult();
    if (res) {
      return (
        resolvedValueType(res) ??
        this.selectedScenario()?.hintValueType ??
        'float64'
      );
    }
    return this.selectedScenario()?.hintValueType ?? 'float64';
  });

  protected readonly stats = computed(
    () =>
      this.activeResult()?.probability_result?.exact_inference
        ?.belief_statistics ?? null,
  );

  protected readonly cacheStatus = computed(() => {
    const r = this.activeResult();
    if (!r) return null;
    return {
      hit: r.diamond_cache_hit,
      status: r.diamond_cache_status,
      time:
        r.probability_result?.exact_inference?.computation_time ?? undefined,
    };
  });

  protected readonly diamondAnalysis = computed(() => {
    const r = this.activeResult();
    return r ? readEmbeddedDiamondAnalysis(r) : null;
  });

  /** true once belief has actually been computed for the current scenario —
   *  distinct from `activeResult()` existing, since a diamonds-only
   *  identification also produces a result with no belief in it. */
  protected readonly hasBeliefData = computed(
    () => !!this.activeResult()?.probability_result?.exact_inference,
  );

  protected readonly beliefRows = computed(() => {
    const r = this.activeResult();
    if (!r) return [];
    return buildBeliefRows(
      r,
      this.structure(),
      this.diamondAnalysis()?.diamondJoinNodes ?? [],
    );
  });

  protected readonly sinkBeliefRows = computed(() =>
    this.beliefRows().filter((r) => r.roleTags.includes('sink')),
  );

  /** Mean belief restricted to sink nodes — the end-to-end reliability figure,
   *  arguably more useful at a glance than the mean over every node in the
   *  network (which includes sources and interior nodes at ~1 by construction
   *  in many networks). Same numeric-summary convention as `stats()`. */
  protected readonly meanBeliefAtSinks = computed<number | null>(() => {
    const rows = this.sinkBeliefRows();
    if (!rows.length) return null;
    const vals = rows
      .map((r) => beliefMidpoint(r.belief))
      .filter((v) => !Number.isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  /** the node achieving min/max belief — found on the SAME numeric basis as
   *  `stats().min/.max` (the midpoint convention), so the reported node
   *  actually matches the reported value. Mirrors the chapter's own case
   *  study, which names the worst-served facility, not just its value. */
  protected readonly worstBeliefRow = computed(() => this.extremeBeliefRow('min'));
  protected readonly bestBeliefRow = computed(() => this.extremeBeliefRow('max'));

  private extremeBeliefRow(which: 'min' | 'max') {
    const rows = this.beliefRows();
    if (!rows.length) return null;
    let extreme = rows[0];
    let extremeVal = beliefMidpoint(extreme.belief);
    for (const row of rows) {
      const v = beliefMidpoint(row.belief);
      if (Number.isNaN(v)) continue;
      if (which === 'min' ? v < extremeVal : v > extremeVal) {
        extreme = row;
        extremeVal = v;
      }
    }
    return extreme;
  }

  /** Reachability band width — how wide each node's stated bound is. Zero
   *  everywhere for float64. Mirrors the chapter's own case-study framing:
   *  a confidently-known 0.6 and a 0.56–0.72 band call for different
   *  engineering responses. */
  protected readonly meanBandWidth = computed<number | null>(() => {
    const rows = this.beliefRows();
    if (!rows.length) return null;
    const widths = rows.map((r) => beliefBandWidth(r.belief));
    return widths.reduce((a, b) => a + b, 0) / widths.length;
  });

  protected readonly widestBandRow = computed(() => {
    const rows = this.beliefRows();
    if (!rows.length) return null;
    let widest = rows[0];
    let widestVal = beliefBandWidth(widest.belief);
    for (const row of rows) {
      const w = beliefBandWidth(row.belief);
      if (w > widestVal) {
        widest = row;
        widestVal = w;
      }
    }
    return widestVal > 0 ? widest : null;
  });

  /** The largest conditioning set the current scenario's diamonds force — the
   *  Probability chapter's own cost-governing parameter. */
  protected readonly conditioningWidthValue = computed<number | null>(() => {
    const d = this.diamondAnalysis();
    return d ? conditioningWidth(d) : null;
  });

  protected readonly aggregateNote = computed<string | null>(() => {
    if (this.activeValueType() === 'float64') return null;
    const basis =
      this.activeValueType() === 'interval'
        ? 'interval midpoints'
        : 'p-box mean midpoints';
    return `Mean / min / max / mean-at-sinks are numeric summaries computed over ${basis}. Band width is the width of each node's own stated bound (for p-box, the bound on its mean). The per-node values below are never flattened.`;
  });

  protected readonly beliefRunHint = computed(
    () =>
      `Runs full belief propagation for ${this.selectedScenario()?.name ?? ''} and identifies its diamond structure in the same pass.`,
  );

  protected readonly diamondsRunHint = computed(
    () =>
      `Decomposition alone, with no belief computation — reconvergence structure for ${this.selectedScenario()?.name ?? ''} can be inspected before committing to a full run.`,
  );

  protected readonly diamondsRunning = signal(false);

  /** the graph highlight for the Visualisation tab: every fixed node, across
   *  every diamond actually posed — maximal AND nested — on this scenario's
   *  structure (a nested diamond can fix a node its enclosing maximal diamond
   *  never does, so a maximal-only union would miss it; see `fixedNodeUnion`) */
  protected readonly diamondHighlight = computed<GraphHighlight | null>(() => {
    const d = this.diamondAnalysis();
    if (!d || d.uniqueDiamondCount === 0) return null;
    return {
      nodeIds: fixedNodeUnion(d),
      label: `conditioning set across ${d.uniqueDiamondCount} diamond${d.uniqueDiamondCount === 1 ? '' : 's'} (maximal + nested)`,
    };
  });

  // --- Compare tab: multi-scenario selection, run-all --------------------

  /** independent of `selectedName` — the single scenario a drill-down tab is
   *  focused on is a different question from "which scenarios do I want
   *  juxtaposed here". Defaults to every scenario once, on first load. */
  protected readonly compareSelection = signal<Set<string>>(new Set());

  protected readonly comparedRuns = computed<ScenarioRun[]>(() => {
    const ctx = this.ctx.context();
    if (!ctx) return [];
    const names = this.compareSelection();
    if (!names.size) return [];
    return this.cache
      .runsForToolkit('reliability')
      .filter(
        (r) => r.networkPath === ctx.networkPath && names.has(r.scenarioName),
      );
  });

  /** checked scenarios that haven't run yet — exactly what "Run all
   *  scenarios" acts on, so the checkboxes are respected rather than a
   *  separate implicit "every visible scenario" rule. */
  protected readonly pendingCompareScenarios = computed<ReliabilityScenarioRef[]>(
    () => {
      const checked = this.compareSelection();
      return this.visibleScenarios().filter(
        (s) => checked.has(s.name) && !this.hasRun(s.name),
      );
    },
  );

  protected readonly runningAll = signal(false);
  protected readonly runAllProgress = signal<{ done: number; total: number } | null>(
    null,
  );

  // --- diamond drill-down / promotion state ---------------------------------

  /** navigation stack for the detail dialog: [] closed, [d] at the diamond
   *  first opened, [d, sub, ...] after drilling into nested sub-diamonds. */
  private readonly inspectStack = signal<MaximalDiamond[]>([]);
  protected readonly inspecting = computed<MaximalDiamond | null>(
    () => this.inspectStack().at(-1) ?? null,
  );
  protected readonly canGoBackInDetail = computed(
    () => this.inspectStack().length > 1,
  );
  /** the currently-inspected diamond's own immediate sub-diamonds — empty at
   *  the innermost (induced) level. */
  protected readonly inspectingSubDiamonds = computed<MaximalDiamond[]>(() => {
    const d = this.inspecting();
    const analysis = this.diamondAnalysis();
    return d && analysis ? subDiamondsOf(d, analysis) : [];
  });
  protected readonly isolatedResult = signal<DiamondSubgraphResponse | null>(
    null,
  );
  protected readonly isolatedBusy = signal(false);
  protected readonly isolatedError = signal<string | null>(null);
  protected readonly promoting = signal(false);
  protected readonly promoteError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const list = this.scenarios();
      if (!list.length) return;
      untracked(() => {
        const name = this.selectedName();
        if (!name || !list.some((s) => s.name === name)) {
          this.selectedName.set(list[0].name);
        }
        if (!this.rehydrated) {
          this.rehydrated = true;
          const map = new Map(this.results());
          for (const s of list) {
            const cached = this.svc.cachedRun(s);
            if (cached) map.set(s.name, cached);
          }
          if (map.size) this.results.set(map);
          this.compareSelection.set(new Set(list.map((s) => s.name)));
        }
      });
    });
  }

  protected valueTypeLabel(v: ValueType): string {
    return VALUE_TYPE_LABEL[v];
  }

  protected beliefBandWidth = beliefBandWidth;

  protected valueTypeIcon(v: ValueType): 'value-number' | 'value-interval' | 'value-pbox' {
    return VALUE_TYPE_ICON[v];
  }

  /** whether a scenario has a result cached (rehydrated or run this session) —
   *  drives the scenario card's "already run" checkmark */
  protected hasRun(name: string): boolean {
    return this.results().has(name);
  }

  protected selectScenario(name: string): void {
    this.selectedName.set(name);
    this.error.set(null);
  }

  /** Narrow the scenario-card list to one value form, or show all again. */
  protected setFormFilter(filter: ValueType | 'all'): void {
    this.formFilter.set(filter);
  }

  protected selectTab(tab: ReliabilityTab): void {
    this.activeTab.set(tab);
  }

  protected isCompareChecked(name: string): boolean {
    return this.compareSelection().has(name);
  }

  protected toggleCompare(name: string): void {
    this.compareSelection.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  protected selectAllCompare(): void {
    this.compareSelection.set(new Set(this.visibleScenarios().map((s) => s.name)));
  }

  protected clearCompare(): void {
    this.compareSelection.set(new Set());
  }

  /** Runs one scenario and folds a successful result into `results` + the
   *  cross-scenario cache. Shared by `run()` (one scenario, user-driven) and
   *  `runSelected()` (every checked-but-unrun scenario, chained). */
  private executeRun(
    scenario: ReliabilityScenarioRef,
  ): Observable<ProbabilityPropagationResponse> {
    return this.svc.run(scenario).pipe(
      tap((res) => {
        if (!res.success) return;
        this.results.update((map) => {
          const next = new Map(map);
          next.set(scenario.name, res);
          return next;
        });
        this.svc.record(scenario, res);
      }),
    );
  }

  protected run(): void {
    const scenario = this.selectedScenario();
    if (!scenario) return;
    this.running.set(true);
    this.error.set(null);
    this.executeRun(scenario).subscribe({
      next: (res) => {
        this.running.set(false);
        if (!res.success) this.error.set(res.message || 'Analysis failed.');
      },
      error: (e: ApiRequestError) => {
        this.running.set(false);
        this.error.set(e.message);
      },
    });
  }

  /**
   * Runs every CHECKED scenario that has no result yet, one at a time —
   * chained rather than parallel. Nothing here has verified the Julia server
   * handles concurrent analysis requests safely (each solve touches the same
   * process-wide diamond cache), so a sequential queue with visible progress
   * is the safe default; a scenario that fails is recorded as an error but
   * doesn't stop the rest of the queue. "Select all" / "None" above batch the
   * checkboxes this reads, so a full run is still one click away.
   */
  protected runSelected(): void {
    const pending = this.pendingCompareScenarios();
    if (!pending.length) return;
    this.runningAll.set(true);
    this.error.set(null);
    this.runAllProgress.set({ done: 0, total: pending.length });
    from(pending)
      .pipe(
        concatMap((s) =>
          this.executeRun(s).pipe(
            catchError((e: ApiRequestError) => {
              this.error.set(`${s.name}: ${e.message}`);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.runAllProgress.update((p) => (p ? { ...p, done: p.done + 1 } : p));
        },
        complete: () => {
          this.runningAll.set(false);
          this.runAllProgress.set(null);
        },
      });
  }

  /**
   * Identify diamond structure only, with no belief propagation — the Diamonds
   * tab's own action, reachable without ever running the full analysis first.
   * If a full run already exists for this scenario, its belief data is kept:
   * we merge the diamond-only response's `exact_inference` field back in
   * rather than overwriting a real result with an absent one.
   */
  protected identifyDiamonds(): void {
    const scenario = this.selectedScenario();
    if (!scenario) return;
    this.diamondsRunning.set(true);
    this.error.set(null);
    const existing = this.results().get(scenario.name);
    this.svc.identifyDiamonds(scenario).subscribe({
      next: (res) => {
        this.diamondsRunning.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Diamond identification failed.');
          return;
        }
        const merged: ProbabilityPropagationResponse =
          existing?.probability_result?.exact_inference
            ? {
                ...res,
                probability_result: {
                  ...res.probability_result,
                  exact_inference: existing.probability_result.exact_inference,
                },
              }
            : res;
        this.results.update((map) => {
          const next = new Map(map);
          next.set(scenario.name, merged);
          return next;
        });
      },
      error: (e: ApiRequestError) => {
        this.diamondsRunning.set(false);
        this.error.set(e.message);
      },
    });
  }

  protected onInspect(diamond: MaximalDiamond): void {
    this.inspectStack.set([diamond]);
    this.resetDetailRunState();
  }

  protected closeDetail(): void {
    this.inspectStack.set([]);
  }

  /** Open one of the currently-inspected diamond's own sub-diamonds — the
   *  previous diamond's isolated-analysis result doesn't apply to it. */
  protected onDrillInto(sub: MaximalDiamond): void {
    this.inspectStack.update((stack) => [...stack, sub]);
    this.resetDetailRunState();
  }

  protected onDrillBack(): void {
    this.inspectStack.update((stack) => stack.slice(0, -1));
    this.resetDetailRunState();
  }

  private resetDetailRunState(): void {
    this.isolatedResult.set(null);
    this.isolatedError.set(null);
    this.promoteError.set(null);
  }

  protected onAnalyseIsolated(req: IsolatedRequest): void {
    const scenario = this.selectedScenario();
    const diamond = this.inspecting();
    if (!scenario || !diamond) return;
    this.isolatedBusy.set(true);
    this.isolatedError.set(null);
    this.svc
      .analyseDiamondInIsolation(scenario, diamond.hash, req.sourceOverrides)
      .subscribe({
        next: (res) => {
          this.isolatedBusy.set(false);
          if (!res.success) {
            this.isolatedError.set('The diamond could not be solved.');
            return;
          }
          this.isolatedResult.set(res);
        },
        error: (e: ApiRequestError) => {
          this.isolatedBusy.set(false);
          this.isolatedError.set(e.message);
        },
      });
  }

  protected onPromote(req: PromoteRequest): void {
    const scenario = this.selectedScenario();
    const diamond = this.inspecting();
    if (!scenario || !diamond) return;
    this.promoting.set(true);
    this.promoteError.set(null);
    this.svc
      .promoteDiamond({
        scenario,
        valueType: this.activeValueType(),
        edgelist: diamond.edgelist,
        relevantNodes: diamond.relevantNodes,
        label: `join-${diamond.joinNode}`,
        priorOverrides: req.priorOverrides,
      })
      .subscribe({
        next: (res) => {
          this.promoting.set(false);
          if (!res.success) {
            this.promoteError.set(res.message || 'Upload failed.');
            return;
          }
          // reliability.service already switched the network context (it
          // built the files, so it classifies them itself rather than
          // re-deriving from paths)
          this.inspectStack.set([]);
          this.ctx.loadStructure().subscribe({
            next: () => this.router.navigate(['/network']),
            error: () => this.router.navigate(['/network']),
          });
        },
        error: (e: ApiRequestError) => {
          this.promoting.set(false);
          this.promoteError.set(e.message);
        },
      });
  }
}
