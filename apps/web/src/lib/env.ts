/** Base URL for the modular monolith API (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "";
  return String(raw).trim().replace(/\/$/, "");
}

/**
 * Whether to call the real HTTP API.
 * - Non-empty `VITE_API_BASE_URL`: explicit backend (typical local `npm run dev`).
 * - Production build with empty base: same-origin `/v1/...` (Docker nginx proxy).
 */
export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl()) || import.meta.env.PROD;
}

/** Default request timeout in milliseconds (overridable via env). */
export function getApiDefaultTimeoutMs(): number {
  const raw = import.meta.env.VITE_API_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 25_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25_000;
}
