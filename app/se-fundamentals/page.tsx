import type { Metadata } from "next";
import { CompetencyPage } from "@/components/competency-page";

export const metadata: Metadata = { title: "Software Engineering Fundamentals · Competency Technical Interview Report" };

export default function Page() {
  return <CompetencyPage slug="se-fundamentals" />;
}
