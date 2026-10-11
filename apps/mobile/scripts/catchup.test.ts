// Tests for SMS drafts (account matching, transfer pairing, duplicates) and typed batches.
// Run: npm run test:catchup -w mobile
import assert from "node:assert/strict";
import type { Account, Category, Transaction } from "../src/api/types";
import { parseBatch } from "../src/features/catchup/batch";
import { buildDrafts, latestBalances, matchAccount } from "../src/features/sms/drafts";
import { parseBankSms, smsRef } from "../src/features/sms/parser";

const created = "2026-10-01T00:00:00Z";
const acc = (id: string, name: string, institution: string | null, type: Account["account_type"], last4: string | null): Account => ({
  id, user_id: "u", household_id: "h", owner_user_id: "u", display_name: name, institution, account_type: type,
  currency: "INR", balance: "0", mask_last4: last4, is_default: false, created_at: created, updated_at: created,
});
const accounts = [
  acc("hdfc", "HDFC Savings", "HDFC", "savings", "1234"),
  acc("sbi", "SBI", "SBI", "savings", "5678"),
  acc("card", "HDFC Card", "HDFC", "credit", "4821"),
  acc("cash", "Cash", null, "cash", null),
];
const cat = (slug: string, name: string, kind: "expense" | "income" = "expense"): Category => ({ id: slug, slug, name, kind, icon: "dots", sort_order: 0, is_archived: false });
const categories = [
  cat("food-delivery", "Food delivery"), cat("groceries", "Groceries"), cat("milk", "Milk"), cat("vegetables", "Vegetables"),
  cat("transport", "Transport"), cat("other", "Other"), cat("salary", "Salary", "income"), cat("other-income", "Other income", "income"),
];
const at = (iso: string) => Date.parse(iso);
const tx = (p: Partial<Transaction>): Transaction => ({
  id: "t", user_id: "u", household_id: "h", account_id: "hdfc", amount: "-1", description: "", category_slug: "other",
  occurred_at: created, notes: null, created_at: created, transfer_id: null, source: "manual", source_ref: null,
  monthly_payment_id: null, period_month: null, ...p,
});

// Matching: last digits, a 3-digit ICICI-style ref, and bank name when the account has no digits saved.
assert.equal(matchAccount(parseBankSms("AX-HDFCBK", "Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 09/10/26 Ref 1")!, accounts), "hdfc");
assert.equal(matchAccount(parseBankSms("VM-HDFCBK", "Rs.1500.00 spent on HDFC Bank Card x4821 at AMAZON on 2026-10-09")!, accounts), "card");
assert.equal(matchAccount(parseBankSms("VM-ICICIB", "ICICI Bank Acct XX234 debited for Rs 450.00 on 09-Oct-26; SWIGGY credited. UPI:1")!, accounts), "hdfc");

const sms = [
  // Before the accounts were added: already in the opening balance, so ignored.
  { id: "0", address: "AX-HDFCBK", body: "Sent Rs.999.00 From HDFC Bank A/C *1234 To ZOMATO On 20/09/26 Ref 1", date: at("2026-09-20T10:00:00Z") },
  { id: "1", address: "AX-HDFCBK", body: "Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 09/10/26 Ref 2", date: at("2026-10-09T15:00:00Z") },
  // SBI → HDFC, 3 minutes apart: one transfer.
  { id: "2", address: "BZ-SBIINB", body: "Your A/C XXXXX5678 Debited INR 2,000.00 on 09/10/26 -Transferred to Mr. VINAY. Avl Balance INR 12,345.67-SBI", date: at("2026-10-09T16:00:00Z") },
  { id: "3", address: "JD-HDFCBK", body: "Update! INR 2,000.00 deposited in HDFC Bank A/c XX1234 on 09-OCT-26 for IMPS. Avl bal INR 8,000.00.", date: at("2026-10-09T16:03:00Z") },
  // Same amount as a manual entry the day before: flagged as possibly already added.
  { id: "4", address: "AX-HDFCBK", body: "Sent Rs.60.00 From HDFC Bank A/C *1234 To NANDINI MILK On 08/10/26 Ref 3", date: at("2026-10-08T03:00:00Z") },
  // Already imported earlier.
  { id: "5", address: "AX-HDFCBK", body: "Sent Rs.80.00 From HDFC Bank A/C *1234 To RAPIDO On 08/10/26 Ref 4", date: at("2026-10-08T04:00:00Z") },
  // Not a transaction.
  { id: "6", address: "VM-HDFCBK", body: "Payment of Rs.15,234.00 is due on your HDFC Bank Credit Card ending 4821 by 15-Oct-26.", date: at("2026-10-09T05:00:00Z") },
];
const existing = [
  tx({ id: "m1", account_id: "hdfc", amount: "-60.00", description: "Milk", category_slug: "milk", occurred_at: "2026-10-07T20:00:00Z" }),
  tx({ id: "s1", source: "sms", source_ref: smsRef(sms[5].address, sms[5].body, sms[5].date), amount: "-80.00" }),
];
const history = [tx({ description: "Swiggy", category_slug: "groceries" }), tx({ description: "swiggy", category_slug: "groceries" })];

const drafts = buildDrafts({ messages: sms, accounts, categories, existing, history, hidden: new Set() });
assert.deepEqual(drafts.map((d) => d.kind), ["transfer", "expense", "expense"]);
const [transfer, swiggy, milk] = drafts;
assert.equal(transfer.accountId, "sbi");
assert.equal(transfer.destAccountId, "hdfc");
assert.equal(transfer.destRef, smsRef(sms[3].address, sms[3].body, sms[3].date));
assert.equal(swiggy.categorySlug, "groceries", "history beats the built-in keyword (food delivery)");
assert.equal(swiggy.note, "Swiggy");
assert.equal(milk.duplicateOf, "m1");
assert.equal(milk.categorySlug, "milk");

// Skipped refs stay hidden.
assert.equal(buildDrafts({ messages: sms, accounts, categories, existing, history, hidden: new Set([swiggy.ref]) }).length, 2);

// Avl bal hints per account (newest wins).
assert.deepEqual(latestBalances(sms, accounts).get("hdfc")?.balance, 8000);
assert.deepEqual(latestBalances(sms, accounts).get("sbi")?.balance, 12345.67);

// Typed batch.
const lines = parseBatch("swiggy 450 hdfc, milk 60 cash\nauto 80\n+85000 salary sbi\nveg 1.2k\nhello", accounts, categories);
assert.deepEqual(
  lines.map((l) => [l.amount, l.kind, l.accountId, l.categorySlug, l.note]),
  [
    [450, "expense", "hdfc", "food-delivery", "Swiggy"],
    [60, "expense", "cash", "milk", "Milk"],
    [80, "expense", null, "other", "Auto"],
    [85000, "income", "sbi", "salary", "Salary"],
    [1200, "expense", null, "vegetables", "Veg"],
    [null, "expense", null, "other", "Hello"],
  ]
);
// Digits inside a word aren't the amount; an account's last digits aren't either.
assert.deepEqual(
  parseBatch("ZZTEST18436 123 cash", accounts, categories).map((l) => [l.amount, l.accountId, l.note]),
  [[123, "cash", "ZZTEST18436"]]
);
assert.deepEqual(parseBatch("hdfc 1234 450 swiggy", accounts, categories).map((l) => [l.amount, l.accountId]), [[450, "hdfc"]]);
assert.equal(parseBatch("rs.1,250 dmart", accounts, categories)[0].amount, 1250);

// "card" picks the only credit card.
assert.equal(parseBatch("amazon 999 card", accounts, categories)[0].accountId, "card");

console.log("catch-up tests pass");
