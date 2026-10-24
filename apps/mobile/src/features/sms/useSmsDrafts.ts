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
import type { Account } from "../../api/types";
import { buildDrafts, latestBalances, matchAccount, type Draft } from "./drafts";
import { parseCardBill, smsRef, type CardBill } from "./parser";

const DAY = 24 * 60 * 60 * 1000;
/** On the very first scan, look back this far (never before the accounts were added). */
const FIRST_LOOKBACK = 30 * DAY;
/** Card statements arrive ~3 weeks before the due date; look back this far the first time. */
const BILL_LOOKBACK = 45 * DAY;

const sinceKey = (userId: string) => `sthira.sms.since.${userId}`;
const skippedKey = (userId: string) => `sthira.sms.skipped.${userId}`;
const billsSinceKey = (userId: string) => `sthira.sms.billsSince.${userId}`;
const billsKey = (userId: string) => `sthira.sms.cardBills.${userId}`;
const balancesKey = (userId: string) => `sthira.sms.balances.${userId}`;

type Balances = Record<string, { balance: number; date: number }>;
type StoredBill = CardBill & { ref: string; date: number };
export type SmsCardBill = StoredBill & { accountId: string | null };

/** One statement can come with reminders; they share the card and the due date. */
const billKey = (b: CardBill) => `${b.last4 ?? b.bank ?? "card"}|${b.dueDate}`;

function matchCard(b: CardBill, accounts: Account[]): string | null {
  const cards = accounts.filter((a) => a.account_type === "credit");
  return matchAccount({ amount: b.total, direction: "debit", last4: b.last4, card: true, merchant: null, balance: null, bank: b.bank }, cards);
}

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
  /** Newest "Avl bal" the bank sent per account (kept between scans). */
  balances: Balances;
  /** Credit card statements / due reminders, newest message per card and due date. */
  cardBills: SmsCardBill[];
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
      const billsSince = (await readJson<number | null>(billsSinceKey(userId), null)) ?? Date.now() - BILL_LOOKBACK;

      const [all, existing, history, skipped, savedBills, savedBalances] = await Promise.all([
        readBankSms(Math.min(since, billsSince), 1500),
        api.transactions.list({ start: new Date(since - 2 * DAY).toISOString(), limit: 2000 }),
        api.transactions.list({ start: new Date(Date.now() - 120 * DAY).toISOString(), limit: 2000 }),
        readJson<string[]>(skippedKey(userId), []),
        readJson<StoredBill[]>(billsKey(userId), []),
        readJson<Balances>(balancesKey(userId), {}),
      ]);
      const messages = all.filter((m) => m.date >= since);

      // Card bills: keep the newest message per card and due date, until 60 days past due.
      const bills = new Map(savedBills.map((b) => [billKey(b), b]));
      for (const m of all) {
        if (m.date < billsSince) continue;
        const bill = parseCardBill(m.address, m.body);
        if (!bill) continue;
        const prev = bills.get(billKey(bill));
        if (!prev || prev.date < m.date) bills.set(billKey(bill), { ...bill, ref: smsRef(m.address, m.body, m.date), date: m.date });
      }
      const keptBills = [...bills.values()].filter((b) => Date.parse(b.dueDate) > Date.now() - 60 * DAY);

      // Bank-reported balances: the newest per account, from this scan or an earlier one.
      const balances: Balances = {};
      const fresh = Object.fromEntries(latestBalances(all, accs));
      for (const a of accs) {
        const pick = [savedBalances[a.id], fresh[a.id]].filter(Boolean).sort((x, y) => y!.date - x!.date)[0];
        if (pick) balances[a.id] = pick;
      }
      await Promise.all([
        AsyncStorage.setItem(billsKey(userId), JSON.stringify(keptBills)),
        AsyncStorage.setItem(billsSinceKey(userId), JSON.stringify(Date.now() - DAY)),
        AsyncStorage.setItem(balancesKey(userId), JSON.stringify(balances)),
      ]).catch(() => {});

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

      return {
        drafts,
        balances,
        cardBills: keptBills.map((b) => ({ ...b, accountId: matchCard(b, accs) })).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        scannedFrom: since,
      };
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
