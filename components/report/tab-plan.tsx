"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { AiWeek } from "@/lib/report/ai";
import { Icon } from "./ui";

// Ticked tasks are a per-student convenience, kept in this browser only.
const EVENT = "competency-report:plan";
const EMPTY: string[] = [];
const snapshots = new Map<string, { raw: string | null; value: string[] }>();

function read(key: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {}
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) value = parsed.filter((x): x is string => typeof x === "string");
  } catch {}
  snapshots.set(key, { raw, value });
  return value;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useDoneTasks(storageKey: string) {
  const done = useSyncExternalStore(subscribe, () => read(storageKey), () => EMPTY);
  const toggle = useCallback(
    (id: string) => {
      const current = read(storageKey);
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [storageKey],
  );
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, [storageKey]);
  return { done, toggle, clear };
}

function toMarkdown(weeks: AiWeek[], heading: string, done: string[], name: string): string {
  const total = weeks.reduce((n, w) => n + w.tasks.length, 0);
  const completed = done.length;
  const lines = [`# ${heading}${name ? ` for ${name}` : ""}`, "", `Progress: ${completed}/${total} tasks completed`, ""];
  for (const w of weeks) {
    lines.push(`## Week ${w.week}: ${w.focus}`, "");
    if (w.target) lines.push(`**Target:** ${w.target}`, "");
    if (w.why) lines.push(`**Why it matters:** ${w.why}`, "");
    if (w.tasks.length) lines.push("### Tasks & daily drills", ...w.tasks.map((t, i) => `- [${done.includes(`${w.week}:${i}`) ? "x" : " "}] ${t}`), "");
    if (w.questions.length) lines.push("### Practice questions", ...w.questions.map((q, i) => `${i + 1}. ${q}`), "");
    lines.push("---", "");
  }
  return lines.join("\n");
}

export function PlanTab({ weeks, storageKey, subtitle, name }: { weeks: AiWeek[]; storageKey: string; subtitle: string; name: string }) {
  const { done, toggle, clear } = useDoneTasks(storageKey);
  const [confirmReset, setConfirmReset] = useState(false);
  const validIds = weeks.flatMap((w) => w.tasks.map((_, i) => `${w.week}:${i}`));
  const doneValid = done.filter((id) => validIds.includes(id));
  const total = validIds.length;
  const completed = doneValid.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const heading = `Personalized ${weeks.length}-Week Remediation Roadmap`;

  const exportPlan = () => {
    const blob = new Blob([toMarkdown(weeks, heading, doneValid, name)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${weeks.length}-week-prep-plan${name ? `-${name.toLowerCase().replace(/\s+/g, "-")}` : ""}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 rounded-lg border border-line bg-white p-4 sm:p-7">
      <div data-pdf-block className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-base font-semibold">{heading}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <div className="no-print flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportPlan}
            className="inline-flex items-center gap-1.5 rounded bg-accent-soft px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            <Icon name="download" className="size-3.5" /> Export Plan (.md)
          </button>
          {completed > 0 &&
            (confirmReset ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-muted">Reset all ticks?</span>
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setConfirmReset(false);
                  }}
                  className="rounded bg-rose-50 px-2 py-1 font-medium text-bad hover:bg-rose-100"
                >
                  Reset
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="px-1 py-1 text-muted hover:text-ink">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-muted hover:text-slate-800"
              >
                <Icon name="reset" className="size-3.5" /> Reset
              </button>
            ))}
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded border border-line bg-slate-50 p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-700">
              Roadmap Completion Progress:{" "}
              <span className="font-mono font-semibold tabular-nums text-ink">
                {completed} of {total} tasks completed
              </span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 sm:w-72" aria-hidden>
              <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums sm:text-right">{pct}%</p>
        </div>
      )}

      </div>

      <div className="space-y-6">
        {weeks.map((w) => (
          <article data-pdf-block key={w.week} className="print-avoid-break space-y-4 rounded-lg border border-line bg-slate-50/30 p-4 sm:p-6">
            <header className="flex flex-col justify-between gap-3 border-b border-line pb-3 sm:flex-row sm:items-start">
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-mono text-xs font-semibold text-muted">
                  <Icon name="calendar" className="size-3.5" />
                  <span>WEEK {String(w.week).padStart(2, "0")}</span>
                </p>
                <h3 className="font-display text-lg font-bold">{w.focus}</h3>
              </div>
              {w.target && (
                <div className="shrink-0 sm:max-w-md sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Milestone Target</p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-800 sm:text-sm">{w.target}</p>
                </div>
              )}
            </header>

            {w.why && (
              <p className="rounded border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-950">
                <span className="font-semibold text-amber-900">Why this week is critical: </span>
                {w.why}
              </p>
            )}

            {w.tasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Actionable Tasks &amp; Drills</p>
                <ul className="grid grid-cols-1 gap-2.5">
                  {w.tasks.map((t, i) => {
                    const id = `${w.week}:${i}`;
                    const checked = done.includes(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggle(id)}
                          className={`flex w-full select-none items-start gap-3 rounded border p-3 text-left transition-colors ${
                            checked ? "border-emerald-200 bg-emerald-50/50 text-slate-600 line-through" : "border-line bg-white text-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <Icon name={checked ? "check" : "circle"} className={`mt-0.5 size-4 shrink-0 ${checked ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className="text-xs leading-relaxed sm:text-sm">{t}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {w.questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Practice Questions</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-800 sm:text-sm">
                  {w.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
