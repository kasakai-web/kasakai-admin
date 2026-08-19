import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Games } from "@/components/admin/dashboard/sections/Games";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.games };

export default function GamesPage() {
  return <Games />;
}
