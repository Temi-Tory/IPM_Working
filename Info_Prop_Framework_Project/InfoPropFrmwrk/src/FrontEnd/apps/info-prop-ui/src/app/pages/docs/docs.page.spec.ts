import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DocsPage } from './docs.page';

const TOC = {
  title: 'Docs',
  version: '1.0.0',
  lastUpdated: '2026-08-30',
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'info',
      file: 'overview.md',
      description: 'x',
      category: 'user',
    },
    {
      id: 'glossary',
      title: 'Glossary',
      icon: 'list',
      file: 'glossary.md',
      description: 'x',
      category: 'user',
    },
    {
      id: 'developer',
      title: 'Developer Reference',
      icon: 'settings',
      file: 'developer.md',
      description: 'x',
      category: 'developer',
    },
  ],
};

describe('DocsPage', () => {
  let fixture: ComponentFixture<DocsPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsPage],
      providers: [
        // a real match for 'docs/:topic' — `onContentClick` calls
        // `router.navigateByUrl`, which rejects (an unhandled rejection,
        // since nothing awaits it) against an empty route config
        provideRouter([{ path: 'docs/:topic', component: DocsPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DocsPage);
    http = TestBed.inject(HttpTestingController);
  });

  function flushToc() {
    http.expectOne('docs/toc.json').flush(TOC);
    // the content-loading effect only reruns on the next change-detection
    // pass after `toc` is set — every caller needs it flushed before it can
    // expect the topic's own markdown request to exist yet
    fixture.detectChanges();
  }

  it('loads the toc and the default topic\'s content', () => {
    fixture.detectChanges();
    flushToc();

    http.expectOne('docs/overview.md').flush('# Overview\n\nSome text.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // scoped to .markdown — ipf-page-header renders its own <h1> too
    expect(el.querySelector('.markdown h1')?.textContent).toBe('Overview');
    expect(el.textContent).toContain('Some text.');
  });

  it('groups the sidebar into user and developer sections', () => {
    fixture.detectChanges();
    flushToc();
    http.expectOne('docs/overview.md').flush('# Overview');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const groupLabels = Array.from(el.querySelectorAll('.group-label')).map(
      (n) => n.textContent,
    );
    expect(groupLabels).toEqual(['User guide', 'Developer reference']);
    expect(el.querySelectorAll('.toc a').length).toBe(3);
  });

  it('loads a different topic when the :topic input changes', () => {
    fixture.detectChanges();
    flushToc();
    http.expectOne('docs/overview.md').flush('# Overview');
    fixture.detectChanges();

    fixture.componentRef.setInput('topic', 'glossary');
    fixture.detectChanges();
    http.expectOne('docs/glossary.md').flush('# Glossary\n\nTerms.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.markdown h1')?.textContent).toBe('Glossary');
  });

  it('shows an error for a :topic that matches nothing in the toc', () => {
    fixture.componentRef.setInput('topic', 'not-a-real-topic');
    fixture.detectChanges();
    flushToc();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No documentation topic named');
    http.expectNone('docs/undefined');
  });

  it('shows an error banner when the toc itself fails to load', () => {
    fixture.detectChanges();
    http.expectOne('docs/toc.json').flush('', {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Could not load the documentation index');
  });

  // `onContentClick` is exercised directly, with a synthetic event carrying a
  // detached-from-nothing `target`/`preventDefault` pair, rather than by
  // dispatching a real click on a live, DOM-attached <a> — jsdom attempts an
  // actual (unimplemented) page navigation for a genuine anchor click, which
  // fails asynchronously after the test has already torn down.
  function fakeClick(target: Element): { event: MouseEvent; prevented: () => boolean } {
    let prevented = false;
    const event = {
      target,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as MouseEvent;
    return { event, prevented: () => prevented };
  }

  function onContentClick(f: ComponentFixture<DocsPage>, event: MouseEvent): void {
    (f.componentInstance as unknown as { onContentClick: (e: MouseEvent) => void })
      .onContentClick(event);
  }

  it('intercepts a click on an internal /docs/ link — preventDefault, no full reload', () => {
    fixture.detectChanges();
    flushToc();
    http
      .expectOne('docs/overview.md')
      .flush('<p><a href="/docs/glossary">Glossary</a></p>');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const anchor = el.querySelector('a[href="/docs/glossary"]');
    expect(anchor).toBeTruthy();

    const { event, prevented } = fakeClick(anchor as Element);
    onContentClick(fixture, event);

    // the router takes over instead of the browser following the href
    expect(prevented()).toBe(true);
  });

  it('leaves an external link alone — no preventDefault', () => {
    fixture.detectChanges();
    flushToc();
    http
      .expectOne('docs/overview.md')
      .flush('<p><a href="https://example.com">External</a></p>');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const anchor = el.querySelector('a[href="https://example.com"]');
    expect(anchor).toBeTruthy();

    const { event, prevented } = fakeClick(anchor as Element);
    onContentClick(fixture, event);

    expect(prevented()).toBe(false);
  });
});
