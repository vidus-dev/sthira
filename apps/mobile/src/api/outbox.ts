/**
 * Outbox: new entries are saved on the phone first and sent to the server in order, so
 * nothing is lost offline, on a weak signal, or while the free server is waking up.
 *
 * Each entry keeps one Idempotency-Key (or an SMS ``source_ref``) across retries, so a
 * save whose answer got lost is never added twice.
 */
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "../core/api/ApiError";
import { api, newRequestId } from "./client";
import type { Transaction, TransactionInput, TransferInput } from "./types";

const KEY = "sthira.outbox";
const BACKOFF_MS = [3_000, 10_000, 30_000, 60_000, 120_000];

export type OutboxItem =
  | { id: string; userId: string; kind: "tx"; body: TransactionInput; createdAt: number; attempts: number }
  | { id: string; userId: string; kind: "transfer"; body: TransferInput; createdAt: number; attempts: number };

type NewItem = Pick<OutboxItem, "kind" | "body"> & { kind: OutboxItem["kind"] };

let items: OutboxItem[] = [];
let loaded = false;
let userId: string | null = null;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let onSynced: (() => void) | null = null;
let onRejected: ((message: string, item: OutboxItem) => void) | null = null;
let onLinked: ((tx: Transaction) => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}

async function load() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    // Keep anything added while loading.
    if (raw) items = [...(JSON.parse(raw) as OutboxItem[]), ...items.filter((i) => !raw.includes(i.id))];
  } catch {
    /* start empty */
  }
  loaded = true;
  emit();
}

/** Called after entries reach the server (refresh balances, lists, totals). */
export function setOutboxHandlers(h: {
  onSynced: () => void;
  onRejected: (message: string, item: OutboxItem) => void;
  /** The server ticked off a plan line with this entry ("Rent 37,000" → October rent). */
  onLinked: (tx: Transaction) => void;
}) {
  onSynced = h.onSynced;
  onRejected = h.onRejected;
  onLinked = h.onLinked;
}

/**
 * Who is signed in; only their entries are sent. Entries survive a sign-out (or an expired
 * session) and go out when the same person signs in again.
 */
export function setOutboxUser(id: string | null) {
  userId = id;
  if (id) void load().then(flush);
}

export function enqueue(...entries: NewItem[]): void {
  if (!userId) throw new Error("Not signed in");
  const now = Date.now();
  items = [
    ...items,
    ...entries.map((e, i) => ({ ...e, id: newRequestId(), userId: userId!, createdAt: now + i, attempts: 0 }) as OutboxItem),
  ];
  save();
  emit();
  void flush();
}

function schedule(attempts: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0]);
}

async function send(item: OutboxItem): Promise<void> {
  if (item.kind === "tx") {
    const tx = await api.transactions.create(item.body, item.id);
    if (tx?.plan_item_id) onLinked?.(tx);
  } else await api.transfers.create(item.body);
}

/** Send everything waiting, oldest first. Stops at the first network/server problem. */
export async function flush(): Promise<void> {
  if (flushing || !userId || !loaded) return;
  flushing = true;
  let sent = 0;
  try {
    for (;;) {
      const next = items.find((i) => i.userId === userId);
      if (!next) break;
      try {
        await send(next);
        sent++;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        const retryable = status === 0 || status === 408 || status === 429 || status >= 500 || status === 401 || status === 403;
        if (retryable) {
          next.attempts += 1;
          save();
          schedule(next.attempts);
          break;
        }
        // 409 = already on the server (an SMS imported before): nothing to do.
        if (status !== 409) onRejected?.(e instanceof Error ? e.message : "Couldn't save an entry", next);
      }
      items = items.filter((i) => i.id !== next.id);
      save();
      emit();
    }
  } finally {
    flushing = false;
    if (sent) onSynced?.();
  }
}

// Try again whenever the app comes back to the foreground.
AppState.addEventListener("change", (s) => {
  if (s === "active") void flush();
});

function snapshot() {
  return items;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Entries not on the server yet (for showing them as "waiting to sync"). */
export function useOutbox(): OutboxItem[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return all.filter((i) => i.userId === userId);
}

export function pendingRefs(): Set<string> {
  const out = new Set<string>();
  for (const i of items) {
    if (i.body.source_ref) out.add(i.body.source_ref);
    if (i.kind === "transfer" && i.body.dest_source_ref) out.add(i.body.dest_source_ref);
  }
  return out;
}
