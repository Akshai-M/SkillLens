import type { Interview, SkillResult } from "@/lib/report/parse";
import { ExpandableText } from "./expandable-text";
import { Card, IconBox, SectionTitle, SegmentBar, StatusText, TaggedTitle, domainIcon, statusFor } from "./ui";

/** Feedback built from the sheet's own columns, for interviews without a structured report. */
export function SheetReport({ interview }: { interview: Interview }) {
  return (
    <div className="space-y-6">
      <Card data-pdf-block>
        <SectionTitle title="Skill-by-skill feedback" subtitle="Each skill is rated on a 0–5 rubric" />
        <div className="mt-6 grid gap-4 border-t border-line pt-6 md:grid-cols-2">
          {interview.skills.map((s) => (
            <SkillCard key={s.id} skill={s} />
          ))}
        </div>
      </Card>
      <SetupSection interview={interview} />
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillResult }) {
  const status = statusFor(undefined, skill.rating);
  const topLevel = skill.rating !== null && Math.round(skill.rating) >= 5;
  return (
    <article className={`break-inside-avoid rounded-xl border border-line p-5 ${skill.rating === null ? "border-dashed" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-3 font-semibold">
          <IconBox name={domainIcon(`${skill.id} ${skill.title}`)} />
          <span>
            <TaggedTitle title={skill.title} tag={skill.tag} />
          </span>
        </h3>
        <StatusText label={status.label} tone={status.tone} className="shrink-0 text-right" />
      </div>

      {skill.rating !== null && (
        <>
          <div className="mt-5 flex items-baseline justify-between text-sm text-muted">
            <span>Rating</span>
            <span>
              <span className="text-xl font-semibold text-ink">{skill.rating}</span> / 5
            </span>
          </div>
          <SegmentBar rating={skill.rating} tone={status.tone} className="mt-2" />

          <div className="mt-5 space-y-4 text-[15px] leading-relaxed">
            <div className="rounded-lg bg-sunken p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Where you are</p>
              <p className="mt-1">{skill.observed || "—"}</p>
            </div>
            {(skill.nextLevel || topLevel) && (
              <div className="rounded-lg bg-sunken p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{topLevel ? "Next step" : "To reach the next level"}</p>
                <p className="mt-1">{skill.nextLevel ?? "Top of the rubric — keep this sharp with real projects."}</p>
              </div>
            )}
          </div>
        </>
      )}

      {skill.remarks && (
        <div className="mt-4 rounded-lg border border-line p-4 text-[15px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Interviewer remarks</p>
          <div className="mt-1">
            <ExpandableText text={skill.remarks} />
          </div>
        </div>
      )}
    </article>
  );
}

/** Integrity checklist, setup advice and remarks; shown to students and admins. */
export function SetupSection({ interview }: { interview: Interview }) {
  const note = interview.structured?.contextNote;
  if (interview.integrityChecks.length === 0 && !note && !interview.integrityRemarks) return null;
  const failed = interview.integrityChecks.filter((c) => !c.passed);

  return (
    <Card data-pdf-block className="break-inside-avoid">
      <SectionTitle
        title="Interview setup & integrity"
        subtitle={
          interview.integrityChecks.length === 0
            ? "Notes on your interview setup"
            : failed.length === 0
              ? "Your setup met every requirement"
              : `${failed.length} ${failed.length === 1 ? "check was" : "checks were"} not met — please fix ${failed.length === 1 ? "it" : "these"} for your next interview`
        }
        action={
          interview.integrityScore !== null && (
            <span className="text-sm text-muted">
              Score <span className="text-lg font-semibold text-ink">{interview.integrityScore}</span> / 5
            </span>
          )
        }
      />
      {interview.integrityChecks.length > 0 && (
        <ul className="mt-5 grid gap-2 border-t border-line pt-5 text-sm sm:grid-cols-2">
          {interview.integrityChecks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              <span className={`font-semibold ${c.passed ? "text-good" : "text-bad"}`} aria-hidden>
                {c.passed ? "✓" : "✕"}
              </span>
              <span className={c.passed ? "" : "font-medium"}>
                {c.label}
                <span className="sr-only">{c.passed ? " — met" : " — not met"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="mt-5 rounded-lg border border-amber-line bg-amber-soft px-4 py-3 text-sm leading-relaxed">
          <span className="font-semibold text-amber">Before your next interview: </span>
          {note}
        </p>
      )}
      {interview.integrityRemarks && (
        <div className="mt-4 rounded-lg bg-sunken p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Interviewer remarks</p>
          <div className="mt-1">
            <ExpandableText text={interview.integrityRemarks} />
          </div>
        </div>
      )}
    </Card>
  );
}
