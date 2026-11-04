"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
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
        <Label htmlFor="identifier">Email address</Label>
        <Input
          id="identifier"
          name="identifier"
          type="email"
          autoComplete="email"
          defaultValue={state.identifier}
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-10"
        />
      </div>

      {state.error && (
        <p id="login-error" role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending && <Spinner />}
        {pending ? "Fetching your results" : "View my report"}
      </Button>
    </form>
  );
}
