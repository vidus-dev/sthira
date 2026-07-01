/**
 * Runtime config (Expo injects `EXPO_PUBLIC_*` at bundle time).
 * Android emulator: use `http://10.0.2.2:8000` to reach host machine's localhost.
 * Use the same hostname (localhost vs 127.0.0.1) as your backend CORS + cookie SameSite expects.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  return String(raw).trim().replace(/\/$/, "");
}

export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}

export function getDefaultTimeoutMs(): number {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 25_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25_000;
}
