import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  CardComponent,
  IconComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';
import {
  ApiClient,
  isLocalHost,
  SessionSummary,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  NetworkSessionService,
} from '@inf-prop/shared/data-access';

const COLLAPSED_KEY = 'ipf.home.collapsedGroups';

function loadCollapsed(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

@Component({
  selector: 'ipf-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    PageHeaderComponent,
    CardComponent,
    IconComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly api = inject(ApiClient);
  private readonly sessionService = inject(NetworkSessionService);
  private readonly ctx = inject(NetworkContextService);
  private readonly router = inject(Router);

  protected readonly sessions = this.sessionService.sessions;
  protected readonly local = isLocalHost();

  /** Preloaded examples grouped by `group` (ordered by `group_order`); uploads stay a flat recent list. */
  protected readonly exampleGroups = computed(() => {
    const groups = new Map<string, { order: number; items: SessionSummary[] }>();
    for (const s of this.sessions()) {
      if (!s.protected) continue;
      const name = s.group || 'Examples';
      const g = groups.get(name) ?? { order: Infinity, items: [] };
      g.items.push(s);
      g.order = Math.min(g.order, s.group_order ?? Infinity);
      groups.set(name, g);
    }
    return [...groups]
      .map(([name, g]) => ({
        name,
        order: g.order,
        items: [...g.items].sort((a, b) =>
          a.network_name.localeCompare(b.network_name),
        ),
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  });
  protected readonly uploads = computed(() =>
    this.sessions().filter((s) => !s.protected),
  );

  /** Example groups the viewer has folded; remembered per browser. */
  protected readonly collapsed = signal<ReadonlySet<string>>(loadCollapsed());

  protected toggleGroup(name: string): void {
    const next = new Set(this.collapsed());
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.setCollapsed(next);
  }

  protected setAllGroups(collapse: boolean): void {
    this.setCollapsed(
      collapse ? new Set(this.exampleGroups().map((g) => g.name)) : new Set(),
    );
  }

  private setCollapsed(next: Set<string>): void {
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable (private mode etc.) — state just isn't remembered */
    }
  }
  protected readonly serverStatus = signal<'checking' | 'up' | 'down'>(
    'checking',
  );
  protected readonly opening = signal<string | null>(null);

  constructor() {
    this.api.health().subscribe({
      next: () => this.serverStatus.set('up'),
      error: () => this.serverStatus.set('down'),
    });
    this.sessionService.list().subscribe({ error: () => void 0 });
  }

  protected open(session: SessionSummary): void {
    this.opening.set(session.session_id);
    this.sessionService.open(session.session_id).subscribe({
      next: (meta) => {
        this.ctx.setContext({
          sessionId: meta.session_id,
          networkPath: meta.network_path,
          networkName: meta.network_name,
          edgesFilePath: meta.edges_files?.[0],
        });
        this.ctx.setUploadFromPaths(
          meta.network_name,
          meta.uploaded_files ?? [],
        );
        this.ctx.enrichScenarioValueTypes();
        this.ctx.loadStructure().subscribe({
          next: () => this.router.navigate(['/network']),
          error: () => this.router.navigate(['/network']),
        });
      },
      error: () => this.opening.set(null),
    });
  }
}
