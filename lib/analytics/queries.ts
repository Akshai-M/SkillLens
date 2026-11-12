// Admin analytics calculations. SQL does per-student / per-bucket aggregation; the
// metric definitions are applied here so they're easy to read and adjust.
import { COMPETENCIES } from "../competencies";
import { db } from "../db";
import { getAdminRole } from "../session";
import { istDayStart, resolveRange, type AnalyticsFilters, type Granularity } from "./filters";
import { REPORT_SECTIONS, type ReportSection } from "./record";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Students with no visit in this many days are inactive. */
const INACTIVE_AFTER_DAYS = 14;
const TZ = "Asia/Kolkata";

export type Frequency = "Daily" | "Weekly" | "Occasionally" | "Never";

export type StudentActivity = {
  email: string;
  name: string;
  firstVisit: number | null;
  lastVisit: number | null;
  visits: number;
  sessions: number;
  timeSpentMs: number;
  avgSessionMs: number;
  frequency: Frequency;
  activeDays: number;
  reportsViewed: number;
  lastReport: { competency: string; at: number } | null;
  lastLogin: number | null;
  /** Competencies the student has a published report in, or has viewed a report for. */
  competencies: string[];
  /** Active report-viewing time per competency slug, in the range. */
  competencyMs: Record<string, number>;
  /** Active time per report tab within each competency (slug → tab → ms). */
  sectionByCompetencyMs: Record<string, Record<ReportSection, number>>;
  /** Active time per report tab, for report views opened in the range. */
  sectionMs: Record<ReportSection, number>;
  /** Practice question clicks in the range, and how many different questions they were on. */
  practiceClicks: number;
  practiceQuestions: number;
  lastPracticeClick: number | null;
  status: "active" | "inactive";
  type: "new" | "returning" | null;
};

export type PracticeQuestionStat = { question: string; competency: string; link: string; clicks: number; students: number; lastClick: number | null };

export type Bucket = { bucket: string; visitors: number; visits: number; newVisitors: number; returningVisitors: number };
export type Breakdown = { label: string; users: number; sessions: number };
export type ReportStat = {
  key: string;
  competency: string;
  email: string;
  views: number;
  avgViewMs: number;
  firstView: number | null;
  publishedAt: number | null;
};

export type Analytics = {
  range: { from: number; to: number };
  overview: {
    registered: number;
    uniqueVisitors: number;
    totalVisits: number;
    dau: number;
    wau: number;
    mau: number;
    newVisitors: number;
    returningVisitors: number;
    inactive: number;
    neverVisited: number;
  };
  students: StudentActivity[];
  engagement: {
    avgVisits: number;
    avgSessions: number;
    avgTimeMs: number;
    mostActive: StudentActivity[];
    leastActive: StudentActivity[];
    mostReturning: StudentActivity[];
    peakHours: { hour: number; visits: number }[];
    trend: Bucket[];
    granularity: Granularity;
    retention: { days: number; eligible: number; retained: number }[];
  };
  reports: {
    published: number;
    publishedInRange: number;
    views: number;
    uniqueViewers: number;
    notViewedStudents: string[];
    repeatViews: number;
    studentsWithRepeats: number;
    avgViewMs: number;
    mostViewed: ReportStat[];
    perReport: ReportStat[];
  };
  devices: { deviceTypes: Breakdown[]; browsers: Breakdown[]; os: Breakdown[] };
  sections: { section: ReportSection; totalMs: number; students: number; views: number; avgPerStudentMs: number }[];
  practice: { clicks: number; students: number; questions: number; topQuestions: PracticeQuestionStat[] };
  auth: {
    successes: number;
    failures: number;
    uniqueStudents: number;
    perStudent: number;
    successRate: number | null;
    lastSuccess: { email: string; at: number } | null;
    failureReasons: { reason: string; count: number }[];
  };
};

const ms = (d: unknown): number | null => (d == null ? null : new Date(d as string).getTime());
const num = (v: unknown): number => Number(v ?? 0) || 0;

