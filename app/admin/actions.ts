"use server";

import { redirect } from "next/navigation";
import type { StudentData } from "@/lib/report/parse";
import { adminAccountsConfigured, checkAdminCredentials, createAdminSession, destroyAdminSession, getAdminRole } from "@/lib/session";
import { fetchAdminData, hasInterviews } from "@/lib/sheets";

export type AdminLoginState = { error?: string };

export async function adminLogin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!adminAccountsConfigured()) return { error: "Admin access isn't configured. Set the admin usernames and passwords in .env." };
  const role = checkAdminCredentials(username, password);
  if (!role) return { error: "Incorrect username or password." };
  await createAdminSession(role);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export type AdminLookupResult = { data?: StudentData; error?: string; signedOut?: boolean };

/** Full report data (including internal notes) for one student. Either admin role may look up reports. */
export async function adminLookup(email: string): Promise<AdminLookupResult> {
  if (!(await getAdminRole())) return { signedOut: true };
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: "Enter a valid email address." };
  try {
    const data = await fetchAdminData(clean);
    return hasInterviews(data) ? { data } : { error: `No interviews found for ${clean}.` };
  } catch {
    return { error: "Couldn't reach the results service. Try again in a minute." };
  }
}
