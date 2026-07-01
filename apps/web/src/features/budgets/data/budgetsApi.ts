import type { HttpClient } from "@lib/http/HttpClient";

export type BudgetRow = {
  id: string;
  user_id: string;
  category_slug: string;
  year: number;
  month: number;
  limit_amount: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export function createBudgetsApi(http: HttpClient) {
  return {
    list(year: number, month: number): Promise<BudgetRow[]> {
      const q = `?year=${year}&month=${month}`;
      return http.requestJson<BudgetRow[]>({ path: `/v1/budgets${q}`, method: "GET" });
    },
    upsert(body: {
      category_slug: string;
      year: number;
      month: number;
      limit_amount: string;
      currency?: string;
    }): Promise<BudgetRow> {
      return http.requestJson<BudgetRow>({
        path: "/v1/budgets",
        method: "POST",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/budgets/${id}`, method: "DELETE" });
    },
  };
}

export type BudgetsApi = ReturnType<typeof createBudgetsApi>;
