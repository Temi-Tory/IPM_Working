import { ApiEnvelope } from './envelope';

/**
 * `POST /upload` — multipart/form-data, one part named `files` per file.
 * The interface invents no second format: the bytes uploaded are the bytes the
 * Julia package reads. A whole folder can be uploaded at once; the server sorts
 * files by the `<net>.EDGES` + `float|interval|pbox/` + `capacity/` + `cpm/`
 * naming convention.
 */
export interface UploadResponse extends ApiEnvelope {
  network_path: string;
  network_name: string;
  upload_id: string;
  files_count: number;
  uploaded_files: string[];
  edges_files: string[];
}
