"use client";

import { MessageSquareText } from "lucide-react";
import { Cover } from "@/components/ui/cover";

const FEEDBACK_FORM_URL = "https://forms.ccbp.in/competency-interview-report-feedback";

/** Floating link to the report feedback form, shown on every page. Uses Aceternity's Cover for the animation. */
export function FeedbackFormButton() {
  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="no-print fixed right-4 z-50 flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:right-6"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <Cover
        alwaysSparkle
        containerClassName="block overflow-hidden rounded-full bg-brand px-4 py-2.5 hover:bg-brand-strong dark:bg-brand"
        className="inline-flex items-center gap-2 text-sm font-medium text-on-brand dark:text-on-brand group-hover/cover:text-on-brand"
      >
        <MessageSquareText aria-hidden className="size-4" />
        Share feedback
      </Cover>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