export function frequencyFor(activeDaysIn30: number): Frequency {
  if (activeDaysIn30 >= 12) return "Daily";
  if (activeDaysIn30 >= 4) return "Weekly";
  if (activeDaysIn30 >= 1) return "Occasionally";
  return "Never";
}

/** Empty buckets are filled so trends show quiet days as zero. */
function fillBuckets(rows: Bucket[], from: number, to: number, granularity: Granularity): Bucket[] {
  if (granularity !== "day") return rows;
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const out: Bucket[] = [];
  for (let t = istDayStart(from); t < to; t += DAY_MS) {
    const key = new Date(t + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    out.push(byKey.get(key) ?? { bucket: key, visitors: 0, visits: 0, newVisitors: 0, returningVisitors: 0 });
  }
  return out;
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<Analytics> {
  if ((await getAdminRole()) !== "full") throw new Error("User analytics are restricted to the full admin account");

  const now = Date.now();
  const { from, to } = resolveRange(filters, now);
  const p = [new Date(from).toISOString(), new Date(to).toISOString()];
  const IN_RANGE = (col: string) => `${col} >= $1::timestamptz AND ${col} < $2::timestamptz`;
  const d = await db();

  // Every student who has signed in, and their published reports, are stored in the database.
  const [studentRows, publishedRows] = await Promise.all([
    d.query(`SELECT email, name FROM skilllens.students`),
    d.query(
      `SELECT r.report_key, r.competency, s.email, r.published_at
       FROM skilllens.reports r JOIN skilllens.students s ON s.id = r.student_id`,
    ),
  ]);
  const roster = {
    students: studentRows.map((r) => ({ email: String(r.email), name: String(r.name ?? "") })),
    reports: publishedRows.map((r) => ({
      key: String(r.report_key),
      competency: String(r.competency),
      email: String(r.email),
      publishedAt: ms(r.published_at),
    })),
  };

  const [visitRows, sessionRows, reportRows, lastReportRows, loginRows, trendRows, hourRows, retentionRows, deviceRows, browserRows, osRows, authRow, reasonRows, lastLoginRow, perReportRows, sectionRows, competencyRows, practiceStudentRows, practiceQuestionRows] =
    await Promise.all([
      d.query(
        `SELECT s.email, s.name,
           min(v.started_at) AS first_visit, max(v.last_seen_at) AS last_visit,
           count(*) FILTER (WHERE ${IN_RANGE("v.started_at")})::int AS visits,
           count(DISTINCT (v.started_at AT TIME ZONE '${TZ}')::date) FILTER (WHERE ${IN_RANGE("v.started_at")})::int AS active_days,
           count(DISTINCT (v.started_at AT TIME ZONE '${TZ}')::date) FILTER (WHERE v.started_at >= now() - interval '30 days')::int AS days_30
         FROM skilllens.visits v JOIN skilllens.students s ON s.id = v.student_id
         GROUP BY s.email, s.name`,
        p,
      ),
      d.query(
        `SELECT s.email, count(*)::int AS sessions, coalesce(sum(x.active_ms), 0)::float8 AS active_ms
         FROM skilllens.sessions x JOIN skilllens.students s ON s.id = x.student_id
         WHERE ${IN_RANGE("x.started_at")} GROUP BY s.email`,
        p,
      ),
      d.query(
        `SELECT s.email, count(DISTINCT r.report_key)::int AS reports_viewed, count(*)::int AS views
         FROM skilllens.report_views r JOIN skilllens.students s ON s.id = r.student_id
         WHERE ${IN_RANGE("r.opened_at")} GROUP BY s.email`,
        p,
      ),
      d.query(
        `SELECT DISTINCT ON (r.student_id) s.email, r.competency, r.opened_at
         FROM skilllens.report_views r JOIN skilllens.students s ON s.id = r.student_id
         ORDER BY r.student_id, r.opened_at DESC`,
      ),
      d.query(
        `SELECT s.email, max(l.occurred_at) AS last_login
         FROM skilllens.logins l JOIN skilllens.students s ON s.id = l.student_id
         WHERE l.success GROUP BY s.email`,
      ),
      d.query(
        `WITH firsts AS (SELECT student_id, min(started_at) AS f FROM skilllens.visits GROUP BY student_id)
         SELECT to_char(date_trunc($3::text, v.started_at AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS bucket,
           count(DISTINCT v.student_id)::int AS visitors, count(*)::int AS visits,
           count(DISTINCT v.student_id) FILTER (
             WHERE date_trunc($3::text, f.f AT TIME ZONE '${TZ}') = date_trunc($3::text, v.started_at AT TIME ZONE '${TZ}')
           )::int AS new_visitors
         FROM skilllens.visits v JOIN firsts f ON f.student_id = v.student_id
         WHERE ${IN_RANGE("v.started_at")} GROUP BY 1 ORDER BY 1`,
        [...p, filters.trend],
      ),
      d.query(
        `SELECT extract(hour FROM v.started_at AT TIME ZONE '${TZ}')::int AS hour, count(*)::int AS visits
         FROM skilllens.visits v WHERE ${IN_RANGE("v.started_at")} GROUP BY 1`,
        p,
      ),
      d.query(
        `WITH firsts AS (SELECT student_id, min(started_at) AS f FROM skilllens.visits GROUP BY student_id)
         SELECT n.days,
           count(*) FILTER (WHERE f.f <= now() - make_interval(days => n.days))::int AS eligible,
           count(*) FILTER (WHERE f.f <= now() - make_interval(days => n.days) AND EXISTS (
             SELECT 1 FROM skilllens.visits v WHERE v.student_id = f.student_id AND v.started_at >= f.f + make_interval(days => n.days)
           ))::int AS retained
         FROM firsts f CROSS JOIN (VALUES (1), (7), (30)) AS n(days) GROUP BY n.days ORDER BY n.days`,
      ),
      ...(["device_type", "browser", "os"] as const).map((col) =>
        d.query(
          `SELECT ${col} AS label, count(DISTINCT student_id)::int AS users, count(*)::int AS sessions
           FROM skilllens.sessions WHERE ${IN_RANGE("started_at")} GROUP BY 1 ORDER BY 3 DESC`,
          p,
        ),
      ),
      d.query(
        `SELECT count(*) FILTER (WHERE success)::int AS ok, count(*) FILTER (WHERE NOT success)::int AS failed,
           count(DISTINCT student_id) FILTER (WHERE success)::int AS students
         FROM skilllens.logins WHERE ${IN_RANGE("occurred_at")}`,
        p,
      ),
      d.query(
        `SELECT reason, count(*)::int AS count FROM skilllens.logins
         WHERE NOT success AND ${IN_RANGE("occurred_at")} GROUP BY reason ORDER BY 2 DESC`,
        p,
      ),
      d.query(`SELECT email, occurred_at FROM skilllens.logins WHERE success ORDER BY occurred_at DESC LIMIT 1`),
      d.query(
        `SELECT r.report_key, s.email, count(*)::int AS views, min(r.opened_at) AS first_view,
           coalesce(sum(r.active_ms), 0)::float8 AS active_ms
         FROM skilllens.report_views r JOIN skilllens.students s ON s.id = r.student_id
         GROUP BY r.report_key, s.email`,
      ),
      d.query(
        `SELECT s.email, r.competency, t.section, coalesce(sum(t.active_ms), 0)::float8 AS ms, count(DISTINCT t.report_view_id)::int AS views
         FROM skilllens.report_section_time t
         JOIN skilllens.report_views r ON r.id = t.report_view_id
         JOIN skilllens.students s ON s.id = t.student_id
         WHERE ${IN_RANGE("r.opened_at")}
         GROUP BY s.email, r.competency, t.section`,
        p,
      ),
      d.query(
        `SELECT s.email, r.competency, coalesce(sum(r.active_ms), 0)::float8 AS ms
         FROM skilllens.report_views r JOIN skilllens.students s ON s.id = r.student_id
         WHERE ${IN_RANGE("r.opened_at")}
         GROUP BY s.email, r.competency`,
        p,
      ),
      d.query(
        `SELECT s.email, count(*)::int AS clicks, count(DISTINCT c.question)::int AS questions, max(c.clicked_at) AS last_click
         FROM skilllens.practice_clicks c JOIN skilllens.students s ON s.id = c.student_id
         WHERE ${IN_RANGE("c.clicked_at")} GROUP BY s.email`,
        p,
      ),
      d.query(
        `SELECT c.question, c.competency, max(c.link) AS link, count(*)::int AS clicks,
           count(DISTINCT c.student_id)::int AS students, max(c.clicked_at) AS last_click
         FROM skilllens.practice_clicks c
         WHERE ${IN_RANGE("c.clicked_at")}
         GROUP BY c.question, c.competency ORDER BY clicks DESC, students DESC, c.question`,
        p,
      ),
    ]);

  // ---- Student-wise activity ------------------------------------------------
  type Agg = Partial<StudentActivity> & { email: string; days30?: number };
  const byEmail = new Map<string, Agg>();
  const get = (email: string): Agg => {
    let row = byEmail.get(email);
    if (!row) byEmail.set(email, (row = { email }));
    return row;
  };
  for (const s of roster.students) get(s.email).name = s.name;
  for (const r of visitRows) {
    const a = get(String(r.email));
    a.name ||= String(r.name ?? "");
    a.firstVisit = ms(r.first_visit);
    a.lastVisit = ms(r.last_visit);
    a.visits = num(r.visits);
    a.activeDays = num(r.active_days);
    a.days30 = num(r.days_30);
  }
  for (const r of sessionRows) Object.assign(get(String(r.email)), { sessions: num(r.sessions), timeSpentMs: num(r.active_ms) });
  for (const r of reportRows) get(String(r.email)).reportsViewed = num(r.reports_viewed);
  for (const r of lastReportRows) get(String(r.email)).lastReport = { competency: String(r.competency), at: ms(r.opened_at)! };
  for (const r of loginRows) get(String(r.email)).lastLogin = ms(r.last_login);
  for (const r of practiceStudentRows) {
    Object.assign(get(String(r.email)), { practiceClicks: num(r.clicks), practiceQuestions: num(r.questions), lastPracticeClick: ms(r.last_click) });
  }
  for (const r of competencyRows) {
    const a = get(String(r.email));
    a.competencyMs ??= {};
    a.competencyMs[String(r.competency)] = (a.competencyMs[String(r.competency)] ?? 0) + num(r.ms);
  }
  const emptySections = () => Object.fromEntries(REPORT_SECTIONS.map((x) => [x, 0])) as Record<ReportSection, number>;
  for (const r of sectionRows) {
    if (!REPORT_SECTIONS.includes(r.section as ReportSection)) continue;
    const a = get(String(r.email));
    const section = r.section as ReportSection;
    const comp = String(r.competency);
    a.sectionMs ??= emptySections();
    a.sectionMs[section] += num(r.ms);
    a.sectionByCompetencyMs ??= {};
    a.sectionByCompetencyMs[comp] ??= emptySections();
    a.sectionByCompetencyMs[comp][section] += num(r.ms);
  }

  const competenciesByEmail = new Map<string, string[]>();
  for (const r of roster.reports) competenciesByEmail.set(r.email, [...(competenciesByEmail.get(r.email) ?? []), r.competency]);

  const inactiveBefore = now - INACTIVE_AFTER_DAYS * DAY_MS;
  const students: StudentActivity[] = [...byEmail.values()].map((a) => {
    const sessions = a.sessions ?? 0;
    const time = a.timeSpentMs ?? 0;
    const visits = a.visits ?? 0;
    const firstVisit = a.firstVisit ?? null;
    return {
      email: a.email,
      name: a.name ?? "",
      firstVisit,
      lastVisit: a.lastVisit ?? null,
      visits,
      sessions,
      timeSpentMs: time,
      avgSessionMs: sessions ? time / sessions : 0,
      frequency: frequencyFor(a.days30 ?? 0),
      activeDays: a.activeDays ?? 0,
      reportsViewed: a.reportsViewed ?? 0,
      lastReport: a.lastReport ?? null,
      lastLogin: a.lastLogin ?? null,
      sectionMs: a.sectionMs ?? emptySections(),
      sectionByCompetencyMs: a.sectionByCompetencyMs ?? {},
      competencyMs: a.competencyMs ?? {},
      competencies: [...new Set([...(competenciesByEmail.get(a.email) ?? []), ...Object.keys(a.competencyMs ?? {})])],
      practiceClicks: a.practiceClicks ?? 0,
      practiceQuestions: a.practiceQuestions ?? 0,
      lastPracticeClick: a.lastPracticeClick ?? null,
      status: a.lastVisit && a.lastVisit >= inactiveBefore ? "active" : "inactive",
      type: visits === 0 || firstVisit === null ? null : firstVisit >= from ? "new" : "returning",
    };
  });
  students.sort((a, b) => (b.lastVisit ?? 0) - (a.lastVisit ?? 0) || a.email.localeCompare(b.email));

  // ---- Overview ---------------------------------------------------------------
  const visitors = students.filter((s) => s.visits > 0);
  const todayStart = istDayStart(now);
  const overview = {
    registered: roster.students.length,
    uniqueVisitors: visitors.length,
    totalVisits: visitors.reduce((n, s) => n + s.visits, 0),
    dau: students.filter((s) => (s.lastVisit ?? 0) >= todayStart).length,
    wau: students.filter((s) => (s.lastVisit ?? 0) >= now - 7 * DAY_MS).length,
    mau: students.filter((s) => (s.lastVisit ?? 0) >= now - 30 * DAY_MS).length,
    newVisitors: visitors.filter((s) => s.type === "new").length,
    returningVisitors: visitors.filter((s) => s.type === "returning").length,
    inactive: students.filter((s) => s.status === "inactive").length,
    neverVisited: students.filter((s) => s.lastVisit === null).length,
  };

  // ---- Engagement -------------------------------------------------------------
  const n = visitors.length || 1;
  const byTime = [...visitors].sort((a, b) => b.timeSpentMs - a.timeSpentMs);
  const hours = new Map(hourRows.map((r) => [num(r.hour), num(r.visits)]));
  const trend = fillBuckets(
    trendRows.map((r) => ({
      bucket: String(r.bucket),
      visitors: num(r.visitors),
      visits: num(r.visits),
      newVisitors: num(r.new_visitors),
      returningVisitors: num(r.visitors) - num(r.new_visitors),
    })),
    from,
    to,
    filters.trend,
  );
  const engagement = {
    avgVisits: visitors.reduce((t, s) => t + s.visits, 0) / n,
    avgSessions: visitors.reduce((t, s) => t + s.sessions, 0) / n,
    avgTimeMs: visitors.reduce((t, s) => t + s.timeSpentMs, 0) / n,
    mostActive: byTime.slice(0, 5),
    leastActive: byTime.slice(-5).reverse(),
    mostReturning: [...visitors].sort((a, b) => b.activeDays - a.activeDays || b.visits - a.visits).slice(0, 5),
    peakHours: Array.from({ length: 24 }, (_, hour) => ({ hour, visits: hours.get(hour) ?? 0 })),
    trend,
    granularity: filters.trend,
    retention: retentionRows.map((r) => ({ days: num(r.days), eligible: num(r.eligible), retained: num(r.retained) })),
  };

  // ---- Feedback reports -------------------------------------------------------
  const published = new Map(roster.reports.map((r) => [r.key, r]));
  const viewsByKey = new Map<string, { views: number; firstView: number | null; activeMs: number; email: string }>();
  for (const r of perReportRows) {
    const key = String(r.report_key);
    const prev = viewsByKey.get(key);
    const views = num(r.views) + (prev?.views ?? 0);
    const first = ms(r.first_view);
    viewsByKey.set(key, {
      views,
      firstView: prev?.firstView != null && first != null ? Math.min(prev.firstView, first) : first ?? prev?.firstView ?? null,
      activeMs: num(r.active_ms) + (prev?.activeMs ?? 0),
      email: String(r.email),
    });
  }
  const competencyTitle = new Map(COMPETENCIES.map((c) => [c.slug, c.title]));
  const competencyOfKey = (key: string) => {
    const sheet = key.split("|")[0];
    const c = COMPETENCIES.find((x) => x.sheets.some((s) => s.name === sheet));
    return c?.slug ?? "";
  };
  const perReport: ReportStat[] = [...new Set([...published.keys(), ...viewsByKey.keys()])].map((key) => {
    const pub = published.get(key);
    const v = viewsByKey.get(key);
    return {
      key,
      competency: competencyTitle.get(pub?.competency ?? competencyOfKey(key)) ?? "",
      email: pub?.email ?? v?.email ?? "",
      views: v?.views ?? 0,
      avgViewMs: v && v.views ? v.activeMs / v.views : 0,
      firstView: v?.firstView ?? null,
      publishedAt: pub?.publishedAt ?? null,
    };
  });
  perReport.sort((a, b) => b.views - a.views || a.email.localeCompare(b.email));

  const viewedEmails = new Set(perReport.filter((r) => r.views > 0 && published.has(r.key)).map((r) => r.email));
  const studentsWithPublished = new Set(roster.reports.map((r) => r.email));
  const totalViews = perReport.reduce((t, r) => t + r.views, 0);
  const totalViewMs = perReport.reduce((t, r) => t + r.avgViewMs * r.views, 0);
  const reports = {
    published: roster.reports.length,
    publishedInRange: roster.reports.filter((r) => r.publishedAt != null && r.publishedAt >= from && r.publishedAt < to).length,
    views: reportRows.reduce((t, r) => t + num(r.views), 0),
    uniqueViewers: reportRows.length,
    notViewedStudents: [...studentsWithPublished].filter((e) => !viewedEmails.has(e)).sort(),
    repeatViews: perReport.reduce((t, r) => t + Math.max(0, r.views - 1), 0),
    studentsWithRepeats: new Set(perReport.filter((r) => r.views > 1).map((r) => r.email)).size,
    avgViewMs: totalViews ? totalViewMs / totalViews : 0,
    mostViewed: perReport.filter((r) => r.views > 0).slice(0, 10),
    perReport,
  };

  // ---- Devices & authentication ----------------------------------------------
  const breakdown = (rows: Record<string, unknown>[]): Breakdown[] =>
    rows.map((r) => ({ label: String(r.label), users: num(r.users), sessions: num(r.sessions) }));
  const a = authRow[0] ?? {};
  const ok = num(a.ok);
  const failed = num(a.failed);
  const authStudents = num(a.students);
  const last = lastLoginRow[0];

  return {
    range: { from, to },
    overview,
    students,
    engagement,
    reports,
    devices: { deviceTypes: breakdown(deviceRows), browsers: breakdown(browserRows), os: breakdown(osRows) },
    sections: REPORT_SECTIONS.map((section) => {
      const rows = sectionRows.filter((r) => r.section === section);
      const totalMs = rows.reduce((t, r) => t + num(r.ms), 0);
      const students = new Set(rows.filter((r) => num(r.ms) > 0).map((r) => String(r.email))).size;
      return { section, totalMs, students, views: rows.reduce((t, r) => t + num(r.views), 0), avgPerStudentMs: students ? totalMs / students : 0 };
    }),
    practice: {
      clicks: practiceStudentRows.reduce((t, r) => t + num(r.clicks), 0),
      students: practiceStudentRows.length,
      questions: new Set(practiceQuestionRows.map((r) => String(r.question))).size,
      topQuestions: practiceQuestionRows.map((r) => ({
        question: String(r.question),
        competency: competencyTitle.get(String(r.competency)) ?? String(r.competency),
        link: String(r.link ?? ""),
        clicks: num(r.clicks),
        students: num(r.students),
        lastClick: ms(r.last_click),
      })),
    },
    auth: {
      successes: ok,
      failures: failed,
      uniqueStudents: authStudents,
      perStudent: authStudents ? ok / authStudents : 0,
      successRate: ok + failed ? ok / (ok + failed) : null,
      lastSuccess: last ? { email: String(last.email), at: ms(last.occurred_at)! } : null,
      failureReasons: reasonRows.map((r) => ({ reason: String(r.reason), count: num(r.count) })),
    },
  };
}
