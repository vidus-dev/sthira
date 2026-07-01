import { describe, expect, it } from "vitest";

import { CSVTransaction, Transaction } from "./transaction";

const validTransaction = {
  id: "txn_1",
  postedAt: "2026-06-27T10:00:00.000Z",
  amount: -250,
  currency: "INR",
  direction: "debit" as const,
  merchant: "Coffee House",
  categoryPath: ["Food & Dining", "Cafes"],
  accountId: "acc_1",
};

describe("Transaction schema", () => {
  it("accepts a valid transaction and defaults tags to []", () => {
    const parsed = Transaction.parse(validTransaction);
    expect(parsed.tags).toEqual([]);
    expect(parsed.direction).toBe("debit");
  });

  it("allows a null merchant", () => {
    expect(Transaction.safeParse({ ...validTransaction, merchant: null }).success).toBe(true);
  });

  it("rejects an invalid direction", () => {
    expect(Transaction.safeParse({ ...validTransaction, direction: "outgoing" }).success).toBe(
      false,
    );
  });

  it("requires categoryPath to be an array of strings", () => {
    expect(Transaction.safeParse({ ...validTransaction, categoryPath: "Food" }).success).toBe(
      false,
    );
  });
});

describe("CSVTransaction schema", () => {
  it("accepts a minimal CSV row", () => {
    const parsed = CSVTransaction.parse({
      date: "2026-06-01",
      description: "Salary",
      amount: 50000,
    });
    expect(parsed.type).toBeUndefined();
  });

  it("validates the optional type enum when present", () => {
    expect(
      CSVTransaction.safeParse({
        date: "2026-06-01",
        description: "Refund",
        amount: 100,
        type: "rebate",
      }).success,
    ).toBe(false);
  });
});
