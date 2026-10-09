import { ApiError } from "../api/ApiError";

export type JsonRequest = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type JsonHttpClient = {
  requestJson<T>(req: JsonRequest): Promise<T>;
};

export function createJsonHttpClient(options: {
  getBaseUrl: () => string;
  credentials?: RequestCredentials;
  defaultTimeoutMs?: number;
  getExtraHeaders?: () => Record<string, string>;
  /** Called when the server says the session is gone (401), e.g. it expired. */
  onUnauthorized?: () => void;
}): JsonHttpClient {
  const credentials = options.credentials ?? "include";
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 25_000;
  const getExtraHeaders = options.getExtraHeaders;

  return {
    async requestJson<T>(req: JsonRequest): Promise<T> {
      const base = options.getBaseUrl().replace(/\/$/, "");
      if (!base) {
        throw new Error("Set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example).");
      }
      const path = req.path.startsWith("/") ? req.path : `/${req.path}`;
      const url = `${base}${path}`;
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(getExtraHeaders?.() ?? {}),
        ...(req.headers ?? {}),
      };
      if (req.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const timeoutMs = req.timeoutMs ?? defaultTimeoutMs;
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method: req.method ?? "GET",
          headers,
          body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
          credentials,
          signal: timeoutController.signal,
        });
      } catch (e) {
        if (timeoutController.signal.aborted) {
          throw new ApiError(0, "The server took too long to answer. Check your connection.");
        }
        throw new ApiError(0, "Can't reach the server. Check your internet connection.", e);
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 204) {
        return undefined as T;
      }
      const text = await res.text();
      if (!res.ok) {
        if (res.status === 401 && !path.startsWith("/v1/auth/")) options.onUnauthorized?.();
        let parsed: unknown = text;
        try {
          parsed = text ? JSON.parse(text) : undefined;
        } catch {
          parsed = text;
        }
        throw ApiError.fromResponse(res.status, parsed, res.statusText || "Request failed");
      }
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    },
  };
}
