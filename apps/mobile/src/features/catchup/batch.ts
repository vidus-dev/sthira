/**
 * "swiggy 450 hdfc, milk 60 cash, +85000 salary" → one entry per line or comma.
 * Pure (no React) so it's easy to reason about; the sheet shows what it understood.
 */
import type { Account, Category } from "../../api/types";
import { KEYWORDS } from "../sms/drafts";

export type BatchLine = {
  raw: string;
  amount: number | null;
  kind: "expense" | "income";
  /** Null when the line names no account: the sheet's default is used. */
  accountId: string | null;
  categorySlug: string | null;
  note: string;
};

const INCOME_HINT = /^\+|\b(?:salary|received|got|income|refund|cashback|interest)\b/i;
// A number on its own ("450", "₹1,200", "1.2k"), not digits inside a word.
const AMOUNT = /(?:^|\s)((?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k|l|lakh|lakhs)?)(?=\s|$)/gi;

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Words that point at an account: its nickname, bank, last digits, "cash", "card". */
function accountFor(tokens: string[], accounts: Account[]): { id: string; used: string[] } | null {
  let best: { id: string; used: string[]; score: number } | null = null;
  for (const a of accounts) {
    const names = new Set([...words(a.display_name), ...words(a.institution ?? ""), ...(a.mask_last4 ? [a.mask_last4] : [])]);
    if (a.account_type === "cash") names.add("cash");
    if (a.account_type === "credit") ["card", "cc", "credit"].forEach((w) => names.add(w));
    if (a.account_type === "wallet") names.add("wallet");
    const used = tokens.filter((t) => t.length >= 2 && names.has(t) && !/^\d+$/.test(t.replace(/^\d{4}$/, "")));
    const score = used.reduce((s, t) => s + (["card", "cc", "credit", "wallet"].includes(t) ? 1 : t.length), 0);
    if (used.length && (!best || score > best.score)) best = { id: a.id, used, score };
  }
  if (!best) return null;
  // "card" alone is only good enough with a single card.
  const generic = best.used.every((t) => ["card", "cc", "credit", "wallet"].includes(t));
  if (generic && accounts.filter((a) => a.id !== best!.id && a.account_type === accounts.find((x) => x.id === best!.id)?.account_type).length) return null;
  return { id: best.id, used: best.used };
}

function categoryFor(text: string, kind: "expense" | "income", categories: Category[], learned: Map<string, string>): string | null {
  const usable = categories.filter((c) => c.kind === kind && !c.is_archived);
  const tokens = words(text);
  // A word that starts a category's name: "veg" → Vegetables, "petrol" via keywords below.
  for (const c of usable) {
    const names = [...words(c.name), c.slug];
    if (tokens.some((t) => t.length >= 3 && names.some((n) => n.startsWith(t) || t === n))) return c.slug;
  }
  for (const t of tokens) {
    const slug = learned.get(t);
    if (slug && usable.some((c) => c.slug === slug)) return slug;
  }
  if (kind === "expense") {
    for (const [re, slug] of KEYWORDS) if (re.test(text) && usable.some((c) => c.slug === slug)) return slug;
  } else if (/salary/i.test(text) && usable.some((c) => c.slug === "salary")) return "salary";
  const fallback = kind === "expense" ? "other" : "other-income";
  return usable.some((c) => c.slug === fallback) ? fallback : null;
}

export function parseBatch(text: string, accounts: Account[], categories: Category[], learned: Map<string, string> = new Map()): BatchLine[] {
  return text
    // Commas inside numbers ("1,250") stay; other commas separate entries.
    .split(/[\n;]+|,(?!\d)/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const kind = INCOME_HINT.test(raw) ? "income" : "expense";
      let rest = raw.replace(/^\+/, "");
      // The first number that isn't an account's last digits ("hdfc 4821 450" → 450).
      const masks = new Set(accounts.map((a) => a.mask_last4).filter(Boolean));
      const m = [...rest.matchAll(AMOUNT)].find((x) => !masks.has(x[2]) || x[3]);
      let amount: number | null = null;
      if (m) {
        const unit = (m[3] ?? "").toLowerCase();
        amount = Number(m[2].replace(/,/g, "")) * (unit === "k" ? 1_000 : unit.startsWith("l") ? 100_000 : 1);
        if (!(amount > 0)) amount = null;
        rest = rest.replace(m[1], " ");
      }
      const tokens = words(rest);
      const account = accountFor(tokens, accounts);
      const leftover = rest
        .split(/\s+/)
        .filter((w) => w && !account?.used.includes(w.toLowerCase().replace(/[^a-z0-9]/g, "")))
        .join(" ")
        .replace(/\b(?:from|via|by|on|paid|in)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const note = leftover ? leftover.replace(/^\w/, (c) => c.toUpperCase()) : "";
      return {
        raw,
        amount,
        kind,
        accountId: account?.id ?? null,
        categorySlug: categoryFor(leftover, kind, categories, learned),
        note,
      };
    });
}
