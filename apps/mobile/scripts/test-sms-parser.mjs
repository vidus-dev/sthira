// Tests for the bank SMS parser. Run: node scripts/test-sms-parser.mjs (Node 22.6+ runs the .ts directly).
// Samples follow real bank formats; numbers and names are made up.
import assert from "node:assert/strict";
import { parseBankSms, parseCardBill, smsRef } from "../src/features/sms/parser.ts";

const cases = [
  ["AX-HDFCBK", "Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 09/10/26 Ref 123456789012 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808", { amount: 450, direction: "debit", last4: "1234", merchant: "SWIGGY", bank: "HDFC" }],
  ["VM-HDFCBK", "Rs.1500.00 spent on HDFC Bank Card x4821 at AMAZON on 2026-10-09:20:42:11. Avl bal: Rs.23,456.00. Not you? Call 18002586161", { amount: 1500, direction: "debit", last4: "4821", merchant: "AMAZON", card: true, balance: 23456 }],
  ["JD-HDFCBK-S", "Update! INR 85,000.00 deposited in HDFC Bank A/c XX1234 on 01-OCT-26 for NEFT Cr-XXXX-ACME CORP. Avl bal INR 1,23,456.00.", { amount: 85000, direction: "credit", last4: "1234", balance: 123456 }],
  ["AD-HDFCBK", "Money Received - INR 500.00 in your HDFC Bank A/c xx1234 on 09-10-26 by A/c linked to VPA ravi.k@okicici (UPI Ref No 123456789012).", { amount: 500, direction: "credit", last4: "1234" }],
  ["VM-HDFCBK", "Payment of Rs.15000.00 received towards your HDFC Bank Credit Card ending 4821. Thank you", { amount: 15000, direction: "credit", last4: "4821", card: true }],
  ["JD-SBIUPI", "Dear UPI user A/C X1234 debited by 450.0 on date 09Oct26 trf to SWIGGY Refno 123456789012. If not u? call 1800111109. -SBI", { amount: 450, direction: "debit", last4: "1234", merchant: "SWIGGY", bank: "SBI" }],
  ["VK-SBIUPI", "Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 09Oct26 by (Ref no 123456789012)", { amount: 500, direction: "credit", last4: "1234", bank: "SBI" }],
  ["BZ-SBIINB", "Your A/C XXXXX1234 Debited INR 2,000.00 on 09/10/26 -Transferred to Mr. RAVI KUMAR. Avl Balance INR 12,345.67-SBI", { amount: 2000, direction: "debit", last4: "1234", merchant: "RAVI KUMAR", balance: 12345.67 }],
  ["AD-SBICRD", "Rs.1,250.00 spent on your SBI Credit Card ending 4821 at DMART on 09/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute", { amount: 1250, direction: "debit", last4: "4821", merchant: "DMART", card: true }],
  ["VM-ICICIB", "ICICI Bank Acct XX234 debited for Rs 450.00 on 09-Oct-26; SWIGGY credited. UPI:123456789012. Call 18002662 for dispute. SMS BLOCK 234 to 9215676766.", { amount: 450, direction: "debit", last4: "234", merchant: "SWIGGY", bank: "ICICI" }],
  ["VM-ICICIT", "INR 1,500.00 spent using ICICI Bank Card XX4821 on 09-Oct-26 on AMAZON. Avl Limit: INR 1,23,456.00. If not you, call 1800 2662/SMS BLOCK 4821 to 9215676766", { amount: 1500, direction: "debit", last4: "4821", merchant: "AMAZON", card: true, balance: null }],
  ["AX-AXISBK", "INR 450.00 debited A/c no. XX1234 09-10-26, 20:42:11 UPI/P2M/123456789012/SWIGGY Not you? SMS BLOCKUPI Cust ID to 919951860002 Axis Bank", { amount: 450, direction: "debit", last4: "1234", merchant: "SWIGGY", bank: "Axis" }],
  ["AX-AXISBK", "Spent INR 1500 Axis Bank Card no. XX4821 09-10-26 20:42:11 IST AMAZON Avl Limit: INR 98765 Not you? SMS BLOCK 4821 to 919951860002", { amount: 1500, direction: "debit", last4: "4821", merchant: "AMAZON", card: true }],
  ["JM-KOTAKB", "Sent Rs.450.00 from Kotak Bank AC X1234 to swiggy@icici on 09-10-26.UPI Ref 123456789012. Not you, https://kotak.com/KBANKT/Fraud", { amount: 450, direction: "debit", last4: "1234", merchant: "swiggy", bank: "Kotak" }],
  ["JM-KOTAKB", "Received Rs.500.00 in your Kotak Bank AC X1234 from ravi@okaxis on 09-10-26.UPI Ref:123456789012.", { amount: 500, direction: "credit", last4: "1234", merchant: "ravi" }],
  ["VM-SBIINB", "Your a/c no. XXXXXXXX1234 is credited by Rs.85,000.00 on 01-10-26 by a/c linked to mobile 9XXXXXX99 (IMPS Ref no 123456789012).", { amount: 85000, direction: "credit", last4: "1234" }],
  ["AD-HDFCBK", "Rs.300.00 withdrawn from HDFC Bank A/c XX1234 at ATM on 09-10-26. Avl bal Rs.5,000.00", { amount: 300, direction: "debit", balance: 5000 }],
];

