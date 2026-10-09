import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { usePalette } from "../../theme/ThemeProvider";
import { Button } from "../../ui/controls";
import { Icon } from "../../ui/Icon";
import { Txt } from "../../ui/Txt";

const KEY = "sthira.appLock";
/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

type Ctx = { enabled: boolean; available: boolean; setEnabled: (v: boolean) => Promise<boolean> };
const LockContext = createContext<Ctx>({ enabled: false, available: false, setEnabled: async () => false });

export const useAppLock = () => useContext(LockContext);

async function unlock(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Sthira",
    cancelLabel: "Cancel",
  });
  return result.success;
}

/** Optional fingerprint / face lock over the whole app. */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
      setAvailable(Boolean(enrolled));
      const on = (await AsyncStorage.getItem(KEY).catch(() => null)) === "1";
      setEnabledState(on && Boolean(enrolled));
      if (on && enrolled) setLocked(true);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (!enabled) return;
      if (next === "background") backgroundedAt.current = Date.now();
      if (next === "active" && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (locked) unlock().then((ok) => ok && setLocked(false)).catch(() => {});
  }, [locked]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v && !(await unlock())) return false;
    setEnabledState(v);
    await AsyncStorage.setItem(KEY, v ? "1" : "0").catch(() => {});
    return true;
  }, []);

  return (
    <LockContext.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {locked ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Icon name="fingerprint" size={44} color={palette.text} strokeWidth={1.3} />
          <Txt variant="section">Sthira is locked</Txt>
          <Button label="Unlock" onPress={() => unlock().then((ok) => ok && setLocked(false))} />
        </View>
      ) : null}
    </LockContext.Provider>
  );
}
