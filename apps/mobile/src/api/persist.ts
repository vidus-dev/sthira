/**
 * Saves the React Query cache on the device, so balances, entries and the plan show
 * instantly on the next launch and then refresh from the server in the background.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "sthira.queryCache",
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: CACHE_MAX_AGE,
  // Bump when cached data shapes change so old caches are dropped instead of misread.
  buster: "1",
};

/** Forget everything cached for the signed-in user (sign-out, expired session). */
export function clearPersistedCache(): void {
  Promise.resolve(persister.removeClient()).catch(() => {});
}
