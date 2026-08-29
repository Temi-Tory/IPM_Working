import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * The standard page title block. Optional back affordance, description line, and
 * a right-aligned actions slot (`<... slot="actions">`).
 */
@Component({
  selector: 'ipf-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="row">
      <div class="lead">
        @if (backLabel()) {
          <button class="back" type="button" (click)="back.emit()">
            <ipf-icon name="arrow-left" [size]="16" />
            <span>{{ backLabel() }}</span>
          </button>
        }
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p>{{ description() }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[slot=actions]" /></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacingHorizontalL, 16px);
        flex-wrap: wrap;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        padding: 2px 0;
        margin-bottom: 4px;
        color: var(--colorNeutralForeground2);
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        cursor: pointer;
      }
      .back:hover {
        color: var(--colorNeutralForeground1);
      }
      h1 {
        margin: 0;
        font-size: var(--fontSizeBase600, 24px);
        font-weight: var(--fontWeightSemibold, 600);
        line-height: var(--lineHeightBase600, 32px);
        color: var(--colorNeutralForeground1);
      }
      p {
        margin: 4px 0 0;
        max-width: 68ch;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalS, 8px);
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
  readonly backLabel = input<string | undefined>(undefined);
  readonly back = output<void>();
}
