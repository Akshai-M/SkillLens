"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { clearReport } from "@/lib/report/store";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        clearReport();
        await logout();
      }}
    >
      <Button type="submit" variant="outline" size="sm" aria-label="Sign out" className="max-sm:size-8 max-sm:px-0">
        <LogOut aria-hidden />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </form>
  );
}
