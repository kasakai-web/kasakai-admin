import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Checkouts } from "@/components/admin/dashboard/sections/Checkouts";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.checkouts };

export default function CheckoutsPage() {
  return <Checkouts />;
}
