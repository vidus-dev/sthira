import type { HttpMethod } from "./HttpClient";
import { getHttpClient } from "./configureHttpClient";

function headersFromInit(h: HeadersInit | undefined): Record<string, string> | undefined {
  if (!h) return undefined;
  if (h instanceof Headers) {
    const o: Record<string, string> = {};
    h.forEach((v, k) => {
      o[k] = v;
    });
    return o;
  }
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...h };
}

/**
 * Bridge for code that still passes `RequestInit` (method/body/headers/signal).
 * Prefer `getHttpClient().requestJson({ ... })` in new code.
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method?.toUpperCase() as HttpMethod | undefined) ?? "GET";
  let body: unknown = undefined;
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else {
      body = init.body;
    }
  }
  return getHttpClient().requestJson<T>({
    path,
    method,
    body: method === "GET" || method === "DELETE" ? undefined : body,
    headers: headersFromInit(init?.headers),
    signal: init?.signal ?? undefined,
  });
}
