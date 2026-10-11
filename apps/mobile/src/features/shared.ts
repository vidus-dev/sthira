import type { Account, AccountType, Category, HouseholdMember, Transaction } from "../api/types";

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: "savings", label: "Savings", icon: "bank" },
  { value: "checking", label: "Current", icon: "bank" },
  { value: "credit", label: "Credit card", icon: "card" },
  { value: "cash", label: "Cash", icon: "cash" },
  { value: "wallet", label: "Wallet", icon: "wallet" },
  { value: "investment", label: "Investment", icon: "trendUp" },
];

export function accountIcon(type: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "bank";
}

/** "HDFC Card" + " ••4821" */
export function accountLabel(a: Account | undefined | null, withMask = true): string {
  if (!a) return "Unknown account";
  return withMask && a.mask_last4 ? `${a.display_name} ••${a.mask_last4}` : a.display_name;
}

/** Not on the server yet (waiting in the outbox, or an optimistic placeholder). */
export function isLocalOnly(tx: Transaction): boolean {
  return tx.id.startsWith("pending-") || tx.id.startsWith("optimistic");
}

/** Balance corrections move a balance but are neither income nor spending. */
export function isAdjustment(tx: Transaction): boolean {
  return tx.category_slug === "adjustment";
}

export function categoryName(map: Map<string, Category>, slug: string): string {
  if (slug === "transfer") return "Transfer";
  if (slug === "adjustment") return "Balance correction";
  if (slug === "uncategorized") return "Uncategorized";
  return map.get(slug)?.name ?? slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function categoryIcon(map: Map<string, Category>, slug: string): string {
  if (slug === "transfer") return "swap";
  if (slug === "adjustment") return "scale";
  return map.get(slug)?.icon ?? "dots";
}

/** What a row is called: the note if there is one, else the category. */
export function txTitle(tx: Transaction, map: Map<string, Category>): string {
  return tx.description?.trim() || categoryName(map, tx.category_slug);
}

export function memberName(members: HouseholdMember[] | undefined, userId: string): string | null {
  const m = members?.find((x) => x.id === userId);
  return m ? m.display_name || m.email.split("@")[0] : null;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
