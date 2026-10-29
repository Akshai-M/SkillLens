import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { CompetencyReport } from "@/components/report/competency-report";
import { requireStudent } from "@/lib/auth";

/** Server shell for a competency route: checks the session cookie, then the client renders from localStorage. */
export function CompetencyPage({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Shell slug={slug} />
    </Suspense>
  );
}

async function Shell({ slug }: { slug: string }) {
  const student = await requireStudent();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <CompetencyReport slug={slug} email={student.email} name={student.name} />
      </main>
    </>
  );
}
