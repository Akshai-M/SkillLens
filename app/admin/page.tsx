import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { readAdminRole } from "@/lib/session";
import { AdminHeader } from "./admin-header";
import { AdminDashboard } from "./dashboard";

export const metadata: Metadata = { title: "Admin · Competency Technical Interview Report" };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const role = await readAdminRole();
  if (!role) redirect("/admin/login");
  return (
    <>
      <AdminHeader active="/admin" role={role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <AdminDashboard />
      </main>
    </>
  );
}
