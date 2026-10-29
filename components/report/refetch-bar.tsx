"use client";

import { useRefetch } from "@/lib/report/store";

function formatFetchedAt(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Shows when results were last fetched and lets the student pull fresh ones. */
export function RefetchBar({ fetchedAt }: { fetchedAt: number }) {
  const { refetch, pending, error } = useRefetch();
  return (
    <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      <span>Updated {formatFetchedAt(fetchedAt)}</span>
      <button
        type="button"
        onClick={refetch}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-ink hover:bg-canvas disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 20 20" className={`size-4 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.5H13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pending ? "Refetching…" : "Refetch"}
      </button>
      {error && <span role="alert" className="text-bad">{error}</span>}
    </div>
  );
}

/** Shown when the session is valid but nothing is stored in this browser yet. */
export function NoStoredData() {
  const { refetch, pending, error } = useRefetch();
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
      <p className="font-medium">Your results aren&apos;t loaded in this browser</p>
      <p className="mt-1 text-sm text-muted">Load them once and they&apos;ll stay here until you sign out.</p>
      <button
        type="button"
        onClick={refetch}
        disabled={pending}
        className="mt-5 rounded-lg bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Loading…" : "Load my results"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
