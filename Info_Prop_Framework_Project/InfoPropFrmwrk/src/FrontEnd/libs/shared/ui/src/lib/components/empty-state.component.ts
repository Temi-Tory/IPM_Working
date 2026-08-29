import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-registry';

/**
 * A real empty-state: says what the view is for and points the way forward.
 * Use this instead of a bare error string when a view needs data that does not
 * exist yet (e.g. System Profile before any scenario has been run). Project
 * action buttons into the `[slot=actions]` slot.
 */
@Component({
  selector: 'ipf-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="box">
      <div class="glyph"><ipf-icon [name]="icon()" [size]="28" /></div>
      <h2>{{ title() }}</h2>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <div class="actions"><ng-content select="[slot=actions]" /></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 240px;
        padding: var(--spacingVerticalXXL, 24px);
      }
      .box {
        max-width: 42ch;
        text-align: center;
      }
      .glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      h2 {
        margin: 0;
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      p {
        margin: 6px 0 0;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .actions {
        margin-top: var(--spacingVerticalL, 16px);
        display: flex;
        gap: var(--spacingHorizontalS, 8px);
        justify-content: center;
        flex-wrap: wrap;
      }
      .actions:empty {
        display: none;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('circle-hint');
  readonly title = input.required<string>();
  readonly message = input<string | undefined>(undefined);
}
