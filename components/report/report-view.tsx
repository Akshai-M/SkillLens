"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Competency } from "@/lib/competencies";
import { formatDate } from "@/lib/report/fields";
import { isCleared, levelStatus, type Interview } from "@/lib/report/parse";
import { exportReportPdf } from "@/lib/report/pdf";
import { ReportHero } from "./report-hero";
import { SetupSection, SheetReport } from "./sheet-report";
import { AuditTab } from "./tab-audit";
import { ConceptsTab, conceptRows } from "./tab-concepts";
import { DomainsTab } from "./tab-domains";
import { PlanTab } from "./tab-plan";
import { CopyButton, SummaryTab } from "./tab-summary";
import { Icon } from "./ui";

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  no_show: {
    title: "You missed this interview",
    body: "This interview was marked as a no-show, so there's no feedback for it. Reach out to your coordinator to reschedule.",
  },
  cancelled: {
    title: "This interview was cancelled",
    body: "There's no feedback for a cancelled interview.",
  },
  scheduled: {
    title: "Interview scheduled",
    body: "Your feedback will appear here after the interview is completed and reviewed.",
  },
};

type TabId = "overview" | "domains" | "concepts" | "plan" | "audit";

/** One interview's full report: dossier plus tabbed sections (or the sheet-based fallback). */
export function ReportView({
  interview,
  competency,
  name,
  email,
  actionsSlot,
}: {
  interview: Interview;
  competency: Competency;
  name: string;
  email: string;
  /** Where the page wants the Download PDF (and admin Raw Data) buttons rendered. */
  actionsSlot?: HTMLElement | null;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [rawOpen, setRawOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const slot = actionsSlot ?? null;

  if (interview.status !== "completed" || !interview.released) {
    const msg =
      interview.status !== "completed"
        ? STATUS_MESSAGES[interview.status] ?? STATUS_MESSAGES.scheduled
        : {
            title: "Your report is being finalised",
            body: "Your interview is complete. Feedback is reviewed before it's shared, and will show up here once it's released.",
          };
    return (
      <section className="rounded-lg border border-line bg-white p-4 sm:p-8">
        <p className="font-mono text-xs text-muted">
          {competency.title} · {formatDate(interview.date)}
          {interview.time && `, ${interview.time}`} · Attempt {interview.attemptNo}
        </p>
        <h2 className="mt-3 font-display text-xl font-bold">{msg.title}</h2>
        <p className="mt-1 max-w-prose text-slate-600">{msg.body}</p>
      </section>
    );
  }

  const s = interview.structured;
  const isAdmin = Boolean(interview.admin);
  const ratings = s ? s.domains.map((d) => (d.status === "not_assessed" ? null : d.rating)) : interview.skills.map((k) => k.rating);
  const focusCount = ratings.filter((r) => r !== null && r <= 2).length;

  // Open a new tab at its start rather than at the previous tab's scroll position.
  const switchTab = (id: TabId) => {
    setTab(id);
    requestAnimationFrame(() => {
      const anchor = document.getElementById("report-tabs");
      if (anchor && anchor.getBoundingClientRect().top < 64) anchor.scrollIntoView();
    });
  };
  const openPlan = () => {
    setTab("plan");
    requestAnimationFrame(() => document.getElementById("report-tabs")?.scrollIntoView({ behavior: "smooth" }));
  };
  const downloadPdf = async () => {
    if (!rootRef.current || exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await exportReportPdf(
        rootRef.current,
        `${slug(name) || "interview"}-${competency.slug}-attempt-${interview.attemptNo}-report.pdf`,
        `${competency.title} · ${name}`,
      );
    } catch {
      setExportError("Couldn't create the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const rawButton = isAdmin && (
    <button
      type="button"
      onClick={() => setRawOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-canvas"
    >
      <Icon name="fileCode" className="size-4 text-slate-600" /> Raw Data
    </button>
  );
  const printButton = (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={exporting}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent shadow-xs hover:bg-accent-strong disabled:opacity-60"
    >
      <Icon name="download" className="size-4" /> {exporting ? "Preparing PDF…" : "Download PDF"}
    </button>
  );

  const rawModal = rawOpen && <RawDataModal interview={interview} onClose={() => setRawOpen(false)} />;
  const exportOverlay = (exporting || exportError) && (
    <div className="no-print fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }} role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
        {exporting ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            Preparing your PDF…
          </>
        ) : (
          <>
            {exportError}
            <button type="button" onClick={() => setExportError(null)} className="text-white/70 hover:text-white">
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (!s) {
    return (
      <div className="space-y-8">
        {slot &&
          createPortal(
            <div className="flex items-center gap-3">
              {rawButton}
              {printButton}
            </div>,
            slot,
          )}
        <div ref={rootRef} className="space-y-8">
          <ReportHero interview={interview} competency={competency} name={name} email={email} focusCount={focusCount} />
          <div data-pdf-page>
            <SheetReport interview={interview} />
          </div>
          {isAdmin && (
            <div data-pdf-page>
              <AuditTab interview={interview} />
            </div>
          )}
        </div>
        {rawModal}
        {exportOverlay}
      </div>
    );
  }

  const concepts = conceptRows(s.domains).length;
  const flags = s.internalFlags?.length ?? 0;
  const weeks = s.weeklyPlan.length;
  const tabs: { id: TabId; nav: string; label: string }[] = [
    { id: "overview", nav: "Executive Summary", label: "Executive Summary & Matrix" },
    { id: "domains", nav: "Domain Evaluation", label: `Domain Evaluations (${s.domains.length})` },
    ...(concepts > 0 ? [{ id: "concepts" as const, nav: "Concept Mastery", label: `Concept Mastery (${concepts} Topics)` }] : []),
    ...(weeks > 0 ? [{ id: "plan" as const, nav: `${weeks}-Week Prep Plan`, label: `${weeks}-Week Prep Plan (${weeks} Weeks)` }] : []),
    ...(isAdmin ? [{ id: "audit" as const, nav: "Interviewer Audit", label: `Interviewer Audit (${flags} ${flags === 1 ? "Flag" : "Flags"})` }] : []),
  ];

  const drill = (key: string) => {
    setSelectedDomain(key);
    setTab("domains");
    setTimeout(() => document.getElementById(`domain-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const { certified, target } = levelStatus(interview, competency);
  const planSubtitle = isCleared(interview.clearance)
    ? target
      ? `Structured roadmap to move you from Level ${certified} to Level ${target}`
      : "Structured roadmap to keep you sharp at the top level of this track"
    : `Structured roadmap to help you clear at Level ${target}`;

  // Inactive panels stay in the DOM but hidden, so printing and PDF export include every section.
  const panel = (id: TabId) => `${tab === id || exporting ? "" : "hidden"} print:block`;

  return (
    <div className="space-y-8">
      {slot &&
        createPortal(
          <div className="flex items-center gap-3">
            {rawButton}
            {printButton}
          </div>,
          slot,
        )}

      <div ref={rootRef} className="space-y-8">
      <ReportHero interview={interview} competency={competency} name={name} email={email} focusCount={focusCount} onOpenPlan={weeks > 0 ? openPlan : undefined} />

      <div id="report-tabs" className="no-print scroll-mt-20 border-b border-line">
        <div role="tablist" aria-label="Report sections" className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-px [scrollbar-width:none] sm:mx-0 sm:px-0">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => switchTab(t.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                  active ? "border-ink font-semibold text-ink" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div data-pdf-page id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className={panel("overview")}>
        <SummaryTab feedback={s} selectedDomain={selectedDomain} onDrill={drill} onOpenPlan={openPlan} />
        <div className="mt-8">
          <SetupSection interview={interview} />
        </div>
      </div>
      <div data-pdf-page id="panel-domains" role="tabpanel" aria-labelledby="tab-domains" className={`${panel("domains")} print-page-break`}>
        <DomainsTab domains={s.domains} selected={selectedDomain} />
      </div>
      {concepts > 0 && (
        <div data-pdf-page id="panel-concepts" role="tabpanel" aria-labelledby="tab-concepts" className={`${panel("concepts")} print-page-break`}>
          <ConceptsTab domains={s.domains} />
        </div>
      )}
      {weeks > 0 && (
        <div data-pdf-page id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" className={`${panel("plan")} print-page-break`}>
          <PlanTab weeks={s.weeklyPlan} storageKey={`competency-report:plan:${interview.key}`} subtitle={planSubtitle} name={name} />
        </div>
      )}
      {isAdmin && (
        <div data-pdf-page id="panel-audit" role="tabpanel" aria-labelledby="tab-audit" className={`${panel("audit")} print-page-break`}>
          <AuditTab interview={interview} />
        </div>
      )}

      </div>

      {rawModal}
      {exportOverlay}
    </div>
  );
}

/** Admin-only, read-only view of the parsed interview data. */
function RawDataModal({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  const json = JSON.stringify(interview, null, 2);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="raw-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-line bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 id="raw-title" className="font-display text-base font-semibold">
              Interview Evaluation JSON Inspector
            </h3>
            <p className="text-xs text-muted">Parsed data for this attempt, including admin-only fields</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <div className="flex items-center justify-between pb-2 font-mono text-xs text-muted">
            <span>Payload Preview</span>
            <CopyButton text={json} label="Copy JSON" />
          </div>
          <textarea
            readOnly
            value={json}
            spellCheck={false}
            className="min-h-[50vh] w-full flex-1 resize-none overflow-y-auto rounded border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <div className="flex justify-end border-t border-line bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
