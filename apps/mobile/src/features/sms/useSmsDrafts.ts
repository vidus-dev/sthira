/**
 * Bank SMS → drafts to review. The inbox is read on the phone; only confirmed entries
 * (amount, account, category, merchant name) are sent to the server.
 */
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSmsPermission, isSmsSupported, readBankSms } from "../../../modules/sms-inbox";
import { api } from "../../api/client";
import { useAccounts, useCategories } from "../../api/hooks";
import { enqueue, pendingRefs } from "../../api/outbox";
import { useAuth } from "../../auth/AuthContext";
import { buildDrafts, latestBalances, type Draft } from "./drafts";

const DAY = 24 * 60 * 60 * 1000;
/** On the very first scan, look back this far (never before the accounts were added). */
const FIRST_LOOKBACK = 30 * DAY;

const sinceKey = (userId: string) => `sthira.sms.since.${userId}`;
const skippedKey = (userId: string) => `sthira.sms.skipped.${userId}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export type SmsScan = {
  drafts: Draft[];
  /** Newest "Avl bal" the bank sent per account (a hint for balance checks). */
  balances: Record<string, { balance: number; date: number }>;
  scannedFrom: number;
};

export const SMS_DRAFTS_KEY = (userId: string | undefined) => ["sms-drafts", userId ?? ""] as const;

/** Whether this phone can read SMS at all, and whether access was given. Rechecked on resume. */
export function useSmsPermission(): { supported: boolean; granted: boolean; recheck: () => void } {
  const [granted, setGranted] = useState(() => hasSmsPermission());
  const recheck = useCallback(() => setGranted(hasSmsPermission()), []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && recheck());
    return () => sub.remove();
  }, [recheck]);
  return { supported: isSmsSupported, granted, recheck };
}

export function useSmsDrafts() {
  const { user } = useAuth();
  const { granted } = useSmsPermission();
  const accounts = useAccounts();
  const categories = useCategories();
  const ready = Boolean(user && granted && accounts.data && categories.data);

  return useQuery({
    queryKey: SMS_DRAFTS_KEY(user?.id),
    enabled: ready,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<SmsScan> => {
      const userId = user!.id;
      const accs = accounts.data!;
      const firstAccount = Math.min(...accs.map((a) => Date.parse(a.created_at)), Date.now());
      const stored = await readJson<number | null>(sinceKey(userId), null);
      const since = stored ?? Math.max(Date.now() - FIRST_LOOKBACK, firstAccount - DAY);

      const [messages, existing, history, skipped] = await Promise.all([
        readBankSms(since, 1500),
        api.transactions.list({ start: new Date(since - 2 * DAY).toISOString(), limit: 2000 }),
        api.transactions.list({ start: new Date(Date.now() - 120 * DAY).toISOString(), limit: 2000 }),
        readJson<string[]>(skippedKey(userId), []),
      ]);
      const drafts = buildDrafts({
        messages,
        accounts: accs,
        categories: categories.data!,
        existing,
        history,
        hidden: new Set([...skipped, ...pendingRefs()]),
      });

      // Next time, start from the oldest thing still waiting (or two days back), so the
      // scan stays small while nothing is ever missed.
      const oldestOpen = drafts.length ? Math.min(...drafts.map((d) => d.date)) - 60_000 : Date.now() - 2 * DAY;
      await AsyncStorage.setItem(sinceKey(userId), JSON.stringify(Math.max(since, Math.min(oldestOpen, Date.now() - 2 * DAY)))).catch(() => {});

      return { drafts, balances: Object.fromEntries(latestBalances(messages, accs)), scannedFrom: since };
    },
  });
}

/** Confirm drafts (they go through the outbox) or skip them for good. */
export function useDraftActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = SMS_DRAFTS_KEY(user?.id);

  const drop = (refs: Set<string>) =>
    qc.setQueryData<SmsScan>(key, (cur) => (cur ? { ...cur, drafts: cur.drafts.filter((d) => !refs.has(d.ref)) } : cur));

  const confirm = (drafts: Draft[]) => {
    const ready = drafts.filter((d) => d.accountId && (d.kind !== "transfer" || d.destAccountId));
    if (!ready.length) return 0;
    enqueue(
      ...ready.map((d) =>
        d.kind === "transfer"
          ? {
              kind: "transfer" as const,
              body: {
                source_account_id: d.accountId!,
                dest_account_id: d.destAccountId!,
                amount: d.amount.toFixed(2),
                description: d.note,
                occurred_at: new Date(d.date).toISOString(),
                source: "sms" as const,
                source_ref: d.ref,
                dest_source_ref: d.destRef,
              },
            }
          : {
              kind: "tx" as const,
              body: {
                account_id: d.accountId!,
                amount: (d.kind === "expense" ? -d.amount : d.amount).toFixed(2),
                category_slug: d.categorySlug ?? (d.kind === "expense" ? "other" : "other-income"),
                description: d.note,
                occurred_at: new Date(d.date).toISOString(),
                source: "sms" as const,
                source_ref: d.ref,
              },
            }
      )
    );
    drop(new Set(ready.map((d) => d.ref)));
    return ready.length;
  };

  const skip = async (drafts: Draft[]) => {
    if (!user) return;
    const refs = drafts.flatMap((d) => (d.destRef ? [d.ref, d.destRef] : [d.ref]));
    const prev = await readJson<string[]>(skippedKey(user.id), []);
    // Keep the list bounded; old refs fall outside the scan window anyway.
    await AsyncStorage.setItem(skippedKey(user.id), JSON.stringify([...prev, ...refs].slice(-3000))).catch(() => {});
    drop(new Set(drafts.map((d) => d.ref)));
  };

  const update = (ref: string, patch: Partial<Draft>) =>
    qc.setQueryData<SmsScan>(key, (cur) =>
      cur ? { ...cur, drafts: cur.drafts.map((d) => (d.ref === ref ? { ...d, ...patch } : d)) } : cur
    );

  return { confirm, skip, update };
}
