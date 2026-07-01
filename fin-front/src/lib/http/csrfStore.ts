/** CSRF token from GET /v1/auth/session or login/register — sent as X-CSRF-Token on writes. */

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token && token.length > 0 ? token : null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Merged into mutating API requests by the fetch HTTP client. */
export function getExtraHeadersForApi(): Record<string, string> {
  const t = csrfToken;
  if (!t) return {};
  return { "X-CSRF-Token": t };
}
