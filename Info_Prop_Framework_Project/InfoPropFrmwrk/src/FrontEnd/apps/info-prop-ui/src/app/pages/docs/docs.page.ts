import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { marked } from 'marked';
import {
  ErrorBannerComponent,
  IconComponent,
  IconName,
  LoadingStateComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';

interface DocsTocSection {
  id: string;
  title: string;
  icon: IconName;
  file: string;
  description: string;
  category: 'user' | 'developer';
}

interface DocsToc {
  title: string;
  sections: DocsTocSection[];
}

/**
 * In-app documentation — "the interface carries its own manual" (Front-End
 * chapter, §The Interface). Static content (markdown files + a `toc.json`
 * index under `public/docs/`, the same layout the pre-rebuild UI used) fetched
 * from the app's OWN origin, not the analysis server — this is help text
 * shipped with the front end, unrelated to `ApiClient`'s `:8080` endpoints.
 * Deliberately reachable with no network loaded: unlike a toolkit view, a
 * manual that only opens once you already have data defeats its own purpose.
 */
@Component({
  selector: 'ipf-docs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    IconComponent,
    LoadingStateComponent,
    ErrorBannerComponent,
  ],
  templateUrl: './docs.page.html',
  styleUrl: './docs.page.scss',
})
export class DocsPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** the `:topic` route segment — bound via `withComponentInputBinding()`. */
  readonly topic = input('overview');

  protected readonly toc = signal<DocsToc | null>(null);
  protected readonly tocError = signal<string | null>(null);

  protected readonly contentHtml = signal<string | null>(null);
  protected readonly loadingContent = signal(false);
  protected readonly contentError = signal<string | null>(null);

  protected readonly userSections = computed(
    () => this.toc()?.sections.filter((s) => s.category === 'user') ?? [],
  );
  protected readonly developerSections = computed(
    () =>
      this.toc()?.sections.filter((s) => s.category === 'developer') ?? [],
  );
  protected readonly activeSection = computed<DocsTocSection | null>(() => {
    const toc = this.toc();
    if (!toc) return null;
    return toc.sections.find((s) => s.id === this.topic()) ?? null;
  });

  constructor() {
    this.http.get<DocsToc>('docs/toc.json').subscribe({
      next: (toc) => this.toc.set(toc),
      error: () => this.tocError.set('Could not load the documentation index.'),
    });

    effect(() => {
      const section = this.activeSection();
      const toc = this.toc();
      untracked(() => {
        if (section) {
          this.loadContent(section);
        } else if (toc) {
          // toc loaded but the route's :topic matches nothing in it
          this.contentHtml.set(null);
          this.contentError.set(`No documentation topic named "${this.topic()}".`);
        }
      });
    });
  }

  /**
   * `[innerHTML]` content is raw DOM, not Angular template — an `<a>` inside
   * it is never a `routerLink`, so a cross-reference between two doc topics
   * would otherwise force a full page reload. Intercept clicks on same-origin
   * `/docs/...` links here and hand them to the router instead; anything else
   * (an external link, a same-page `#anchor`) is left to the browser.
   */
  protected onContentClick(ev: MouseEvent): void {
    const anchor = (ev.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/docs/')) return;
    ev.preventDefault();
    this.router.navigateByUrl(href);
  }

  private loadContent(section: DocsTocSection): void {
    this.loadingContent.set(true);
    this.contentError.set(null);
    this.http.get(`docs/${section.file}`, { responseType: 'text' }).subscribe({
      next: (markdown) => {
        this.loadingContent.set(false);
        this.contentHtml.set(marked.parse(markdown, { async: false }));
      },
      error: () => {
        this.loadingContent.set(false);
        this.contentError.set(`Could not load "${section.title}".`);
      },
    });
  }
}
