import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { PageSkeleton } from "@/components/app-header";
import { LoadingState } from "@/components/ui/spinner";
import { BarList, SimpleBars, VisitorTrend } from "@/components/analytics/charts";
import { AnalyticsFilterBar } from "@/components/analytics/filters";
import { parseFilters, RANGE_LABEL, type AnalyticsFilters, type Granularity } from "@/lib/analytics/filters";
import { formatBucket, formatDuration, formatHour, formatIst, formatNumber, formatPercent } from "@/lib/analytics/format";
import { getAnalytics, type Analytics, type StudentActivity } from "@/lib/analytics/queries";
import { PaginatedTable as Table } from "@/components/analytics/pagination";
import { StudentTable } from "@/components/analytics/student-table";
import { readAdminRole } from "@/lib/session";
import { AdminHeader } from "../admin-header";

export const metadata: Metadata = { title: "User analytics · Admin" };

export default function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/analytics">, "searchParams">) {
  const role = await readAdminRole();
  if (!role) redirect("/admin/login");
  // User analytics are for the full admin account only; the viewer account sees student reports.
  if (role !== "full") redirect("/admin");
  const filters = parseFilters(await searchParams);
  return (
    <>
      <AdminHeader active="/admin/analytics" role={role} />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">User analytics</h1>
          <p className="mt-1 text-sm text-subtle">Student activity on the report site. Times are shown in IST.</p>
        </div>
        <AnalyticsFilterBar key={JSON.stringify(filters)} filters={filters} />
        <Suspense fallback={<LoadingState label="Crunching the numbers" />}>
          <Dashboard filters={filters} />
        </Suspense>
      </main>
    </>
  );
}

