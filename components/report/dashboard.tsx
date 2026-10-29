"use client";

import Link from "next/link";
import { COMPETENCIES, type Competency } from "@/lib/competencies";
import { formatDate } from "@/lib/report/fields";
import { bestAttempt, getAttempts, isCleared, type Interview } from "@/lib/report/parse";
import { useStoredReport } from "@/lib/report/store";
import { ContentSkeleton } from "@/components/app-header";
import { NoStoredData, RefetchBar } from "./refetch-bar";
import { Icon } from "./ui";

/** Accent colour of each competency's score bar. */
const BAR_COLOR: Record<string, string> = {
  "frontend-development": "bg-emerald-500",
  dsa: "bg-blue-500",
  "backend-development": "bg-violet-500",
  "se-fundamentals": "bg-amber-500",
};

const MAX_CHIPS = 3;

export function Dashboard({ email, name }: { email: string; name: string }) {
  const data = useStoredReport(email);
  if (data === undefined) return <ContentSkeleton />;

  const cards = data
    ? COMPETENCIES.map((c) => ({ c, attempts: getAttempts(data, c) }))
        // Competencies the student has taken come first; config order otherwise.
        .sort((a, b) => Number(b.attempts.length > 0) - Number(a.attempts.length > 0))
    : [];
  const taken = cards.filter((x) => x.attempts.length > 0).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight sm:text-3xl">Hi {data?.name || name}</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">Pick a competency to see your interview feedback.</p>
        </div>
        {data && <RefetchBar fetchedAt={data.fetchedAt} />}
      </div>

      {data === null ? (
        <NoStoredData />
      ) : (
        <section className="mt-8 sm:mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Competencies Evaluation Matrix</h2>
            <p className="font-mono text-xs text-muted sm:text-sm">
              {taken} of {COMPETENCIES.length} taken
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
            {cards.map(({ c, attempts }) => (
              <li key={c.slug}>
                <CompetencyCard competency={c} attempts={attempts} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CompetencyCard({ competency, attempts }: { competency: Competency; attempts: Interview[] }) {
  const count = attempts.length;
  const best = bestAttempt(attempts);

  if (count === 0) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-dashed border-line bg-white/60 p-5 sm:p-8">
        <CardHeader competency={competency}>
          <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted sm:px-3 sm:py-1 sm:text-sm">No interview yet</span>
        </CardHeader>
        <p className="mt-5 border-t border-line pt-5 text-sm text-muted sm:mt-6 sm:pt-6">Your feedback will appear here once you take this interview.</p>
      </div>
    );
  }

  const shown = best ?? attempts[0];
  const cleared = best ? isCleared(best.clearance) : false;
  const chips = best ? topSkills(best) : [];

  return (
    <Link
      href={`/${competency.slug}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-5 transition hover:border-slate-300 hover:shadow-md active:bg-slate-50 sm:p-8"
    >
      <CardHeader competency={competency}>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 sm:gap-2 sm:px-3 sm:py-1 sm:text-sm">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          {count} {count === 1 ? "attempt" : "attempts"}
        </span>
      </CardHeader>

      <div className="mt-5 border-t border-line pt-5 sm:mt-6 sm:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="text-sm text-muted">Best score</p>
            {best?.score != null ? (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{best.score}</span>
                <span className="font-mono text-sm text-muted">/100</span>
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-muted sm:text-xl">Not scored yet</p>
            )}
          </div>
          {best?.clearance && (
            <div className="sm:text-right">
              <p className="text-sm text-muted">Result</p>
              <p className={`mt-1 font-semibold ${cleared ? "text-good" : "text-bad"}`}>
                {cleared ? `Cleared${best.level ? ` · ${best.level}` : ""}` : "Not Cleared"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 sm:mt-5 sm:h-2.5" aria-hidden>
          <div
            className={`h-full rounded-full ${BAR_COLOR[competency.slug] ?? "bg-slate-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, best?.score ?? 0))}%` }}
          />
        </div>

        <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 sm:mt-5">
          <Icon name="calendar" className="size-4 shrink-0 text-muted" />
          {formatDate(shown.date)}
          {shown.time && `, ${shown.time}`}
        </p>

        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2">
            {chips.slice(0, MAX_CHIPS).map((s) => (
              <li key={s.name} className="max-w-full break-words rounded-md border border-line bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 sm:px-2.5 sm:text-xs">
                {s.name} <span className="font-semibold text-ink">{s.rating}/5</span>
              </li>
            ))}
            {chips.length > MAX_CHIPS && <li className="text-sm text-muted">+{chips.length - MAX_CHIPS} more</li>}
          </ul>
        )}
      </div>

      <div className="mt-auto pt-5 sm:pt-6">
        <div className="flex items-center justify-between border-t border-line pt-4 text-sm font-medium sm:pt-5 sm:text-base">
          View report
          <Icon name="arrowRight" className="size-5 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

function CardHeader({ competency, children }: { competency: Competency; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-52">
        <h3 className="break-words font-display text-lg font-semibold leading-snug tracking-tight sm:text-2xl">{competency.title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Rated skills of an attempt, strongest first. */
function topSkills(interview: Interview): { name: string; rating: number }[] {
  const rows = interview.structured
    ? interview.structured.domains.filter((d) => d.status !== "not_assessed").map((d) => ({ name: d.name, rating: d.rating }))
    : interview.skills.map((s) => ({ name: s.title, rating: s.rating }));
  return rows
    .filter((r): r is { name: string; rating: number } => r.rating !== null)
    .sort((a, b) => b.rating - a.rating);
}
