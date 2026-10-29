"use client";

import { useState } from "react";
import type { Competency } from "@/lib/competencies";
import { formatDate } from "@/lib/report/fields";
import { bestAttempt, isCleared, isScored, type Interview } from "@/lib/report/parse";
import { ReportView } from "./report-view";

type View = "best" | "latest" | "history";

const STATUS_LABEL: Record<string, string> = { completed: "Completed", no_show: "No-show", cancelled: "Cancelled" };

/** Best / Latest / History switcher over a student's attempts in one competency. */
export function AttemptBrowser({
  competency,
  attempts,
  name,
  email,
  actionsSlot,
}: {
  competency: Competency;
  attempts: Interview[];
  name: string;
  email: string;
  actionsSlot?: HTMLElement | null;
}) {
  const [view, setView] = useState<View>("best");
  const [selected, setSelected] = useState<string | null>(null);

  const latest = attempts[0];
  const best = bestAttempt(attempts);
  const picked = attempts.find((a) => a.key === selected);
  const shown = view === "best" ? best : view === "latest" ? latest : picked;
  const isAdmin = Boolean(latest?.admin);

  const views: { id: View; label: string }[] = [
    { id: "best", label: "Best" },
    { id: "latest", label: "Latest" },
    { id: "history", label: `History (${attempts.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Choose attempt" className="flex gap-1 rounded-xl bg-accent-soft p-1">
          {views.map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setView(v.id);
                  setSelected(null);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-sm ${active ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        {view === "best" && best && best.key === latest.key && attempts.length > 1 && (
          <span className="rounded-full bg-good-soft px-3 py-1 text-sm text-good">Your latest interview is also your best</span>
        )}
      </div>

      {view === "history" && !picked ? (
        <History attempts={attempts} bestKey={best?.key} showLevels={isAdmin} onOpen={setSelected} />
      ) : shown ? (
        <>
          {view === "history" && (
            <button type="button" onClick={() => setSelected(null)} className="no-print text-sm text-muted hover:text-ink">
              ← Back to all attempts
            </button>
          )}
          {/* key resets tab state when switching attempts */}
          <ReportView key={shown.key} interview={shown} competency={competency} name={name} email={email} actionsSlot={actionsSlot} />
        </>
      ) : (
        <section className="rounded-2xl border border-line bg-surface p-8">
          <p className="text-lg font-semibold">No scored interview yet</p>
          <p className="mt-1 text-muted">Your best result will show here once a completed interview has been reviewed and released.</p>
        </section>
      )}
    </div>
  );
}

function History({
  attempts,
  bestKey,
  showLevels,
  onOpen,
}: {
  attempts: Interview[];
  bestKey?: string;
  showLevels: boolean;
  onOpen: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.06em] text-muted">
          <tr>
            <th scope="col" className="px-5 py-3.5 font-semibold">#</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Date</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
            <th scope="col" className="px-5 py-3.5 text-right font-semibold">Score</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Result</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Level</th>
            <th scope="col" className="px-5 py-3.5"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {attempts.map((a) => {
            const scored = isScored(a);
            const cleared = isCleared(a.clearance);
            const status = a.status === "completed" && !a.released ? "Under review" : STATUS_LABEL[a.status] ?? "Scheduled";
            // Students who didn't clear never see a level; admins see the recorded one.
            const level = showLevels ? a.admin?.level || a.level : cleared ? a.level : "";
            return (
              <tr key={a.key} className="hover:bg-sunken">
                <td className="px-5 py-3.5 font-mono text-muted">{a.attemptNo}</td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  {formatDate(a.date)}
                  {a.key === bestKey && <span className="ml-2 rounded bg-good-soft px-1.5 py-0.5 text-xs font-medium text-good">Best</span>}
                </td>
                <td className="px-5 py-3.5">{status}</td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{scored ? a.score : "—"}</td>
                <td className="px-5 py-3.5">
                  {scored && a.clearance ? (
                    <span className={`font-medium ${cleared ? "text-good" : "text-bad"}`}>{cleared ? "Cleared" : "Not Cleared"}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3.5">{scored && level ? level : "—"}</td>
                <td className="px-5 py-3.5 text-right">
                  <button type="button" onClick={() => onOpen(a.key)} className="font-medium underline-offset-4 hover:underline">
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
