// Competency definitions: which sheet tabs feed each report page, the skills
// interviewers rate, and the 0–5 rubric for each skill. Rubric levels that have
// never been used in an interview are unknown and simply left out.

export type Rubric = Partial<Record<number, string>>;

export type SkillDef = {
  id: string;
  title: string;
  /** Column holding the rubric card text, e.g. "Card 1 — HTML & CSS: 3 - …". */
  column: string;
  /** Prefix of the "<key> – Domain Rating" / "<key> – Remarks" columns, when it differs from `column`. */
  key?: string;
  /** Short label shown next to the title, e.g. "L2" or "Theory". */
  tag?: string;
  /** `domain_id` in the raw_overall_feedback report, when it differs from `id`. */
  reportId?: string;
  rubric: Rubric;
};

export type SheetDef = {
  /** Sheet tab name in the Apps Script response. */
  name: string;
  skills: SkillDef[];
};

export type Competency = {
  slug: string;
  /** Official competency name, as used in the levels table. Shown everywhere in the UI. */
  title: string;
  /** Certifiable levels for this track, lowest first. */
  levels: string[];
  sheets: SheetDef[];
};

/** Level a student who hasn't cleared should aim for. */
export const CLEARANCE_TARGET_LEVEL = "L2";

const COMMUNICATION_CODE: Rubric = {
  0: "Silent or unintelligible.",
  1: "Very hard to follow. Could not explain their own code.",
  2: "Explains only when asked, in fragments.",
  3: "Adequate. Explains the what, rarely the why.",
  4: "Clear and structured. Explains their own code accurately.",
  5: "Thinks out loud naturally, flags uncertainty, adapts when you aren't following.",
};

const THEORY: Rubric = {
  0: "No answers.",
  1: "Mostly incorrect; confuses fundamental structures.",
  2: "Under half correct; whole topics missing.",
  3: "Half to two-thirds correct; imprecise on complexity.",
  4: "Most correct with clear reasoning.",
  5: "Nearly all correct, complexity stated unprompted.",
};

const DSA_PROBLEM: Rubric = {
  0: "Nothing. Could not begin.",
  1: "Wrong direction or major flaws; did not self-correct.",
  2: "Partial. Brute force only, or many cases failing.",
  3: "Correct, but only with hints or debugging help.",
  4: "Correct independently; minor gaps or missed edge cases.",
  5: "Optimal and fast, edge cases raised unprompted.",
};

const DSA_V1_APPROACH: Rubric = {
  1: "Wrong direction, did not self-correct.",
  2: "Brute force only. No path to better.",
  3: "Reached optimal, but only with L2/L3 hints.",
  4: "Optimal independently; missed edge cases until prompted.",
  5: "Optimal independently and fast; raised edge cases before coding.",
};

const DSA_V1_CODE: Rubric = {
  0: "No code written.",
  1: "Major structural flaws. Fails the sample case.",
  2: "Partial. Many cases fail.",
  4: "Correct, passes almost everything, minor gaps.",
  5: "Clean and correct quickly. All cases including edges.",
};

const CONCEPTS: Rubric = {
  1: "Mostly incorrect; confuses fundamental concepts.",
  3: "Half to two-thirds correct; knows the terms, vague on the why.",
  4: "Most correct with clear reasoning and examples.",
};

