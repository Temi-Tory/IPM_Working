import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  IconComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';
import { ApiRequestError } from '@inf-prop/shared/api-client';
import {
  availableInputsFrom,
  ClassifiedUpload,
  classifyFiles,
  enrichValueTypes,
  NetworkContextService,
  RECOMMENDED_FOLDER_LAYOUT,
  UploadService,
} from '@inf-prop/shared/data-access';

@Component({
  selector: 'ipf-upload-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    PageHeaderComponent,
    CardComponent,
    IconComponent,
    ErrorBannerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './upload.page.html',
  styleUrl: './upload.page.scss',
})
export class UploadPage {
  private readonly uploadService = inject(UploadService);
  private readonly ctx = inject(NetworkContextService);
  private readonly router = inject(Router);

  protected readonly layout = RECOMMENDED_FOLDER_LAYOUT;
  protected readonly picked = signal<File[]>([]);
  protected readonly classified = signal<ClassifiedUpload | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly scenarioCount = computed(
    () => this.classified()?.scenarios.length ?? 0,
  );
  protected readonly analysisTotals = computed(() => {
    const c = this.classified();
    const t = { reliability: 0, flow: 0, schedule: 0 };
    for (const s of c?.scenarios ?? []) {
      for (const a of s.analyses) if (a.complete) t[a.kind]++;
    }
    return t;
  });
  protected readonly canUpload = computed(
    () =>
      !this.busy() &&
      (this.classified()?.edges != null || this.scenarioCount() > 0),
  );

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.picked.set(files);
    this.error.set(null);
    if (!files.length) {
      this.classified.set(null);
      return;
    }
    const upload = classifyFiles(files);
    this.classified.set(upload);
    // best-effort: read data_type from non-keyword scenario folders
    enrichValueTypes(upload).then((enriched) =>
      this.classified.set({ ...enriched }),
    );
  }

  protected submit(): void {
    const files = this.picked();
    if (!files.length) return;
    this.busy.set(true);
    this.error.set(null);
    this.uploadService.upload(files).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set(res.message || 'Upload failed');
          this.busy.set(false);
          return;
        }
        this.ctx.setContext({
          sessionId: res.upload_id,
          networkPath: res.network_path,
          networkName: res.network_name,
          edgesFilePath: res.edges_files?.[0],
        });
        this.ctx.setUploadFromPaths(res.network_name, res.uploaded_files ?? []);
        this.ctx.enrichScenarioValueTypes();
        const c = this.classified();
        this.ctx.setInputAvailability(
          c
            ? availableInputsFrom(c)
            : { reliability: false, flow: false, schedule: false },
        );
        this.ctx.loadStructure().subscribe({
          next: () => this.router.navigate(['/network']),
          error: (e: ApiRequestError) => {
            this.error.set(e.message);
            this.busy.set(false);
            this.router.navigate(['/network']);
          },
        });
      },
      error: (e: ApiRequestError) => {
        this.error.set(e.message);
        this.busy.set(false);
      },
    });
  }
}