const ignored = [
  ["VM-HDFCBK", "Payment of Rs.15,234.00 is due on your HDFC Bank Credit Card ending 4821 by 15-Oct-26. Min amount due Rs.800."],
  ["AX-ICICIB", "Ravi has requested money from you on Google Pay. On approving the request, INR 200.00 will be debited from your A/c XX234"],
  ["JD-HDFCBK", "Rs.499 will be debited from your HDFC Bank A/c XX1234 on 12-10-26 towards NETFLIX mandate."],
  ["VM-AXISBK", "Get a personal loan of up to Rs.5,00,000 pre-approved for you! Apply now"],
  ["AD-KOTAKB", "Your transaction of Rs.450 at SWIGGY on Kotak Card x4821 was declined due to insufficient balance."],
  ["VM-SBIINB", "Your e-statement for A/c XX1234 is generated. Closing balance Rs.12,000."],
];

let failed = 0;
for (const [addr, body, want] of cases) {
  const got = parseBankSms(addr, body);
  try {
    assert.ok(got, "should parse");
    for (const [k, v] of Object.entries(want)) assert.deepEqual(got[k], v, `${k}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${addr}: ${body.slice(0, 70)}...\n  ${e.message}\n  got ${JSON.stringify(got)}`);
  }
}
for (const [addr, body] of ignored) {
  const got = parseBankSms(addr, body);
  if (got) {
    failed++;
    console.log(`FAIL should ignore: ${body.slice(0, 70)}...\n  got ${JSON.stringify(got)}`);
  }
}
// Credit card statements and due reminders → what's owed and by when.
const bills = [
  ["VM-HDFCBK", "Payment of Rs.15,234.00 is due on your HDFC Bank Credit Card ending 4821 by 15-Oct-26. Min amount due Rs.800.", { bank: "HDFC", last4: "4821", total: 15234, minDue: 800, dueDate: "2026-10-15" }],
  ["AD-HDFCBK", "Your HDFC Bank Credit Card XX4821 statement is generated. Total Amt Due: Rs 23,450.00; Min Amt Due: Rs 1,180.00. Pay by 05-11-2026.", { last4: "4821", total: 23450, minDue: 1180, dueDate: "2026-11-05" }],
  ["AD-SBICRD", "Your SBI Card ending 4821 statement dated 20/10/26: Total Amount Due Rs.12,345.67, Minimum Amount Due Rs.620.00, Payment Due Date 09/11/26.", { bank: "SBI", last4: "4821", total: 12345.67, minDue: 620, dueDate: "2026-11-09" }],
  ["VM-ICICIT", "Statement for ICICI Bank Credit Card XX4821: Total Amount Due INR 8,765.00, Minimum Amount Due INR 440.00, Due Date 05-Nov-26.", { bank: "ICICI", total: 8765, minDue: 440, dueDate: "2026-11-05" }],
  ["AX-AXISBK", "Axis Bank Credit Card XX4821 statement: Total amount due INR 5,432.10, Min due INR 272. Due by 7 November 2026.", { bank: "Axis", total: 5432.1, minDue: 272, dueDate: "2026-11-07" }],
  ["VM-ICICIT", "Reminder: Your ICICI Bank Credit Card XX4821 payment of INR 8,765.00 is due on 2026-11-05.", { total: 8765, minDue: null, dueDate: "2026-11-05" }],
];
const notBills = [
  ["VM-HDFCBK", "Payment of Rs.15000.00 received towards your HDFC Bank Credit Card ending 4821. Thank you"],
  ["VM-HDFCBK", "Rs.1500.00 spent on HDFC Bank Card x4821 at AMAZON on 2026-10-09:20:42:11. Avl bal: Rs.23,456.00."],
  ["JD-HDFCBK", "Rs.499 will be debited from your HDFC Bank A/c XX1234 on 12-10-26 towards NETFLIX mandate."],
  ["AD-HDFCBK", "EMI of Rs 6,300 for your loan is due on 05-11-26. Keep balance in A/c XX1234."],
];
for (const [addr, body, want] of bills) {
  const got = parseCardBill(addr, body);
  try {
    assert.ok(got, "should parse as a card bill");
    for (const [k, v] of Object.entries(want)) assert.deepEqual(got[k], v, `${k}`);
  } catch (e) {
    failed++;
    console.log(`FAIL bill ${addr}: ${body.slice(0, 70)}...\n  ${e.message}\n  got ${JSON.stringify(got)}`);
  }
}
for (const [addr, body] of notBills) {
  const got = parseCardBill(addr, body);
  if (got) {
    failed++;
    console.log(`FAIL not a bill: ${body.slice(0, 70)}...\n  got ${JSON.stringify(got)}`);
  }
}

const a = smsRef("AX-HDFCBK", "x", 1);
assert.equal(a, smsRef("AX-HDFCBK", "x", 1));
assert.notEqual(a, smsRef("AX-HDFCBK", "x", 2));
assert.match(a, /^sms:[0-9a-f]{16}$/);

console.log(failed ? `${failed} failed` : `all ${cases.length + ignored.length + bills.length + notBills.length} SMS cases pass`);
process.exit(failed ? 1 : 0);
