import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { DiscountsPage } from "@/components/admin/dashboard/discounts/DiscountsPage";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.discounts };

export default function DiscountsRoute() {
  return <DiscountsPage />;
}
