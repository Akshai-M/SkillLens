import type { Metadata } from "next";
import { PoweredBy } from "@/components/powered-by";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Interview Report" };

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <PoweredBy className="absolute right-4 top-4 sm:right-6 sm:top-5" />
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">Technical Interview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Your feedback report</h1>
          <p className="mt-2 text-muted">
            Sign in with the email you used for your interview.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
