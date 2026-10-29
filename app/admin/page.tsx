import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand, PageSkeleton } from "@/components/app-header";
import { PoweredBy } from "@/components/powered-by";
import { readIsAdmin } from "@/lib/session";
import { AdminDashboard } from "./dashboard";
import { adminLogout } from "./actions";

export const metadata: Metadata = { title: "Admin · Technical Interview Report" };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  if (!(await readIsAdmin())) redirect("/admin/login");
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-6 sm:px-6 lg:px-8">
          <Brand badge="Admin" />
          <div className="flex-1" />
          <form action={adminLogout} className="shrink-0 border-l border-line pl-2 sm:pl-4">
            <button type="submit" className="rounded-md border border-line px-2.5 py-1.5 text-xs hover:bg-sunken sm:px-3 sm:text-sm">
              Sign out
            </button>
          </form>
          <PoweredBy className="border-l border-line pl-2 sm:pl-4" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <AdminDashboard />
      </main>
    </>
  );
}
