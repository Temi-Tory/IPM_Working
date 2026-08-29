import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * A dismissible error message. Wraps `fluent-message-bar` (intent=error) and
 * adds an optional retry action. Feed it the `ApiRequestError.message` from
 * `shared/api-client` — it is already user-facing.
 */
@Component({
  selector: 'ipf-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IconComponent],
  template: `
    <fluent-message-bar [attr.intent]="intent()">
      <span>{{ message() }}</span>
      @if (retryable()) {
        <button slot="actions" type="button" class="link" (click)="retry.emit()">
          <ipf-icon name="refresh" [size]="14" />
          <span>Retry</span>
        </button>
      }
      @if (dismissible()) {
        <button
          slot="actions"
          type="button"
          class="link"
          aria-label="Dismiss"
          (click)="dismiss.emit()"
        >
          <ipf-icon name="dismiss" [size]="14" />
        </button>
      }
    </fluent-message-bar>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        padding: 2px 4px;
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
        cursor: pointer;
      }
      .link:hover {
        color: var(--colorNeutralForeground1);
      }
    `,
  ],
})
export class ErrorBannerComponent {
  readonly message = input.required<string>();
  readonly intent = input<'error' | 'warning' | 'info' | 'success'>('error');
  readonly retryable = input(false);
  readonly dismissible = input(true);
  readonly retry = output<void>();
  readonly dismiss = output<void>();
}
