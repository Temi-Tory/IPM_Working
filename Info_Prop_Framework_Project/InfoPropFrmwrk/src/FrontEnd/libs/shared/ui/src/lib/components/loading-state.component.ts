import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
} from '@angular/core';

/** Centred Fluent spinner with an optional label. For in-flight analysis. */
@Component({
  selector: 'ipf-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="box" role="status" aria-live="polite">
      <fluent-spinner [attr.size]="spinnerSize()"></fluent-spinner>
      @if (label()) {
        <span>{{ label() }}</span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 160px;
        padding: var(--spacingVerticalXL, 20px);
      }
      .box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacingVerticalM, 12px);
      }
      span {
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
    `,
  ],
})
export class LoadingStateComponent {
  readonly label = input<string | undefined>('Working…');
  readonly spinnerSize = input<'tiny' | 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large' | 'huge'>(
    'medium',
  );
}
