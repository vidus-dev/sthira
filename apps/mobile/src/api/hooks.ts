/**
 * React Query hooks: cached reads + mutations that keep every screen in sync.
 * Ledger changes update the caches optimistically so saving feels instant, then
 * refetch balances, summaries and the monthly plan from the server.
 */
import { useMemo } from "react";
import { Alert } from "react-native";
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "./client";
import { setOutboxHandlers, useOutbox, type OutboxItem } from "./outbox";
import { showToast } from "../ui/Toast";
import type {
  Account,
  AccountInput,
  Category,
  CategoryKind,
  MonthPlan,
  ReconcileInput,
  Transaction,
  TransactionPatch,
  TransferInput,
} from "./types";
import { toNumber } from "../core/format/money";
import type { YearMonth } from "../core/format/dates";

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime matches the on-device cache age so persisted data isn't dropped early.
    queries: { staleTime: 30_000, gcTime: 7 * 24 * 60 * 60 * 1000, retry: 1, refetchOnReconnect: true },
    mutations: { retry: 0 },
  },
});

export const qk = {
  household: ["household"] as const,
  accounts: ["accounts"] as const,
  categories: (all: boolean) => ["categories", all] as const,
  summary: (ym: YearMonth) => ["summary", ym.year, ym.month] as const,
  monthTx: (ym: YearMonth) => ["transactions", "month", ym.year, ym.month] as const,
  recentTx: ["transactions", "recent"] as const,
  monthPlan: (ym: YearMonth) => ["month-plan", ym.year, ym.month] as const,
};

/** Everything a new/edited/deleted entry can change. */
function invalidateLedger(qc: QueryClient) {
  return Promise.all(
    [["accounts"], ["transactions"], ["summary"], ["plan"], ["month-plan"], ["sms-drafts"]].map((queryKey) =>
      qc.invalidateQueries({ queryKey })
    )
  );
}

/** "Counted as October Rent ✓" with Undo, after the server links an entry to the plan. */
function announceLink(tx: Transaction) {
  let line: string | null = null;
  let monthLabel = "this month's plan";
  for (const [, plan] of queryClient.getQueriesData<MonthPlan>({ queryKey: ["month-plan"] })) {
    const hit = plan?.items.find((i) => i.id === tx.plan_item_id);
    if (hit && plan) {
      line = hit.name;
      monthLabel = new Date(plan.year, plan.month - 1, 1).toLocaleString("en-IN", { month: "long" });
    }
  }
  showToast({
    message: line ? `Counted as ${monthLabel} ${line}` : `Counted in ${monthLabel}`,
    action: {
      label: "Undo",
      onPress: () =>
        void api.transactions
          .update(tx.id, { plan_item_id: null })
          .catch(() => Alert.alert("Couldn't undo that", "Open the plan item to unlink it."))
          .finally(() => invalidateLedger(queryClient)),
    },
  });
}

setOutboxHandlers({
  onSynced: () => void invalidateLedger(queryClient),
  onRejected: (message) => Alert.alert("Couldn't save an entry", message),
  onLinked: announceLink,
});

/** Outbox entries shaped like server rows (a transfer becomes its two legs). */
function pendingRows(items: OutboxItem[]): Transaction[] {
  const base = {
    user_id: "",
    household_id: "",
    notes: null,
    monthly_payment_id: null,
    period_month: null,
    source_ref: null,
  };
  return items.flatMap((i): Transaction[] => {
    const created_at = new Date(i.createdAt).toISOString();
    if (i.kind === "tx") {
      return [
        {
          ...base,
          id: `pending-${i.id}`,
          account_id: i.body.account_id,
          amount: i.body.amount,
          description: i.body.description ?? "",
          category_slug: i.body.category_slug ?? "uncategorized",
          occurred_at: i.body.occurred_at,
          created_at,
          transfer_id: null,
          source: i.body.source ?? "manual",
        },
      ];
    }
    const occurred_at = i.body.occurred_at ?? created_at;
    const leg = { ...base, category_slug: "transfer", occurred_at, created_at, transfer_id: `pending-${i.id}`, source: i.body.source ?? "manual" };
    return [
      { ...leg, id: `pending-${i.id}-out`, account_id: i.body.source_account_id, amount: `-${i.body.amount}`, description: i.body.description ?? "" },
      { ...leg, id: `pending-${i.id}-in`, account_id: i.body.dest_account_id, amount: i.body.amount, description: i.body.description ?? "" },
    ];
  });
}

/** Entries saved on the phone that haven't reached the server yet, newest first. */
export function usePendingTransactions(): Transaction[] {
  const items = useOutbox();
  return useMemo(
    () => pendingRows(items).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [items]
  );
}

