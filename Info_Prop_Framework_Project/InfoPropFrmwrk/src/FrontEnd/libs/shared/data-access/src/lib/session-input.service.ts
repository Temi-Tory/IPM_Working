import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { UploadResponse } from '@inf-prop/shared/api-client';
import { NetworkContextService } from './network-context.service';
import { NetworkFilesService } from './network-files.service';
import { UploadService } from './upload.service';
import { ClassifiedFile, classifyFiles } from './file-convention';
import { buildEdgesFileContent, toUploadFile } from './session-input-files';

/**
 * Adds a brand-new scenario (manually-entered inputs, from the missing-inputs
 * editor) to the loaded network WITHOUT losing whatever the session already
 * has. `/upload` always creates a fresh session (there is no "add to an
 * existing session" endpoint — confirmed in `UploadHandlers.jl`), so adding
 * one file means re-uploading everything: the existing scenario files
 * (re-fetched via `GET /files/…`, the same route diamond-promotion already
 * relies on) plus the newly-authored one(s).
 *
 * The `.EDGES` file is the one exception: `/files/…` only serves JSON and
 * 500s on it (a real, separately-tracked server bug), so it is rebuilt
 * locally from `ctx.structure()` (already loaded, already the parsed edge
 * list) rather than re-fetched — sidesteps the bug rather than needing it
 * fixed first.
 */
@Injectable({ providedIn: 'root' })
export class SessionInputService {
  private readonly ctx = inject(NetworkContextService);
  private readonly files = inject(NetworkFilesService);
  private readonly uploads = inject(UploadService);

  /**
   * Every file the current session already has, rebuilt as `File` objects
   * with their original network-relative path. Files with an unrecognised
   * role (e.g. a node-mapping text file) are skipped — they aren't
   * guaranteed to be JSON, and `/files/…` only serves JSON.
   */
  rebuildExistingFiles(): Observable<File[]> {
    const ctx = this.ctx.context();
    const structure = this.ctx.structure();
    const upload = this.ctx.upload();
    if (!ctx) return of([]);

    const edgesFile = structure
      ? toUploadFile(
          `${ctx.networkName}/${ctx.edgesFilePath ?? `${ctx.networkName}.EDGES`}`,
          buildEdgesFileContent(structure.edges),
          'text/plain',
        )
      : null;

    const known: ClassifiedFile[] = (upload?.scenarios ?? []).flatMap((s) =>
      s.analyses.flatMap((a) => a.files),
    );
    // de-dupe — a file can be referenced by more than one analysis kind
    // (e.g. an operating-case folder carrying reliability AND flow inputs)
    const seen = new Map<string, ClassifiedFile>();
    for (const f of known) seen.set(f.networkRelativePath, f);

    const fetches = [...seen.values()].map((f) =>
      this.files.read<unknown>(ctx.networkPath, f.networkRelativePath).pipe(
        map((parsed) =>
          toUploadFile(
            `${ctx.networkName}/${f.networkRelativePath}`,
            JSON.stringify(parsed, null, 2),
            'application/json',
          ),
        ),
      ),
    );

    const rest$ = fetches.length ? forkJoin(fetches) : of([] as File[]);
    return rest$.pipe(
      map((rest) => (edgesFile ? [edgesFile, ...rest] : rest)),
    );
  }

  /**
   * Rebuild the existing session, add `newFiles` under a new scenario
   * folder, upload the lot as a fresh session, and switch the app's context
   * to it. `newFiles` are built by the caller with `session-input-files.ts`'s
   * content builders + `toUploadFile`, already under
   * `<network>/<scenarioName>/...`.
   */
  addScenario(newFiles: File[]): Observable<UploadResponse> {
    return this.rebuildExistingFiles().pipe(
      switchMap((existing) => {
        const all = [...existing, ...newFiles];
        return this.uploads.upload(all).pipe(
          tap((res) => {
            if (!res.success) return;
            this.ctx.setContext({
              sessionId: res.upload_id,
              networkPath: res.network_path,
              networkName: res.network_name,
              edgesFilePath: res.edges_files?.[0],
            });
            this.ctx.setUpload(classifyFiles(all));
          }),
        );
      }),
    );
  }
}
