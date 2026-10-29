"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COMPETENCIES } from "@/lib/competencies";
import { getAttempts, type StudentData } from "@/lib/report/parse";
import { AttemptBrowser } from "@/components/report/attempt-browser";
import { Icon } from "@/components/report/ui";
import { adminLookup } from "./actions";

/** Look up any student by email and see their full reports, including internal audit notes. */
export function AdminDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminLookup(email);
      if (result.signedOut) return router.replace("/admin/login");
      if (result.error) {
        setError(result.error);
        setData(null);
        return;
      }
      setData(result.data ?? null);
      const first = COMPETENCIES.find((c) => result.data && getAttempts(result.data, c).length > 0);
      setSlug(first?.slug ?? null);
    });
  };

  const competencies = data ? COMPETENCIES.map((c) => ({ c, attempts: getAttempts(data, c) })).filter((x) => x.attempts.length > 0) : [];
  const current = competencies.find((x) => x.c.slug === slug) ?? competencies[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <h1 className="text-2xl font-semibold tracking-tight">Student lookup</h1>
        <p className="mt-1 text-muted">Full reports with interviewer audit notes, recordings and recorded levels. Nothing here is stored in the browser.</p>
        <form onSubmit={lookup} className="mt-5 flex flex-wrap gap-3">
          <label className="relative min-w-0 flex-1 basis-72">
            <span className="sr-only">Student email</span>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full rounded-lg border border-line bg-sunken py-2.5 pl-9 pr-3 focus:border-ink focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? "Looking up…" : "Look up"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
      </section>

      {data && current && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {competencies.map(({ c, attempts }) => {
              const active = c.slug === current.c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSlug(c.slug)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${
                    active ? "border-ink bg-accent font-medium text-on-accent" : "border-line bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {c.title} · {attempts.length}
                </button>
              );
            })}
          </div>
          <div ref={setActionsSlot} className="no-print flex flex-wrap items-center gap-2" />
          </div>
          {/* key resets the attempt view when switching student or competency */}
          <AttemptBrowser
            key={`${data.email}-${current.c.slug}`}
            competency={current.c}
            attempts={current.attempts}
            name={data.name}
            email={data.email}
            actionsSlot={actionsSlot}
          />
        </>
      )}
    </div>
  );
}
