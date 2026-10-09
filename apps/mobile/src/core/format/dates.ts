/** Date helpers in the phone's local time (India for us). */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type YearMonth = { year: number; month: number }; // month 1–12

export function currentMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function sameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month, 0).getDate();
}

/** [start, end) of a month in local time, as ISO strings for the API. */
export function monthRangeISO({ year, month }: YearMonth): { start: string; end: string } {
  return {
    start: new Date(year, month - 1, 1).toISOString(),
    end: new Date(year, month, 1).toISOString(),
  };
}

export function monthName(ym: YearMonth, long = true): string {
  return (long ? MONTHS_LONG : MONTHS)[ym.month - 1];
}

/** "OCT 2026" */
export function monthTag(ym: YearMonth): string {
  return `${MONTHS[ym.month - 1].toUpperCase()} ${ym.year}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "FRI · 09 OCT" */
export function monoDate(d: Date): string {
  return `${DAYS[d.getDay()].toUpperCase()} · ${pad2(d.getDate())} ${MONTHS[d.getMonth()].toUpperCase()}`;
}

/** "12 OCT" */
export function monoDay(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()].toUpperCase()}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDay(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today to ``d`` (negative = past). */
export function daysFromToday(d: Date, now = new Date()): number {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "Today" · "Yesterday" · "Fri, 9 Oct" */
export function dayHeader(d: Date, now = new Date()): string {
  const diff = daysFromToday(d, now);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "IN 3 DAYS" · "TODAY" · "TOMORROW" · "2 DAYS AGO" */
export function relativeDueTag(d: Date, now = new Date()): string {
  const diff = daysFromToday(d, now);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "TOMORROW";
  if (diff > 1) return `IN ${diff} DAYS`;
  if (diff === -1) return "YESTERDAY";
  return `${-diff} DAYS AGO`;
}

/** "8:42 pm" */
export function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = pad2(d.getMinutes());
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
