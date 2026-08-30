import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CardComponent, IconComponent } from '@inf-prop/shared/ui';
import {
  EmbeddedDiamondAnalysis,
  MaximalDiamond,
  conditioningWidth,
  maximalDiamonds,
} from '../reliability.types';

export type NestingFilter = 'all' | 'induced' | 'nested';

/**
 * Diamond structure, surfaced from WITHIN a reliability result — not a nav-level
 * page. Diamond decomposition is the pre-processing step the probability toolkit
 * is built on: wherever redundant paths reconverge at a diamond join, naive
 * independence would over-estimate reliability, so the algorithm conditions on
 * the diamond's fixed nodes instead. Every diamond join carries exactly one
 * maximal diamond; this panel lists them and opens one for its identification
 * detail.
 */
@Component({
  selector: 'ipf-diamond-structure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconComponent],
  templateUrl: './diamond-structure.component.html',
  styleUrl: './diamond-structure.component.scss',
})
export class DiamondStructureComponent {
  readonly analysis = input.required<EmbeddedDiamondAnalysis>();
  readonly inspect = output<MaximalDiamond>();

  protected readonly diamonds = computed<MaximalDiamond[]>(() =>
    maximalDiamonds(this.analysis()),
  );

  protected readonly hasDiamonds = computed(() => this.diamonds().length > 0);

  /** the largest conditioning set any diamond in this analysis forces — the
   *  Probability chapter's cost-governing parameter (§Complexity Analysis). */
  protected readonly width = computed(() => conditioningWidth(this.analysis()));

  // --- filters: by nesting and by conditioning-set size -------------------
  protected readonly nestingFilter = signal<NestingFilter>('all');
  protected readonly minConditioning = signal<number | null>(null);
  protected readonly maxConditioning = signal<number | null>(null);

  protected readonly filteredDiamonds = computed(() => {
    const nesting = this.nestingFilter();
    const min = this.minConditioning();
    const max = this.maxConditioning();
    return this.diamonds().filter((d) => {
      if (nesting === 'induced' && !d.isInduced) return false;
      if (nesting === 'nested' && d.isInduced) return false;
      const size = d.fixedNodes.length;
      if (min !== null && size < min) return false;
      if (max !== null && size > max) return false;
      return true;
    });
  });

  protected readonly filtersActive = computed(
    () =>
      this.nestingFilter() !== 'all' ||
      this.minConditioning() !== null ||
      this.maxConditioning() !== null,
  );

  protected readonly pageSize = 10;
  protected readonly page = signal(0);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredDiamonds().length / this.pageSize)),
  );

  /** clamps the page signal back into range whenever the analysis or the
   *  filters change */
  protected readonly clampedPage = computed(() =>
    Math.min(this.page(), this.pageCount() - 1),
  );

  protected readonly pageDiamonds = computed(() => {
    const start = this.clampedPage() * this.pageSize;
    return this.filteredDiamonds().slice(start, start + this.pageSize);
  });

  protected readonly pageRangeLabel = computed(() => {
    const total = this.filteredDiamonds().length;
    if (total === 0) return '0 of 0';
    const start = this.clampedPage() * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `${start}–${end} of ${total}`;
  });

  protected goToPage(delta: number): void {
    this.page.set(
      Math.min(Math.max(this.clampedPage() + delta, 0), this.pageCount() - 1),
    );
  }

  protected setNesting(filter: NestingFilter): void {
    this.nestingFilter.set(filter);
    this.page.set(0);
  }

  protected onMinConditioning(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.minConditioning.set(raw === '' ? null : Number(raw));
    this.page.set(0);
  }

  protected onMaxConditioning(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.maxConditioning.set(raw === '' ? null : Number(raw));
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.nestingFilter.set('all');
    this.minConditioning.set(null);
    this.maxConditioning.set(null);
    this.page.set(0);
  }

  protected open(diamond: MaximalDiamond): void {
    this.inspect.emit(diamond);
  }
}
