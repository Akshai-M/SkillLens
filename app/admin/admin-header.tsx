import { ChartColumn, LogOut, UserSearch } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/app-header";
import { PoweredBy } from "@/components/powered-by";
import { Button } from "@/components/ui/button";
import type { AdminRole } from "@/lib/session";
import { adminLogout } from "./actions";

const SECTIONS = [
  { href: "/admin", label: "Student lookup", icon: UserSearch, roles: ["viewer", "full"] },
  { href: "/admin/analytics", label: "User analytics", icon: ChartColumn, roles: ["full"] },
] as const;

export function AdminHeader({ active, role }: { active: (typeof SECTIONS)[number]["href"]; role: AdminRole }) {
  const sections = SECTIONS.filter((s) => (s.roles as readonly AdminRole[]).includes(role));
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-6 sm:px-6 lg:px-8">
        <Brand badge={role === "full" ? "Admin" : "Admin · View only"} />
        <nav aria-label="Admin sections" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active === s.href ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
                active === s.href ? "bg-brand-soft font-semibold text-ink" : "text-slate-600 hover:text-ink"
              }`}
            >
              <s.icon aria-hidden className="size-4" />
              {s.label}
            </Link>
          ))}
        </nav>
        <form action={adminLogout} className="shrink-0">
          <Button type="submit" variant="outline" size="sm">
            <LogOut aria-hidden />
            Sign out
          </Button>
        </form>
        <PoweredBy className="border-l border-line pl-2 sm:pl-4" />
      </div>
    </header>
  );
}
