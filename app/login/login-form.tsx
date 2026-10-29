"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveReport } from "@/lib/report/store";
import { login, type LoginState } from "../actions";

export function LoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<LoginState, FormData>(async (prev, formData) => {
    const result = await login(prev, formData);
    if (!result.data) return result;
    // Login is one of the two moments the API is called; keep the result for every page.
    // Handled here rather than in an effect: Next keeps this page's state alive after
    // navigating away, and an effect would re-save stale data when it's shown again.
    saveReport(result.data);
    router.replace("/");
    return {};
  }, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="identifier" className="block text-sm font-medium text-ink">
          Email address
        </label>
        <input
          id="identifier"
          name="identifier"
          type="email"
          autoComplete="email"
          defaultValue={state.identifier}
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </div>

      {state.error && (
        <p id="login-error" role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-on-accent transition hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Fetching your results…" : "View my report"}
      </button>
    </form>
  );
}
