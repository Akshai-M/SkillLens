"use client";

import { useState } from "react";
import type { AiTopic } from "@/lib/report/ai";
import type { ReportDomain } from "@/lib/report/parse";
import { ExpandableText } from "./expandable-text";
import { domainKey } from "./tab-summary";
import { Icon, TONE_BAR, TONE_TEXT, domainIcon, statusFor } from "./ui";

export function DomainsTab({ domains, selected }: { domains: ReportDomain[]; selected?: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-6">
      <div data-pdf-block className="pb-2">
        <h2 className="font-display text-xl font-bold">In-Depth Domain Evaluations</h2>
        <p className="text-sm text-slate-600">Granular evaluation of each interview section with concrete examples and benchmark targets</p>
      </div>
      <div className="space-y-6">
        {domains.map((d) => {
          const key = domainKey(d);
          return (
            <DomainDetail
              key={key}
              domain={d}
              selected={selected === key}
              conceptsOpen={!collapsed[key]}
              onToggleConcepts={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
            />
          );
        })}
      </div>
    </div>
  );
}

function DomainDetail({
  domain,
  selected,
  conceptsOpen,
  onToggleConcepts,
}: {
  domain: ReportDomain;
  selected: boolean;
  conceptsOpen: boolean;
  onToggleConcepts: () => void;
}) {
  const status = statusFor(domain.status, domain.rating);
  return (
    <article
      data-pdf-block
      id={`domain-${domainKey(domain)}`}
      className={`print-avoid-break scroll-mt-24 space-y-6 rounded-lg border bg-white p-4 transition-all sm:p-7 ${selected ? "border-ink ring-1 ring-ink" : "border-line"}`}
    >
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3">
          <span className="rounded bg-accent-soft p-2 text-slate-700">
            <Icon name={domainIcon(`${domain.id} ${domain.name}`)} className="size-5" />
          </span>
          <div>
            {domain.tag && <p className="mb-0.5 font-mono text-xs text-muted">Level {domain.tag.replace(/^L/, "")}</p>}
            <h3 className="break-words font-display text-lg font-bold">{domain.name}</h3>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
          <p className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted">Rating:</span>
            <span className="font-mono text-xl font-bold tabular-nums">{domain.rating ?? "—"}</span>
            <span className="font-mono text-xs text-slate-400">/ 5</span>
          </p>
          <p className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${TONE_BAR[status.tone]}`} aria-hidden />
            <span className={`text-xs font-semibold ${TONE_TEXT[status.tone]}`}>{status.label}</span>
          </p>
        </div>
      </header>

      {(domain.summary || domain.stronger) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {domain.summary && (
            <div className="rounded border border-line/80 bg-slate-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <Icon name="eye" className="size-3.5 text-slate-700" /> Observed Performance
              </p>
              <p className="text-sm leading-relaxed text-slate-800">{domain.summary}</p>
            </div>
          )}
          {domain.stronger && (
            <div className="rounded border border-line/80 bg-slate-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Icon name="target" className="size-3.5 text-slate-700" /> Stronger Performance Looks Like (Next Level)
              </p>
              <p className="text-sm font-medium leading-relaxed text-slate-800">{domain.stronger}</p>
            </div>
          )}
        </div>
      )}

      {(domain.wentWell.length > 0 || domain.improve.length > 0) && (
        <div className="grid grid-cols-1 gap-5 pt-1 md:grid-cols-2">
          {domain.wentWell.length > 0 && (
            <PointList title="What Went Well" icon="check" titleClass="text-emerald-800" iconClass="text-good-bar" dot="bg-emerald-500" items={domain.wentWell} />
          )}
          {domain.improve.length > 0 && (
            <PointList title="Areas of Improvement" icon="warning" titleClass="text-rose-800" iconClass="text-bad-bar" dot="bg-rose-500" items={domain.improve} />
          )}
        </div>
      )}

      {domain.actions.length > 0 && (
        <div className="rounded border border-line bg-slate-50/70 p-4">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Icon name="listTodo" className="size-4 text-slate-700" /> Targeted Action Items for this Domain
          </p>
          <ol className="space-y-2">
            {domain.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-800 sm:text-sm">
                <span className="mt-0.5 font-mono text-xs font-semibold text-muted">{i + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {domain.remarks && (
        <div className="rounded border border-line p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Interviewer Remarks</p>
          <div className="text-sm leading-relaxed text-slate-800">
            <ExpandableText text={domain.remarks} />
          </div>
        </div>
      )}

      {domain.concepts.length > 0 && (
        <div className="border-t border-line pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-sm font-semibold">Concept Areas Evaluated ({domain.concepts.length})</h4>
              <p className="text-xs text-muted">Specific concepts tested in this section</p>
            </div>
            <button
              type="button"
              onClick={onToggleConcepts}
              aria-expanded={conceptsOpen}
              className="no-print inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-xs text-slate-600 hover:text-ink"
            >
              {conceptsOpen ? "Collapse" : "Expand"}
              <Icon name={conceptsOpen ? "chevronUp" : "chevronDown"} className="size-3.5" />
            </button>
          </div>
          <div className={`grid grid-cols-1 gap-3.5 md:grid-cols-2 ${conceptsOpen ? "" : "hidden print:grid"}`}>
            {domain.concepts.map((c, i) => {
              const cs = statusFor(c.status, null);
              const strong = c.status === "strong";
              return (
                <div key={i} className="print-avoid-break space-y-2 rounded border border-line bg-slate-50/60 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{c.name}</span>
                    <span className={`shrink-0 font-semibold ${TONE_TEXT[cs.tone]}`}>{cs.label}</span>
                  </div>
                  {strong || !c.gap ? (
                    c.wentWell && <p className="rounded border border-line/60 bg-white p-2 text-slate-700">{c.wentWell}</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-slate-700">
                        <span className="font-medium text-rose-700">The Gap: </span>
                        {c.gap}
                      </p>
                      {c.workOn && (
                        <p className="rounded border border-line bg-white p-2 text-slate-800">
                          <span className="font-medium text-ink">Remedy: </span>
                          {c.workOn}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {domain.topics.length > 0 && <TopicsDiscussed topics={domain.topics} />}
    </article>
  );
}

function PointList({
  title,
  icon,
  titleClass,
  iconClass,
  dot,
  items,
}: {
  title: string;
  icon: "check" | "warning";
  titleClass: string;
  iconClass: string;
  dot: string;
  items: string[];
}) {
  return (
    <div className="space-y-3">
      <h4 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${titleClass}`}>
        <Icon name={icon} className={`size-4 ${iconClass}`} /> {title}
      </h4>
      <ul className="space-y-2.5">
        {items.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 sm:text-sm">
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            <span className="leading-relaxed">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RESULT: Record<AiTopic["result"], { label: string; className: string; icon: string }> = {
  correct: { label: "Correct", className: "text-good", icon: "✓" },
  partial: { label: "Partly correct", className: "text-warn", icon: "◐" },
  wrong: { label: "Incorrect", className: "text-bad", icon: "✕" },
  dont_know: { label: "Didn't know", className: "text-muted", icon: "?" },
  no_answer: { label: "No answer", className: "text-muted", icon: "–" },
};

function TopicsDiscussed({ topics }: { topics: AiTopic[] }) {
  const correct = topics.filter((t) => t.result === "correct").length;
  return (
    <details className="border-t border-line pt-4 text-sm">
      <summary className="cursor-pointer select-none font-display text-sm font-semibold">
        Topics Discussed ({topics.length})
        {correct > 0 && <span className="font-sans text-xs font-normal text-muted"> · {correct} answered correctly</span>}
      </summary>
      <ul className="mt-3 divide-y divide-line rounded border border-line">
        {topics.map((t, i) => {
          const r = RESULT[t.result];
          return (
            <li key={i} className="flex items-start justify-between gap-3 px-3.5 py-2 text-xs sm:text-sm">
              <span className="text-slate-700">{t.topic}</span>
              <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${r.className}`}>
                {t.hint && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-normal text-muted">with hint</span>}
                <span aria-hidden>{r.icon}</span>
                {r.label}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
