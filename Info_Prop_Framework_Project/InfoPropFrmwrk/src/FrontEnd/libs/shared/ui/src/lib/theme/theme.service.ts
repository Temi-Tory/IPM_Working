import { Injectable, computed, signal } from '@angular/core';
import { webDarkTheme, webLightTheme } from '@fluentui/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ipf.theme-mode';

/**
 * Owns the app's light/dark state. Applies the genuine Fluent 2 theme via
 * `setTheme()` (which writes ~460 CSS custom properties) and mirrors the
 * resolved theme onto `<html data-theme>` so app-level SCSS can respond too.
 *
 * Three modes: explicit light, explicit dark, or `system` (follows
 * `prefers-color-scheme`). The shell shows a toggle; screenshots for the thesis
 * case-study chapter can be taken in either.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.readStoredMode());
  private readonly _systemDark = signal<boolean>(this.prefersDark());

  readonly mode = this._mode.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const mode = this._mode();
    if (mode === 'light' || mode === 'dark') return mode;
    return this._systemDark() ? 'dark' : 'light';
  });

  private mediaQuery?: MediaQueryList;
  private initialised = false;

  /** Called once from `provideFluent()` before the app renders. */
  init(): void {
    if (this.initialised || typeof window === 'undefined') return;
    this.initialised = true;

    if (typeof window.matchMedia === 'function') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', (e) =>
        this._systemDark.set(e.matches),
      );
    }

    this.apply(this.resolved());
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable — mode is still applied for this session */
    }
    this.apply(this.resolved());
  }

  /** light <-> dark, collapsing `system` to its current resolved value first. */
  toggle(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: ResolvedTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
    }
    // Lazy so unit tests (jsdom, no CSS.supports / adoptedStyleSheets) can use
    // ThemeService without pulling in Fluent's browser-only style utils.
    void import('@fluentui/web-components').then(({ setTheme }) => {
      setTheme(theme === 'dark' ? webDarkTheme : webLightTheme);
    });
  }

  private readStoredMode(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private prefersDark(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
}
