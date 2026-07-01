import { describe, expect, it } from "vitest";

import { Budget } from "./budget";

const validBudget = {
  id: "bud_1",
  name: "Groceries",
  categoryPath: ["Food & Dining", "Groceries"],
  amount: 15000,
  currency: "INR",
  period: "monthly" as const,
  startDate: "2026-06-01T00:00:00.000Z",
};

describe("Budget schema", () => {
  it("accepts a valid budget and applies defaults", () => {
    const parsed = Budget.parse(validBudget);
    expect(parsed.isActive).toBe(true);
    expect(parsed.rules).toEqual([]);
  });

  it("rejects an unsupported period", () => {
    expect(Budget.safeParse({ ...validBudget, period: "daily" }).success).toBe(false);
  });

  it("validates nested rule operators", () => {
    const ok = Budget.safeParse({
      ...validBudget,
      rules: [{ type: "merchant", value: "Amazon", operator: "contains" }],
    });
    expect(ok.success).toBe(true);

    const bad = Budget.safeParse({
      ...validBudget,
      rules: [{ type: "merchant", value: "Amazon", operator: "matches" }],
    });
    expect(bad.success).toBe(false);
  });
});
