import { ApiEnvelope } from './envelope';

/**
 * A session is nothing more than a folder holding the uploaded files plus a
 * plain JSON record of what has been computed. Deleting one is deleting a
 * folder. Nothing is held anywhere else.
 */
export interface SessionSummary {
  session_id: string;
  upload_id: string;
  network_name: string;
  network_path: string;
  /** ISO-ish timestamp string from the server (`updated_at` or `created_at`). */
  timestamp: string;
  has_analysis_results: boolean;
}

/** Full `session.json` document. Loosely typed — the server round-trips
 *  arbitrary client-owned state under a handful of well-known keys. */
export interface SessionMetadata {
  session_id: string;
  upload_id: string;
  network_name: string;
  network_path: string;
  uploaded_files: string[];
  edges_files: string[];
  created_at: string;
  updated_at: string;
  network_data: unknown | null;
  analysis_results: unknown | null;
  analysis_history: unknown[];
  parsed_data: unknown | null;
  file_manager_state: unknown | null;
  [key: string]: unknown;
}

/** `PUT /sessions/{id}` body — only the keys present are updated. */
export interface SessionUpdateRequest {
  network_path?: string;
  network_name?: string;
  network_data?: unknown | null;
  analysis_results?: unknown | null;
  analysis_history?: unknown[];
  parsed_data?: unknown | null;
  file_manager_state?: unknown | null;
}

export interface SessionListResponse extends ApiEnvelope {
  sessions: SessionSummary[];
}

export interface SessionItemResponse extends ApiEnvelope {
  session: SessionMetadata;
}
