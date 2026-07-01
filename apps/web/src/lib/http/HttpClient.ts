export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Per-request timeout; falls back to client default. */
  timeoutMs?: number;
};

/**
 * Transport-only contract (Dependency Inversion).
 * Domain code depends on this interface; infrastructure provides `FetchHttpClient`.
 */
export interface HttpClient {
  requestJson<T>(req: HttpRequest): Promise<T>;
}
