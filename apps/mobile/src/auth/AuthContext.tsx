import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setUnauthorizedHandler } from "../api/client";
import { queryClient } from "../api/hooks";
import type { SessionResponse, SessionUser } from "../api/types";
import { ApiError } from "../core/api/ApiError";
import { isApiConfigured } from "../core/config";
import { setCsrfToken } from "../core/http/csrfStore";
import { markOnboardingPending } from "../features/onboarding/flag";

type AuthContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyCsrfFromSession(s: SessionResponse): void {
  if (s.csrf_token) setCsrfToken(s.csrf_token);
  else if (!s.authenticated) setCsrfToken(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const applySession = useCallback(async () => {
    if (!isApiConfigured()) {
      setUser(null);
      setCsrfToken(null);
      return;
    }
    try {
      const s = await api.auth.session();
      applyCsrfFromSession(s);
      setUser(s.authenticated && s.user ? s.user : null);
    } catch (e) {
      // Offline at launch: stay signed out of the UI but keep the cookie for next time.
      if (!(e instanceof ApiError) || e.status === 401 || e.status === 403) setCsrfToken(null);
      setUser(null);
    }
  }, []);

  // Session expired or the account was removed: go back to sign-in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCsrfToken(null);
      queryClient.clear();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await api.auth.login(email.trim(), password);
    applyCsrfFromSession(s);
    queryClient.clear();
    setUser(s.authenticated && s.user ? s.user : null);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const s = await api.auth.register(email.trim(), password, name.trim());
    applyCsrfFromSession(s);
    if (s.user) await markOnboardingPending(s.user.id);
    queryClient.clear();
    setUser(s.authenticated && s.user ? s.user : null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* best-effort */
    }
    setCsrfToken(null);
    queryClient.clear();
    setUser(null);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const updated = await api.auth.updateProfile(name.trim() || null);
    setUser(updated);
    await queryClient.invalidateQueries({ queryKey: ["household"] });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      signIn,
      register,
      signOut,
      refreshSession: applySession,
      updateName,
    }),
    [user, isHydrated, signIn, register, signOut, applySession, updateName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
