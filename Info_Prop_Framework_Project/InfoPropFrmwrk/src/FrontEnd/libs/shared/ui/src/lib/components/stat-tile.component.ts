import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-registry';

/**
 * One labelled figure for a dashboard row. `value` is projected as content so
 * callers can put an `<ipf-value>` (interval / p-box safe) inside it.
 *
 *   <ipf-stat-tile label="Max flow" icon="flow">42</ipf-stat-tile>
 */
@Component({
  selector: 'ipf-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="head">
      @if (icon()) {
        <ipf-icon [name]="icon()!" [size]="16" />
      }
      <span class="label">{{ label() }}</span>
    </div>
    <div class="value"><ng-content /></div>
    @if (caption()) {
      <div class="caption">{{ caption() }}</div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: var(--spacingVerticalM, 12px) var(--spacingHorizontalM, 12px);
        background: var(--colorNeutralBackground1);
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        min-width: 0;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--colorNeutralForeground3);
      }
      .label {
        font-size: var(--fontSizeBase200, 12px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .value {
        font-size: var(--fontSizeBase500, 20px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
        font-variant-numeric: tabular-nums;
      }
      .caption {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
    `,
  ],
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly icon = input<IconName | undefined>(undefined);
  readonly caption = input<string | undefined>(undefined);
}
