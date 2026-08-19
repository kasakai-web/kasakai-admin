import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Finance } from "@/components/admin/dashboard/sections/Finance";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.finance };

export default function FinancePage() {
  return <Finance />;
}
