const FEEDBACK_FORM_URL = "https://forms.ccbp.in/competency-interview-report-feedback";

/** Floating link to the report feedback form, shown on every page. */
export function FeedbackFormButton() {
  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="no-print fixed right-4 z-50 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-on-accent shadow-lg shadow-black/20 transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-6"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h12v9H8l-4 3V4Z" strokeLinejoin="round" />
      </svg>
      Share feedback
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
