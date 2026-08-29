import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  CardComponent,
  IconComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';
import {
  ApiClient,
  SessionSummary,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  NetworkSessionService,
} from '@inf-prop/shared/data-access';

@Component({
  selector: 'ipf-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    DatePipe,
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
