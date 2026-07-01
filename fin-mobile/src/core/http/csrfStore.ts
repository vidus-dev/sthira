/** CSRF token from session/login — sent as X-CSRF-Token on mutating API calls. */

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token && token.length > 0 ? token : null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function getExtraHeadersForApi(): Record<string, string> {
  const t = csrfToken;
  if (!t) return {};
  return { "X-CSRF-Token": t };
}
