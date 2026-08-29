import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, UploadResponse } from '@inf-prop/shared/api-client';

/**
 * `POST /upload`. One `files` part per file. A `File` with a `webkitRelativePath`
 * (folder upload) keeps its relative path so the server can apply the naming
 * convention. The diamond-promotion feature also uses this: it serialises a
 * subgraph to `File` objects in the same format and feeds them here.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly api = inject(ApiClient);

  upload(files: Iterable<File>): Observable<UploadResponse> {
    const form = new FormData();
    for (const file of files) {
      const name =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      form.append('files', file, name);
    }
    return this.api.postForm<UploadResponse>('/upload', form);
  }
}
