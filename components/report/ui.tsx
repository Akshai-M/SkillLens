// Presentational building blocks shared by every report view.
import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bug,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Code,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileCode,
  FolderGit2,
  Gauge,
  GitBranch,
  Info,
  Layers,
  Link2,
  ListChecks,
  ListTodo,
  Mail,
  MessageSquare,
  Printer,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  Target,
  User,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

export type Tone = "good" | "warn" | "bad" | "muted";

export const TONE_TEXT: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", muted: "text-muted" };
export const TONE_BAR: Record<Tone, string> = { good: "bg-good-bar", warn: "bg-warn-bar", bad: "bg-bad-bar", muted: "bg-muted" };
export const TONE_SOFT: Record<Tone, string> = { good: "bg-good-soft", warn: "bg-warn-soft", bad: "bg-bad-soft", muted: "bg-accent-soft" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  strong: { label: "Strong Mastery", tone: "good" },
  partly_there: { label: "Partially Demonstrates", tone: "warn" },
  needs_work: { label: "Needs Remediation", tone: "bad" },
  not_yet_familiar: { label: "Not Yet Familiar", tone: "muted" },
  not_assessed: { label: "Not Assessed", tone: "muted" },
};

/** Status from the report, or derived from a 0–5 rating when the report has none. */
export function statusFor(status: string | undefined, rating: number | null): { key: string; label: string; tone: Tone } {
  let key = status && STATUS[status] ? status : "";
  if (!key) key = rating === null ? "not_assessed" : rating >= 4 ? "strong" : rating >= 3 ? "partly_there" : "needs_work";
  return { key, ...STATUS[key] };
}

export function ratingTone(rating: number | null): Tone {
  return statusFor(undefined, rating).tone;
}

/** Five-segment rating bar, coloured by status. */
export function SegmentBar({ rating, tone, className = "" }: { rating: number | null; tone: Tone; className?: string }) {
  const filled = rating === null ? 0 : Math.round(rating);
  return (
    <span className={`flex gap-1.5 ${className}`} role="img" aria-label={rating === null ? "Not rated" : `Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= filled ? TONE_BAR[tone] : "bg-line"}`} />
      ))}
    </span>
  );
}

export function StatusText({ label, tone, dot = false, className = "" }: { label: string; tone: Tone; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${TONE_TEXT[tone]} ${className}`}>
      {dot && <span className={`size-2 rounded-full ${TONE_BAR[tone]}`} aria-hidden />}
      {label}
    </span>
  );
}

export function Card({
  children,
  className = "",
  id,
  "data-pdf-block": pdfBlock,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  "data-pdf-block"?: boolean;
}) {
  return (
    <section id={id} data-pdf-block={pdfBlock || undefined} className={`rounded-lg border border-line bg-white p-4 sm:p-7 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.08em] text-muted ${className}`}>{children}</p>;
}

export function Bullets({ items, tone }: { items: string[]; tone: Tone }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span className={`mt-2 size-1.5 shrink-0 rounded-full ${TONE_BAR[tone]}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span className="w-5 shrink-0 font-mono text-sm text-muted">{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Title with its optional level/category tag, e.g. "[L2] Database & Auth". */
export function TaggedTitle({ title, tag }: { title: string; tag?: string }) {
  return (
    <>
      {tag && <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 align-[2px] text-[11px] font-medium text-muted">{tag}</span>}
      {title}
    </>
  );
}

// ---- Icons (lucide) --------------------------------------------------------

const ICONS = {
  code: Code,
  book: BookOpen,
  layers: Layers,
  branch: GitBranch,
  chat: MessageSquare,
  folder: FolderGit2,
  server: Server,
  bug: Bug,
  gauge: Gauge,
  check: CheckCircle2,
  tick: Check,
  circle: Circle,
  alert: AlertCircle,
  warning: AlertTriangle,
  target: Target,
  eye: Eye,
  list: ListChecks,
  listTodo: ListTodo,
  calendar: Calendar,
  mail: Mail,
  user: User,
  printer: Printer,
  copy: Copy,
  download: Download,
  reset: RotateCcw,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  search: Search,
  shield: ShieldAlert,
  info: Info,
  video: Video,
  fileCheck: FileCheck,
  fileCode: FileCode,
  link: Link2,
  close: X,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const Component = ICONS[name];
  return <Component aria-hidden className={className} />;
}

/** Picks an icon from a domain's id/name. */
export function domainIcon(idOrName: string): IconName {
  const s = idOrName.toLowerCase();
  if (/communic/.test(s)) return "chat";
  if (/debug|fix/.test(s)) return "bug";
  if (/project|deep/.test(s)) return "folder";
  if (/complex|optimi/.test(s)) return "gauge";
  if (/production|backend|server|db|database|auth/.test(s)) return "server";
  if (/advanced|l4/.test(s)) return "branch";
  if (/intermediate|l3/.test(s)) return "layers";
  if (/theory|concept|foundation|core|oop|design|clean/.test(s)) return "book";
  return "code";
}

export function IconBox({ name }: { name: IconName }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded bg-accent-soft text-slate-700">
      <Icon name={name} className="size-5" />
    </span>
  );
}
