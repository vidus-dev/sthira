import type { LineCreate, PlanLine } from "../../api/types";
import { formatINR, toNumber } from "../../core/format/money";

/** One tap to add the usual notebook items; amounts are filled in by the user. */
export const SUGGESTIONS: LineCreate[] = [
  { name: "Guru dakshina", category_slug: "guru-dakshina", kind: "bill", amount_type: "percent", percent: "10", repeat: true },
  { name: "Donations", category_slug: "donations", kind: "allowance", amount_type: "percent", percent: "5", repeat: true },
  { name: "Rent", category_slug: "rent", kind: "bill", amount_type: "fixed", repeat: true },
  { name: "Maintenance", category_slug: "maintenance", kind: "bill", amount_type: "fixed", repeat: true },
  { name: "Current", category_slug: "electricity", kind: "bill", amount_type: "variable", repeat: true },
  { name: "Internet", category_slug: "internet", kind: "bill", amount_type: "fixed", repeat: true },
  { name: "Recharge", category_slug: "mobile", kind: "bill", amount_type: "variable", repeat: true },
  { name: "EMI", category_slug: "loan-emi", kind: "bill", amount_type: "fixed", repeat: true },
  { name: "Maid", category_slug: "household", kind: "bill", amount_type: "fixed", repeat: true },
  { name: "Groceries", category_slug: "groceries", kind: "allowance", amount_type: "fixed", repeat: true },
  { name: "Non-veg", category_slug: "non-veg", kind: "allowance", amount_type: "fixed", repeat: true },
  { name: "Medicines", category_slug: "medical", kind: "allowance", amount_type: "fixed", repeat: true },
  { name: "Misc", category_slug: "other", kind: "allowance", amount_type: "fixed", covers_rest: true, repeat: true },
];

export type Rule = "same" | "percent" | "varies" | "once";

export const RULES: { value: Rule; label: string; hint: string }[] = [
  { value: "same", label: "Same every month", hint: "Copied to next month with this amount" },
  { value: "percent", label: "% of salary", hint: "Worked out from each month's salary" },
  { value: "varies", label: "Changes every month", hint: "Name copied; you enter the amount each month" },
  { value: "once", label: "Only this month", hint: "Not copied to next month" },
];

export function ruleOf(line: Pick<PlanLine, "amount_type" | "repeats">): Rule {
  if (!line.repeats) return "once";
  return line.amount_type === "percent" ? "percent" : line.amount_type === "variable" ? "varies" : "same";
}

export function monthWord(year: number, month: number, long = true): string {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: long ? "long" : "short" });
}

/** "10% of salary", "₹37,000", "Amount to fill" */
export function amountText(line: PlanLine): string {
  if (line.amount_type === "percent") {
    const pct = `${toNumber(line.percent)}% of salary`;
    return line.due_amount ? `${formatINR(line.due_amount)} · ${pct}` : pct;
  }
  if (line.due_amount == null) return "Amount to fill";
  return formatINR(line.due_amount);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
