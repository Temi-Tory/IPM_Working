import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  IntervalData,
  PboxData,
  ValueForm,
  isIntervalData,
  isPboxData,
} from '@inf-prop/shared/api-client';
import {
  formatInterval,
  formatNumber,
  formatPboxSummary,
} from './value-format';

/**
 * Renders a `number | IntervalData | PboxData` WITHOUT flattening it — the
 * framework's "value-form honesty at every boundary" commitment, enforced in one
 * component so no feature re-implements (or mis-implements) it.
 *
 *  - number   -> the number
 *  - interval -> `[lower, upper]` + a form tag; optional width bar
 *  - p-box    -> `E ∈ [ml, mh]` (+ shape, variance) + a form tag
 *
 * `compact` (default) is a single inline line; set `[compact]="false"` for a
 * detailed block (used on a node's detail panel).
 */
@Component({
  selector: 'ipf-value',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind() === 'number') {
      <span class="num">{{ numberText() }}</span>
    } @else if (kind() === 'interval') {
      <span class="interval">
        <span class="text">{{ intervalText() }}</span>
        @if (showTag()) {
          <span class="tag">interval</span>
        }
      </span>
      @if (!compact()) {
        <span class="bar" [title]="'width ' + widthText()">
          <span
            class="bar-fill"
            [style.left.%]="barLeft()"
            [style.width.%]="barWidth()"
          ></span>
        </span>
      }
    } @else {
      <span class="pbox">
        <span class="text">{{ pboxText() }}</span>
        @if (showTag()) {
          <span class="tag">p-box</span>
        }
      </span>
      @if (!compact() && asPbox(); as pb) {
        <dl class="detail">
          <div><dt>Mean</dt><dd>[{{ fmt(pb.mean_lower) }}, {{ fmt(pb.mean_upper) }}]</dd></div>
          <div><dt>Variance</dt><dd>[{{ fmt(pb.var_lower) }}, {{ fmt(pb.var_upper) }}]</dd></div>
          @if (pb.shape) {
            <div><dt>Shape</dt><dd>{{ pb.shape }}</dd></div>
          }
          <div><dt>Bounds</dt><dd>[{{ fmt(pb.bounds_summary.left_min) }} … {{ fmt(pb.bounds_summary.right_max) }}]</dd></div>
        </dl>
      }
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--spacingHorizontalXS, 4px);
        flex-wrap: wrap;
        font-variant-numeric: tabular-nums;
        color: var(--colorNeutralForeground1);
      }
      .text,
      .num {
        font-size: var(--fontSizeBase300, 14px);
      }
      .tag {
        font-size: var(--fontSizeBase100, 10px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px 5px;
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
      }
      .bar {
        position: relative;
        display: inline-block;
        width: 88px;
        height: 4px;
        border-radius: 2px;
        background: var(--colorNeutralBackground4);
      }
      .bar-fill {
        position: absolute;
        top: 0;
        height: 100%;
        border-radius: 2px;
        background: var(--colorBrandBackground);
      }
      .detail {
        margin: 4px 0 0;
        display: grid;
        gap: 2px 12px;
        width: 100%;
        font-size: var(--fontSizeBase200, 12px);
      }
      .detail > div {
        display: flex;
        gap: 8px;
      }
      .detail dt {
        color: var(--colorNeutralForeground3);
        min-width: 64px;
      }
      .detail dd {
        margin: 0;
        color: var(--colorNeutralForeground2);
      }
    `,
  ],
})
export class ValueDisplayComponent {
  readonly value = input.required<ValueForm>();
  readonly compact = input(true);
  readonly showTag = input(true);
  readonly maxFractionDigits = input(4);
  /** for the width bar on intervals — the domain to scale against (default 0..1). */
  readonly domainMin = input(0);
  readonly domainMax = input(1);

  protected readonly kind = computed<'number' | 'interval' | 'pbox'>(() => {
    const v = this.value();
    if (isIntervalData(v)) return 'interval';
    if (isPboxData(v)) return 'pbox';
    return 'number';
  });

  protected fmt = (n: number) =>
    formatNumber(n, { maxFractionDigits: this.maxFractionDigits() });

  protected numberText = () =>
    typeof this.value() === 'number' ? this.fmt(this.value() as number) : '';

  protected intervalText = () =>
    isIntervalData(this.value())
      ? formatInterval(this.value() as IntervalData, this.maxFractionDigits())
      : '';

  protected pboxText = () =>
    isPboxData(this.value())
      ? formatPboxSummary(this.value() as PboxData, this.maxFractionDigits())
      : '';

  protected asPbox = (): PboxData | null =>
    isPboxData(this.value()) ? (this.value() as PboxData) : null;

  protected widthText = () => {
    const v = this.value();
    return isIntervalData(v) ? this.fmt(v.upper - v.lower) : '';
  };

  private span = () => Math.max(this.domainMax() - this.domainMin(), 1e-9);

  protected barLeft = () => {
    const v = this.value();
    if (!isIntervalData(v)) return 0;
    return ((v.lower - this.domainMin()) / this.span()) * 100;
  };

  protected barWidth = () => {
    const v = this.value();
    if (!isIntervalData(v)) return 0;
    return Math.max(((v.upper - v.lower) / this.span()) * 100, 1.5);
  };
}
