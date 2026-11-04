// Published-report metadata taken from a student's raw sheet rows, so analytics can store
// reports in the database without a separate "all students" sheet endpoint.
import { COMPETENCIES } from "../competencies";
import { field, type SheetRow } from "../report/fields";
import { reportKey } from "../report/parse";

export type PublishedReport = {
  key: string;
  competency: string;
  interviewDate: string;
  /** "Feedback Submitted At" as UTC milliseconds, used as the publication time. */
  publishedAt: number | null;
};

const SHEET_TO_COMPETENCY = new Map(COMPETENCIES.flatMap((c) => c.sheets.map((s) => [s.name, c.slug] as const)));
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * "31/08/2026, 18:27:07" (day first, 24h) or "9/4/2026, 5:08:37 PM" (month first, 12h).
 * Sheet times are IST; returns UTC milliseconds.
 */
export function parseSubmittedAt(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  const [, a, b, y, hh, mm, ss, ampm] = m;
  let day = Number(a);
  let month = Number(b);
  let hour = Number(hh);
  if (ampm) {
    [month, day] = [day, month]; // US style when the clock is 12-hour
    hour = (hour % 12) + (ampm.toUpperCase() === "PM" ? 12 : 0);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(Number(y), month - 1, day, hour, Number(mm), Number(ss ?? 0)) - IST_OFFSET_MS;
}

/** Completed interviews whose result has been released to the student. */
export function publishedReports(raw: Record<string, SheetRow[]>): PublishedReport[] {
  const requireShared = process.env.REPORT_REQUIRE_SHARED !== "false";
  const out = new Map<string, PublishedReport>();
  for (const [sheet, rows] of Object.entries(raw)) {
    const competency = SHEET_TO_COMPETENCY.get(sheet);
    if (!competency) continue;
    for (const row of rows) {
      if (!field(row, "UID") || field(row, "Status").toLowerCase() !== "completed") continue;
      if (requireShared && field(row, "Result shared with students status") === "") continue;
      const key = reportKey(sheet, row);
      if (!out.has(key)) {
        out.set(key, { key, competency, interviewDate: field(row, "Date"), publishedAt: parseSubmittedAt(field(row, "Feedback Submitted At")) });
      }
    }
  }
  return [...out.values()];
}
