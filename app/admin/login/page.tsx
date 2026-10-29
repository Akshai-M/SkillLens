import type { Metadata } from "next";
import { PoweredBy } from "@/components/powered-by";
import { AdminLoginForm } from "./form";

export const metadata: Metadata = { title: "Admin sign in · Technical Interview Report" };

export default function AdminLoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <PoweredBy className="absolute right-4 top-4 sm:right-6 sm:top-5" />
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Interview reports</h1>
          <p className="mt-2 text-muted">Sign in to view full reports, including interviewer audit notes.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
