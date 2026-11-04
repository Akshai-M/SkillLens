"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PublishedReport } from "@/lib/analytics/published";
import { ensureStudent, recordLogin, recordPublishedReports } from "@/lib/analytics/record";
import type { StudentData } from "@/lib/report/parse";
import { createSession, destroySession, getSession } from "@/lib/session";
import { fetchStudentBundle, hasInterviews } from "@/lib/sheets";

export type LoginState = { error?: string; identifier?: string; data?: StudentData };

/** Analytics must never block sign-in, so failures are only logged. */
async function trackLogin(email: string, success: boolean, reason: string, name = ""): Promise<string | undefined> {
  try {
    const userAgent = (await headers()).get("user-agent");
    const studentId = success ? await ensureStudent(email, name) : null;
    await recordLogin({ email, studentId, success, reason, userAgent });
    return studentId ?? undefined;
  } catch (error) {
    console.error("[analytics] failed to record login", error);
    return undefined;
  }
}

/** Keeps the student's published reports in the analytics database. Never blocks the student. */
async function trackReports(studentId: string | undefined, reports: PublishedReport[]): Promise<void> {
  if (!studentId) return;
  try {
    await recordPublishedReports(studentId, reports);
  } catch (error) {
    console.error("[analytics] failed to record published reports", error);
  }
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "Enter your email address." };
  const email = identifier.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    await trackLogin(email, false, "invalid_email");
    return { error: "Enter a valid email address.", identifier };
  }

  let data: StudentData;
  let reports: PublishedReport[];
  try {
    ({ data, reports } = await fetchStudentBundle(email));
  } catch {
    await trackLogin(email, false, "service_unavailable");
    return { error: "We couldn't reach the results service. Please try again in a minute.", identifier };
  }
  if (!hasInterviews(data)) {
    await trackLogin(email, false, "no_interview_found");
    return {
      error: "No interview found for this email. Use the email you registered for the interview with.",
      identifier,
    };
  }

  const studentId = await trackLogin(data.email, true, "", data.name);
  await trackReports(studentId, reports);
  await createSession(data.email, data.name, studentId);
  // The client stores this in localStorage, so report pages don't call the API again.
  return { data };
}

export type RefetchResult = { data?: StudentData; error?: string; signedOut?: boolean };

/** Fetches fresh results for the signed-in student only — the email comes from the session, never the client. */
export async function refetchReport(): Promise<RefetchResult> {
  const session = await getSession();
  if (!session) return { signedOut: true };
  try {
    const { data, reports } = await fetchStudentBundle(session.email);
    let studentId = session.id;
    if (!studentId) {
      try {
        studentId = await ensureStudent(session.email, session.name);
      } catch (error) {
        console.error("[analytics] failed to resolve student", error);
      }
    }
    await trackReports(studentId, reports);
    return { data };
  } catch {
    return { error: "Couldn't refresh right now. Please try again in a minute." };
  }
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
