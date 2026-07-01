import { ApiError } from "@lib/api/ApiError";
import type { HttpClient, HttpRequest } from "./HttpClient";

export type FetchHttpClientOptions = {
  getBaseUrl: () => string;
  defaultTimeoutMs: number;
  credentials?: RequestCredentials;
  /** Merged into outgoing requests (e.g. X-CSRF-Token for mutating calls). */
  getExtraHeaders?: () => Record<string, string>;
};

function combineAbortSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  if (a.aborted || b.aborted) {
    const c = new AbortController();
    c.abort();
    return c.signal;
  }
  const composed = new AbortController();
  const forward = () => composed.abort();
  a.addEventListener("abort", forward, { once: true });
  b.addEventListener("abort", forward, { once: true });
  return composed.signal;
}

function newRequestId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHeaders(h: Record<string, string> | undefined): Record<string, string> {
  return h ? { ...h } : {};
}

/**
 * Production-oriented fetch adapter: timeouts, request IDs, JSON + problem bodies.
 */
export function createFetchHttpClient(options: FetchHttpClientOptions): HttpClient {
  const { getBaseUrl, defaultTimeoutMs, credentials = "include", getExtraHeaders } = options;

  return {
    async requestJson<T>(req: HttpRequest): Promise<T> {
      const base = getBaseUrl().replace(/\/$/, "");
      const path = req.path.startsWith("/") ? req.path : `/${req.path}`;
      /** Empty base = same-origin (e.g. Docker nginx proxying `/v1` to the API). */
      const url = base ? `${base}${path}` : path;
      const requestId = newRequestId();
      const timeoutMs = req.timeoutMs ?? defaultTimeoutMs;

      const timeoutController = new AbortController();
      const timer = window.setTimeout(() => timeoutController.abort(), timeoutMs);
      let timedOut = false;
      const onTimeout = () => {
        timedOut = true;
      };
      timeoutController.signal.addEventListener("abort", onTimeout, { once: true });

      const outerSignal = combineAbortSignals(timeoutController.signal, req.signal);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Request-Id": requestId,
        ...(getExtraHeaders?.() ?? {}),
        ...normalizeHeaders(req.headers),
      };
      if (req.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      let res: Response;
      try {
        res = await fetch(url, {
          method: req.method ?? "GET",
          credentials,
          headers,
          body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
          signal: outerSignal,
        });
      } catch (e) {
        if (outerSignal.aborted) {
          if (timedOut) throw ApiError.timeout(requestId);
          throw ApiError.aborted(requestId);
        }
        throw e;
      } finally {
        window.clearTimeout(timer);
      }

      const serverRequestId = res.headers.get("x-request-id") ?? requestId;

      if (!res.ok) {
        const text = await res.text();
        let parsed: unknown = text;
        try {
          parsed = text ? JSON.parse(text) : undefined;
        } catch {
          parsed = text;
        }
        throw ApiError.fromResponse(res, parsed, serverRequestId);
      }

      if (res.status === 204) return undefined as T;

      const ct = res.headers.get("content-type");
      if (!ct?.includes("application/json")) return undefined as T;

      return (await res.json()) as T;
    },
  };
}
