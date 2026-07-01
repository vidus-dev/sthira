import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createAuthApi, type SessionResponse, type SessionUser } from "../api/authApi";
import { createJsonHttpClient } from "../core/http/jsonHttpClient";
import { getExtraHeadersForApi, setCsrfToken } from "../core/http/csrfStore";
import { getApiBaseUrl, getDefaultTimeoutMs, isApiConfigured } from "../core/config";
import { ApiError } from "../core/api/ApiError";

type AuthContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyCsrfFromSession(s: SessionResponse): void {
  if (s.csrf_token) setCsrfToken(s.csrf_token);
  else if (!s.authenticated) setCsrfToken(null);
}

function createHttp() {
  return createJsonHttpClient({
    getBaseUrl: getApiBaseUrl,
    defaultTimeoutMs: getDefaultTimeoutMs(),
    getExtraHeaders: getExtraHeadersForApi,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const http = useMemo(() => createHttp(), []);
  const authApi = useMemo(() => createAuthApi(http), [http]);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const applySession = useCallback(async () => {
    if (!isApiConfigured()) {
      setUser(null);
      setCsrfToken(null);
      return;
    }
    try {
      const s = await authApi.session();
      applyCsrfFromSession(s);
      setUser(s.authenticated && s.user ? s.user : null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setUser(null);
        setCsrfToken(null);
        return;
      }
      setUser(null);
      setCsrfToken(null);
    }
  }, [authApi]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await applySession();
      if (!cancelled) setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await authApi.login(email, password);
      applyCsrfFromSession(s);
      setUser(s.authenticated && s.user ? s.user : null);
    },
    [authApi]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const s = await authApi.register(email, password);
      applyCsrfFromSession(s);
      setUser(s.authenticated && s.user ? s.user : null);
    },
    [authApi]
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* best-effort */
    }
    setCsrfToken(null);
    setUser(null);
  }, [authApi]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      signIn,
      register,
      signOut,
      refreshSession: applySession,
    }),
    [user, isHydrated, signIn, register, signOut, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
