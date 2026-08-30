import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { DiamondSubgraphResponse, ValueType } from '@inf-prop/shared/api-client';
import {
  ErrorBannerComponent,
  IconComponent,
  LoadingStateComponent,
  ValueDisplayComponent,
} from '@inf-prop/shared/ui';
import { MaximalDiamond } from '../reliability.types';
import { SubgraphViewComponent } from './subgraph-view.component';

export interface PromoteRequest {
  priorOverrides?: Record<number, number>;
}
export interface IsolatedRequest {
  sourceOverrides?: Record<string, number>;
}

/**
 * One maximal diamond, opened for inspection from a reliability result. Three
 * things a user can do here, all grounded in the framework's own self-similarity
 * claim — a diamond is "a unified graph object of its own":
 *
 *  - read the identification detail (fixed nodes, local structure);
 *  - run reachability on it in isolation (`/diamond-subgraph-analysis`, keyed by
 *    the diamond's own hash);
 *  - promote it to a brand-new network and land in a fresh upload session.
 *
 * Local-source overrides (substituting a local source's prior) are the
 * secondary refinement — the common case is "no overrides".
 */
@Component({
  selector: 'ipf-diamond-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    IconComponent,
    ValueDisplayComponent,
    LoadingStateComponent,
    ErrorBannerComponent,
    SubgraphViewComponent,
  ],
  templateUrl: './diamond-detail.component.html',
  styleUrl: './diamond-detail.component.scss',
})
export class DiamondDetailComponent {
  readonly diamond = input.required<MaximalDiamond>();
  readonly valueType = input.required<ValueType>();

  /** this diamond's own immediate sub-diamonds, resolved by the container
   *  (it already holds the full diamond analysis) — empty at the innermost
   *  level, where `isInduced()` is true. */
  readonly subDiamonds = input<MaximalDiamond[]>([]);
  /** true when this isn't the diamond the user first opened — shows Back. */
  readonly canGoBack = input(false);

  readonly isolatedResult = input<DiamondSubgraphResponse | null>(null);
  readonly isolatedBusy = input(false);
  readonly isolatedError = input<string | null>(null);
  readonly promoting = input(false);
  readonly promoteError = input<string | null>(null);

  readonly closed = output<void>();
  readonly promote = output<PromoteRequest>();
  readonly analyseIsolated = output<IsolatedRequest>();
  /** open one of `subDiamonds()` in this same view */
  readonly drillInto = output<MaximalDiamond>();
  /** return to the diamond that was open before the last `drillInto` */
  readonly drillBack = output<void>();

  /** raw text of each local-source override input, keyed by node id */
  protected readonly overrideText = signal<Record<number, string>>({});

  protected readonly joinNode = computed(() => this.diamond().joinNode);
  protected readonly fixedNodes = computed(() => this.diamond().fixedNodes);
  protected readonly relevantNodes = computed(() => this.diamond().relevantNodes);
  protected readonly edgelist = computed(() => this.diamond().edgelist);
  protected readonly localSources = computed(() => this.diamond().localSources);
  protected readonly subDiamondCount = computed(
    () => this.diamond().subDiamondCount,
  );
  protected readonly isInduced = computed(() => this.diamond().isInduced);
  protected readonly identified = computed(() => this.diamond().identified);
  protected readonly isMaximal = computed(
    () => this.diamond().raw.is_root_diamond,
  );
  protected readonly title = computed(() => {
    const at = `at join ${this.joinNode()}`;
    if (this.isMaximal()) return `Maximal diamond ${at}`;
    return this.identified()
      ? `Sub-diamond ${at}`
      : `Sub-diamond ${at} — unidentified`;
  });

  protected readonly overridesAllowed = computed(
    () => this.valueType() === 'float64',
  );

  protected readonly isolatedBeliefs = computed(() => {
    const beliefs = this.isolatedResult()?.reachability_result?.beliefs;
    if (!beliefs) return [];
    return Object.entries(beliefs)
      .map(([id, belief]) => ({ nodeId: Number(id), belief }))
      .sort((a, b) => a.nodeId - b.nodeId);
  });

  protected setOverride(nodeId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.overrideText.update((cur) => ({ ...cur, [nodeId]: value }));
  }

  private parsedOverrides(): Record<number, number> {
    const out: Record<number, number> = {};
    for (const [id, text] of Object.entries(this.overrideText())) {
      const n = Number(text);
      if (text.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 1) {
        out[Number(id)] = n;
      }
    }
    return out;
  }

  protected onPromote(): void {
    const overrides = this.parsedOverrides();
    this.promote.emit({
      priorOverrides: Object.keys(overrides).length ? overrides : undefined,
    });
  }

  protected onAnalyse(): void {
    const overrides = this.parsedOverrides();
    const asStringKeys: Record<string, number> = {};
    for (const [id, v] of Object.entries(overrides)) asStringKeys[id] = v;
    this.analyseIsolated.emit({
      sourceOverrides: Object.keys(asStringKeys).length
        ? asStringKeys
        : undefined,
    });
  }

  protected onDrillInto(sub: MaximalDiamond): void {
    this.drillInto.emit(sub);
  }

  protected onDrillBack(): void {
    this.drillBack.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
