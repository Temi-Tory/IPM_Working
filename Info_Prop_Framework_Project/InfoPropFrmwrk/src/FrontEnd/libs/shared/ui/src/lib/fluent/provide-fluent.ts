import {
  EnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { ThemeService } from '../theme/theme.service';

/**
 * Wires the Fluent design system into the app: registers every custom element
 * and applies the initial theme before first render.
 *
 * Add to the shell's `app.config.ts` providers. Fluent's elements are custom
 * elements, so every Angular component that uses a `<fluent-*>` tag still needs
 * `CUSTOM_ELEMENTS_SCHEMA` in its `schemas` array.
 *
 * The component registration is loaded lazily inside the initializer so that
 * importing this lib's barrel in a unit test (jsdom) does not pull in Fluent's
 * browser-only custom-element machinery.
 */
export function provideFluent(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const theme = inject(ThemeService);
    return import('./register-fluent').then(({ registerFluentComponents }) => {
      registerFluentComponents();
      theme.init();
    });
  });
}
