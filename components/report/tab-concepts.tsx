"use client";

import { useMemo, useState } from "react";
import type { AiConcept, ConceptStatus } from "@/lib/report/ai";
import type { ReportDomain } from "@/lib/report/parse";
import { Icon, TONE_TEXT, statusFor } from "./ui";

type Row = { concept: AiConcept; tier: string };

const TOPIC_STATUS: Record<string, ConceptStatus> = {
  correct: "strong",
  partial: "partly_there",
  wrong: "needs_work",
  dont_know: "not_yet_familiar",
  no_answer: "not_yet_familiar",
};

const FILTERS: { id: ConceptStatus | "all"; label: string; active: string }[] = [
  { id: "all", label: "All Concepts", active: "text-ink" },
  { id: "strong", label: "Strong", active: "text-emerald-800" },
  { id: "partly_there", label: "Partly There", active: "text-amber-800" },
  { id: "needs_work", label: "Needs Work", active: "text-rose-800" },
  { id: "not_yet_familiar", label: "Not Yet Familiar", active: "text-ink" },
];

/** Concept areas from the report; older reports only list topics, which are shown instead. */
export function conceptRows(domains: ReportDomain[]): Row[] {
  const rows = domains.flatMap((d) => d.concepts.map((concept) => ({ concept, tier: d.name })));
  if (rows.length > 0) return rows;
  return domains.flatMap((d) =>
    d.topics.map((t) => ({
      tier: d.name,
      concept: { name: t.topic, status: TOPIC_STATUS[t.result] ?? "partly_there", wentWell: "", gap: "", workOn: "", questions: [] },
    })),
  );
}

export function ConceptsTab({ domains }: { domains: ReportDomain[] }) {
  const rows = useMemo(() => conceptRows(domains), [domains]);
  const tiers = useMemo(() => [...new Set(rows.map((r) => r.tier))], [rows]);
  const [status, setStatus] = useState<ConceptStatus | "all">("all");
  const [tier, setTier] = useState("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (status === "all" || r.concept.status === status) &&
      (tier === "all" || r.tier === tier) &&
      (!q || [r.concept.name, r.concept.gap, r.concept.workOn, r.concept.wentWell].some((t) => t.toLowerCase().includes(q))),
  );
  const count = (id: ConceptStatus | "all") => (id === "all" ? rows.length : rows.filter((r) => r.concept.status === id).length);
  const reset = () => {
    setQuery("");
    setStatus("all");
    setTier("all");
  };

  return (
    <div data-pdf-block className="space-y-6 rounded-lg border border-line bg-white p-4 sm:p-7">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-base font-semibold">Concept Mastery Matrix</h2>
          <p className="text-xs text-muted">
            Granular breakdown of {rows.length} concepts evaluated across {tiers.length} {tiers.length === 1 ? "domain" : "domains"}
          </p>
        </div>
        <label className="no-print relative block md:min-w-[240px]">
          <span className="sr-only">Search concepts</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concepts, gaps, or remedies..."
            className="w-full rounded-md border border-line bg-slate-50 py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by status" className="inline-flex flex-wrap gap-1 rounded-md bg-accent-soft p-1">
          {FILTERS.filter((f) => f.id !== "not_yet_familiar" || count(f.id) > 0).map((f) => {
            const active = status === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(f.id)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${active ? `bg-white shadow-xs ${f.active}` : "text-slate-600 hover:text-ink"}`}
              >
                {f.label} ({count(f.id)})
              </button>
            );
          })}
        </div>
        {tiers.length > 1 && (
          <label className="flex w-full items-center gap-2 text-xs text-slate-600 sm:w-auto">
            <span className="shrink-0 text-slate-400">Filter Domain:</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer rounded border border-line bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-ink sm:flex-none"
            >
              <option value="all">All Domains</option>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-line bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">No concepts matched your current search and filters.</p>
          <button type="button" onClick={reset} className="mt-3 text-xs font-medium hover:underline">
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((r, i) => {
            const s = statusFor(r.concept.status, null);
            const mastered = r.concept.status === "strong" || !r.concept.gap;
            return (
              <div key={`${r.tier}-${i}`} className="print-avoid-break flex flex-col rounded-md border border-line bg-slate-50/40 p-4 transition-colors hover:bg-slate-50">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-muted">{r.tier}</span>
                  <span className={`text-xs font-semibold ${TONE_TEXT[s.tone]}`}>{s.label}</span>
                </div>
                <h3 className="mb-2.5 font-display text-sm font-semibold">{r.concept.name}</h3>
                {mastered
                  ? r.concept.wentWell && (
                      <div className="mt-2 space-y-1 text-xs text-slate-700">
                        <span className="block font-medium text-muted">Demonstrated Competency:</span>
                        <p className="rounded border border-line/60 bg-white/80 p-2.5 leading-relaxed">{r.concept.wentWell}</p>
                      </div>
                    )
                  : (
                      <div className="mt-2 space-y-2 text-xs">
                        <div>
                          <span className="mb-0.5 block font-medium text-rose-700">Identified Gap:</span>
                          <p className="rounded border border-rose-100 bg-rose-50/50 p-2.5 leading-relaxed text-rose-950">{r.concept.gap}</p>
                        </div>
                        {r.concept.workOn && (
                          <div>
                            <span className="mb-0.5 block font-medium text-ink">Remediation Action:</span>
                            <p className="rounded border border-line bg-white p-2.5 leading-relaxed text-slate-800">{r.concept.workOn}</p>
                          </div>
                        )}
                      </div>
                    )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
