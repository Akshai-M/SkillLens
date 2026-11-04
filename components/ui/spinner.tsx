import { CircleDotDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/** Loading indicator used across the app. */
export function Spinner({ className }: { className?: string }) {
  return <CircleDotDashed aria-hidden className={cn("size-4 shrink-0 animate-spin", className)} />;
}

/** Centered spinner with a message, for loading pages and sections. */
export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3 py-16 text-sm text-subtle", className)}>
      <Spinner className="size-7 text-ink" />
      {label}
    </div>
  );
}
