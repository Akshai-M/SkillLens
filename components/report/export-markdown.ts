// Markdown export of one competency report: exactly what the student sees on screen.
// Admin-only data (interviewer name, recorded level/band, audit details, internal flags,
// raw data) is never included, even when an admin exports.
import type { Competency } from "@/lib/competencies";
import type { ConceptStatus } from "@/lib/report/ai";
import { formatDate } from "@/lib/report/fields";
import { isCleared, levelStatus, type Interview, type SkillResult } from "@/lib/report/parse";
import { conceptRows } from "./tab-concepts";
import { statusFor } from "./ui";

const CONCEPT_STATUS: Record<ConceptStatus, string> = {
  strong: "Strong",
  partly_there: "Partly There",
  needs_work: "Needs Work",
  not_yet_familiar: "Not Yet Familiar",
};

/** Ticked prep-plan items (tasks and practice questions) saved in this browser. */
function readPlanTicks(interviewKey: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`competency-report:plan:${interviewKey}`) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const bullets = (items: string[]) => items.map((i) => `- ${i}`);

function skillSection(skill: SkillResult): string[] {
  const status = statusFor(undefined, skill.rating);
  const lines = [`### ${skill.tag ? `${skill.tag} · ` : ""}${skill.title}`, "", `**Rating:** ${skill.rating ?? "—"} / 5 · ${status.label}`, ""];
  if (skill.rating !== null) {
    lines.push(`**Where you are:** ${skill.observed || "—"}`, "");
    const topLevel = Math.round(skill.rating) >= 5;
    if (skill.nextLevel || topLevel) {
      lines.push(`**${topLevel ? "Next step" : "To reach the next level"}:** ${skill.nextLevel ?? "Top of the rubric — keep this sharp with real projects."}`, "");
    }
  }
  if (skill.remarks) lines.push(`**Interviewer remarks:** ${skill.remarks}`, "");
  return lines;
}

