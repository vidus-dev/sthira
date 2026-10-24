/**
 * Turns an Indian bank alert SMS into the facts of a transaction: amount, money in or out,
 * the account / card's last digits, who it was paid to, and the balance if the bank says.
 *
 * Runs on the phone; the raw text never leaves it. No imports, so the tests can run it in
 * plain Node (`node scripts/test-sms-parser.mjs`).
 */

export type ParsedSms = {
  amount: number;
  direction: "debit" | "credit";
  /** Last 3–4 digits of the account or card, when the SMS names it. */
  last4: string | null;
  /** True when the SMS is about a card (credit card spends and bill payments). */
  card: boolean;
  /** Who was paid / who paid, cleaned up ("Swiggy", "AMAZON"). */
  merchant: string | null;
  /** "Avl bal" after the transaction, when included. */
  balance: number | null;
  /** Bank short name from the sender ID or the text ("HDFC", "SBI"). */
  bank: string | null;
};

// Things that mention money but are not a completed transaction.
const NOT_A_TRANSACTION =
  /\b(?:is due|are due|due (?:on|by|date)|min(?:imum)?\.? (?:amt|amount) due|will be (?:debited|credited|deducted)|to be debited|scheduled|request(?:ed)?|collect request|declined|failed|unsuccessful|insufficient|reminder|statement (?:is )?generated|e-?statement|pre-?approved|eligible|offer|apply now|win |get up to|loan of up to|otp)\b/i;

const CREDIT_WORDS = /\b(?:credited|received|deposited|refund(?:ed)?|reversed|reversal|added to|cr\.?(?=\s|$))/i;
const DEBIT_WORDS = /\b(?:debited|spent|withdrawn|withdrawal|paid|sent|purchase|used|transferred|deducted|debit(?:ed)?|dr\.?(?=\s|$)|txn of)\b/i;

