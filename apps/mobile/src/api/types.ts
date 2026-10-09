/** Shapes returned by the Sthira API (`/v1`). Money is a decimal string. */

export type Money = string;

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  household_id: string | null;
};

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
  csrf_token?: string | null;
};

export type HouseholdMember = { id: string; email: string; display_name: string | null };

export type Household = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  invite_code: string;
  members: HouseholdMember[];
};

export type AccountType = "checking" | "savings" | "credit" | "cash" | "wallet" | "investment";

export type Account = {
  id: string;
  user_id: string;
  household_id: string;
  owner_user_id: string | null;
  display_name: string;
  institution: string | null;
  account_type: AccountType;
  currency: string;
  balance: Money;
  mask_last4: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountInput = {
  display_name: string;
  institution?: string | null;
  account_type: AccountType;
  balance?: Money;
  mask_last4?: string | null;
  owner_user_id?: string | null;
  is_default?: boolean;
};

export type CategoryKind = "expense" | "income";

export type Category = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  sort_order: number;
  is_archived: boolean;
};

export type TxSource = "manual" | "sms" | "ai";

export type Transaction = {
  id: string;
  user_id: string;
  household_id: string;
  account_id: string;
  amount: Money;
  description: string;
  category_slug: string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
  transfer_id: string | null;
  source: TxSource;
  source_ref: string | null;
  monthly_payment_id: string | null;
  period_month: string | null;
};

export type TransactionInput = {
  account_id: string;
  amount: Money;
  description?: string;
  category_slug?: string;
  occurred_at: string;
  notes?: string | null;
  monthly_payment_id?: string | null;
  period_month?: string | null;
};

export type TransactionPatch = Partial<
  Pick<TransactionInput, "amount" | "description" | "category_slug" | "occurred_at" | "notes">
> & { monthly_payment_id?: string | null; period_month?: string | null };

export type TransferInput = {
  source_account_id: string;
  dest_account_id: string;
  amount: Money;
  description?: string;
  occurred_at?: string;
};

export type AmountType = "fixed" | "percent" | "variable";

export type PlanItem = {
  id: string;
  name: string;
  category_slug: string;
  amount_type: AmountType;
  amount: Money | null;
  percent: string | null;
  base_category_slug: string | null;
  default_account_id: string | null;
  due_day: number | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
};

export type PlanItemInput = {
  name: string;
  category_slug: string;
  amount_type: AmountType;
  amount?: Money | null;
  percent?: string | null;
  base_category_slug?: string | null;
  default_account_id?: string | null;
  due_day?: number | null;
  notes?: string | null;
};

export type PlanStatus = "due" | "partial" | "paid" | "awaiting_income";

export type PlanItemStatus = {
  item: PlanItem;
  status: PlanStatus;
  due_amount: Money | null;
  base_amount: Money | null;
  paid_amount: Money;
  remaining: Money | null;
  due_date: string | null;
  payments: Transaction[];
};

export type MonthlyPlanStatus = {
  year: number;
  month: number;
  items: PlanItemStatus[];
  planned_total: Money;
  paid_total: Money;
  settled_count: number;
  total_count: number;
  base_income: Record<string, Money>;
};

export type PayInput = {
  year: number;
  month: number;
  account_id: string;
  amount?: Money | null;
  occurred_at?: string;
  description?: string;
  dest_account_id?: string | null;
};

export type CategoryTotal = { slug: string; total: Money; count: number };
export type DayTotal = { day: string; expense: Money; income: Money };

export type MonthSummary = {
  year: number;
  month: number;
  currency: string;
  days_in_month: number;
  as_of_day: number;
  income_total: Money;
  expense_total: Money;
  net: Money;
  expense_by_category: CategoryTotal[];
  income_by_category: CategoryTotal[];
  by_day: DayTotal[];
  by_member: { user_id: string; expense: Money }[];
  previous: { year: number; month: number; expense_total: Money; expense_to_same_day: Money };
};
