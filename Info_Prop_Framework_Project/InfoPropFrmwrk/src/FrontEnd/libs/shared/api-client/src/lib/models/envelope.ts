/**
 * Every server response is a JSON object with at least `success` and `message`.
 * Analysis responses additionally carry `endpoint` and `timestamp` and a
 * result object whose key is analysis-specific (`probability_result`,
 * `capacity_result`, `critical_path_result`, `diamond_analysis`, ...).
 */
export interface ApiEnvelope {
  success: boolean;
  message: string;
}

export interface AnalysisEnvelope extends ApiEnvelope {
  endpoint: string;
  timestamp: string;
}

/** Shape of a non-2xx body from `ServerCommon.error_response`. */
export interface ApiError extends ApiEnvelope {
  success: false;
  error?: string;
  request_id?: string;
  debug?: {
    request_id: string;
    timestamp: string;
    status: number;
    method: string;
    target: string;
    exception_type: string;
    exception_message: string;
    stacktrace: Array<{
      file: string;
      line: number;
      func: string;
      inlined: boolean;
      from_c: boolean;
    }>;
  };
}

export function isApiError(body: unknown): body is ApiError {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as ApiEnvelope).success === false &&
    typeof (body as ApiEnvelope).message === 'string'
  );
}
