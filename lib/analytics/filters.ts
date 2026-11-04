// Global dashboard filters, read from the URL. Day boundaries follow IST; values are compared in UTC.
// Student-table filters live in the browser (components/analytics/student-table.tsx).
export type RangeKey = "today" | "7d" | "30d" | "custom";
export type Granularity = "day" | "week" | "month";

export type AnalyticsFilters = {
  range: RangeKey;
  /** Custom range, inclusive IST dates as YYYY-MM-DD. */
  from: string;
  to: string;
  trend: Granularity;
};

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseFilters(params: Params): AnalyticsFilters {
  const range = one(params, "range");
  const trend = one(params, "trend");
  const from = one(params, "from");
  const to = one(params, "to");
  const custom = range === "custom" && isDate(from) && isDate(to);
  return {
    range: custom ? "custom" : range === "today" || range === "7d" ? range : "30d",
    from: custom ? from : "",
    to: custom ? to : "",
    trend: trend === "week" || trend === "month" ? trend : "day",
  };
}

/** Start of the IST calendar day containing `ms`, as UTC milliseconds. */
export function istDayStart(ms: number): number {
  const ist = new Date(ms + IST_OFFSET_MS);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
}

function istDateToUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
}

/** [from, to) in UTC milliseconds for the selected range. */
export function resolveRange(f: AnalyticsFilters, now: number): { from: number; to: number } {
  const today = istDayStart(now);
  if (f.range === "today") return { from: today, to: now };
  if (f.range === "7d") return { from: today - 6 * DAY_MS, to: now };
  if (f.range === "custom") {
    const a = istDateToUtc(f.from);
    const b = istDateToUtc(f.to) + DAY_MS;
    return a <= b ? { from: a, to: Math.min(b, now) } : { from: istDateToUtc(f.to), to: Math.min(a + DAY_MS, now) };
  }
  return { from: today - 29 * DAY_MS, to: now };
}

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom range",
};
