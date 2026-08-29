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
  StatTileComponent,
  ValueTypeSelectorComponent,
} from '@inf-prop/shared/ui';
import {
  MaximalDiamond,
  ReliabilityScenarioRef,
  readEmbeddedDiamondAnalysis,
  resolvedValueType,
} from '../reliability.types';
import { buildBeliefRows } from '../belief-rows';
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
    ValueTypeSelectorComponent,
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
  private readonly router = inject(Router);

  protected readonly networkName = computed(
    () => this.ctx.context()?.networkName ?? 'network',
  );
  protected readonly structure = this.ctx.structure;

  protected readonly scenarios = computed(() => this.svc.scenarios());
  protected readonly selectedName = signal<string | null>(null);
  protected readonly valueTypeNote = signal<string | null>(null);

  protected readonly selectedScenario = computed<ReliabilityScenarioRef | null>(
    () => {
      const list = this.scenarios();
      return (
        list.find((s) => s.name === this.selectedName()) ?? list[0] ?? null
      );
    },
  );

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

  protected readonly beliefRows = computed(() => {
    const r = this.activeResult();
    if (!r) return [];
    return buildBeliefRows(
      r,
      this.structure(),
      this.diamondAnalysis()?.diamondJoinNodes ?? [],
    );
  });

  // --- diamond drill-down / promotion state ---------------------------------
  protected readonly inspecting = signal<MaximalDiamond | null>(null);
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
        }
      });
    });
  }

  protected valueTypeLabel(v: ValueType): string {
    return VALUE_TYPE_LABEL[v];
  }

  protected selectScenario(name: string): void {
    this.selectedName.set(name);
    this.valueTypeNote.set(null);
    this.error.set(null);
  }

  protected pickValueType(vt: ValueType): void {
    const match = this.scenarios().find((s) => s.hintValueType === vt);
    if (match) {
      this.selectScenario(match.name);
    } else {
      this.valueTypeNote.set(
        `This upload has no ${this.valueTypeLabel(vt)} reliability scenario.`,
      );
    }
  }

  protected run(): void {
    const scenario = this.selectedScenario();
    if (!scenario) return;
    this.running.set(true);
    this.error.set(null);
    this.svc.run(scenario).subscribe({
      next: (res) => {
        this.running.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Analysis failed.');
          return;
        }
        this.results.update((map) => {
          const next = new Map(map);
          next.set(scenario.name, res);
          return next;
        });
        this.svc.record(scenario, res);
      },
      error: (e: ApiRequestError) => {
        this.running.set(false);
        this.error.set(e.message);
      },
    });
  }

  protected onInspect(diamond: MaximalDiamond): void {
    this.inspecting.set(diamond);
    this.isolatedResult.set(null);
    this.isolatedError.set(null);
    this.promoteError.set(null);
  }

  protected closeDetail(): void {
    this.inspecting.set(null);
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
          this.inspecting.set(null);
          this.ctx.setContext({
            sessionId: res.upload_id,
            networkPath: res.network_path,
            networkName: res.network_name,
            edgesFilePath: res.edges_files?.[0],
          });
          this.ctx.setUploadFromPaths(
            res.network_name,
            res.uploaded_files ?? [],
          );
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
