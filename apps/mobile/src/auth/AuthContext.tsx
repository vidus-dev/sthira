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
import { setOutboxUser } from "../api/outbox";
import { queryClient } from "../api/hooks";
import { clearPersistedCache } from "../api/persist";
import type { SessionResponse, SessionUser } from "../api/types";
import { ApiError } from "../core/api/ApiError";
import { isApiConfigured } from "../core/config";
import { getCsrfToken, setCsrfToken } from "../core/http/csrfStore";
import { markOnboardingPending } from "../features/onboarding/flag";
import { clearCachedSession, loadCachedSession, saveCachedSession } from "./sessionCache";

type AuthContextValue = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Forgotten password: recovery key + new password; signs in on success. */
  resetPassword: (email: string, recoveryKey: string, newPassword: string) => Promise<void>;
  /** Re-read the signed-in user (e.g. after creating a recovery key). */
  setUserFields: (fields: Partial<SessionUser>) => void;
  refreshSession: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyCsrfFromSession(s: SessionResponse): void {
  if (s.csrf_token) setCsrfToken(s.csrf_token);
  else if (!s.authenticated) setCsrfToken(null);
}

/** Signed in: remember who, so the next launch opens straight to Home. */
function rememberUser(user: SessionUser): void {
  saveCachedSession(user, getCsrfToken());
}

/** Signed out for real: drop the session and everything cached for that user. */
function forgetUser(): void {
  setCsrfToken(null);
  queryClient.clear();
  clearPersistedCache();
  clearCachedSession();
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
      if (s.authenticated && s.user) {
        rememberUser(s.user);
        setUser(s.user);
      } else {
        forgetUser();
        setUser(null);
      }
    } catch (e) {
      // Only the server saying "not signed in" signs you out. Offline, a slow server or a
      // timeout keeps whoever was signed in (the cookie is still valid for next time).
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        forgetUser();
        setUser(null);
      }
    }
  }, []);

  // Session expired or the account was removed: go back to sign-in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      forgetUser();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedSession();
      if (cached) {
        // Open straight away as the remembered user; confirm with the server in the background.
        setCsrfToken(cached.csrf);
        if (!cancelled) {
          setUser(cached.user);
          setIsHydrated(true);
        }
        void applySession();
        return;
      }
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
    if (s.authenticated && s.user) rememberUser(s.user);
    setUser(s.authenticated && s.user ? s.user : null);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const s = await api.auth.register(email.trim(), password, name.trim());
    applyCsrfFromSession(s);
    if (s.user) await markOnboardingPending(s.user.id);
    queryClient.clear();
    if (s.authenticated && s.user) rememberUser(s.user);
    setUser(s.authenticated && s.user ? s.user : null);
  }, []);

  const resetPassword = useCallback(async (email: string, recoveryKey: string, newPassword: string) => {
    const s = await api.auth.resetPassword(email.trim(), recoveryKey.trim(), newPassword);
    applyCsrfFromSession(s);
    queryClient.clear();
    if (s.authenticated && s.user) rememberUser(s.user);
    setUser(s.authenticated && s.user ? s.user : null);
  }, []);

  const setUserFields = useCallback((fields: Partial<SessionUser>) => {
    setUser((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...fields };
      rememberUser(next);
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* best-effort */
    }
    forgetUser();
    setUser(null);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const updated = await api.auth.updateProfile(name.trim() || null);
    rememberUser(updated);
    setUser(updated);
    await queryClient.invalidateQueries({ queryKey: ["household"] });
  }, []);

  // Entries waiting on the phone go out for whoever is signed in.
  useEffect(() => {
    setOutboxUser(user?.id ?? null);
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      signIn,
      register,
      signOut,
      resetPassword,
      setUserFields,
      refreshSession: applySession,
      updateName,
    }),
    [user, isHydrated, signIn, register, signOut, resetPassword, setUserFields, applySession, updateName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
