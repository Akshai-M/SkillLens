import type { ReactNode } from "react";
import type { Interview } from "@/lib/report/parse";
import { Icon, type IconName } from "./ui";

/** Admin-only: internal_only flags and the interview's internal record. */
export function AuditTab({ interview }: { interview: Interview }) {
  const admin = interview.admin;
  if (!admin) return null;
  const flags = interview.structured?.internalFlags ?? [];
  const recording = admin.links.find((l) => l.label === "Recording");

  const facts: [string, string][] = [
    ["Round", interview.round],
    ["Recorded level", admin.level],
    ["Recorded verdict band", admin.verdictBand],
    ["Result shared with student", admin.sharedStatus || "Not yet"],
    ["Feedback submitted", admin.submittedAt],
    ["Integrity score", interview.integrityScore === null ? "" : `${interview.integrityScore} / 5`],
    ["Partial completion reason", admin.partialReason],
  ];

  return (
    <div className="space-y-6">
      <div data-pdf-block className="space-y-6 rounded-lg border border-line bg-white p-4 sm:p-7">
        <div className="flex flex-col justify-between gap-2 border-b border-line pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-base font-semibold">Interviewer Audit &amp; Data Quality Records</h2>
            <p className="text-xs text-muted">Internal evaluation metadata and transcript fidelity logs (restricted access, never shown to the student)</p>
          </div>
          {admin.interviewer && <p className="font-mono text-xs text-muted">Evaluator: {admin.interviewer}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoCard label="Assigned Interviewer" icon="user" value={admin.interviewer || "Not recorded"} note="Technical interviewer" />
          <InfoCard
            label="Interview Recording"
            icon="video"
            value={
              recording ? (
                <a href={recording.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  Link attached
                </a>
              ) : (
                "Not provided"
              )
            }
            note="Internal storage archive"
          />
          <InfoCard
            label="Audit Assessment Status"
            icon="fileCheck"
            value={admin.auditStatus || "Not audited yet"}
            note={admin.auditRemarks ? "See audit remarks below" : "Evaluation committee review"}
            valueClass={admin.auditStatus ? "text-emerald-800" : "text-ink"}
            iconClass={admin.auditStatus ? "text-emerald-600" : "text-slate-600"}
          />
        </div>

        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
            <Icon name="shield" className="size-4 text-amber-600" /> Transcript Fidelity &amp; Data Quality Flags ({flags.length})
          </h3>
          {flags.length === 0 ? (
            <p className="text-xs text-slate-600">{interview.structured ? "No flags were raised for this report." : "This interview has no structured report, so there are no flags."}</p>
          ) : (
            <>
              <p className="text-xs text-slate-600">How the interview transcript and scorecard were mapped to this report:</p>
              <div className="space-y-3 pt-1">
                {flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded border border-amber-200/80 bg-amber-50/50 p-4">
                    <Icon name="info" className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-semibold text-amber-900">FLAG {String(i + 1).padStart(2, "0")}</p>
                      <p className="text-xs leading-relaxed text-slate-800 sm:text-sm">{f}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div data-pdf-block className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-4 sm:p-6">
          <h3 className="font-display text-sm font-semibold">Interview Record</h3>
          <dl className="mt-3 divide-y divide-line text-sm">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-white p-4 sm:p-6">
          <h3 className="font-display text-sm font-semibold">Links &amp; Notes</h3>
          {admin.links.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {admin.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                  >
                    <Icon name="link" className="size-3.5" /> {l.label}
                    <Icon name="arrowUpRight" className="size-3 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No recording or transcript links.</p>
          )}
          {[
            ["Audit remarks", admin.auditRemarks],
            ["Comments", admin.comments],
            ["Integrity remarks", interview.integrityRemarks],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="mt-4 rounded border border-line bg-slate-50 p-3.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</p>
                <p className="mt-1 whitespace-pre-line text-slate-800">{v}</p>
              </div>
            ))}
        </div>
      </div>

      {interview.integrityChecks.length > 0 && (
        <div data-pdf-block className="print-avoid-break rounded-lg border border-line bg-white p-4 sm:p-6">
          <h3 className="font-display text-sm font-semibold">Integrity Checklist</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {interview.integrityChecks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <Icon name={c.passed ? "check" : "warning"} className={`mt-0.5 size-4 shrink-0 ${c.passed ? "text-emerald-600" : "text-rose-600"}`} />
                <span className={c.passed ? "text-slate-700" : "font-medium"}>
                  {c.label}
                  <span className="sr-only">{c.passed ? " — met" : " — not met"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  icon,
  value,
  note,
  valueClass = "text-ink",
  iconClass = "text-slate-600",
}: {
  label: string;
  icon: IconName;
  value: ReactNode;
  note: string;
  valueClass?: string;
  iconClass?: string;
}) {
  return (
    <div className="rounded border border-line bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${valueClass}`}>
        <Icon name={icon} className={`size-4 shrink-0 ${iconClass}`} />
        <span>{value}</span>
      </p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
