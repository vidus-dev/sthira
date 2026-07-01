import type { JsonHttpClient } from "../core/http/jsonHttpClient";

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

export type BudgetUpsertBody = {
  category_slug: string;
  year: number;
  month: number;
  limit_amount: string;
  currency?: string;
};

export type BudgetPatchBody = {
  limit_amount?: string;
  currency?: string;
};

export function createBudgetsApi(http: JsonHttpClient) {
  return {
    list(year: number, month: number): Promise<BudgetRow[]> {
      const q = `?year=${year}&month=${month}`;
      return http.requestJson<BudgetRow[]>({ path: `/v1/budgets${q}`, method: "GET" });
    },
    upsert(body: BudgetUpsertBody): Promise<BudgetRow> {
      return http.requestJson<BudgetRow>({ path: "/v1/budgets", method: "POST", body });
    },
    patch(id: string, body: BudgetPatchBody): Promise<BudgetRow> {
      return http.requestJson<BudgetRow>({
        path: `/v1/budgets/${id}`,
        method: "PATCH",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/budgets/${id}`, method: "DELETE" });
    },
  };
}

export type BudgetsApi = ReturnType<typeof createBudgetsApi>;
