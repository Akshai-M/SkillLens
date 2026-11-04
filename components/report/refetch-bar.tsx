"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRefetch } from "@/lib/report/store";

function formatFetchedAt(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Shows when results were last fetched and lets the student pull fresh ones. */
export function RefetchBar({ fetchedAt }: { fetchedAt: number }) {
  const { refetch, pending, error } = useRefetch();
  return (
    <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
      <span>Updated {formatFetchedAt(fetchedAt)}</span>
      <Button type="button" variant="outline" size="sm" onClick={refetch} disabled={pending}>
        {pending ? <Spinner /> : <RotateCw aria-hidden />}
        {pending ? "Refetching" : "Refetch"}
      </Button>
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
      <p className="mt-1 text-sm text-subtle">Load them once and they&apos;ll stay here until you sign out.</p>
      <Button type="button" onClick={refetch} disabled={pending} className="mt-5">
        {pending && <Spinner />}
        {pending ? "Loading" : "Load my results"}
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