async function Dashboard({ filters }: { filters: AnalyticsFilters }) {
  // Analytics depend on the current time; render at request time, never prerendered.
  await connection();
  let a: Analytics;
  try {
    a = await getAnalytics(filters);
  } catch (error) {
    console.error("[analytics] dashboard failed", error);
    return (
      <Section title="Analytics unavailable">
        <p className="text-sm text-bad">Couldn&apos;t load analytics. Check that DATABASE_URL is set and reachable, then reload.</p>
      </Section>
    );
  }
  const rangeText = `${RANGE_LABEL[filters.range]} · ${formatIst(a.range.from, false)} – ${formatIst(a.range.to - 1, false)}`;

  return (
    <div className="space-y-6">
      <p className="font-mono text-xs text-subtle">{rangeText}</p>

      {/* 1. Overall user statistics */}
      <Section title="Overall user statistics" note="Unique visitors, visits, new and returning use the selected date range. DAU, WAU and MAU are always relative to now.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Registered users" value={a.overview.registered} hint="Students who have signed in" />
          <Stat label="Unique visitors" value={a.overview.uniqueVisitors} />
          <Stat label="Total visits" value={a.overview.totalVisits} />
          <Stat label="New visitors" value={a.overview.newVisitors} hint="First-ever visit in this range" />
          <Stat label="Returning visitors" value={a.overview.returningVisitors} hint="Visited before this range and came back" />
          <Stat label="Daily active" value={a.overview.dau} hint="Visited today (IST)" />
          <Stat label="Weekly active" value={a.overview.wau} hint="Visited in the last 7 days" />
          <Stat label="Monthly active" value={a.overview.mau} hint="Visited in the last 30 days" />
          <Stat label="Inactive users" value={a.overview.inactive} hint={`No visit in 14 days · ${a.overview.neverVisited} never visited`} />
          <Stat label="Avg visits / user" value={formatNumber(a.engagement.avgVisits, 1)} />
        </div>
      </Section>

      {/* Activity trends */}
      <Section
        title="Visitor trends"
        note="Unique visitors per period, split into new and returning."
        action={<TrendToggle filters={filters} />}
      >
        <VisitorTrend
          data={a.engagement.trend.map((b) => ({
            label: formatBucket(b.bucket, a.engagement.granularity),
            newVisitors: b.newVisitors,
            returningVisitors: b.returningVisitors,
            visits: b.visits,
          }))}
        />
      </Section>

      {/* 2. Student-wise activity */}
      <Section
        title="Student-wise activity"
        note="Everything in this table uses the global date range. Use the table filters below to narrow it down."
      >
        <StudentTable students={a.students} />
      </Section>

      {/* 3. Engagement */}
      <Section title="User engagement">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Avg visits per user" value={formatNumber(a.engagement.avgVisits, 1)} />
          <Stat label="Avg sessions per user" value={formatNumber(a.engagement.avgSessions, 1)} />
          <Stat label="Avg time per user" value={formatDuration(a.engagement.avgTimeMs)} hint="Active browsing time only" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Leaderboard title="Most active" rows={a.engagement.mostActive} metric={(s) => formatDuration(s.timeSpentMs)} />
          <Leaderboard title="Least active" rows={a.engagement.leastActive} metric={(s) => formatDuration(s.timeSpentMs)} />
          <Leaderboard title="Most frequently returning" rows={a.engagement.mostReturning} metric={(s) => `${s.activeDays} ${s.activeDays === 1 ? "day" : "days"}`} />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Peak visiting hours (IST)</h3>
            <SimpleBars unit="visits" data={a.engagement.peakHours.map((h) => ({ label: formatHour(h.hour), value: h.visits }))} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Retention</h3>
            <ul className="space-y-2">
              {a.engagement.retention.map((r) => (
                <li key={r.days} className="flex items-baseline justify-between rounded-md border border-line bg-slate-50 px-3 py-2.5">
                  <span className="text-sm text-slate-700">{r.days}-day</span>
                  <span className="text-right">
                    <span className="font-mono text-lg font-semibold">{formatPercent(r.retained, r.eligible)}</span>
                    <span className="block text-[11px] text-subtle">
                      {r.retained} of {r.eligible} came back
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-subtle">Share of students who visited again at least N days after their first visit (all time).</p>
          </div>
        </div>
      </Section>

      {/* 4. Feedback reports */}
      <Section title="Feedback report analytics" >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Reports published" value={a.reports.published} hint={`${a.reports.publishedInRange} in this range`} />
          <Stat label="Report views" value={a.reports.views} hint="In this range" />
          <Stat label="Students who viewed" value={a.reports.uniqueViewers} hint="In this range" />
          <Stat label="Haven't viewed yet" value={a.reports.notViewedStudents.length} hint="Signed in, but never opened a published report" />
          <Stat label="Repeat views" value={a.reports.repeatViews} hint={`${a.reports.studentsWithRepeats} students reopened a report`} />
          <Stat label="Avg viewing time" value={formatDuration(a.reports.avgViewMs)} hint="Per report view" />
        </div>
        <h3 className="mb-3 mt-6 text-sm font-semibold">Most viewed reports</h3>
        <Table
          head={["Student", "Competency", "Views", "Avg viewing time", "First viewed", "Published"]}
          rows={a.reports.mostViewed.map((r) => [
            r.email,
            r.competency || "—",
            formatNumber(r.views),
            formatDuration(r.avgViewMs),
            formatIst(r.firstView),
            formatIst(r.publishedAt),
          ])}
          empty="No report views yet."
        />
        {a.reports.notViewedStudents.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">Students who haven&apos;t viewed their report ({a.reports.notViewedStudents.length})</summary>
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              {a.reports.notViewedStudents.map((e) => (
                <li key={e} className="truncate">
                  {e}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      {/* Time on report sections */}
      <Section title="Time on report sections" note="Active time on each report tab, for reports opened in the selected range.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {a.sections.map((x) => (
            <Stat
              key={x.section}
              label={SECTION_LABEL[x.section]}
              value={formatDuration(x.totalMs)}
              hint={`${x.students} ${x.students === 1 ? "student" : "students"} · avg ${formatDuration(x.avgPerStudentMs)} each`}
            />
          ))}
        </div>
        <h3 className="mb-3 mt-6 text-sm font-semibold">By student</h3>
        <Table
          head={["Student", ...a.sections.map((x) => SECTION_LABEL[x.section]), "Total"]}
          empty="No report section time in this range."
          rows={a.students
            .map((s) => ({ s, total: Object.values(s.sectionMs).reduce((t, v) => t + v, 0) }))
            .filter((x) => x.total > 0)
            .sort((x, y) => y.total - x.total)
            .map(({ s, total }) => [
              <span key="e" className="font-medium text-ink">
                {s.email}
              </span>,
              ...a.sections.map((x) => formatDuration(s.sectionMs[x.section])),
              <span key="t" className="font-semibold text-ink">
                {formatDuration(total)}
              </span>,
            ])}
        />
      </Section>

      {/* 6. Authentication */}
      <Section title="Authentication" note="Sign-in attempts in the selected range.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Successful logins" value={a.auth.successes} />
          <Stat label="Failed attempts" value={a.auth.failures} />
          <Stat label="Success rate" value={a.auth.successRate == null ? "—" : `${Math.round(a.auth.successRate * 100)}%`} />
          <Stat label="Students logged in" value={a.auth.uniqueStudents} />
          <Stat label="Logins per student" value={formatNumber(a.auth.perStudent, 1)} />
          <Stat label="Last login" value={a.auth.lastSuccess ? formatIst(a.auth.lastSuccess.at) : "—"} hint={a.auth.lastSuccess?.email} small />
        </div>
        {a.auth.failureReasons.length > 0 && (
          <div className="mt-5 max-w-md">
            <h3 className="mb-3 text-sm font-semibold">Why logins failed</h3>
            <BarList valueLabel="attempts" items={a.auth.failureReasons.map((r) => ({ label: REASON[r.reason] ?? r.reason, value: r.count }))} />
          </div>
        )}
      </Section>

      {/* 5. Devices & browsers */}
      <Section title="Devices & browsers" note="Sessions in the selected range; a student using two devices counts on both.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {(
            [
              ["Device type", a.devices.deviceTypes],
              ["Browser", a.devices.browsers],
              ["Operating system", a.devices.os],
            ] as const
          ).map(([title, rows]) => (
            <div key={title}>
              <h3 className="mb-3 text-sm font-semibold">{title}</h3>
              <BarList
                valueLabel="users"
                items={rows.map((r) => ({ label: DEVICE_LABEL[r.label] ?? r.label, value: r.users, sub: `${r.sessions} sessions` }))}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  overview: "Executive Summary",
  domains: "Domain Evaluations",
  concepts: "Concept Mastery",
  plan: "Prep Plan",
};

const DEVICE_LABEL: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };

const REASON: Record<string, string> = {
  no_interview_found: "No interview for that email",
  invalid_email: "Invalid email format",
  service_unavailable: "Results service unavailable",
};

function Section({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-subtle">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint, small }: { label: string; value: ReactNode; hint?: string; small?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-slate-50 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className={`mt-1 font-mono font-semibold tabular-nums ${small ? "text-sm" : "text-2xl"}`}>{typeof value === "number" ? formatNumber(value) : value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-subtle" title={hint}>{hint}</p>}
    </div>
  );
}

function TrendToggle({ filters }: { filters: AnalyticsFilters }) {
  const href = (trend: Granularity) => {
    const p = new URLSearchParams();
    p.set("range", filters.range);
    if (filters.range === "custom") {
      p.set("from", filters.from);
      p.set("to", filters.to);
    }
    p.set("trend", trend);
    return `/admin/analytics?${p}`;
  };
  return (
    <div role="group" aria-label="Trend granularity" className="flex gap-1 rounded-md bg-brand-soft p-1 text-xs">
      {(["day", "week", "month"] as const).map((g) => (
        <Link
          key={g}
          href={href(g)}
          scroll={false}
          aria-current={filters.trend === g ? "true" : undefined}
          className={`rounded px-2.5 py-1 capitalize ${filters.trend === g ? "bg-white font-medium shadow-xs" : "text-slate-600 hover:text-ink"}`}
        >
          {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
        </Link>
      ))}
    </div>
  );
}

function Leaderboard({ title, rows, metric }: { title: string; rows: StudentActivity[]; metric: (s: StudentActivity) => string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-subtle">No visitors in this range.</p>
      ) : (
        <ol className="divide-y divide-line rounded-md border border-line">
          {rows.map((s, i) => (
            <li key={s.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-xs text-subtle">{i + 1}</span>
                <span className="truncate">{s.email}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-600">{metric(s)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
