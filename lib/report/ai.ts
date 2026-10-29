// Structured feedback from the sheet's `raw_overall_feedback` column (a JSON report).
// The server normalises it with `normalizeAiReport` so only student-facing fields reach
// the browser; `internal_only`, `report_meta` and evidence details are dropped.

export type TopicResult = "correct" | "partial" | "wrong" | "dont_know" | "no_answer";

export type AiTopic = { topic: string; result: TopicResult; hint: boolean };

export type ConceptStatus = "strong" | "partly_there" | "needs_work" | "not_yet_familiar";

export type AiConcept = {
  name: string;
  status: ConceptStatus;
  wentWell: string;
  gap: string;
  workOn: string;
  questions: string[];
};

export type AiDomain = {
  id: string;
  name: string;
  rating: number | null;
  status: string;
  summary: string;
  stronger: string;
  wentWell: string[];
  improve: string[];
  concepts: AiConcept[];
  actions: string[];
  topics: AiTopic[];
};

export type AiWeek = {
  week: number;
  focus: string;
  why: string;
  target: string;
  tasks: string[];
  questions: string[];
};

export type AiReport = {
  executiveSummary: string;
  evaluationSummary: string;
  wentWell: string[];
  improve: string[];
  actions: string[];
  nextStepFocus: string;
  /** Interview-setup note for the student (audio, network, devices). */
  contextNote: string;
  domains: AiDomain[];
  weeklyPlan: AiWeek[];
  /** internal_only.data_quality_flags — only filled for the admin view, never sent to students. */
  internalFlags?: string[];
};

type Json = Record<string, unknown>;

const RESULTS: TopicResult[] = ["correct", "partial", "wrong", "dont_know", "no_answer"];
const CONCEPT_STATUSES: ConceptStatus[] = ["strong", "partly_there", "needs_work", "not_yet_familiar"];

function concept(v: unknown): AiConcept | null {
  if (!isObject(v)) {
    const name = text(v);
    return name ? { name, status: "partly_there", wentWell: "", gap: "", workOn: "", questions: [] } : null;
  }
  const name = text(v.concept_area) || text(v.name);
  if (!name) return null;
  const status = text(v.status) as ConceptStatus;
  return {
    name,
    status: CONCEPT_STATUSES.includes(status) ? status : "partly_there",
    wentWell: text(v.what_went_well),
    gap: text(v.the_gap),
    workOn: text(v.what_to_work_on),
    questions: list(v.practice_questions),
  };
}

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** The report mixes arrays and " | "-separated strings for lists. */
function list(v: unknown): string[] {
  const items = Array.isArray(v) ? v.map(text) : text(v).split(/\s+\|\s+/);
  return items.map((s) => s.trim()).filter(Boolean);
}

function rating(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(text(v));
  return text(v) !== "" && Number.isFinite(n) ? n : null;
}

/** Notes about how the report was produced aren't meant for the student. */
function studentContextNote(v: unknown): string {
  const note = text(v);
  return /assessment row|evaluation row|transcript|recorded domain ratings|should not be treated/i.test(note) ? "" : note;
}

/**
 * Returns null unless the JSON follows the current report format (a `domains` list of
 * student-facing summaries); callers then fall back to the sheet's own feedback.
 */
export function normalizeAiReport(raw: string, { includeInternal = false } = {}): AiReport | null {
  if (!raw.trim()) return null;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(j) || !Array.isArray(j.domains)) return null;

  const result = isObject(j.result) ? j.result : {};
  const overall = isObject(j.overall) ? j.overall : {};
  const evidence = Array.isArray(j.evidence_log) ? j.evidence_log.filter(isObject) : [];

  const domains: AiDomain[] = j.domains.filter(isObject).map((d) => {
    const id = text(d.domain_id);
    return {
      id,
      name: text(d.domain_name) || id,
      rating: rating(d.domain_rating),
      status: text(d.status),
      summary: text(d.performance_summary),
      stronger: text(d.stronger_performance_looks_like),
      wentWell: list(d.what_went_well),
      improve: list(d.areas_of_improvement),
      concepts: (Array.isArray(d.concept_areas) ? d.concept_areas : []).map(concept).filter((c): c is AiConcept => c !== null),
      actions: list(d.action_items),
      topics: evidence
        .filter((e) => text(e.domain_id) === id && text(e.topic))
        .map((e) => {
          const r = text(e.result) as TopicResult;
          return { topic: text(e.topic), result: RESULTS.includes(r) ? r : "partial", hint: e.hint === true };
        }),
    };
  });
  if (domains.length === 0) return null;

  const weeklyPlan: AiWeek[] = (Array.isArray(j.weekly_plan) ? j.weekly_plan : []).filter(isObject).map((w, i) => ({
    week: rating(w.week) ?? i + 1,
    focus: text(w.focus),
    why: text(w.why),
    target: text(w.target),
    tasks: list(w.tasks),
    questions: list(w.practice_questions),
  }));

  return {
    executiveSummary: text(result.executive_summary),
    evaluationSummary: text(overall.evaluation_summary),
    wentWell: list(overall.what_went_well),
    improve: list(overall.areas_of_improvement),
    actions: list(overall.action_items),
    nextStepFocus: text(overall.next_step_focus),
    contextNote: studentContextNote(j.context_note),
    domains,
    weeklyPlan,
    ...(includeInternal && {
      internalFlags: list(isObject(j.internal_only) ? j.internal_only.data_quality_flags : undefined),
    }),
  };
}

/** Loose key for matching a report domain to a sheet skill ("Problem 1 - Approach" ≈ "Problem 1 -Approach"). */
export function matchKey(s: string): string {
  return s.toLowerCase().replace(/theory$/, "").replace(/[^a-z0-9]/g, "");
}
