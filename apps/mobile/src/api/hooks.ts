/**
 * React Query hooks: cached reads + mutations that keep every screen in sync.
 * Ledger changes update the caches optimistically so saving feels instant, then
 * refetch balances, summaries and the monthly plan from the server.
 */
import { useMemo } from "react";
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "./client";
import type {
  Account,
  AccountInput,
  Category,
  CategoryKind,
  PayInput,
  PlanItemInput,
  Transaction,
  TransactionInput,
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
  planItems: (all: boolean) => ["plan-items", all] as const,
  plan: (ym: YearMonth) => ["plan", ym.year, ym.month] as const,
  summary: (ym: YearMonth) => ["summary", ym.year, ym.month] as const,
  monthTx: (ym: YearMonth) => ["transactions", "month", ym.year, ym.month] as const,
  recentTx: ["transactions", "recent"] as const,
};

/** Everything a new/edited/deleted entry can change. */
function invalidateLedger(qc: QueryClient) {
  return Promise.all(
    [["accounts"], ["transactions"], ["summary"], ["plan"]].map((queryKey) =>
      qc.invalidateQueries({ queryKey })
    )
  );
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

export const usePlanItems = (includeInactive = false) =>
  useQuery({
    queryKey: qk.planItems(includeInactive),
    queryFn: () => api.plan.items(includeInactive),
  });

export const usePlanStatus = (ym: YearMonth) =>
  useQuery({ queryKey: qk.plan(ym), queryFn: () => api.plan.status(ym.year, ym.month) });

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

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionInput) => api.transactions.create(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snap = snapshot(qc);
      const optimistic: Transaction = {
        id: `optimistic-${Date.now()}`,
        user_id: "",
        household_id: "",
        account_id: body.account_id,
        amount: body.amount,
        description: body.description ?? "",
        category_slug: body.category_slug ?? "uncategorized",
        occurred_at: body.occurred_at,
        notes: body.notes ?? null,
        created_at: new Date().toISOString(),
        transfer_id: null,
        source: "manual",
        source_ref: null,
        monthly_payment_id: body.monthly_payment_id ?? null,
        period_month: body.period_month ?? null,
      };
      const d = new Date(body.occurred_at);
      const ym = { year: d.getFullYear(), month: d.getMonth() + 1 };
      const prepend = (rows?: Transaction[]) => (rows ? [optimistic, ...rows] : rows);
      qc.setQueryData<Transaction[]>(qk.monthTx(ym), prepend);
      qc.setQueryData<Transaction[]>(qk.recentTx, prepend);
      adjustBalance(qc, body.account_id, toNumber(body.amount));
      return { snap };
    },
    onError: (_e, _body, ctx) => restore(qc, ctx?.snap),
    onSettled: () => invalidateLedger(qc),
  });
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

export function usePayPlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: PayInput }) => api.plan.pay(itemId, body),
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

export function useSavePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: PlanItemInput }) =>
      id ? api.plan.update(id, body) : api.plan.create(body),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["plan-items"] }),
        qc.invalidateQueries({ queryKey: ["plan"] }),
      ]),
  });
}

export function useArchivePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.plan.archive(id),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["plan-items"] }),
        qc.invalidateQueries({ queryKey: ["plan"] }),
      ]),
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
