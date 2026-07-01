import { describe, expect, it } from "vitest";

import { formatInr } from "./formatCurrency";

describe("formatInr", () => {
  it("formats a number as INR currency", () => {
    const out = formatInr(1234.5);
    expect(out).toContain("1,234.5");
    expect(out).toMatch(/₹|INR/);
  });

  it("parses numeric strings", () => {
    expect(formatInr("1000")).toBe(formatInr(1000));
  });

  it("groups in the Indian numbering system (lakhs)", () => {
    // 1,00,000 — note the 2-digit grouping after the thousands.
    expect(formatInr(100000)).toContain("1,00,000");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatInr(Number.NaN)).toBe("—");
    expect(formatInr("not-a-number")).toBe("—");
    expect(formatInr(Infinity)).toBe("—");
  });

  it("honours a valid 3-letter currency code", () => {
    expect(formatInr(10, "USD")).toMatch(/\$|USD/);
  });

  it("falls back to INR for an invalid currency code", () => {
    // Intl would throw on a bad code; the function clamps to INR.
    expect(() => formatInr(10, "RUPEE")).not.toThrow();
    expect(formatInr(10, "RUPEE")).toMatch(/₹|INR/);
  });
});
