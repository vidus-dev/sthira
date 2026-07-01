import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { setCsrfToken } from "@lib/http/csrfStore";
import type { HttpClient } from "@lib/http/HttpClient";
import { z } from "zod";

const AuthSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string(),
      email: z.string().optional(),
    })
    .optional(),
  csrf_token: z.string().optional(),
});

export type AuthMode = "none" | "demo" | "api";

export type AuthHydration = {
  isAuthenticated: boolean;
  mode: AuthMode;
};

/**
 * Session lifecycle without React (Single Responsibility / testable).
 */
export interface AuthCoordinator {
  hydrate(): Promise<AuthHydration>;
  signInDemo(): Promise<void>;
  signInWithApi(email: string, password: string): Promise<void>;
  registerWithApi(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

function applyCsrfFromBody(data: unknown): void {
  if (typeof data !== "object" || data === null) return;
  const t = (data as { csrf_token?: unknown }).csrf_token;
  if (typeof t === "string" && t.length > 0) {
    setCsrfToken(t);
  }
}

export function createLiveAuthCoordinator(deps: {
  http: HttpClient;
  demoStorageKey: string;
}): AuthCoordinator {
  const { http, demoStorageKey } = deps;

  const hasApi = () => isApiConfigured();

  const demoFallbackAllowed =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_AUTH === "true";

  return {
    async hydrate(): Promise<AuthHydration> {
      if (hasApi()) {
        try {
          const data = await http.requestJson<unknown>({
            path: "/v1/auth/session",
            method: "GET",
          });
          applyCsrfFromBody(data);
          const parsed = AuthSessionResponseSchema.safeParse(data);
          if (parsed.success) {
            if (parsed.data.authenticated) {
              return { isAuthenticated: true, mode: "api" };
            }
            /* API reachable and reports logged out — do not fall through to demo session. */
            setCsrfToken(null);
            return { isAuthenticated: false, mode: "none" };
          }
        } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            setCsrfToken(null);
            return { isAuthenticated: false, mode: "none" };
          }
          /* else: network / 5xx — never treat as authenticated */
        }
      }

      if (
        demoFallbackAllowed &&
        typeof window !== "undefined" &&
        window.localStorage.getItem(demoStorageKey) === "1"
      ) {
        return { isAuthenticated: true, mode: "demo" };
      }

      return { isAuthenticated: false, mode: "none" };
    },

    async signInDemo(): Promise<void> {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(demoStorageKey, "1");
      }
    },

    async signInWithApi(email: string, password: string): Promise<void> {
      if (!hasApi()) throw new Error("API is not configured (set VITE_API_BASE_URL for local Vite).");
      const data = await http.requestJson<unknown>({
        path: "/v1/auth/login",
        method: "POST",
        body: { email, password },
      });
      applyCsrfFromBody(data);
    },

    async registerWithApi(email: string, password: string): Promise<void> {
      if (!hasApi()) throw new Error("API is not configured (set VITE_API_BASE_URL for local Vite).");
      const data = await http.requestJson<unknown>({
        path: "/v1/auth/register",
        method: "POST",
        body: { email, password },
      });
      applyCsrfFromBody(data);
    },

    async signOut(): Promise<void> {
      setCsrfToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(demoStorageKey);
      }
      if (hasApi()) {
        try {
          await http.requestJson<unknown>({
            path: "/v1/auth/logout",
            method: "POST",
          });
        } catch {
          /* best-effort logout */
        }
      }
    },
  };
}
