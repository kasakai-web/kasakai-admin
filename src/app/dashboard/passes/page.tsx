import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { PassPage } from "@/components/admin/dashboard/passes/PassPage";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.passes };

export default function PassesPage() {
  return <PassPage />;
}
