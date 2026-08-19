import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Disputes } from "@/components/admin/dashboard/sections/Disputes";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.disputes };

export default function DisputesPage() {
  return <Disputes />;
}
