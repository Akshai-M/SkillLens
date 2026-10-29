"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { clearReport } from "@/lib/report/store";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        clearReport();
        await logout();
      }}
    >
      <button
        type="submit"
        aria-label="Sign out"
        className="inline-flex items-center gap-1.5 rounded-md border border-line p-2 text-sm text-ink hover:bg-canvas sm:px-3 sm:py-1.5"
      >
        <LogOut aria-hidden className="size-4 sm:hidden" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </form>
  );
}
