/**
 * Indian-rupee formatting (₹1,24,560.00), done by hand so it never depends on the
 * device's Intl data. Amounts arrive from the API as decimal strings.
 */

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "124560" → "1,24,560" (last three digits, then pairs). */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const pairs: string[] = [];
  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) pairs.unshift(rest);
  return `${pairs.join(",")},${last3}`;
}

export type MoneyParts = { negative: boolean; rupees: string; paise: string };

export function splitMoney(value: string | number | null | undefined, withPaise = true): MoneyParts {
  const n = toNumber(value);
  const abs = Math.abs(n);
  if (!withPaise) {
    const rounded = Math.round(abs);
    return { negative: n < 0 && rounded !== 0, rupees: groupIndian(String(rounded)), paise: "00" };
  }
  const [int, paise] = abs.toFixed(2).split(".");
  return { negative: n < 0 && abs >= 0.005, rupees: groupIndian(int), paise };
}

export function formatINR(
  value: string | number | null | undefined,
  opts: { paise?: boolean; signed?: boolean } = {}
): string {
  const { negative, rupees, paise } = splitMoney(value, Boolean(opts.paise));
  const sign = negative ? "−" : opts.signed && toNumber(value) > 0 ? "+" : "";
  return `${sign}₹${rupees}${opts.paise ? `.${paise}` : ""}`;
}

/** ₹950 · ₹38.2k · ₹4.5L · ₹1.2Cr — for chart labels and tight spaces. */
export function compactINR(value: string | number | null | undefined): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ""));
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Parse what the keypad produced ("1,200.5") into a decimal string the API accepts. */
export function keypadToDecimal(input: string): string | null {
  const cleaned = input.replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n.toFixed(2) : null;
}
