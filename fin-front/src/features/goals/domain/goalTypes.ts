export type GoalKind = "wedding" | "emergency" | "vacation" | "custom";

export type FinancialGoalRead = {
  id: string;
  user_id: string;
  name: string;
  goal_kind: GoalKind;
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

export type FinancialGoalPlan = {
  remaining_amount: string;
  months_remaining: number | null;
  suggested_monthly_contribution: string | null;
  progress: string;
};
