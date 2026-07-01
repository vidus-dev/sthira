/**
 * Goals HTTP adapter — depends only on {@link HttpClient} (inject for tests).
 */
import type { HttpClient } from "@lib/http/HttpClient";
import type {
  FinancialGoalCreate,
  FinancialGoalPlan,
  FinancialGoalRead,
} from "../domain/goalTypes";

export function createGoalsApi(http: HttpClient) {
  return {
    list(): Promise<FinancialGoalRead[]> {
      return http.requestJson<FinancialGoalRead[]>({ path: "/v1/goals", method: "GET" });
    },
    create(body: FinancialGoalCreate): Promise<FinancialGoalRead> {
      return http.requestJson<FinancialGoalRead>({
        path: "/v1/goals",
        method: "POST",
        body,
      });
    },
    getPlan(goalId: string): Promise<FinancialGoalPlan> {
      return http.requestJson<FinancialGoalPlan>({
        path: `/v1/goals/${goalId}/plan`,
        method: "GET",
      });
    },
    remove(goalId: string): Promise<void> {
      return http.requestJson<void>({
        path: `/v1/goals/${goalId}`,
        method: "DELETE",
      });
    },
  };
}

export type GoalsApi = ReturnType<typeof createGoalsApi>;