export const COMPETENCIES: Competency[] = [
  {
    slug: "frontend-development",
    levels: ["L1", "L2", "L3", "L4"],
    title: "Frontend Development",
    sheets: [
      {
        name: "Frontend Development",
        skills: [
          {
            id: "project",
            title: "Project Deep Dive",
            column: "Project Deep Dive",
            rubric: {
              1: "Feature list only. No idea how it was built.",
              2: "Knows the surface. No technical decision, no specific contribution.",
              3: "Explains contribution and architecture, but no decision was consciously made.",
              4: "Clear on what they built, why, and the trade-offs.",
              5: "Plus a specific, credible account of what they'd rebuild differently.",
            },
          },
          {
            id: "html-css",
            title: "HTML & CSS",
            column: "HTML & CSS",
            rubric: {
              1: "Confuses basics. Cannot write valid markup for a form.",
              2: "Knows tags and properties but cannot lay anything out.",
              3: "Flexbox basics and box model fine. Vague on specificity and responsive strategy.",
              4: "Solid on semantics, box model, Flexbox/Grid, media queries. Can write the snippet.",
              5: "Plus accessibility and cross-browser reasoning raised unprompted.",
            },
          },
          {
            id: "javascript",
            title: "JavaScript",
            column: "JavaScript",
            rubric: {
              1: "Fundamental misunderstandings (thinks JS is multi-threaded).",
              2: "Syntax only. Cannot predict output involving scope or async.",
              3: "Knows closures and promises definitionally. Struggles to trace a snippet.",
              4: "Traces output snippets correctly. Explains the event loop and async/await.",
              5: "Plus prototypes, debounce/throttle, error propagation, with real examples.",
            },
          },
          {
            id: "react",
            title: "React",
            column: "React Theory",
            key: "React",
            rubric: {
              0: "No usable knowledge.",
              1: "Tutorials only. Cannot say what React does differently from the DOM.",
              2: "Can build with useState. No grasp of re-rendering, keys or effect deps.",
              3: "Comfortable with hooks and props. Virtual DOM explained in slogans.",
              4: "Understands rendering, reconciliation, dependency arrays, keys, context.",
              5: "Plus memoisation with its costs, code splitting, a considered state-management opinion.",
            },
          },
          {
            id: "machine-coding",
            title: "Machine Coding",
            column: "Machine Coding",
            rubric: {
              0: "Nothing runs.",
              1: "Fragments only. Core requirement fundamentally broken.",
              2: "Partially working. Happy path only, obvious breakage.",
              3: "Core requirement works. Rough structure, no edge cases, needed a nudge.",
              4: "Core works cleanly, sensible structure, one edge case handled unprompted.",
              5: "Core plus stretch goal, clean structure, loading/empty/error states, narrated prioritisation.",
            },
          },
          {
            id: "debug",
            title: "Debugging",
            column: "Debug",
            rubric: {
              0: "Cannot read the code.",
              1: "Guesses randomly. Makes it worse.",
              2: "Knows something is wrong but cannot locate it.",
              3: "Finds it with hints, fixes it, cannot explain the cause.",
              4: "Predicts behaviour, locates and fixes it, explains the cause.",
              5: "Plus identifies a second latent issue and how to prevent the class of bug.",
            },
          },
          {
            id: "production",
            title: "Production Frontend",
            column: "Production Frontend",
            rubric: {
              0: "No answers.",
              1: "Knows the terms only. Cannot separate client from server rendering.",
              2: "Names features but not the problems they solve. Never deployed.",
              3: "Knows what the server does versus the browser. Has put a site online once.",
              4: "Picks the right approach for a need and explains why. Knows how to check if a site is slow. Has shipped real work.",
              5: "Also covers caching, keeping things safe, and how they would spot a problem after release.",
            },
          },
          {
            id: "communication",
            title: "Communication",
            column: "Communication",
            rubric: {
              0: "Silent or unintelligible.",
              1: "Very hard to follow; cannot defend any choice.",
              2: "Explains only when asked, in fragments.",
              3: "Adequate. States decisions, rarely the reasoning.",
              4: "Clear and structured; handles a challenge to their design well.",
              5: "Thinks out loud naturally, flags uncertainty, adapts when you are not following.",
            },
          },
        ],
      },
    ],
  },
  {
    slug: "dsa",
    levels: ["L1", "L2", "L3", "L4"],
    title: "Programming with Problem Solving (DSA)",
    sheets: [
      {
        name: "DSA 2.0 (current)",
        skills: [
          { id: "p1", title: "Problem 1 — Easy", column: "Problem 1 — Easy", reportId: "p1_approach", rubric: DSA_PROBLEM },
          { id: "p2", title: "Problem 2 — Medium / Hard", column: "Problem 2 — Medium / Hard", reportId: "p2_approach", rubric: DSA_PROBLEM },
          { id: "theory-l2", title: "Theory — L2 topics", column: "Theory — L2 topics", reportId: "theory", rubric: THEORY },
          { id: "theory-l3", title: "Theory — L3 topics", column: "Theory — L3 topics", reportId: "theory", rubric: THEORY },
          { id: "theory-l4", title: "Theory — L4 topics", column: "Theory — L4 topics", reportId: "theory", rubric: THEORY },
          { id: "communication", title: "Communication", column: "Communication", rubric: COMMUNICATION_CODE },
        ],
      },
      {
        name: "DSA (discontinued)",
        skills: [
          { id: "p1-approach", title: "Problem 1 — Approach", column: "Problem 1 -Approach", rubric: DSA_V1_APPROACH },
          { id: "p1-code", title: "Problem 1 — Code", column: "Problem 1 - Code", rubric: DSA_V1_CODE },
          { id: "p2-approach", title: "Problem 2 — Approach", column: "Problem 2 -Approach", rubric: DSA_V1_APPROACH },
          { id: "p2-code", title: "Problem 2 — Code", column: "Problem 2 - Code", rubric: DSA_V1_CODE },
          {
            id: "complexity",
            title: "Complexity & Optimisation",
            column: "Complexity & Optimisation",
            rubric: {
              2: "Rough idea only. No notation. No space analysis.",
              3: "Time correct, space shaky, or correct only after prompting.",
              4: "Time and space correct with sound reasoning.",
              5: "Correct, explains the trade-off unprompted, proposes a change for much larger input.",
            },
          },
          {
            id: "theory",
            title: "DSA Theory",
            column: "DSA Theory",
            rubric: {
              1: "Mostly incorrect. Confuses fundamental structures.",
              3: "Half to two-thirds correct. Imprecise on complexity.",
              4: "Most correct with clear reasoning.",
            },
          },
          { id: "communication", title: "Communication", column: "Communication", rubric: COMMUNICATION_CODE },
        ],
      },
    ],
  },
  {
    slug: "backend-development",
    levels: ["L1", "L2", "L3", "L4"],
    title: "Backend Development",
    sheets: [
      {
        name: "Backend Development",
        skills: [
          {
            id: "project",
            title: "Project / API Deep-Dive",
            column: "Project / API Deep-Dive",
            rubric: { 3: "Explains the contribution and the shape, but no decision was consciously made." },
          },
          {
            id: "foundations",
            title: "Backend Foundations",
            column: "L1 — Backend Foundations",
            tag: "L1",
            rubric: {
              3: "Half to two-thirds correct; knows the terms, vague on the mechanism.",
              4: "Most correct with clear reasoning and real examples from their own work.",
              5: "Nearly all correct, with trade-offs and failure modes raised unprompted.",
            },
          },
          {
            id: "crud_task",
            title: "CRUD Endpoint Task",
            column: "L1 — CRUD Endpoint Task",
            tag: "L1",
            rubric: { 4: "Working CRUD with correct methods and status codes, and 404 handled." },
          },
          {
            id: "db-auth",
            title: "Database & Auth",
            column: "L2 — Database & Auth",
            tag: "L2",
            rubric: {
              3: "Half to two-thirds correct; knows the terms, vague on the mechanism.",
              4: "Most correct with clear reasoning and real examples from their own work.",
            },
          },
          {
            id: "debug",
            title: "Debug / Fix Task",
            column: "L2 — Debug / Fix Task",
            tag: "L2",
            rubric: { 4: "Predicts the behaviour, locates and fixes it, explains the cause." },
          },
          {
            id: "advanced",
            title: "Backend Advanced",
            column: "L3 — Backend Advanced",
            tag: "L3",
            rubric: {
              3: "Half to two-thirds correct; knows the terms, vague on the mechanism.",
              4: "Most correct with clear reasoning and real examples from their own work.",
            },
          },
          {
            id: "production",
            title: "Production Backend",
            column: "L4 — Production Backend",
            tag: "L4",
            rubric: {
              3: "Half to two-thirds correct; knows the terms, vague on the mechanism.",
              4: "Most correct with clear reasoning and real examples from their own work.",
            },
          },
          {
            id: "communication",
            title: "Communication",
            column: "Communication",
            rubric: { 4: "Clear and structured; traces a request end to end accurately." },
          },
        ],
      },
    ],
  },
  {
    slug: "se-fundamentals",
    levels: ["L1", "L2", "L3"],
    title: "Software Engineering Fundamentals",
    sheets: [
      {
        name: "SE Fundamentals",
        skills: [
          { id: "core-cs", title: "Core CS Fundamentals", column: "L1 — Core CS Fundamentals", tag: "L1", rubric: CONCEPTS },
          {
            id: "sql_task",
            title: "SQL Query Task",
            column: "L1 — SQL Query Task",
            tag: "L1",
            rubric: {
              2: "Runs but is wrong — missing GROUP BY, wrong join type, or wrong filter.",
              3: "Correct result, reached with hints or after debugging help.",
            },
          },
          { id: "oop_concepts", title: "OOP Concepts", column: "L2 — OOP Concepts", tag: "L2", rubric: CONCEPTS },
          {
            id: "design_task",
            title: "OOP Design Task",
            column: "L2 — OOP Design Task",
            tag: "L2",
            rubric: { 2: "Some classes, but responsibilities are muddled and relationships are unclear." },
          },
          { id: "clean_code", title: "Software Design & Clean Code", column: "L3 — Software Design & Clean Code", tag: "L3", rubric: CONCEPTS },
          {
            id: "code-review",
            title: "Code Review Exercise",
            column: "L3 — Code Review Exercise",
            tag: "L3",
            rubric: {
              1: "Comments only on formatting or naming.",
              4: "Finds the main issue unprompted and improves it correctly.",
            },
          },
          {
            id: "communication",
            title: "Communication",
            column: "Communication",
            rubric: {
              2: "Explains only when asked, in fragments.",
              4: "Clear and structured; handles a challenge to their design well.",
            },
          },
        ],
      },
    ],
  },
];

export const ALL_SHEET_NAMES = COMPETENCIES.flatMap((c) => c.sheets.map((s) => s.name));

export function getCompetency(slug: string): Competency {
  const c = COMPETENCIES.find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown competency: ${slug}`);
  return c;
}