const AMOUNT = /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;
const AMOUNT_AFTER_VERB = /\b(?:debited|credited|spent)\s+(?:by|for|with|of)?\s*(?:rs\.?|inr|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i;
const BALANCE =
  /\b(?:avl\.?|avail(?:able)?|avbl\.?|clear|closing|a\/c)?\s*bal(?:ance)?\.?\s*(?:is|:|-|of)?\s*(?:rs\.?|inr|₹)?\s*:?\s*(-?[\d,]+(?:\.\d{1,2})?)/i;
const ACCOUNT_REF =
  /\b(?:a\/c|a\/c\.|acct|account|ac|card)\s*(?:no\.?|number|num)?\s*(?:ending(?:\s*(?:with|in))?)?\s*[:\-]?\s*(?:[x*•.]+\s*)?(\d{3,6})\b/i;
const STAR_REF = /(?:[x*•]{2,}|\*)(\d{3,6})\b/i;

const BANKS: [RegExp, string][] = [
  [/HDFC/i, "HDFC"],
  [/\bSBI|SBIINB|SBIUPI|SBIPSG|ATMSBI|SBICRD|SBMSMS|CBSSBI/i, "SBI"],
  [/ICICI/i, "ICICI"],
  [/AXIS/i, "Axis"],
  [/KOTAK|KMBL/i, "Kotak"],
  [/YESB|YES ?BANK/i, "Yes Bank"],
  [/IDFC/i, "IDFC"],
  [/INDUS|INDBNK/i, "IndusInd"],
  [/PNB|PUNJAB NATIONAL/i, "PNB"],
  [/BOB|BARODA/i, "Bank of Baroda"],
  [/CANBNK|CANARA/i, "Canara"],
  [/UNION|UBOI/i, "Union Bank"],
  [/FEDBNK|FEDERAL/i, "Federal"],
  [/AUBANK|AU BANK/i, "AU"],
  [/ONECRD|ONECARD/i, "OneCard"],
  [/SCBANK|STANDARD CHARTERED|\bSC BANK/i, "Standard Chartered"],
  [/HSBC/i, "HSBC"],
  [/CITI/i, "Citi"],
  [/RBL/i, "RBL"],
  [/BOI|BANK OF INDIA/i, "Bank of India"],
  [/IOB|INDIAN OVERSEAS/i, "IOB"],
  [/CENTRAL BANK|CBOI/i, "Central Bank"],
  [/PAYTM|PYTM/i, "Paytm"],
  [/AIRTEL|AIRBNK/i, "Airtel"],
  [/JUPITER|FEDERAL/i, "Federal"],
];

function toAmount(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** The bank's short name from the sender ID ("AX-HDFCBK") or, failing that, the text. */
export function bankFromSender(address: string, body = ""): string | null {
  const id = address.toUpperCase().replace(/^[A-Z]{2}-/, "").replace(/-[A-Z]$/, "");
  for (const [re, name] of BANKS) if (re.test(id)) return name;
  for (const [re, name] of BANKS) if (re.test(body)) return name;
  return null;
}

function firstIndex(re: RegExp, s: string): number {
  const m = re.exec(s);
  return m ? m.index : -1;
}

function findAmount(body: string): number | null {
  for (const m of body.matchAll(AMOUNT)) {
    const before = body.slice(Math.max(0, (m.index ?? 0) - 24), m.index).toLowerCase();
    // Skip "Avl bal Rs 12,000" and "Avl limit INR 98,765".
    if (/(?:bal(?:ance)?|limit|lmt)\W*(?:is|of)?\W*$/.test(before)) continue;
    const n = toAmount(m[1]);
    if (n > 0) return n;
  }
  const verb = AMOUNT_AFTER_VERB.exec(body);
  if (verb) {
    const n = toAmount(verb[1]);
    if (n > 0) return n;
  }
  return null;
}

function findLast4(body: string): string | null {
  const m = ACCOUNT_REF.exec(body) ?? STAR_REF.exec(body);
  if (!m) return null;
  return m[1].slice(-4);
}

const MERCHANT_PATTERNS: RegExp[] = [
  // "at SWIGGY on 09-10-26", "At AMAZON On 2026-10-09"
  /\bat\s+([A-Za-z0-9][\w&.'*/\- ]{1,40}?)(?=\s+on\b|\s*[.,;]|\s+avl|\s+ref|\s+bal|\s*$)/i,
  // "to VPA swiggy@icici", "to swiggy@icici"
  /\bto\s+(?:vpa\s+)?([\w.\-]+@[\w.]+)/i,
  // SBI: "trf to SWIGGY Refno"
  /\btrf to\s+([\w&.' ]{2,40}?)(?=\s+ref|\s*[.,;]|\s*$)/i,
  // SBI: "-Transferred to Mr. NAME. Avl"
  /\btransferred to\s+(?:mr\.?|ms\.?|mrs\.?|m\/s\.?)?\s*([\w&.' ]{2,40}?)(?=\s*\.|\s+avl|\s*$)/i,
  // ICICI: "; SWIGGY credited."
  /;\s*([\w&.' ]{2,40}?)\s+credited/i,
  // Axis: "UPI/P2M/123456789012/SWIGGY"
  /UPI\/P2[MA]\/\d+\/([\w&.' ]{2,40})/i,
  // ICICI card: "on AMAZON. Avl Limit"
  /\bon\s+([A-Za-z][\w&.' ]{2,30}?)\.\s*avl/i,
  // Axis card: "20:42:11 IST AMAZON Avl Limit"
  /\bIST\s+([A-Za-z][\w&.' ]{2,40}?)\s+avl/i,
  // HDFC: "To SWIGGY On 09/10/26"
  /\bto\s+([A-Za-z][\w&.' ]{1,40}?)(?=\s+on\b|\s*[.,;]|\s+ref)/i,
  // Credits: "from VPA xyz@okicici", "from ACME CORP"
  /\bfrom\s+(?:vpa\s+)?([\w.\-]+@[\w.]+)/i,
  /\b(?:by|from)\s+(?!a\/c|your|vpa|ac\b)([A-Za-z][\w&.' ]{2,40}?)(?=\s*[.,;(]|\s+on\b|\s+ref|\s*$)/i,
  // "Info: NEFT-XXXX-ACME CORP"
  /\binfo[:\-\s]+([\w/\-. ]{2,60})/i,
];

const NOT_MERCHANTS = /^(?:your|you|a\/c|ac|account|card|hdfc bank|bank|rs|inr|upi|the|beneficiary)$/i;

function cleanMerchant(raw: string): string | null {
  // Bank boilerplate that follows the name: "SWIGGY Not you? ...", "AMAZON Avl Limit".
  let s = raw.replace(/\s+(?:not you|if not|call|avl|available|sms block|thank).*$/i, "").trim();
  if (s.includes("@")) s = s.split("@")[0]; // UPI ID → its name part
  if (/[/-]/.test(s) && /^(?:neft|imps|rtgs|upi|nach|ach)/i.test(s)) {
    // "NEFT-XXXX-ACME CORP" → "ACME CORP"
    const parts = s.split(/[/-]/).filter((p) => /[a-z]{3}/i.test(p) && !/^(?:neft|imps|rtgs|upi|nach|ach|cr|dr|p2m|p2a)$/i.test(p));
    s = parts[parts.length - 1] ?? "";
  }
  s = s.replace(/[._]+/g, " ").replace(/\d{5,}/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s+(?:on|ref|refno|via|using)$/i, "").trim();
  if (s.length < 2 || NOT_MERCHANTS.test(s) || !/[a-z]{2}/i.test(s)) return null;
  return s.slice(0, 40);
}

function findMerchant(body: string): string | null {
  for (const re of MERCHANT_PATTERNS) {
    const m = re.exec(body);
    if (!m) continue;
    const name = cleanMerchant(m[1]);
    if (name) return name;
  }
  return null;
}

/** Null when the SMS isn't a completed debit or credit (dues, offers, failed payments...). */
export function parseBankSms(address: string, body: string): ParsedSms | null {
  const text = body.replace(/\s+/g, " ").trim();
  if (NOT_A_TRANSACTION.test(text)) return null;

  const credit = firstIndex(CREDIT_WORDS, text);
  const debit = firstIndex(DEBIT_WORDS, text);
  if (credit < 0 && debit < 0) return null;
  // "Acct debited ...; SWIGGY credited" is a debit: the first verb is about our account.
  const direction = debit >= 0 && (credit < 0 || debit < credit) ? "debit" : "credit";

  const amount = findAmount(text);
  if (amount === null) return null;

  const last4 = findLast4(text);
  // Something has to tie it to an account: a number, or a payment reference.
  if (!last4 && !/\b(?:upi|ref|neft|imps|rtgs|a\/c|card)\b/i.test(text)) return null;

  const bal = BALANCE.exec(text.replace(/avl\.?\s*(?:limit|lmt)[^.]*/gi, ""));
  return {
    amount,
    direction,
    last4,
    card: /credit card|\bcard\b/i.test(text) && !/debit card/i.test(text),
    merchant: findMerchant(text),
    balance: bal ? toAmount(bal[1]) : null,
    bank: bankFromSender(address, text),
  };
}

export type CardBill = {
  bank: string | null;
  last4: string | null;
  /** Total amount due on the statement. */
  total: number;
  minDue: number | null;
  /** Local date, "YYYY-MM-DD". */
  dueDate: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONEY = String.raw`(?:rs\.?|inr|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)`;
const TOTAL_DUE = new RegExp(String.raw`\b(?:total|tot\.?)\s*(?:amt\.?|amount)?\s*(?:due|payable)\s*(?:is|of|:|-)?\s*${MONEY}`, "i");
const PAYMENT_DUE = new RegExp(String.raw`\bpayment of\s*${MONEY}\s*(?:is|was)?\s*(?:over)?due`, "i");
const MIN_DUE = new RegExp(String.raw`\bmin(?:imum)?\.?\s*(?:amt\.?|amount)?\s*due\s*(?:is|of|:|-)?\s*${MONEY}`, "i");
const DUE_DATE_AT = /\b(?:payment due date|due date|due on|due by|pay by|payable by|is due|on or before|by)\s*(?:is|:|-|of)?\s*(?:on\s+)?/gi;
const BILL_PAID = /\b(?:received|credited|thank you for (?:your |the )?payment|has been paid|payment successful|autopay (?:is )?(?:set|registered|scheduled))\b/i;

/** "05-11-26", "5/11/2026", "05-Nov-26", "5 November 2026", "2026-11-05" → "2026-11-05". */
function parseDate(s: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    const r = /^(\d{1,2})(?:st|nd|rd|th)?[-/ .]+(\d{1,2}|[a-z]{3,9})[-/ .,]+(\d{2,4})\b/i.exec(s);
    if (!r) return null;
    d = Number(r[1]);
    m = /^\d+$/.test(r[2]) ? Number(r[2]) : MONTHS.indexOf(r[2].slice(0, 3).toLowerCase()) + 1;
    y = Number(r[3]) < 100 ? 2000 + Number(r[3]) : Number(r[3]);
  }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y < 2100)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function findDueDate(text: string): string | null {
  for (const m of text.matchAll(DUE_DATE_AT)) {
    const date = parseDate(text.slice((m.index ?? 0) + m[0].length));
    if (date) return date;
  }
  return null;
}

/**
 * A credit card statement or "payment is due" reminder: what's owed and by when. Null for
 * anything else, including "payment received" messages (those are transfers).
 */
export function parseCardBill(address: string, body: string): CardBill | null {
  const text = body.replace(/\s+/g, " ").trim();
  if (!/credit card|\bcard\b/i.test(text) || /debit card/i.test(text)) return null;
  if (!/\bdue\b|\bpayable\b/i.test(text) || BILL_PAID.test(text)) return null;
  const total = TOTAL_DUE.exec(text) ?? PAYMENT_DUE.exec(text);
  if (!total) return null;
  const amount = toAmount(total[1]);
  const dueDate = findDueDate(text);
  if (!(amount > 0) || !dueDate) return null;
  const min = MIN_DUE.exec(text);
  return {
    bank: bankFromSender(address, text),
    last4: findLast4(text),
    total: amount,
    minDue: min ? toAmount(min[1]) : null,
    dueDate,
  };
}

/** Stable id for an SMS, sent as ``source_ref`` so it can never be imported twice. */
export function smsRef(address: string, body: string, date: number): string {
  const s = `${address}|${date}|${body}`;
  // Two 32-bit FNV-1a variants → 16 hex chars. For de-duplication only, not security.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 ^= h2 >>> 15;
  }
  return `sms:${h1.toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
