"use client";

import { ListFilter, RotateCcw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPETENCIES } from "@/lib/competencies";
import { formatDuration, formatIst, formatNumber } from "@/lib/analytics/format";
import type { StudentActivity } from "@/lib/analytics/queries";
import { Pagination, usePage } from "./pagination";

// ---- Condition model ----------------------------------------------------------------

const ALL = "all";
const ANY = "any";

export type NumberOp = "any" | "gt" | "gte" | "lt" | "lte" | "eq" | "between";
export type DateOp = "any" | "on" | "before" | "after" | "between";
export type Unit = "sec" | "min" | "hr";

export type NumberCondition = { op: NumberOp; value: string; value2: string; unit?: Unit };
export type DateCondition = { op: DateOp; value: string; value2: string };

const NUMBER_OPS: [NumberOp, string][] = [
  ["any", "Any"],
  ["gt", "Greater than"],
  ["gte", "At least (≥)"],
  ["lt", "Less than"],
  ["lte", "At most (≤)"],
  ["eq", "Equal to"],
  ["between", "Between"],
];
const DATE_OPS: [DateOp, string][] = [
  ["any", "Any"],
  ["on", "On"],
  ["before", "Before"],
  ["after", "After"],
  ["between", "Between"],
];
const UNITS: [Unit, string, number][] = [
  ["sec", "Seconds", 1000],
  ["min", "Minutes", 60 * 1000],
  ["hr", "Hours", 60 * 60 * 1000],
];
const SECTIONS: [keyof StudentActivity["sectionMs"], string][] = [
  ["overview", "Executive Summary"],
  ["domains", "Domain Evaluations"],
  ["concepts", "Concept Mastery"],
  ["plan", "Prep Plan"],
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDate = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

const anyNumber = (unit?: Unit): NumberCondition => ({ op: "any", value: "", value2: "", unit });
const anyDate = (): DateCondition => ({ op: "any", value: "", value2: "" });

/** A condition with a missing value is ignored rather than excluding everyone. */
export function isActive(c: NumberCondition | DateCondition): boolean {
  if (c.op === "any" || c.value === "") return false;
  return c.op !== "between" || c.value2 !== "";
}

export function matchNumber(value: number | null, c: NumberCondition): boolean {
  if (!isActive(c)) return true;
  const scale = c.unit ? UNITS.find((u) => u[0] === c.unit)![2] : 1;
  const v = value ?? 0;
  const a = Number(c.value) * scale;
  const b = Number(c.value2) * scale;
  if (Number.isNaN(a) || (c.op === "between" && Number.isNaN(b))) return true;
  switch (c.op) {
    case "gt":
      return v > a;
    case "gte":
      return v >= a;
    case "lt":
      return v < a;
    case "lte":
      return v <= a;
    // Durations compare at the chosen unit, so "= 5 minutes" matches 5m 0s–5m 59s.
    case "eq":
      return c.unit ? Math.floor(v / scale) === Number(c.value) : v === a;
    case "between":
      return v >= Math.min(a, b) && v <= Math.max(a, b);
    default:
      return true;
  }
}

export function matchDate(value: number | null, c: DateCondition): boolean {
  if (!isActive(c)) return true;
  if (value == null) return false;
  const d = istDate(value);
  if (c.op === "on") return d === c.value;
  if (c.op === "before") return d < c.value;
  if (c.op === "after") return d > c.value;
  const [lo, hi] = [c.value, c.value2].sort();
  return d >= lo && d <= hi;
}

/** Time measured for the chosen competency and report section. */
export function timeFor(s: StudentActivity, competency: string, section: string): number {
  if (competency === ALL && section === ALL) return s.timeSpentMs;
  if (section === ALL) return s.competencyMs[competency] ?? 0;
  if (competency === ALL) return s.sectionMs[section as keyof StudentActivity["sectionMs"]] ?? 0;
  return s.sectionByCompetencyMs[competency]?.[section as keyof StudentActivity["sectionMs"]] ?? 0;
}

type Filters = {
  status: string;
  type: string;
  frequency: string;
  competency: string;
  section: string;
  time: NumberCondition;
  visits: NumberCondition;
  sessions: NumberCondition;
  activeDays: NumberCondition;
  reportsViewed: NumberCondition;
  practiceClicks: NumberCondition;
  avgSession: NumberCondition;
  firstVisit: DateCondition;
  lastVisit: DateCondition;
  lastLogin: DateCondition;
};

const EMPTY: Filters = {
  status: ALL,
  type: ALL,
  frequency: ALL,
  competency: ALL,
  section: ALL,
  time: anyNumber("min"),
  visits: anyNumber(),
  sessions: anyNumber(),
  activeDays: anyNumber(),
  reportsViewed: anyNumber(),
  practiceClicks: anyNumber(),
  avgSession: anyNumber("min"),
  firstVisit: anyDate(),
  lastVisit: anyDate(),
  lastLogin: anyDate(),
};

function applyFilters(students: StudentActivity[], f: Filters): StudentActivity[] {
  return students.filter(
    (s) =>
      (f.status === ALL || s.status === f.status) &&
      (f.type === ALL || s.type === f.type) &&
      (f.frequency === ALL || s.frequency === f.frequency) &&
      (f.competency === ALL || s.competencies.includes(f.competency)) &&
      matchNumber(timeFor(s, f.competency, f.section), f.time) &&
      matchNumber(s.visits, f.visits) &&
      matchNumber(s.sessions, f.sessions) &&
      matchNumber(s.activeDays, f.activeDays) &&
      matchNumber(s.reportsViewed, f.reportsViewed) &&
      matchNumber(s.practiceClicks, f.practiceClicks) &&
      matchNumber(s.avgSessionMs, f.avgSession) &&
      matchDate(s.firstVisit, f.firstVisit) &&
      matchDate(s.lastVisit, f.lastVisit) &&
      matchDate(s.lastLogin, f.lastLogin),
  );
}

// ---- Component ----------------------------------------------------------------------

export function StudentTable({ students }: { students: StudentActivity[] }) {
  // `f` is what the admin is editing; the table only changes when they press Apply.
  const [f, setF] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const set = <K extends keyof Filters>(key: K) => (value: Filters[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const filtered = useMemo(() => applyFilters(students, applied), [students, applied]);
  const pager = usePage(filtered.length, 5);
  const pending = JSON.stringify(f) !== JSON.stringify(applied);
  const changed = JSON.stringify(f) !== JSON.stringify(EMPTY) || JSON.stringify(applied) !== JSON.stringify(EMPTY);
  const apply = (next: Filters) => {
    setApplied(next);
    pager.setPage(1);
  };

  const competencyLabel = f.competency === ALL ? "" : COMPETENCIES.find((c) => c.slug === f.competency)?.title ?? "";
  const sectionLabel = f.section === ALL ? "" : SECTIONS.find((x) => x[0] === f.section)?.[1] ?? "";
  const timeLabel = [competencyLabel, sectionLabel].filter(Boolean).join(" · ") || "the whole site";

  return (
    <div className="space-y-4">
      <form
        className="space-y-5 rounded-md border border-line bg-slate-50/60 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply(f);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Student table filters</p>
            <p className="text-xs text-subtle">Apply only to this table. Set the filters, then press Apply filters. Leave a filter on “Any” to ignore it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-subtle">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of {students.length}
            </p>
            <Button type="submit" size="sm" disabled={!pending}>
              <ListFilter aria-hidden />
              Apply filters
            </Button>
            {changed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setF(EMPTY);
                  apply(EMPTY);
                }}
              >
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
        </div>

        <FilterGroup title="Student">
          <Choice id="t-status" label="Status" value={f.status} onChange={set("status")} options={[["active", "Active"], ["inactive", "Inactive"]]} />
          <Choice id="t-type" label="User type" value={f.type} onChange={set("type")} options={[["new", "New"], ["returning", "Returning"]]} />
          <Choice
            id="t-frequency"
            label="Visit frequency"
            value={f.frequency}
            onChange={set("frequency")}
            options={[["Daily", "Daily"], ["Weekly", "Weekly"], ["Occasionally", "Occasionally"], ["Never", "Never"]]}
          />
        </FilterGroup>

        <FilterGroup title="Competency & time spent">
          <Choice
            id="t-competency"
            label="Competency"
            value={f.competency}
            onChange={set("competency")}
            allLabel="All competencies"
            options={COMPETENCIES.map((c) => [c.slug, c.title])}
          />
          <Choice id="t-section" label="Report section" value={f.section} onChange={set("section")} allLabel="All sections" options={SECTIONS} />
          <NumberField id="t-time" label={`Time spent on ${timeLabel}`} value={f.time} onChange={set("time")} className="sm:col-span-2" />
        </FilterGroup>

        <FilterGroup title="Activity">
          <NumberField id="t-visits" label="Visits" value={f.visits} onChange={set("visits")} />
          <NumberField id="t-sessions" label="Sessions" value={f.sessions} onChange={set("sessions")} />
          <NumberField id="t-days" label="Active days" value={f.activeDays} onChange={set("activeDays")} />
          <NumberField id="t-reports" label="Reports viewed" value={f.reportsViewed} onChange={set("reportsViewed")} />
          <NumberField id="t-practice" label="Practice question clicks" value={f.practiceClicks} onChange={set("practiceClicks")} />
          <NumberField id="t-avg" label="Avg session duration" value={f.avgSession} onChange={set("avgSession")} />
        </FilterGroup>

        <FilterGroup title="Dates (IST)">
          <DateField id="t-first" label="First visit" value={f.firstVisit} onChange={set("firstVisit")} />
          <DateField id="t-last" label="Last visit" value={f.lastVisit} onChange={set("lastVisit")} />
          <DateField id="t-login" label="Last login" value={f.lastLogin} onChange={set("lastLogin")} />
        </FilterGroup>
      </form>

      <div>
        <Table filtered={filtered.slice(pager.start, pager.end)} />
        <Pagination count={filtered.length} pager={pager} />
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-4 first-of-type:border-0">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <Label htmlFor={htmlFor} className="text-xs text-subtle">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Choice({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  allLabel?: string;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function NumberField({
  id,
  label,
  value: c,
  onChange,
  className = "",
}: {
  id: string;
  label: string;
  value: NumberCondition;
  onChange: (c: NumberCondition) => void;
  className?: string;
}) {
  const off = c.op === ANY;
  return (
    <Field label={label} htmlFor={id} className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={c.op} onValueChange={(op) => onChange({ ...c, op: op as NumberOp })}>
          <SelectTrigger id={id} aria-label={`${label} condition`} className="w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_OPS.map(([op, l]) => (
              <SelectItem key={op} value={op}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!off && (
          <>
            <Input
              aria-label={`${label} value`}
              type="number"
              min={0}
              step="any"
              value={c.value}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              placeholder="0"
              className="w-20 bg-white"
            />
            {c.op === "between" && (
              <>
                <span className="text-xs text-subtle">and</span>
                <Input
                  aria-label={`${label} upper value`}
                  type="number"
                  min={0}
                  step="any"
                  value={c.value2}
                  onChange={(e) => onChange({ ...c, value2: e.target.value })}
                  placeholder="0"
                  className="w-20 bg-white"
                />
              </>
            )}
            {c.unit && (
              <Select value={c.unit} onValueChange={(u) => onChange({ ...c, unit: u as Unit })}>
                <SelectTrigger aria-label={`${label} unit`} className="w-28 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map(([u, l]) => (
                    <SelectItem key={u} value={u}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>
    </Field>
  );
}

function DateField({ id, label, value: c, onChange }: { id: string; label: string; value: DateCondition; onChange: (c: DateCondition) => void }) {
  return (
    <Field label={label} htmlFor={id} className="lg:col-span-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={c.op} onValueChange={(op) => onChange({ ...c, op: op as DateOp })}>
          <SelectTrigger id={id} aria-label={`${label} condition`} className="w-28 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPS.map(([op, l]) => (
              <SelectItem key={op} value={op}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {c.op !== ANY && (
          <Input aria-label={`${label} date`} type="date" value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value })} className="w-40 bg-white" />
        )}
        {c.op === "between" && (
          <>
            <span className="text-xs text-subtle">and</span>
            <Input aria-label={`${label} end date`} type="date" value={c.value2} onChange={(e) => onChange({ ...c, value2: e.target.value })} className="w-40 bg-white" />
          </>
        )}
      </div>
    </Field>
  );
}

const COMPETENCY_SHORT: Record<string, string> = {
  "frontend-development": "Frontend",
  dsa: "DSA",
  "backend-development": "Backend",
  "se-fundamentals": "SE",
};

function Table({ filtered }: { filtered: StudentActivity[] }) {
  if (filtered.length === 0) return <p className="py-6 text-center text-sm text-subtle">No students match these filters.</p>;
  const competencyTitle = new Map(COMPETENCIES.map((c) => [c.slug, c.title]));
  const head = [
    "Student",
    "Status",
    "First visit",
    "Last visit",
    "Visits",
    "Sessions",
    "Time spent",
    "Avg session",
    "Time by competency",
    "Frequency",
    "Reports viewed",
    "Practice clicks",
    "Last report viewed",
  ];
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-subtle">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filtered.map((s) => {
            const byCompetency = Object.entries(s.competencyMs).filter(([, v]) => v > 0);
            return (
              <tr key={s.email} className="hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <span className="block max-w-64 truncate font-medium text-ink">{s.email}</span>
                  {s.name && <span className="block max-w-64 truncate text-xs text-subtle">{s.name}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${s.status === "active" ? "bg-good-bar" : "bg-slate-300"}`} aria-hidden />
                    {s.status === "active" ? "Active" : "Inactive"}
                    {s.type && <span className="rounded bg-brand-soft px-1.5 text-[11px] text-subtle">{s.type === "new" ? "New" : "Returning"}</span>}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatIst(s.firstVisit)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatIst(s.lastVisit)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatNumber(s.visits)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatNumber(s.sessions)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{formatDuration(s.timeSpentMs)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{formatDuration(s.avgSessionMs)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">
                  {byCompetency.length === 0
                    ? "—"
                    : byCompetency.map(([slug, v]) => (
                        <span key={slug} className="block">
                          {COMPETENCY_SHORT[slug] ?? slug} <span className="font-mono">{formatDuration(v)}</span>
                        </span>
                      ))}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">{s.frequency}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatNumber(s.reportsViewed)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="font-mono tabular-nums">{formatNumber(s.practiceClicks)}</span>
                  {s.practiceClicks > 0 && (
                    <span className="block text-xs text-subtle">
                      {s.practiceQuestions} {s.practiceQuestions === 1 ? "question" : "questions"}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                  {s.lastReport ? (
                    <>
                      {competencyTitle.get(s.lastReport.competency) ?? s.lastReport.competency}
                      <span className="block text-xs text-subtle">{formatIst(s.lastReport.at)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
