import { Component, inject, OnInit, signal, computed, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { marked } from 'marked';

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './documentation.component.html',
  styleUrls: ['./documentation.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DocumentationComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private readonly apiUrl = 'http://localhost:8080';

  status = signal<'loading' | 'loaded' | 'error'>('loading');
  errorMessage = signal('');
  renderedHtml = signal<SafeHtml>('');
  tocEntries = signal<TocEntry[]>([]);
  activeHeadingId = signal('');
  sidebarCollapsed = signal(false);

  hasToc = computed(() => this.tocEntries().length > 0);

  ngOnInit(): void {
    this.loadDocumentation();
  }

  loadDocumentation(): void {
    this.status.set('loading');
    this.http.get(`${this.apiUrl}/docs/documentation.md`, { responseType: 'text' })
      .subscribe({
        next: (markdown) => {
          this.parseAndRender(markdown);
          this.status.set('loaded');
        },
        error: (err) => {
          console.error('Failed to load documentation:', err);
          this.errorMessage.set('Could not load documentation. Ensure the backend server is running.');
          this.status.set('error');
        }
      });
  }

  private parseAndRender(markdown: string): void {
    // Extract headings for ToC
    const headings: TocEntry[] = [];
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, '').trim();
      const id = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      headings.push({ id, text, level });
    }
    this.tocEntries.set(headings);

    // Configure marked with heading IDs
    const renderer = new marked.Renderer();
    renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
      const cleanText = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim();
      const id = cleanText.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    };

    const html = marked.parse(markdown, { renderer, async: false }) as string;
    this.renderedHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  scrollToSection(id: string): void {
    this.activeHeadingId.set(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToTop(): void {
    const content = document.querySelector('.doc-content');
    if (content) {
      content.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }
}
