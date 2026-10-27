import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { TagsPage } from "@/components/admin/dashboard/tags/TagsPage";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.tags };

export default function TagsRoute() {
  return <TagsPage />;
}
