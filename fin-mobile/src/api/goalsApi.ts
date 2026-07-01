import type { JsonHttpClient } from "../core/http/jsonHttpClient";

export type GoalKind = "wedding" | "emergency" | "vacation" | "custom";

export type FinancialGoalRead = {
  id: string;
  user_id: string;
  name: string;
  goal_kind: GoalKind | string;
  currency: string;
  target_amount: string;
  saved_amount: string;
  target_date: string | null;
  notes: string | null;
  suggested_monthly_contribution: string | null;
  progress: string;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalCreate = {
  name: string;
  goal_kind?: GoalKind;
  currency?: string;
  target_amount: string;
  saved_amount?: string;
  target_date?: string | null;
  notes?: string | null;
};

export type FinancialGoalPatch = {
  name?: string;
  goal_kind?: GoalKind;
  currency?: string;
  target_amount?: string;
  saved_amount?: string;
  target_date?: string | null;
  notes?: string | null;
};

export function createGoalsApi(http: JsonHttpClient) {
  return {
    list(): Promise<FinancialGoalRead[]> {
      return http.requestJson<FinancialGoalRead[]>({ path: "/v1/goals", method: "GET" });
    },
    create(body: FinancialGoalCreate): Promise<FinancialGoalRead> {
      return http.requestJson<FinancialGoalRead>({ path: "/v1/goals", method: "POST", body });
    },
    patch(id: string, body: FinancialGoalPatch): Promise<FinancialGoalRead> {
      return http.requestJson<FinancialGoalRead>({
        path: `/v1/goals/${id}`,
        method: "PATCH",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/goals/${id}`, method: "DELETE" });
    },
  };
}

export type GoalsApi = ReturnType<typeof createGoalsApi>;
