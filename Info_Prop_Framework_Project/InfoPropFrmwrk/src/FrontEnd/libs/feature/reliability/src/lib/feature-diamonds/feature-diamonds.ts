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
import { Router, RouterLink } from '@angular/router';
import {
  ApiRequestError,
  DiamondSubgraphResponse,
  ProbabilityPropagationResponse,
  ValueType,
} from '@inf-prop/shared/api-client';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  IconComponent,
  LoadingStateComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';
import {
  MaximalDiamond,
  ReliabilityScenarioRef,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
  subDiamondsOf,
} from '../reliability.types';
import { ReliabilityService } from '../reliability.service';
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

/**
 * Diamond decomposition, as its own nav destination — for a user who has
 * reliability inputs but doesn't want to run full belief propagation yet,
 * or who wants to browse decomposition across several scenarios side by
 * side without a Time/Cost/Compare-style workflow around it. Reuses
 * everything the Reliability toolkit already built for this (the same
 * service, the same diamond types, the same structure/detail components):
 * decomposition is a Reliability pre-processing step wherever it runs, this
 * page just gives it a front door of its own.
 *
 * If a scenario already has a cached FULL reliability run, its diamond
 * structure is used immediately — no network call. Otherwise (or to
 * refresh), "Identify diamonds" runs decomposition alone
 * (`includeExactInference: false`), the lighter of the two calls.
 */
@Component({
  selector: 'ipf-feature-diamonds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    LoadingStateComponent,
    CardComponent,
    IconComponent,
    DiamondStructureComponent,
    DiamondDetailComponent,
  ],
  templateUrl: './feature-diamonds.html',
  styleUrl: './feature-diamonds.scss',
})
export class FeatureDiamonds {
  private readonly svc = inject(ReliabilityService);
  private readonly ctx = inject(NetworkContextService);
  private readonly router = inject(Router);

  protected readonly networkName = computed(
    () => this.ctx.context()?.networkName ?? 'network',
  );

  protected readonly scenarios = computed(() => this.svc.scenarios());
  protected readonly selectedName = signal<string | null>(null);

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

  private readonly results = signal<Map<string, ProbabilityPropagationResponse>>(
    new Map(),
  );
  private rehydrated = false;

  protected readonly identifying = signal(false);
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

  /** true when the current result came from a full reliability run (has
   *  belief data), not just a diamonds-only identification — shown so the
   *  source of the structure is never ambiguous. */
  protected readonly fromFullRun = computed(
    () => !!this.activeResult()?.probability_result?.exact_inference,
  );

  protected readonly diamondAnalysis = computed(() => {
    const r = this.activeResult();
    return r ? readEmbeddedDiamondAnalysis(r) : null;
  });

  protected hasRun(name: string): boolean {
    return this.results().has(name);
  }

  // --- diamond drill-down / promotion state ---------------------------------
  private readonly inspectStack = signal<MaximalDiamond[]>([]);
  protected readonly inspecting = computed<MaximalDiamond | null>(
    () => this.inspectStack().at(-1) ?? null,
  );
  protected readonly canGoBackInDetail = computed(
    () => this.inspectStack().length > 1,
  );
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
        // Obviously, if a scenario already ran through Reliability, use
        // that result rather than asking the user to identify again.
        if (!this.rehydrated) {
          this.rehydrated = true;
          const map = new Map(this.results());
          for (const s of list) {
            const cached = this.svc.cachedRun(s);
            if (cached) map.set(s.name, cached);
          }
          if (map.size) this.results.set(map);
        }
      });
    });
  }

  protected valueTypeLabel(v: ValueType): string {
    return VALUE_TYPE_LABEL[v];
  }

  protected valueTypeIcon(v: ValueType): 'value-number' | 'value-interval' | 'value-pbox' {
    return VALUE_TYPE_ICON[v];
  }

  protected selectScenario(name: string): void {
    this.selectedName.set(name);
    this.error.set(null);
  }

  protected setFormFilter(filter: ValueType | 'all'): void {
    this.formFilter.set(filter);
  }

  /**
   * Decomposition only — no belief computation. If a full run for this
   * scenario is already cached, its belief data is preserved rather than
   * overwritten by the (belief-less) identify-only response.
   */
  protected identifyDiamonds(): void {
    const scenario = this.selectedScenario();
    if (!scenario) return;
    this.identifying.set(true);
    this.error.set(null);
    const existing = this.results().get(scenario.name);
    this.svc.identifyDiamonds(scenario).subscribe({
      next: (res) => {
        this.identifying.set(false);
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
        this.identifying.set(false);
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
