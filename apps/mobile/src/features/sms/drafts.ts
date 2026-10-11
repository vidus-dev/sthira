/**
 * From parsed bank SMS to drafts the user confirms: which account, which category, and
 * whether two SMS are one transfer between their own accounts. Pure functions (no React).
 */
import type { Account, Category, Transaction } from "../../api/types";
import { parseBankSms, smsRef, type ParsedSms } from "./parser";

export type SmsMessage = { id: string; address: string; body: string; date: number };

export type DraftKind = "expense" | "income" | "transfer";

export type Draft = {
  /** ``source_ref`` of the SMS (the debit side for a transfer). */
  ref: string;
  date: number;
  amount: number;
  kind: DraftKind;
  accountId: string | null;
  /** Transfers: where the money went. */
  destAccountId: string | null;
  /** Transfers: ``source_ref`` of the matching credit SMS, when there was one. */
  destRef: string | null;
  categorySlug: string | null;
  note: string;
  parsed: ParsedSms;
  /** Looks like an entry that was already added by hand (same account, amount, day). */
  duplicateOf: string | null;
};

/** Match by the last digits first, then by bank name when only one account fits. */
export function matchAccount(p: ParsedSms, accounts: Account[]): string | null {
  if (p.last4) {
    const hits = accounts.filter((a) => a.mask_last4 && (a.mask_last4.endsWith(p.last4!) || p.last4!.endsWith(a.mask_last4)));
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1) {
      const typed = hits.filter((a) => (a.account_type === "credit") === p.card);
      if (typed.length === 1) return typed[0].id;
    }
  }
  if (p.bank) {
    const bank = p.bank.toLowerCase();
    const hits = accounts.filter(
      (a) =>
        (a.account_type === "credit") === p.card &&
        a.account_type !== "cash" &&
        `${a.institution ?? ""} ${a.display_name}`.toLowerCase().includes(bank)
    );
    // With last digits in the SMS, only trust an account that has none saved yet.
    const safe = p.last4 ? hits.filter((a) => !a.mask_last4) : hits;
    if (safe.length === 1) return safe[0].id;
  }
  return null;
}

// Fallback suggestions when there is no history yet. Category slugs from the defaults.
export const KEYWORDS: [RegExp, string][] = [
  [/swiggy|zomato|eatsure|dominos|domino|pizza|kfc|mcdonald|burger/i, "food-delivery"],
  [/blinkit|zepto|bigbasket|bb ?now|instamart|dmart|d mart|reliance fresh|more retail|jiomart|grocer|kirana|supermarket/i, "groceries"],
  [/vegetable|sabzi|fruits?\b/i, "vegetables"],
  [/milk|dairy|nandini|amul|heritage|country delight/i, "milk"],
  [/meat|chicken|licious|fresh ?to ?home|mutton|fish/i, "non-veg"],
  [/restaurant|cafe|hotel|bistro|dhaba|starbucks|chai/i, "dining-out"],
  [/rent\b/i, "rent"],
  [/maintenance|society|apartment|association/i, "maintenance"],
  [/electric|bescom|tneb|tangedco|msedcl|tsspdcl|apspdcl|bses|tata power|adani elec|cesc|kseb|power/i, "electricity"],
  [/act fibernet|fibernet|broadband|hathway|airtel ?xstream|jiofiber|excitel|internet/i, "internet"],
  [/recharge|prepaid|postpaid|airtel|jio\b|vodafone|\bvi\b|bsnl/i, "mobile"],
  [/emi\b|loan|bajaj fin|home ?first|hdfc ltd/i, "loan-emi"],
  [/petrol|diesel|fuel|hpcl|bpcl|iocl|indian ?oil|bharat ?petroleum|hp ?pay|shell/i, "fuel"],
  [/uber|ola\b|olacabs|rapido|metro|irctc|redbus|makemytrip|indigo|air ?india|vistara|namma yatri|fastag|parking/i, "transport"],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|tata ?cliq|decathlon|croma|reliance digital/i, "shopping"],
  [/pharma|apollo|medplus|netmeds|1mg|pharmeasy|hospital|clinic|diagnostic|lab\b|doctor/i, "medical"],
  [/netflix|hotstar|prime ?video|spotify|youtube|bookmyshow|pvr|inox|sony ?liv|zee5|jiocinema/i, "entertainment"],
  [/salon|parlour|parlor|barber|urban ?company/i, "personal-care"],
  [/school|college|tuition|course|udemy|coursera|fees/i, "education"],
  [/temple|seva|trust|donat|charity|foundation/i, "donations"],
];

const INCOME_KEYWORDS: [RegExp, string][] = [
  [/salary|\bsal\b|payroll|wages/i, "salary"],
  [/interest|int\.? ?pd|refund|reversal|reversed|cashback|cash back/i, "interest-refunds"],
];

