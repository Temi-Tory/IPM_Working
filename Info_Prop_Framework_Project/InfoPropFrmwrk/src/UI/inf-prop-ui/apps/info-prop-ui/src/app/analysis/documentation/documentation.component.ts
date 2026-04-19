import { Component, OnInit, signal, computed, inject, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

interface TocSection {
  id: string;
  title: string;
  icon: string;
  file: string;
  description: string;
  category?: string;
}

interface Toc {
  title: string;
  version: string;
  lastUpdated: string;
  sections: TocSection[];
}

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './documentation.component.html',
  styleUrl: './documentation.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DocumentationComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  protected toc = signal<Toc | null>(null);
  protected activeSectionId = signal<string>('overview');
  protected renderedContent = signal<SafeHtml | null>(null);
  protected isLoadingToc = signal<boolean>(true);
  protected isLoadingContent = signal<boolean>(false);
  protected error = signal<string | null>(null);
  protected isSidebarCollapsed = signal<boolean>(false);

  protected activeSection = computed(() => {
    const tocData = this.toc();
    const activeId = this.activeSectionId();
    if (!tocData) return null;
    return tocData.sections.find(s => s.id === activeId) || null;
  });

  protected userSections = computed(() => {
    const tocData = this.toc();
    if (!tocData) return [];
    return tocData.sections.filter(s => s.category !== 'developer');
  });

  protected developerSections = computed(() => {
    const tocData = this.toc();
    if (!tocData) return [];
    return tocData.sections.filter(s => s.category === 'developer');
  });

  private contentCache = new Map<string, string>();

  ngOnInit() {
    // Configure marked with GFM and custom renderer
    marked.setOptions({
      gfm: true,
      breaks: false,
    });

    this.loadToc();

    // Listen for route fragment changes
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        this.activeSectionId.set(fragment);
        this.loadSection(fragment);
      }
    });
  }

  private loadToc() {
    this.isLoadingToc.set(true);
    this.http.get<Toc>('docs/toc.json').subscribe({
      next: (toc) => {
        this.toc.set(toc);
        this.isLoadingToc.set(false);

        // Load the active section or default to first
        const fragment = this.route.snapshot.fragment;
        const sectionId = fragment || toc.sections[0]?.id || 'overview';
        this.activeSectionId.set(sectionId);
        this.loadSection(sectionId);
      },
      error: (err) => {
        this.error.set('Failed to load documentation index.');
        this.isLoadingToc.set(false);
        console.error('Failed to load toc.json:', err);
      }
    });
  }

  protected navigateToSection(sectionId: string) {
    this.activeSectionId.set(sectionId);
    this.router.navigate([], { fragment: sectionId, relativeTo: this.route });
    this.loadSection(sectionId);
  }

  private loadSection(sectionId: string) {
    const tocData = this.toc();
    if (!tocData) return;

    const section = tocData.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Check cache first
    const cached = this.contentCache.get(sectionId);
    if (cached) {
      this.renderMarkdown(cached);
      return;
    }

    this.isLoadingContent.set(true);
    this.error.set(null);

    this.http.get(`docs/${section.file}`, { responseType: 'text' }).subscribe({
      next: (markdown) => {
        this.contentCache.set(sectionId, markdown);
        this.renderMarkdown(markdown);
        this.isLoadingContent.set(false);
      },
      error: (err) => {
        this.error.set(`Failed to load section: ${section.title}`);
        this.isLoadingContent.set(false);
        console.error(`Failed to load ${section.file}:`, err);
      }
    });
  }

  private renderMarkdown(markdown: string) {
    const html = marked.parse(markdown) as string;
    this.renderedContent.set(this.sanitizer.bypassSecurityTrustHtml(html));

    // Scroll to top of content area after render
    setTimeout(() => {
      const contentEl = document.querySelector('.doc-content-area');
      if (contentEl) contentEl.scrollTop = 0;
    }, 0);
  }

  protected toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }
}
