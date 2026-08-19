import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Venues } from "@/components/admin/dashboard/sections/Venues";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.venues };

export default function VenuesPage() {
  return <Venues />;
}
