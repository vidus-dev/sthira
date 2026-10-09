import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "../../auth/AuthContext";
import { usePalette } from "../../theme/ThemeProvider";
import { Button } from "../../ui/controls";
import { Icon } from "../../ui/Icon";
import { Txt } from "../../ui/Txt";

/** "1" on, "0" off; missing means the default (on whenever the phone has a screen lock). */
const KEY = "sthira.appLock";
/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

type Ctx = { enabled: boolean; available: boolean; setEnabled: (v: boolean) => Promise<boolean> };
const LockContext = createContext<Ctx>({ enabled: false, available: false, setEnabled: async () => false });

export const useAppLock = () => useContext(LockContext);

/** Fingerprint or face, falling back to the phone's PIN / pattern / password. */
async function unlock(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Sthira",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Any screen lock counts: a PIN or pattern is enough even without a fingerprint. */
async function deviceIsSecured(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync().catch(
    () => LocalAuthentication.SecurityLevel.NONE
  );
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/**
 * Locks the app behind fingerprint / face / phone PIN while you stay signed in. On by
 * default when the phone has a screen lock; it can be turned off in Settings.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const { user, isHydrated } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  /** Whether this launch starts locked; decided once both prefs and the session are known. */
  const [decided, setDecided] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  useEffect(() => {
    void (async () => {
      const secured = await deviceIsSecured();
      setAvailable(secured);
      const pref = await AsyncStorage.getItem(KEY).catch(() => null);
      setEnabledState(secured && pref !== "0");
      setPrefsLoaded(true);
    })();
  }, []);

  // Lock at launch only for a remembered sign-in. Signing in later (with the password)
  // doesn't trigger the lock.
  useEffect(() => {
    if (decided || !prefsLoaded || !isHydrated) return;
    setLocked(enabled && Boolean(user));
    setDecided(true);
  }, [decided, prefsLoaded, isHydrated, enabled, user]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (!enabled) return;
      if (next === "background") backgroundedAt.current = Date.now();
      if (next === "active" && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await unlock()) setLocked(false);
    } catch {
      /* stays locked; the Unlock button tries again */
    } finally {
      prompting.current = false;
    }
  }, []);

  // Only signed-in sessions need guarding; the sign-in screen has its own password.
  const showLock = locked && Boolean(user);
  // Cover the screen for the moment before the launch decision, so Home never flashes.
  const pending = !decided && Boolean(user);

  useEffect(() => {
    if (showLock) void tryUnlock();
  }, [showLock, tryUnlock]);

  // Signed out (or the session expired) while locked: nothing left to guard.
  useEffect(() => {
    if (!user) setLocked(false);
  }, [user]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v && !(await unlock())) return false;
    setEnabledState(v);
    await AsyncStorage.setItem(KEY, v ? "1" : "0").catch(() => {});
    return true;
  }, []);

  return (
    <LockContext.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {showLock ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Icon name="fingerprint" size={44} color={palette.text} strokeWidth={1.3} />
          <Txt variant="section">Sthira is locked</Txt>
          <Txt variant="caption" tone="faint">
            Use your fingerprint or phone PIN
          </Txt>
          <Button label="Unlock" onPress={() => void tryUnlock()} />
        </View>
      ) : pending ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: palette.bg }} />
      ) : null}
    </LockContext.Provider>
  );
}
