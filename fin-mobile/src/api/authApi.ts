import type { JsonHttpClient } from "../core/http/jsonHttpClient";

export type SessionUser = { id: string; email?: string };

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
  csrf_token?: string | null;
};

export function createAuthApi(http: JsonHttpClient) {
  return {
    session(): Promise<SessionResponse> {
      return http.requestJson<SessionResponse>({ path: "/v1/auth/session", method: "GET" });
    },
    login(email: string, password: string): Promise<SessionResponse> {
      return http.requestJson<SessionResponse>({
        path: "/v1/auth/login",
        method: "POST",
        body: { email, password },
      });
    },
    register(email: string, password: string): Promise<SessionResponse> {
      return http.requestJson<SessionResponse>({
        path: "/v1/auth/register",
        method: "POST",
        body: { email, password },
      });
    },
    logout(): Promise<void> {
      return http.requestJson<void>({ path: "/v1/auth/logout", method: "POST" });
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
