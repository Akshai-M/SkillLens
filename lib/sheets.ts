import { ALL_SHEET_NAMES } from "./competencies";
import { field, normalizeKey, type SheetRow } from "./report/fields";
import { normalizeAiReport } from "./report/ai";
import { ADMIN_KEY, AI_REPORT_KEY, RELEASED_KEY, type StudentData } from "./report/parse";

type SheetsResponse = {
  ok: boolean;
  data?: Record<string, { count: number; rows: SheetRow[] }>;
  errors?: Record<string, string>;
};

/** Internal columns that never leave the server. */
const PRIVATE_COLUMNS = new Set(
  [
    "",
    "Interviewer",
    "Meet Link",
    "Recording Link",
    "Transcript Link",
    "AI Report",
    "Comments",
    "Questions Asked",
    "Auditing Status",
    "Audit Remarks",
    "Feedback Submitted At",
    "Candidate Offline Cleared Date",
    "Program",
    "Template",
    "Partial Completion Reason",
  ].map(normalizeKey),
);

/** Columns kept for an interview whose result hasn't been released yet. */
const UNRELEASED_COLUMNS = new Set(["UID", "Candidate Name", "Candidate Email", "Round", "Date", "Time", "Status"].map(normalizeKey));

const LEVEL_COLUMNS = new Set(["Levels", "Level", "Verdict Band"].map(normalizeKey));

/** Prepares a row for a student's browser: private columns, unreleased feedback and internal notes removed. */
function sanitize(row: SheetRow): SheetRow {
  const completed = field(row, "Status").toLowerCase() === "completed";
  const released = !completed || process.env.REPORT_REQUIRE_SHARED === "false" || field(row, "Result shared with students status") !== "";
  // Students who didn't clear see a target level instead of their level or verdict band.
  const notCleared = /not\s*cleared/i.test(field(row, "Clearance Status"));

  const clean: SheetRow = {};
  for (const [k, v] of Object.entries(row)) {
    const key = normalizeKey(k);
    const value = String(v ?? "").trim();
    if (!value || PRIVATE_COLUMNS.has(key)) continue;
    if (!released && !UNRELEASED_COLUMNS.has(key)) continue;
    if (notCleared && LEVEL_COLUMNS.has(key)) continue;
    if (key === AI_REPORT_KEY) {
      // Keep only the student-facing parts of the JSON report (drops internal_only etc.).
      const report = normalizeAiReport(value);
      if (report) clean[k] = JSON.stringify(report);
      continue;
    }
    clean[k] = value;
  }
  clean[RELEASED_KEY] = released ? "yes" : "no";
  return clean;
}

/** Admin rows keep every column; the JSON report keeps its internal data-quality flags. */
function adminRow(row: SheetRow): SheetRow {
  const clean: SheetRow = {};
  for (const [k, v] of Object.entries(row)) {
    const value = String(v ?? "").trim();
    if (!value || !k.trim()) continue;
    if (normalizeKey(k) === AI_REPORT_KEY) {
      const report = normalizeAiReport(value, { includeInternal: true });
      if (report) clean[k] = JSON.stringify(report);
      continue;
    }
    clean[k] = value;
  }
  clean[RELEASED_KEY] = "yes";
  clean[ADMIN_KEY] = "yes";
  return clean;
}

/** The same interview can appear more than once; keep the most complete copy. */
function dedupe(rows: SheetRow[]): SheetRow[] {
  const byKey = new Map<string, SheetRow>();
  for (const row of rows) {
    const key = ["UID", "Date", "Time", "Status"].map((c) => field(row, c).toLowerCase()).join("|");
    const existing = byKey.get(key);
    if (!existing || Object.keys(row).length > Object.keys(existing).length) byKey.set(key, row);
  }
  return [...byKey.values()];
}

async function fetchRows(email: string): Promise<Record<string, SheetRow[]>> {
  const base = process.env.SHEETS_API_URL;
  if (!base) throw new Error("SHEETS_API_URL is not set");

  const url = new URL(base);
  url.searchParams.set("email", email);
  url.searchParams.set("sheets", ALL_SHEET_NAMES.join(","));

  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API responded ${res.status}`);

  const json = (await res.json()) as SheetsResponse;
  if (!json.ok || !json.data) throw new Error(`Sheets API error: ${JSON.stringify(json.errors ?? {})}`);

  const rows: Record<string, SheetRow[]> = {};
  for (const [sheet, { rows: sheetRows }] of Object.entries(json.data)) rows[sheet] = sheetRows ?? [];
  return rows;
}

function build(email: string, raw: Record<string, SheetRow[]>, prepare: (row: SheetRow) => SheetRow): StudentData {
  const sheets: StudentData["sheets"] = {};
  let name = "";
  for (const [sheet, rows] of Object.entries(raw)) {
    sheets[sheet] = dedupe(rows.map(prepare));
    name ||= field(sheets[sheet][0] ?? {}, "Candidate Name");
  }
  return { v: 2, email, name, fetchedAt: Date.now(), sheets };
}

/**
 * Fetches one student's interviews across every competency sheet. Only called on
 * login and when the student presses Refetch; the result is kept in localStorage.
 */
export async function fetchStudentData(email: string): Promise<StudentData> {
  return build(email, await fetchRows(email), sanitize);
}

/** Full, unfiltered data for the admin dashboard. Never stored in the browser. */
export async function fetchAdminData(email: string): Promise<StudentData> {
  return build(email, await fetchRows(email), adminRow);
}

export function hasInterviews(data: StudentData): boolean {
  return Object.values(data.sheets).some((rows) => rows.length > 0);
}
