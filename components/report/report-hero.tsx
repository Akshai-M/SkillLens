import { Fragment, type ReactNode } from "react";
import type { Competency } from "@/lib/competencies";
import { formatDate } from "@/lib/report/fields";
import { isCleared, levelStatus, type Interview } from "@/lib/report/parse";
import { ExpandableText } from "./expandable-text";
import { Icon, type IconName } from "./ui";

// Verdict band is hidden from students for now. To bring the card back, restore this map,
// the `verdict` constant in ReportHero and the commented-out Kpi below.
// const VERDICT: Record<string, { className: string; note: string }> = {
//   "strong hire": { className: "text-good", note: "Strong performance across the interview" },
//   "medium hire": { className: "text-ink", note: "Solid performance with a few gaps" },
//   "low hire": { className: "text-amber", note: "Solid foundations with specific gaps" },
// };

/** Candidate dossier: identity, headline result tiles, executive summary and next-step callout. */
export function ReportHero({
  interview,
  competency,
  name,
  email,
  focusCount,
  onOpenPlan,
}: {
  interview: Interview;
  competency: Competency;
  name: string;
  email: string;
  /** Number of domains rated 2 or below. */
  focusCount: number;
  onOpenPlan?: () => void;
}) {
  const cleared = isCleared(interview.clearance);
  const { certified, target } = levelStatus(interview, competency);
  const s = interview.structured;
  const summary = s?.executiveSummary || interview.overallFeedback;
  const breakthrough = s?.nextStepFocus;
  // const verdict = VERDICT[interview.verdictBand.toLowerCase()];
  const interviewer = interview.admin?.interviewer;

  const meta: { icon: IconName; text: ReactNode; strong?: boolean }[] = [
    { icon: "book", text: competency.title, strong: true },
    { icon: "mail", text: email },
    { icon: "calendar", text: `${formatDate(interview.date)}${interview.time ? `, ${interview.time}` : ""}` },
    ...(interviewer ? [{ icon: "user" as const, text: `Interviewer: ${interviewer}` }] : []),
  ];

  return (
    <section data-pdf-block className="space-y-6 rounded-lg border border-line bg-white p-4 sm:p-8">
      <div className="flex flex-col gap-6 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {interview.uid && <p className="break-all font-mono text-xs text-muted">ID {interview.uid}</p>}
          <h1 className="break-words font-display text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
          <ul className="flex flex-col gap-1.5 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            {meta.map((m, i) => (
              <Fragment key={m.icon}>
                {i > 0 && (
                  <li aria-hidden className="hidden text-slate-300 sm:block">
                    ·
                  </li>
                )}
                <li className={`inline-flex items-center gap-1.5 ${m.strong ? "font-medium text-slate-800" : ""}`}>
                  <Icon name={m.icon} className={`size-4 shrink-0 ${m.strong ? "text-muted" : "text-slate-400"}`} />
                  <span className="break-all">{m.text}</span>
                </li>
              </Fragment>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 text-xs text-slate-600 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <p className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-good-bar" aria-hidden />
            <span className="font-medium text-ink">Official Evaluation Report</span>
          </p>
          {/* Placement Pool is shown only to students who cleared, for now. To also show it to
              students who didn't clear, swap `cleared &&` back to `interview.clearance &&`. */}
          {cleared && (
            <p className="text-muted">
              Placement Pool:{" "}
              <span className={interview.placementEligible ? "font-semibold text-good" : "text-slate-700"}>
                {interview.placementEligible ? "Eligible" : "Not Eligible"}
              </span>
            </p>
          )}
          {/* Disabled for now — Placement Pool for every graded attempt, including not cleared:
          {interview.clearance && (
            <p className="text-muted">
              Placement Pool:{" "}
              <span className={cleared && interview.placementEligible ? "font-semibold text-good" : "text-slate-700"}>
                {cleared && interview.placementEligible ? "Eligible" : "Not Eligible"}
              </span>
            </p>
          )}
          */}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Overall score">
          <span className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{interview.score ?? "—"}</span>
          <span className="font-mono text-sm text-slate-400">/ 100</span>
        </Kpi>

        <Kpi
          label="Clearance status"
          note={interview.clearance ? (cleared ? undefined : "You can retake this interview") : "Result pending"}
        >
          <span className={`font-display text-xl font-bold sm:text-2xl ${!interview.clearance ? "text-muted" : cleared ? "text-good" : "text-bad"}`}>
            {interview.clearance ? (cleared ? "Cleared" : "Not Cleared") : "Pending"}
          </span>
          {interview.clearance && (
            <Icon name={cleared ? "check" : "warning"} className={`size-5 shrink-0 self-center ${cleared ? "text-good-bar" : "text-bad-bar"}`} />
          )}
        </Kpi>

        {cleared ? (
          <Kpi label="Certified level" note={target ? `Next target: Level ${target}` : "Top level for this track"}>
            <span className="font-mono text-3xl font-bold sm:text-4xl">{certified ?? "—"}</span>
          </Kpi>
        ) : (
          <Kpi label="Target level" note={`Aim to clear at Level ${target}`}>
            <span className="font-mono text-3xl font-bold sm:text-4xl">{target}</span>
          </Kpi>
        )}

        {/* Disabled for now — verdict band card for students who cleared:
        {cleared && interview.verdictBand ? (
          <Kpi label="Verdict band" note={verdict?.note}>
            <span className={`font-display text-xl font-bold sm:text-2xl ${verdict?.className ?? "text-ink"}`}>{interview.verdictBand}</span>
          </Kpi>
        ) : ( …Areas to strengthen card… )}
        */}
        <Kpi label="Areas to strengthen" note={`${focusCount === 1 ? "Domain" : "Domains"} rated 2 or below`}>
          <span className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{focusCount}</span>
        </Kpi>
      </div>

      {interview.admin && (interview.admin.level || interview.admin.verdictBand) && (
        <p className="rounded-md border border-dashed border-line px-3 py-2 font-mono text-xs text-muted">
          Admin · recorded level {interview.admin.level || "—"} · band {interview.admin.verdictBand || "—"}
          {cleared ? " (band hidden from the student)" : " (both hidden from the student)"}
        </p>
      )}

      {summary && (
        <div className="space-y-3 rounded-md border border-line bg-slate-50/70 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Interviewer Executive Summary</h2>
            {interviewer && <span className="text-xs text-muted">{interviewer} · Interviewer</span>}
          </div>
          <p className="-mt-1 text-xs text-muted">Your interviewer&apos;s short take on how you did overall and the main thing to work on next.</p>
          <div className="leading-relaxed text-slate-700 sm:text-base">
            <ExpandableText text={`“${summary}”`} lines={5} />
          </div>
        </div>
      )}

      {breakthrough && (
        <div className="flex flex-col justify-between gap-4 rounded-md border border-amber-line/80 bg-amber-soft/60 p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber">
              {cleared ? (target ? `Core breakthrough required for ${target}` : "Keep sharpening your edge") : `What it takes to clear at ${target}`}
            </p>
            <p className="text-sm font-medium text-amber-950">{breakthrough}</p>
          </div>
          {onOpenPlan && (
            <button
              type="button"
              onClick={onOpenPlan}
              className="no-print inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber hover:bg-amber-200 sm:self-center"
            >
              View Remediation Plan <Icon name="arrowUpRight" className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Kpi({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line/80 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">{children}</div>
      {note && <p className="mt-2 text-xs text-slate-600">{note}</p>}
    </div>
  );
}
