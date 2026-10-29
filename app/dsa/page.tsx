import type { Metadata } from "next";
import { CompetencyPage } from "@/components/competency-page";

export const metadata: Metadata = { title: "Programming with Problem Solving (DSA) · Interview Report" };

export default function Page() {
  return <CompetencyPage slug="dsa" />;
}
