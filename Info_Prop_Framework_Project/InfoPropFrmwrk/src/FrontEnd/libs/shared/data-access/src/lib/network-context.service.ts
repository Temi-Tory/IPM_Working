import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  NetworkStructure,
  NetworkStructureRequest,
  ToolkitKind,
} from '@inf-prop/shared/api-client';
import { firstValueFrom } from 'rxjs';
import { NetworkStructureService } from './network-structure.service';
import { NetworkSessionService } from './network-session.service';
import { NetworkFilesService } from './network-files.service';
import {
  AnalysisKind,
  ClassifiedUpload,
  Scenario,
  ScenarioAnalysis,
  availableInputsFrom,
  classifyPaths,
  enrichValueTypesWith,
  scenariosFor,
} from './file-convention';

/**
 * "A network is loaded" — the one piece of state every feature track reads.
 * Holds the active network path + its computed structure, and derives which
 * pipeline steps are unlocked.
 *
 * Guided but not gated: a step unlocks when the data it needs exists, but any
 * unlocked step is reachable directly. This service exposes the unlock state;
 * the shell's router/nav enforces nothing beyond disabling links that are not
 * yet reachable.
 */

export interface AnalysisInputAvailability {
  /** reachability needs both nodepriors and linkprobs for at least one scenario */
  reliability: boolean;
  /** flow needs a capacities file */
  flow: boolean;
  /** schedule needs a cpm-inputs file */
  schedule: boolean;
}

export interface NetworkContext {
  sessionId: string;
  networkPath: string;
  networkName: string;
  edgesFilePath?: string;
}

@Injectable({ providedIn: 'root' })
export class NetworkContextService {
  private readonly structureService = inject(NetworkStructureService);
  private readonly sessions = inject(NetworkSessionService);
  private readonly files = inject(NetworkFilesService);

  private readonly _context = signal<NetworkContext | null>(null);
  private readonly _structure = signal<NetworkStructure | null>(null);
  private readonly _inputs = signal<AnalysisInputAvailability>({
    reliability: false,
    flow: false,
    schedule: false,
  });
  private readonly _upload = signal<ClassifiedUpload | null>(null);
  private readonly _structureLoading = signal(false);

  readonly context = this._context.asReadonly();
  readonly structure = this._structure.asReadonly();
  readonly inputs = this._inputs.asReadonly();
  readonly structureLoading = this._structureLoading.asReadonly();

  /** Every scenario (named operating case) the loaded network carries. */
  readonly scenarios = computed<Scenario[]>(() => this._upload()?.scenarios ?? []);

  readonly isLoaded = computed(() => this._context() !== null);
  readonly hasStructure = computed(() => this._structure() !== null);

  /** Which toolkits are reachable right now, given the loaded inputs. */
  readonly unlockedToolkits = computed<Record<ToolkitKind, boolean>>(() => {
    const i = this._inputs();
    return { reliability: i.reliability, flow: i.flow, schedule: i.schedule };
  });

  setContext(ctx: NetworkContext | null): void {
    this._context.set(ctx);
    if (!ctx) {
      this._structure.set(null);
      this._upload.set(null);
      this._inputs.set({ reliability: false, flow: false, schedule: false });
    }
  }

  setInputAvailability(inputs: Partial<AnalysisInputAvailability>): void {
    this._inputs.update((cur) => ({ ...cur, ...inputs }));
  }

  /**
   * Record the loaded network's scenario structure from the server's returned
   * file paths (`UploadResponse.uploaded_files` or a session's list). Also
   * refreshes toolkit-unlock state. Call `enrichScenarioValueTypes()` after
   * this to resolve the value type of operating-case scenario folders.
   */
  setUploadFromPaths(networkName: string, paths: readonly string[]): void {
    const upload = classifyPaths(networkName, paths);
    this._upload.set(upload);
    this._inputs.set(availableInputsFrom(upload));
  }

  /**
   * Best-effort: for scenarios whose folder name is not a value-form keyword
   * (e.g. "Interval Conservative"), read `data_type` from the scenario's own
   * input file via `GET /files/` and correct the value-type pre-selection.
   * Fire-and-forget; the analysis response's `value_type` is authoritative.
   * The two entry-point pages call this after `setUploadFromPaths`.
   */
  enrichScenarioValueTypes(): void {
    const ctx = this._context();
    const upload = this._upload();
    if (!ctx || !upload) return;
    const needsEnrich = upload.scenarios.some(
      (s) => !s.folderValueType && s.analyses.some((a) => a.kind !== 'flow'),
    );
    if (!needsEnrich) return;
    void enrichValueTypesWith(upload, (rel) =>
      firstValueFrom(
        this.files.read<{ data_type?: unknown }>(ctx.networkPath, rel),
      ),
    )
      .then((u) => this._upload.set({ ...u }))
      .catch(() => void 0);
  }

  setUpload(upload: ClassifiedUpload | null): void {
    this._upload.set(upload);
    if (upload) this._inputs.set(availableInputsFrom(upload));
  }

  /** Scenarios that can feed a given analysis (complete inputs only). */
  scenariosFor(
    kind: AnalysisKind,
  ): Array<{ scenario: Scenario; analysis: ScenarioAnalysis }> {
    const upload = this._upload();
    return upload ? scenariosFor(upload, kind) : [];
  }

  /** Load (or reload) the graph structure for the active network. */
  loadStructure(): Observable<NetworkStructure> {
    const ctx = this._context();
    if (!ctx) {
      throw new Error('No network context set — cannot load structure.');
    }
    const request: NetworkStructureRequest = {
      networkPath: ctx.networkPath,
      edgesFilePath: ctx.edgesFilePath,
    };
    this._structureLoading.set(true);
    return this.structureService.structure(request).pipe(
      tap({
        next: (s) => {
          this._structure.set(s);
          this._structureLoading.set(false);
        },
        error: () => this._structureLoading.set(false),
      }),
    );
  }

  reset(): void {
    this.setContext(null);
    this.sessions.clearCurrent();
  }
}
