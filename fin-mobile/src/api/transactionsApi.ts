import type { JsonHttpClient } from "../core/http/jsonHttpClient";

export type TransactionRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount: string;
  description: string;
  category_slug: string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
};

export type TransactionCreateBody = {
  account_id: string;
  amount: string;
  description?: string;
  category_slug?: string;
  occurred_at: string;
  notes?: string | null;
};

export type TransactionPatchBody = {
  amount?: string;
  description?: string | null;
  category_slug?: string | null;
  occurred_at?: string | null;
  notes?: string | null;
};

export function createTransactionsApi(http: JsonHttpClient) {
  return {
    list(accountId?: string): Promise<TransactionRow[]> {
      const q = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
      return http.requestJson<TransactionRow[]>({ path: `/v1/transactions${q}`, method: "GET" });
    },
    create(body: TransactionCreateBody): Promise<TransactionRow> {
      return http.requestJson<TransactionRow>({ path: "/v1/transactions", method: "POST", body });
    },
    patch(id: string, body: TransactionPatchBody): Promise<TransactionRow> {
      return http.requestJson<TransactionRow>({
        path: `/v1/transactions/${id}`,
        method: "PATCH",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/transactions/${id}`, method: "DELETE" });
    },
  };
}

export type TransactionsApi = ReturnType<typeof createTransactionsApi>;