/** Server rows plus waiting ones, so a new entry shows (and counts) right away. */
export function withPending(rows: Transaction[] | undefined, pending: Transaction[], ym?: YearMonth): Transaction[] {
  const inMonth = ym
    ? pending.filter((t) => {
        const d = new Date(t.occurred_at);
        return d.getFullYear() === ym.year && d.getMonth() + 1 === ym.month;
      })
    : pending;
  return [...inMonth, ...(rows ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

/** Account balances including entries still waiting to sync. */
export function useAccountsWithPending() {
  const accounts = useAccounts();
  const pending = usePendingTransactions();
  const data = useMemo(() => {
    if (!accounts.data || pending.length === 0) return accounts.data;
    const delta = new Map<string, number>();
    for (const t of pending) delta.set(t.account_id, (delta.get(t.account_id) ?? 0) + toNumber(t.amount));
    return accounts.data.map((a) =>
      delta.has(a.id) ? { ...a, balance: String(toNumber(a.balance) + (delta.get(a.id) ?? 0)) } : a
    );
  }, [accounts.data, pending]);
  return { ...accounts, data };
}

// --- reads ---------------------------------------------------------------------------

export const useHousehold = () => useQuery({ queryKey: qk.household, queryFn: api.household.get });

const byCreated = (rows: Account[]) => [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));

/** Accounts in the order they were added (the main ones usually come first). */
export const useAccounts = () =>
  useQuery({ queryKey: qk.accounts, queryFn: api.accounts.list, select: byCreated });

export const useCategories = (includeArchived = false) =>
  useQuery({
    queryKey: qk.categories(includeArchived),
    queryFn: () => api.categories.list(includeArchived),
    staleTime: 5 * 60_000,
  });

/** slug → category, archived ones included so old entries still show their name. */
export function useCategoryMap(): Map<string, Category> {
  const { data } = useCategories(true);
  return useMemo(() => new Map((data ?? []).map((c) => [c.slug, c])), [data]);
}

/** A month's own plan (created on the server the first time it's opened). */
export const useMonthPlan = (ym: YearMonth, enabled = true) =>
  useQuery({ queryKey: qk.monthPlan(ym), queryFn: () => api.monthPlan.get(ym.year, ym.month), enabled });

/** Any change to a month's plan: the server answers with the whole updated plan. */
export function usePlanAction(ym: YearMonth) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (run: () => Promise<MonthPlan>) => run(),
    onSuccess: (plan) => qc.setQueryData(qk.monthPlan(ym), plan),
    // Payments move balances; edits "from now on" change later months too.
    onSettled: () => invalidateLedger(qc),
  });
}

export const useMonthSummary = (ym: YearMonth) =>
  useQuery({ queryKey: qk.summary(ym), queryFn: () => api.summary.month(ym.year, ym.month) });

export function useMonthTransactions(ym: YearMonth) {
  return useQuery({
    queryKey: qk.monthTx(ym),
    queryFn: () => {
      const start = new Date(ym.year, ym.month - 1, 1).toISOString();
      const end = new Date(ym.year, ym.month, 1).toISOString();
      return api.transactions.list({ start, end, limit: 2000 });
    },
  });
}

export const useRecentTransactions = () =>
  useQuery({ queryKey: qk.recentTx, queryFn: () => api.transactions.list({ limit: 8 }) });

// --- ledger mutations --------------------------------------------------------------------

type Snapshot = [QueryKey, unknown][];

function snapshot(qc: QueryClient): Snapshot {
  return [
    ...qc.getQueriesData({ queryKey: ["transactions"] }),
    ...qc.getQueriesData({ queryKey: ["accounts"] }),
  ];
}

function restore(qc: QueryClient, snap: Snapshot | undefined) {
  snap?.forEach(([key, data]) => qc.setQueryData(key, data));
}

function adjustBalance(qc: QueryClient, accountId: string, delta: number) {
  qc.setQueryData<Account[]>(qk.accounts, (rows) =>
    rows?.map((a) =>
      a.id === accountId ? { ...a, balance: String(toNumber(a.balance) + delta) } : a
    )
  );
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TransactionPatch }) =>
      api.transactions.update(id, patch),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tx: Transaction) => api.transactions.remove(tx.id),
    onMutate: async (tx) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snap = snapshot(qc);
      // Deleting a transfer leg removes the whole transfer (both legs) on the server too.
      const gone = (r: Transaction) => r.id === tx.id || (tx.transfer_id !== null && r.transfer_id === tx.transfer_id);
      const legs = new Map<string, Transaction>([[tx.id, tx]]);
      for (const [key, rows] of qc.getQueriesData<Transaction[]>({ queryKey: ["transactions"] })) {
        rows?.filter(gone).forEach((r) => legs.set(r.id, r));
        qc.setQueryData<Transaction[]>(key, (cur) => cur?.filter((r) => !gone(r)));
      }
      legs.forEach((leg) => adjustBalance(qc, leg.account_id, -toNumber(leg.amount)));
      return { snap };
    },
    onError: (_e, _tx, ctx) => restore(qc, ctx?.snap),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransferInput) => api.transfers.create(body),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useReconcileAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReconcileInput }) => api.accounts.reconcile(id, body),
    onSettled: () => invalidateLedger(qc),
  });
}

// --- setup mutations ---------------------------------------------------------------------

export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: AccountInput }) =>
      id ? api.accounts.update(id, body) : api.accounts.create(body),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.accounts }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.accounts.remove(id),
    onSettled: () => invalidateLedger(qc),
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, kind, icon }: { id?: string; name: string; kind: CategoryKind; icon: string }) =>
      id ? api.categories.update(id, { name, icon }) : api.categories.create({ name, kind, icon }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.categories.archive(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.household.join(code),
    // Everything belongs to the new household now.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRenameHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.household.rename(name),
    onSuccess: (h) => qc.setQueryData(qk.household, h),
  });
}

export function useRotateInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.household.rotateInviteCode(),
    onSuccess: (h) => qc.setQueryData(qk.household, h),
  });
}
