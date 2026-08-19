import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Communities } from "@/components/admin/dashboard/sections/Communities";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.communities };

export default function CommunitiesPage() {
  return <Communities />;
}
