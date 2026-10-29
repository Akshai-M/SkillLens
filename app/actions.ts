"use server";

import { redirect } from "next/navigation";
import type { StudentData } from "@/lib/report/parse";
import { createSession, destroySession, getSession } from "@/lib/session";
import { fetchStudentData, hasInterviews } from "@/lib/sheets";

export type LoginState = { error?: string; identifier?: string; data?: StudentData };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "Enter your email address." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return { error: "Enter a valid email address.", identifier };
  }

  let data: StudentData;
  try {
    data = await fetchStudentData(identifier.toLowerCase());
  } catch {
    return { error: "We couldn't reach the results service. Please try again in a minute.", identifier };
  }
  if (!hasInterviews(data)) {
    return {
      error: "No interview found for this email. Use the email you registered for the interview with.",
      identifier,
    };
  }

  await createSession(data.email, data.name);
  // The client stores this in localStorage, so report pages don't call the API again.
  return { data };
}

export type RefetchResult = { data?: StudentData; error?: string; signedOut?: boolean };

/** Fetches fresh results for the signed-in student only — the email comes from the session, never the client. */
export async function refetchReport(): Promise<RefetchResult> {
  const session = await getSession();
  if (!session) return { signedOut: true };
  try {
    return { data: await fetchStudentData(session.email) };
  } catch {
    return { error: "Couldn't refresh right now. Please try again in a minute." };
  }
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
