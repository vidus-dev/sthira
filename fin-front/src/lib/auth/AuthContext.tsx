import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getHttpClient } from "@lib/http/configureHttpClient";
import { createLiveAuthCoordinator, type AuthMode } from "./liveAuthCoordinator";

const DEMO_SESSION_KEY = "finance-tracker-demo-session";

export type AuthContextValue = {
  isAuthenticated: boolean;
  mode: AuthMode;
  /** False until first `hydrate()` completes (avoid auth flash). */
  isHydrated: boolean;
  signInDemo: () => Promise<void>;
  signInWithApi: (email: string, password: string) => Promise<void>;
  registerWithApi: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const coordinator = useMemo(
    () =>
      createLiveAuthCoordinator({
        http: getHttpClient(),
        demoStorageKey: DEMO_SESSION_KEY,
      }),
    []
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<AuthMode>("none");
  const [isHydrated, setIsHydrated] = useState(false);

  const applyHydration = useCallback(async () => {
    const next = await coordinator.hydrate();
    setIsAuthenticated(next.isAuthenticated);
    setMode(next.mode);
  }, [coordinator]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await coordinator.hydrate();
      if (cancelled) return;
      setIsAuthenticated(next.isAuthenticated);
      setMode(next.mode);
      setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [coordinator]);

  const signInDemo = useCallback(async () => {
    await coordinator.signInDemo();
    setIsAuthenticated(true);
    setMode("demo");
  }, [coordinator]);

  const signInWithApi = useCallback(
    async (email: string, password: string) => {
      await coordinator.signInWithApi(email, password);
      await applyHydration();
    },
    [coordinator, applyHydration]
  );

  const registerWithApi = useCallback(
    async (email: string, password: string) => {
      await coordinator.registerWithApi(email, password);
      await applyHydration();
    },
    [coordinator, applyHydration]
  );

  const signOut = useCallback(async () => {
    await coordinator.signOut();
    setIsAuthenticated(false);
    setMode("none");
  }, [coordinator]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      mode,
      isHydrated,
      signInDemo,
      signInWithApi,
      registerWithApi,
      signOut,
    }),
    [isAuthenticated, mode, isHydrated, signInDemo, signInWithApi, registerWithApi, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
