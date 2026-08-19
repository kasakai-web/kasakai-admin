import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Feedback } from "@/components/admin/dashboard/sections/Feedback";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.feedback };

export default function FeedbackPage() {
  return <Feedback />;
}