export function reportToMarkdown({ interview, competency, name, email }: { interview: Interview; competency: Competency; name: string; email: string }): string {
  const s = interview.structured;
  const cleared = isCleared(interview.clearance);
  const { certified, target } = levelStatus(interview, competency);
  const ratings = s ? s.domains.map((d) => (d.status === "not_assessed" ? null : d.rating)) : interview.skills.map((k) => k.rating);
  const focusCount = ratings.filter((r) => r !== null && r <= 2).length;

  const out: string[] = [
    `# ${competency.title} · Interview Report`,
    "",
    `**Student:** ${name}  `,
    `**Email:** ${email}  `,
    `**Interview:** ${formatDate(interview.date)}${interview.time ? `, ${interview.time}` : ""} · Attempt ${interview.attemptNo}  `,
  ];
  if (interview.uid) out.push(`**ID:** ${interview.uid}  `);
  if (interview.placementEligible) out.push(`**Placement Pool:** Eligible  `);
  out.push(
    "",
    "## Result",
    "",
    "| Overall score | Clearance status | " + (cleared ? "Certified level" : "Target level") + " | Areas to strengthen |",
    "|---|---|---|---|",
    `| ${interview.score ?? "—"} / 100 | ${interview.clearance ? (cleared ? "Cleared" : "Not Cleared") : "Pending"} | ${
      cleared ? `${certified ?? "—"}${target ? ` (next target: ${target})` : ""}` : `${target} (aim to clear at this level)`
    } | ${focusCount} rated 2 or below |`,
    "",
  );

  const summary = s?.executiveSummary || interview.overallFeedback;
  if (summary) out.push("## Interviewer Executive Summary", "", `> ${summary.replace(/\n+/g, "\n> ")}`, "");
  if (s?.nextStepFocus) {
    const label = cleared ? (target ? `Core breakthrough required for ${target}` : "Keep sharpening your edge") : `What it takes to clear at ${target}`;
    out.push(`**${label}:** ${s.nextStepFocus}`, "");
  }

  if (s) {
    // Executive summary tab
    if (s.domains.length) {
      out.push("## Competency Scorecard", "", "| Domain | Rating | Status |", "|---|---|---|");
      for (const d of s.domains) out.push(`| ${d.tag ? `${d.tag} · ` : ""}${d.name} | ${d.rating ?? "—"} / 5 | ${statusFor(d.status, d.rating).label} |`);
      out.push("");
    }
    if (s.evaluationSummary) out.push("## Evaluation Summary", "", s.evaluationSummary, "");
    if (s.wentWell.length) out.push("## Validated Strengths & Coverage", "", ...bullets(s.wentWell), "");
    if (s.improve.length) out.push("## High-Impact Remediation Areas", "", ...bullets(s.improve), "");
    if (s.actions.length) out.push("## Action Items", "", ...s.actions.map((a, i) => `${i + 1}. ${a}`), "");

    // Domain evaluations tab
    if (s.domains.length) {
      out.push("## Domain Evaluations", "");
      for (const d of s.domains) {
        out.push(`### ${d.tag ? `${d.tag} · ` : ""}${d.name}`, "", `**Rating:** ${d.rating ?? "—"} / 5 · ${statusFor(d.status, d.rating).label}`, "");
        if (d.summary) out.push(`**Observed performance:** ${d.summary}`, "");
        if (d.stronger) out.push(`**Stronger performance looks like (next level):** ${d.stronger}`, "");
        if (d.wentWell.length) out.push("**What went well**", "", ...bullets(d.wentWell), "");
        if (d.improve.length) out.push("**Areas of improvement**", "", ...bullets(d.improve), "");
        if (d.actions.length) out.push("**Action items**", "", ...d.actions.map((a, i) => `${i + 1}. ${a}`), "");
        if (d.remarks) out.push(`**Interviewer remarks:** ${d.remarks}`, "");
      }
    }

    // Concept mastery tab
    const concepts = conceptRows(s.domains);
    if (concepts.length) {
      out.push("## Concept Mastery", "", "| Concept | Domain | Status |", "|---|---|---|");
      for (const r of concepts) out.push(`| ${r.concept.name} | ${r.tier} | ${CONCEPT_STATUS[r.concept.status]} |`);
      out.push("");
      for (const r of concepts) {
        // Same as the concept cards: mastered concepts show what went well, others the gap and fix.
        const mastered = r.concept.status === "strong" || !r.concept.gap;
        const details = (
          mastered
            ? [r.concept.wentWell && `- **Demonstrated competency:** ${r.concept.wentWell}`]
            : [`- **Identified gap:** ${r.concept.gap}`, r.concept.workOn && `- **Remediation action:** ${r.concept.workOn}`]
        ).filter(Boolean) as string[];
        if (details.length) out.push(`### ${r.concept.name}`, "", ...details, "");
      }
    }

    // Prep plan tab, with the ticks saved in this browser
    if (s.weeklyPlan.length) {
      const done = readPlanTicks(interview.key);
      const total = s.weeklyPlan.reduce((n, w) => n + w.tasks.length + w.questions.length, 0);
      const valid = new Set(s.weeklyPlan.flatMap((w) => [...w.tasks.map((_, i) => `${w.week}:${i}`), ...w.questions.map((_, i) => `q:${w.week}:${i}`)]));
      const completed = done.filter((id) => valid.has(id)).length;
      out.push(`## ${s.weeklyPlan.length}-Week Prep Plan`, "", `**Progress:** ${completed} of ${total} completed (tasks and practice questions)`, "");
      for (const w of s.weeklyPlan) {
        out.push(`### Week ${w.week}: ${w.focus}`, "");
        if (w.target) out.push(`**Milestone target:** ${w.target}`, "");
        if (w.why) out.push(`**Why this week is critical:** ${w.why}`, "");
        if (w.tasks.length) out.push("**Actionable Tasks & Drills**", "", ...w.tasks.map((t, i) => `- [${done.includes(`${w.week}:${i}`) ? "x" : " "}] ${t}`), "");
        if (w.questions.length)
          out.push(
            "**Practice Questions**",
            "",
            ...w.questions.map((q, i) => `- [${done.includes(`q:${w.week}:${i}`) ? "x" : " "}] ${q.link ? `[${q.name}](${q.link})` : q.name}`),
            "",
          );
      }
    }
  } else if (interview.skills.length) {
    out.push("## Skill-by-skill Feedback", "", ...interview.skills.flatMap(skillSection));
  }

  // Interview setup & integrity (shown to students on every report)
  const note = s?.contextNote;
  if (interview.integrityChecks.length || note || interview.integrityRemarks) {
    out.push("## Interview Setup & Integrity", "");
    if (interview.integrityScore !== null) out.push(`**Score:** ${interview.integrityScore} / 5`, "");
    if (interview.integrityChecks.length) out.push(...interview.integrityChecks.map((c) => `- ${c.passed ? "✓" : "✕"} ${c.label}`), "");
    if (note) out.push(`**Before your next interview:** ${note}`, "");
    if (interview.integrityRemarks) out.push(`**Interviewer remarks:** ${interview.integrityRemarks}`, "");
  }

  out.push("---", "", `_Exported on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST_`, "");
  return out.join("\n");
}

export function downloadMarkdown(markdown: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
