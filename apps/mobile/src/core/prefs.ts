/**
 * Small on-device settings (privacy screen, reminders) that any screen can read and
 * change, with the value remembered across launches.
 */
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Pref<T> = { get(): T; set(v: T): void; use(): T; ready: Promise<void> };

export function createPref<T>(key: string, fallback: T): Pref<T> {
  let value = fallback;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const ready = AsyncStorage.getItem(key)
    .then((raw) => {
      if (raw !== null) value = JSON.parse(raw) as T;
      emit();
    })
    .catch(() => {});
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const get = () => value;
  return {
    get,
    ready,
    set(v: T) {
      value = v;
      AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
      emit();
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}

/** Hide Sthira's screen in Recent apps and block screenshots. */
export const privacyScreenPref = createPref<boolean>("sthira.privacyScreen", true);
/** Reminders before monthly plan items are due. */
export const planRemindersPref = createPref<boolean>("sthira.reminders.plan", true);
/** A gentle evening nudge on days with nothing added yet. */
export const eveningNudgePref = createPref<boolean>("sthira.reminders.evening", true);
export const eveningHourPref = createPref<number>("sthira.reminders.eveningHour", 21);
