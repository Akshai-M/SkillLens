"use client";

import Link from "next/link";
import { useState } from "react";
import { getCompetency } from "@/lib/competencies";
import { getAttempts } from "@/lib/report/parse";
import { useStoredReport } from "@/lib/report/store";
import { ContentSkeleton } from "@/components/app-header";
import { AttemptBrowser } from "./attempt-browser";
import { NoStoredData, RefetchBar } from "./refetch-bar";

/** A student's page for one competency, rendered from the copy stored in this browser. */
export function CompetencyReport({ slug, email, name }: { slug: string; email: string; name: string }) {
  const competency = getCompetency(slug);
  const data = useStoredReport(email);
  // Report actions (Download PDF) render here, under the Refetch button.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  if (data === undefined) return <ContentSkeleton />;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link href="/" className="no-print text-sm text-muted hover:text-ink">
          ← All competencies
        </Link>
        <p className="mt-2 text-sm font-medium text-muted">{competency.title}</p>
      </div>
      {data && (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <RefetchBar fetchedAt={data.fetchedAt} />
          <div ref={setActionsSlot} className="no-print flex flex-wrap items-center gap-2" />
        </div>
      )}
    </div>
  );

  if (data === null) {
    return (
      <>
        {header}
        <NoStoredData />
      </>
    );
  }

  const attempts = getAttempts(data, competency);
  return (
    <div className="space-y-6">
      {header}
      {attempts.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="font-medium">No {competency.title} interview yet</p>
          <p className="mt-1 text-sm text-muted">Once you take this interview, your feedback will appear here. Use Refetch to check for new results.</p>
        </section>
      ) : (
        <AttemptBrowser competency={competency} attempts={attempts} name={data.name || name} email={email} actionsSlot={actionsSlot} />
      )}
    </div>
  );
}
