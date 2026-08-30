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

  /** resolves once the current `classified` signal has its real, locally-read
   *  value types — `submit()` awaits this so it never ships a guess. */
  private enrichment: Promise<ClassifiedUpload> | null = null;

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.picked.set(files);
    this.error.set(null);
    if (!files.length) {
      this.classified.set(null);
      this.enrichment = null;
      return;
    }
    const upload = classifyFiles(files);
    this.classified.set(upload);
    // reads each scenario's own data_type from the real local File — no
    // guessing, no network round-trip. submit() waits for this to settle.
    this.enrichment = enrichValueTypes(upload).then((enriched) => {
      const withCopy = { ...enriched };
      this.classified.set(withCopy);
      return withCopy;
    });
  }

  protected async submit(): Promise<void> {
    const files = this.picked();
    if (!files.length) return;
    this.busy.set(true);
    this.error.set(null);
    // wait for the local value-type read to finish so what we hand to
    // NetworkContextService (and thus every feature page) is never a guess
    const enriched = await this.enrichment;
    if (enriched) this.classified.set(enriched);
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
        // Use the already-classified upload directly — we had the real local
        // File objects and `enrichValueTypes()` already read each scenario's
        // true data_type from them. Re-deriving via setUploadFromPaths() would
        // throw that away and re-guess from bare path strings (wrong until an
        // async /files/ round-trip resolves, or wrong forever if it 404s).
        const c = this.classified();
        if (c) {
          this.ctx.setUpload(c);
        } else {
          this.ctx.setUploadFromPaths(res.network_name, res.uploaded_files ?? []);
        }
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
