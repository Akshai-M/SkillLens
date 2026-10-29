import { CLEARANCE_TARGET_LEVEL, type Competency, type Rubric, type SheetDef } from "../competencies";
import { matchKey, type AiDomain, type AiReport } from "./ai";
import { field, interviewTimestamp, normalizeKey, num, timeMinutes, type SheetRow } from "./fields";

/** Set by the server on every row: whether the result has been released to the student. */
export const RELEASED_KEY = "__released";

/** Set only on rows prepared for the admin dashboard. */
export const ADMIN_KEY = "__admin";

/** Sheet column holding the structured JSON report; normalised by the server before storage. */
export const AI_REPORT_KEY = normalizeKey("raw_overall_feedback");

export type StudentData = {
  v: 2;
  email: string;
  name: string;
  fetchedAt: number;
  sheets: Record<string, SheetRow[]>;
};

export type SkillResult = {
  id: string;
  title: string;
  tag?: string;
  /** null when the skill wasn't assessed in this interview. */
  rating: number | null;
  observed: string;
  nextLevel: string | null;
  remarks: string;
};

export type IntegrityCheck = { label: string; passed: boolean };

export type ReportDomain = AiDomain & { tag?: string; remarks: string };

export type StructuredFeedback = Omit<AiReport, "domains"> & { domains: ReportDomain[] };

/** Internal details only present in admin data. */
export type AdminDetails = {
  interviewer: string;
  links: { label: string; url: string }[];
  sharedStatus: string;
  auditStatus: string;
  auditRemarks: string;
  comments: string;
  partialReason: string;
  submittedAt: string;
  /** Real level and band, kept for admins even when the student didn't clear. */
  level: string;
  verdictBand: string;
};

export type Interview = {
  key: string;
  uid: string;
  /** 1 = the student's first attempt in this competency. */
  attemptNo: number;
  round: string;
  date: string;
  time: string;
  status: string;
  released: boolean;
  score: number | null;
  verdictBand: string;
  clearance: string;
  level: string;
  placementEligible: boolean;
  overallFeedback: string;
  integrityScore: number | null;
  integrityChecks: IntegrityCheck[];
  integrityRemarks: string;
  skills: SkillResult[];
  /** Structured report from raw_overall_feedback; when present it takes priority over the sheet feedback. */
  structured: StructuredFeedback | null;
  admin?: AdminDetails;
};

/** "Card 1 — HTML & CSS: 3 - Flexbox basics…\nHTML & CSS Remarks: …\nDomain Rating: 3" */
function parseCard(text: string): { rating: number | null; observed: string; inlineRemarks: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const m = (lines[0] ?? "").match(/:\s*(\d+(?:\.\d+)?)\s*-\s*(.+)$/);
  const inlineRemarks =
    lines.find((l) => /remarks\s*:/i.test(l))?.replace(/^.*?remarks\s*:\s*/i, "").trim() ?? "";
  return { rating: m ? Number(m[1]) : null, observed: m?.[2]?.trim() ?? "", inlineRemarks };
}

/** "Student camera is ON: 1 - Yes | … \nDomain Rating: 0.9" */
function parseIntegrity(text: string): IntegrityCheck[] {
  const body = text.split(/\n\s*Domain Rating/i)[0] ?? "";
  return body
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.lastIndexOf(":");
      const label = (idx >= 0 ? part.slice(0, idx) : part).trim();
      const answer = (idx >= 0 ? part.slice(idx + 1) : "").trim();
      return { label, passed: /^1\b|yes/i.test(answer) };
    });
}

function nextLevel(rubric: Rubric, rating: number | null): string | null {
  if (rating === null) return null;
  const level = Math.round(rating);
  return level < 5 ? rubric[level + 1] ?? null : null;
}

function readStructured(row: SheetRow, sheet: SheetDef, skills: SkillResult[]): StructuredFeedback | null {
  const raw = field(row, AI_REPORT_KEY);
  if (!raw) return null;
  let report: AiReport;
  try {
    report = JSON.parse(raw) as AiReport;
  } catch {
    return null;
  }
  // Pair each report domain with its sheet skill(s) to keep the interviewer's own remarks,
  // level tag and rating. DSA 2.0 maps several sheet columns onto one report domain.
  const domains = report.domains.map((d) => {
    const id = matchKey(d.id);
    const name = matchKey(d.name);
    const matched = sheet.skills
      .map((s, i) => ({ def: s, result: skills[i] }))
      .filter(({ def }) => matchKey(def.reportId ?? def.id) === id || [def.title, def.column].some((k) => matchKey(k) === name));
    const remarks = matched
      .filter((m) => m.result.remarks)
      .map((m) => (matched.length > 1 ? `${m.def.title}: ${m.result.remarks}` : m.result.remarks))
      .join("\n\n");
    const single = matched.length === 1 ? matched[0] : undefined;
    const rating = d.rating ?? (d.status !== "not_assessed" ? single?.result.rating ?? null : null);
    return { ...d, rating, tag: single?.def.tag, remarks };
  });
  return { ...report, domains };
}

