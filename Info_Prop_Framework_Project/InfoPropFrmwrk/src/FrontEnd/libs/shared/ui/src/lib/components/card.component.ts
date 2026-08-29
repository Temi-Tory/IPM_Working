import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * A neutral surface. Fluent 2 web-components v3 ships no `card`, so this is the
 * one place the "card" look is defined — built on Fluent tokens, themeable,
 * light and dark. Use it rather than re-inventing a panel per feature.
 */
@Component({
  selector: 'ipf-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: [
    `
      :host {
        display: block;
        background: var(--colorNeutralBackground1);
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusLarge, 6px);
        padding: var(--spacingVerticalL, 16px) var(--spacingHorizontalL, 16px);
      }
      :host([interactive]) {
        cursor: pointer;
        transition:
          box-shadow 0.1s ease,
          border-color 0.1s ease;
      }
      :host([interactive]:hover) {
        border-color: var(--colorNeutralStroke1);
        box-shadow: var(--shadow4);
      }
      :host([flush]) {
        padding: 0;
      }
    `,
  ],
  host: {
    '[attr.interactive]': "interactive() ? '' : null",
    '[attr.flush]': "flush() ? '' : null",
  },
})
export class CardComponent {
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly flush = input(false, { transform: booleanAttribute });
}
