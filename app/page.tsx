import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { Dashboard } from "@/components/report/dashboard";
import { requireStudent } from "@/lib/auth";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const student = await requireStudent();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <Dashboard email={student.email} name={student.name} />
      </main>
    </>
  );
}
