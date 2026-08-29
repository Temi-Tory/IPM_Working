import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CardComponent, IconComponent } from '@inf-prop/shared/ui';
import {
  EmbeddedDiamondAnalysis,
  MaximalDiamond,
  maximalDiamonds,
} from '../reliability.types';

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

  protected open(diamond: MaximalDiamond): void {
    this.inspect.emit(diamond);
  }
}
