import Link from "next/link";
import { PoweredBy } from "./powered-by";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ badge }: { badge?: string }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-6 sm:px-6 lg:px-8">
        <Brand badge={badge} />
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <SignOutButton />
          <PoweredBy className="border-l border-line pl-2 sm:pl-4" />
        </div>
      </div>
    </header>
  );
}

export function Brand({ badge }: { badge?: string }) {
  return (
    <Link href={badge ? "/admin" : "/"} className="flex min-w-0 shrink items-center gap-2 whitespace-nowrap font-display text-base font-bold tracking-tight text-ink sm:text-lg">
      <span className="inline-block size-2.5 shrink-0 rounded-sm bg-ink" aria-hidden />
      <span className="hidden md:inline">Technical Interview Report</span>
      <span className="truncate md:hidden">Interview Report</span>
      {badge && <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-on-accent">{badge}</span>}
    </Link>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        <span className="flex min-w-0 items-center gap-2 truncate font-display text-base font-bold tracking-tight text-ink sm:text-lg">
          <span className="inline-block size-2.5 rounded-sm bg-ink" aria-hidden />
          Technical Interview Report
        </span>
        <PoweredBy className="ml-auto" />
      </div>
    </header>
  );
}

export function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-8 w-64 rounded bg-line" />
      <div className="h-4 w-96 max-w-full rounded bg-line" />
      <div className="mt-8 h-40 rounded-2xl bg-line/60" />
      <div className="h-40 rounded-2xl bg-line/60" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <ContentSkeleton />
      </main>
    </>
  );
}
