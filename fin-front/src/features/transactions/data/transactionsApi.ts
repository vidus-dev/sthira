import type { HttpClient } from "@lib/http/HttpClient";

export type TxRow = {
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

export function createTransactionsApi(http: HttpClient) {
  return {
    list(accountId?: string): Promise<TxRow[]> {
      const q = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
      return http.requestJson<TxRow[]>({ path: `/v1/transactions${q}`, method: "GET" });
    },
    create(body: {
      account_id: string;
      amount: string;
      description?: string;
      category_slug?: string;
      occurred_at: string;
      notes?: string | null;
    }): Promise<TxRow> {
      return http.requestJson<TxRow>({
        path: "/v1/transactions",
        method: "POST",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/transactions/${id}`, method: "DELETE" });
    },
  };
}

export type TransactionsApi = ReturnType<typeof createTransactionsApi>;
