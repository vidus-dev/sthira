/**
 * "Bank says ₹X · Sthira ₹Y": the newest "Avl bal" a bank sent by SMS, compared with what
 * Sthira had for that account at the same moment (today's balance minus entries after the
 * SMS). Later entries don't matter, so the check stays right days after the SMS.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAccounts } from "../../api/hooks";
import { useOutbox } from "../../api/outbox";
import { toNumber } from "../../core/format/money";
import { useSmsDrafts } from "./useSmsDrafts";

export type BankCheck = {
  /** What the bank said, and when. */
  bankBalance: number;
  date: number;
  /** Bank minus Sthira at that moment; 0 = they match. */
  diff: number;
  /** The balance Sthira should show now for the two to agree. */
  fixTo: number;
  /** SMS for this account from before that moment still waiting in Catch up. */
  waiting: number;
};

export function useBankChecks(): Record<string, BankCheck> {
  const scan = useSmsDrafts();
  const { data: accounts = [] } = useAccounts();
  const outbox = useOutbox();
  const hints = scan.data?.balances ?? {};
  const oldest = Object.values(hints).reduce<number | null>((min, h) => (min === null || h.date < min ? h.date : min), null);

  const later = useQuery({
    queryKey: ["transactions", "since-bank-sms", oldest],
    enabled: oldest !== null,
    queryFn: () => api.transactions.list({ start: new Date(oldest!).toISOString(), limit: 2000 }),
  });

  return useMemo(() => {
    const out: Record<string, BankCheck> = {};
    // Unsynced entries aren't on the server yet, so the comparison would be off.
    if (!later.data || outbox.length) return out;
    for (const a of accounts) {
      const h = hints[a.id];
      if (!h || a.account_type === "credit") continue;
      const after = later.data
        .filter((t) => t.account_id === a.id && Date.parse(t.occurred_at) > h.date)
        .reduce((s, t) => s + toNumber(t.amount), 0);
      const diff = Math.round((h.balance - (toNumber(a.balance) - after)) * 100) / 100;
      const waiting = (scan.data?.drafts ?? []).filter((d) => (d.accountId === a.id || d.destAccountId === a.id) && d.date <= h.date).length;
      out[a.id] = { bankBalance: h.balance, date: h.date, diff, fixTo: Math.round((toNumber(a.balance) + diff) * 100) / 100, waiting };
    }
    return out;
  }, [accounts, hints, later.data, outbox.length, scan.data?.drafts]);
}
