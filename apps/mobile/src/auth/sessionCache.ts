/**
 * The last signed-in user, remembered on the device so the app can open straight to Home
 * while the server is still waking up. The session itself still lives in the cookie; the
 * CSRF token is stable for that session, so remembering it lets saves work right away.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionUser } from "../api/types";

const KEY = "sthira.session";

export type CachedSession = { user: SessionUser; csrf: string | null };

export async function loadCachedSession(): Promise<CachedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedSession(user: SessionUser, csrf: string | null): void {
  AsyncStorage.setItem(KEY, JSON.stringify({ user, csrf })).catch(() => {});
}

export function clearCachedSession(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
