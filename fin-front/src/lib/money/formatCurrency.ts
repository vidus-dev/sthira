export function formatInr(
  amount: number | string,
  currencyCode: string = "INR"
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode.length === 3 ? currencyCode : "INR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currencyCode} ${n.toLocaleString("en-IN")}`;
  }
}
