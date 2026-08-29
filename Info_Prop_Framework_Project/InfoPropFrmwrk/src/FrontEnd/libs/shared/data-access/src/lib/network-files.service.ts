import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@inf-prop/shared/api-client';

/**
 * `GET /files/<networkPath>/<network-relative path>` — reads one JSON file from
 * inside an uploaded network folder. The server concatenates the path segments,
 * so the full `networkPath` (`temp_uploads/<id>/<name>`) plus a network-relative
 * path works. Used for value-type enrichment and by the diamond-promotion flow
 * to re-read a scenario's own input files.
 */
@Injectable({ providedIn: 'root' })
export class NetworkFilesService {
  private readonly api = inject(ApiClient);

  read<T = unknown>(
    networkPath: string,
    networkRelativePath: string,
  ): Observable<T> {
    const joined = `${networkPath}/${networkRelativePath}`
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\//, '');
    return this.api.get<T>(`/files/${encodeURI(joined)}`);
  }
}