/** "SWIGGY", "swiggy" and "Swiggy Ltd" all become "swiggy". */
export function merchantKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(?:ltd|limited|pvt|private|india|the|upi|payment|payments|technologies|tech)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Learn "merchant → category" from what was entered before (most used wins). */
export function categoryHistory(txs: Transaction[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const t of txs) {
    if (t.transfer_id || t.category_slug === "adjustment" || t.category_slug === "unaccounted") continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    const m = counts.get(key) ?? new Map<string, number>();
    m.set(t.category_slug, (m.get(t.category_slug) ?? 0) + 1);
    counts.set(key, m);
  }
  const out = new Map<string, string>();
  for (const [key, m] of counts) out.set(key, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

export function suggestCategory(
  p: ParsedSms,
  history: Map<string, string>,
  categories: Category[]
): string | null {
  const kind = p.direction === "debit" ? "expense" : "income";
  const usable = new Set(categories.filter((c) => c.kind === kind && !c.is_archived).map((c) => c.slug));
  const key = merchantKey(p.merchant);
  if (key) {
    const exact = history.get(key);
    if (exact && usable.has(exact)) return exact;
    // "swiggy instamart" learned as groceries, SMS says "swiggy instamart bangalore".
    for (const [k, slug] of history) {
      if (usable.has(slug) && k.length >= 4 && (key.startsWith(k) || k.startsWith(key))) return slug;
    }
  }
  for (const [re, slug] of kind === "expense" ? KEYWORDS : INCOME_KEYWORDS) {
    if (re.test(p.merchant ?? "") && usable.has(slug)) return slug;
  }
  const fallback = kind === "expense" ? "other" : "other-income";
  return usable.has(fallback) ? fallback : null;
}

function titleCase(s: string): string {
  return /[a-z]/.test(s) && /[A-Z]/.test(s) ? s : s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const DAY = 24 * 60 * 60 * 1000;
const PAIR_WINDOW = 45 * 60 * 1000;

type BuildInput = {
  messages: SmsMessage[];
  accounts: Account[];
  categories: Category[];
  /** Entries already on the server for the scanned period (to drop imported ones). */
  existing: Transaction[];
  /** Older entries, to learn categories from. */
  history: Transaction[];
  /** Refs the user skipped, and refs waiting in the outbox. */
  hidden: Set<string>;
};

/** Newest first. Drops SMS already imported, skipped, or from before an account was added. */
export function buildDrafts({ messages, accounts, categories, existing, history, hidden }: BuildInput): Draft[] {
  const imported = new Set(existing.map((t) => t.source_ref).filter(Boolean) as string[]);
  const learned = categoryHistory([...history, ...existing]);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  // An account's opening balance already includes anything before it was added.
  const tooOld = (accountId: string | null, date: number) => {
    const a = accountId ? byId.get(accountId) : undefined;
    return Boolean(a && Date.parse(a.created_at) > date);
  };

  const seen = new Set<string>();
  const drafts: Draft[] = [];
  for (const m of messages) {
    const ref = smsRef(m.address, m.body, m.date);
    if (seen.has(ref) || imported.has(ref) || hidden.has(ref)) continue;
    seen.add(ref);
    const parsed = parseBankSms(m.address, m.body);
    if (!parsed) continue;
    const accountId = matchAccount(parsed, accounts);
    if (tooOld(accountId, m.date)) continue;
    drafts.push({
      ref,
      date: m.date,
      amount: parsed.amount,
      kind: parsed.direction === "debit" ? "expense" : "income",
      accountId,
      destAccountId: null,
      destRef: null,
      categorySlug: suggestCategory(parsed, learned, categories),
      note: parsed.merchant ? titleCase(parsed.merchant) : "",
      parsed,
      duplicateOf: null,
    });
  }

  // Money out of one of my accounts and the same amount into another, close in time,
  // is one transfer (moving money between buckets, paying the card bill).
  const used = new Set<string>();
  const out: Draft[] = [];
  const sorted = [...drafts].sort((a, b) => a.date - b.date);
  for (const d of sorted) {
    if (used.has(d.ref)) continue;
    if (d.kind === "expense" && d.accountId) {
      const credit = sorted.find(
        (c) =>
          !used.has(c.ref) &&
          c.kind === "income" &&
          c.accountId &&
          c.accountId !== d.accountId &&
          Math.abs(c.amount - d.amount) < 0.005 &&
          Math.abs(c.date - d.date) <= PAIR_WINDOW
      );
      if (credit) {
        used.add(credit.ref);
        out.push({ ...d, kind: "transfer", destAccountId: credit.accountId, destRef: credit.ref, categorySlug: null, note: "" });
        continue;
      }
    }
    out.push(d);
  }

  // Already added by hand? Same account, same amount and direction, within a day and a half.
  const manual = existing.filter((t) => t.source === "manual");
  const claimed = new Set<string>();
  for (const d of out) {
    const signed = d.kind === "income" ? d.amount : -d.amount;
    const match = manual.find(
      (t) =>
        !claimed.has(t.id) &&
        t.account_id === d.accountId &&
        Math.abs(Number(t.amount) - signed) < 0.005 &&
        Math.abs(Date.parse(t.occurred_at) - d.date) <= 1.5 * DAY
    );
    if (match) {
      claimed.add(match.id);
      d.duplicateOf = match.id;
    }
  }

  return out.sort((a, b) => b.date - a.date);
}

/** The newest balance each account's bank reported by SMS ("Avl bal"). */
export function latestBalances(messages: SmsMessage[], accounts: Account[]): Map<string, { balance: number; date: number }> {
  const out = new Map<string, { balance: number; date: number }>();
  for (const m of [...messages].sort((a, b) => b.date - a.date)) {
    const p = parseBankSms(m.address, m.body);
    if (!p || p.balance === null || p.card) continue;
    const id = matchAccount(p, accounts);
    if (id && !out.has(id)) out.set(id, { balance: p.balance, date: m.date });
  }
  return out;
}
