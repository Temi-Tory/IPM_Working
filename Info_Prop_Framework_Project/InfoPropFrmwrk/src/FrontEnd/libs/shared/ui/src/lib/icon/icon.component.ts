import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { ICON_PATHS, IconName } from './icon-registry';

/**
 * `<ipf-icon name="flow" [size]="20" />` — a Fluent System Icon.
 * `currentColor` fill, so it inherits text colour. Decorative by default;
 * pass `label` to make it an accessible image.
 */
@Component({
  selector: 'ipf-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 20 20"
    fill="currentColor"
    [attr.aria-hidden]="label() ? null : 'true'"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label() || null"
    [innerHTML]="svg()"
  ></svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
        vertical-align: middle;
      }
    `,
  ],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input<string | undefined>(undefined);

  protected readonly svg = computed<SafeHtml>(() => {
    const markup = ICON_PATHS[this.name()] ?? ICON_PATHS['circle'];
    return this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
