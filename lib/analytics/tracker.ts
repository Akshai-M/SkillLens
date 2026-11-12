// Browser-side activity tracker for students.
// - Visit: one per browser tab (sessionStorage), so a refresh continues the same visit.
// - Session: shared across tabs (localStorage); a new one starts after 30 minutes of inactivity.
// - Active time: counted only while the tab is visible and the student interacted in the last minute.
import type { TrackEvent } from "./record";

const SESSION_KEY = "competency-report:analytics-session";
const VISIT_KEY = "competency-report:analytics-visit";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_AFTER_MS = 60 * 1000;
const TICK_MS = 1000;
const FLUSH_EVERY_MS = 15 * 1000;

type Stored = { id: string; at: number };

const state = {
  started: false,
  queue: [] as TrackEvent[],
  pendingMs: 0,
  lastInput: 0,
  lastTick: 0,
  reportViewId: undefined as string | undefined,
  /** Report tab currently open; active time is attributed to it. */
  section: undefined as string | undefined,
};

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Current session id, rotating it after 30 minutes without activity. */
function sessionId(now: number): string {
  const s = readJson<Stored>(localStorage, SESSION_KEY);
  if (s && now - s.at < SESSION_TIMEOUT_MS) return s.id;
  const fresh = { id: crypto.randomUUID(), at: now };
  writeJson(localStorage, SESSION_KEY, fresh);
  return fresh.id;
}

function touchSession(now: number): void {
  const s = readJson<Stored>(localStorage, SESSION_KEY);
  if (s) writeJson(localStorage, SESSION_KEY, { id: s.id, at: now });
}

/** Visit for this tab; a new session (after inactivity) also starts a new visit. */
function visitId(session: string): string {
  const v = readJson<{ id: string; session: string }>(sessionStorage, VISIT_KEY);
  if (v && v.session === session) return v.id;
  const fresh = { id: crypto.randomUUID(), session };
  writeJson(sessionStorage, VISIT_KEY, fresh);
  return fresh.id;
}

function send(body: string): void {
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/track", blob)) return;
  } catch {}
  void fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}

function flush(): void {
  if (!state.started) return;
  const events = state.queue.splice(0);
  const ms = Math.round(state.pendingMs);
  state.pendingMs = 0;
  if (ms > 0) events.push({ t: "active", ms, reportViewId: state.reportViewId, section: state.reportViewId ? state.section : undefined });
  if (events.length === 0) return;
  const now = Date.now();
  const session = sessionId(now);
  send(JSON.stringify({ sessionId: session, visitId: visitId(session), path: location.pathname, events }));
}

function markActive(): void {
  const now = Date.now();
  state.lastInput = now;
  // Activity keeps the session alive; check rotation before extending it.
  sessionId(now);
  touchSession(now);
}

function tick(): void {
  const now = Date.now();
  const elapsed = Math.min(now - state.lastTick, 5 * TICK_MS);
  state.lastTick = now;
  if (document.visibilityState === "visible" && now - state.lastInput < IDLE_AFTER_MS) {
    state.pendingMs += elapsed;
    touchSession(now);
  }
}

/** Starts tracking for a signed-in student. Safe to call more than once. */
export function startTracker(): void {
  if (state.started || typeof window === "undefined") return;
  state.started = true;
  const now = Date.now();
  state.lastInput = now;
  state.lastTick = now;
  sessionId(now);

  let lastMove = 0;
  const onMove = () => {
    const t = Date.now();
    if (t - lastMove > 5000) {
      lastMove = t;
      markActive();
    }
  };
  for (const type of ["keydown", "pointerdown", "touchstart", "scroll", "wheel"]) {
    window.addEventListener(type, markActive, { passive: true });
  }
  window.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") markActive();
    else flush();
  });
  window.addEventListener("pagehide", flush);
  setInterval(tick, TICK_MS);
  setInterval(flush, FLUSH_EVERY_MS);
}

export function trackPageview(path: string): void {
  if (!state.started) return;
  state.queue.push({ t: "pageview", path });
  flush();
}

/** Records opening a feedback report; returns a function to call when it closes. */
export function trackReportOpen(competency: string, reportKey: string): () => void {
  if (!state.started) return () => {};
  flush(); // attribute earlier active time to whatever was open before
  const viewId = crypto.randomUUID();
  state.reportViewId = viewId;
  state.queue.push({ t: "report", viewId, competency, reportKey });
  flush();
  return () => {
    if (state.reportViewId !== viewId) return;
    flush();
    state.reportViewId = undefined;
    state.section = undefined;
  };
}

/** Records a click on a practice question in the open report's prep plan. Sent right away, as the link opens a new tab. */
export function trackPracticeClick(question: { name: string; link: string; week: number }): void {
  if (!state.started || !state.reportViewId) return;
  state.queue.push({ t: "practice", reportViewId: state.reportViewId, ...question });
  flush();
}

/** Records which report tab is open; earlier time is flushed to the previous tab first. */
export function trackReportSection(section: string): void {
  if (!state.started || state.section === section) return;
  flush();
  state.section = section;
}
