import { describe, expect, it } from "vitest";

import { Account, AccountsResponse } from "./account";

const validAccount = {
  id: "acc_1",
  name: "Everyday Checking",
  type: "checking" as const,
  currency: "INR",
  balance: 4200.5,
  lastUpdated: "2026-06-27T10:00:00.000Z",
};

describe("Account schema", () => {
  it("accepts a well-formed account", () => {
    const parsed = Account.parse(validAccount);
    expect(parsed.isActive).toBe(true); // defaulted
    expect(parsed.type).toBe("checking");
  });

  it("rejects an unknown account type", () => {
    const r = Account.safeParse({ ...validAccount, type: "savings" });
    expect(r.success).toBe(false);
  });

  it("rejects a non 3-letter currency", () => {
    expect(Account.safeParse({ ...validAccount, currency: "RUPEE" }).success).toBe(false);
  });

  it("rejects a non-ISO lastUpdated", () => {
    expect(Account.safeParse({ ...validAccount, lastUpdated: "yesterday" }).success).toBe(false);
  });

  it("parses an accounts response envelope", () => {
    const parsed = AccountsResponse.parse({ accounts: [validAccount], total: 1 });
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.total).toBe(1);
  });
});