function readAdmin(row: SheetRow): AdminDetails {
  const links = [
    ["Meet", "Meet Link"],
    ["Recording", "Recording Link"],
    ["Transcript", "Transcript Link"],
    ["AI report", "AI Report"],
  ]
    .map(([label, column]) => ({ label, url: field(row, column) }))
    .filter((l) => /^https?:\/\//.test(l.url));
  return {
    interviewer: field(row, "Interviewer"),
    links,
    sharedStatus: field(row, "Result shared with students status"),
    auditStatus: field(row, "Auditing Status"),
    auditRemarks: field(row, "Audit Remarks"),
    comments: field(row, "Comments"),
    partialReason: field(row, "Partial Completion Reason"),
    submittedAt: field(row, "Feedback Submitted At"),
    level: field(row, "Levels", "Level"),
    verdictBand: field(row, "Verdict Band"),
  };
}

function toInterview(row: SheetRow, sheet: SheetDef): Omit<Interview, "attemptNo"> {
  const skills: SkillResult[] = sheet.skills.map((skill) => {
    const key = skill.key ?? skill.column;
    const card = parseCard(field(row, skill.column));
    const rating = num(field(row, `${key} – Domain Rating`)) ?? card.rating;
    const level = rating === null ? null : Math.round(rating);
    return {
      id: skill.id,
      title: skill.title,
      tag: skill.tag,
      rating,
      observed: card.observed || (level !== null ? skill.rubric[level] ?? "" : ""),
      nextLevel: nextLevel(skill.rubric, rating),
      remarks: field(row, `${key} – Remarks`) || card.inlineRemarks,
    };
  });

  const score100 = num(field(row, "Overall Score (out of 100)"));
  const score5 = num(field(row, "Overall Score", "Final Verdict"));

  return {
    key: [sheet.name, field(row, "UID"), field(row, "Date"), field(row, "Time")].join("|"),
    uid: field(row, "UID"),
    round: field(row, "Round"),
    date: field(row, "Date"),
    time: field(row, "Time"),
    status: (field(row, "Status") || "scheduled").toLowerCase(),
    released: row[RELEASED_KEY] !== "no",
    score: score100 ?? (score5 !== null ? Math.round(score5 * 20) : null),
    verdictBand: field(row, "Verdict Band"),
    clearance: field(row, "Clearance Status"),
    level: field(row, "Levels", "Level"),
    placementEligible: /^yes/i.test(field(row, "Eligible for Placement Pool", "Elgible for Placement Pool")),
    overallFeedback: field(
      row,
      "Overall Feedback",
      "Overall Feedback – Remarks",
      "Overall Remarks",
      "Overall Remarks – Remarks",
    ).replace(/^overall remarks\s*:\s*/i, ""),
    integrityScore: num(field(row, "Integrity Score")),
    integrityChecks: parseIntegrity(field(row, "Interview Integrity")),
    integrityRemarks: field(row, "Interview Integrity – Remarks"),
    skills,
    structured: readStructured(row, sheet, skills),
    admin: row[ADMIN_KEY] ? readAdmin(row) : undefined,
  };
}

function sortValue(i: { date: string; time: string }): number {
  return interviewTimestamp(i.date) + timeMinutes(i.time) * 60_000;
}

/** Every attempt the student has in a competency, newest first. */
export function getAttempts(data: StudentData, competency: Competency): Interview[] {
  return competency.sheets
    .flatMap((sheet) => (data.sheets[sheet.name] ?? []).map((row) => toInterview(row, sheet)))
    .sort((a, b) => sortValue(a) - sortValue(b))
    .map((interview, i) => ({ ...interview, attemptNo: i + 1 }))
    .reverse();
}

export function isScored(i: Interview): boolean {
  return i.status === "completed" && i.released && i.score !== null;
}

/** Highest-scoring released attempt; the more recent one wins a tie. */
export function bestAttempt(attempts: Interview[]): Interview | undefined {
  let best: Interview | undefined;
  for (const a of attempts) {
    if (isScored(a) && (!best || (a.score ?? 0) > (best.score ?? 0))) best = a;
  }
  return best;
}

export function countInterviews(data: StudentData, competency: Competency): number {
  return competency.sheets.reduce((n, s) => n + (data.sheets[s.name]?.length ?? 0), 0);
}

export function isCleared(clearance: string): boolean {
  return /^cleared/i.test(clearance.trim());
}

export type LevelStatus = {
  /** Level the student holds; null when they didn't clear (levels are hidden then). */
  certified: string | null;
  /** Next level to aim for; null at the top of the track. */
  target: string | null;
};

/** Cleared students aim one level higher; everyone else aims to clear at L2. */
export function levelStatus(interview: Interview, competency: Competency): LevelStatus {
  if (!isCleared(interview.clearance)) return { certified: null, target: CLEARANCE_TARGET_LEVEL };
  const certified = interview.level || null;
  const index = certified ? competency.levels.indexOf(certified) : -1;
  if (index < 0) return { certified, target: null };
  return { certified, target: competency.levels[index + 1] ?? null };
}
