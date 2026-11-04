// Display helpers for analytics: timestamps are stored in UTC and shown in IST.

const IST = "Asia/Kolkata";

export function formatIst(ms: number | null | undefined, withTime = true): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return "0s";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatPercent(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

/** "2026-11-04" → "4 Nov"; week/month buckets get a fitting label. */
export function formatBucket(bucket: string, granularity: "day" | "week" | "month"): string {
  const [y, m, d] = bucket.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (granularity === "month") return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  const label = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return granularity === "week" ? `Wk of ${label}` : label;
}

export function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}
