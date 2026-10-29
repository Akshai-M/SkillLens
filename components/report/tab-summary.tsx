"use client";

import { useState } from "react";
import type { ReportDomain, StructuredFeedback } from "@/lib/report/parse";
import { ExpandableText } from "./expandable-text";
import { Icon, SegmentBar, TONE_BAR, TONE_TEXT, domainIcon, statusFor } from "./ui";

export function domainKey(d: ReportDomain): string {
  return d.id || d.name;
}

export function SummaryTab({
  feedback,
  selectedDomain,
  onDrill,
  onOpenPlan,
}: {
  feedback: StructuredFeedback;
  selectedDomain?: string;
  onDrill: (domainKey: string) => void;
  onOpenPlan: () => void;
}) {
  return (
    <div className="space-y-8">
      <CompetencyScorecard domains={feedback.domains} selected={selectedDomain} onSelect={onDrill} />
      <OverallSummary feedback={feedback} />
      {feedback.weeklyPlan.length > 0 && (
        <div className="no-print flex flex-col justify-between gap-4 rounded-lg border border-line bg-white p-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold">Structured {feedback.weeklyPlan.length}-Week Remediation Plan Ready</h3>
            <p className="text-sm text-slate-600">
              Targeted drills covering {feedback.weeklyPlan.map((w) => w.focus.charAt(0).toLowerCase() + w.focus.slice(1)).filter(Boolean).join(", ")}.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPlan}
            className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:bg-accent-strong sm:self-center"
          >
            Open Roadmap &amp; Checklist <Icon name="arrowRight" className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function CompetencyScorecard({ domains, selected, onSelect }: { domains: ReportDomain[]; selected?: string; onSelect: (key: string) => void }) {
  const categories = new Set(domains.map((d) => domainIcon(`${d.id} ${d.name}`)));
  const blurb = categories.has("code") && categories.has("book") ? "across live coding, theory & communication" : "evaluated in this interview";
  return (
    <div data-pdf-block className="space-y-5 rounded-lg border border-line bg-white p-4 sm:p-7">
      <div className="flex flex-col justify-between gap-2 border-b border-line pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-base font-semibold">Competency Radar &amp; Domain Breakdown</h2>
          <p className="text-xs text-muted">
            {domains.length} core evaluated dimensions {blurb}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <Legend tone="good" label="Strong (4-5)" />
          <Legend tone="warn" label="Partly (3)" />
          <Legend tone="bad" label="Remediate (0-2)" />
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {domains.map((d) => {
          const key = domainKey(d);
          const status = statusFor(d.status, d.rating);
          const isSelected = selected === key;
          const footer =
            d.concepts.length > 0
              ? `${d.concepts.length} Tested ${d.concepts.length === 1 ? "Concept" : "Concepts"}`
              : d.topics.length > 0
                ? `${d.topics.length} ${d.topics.length === 1 ? "Topic" : "Topics"} Discussed`
                : "Problem Breakdown";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`group flex flex-col justify-between rounded-md border p-4 text-left transition-all ${
                isSelected ? "border-ink bg-slate-50/80 shadow-xs ring-1 ring-ink" : "border-line bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="w-full">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                    <span className="rounded bg-accent-soft p-1 text-slate-700">
                      <Icon name={domainIcon(`${d.id} ${d.name}`)} className="size-4" />
                    </span>
                    <span className="line-clamp-2 text-xs font-semibold">
                      {d.tag && <span className="mr-1 text-muted">{d.tag}</span>}
                      {d.name}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-medium ${TONE_TEXT[status.tone]}`}>{status.label}</span>
                </div>
                <div className="mb-1 mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-muted">Domain Rating</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-base font-bold tabular-nums">{d.rating ?? "—"}</span>
                    <span className="text-xs text-slate-400">/ 5</span>
                  </span>
                </div>
                <SegmentBar rating={d.rating} tone={status.tone} className="my-2" />
                {d.summary && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{d.summary}</p>}
              </div>
              <div className="mt-4 flex w-full items-center justify-between border-t border-slate-100 pt-3 text-xs text-muted">
                <span>{footer}</span>
                <span className="inline-flex items-center gap-1 font-medium text-ink">
                  Drill down <Icon name="arrowRight" className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: "good" | "warn" | "bad"; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${TONE_BAR[tone]}`} aria-hidden />
      {label}
    </li>
  );
}

function OverallSummary({ feedback }: { feedback: StructuredFeedback }) {
  return (
    <div className="space-y-6">
      {feedback.evaluationSummary && (
        <div data-pdf-block className="rounded-lg border border-line bg-white p-4 sm:p-7">
          <h2 className="font-display text-base font-semibold tracking-tight">Holistic Evaluation Summary</h2>
          <p className="mb-3 text-xs text-muted">A walk-through of how each part of your interview went, from start to finish.</p>
          <div className="text-sm leading-relaxed text-slate-700 sm:text-base">
            <ExpandableText text={feedback.evaluationSummary} lines={6} />
          </div>
        </div>
      )}

      {(feedback.wentWell.length > 0 || feedback.improve.length > 0) && (
        <div data-pdf-block className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ListCard icon="check" iconClass="text-good-bar" title="Validated Strengths & Coverage" items={feedback.wentWell} dot="bg-emerald-500" />
          <ListCard icon="alert" iconClass="text-warn-bar" title="High-Impact Remediation Areas" items={feedback.improve} dot="bg-amber-500" />
        </div>
      )}

      {feedback.actions.length > 0 && (
        <div data-pdf-block className="rounded-lg border border-line bg-white p-4 sm:p-7">
          <div className="mb-5 flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <Icon name="list" className="size-5 text-slate-700" /> Prioritized Candidate Action Items
              </h3>
              <p className="mt-0.5 text-xs text-muted">Specific tactical habits to incorporate into daily practice</p>
            </div>
            <CopyButton
              label="Copy Action Items"
              text={`Technical Interview Action Items:\n\n${feedback.actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}${
                feedback.nextStepFocus ? `\n\nNext Step Target:\n${feedback.nextStepFocus}` : ""
              }`}
            />
          </div>
          <ol className="grid grid-cols-1 gap-3">
            {feedback.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded border border-line/70 bg-slate-50/60 p-3.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-slate-200 font-mono text-xs font-semibold text-slate-700">{i + 1}</span>
                <p className="text-sm leading-relaxed text-slate-800">{a}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ListCard({ icon, iconClass, title, items, dot }: { icon: "check" | "alert"; iconClass: string; title: string; items: string[]; dot: string }) {
  if (items.length === 0) return <div className="hidden md:block" />;
  return (
    <div className="rounded-lg border border-line bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon name={icon} className={`size-5 shrink-0 ${iconClass}`} />
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="no-print inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded bg-accent-soft px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 sm:self-auto"
    >
      {copied ? (
        <>
          <Icon name="tick" className="size-3.5 text-good-bar" />
          <span className="font-medium text-good">Copied to Clipboard</span>
        </>
      ) : (
        <>
          <Icon name="copy" className="size-3.5 text-muted" />
          {label}
        </>
      )}
    </button>
  );
}
