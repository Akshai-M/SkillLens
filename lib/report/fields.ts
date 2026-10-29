// Pure helpers shared by the server fetcher and the client-side report views.

export type SheetRow = Record<string, string>;

/** Column names in the sheets have stray spaces/newlines; compare them loosely. */
export function normalizeKey(key: string): string {
  return key.replace(/\s+/g, " ").trim().toLowerCase();
}

/** First non-empty value among the given column names. */
export function field(row: SheetRow, ...names: string[]): string {
  const wanted = names.map(normalizeKey);
  for (const name of wanted) {
    for (const [k, v] of Object.entries(row)) {
      if (normalizeKey(k) === name) {
        const value = String(v ?? "").trim();
        if (value) return value;
      }
    }
  }
  return "";
}

export function num(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parses "31-Aug-2026", "August 31, 2026" and "09/10/2026" (dd/mm/yyyy) into a UTC timestamp. */
export function interviewTimestamp(date: string): number {
  const dmy = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const named = date.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (named) {
    const month = MONTHS.indexOf(named[2].toLowerCase());
    if (month >= 0) return Date.UTC(+named[3], month, +named[1]);
  }
  const long = date.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (long) {
    const month = MONTHS.indexOf(long[1].slice(0, 3).toLowerCase());
    if (month >= 0) return Date.UTC(+long[3], month, +long[2]);
  }
  return 0;
}

/** "05:00 PM" or "19:00" → minutes since midnight, for ordering same-day attempts. */
export function timeMinutes(time: string): number {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = +m[1];
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + +m[2];
}

export function formatDate(date: string): string {
  const ts = interviewTimestamp(date);
  if (!ts) return date;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
