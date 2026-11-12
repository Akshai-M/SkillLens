// Server-side event recording. The student is always taken from the signed session,
// never from the client payload.
import { db, isUuid } from "../db";
import type { PublishedReport } from "./published";
import { parseUserAgent } from "./ua";

/** Stable student ID for an email, created on first sign-in. */
export async function ensureStudent(email: string, name: string): Promise<string> {
  const d = await db();
  const [row] = await d.query<{ id: string }>(
    `INSERT INTO skilllens.students (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE skilllens.students.name END
     RETURNING id`,
    [email, name],
  );
  return row.id;
}

export async function studentIdForEmail(email: string): Promise<string | null> {
  const d = await db();
  const [row] = await d.query<{ id: string }>(`SELECT id FROM skilllens.students WHERE email = $1`, [email]);
  return row?.id ?? null;
}

/** Stores a student's published reports; each report is one row, so re-recording never duplicates. */
export async function recordPublishedReports(studentId: string, reports: PublishedReport[]): Promise<void> {
  const d = await db();
  for (const r of reports) {
    await d.query(
      `INSERT INTO skilllens.reports AS r (report_key, student_id, competency, interview_date, published_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (report_key) DO UPDATE SET
         student_id = EXCLUDED.student_id,
         competency = EXCLUDED.competency,
         interview_date = EXCLUDED.interview_date,
         published_at = coalesce(EXCLUDED.published_at, r.published_at),
         last_recorded_at = now()`,
      [r.key, studentId, r.competency, r.interviewDate, r.publishedAt == null ? null : new Date(r.publishedAt).toISOString()],
    );
  }
}

export async function recordLogin(input: {
  email: string;
  studentId: string | null;
  success: boolean;
  reason?: string;
  userAgent: string | null;
}): Promise<void> {
  const d = await db();
  const ua = parseUserAgent(input.userAgent);
  await d.query(
    `INSERT INTO skilllens.logins (student_id, email, success, reason, device_type, browser, os) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.studentId, input.email.slice(0, 320), input.success, input.reason ?? "", ua.deviceType, ua.browser, ua.os],
  );
}

/** Events the browser tracker sends. */
export type TrackEvent =
  | { t: "pageview"; path: string }
  | { t: "report"; viewId: string; competency: string; reportKey: string }
  | { t: "active"; ms: number; reportViewId?: string; section?: string }
  | { t: "practice"; reportViewId: string; name: string; link: string; week: number };

/** Report tabs whose viewing time is tracked. */
export const REPORT_SECTIONS = ["overview", "domains", "concepts", "plan"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export type TrackPayload = { sessionId: string; visitId: string; path: string; events: TrackEvent[] };

/** Most active time a single flush can add; the tracker flushes every 15 seconds. */
const MAX_ACTIVE_MS_PER_EVENT = 2 * 60 * 1000;

function clean(text: unknown, max: number): string {
  return typeof text === "string" ? text.slice(0, max) : "";
}

/** Keeps only http(s) links, since admins open these from the dashboard. */
function cleanLink(link: unknown): string {
  try {
    const url = new URL(clean(link, 500));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function recordEvents(studentId: string, payload: TrackPayload, userAgent: string | null): Promise<void> {
  if (!isUuid(payload.sessionId) || !isUuid(payload.visitId) || !Array.isArray(payload.events)) return;
  const d = await db();
  const ua = parseUserAgent(userAgent);
  const path = clean(payload.path, 300) || "/";

  // Session and visit are created on first sight. A session/visit id that belongs to someone else is ignored.
  const session = await d.query(
    `INSERT INTO skilllens.sessions (id, student_id, device_type, browser, os) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now() WHERE skilllens.sessions.student_id = EXCLUDED.student_id
     RETURNING id`,
    [payload.sessionId, studentId, ua.deviceType, ua.browser, ua.os],
  );
  if (session.length === 0) return;
  const visit = await d.query(
    `INSERT INTO skilllens.visits (id, student_id, session_id, entry_path) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = now() WHERE skilllens.visits.student_id = EXCLUDED.student_id
     RETURNING id`,
    [payload.visitId, studentId, payload.sessionId, path],
  );
  if (visit.length === 0) return;

  for (const e of payload.events.slice(0, 50)) {
    if (e.t === "pageview") {
      await d.query(`INSERT INTO skilllens.page_views (student_id, session_id, visit_id, path) VALUES ($1, $2, $3, $4)`, [
        studentId,
        payload.sessionId,
        payload.visitId,
        clean(e.path, 300) || "/",
      ]);
    } else if (e.t === "report" && isUuid(e.viewId)) {
      await d.query(
        `INSERT INTO skilllens.report_views (id, student_id, session_id, competency, report_key) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [e.viewId, studentId, payload.sessionId, clean(e.competency, 80), clean(e.reportKey, 300)],
      );
    } else if (e.t === "active") {
      const ms = Math.round(Math.min(MAX_ACTIVE_MS_PER_EVENT, Math.max(0, Number(e.ms) || 0)));
      if (ms === 0) continue;
      await d.query(`UPDATE skilllens.sessions SET active_ms = active_ms + $1, last_seen_at = now() WHERE id = $2 AND student_id = $3`, [
        ms,
        payload.sessionId,
        studentId,
      ]);
      await d.query(`UPDATE skilllens.visits SET active_ms = active_ms + $1, last_seen_at = now() WHERE id = $2 AND student_id = $3`, [
        ms,
        payload.visitId,
        studentId,
      ]);
      if (isUuid(e.reportViewId)) {
        await d.query(
          `UPDATE skilllens.report_views SET active_ms = active_ms + $1, last_seen_at = now() WHERE id = $2 AND student_id = $3`,
          [ms, e.reportViewId, studentId],
        );
        if (REPORT_SECTIONS.includes(e.section as ReportSection)) {
          // Only for the student's own report view (the SELECT also guarantees the view exists).
          await d.query(
            `INSERT INTO skilllens.report_section_time AS t (report_view_id, student_id, section, active_ms)
             SELECT id, student_id, $4, $1 FROM skilllens.report_views WHERE id = $2 AND student_id = $3
             ON CONFLICT (report_view_id, section) DO UPDATE SET active_ms = t.active_ms + EXCLUDED.active_ms, last_seen_at = now()`,
            [ms, e.reportViewId, studentId, e.section],
          );
        }
      }
    } else if (e.t === "practice" && isUuid(e.reportViewId)) {
      const name = clean(e.name, 300).trim();
      if (!name) continue;
      const week = Number.isInteger(e.week) && e.week > 0 && e.week < 100 ? e.week : null;
      // Only for the student's own report view; competency and report come from that view.
      await d.query(
        `INSERT INTO skilllens.practice_clicks (student_id, session_id, report_view_id, competency, report_key, question, link, week)
         SELECT student_id, $3, id, competency, report_key, $4, $5, $6 FROM skilllens.report_views WHERE id = $1 AND student_id = $2`,
        [e.reportViewId, studentId, payload.sessionId, name, cleanLink(e.link), week],
      );
    }
  }
}
