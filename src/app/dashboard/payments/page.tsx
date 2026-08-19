import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Payments } from "@/components/admin/dashboard/sections/Payments";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.payments };

export default function PaymentsPage() {
  return <Payments />;
}
