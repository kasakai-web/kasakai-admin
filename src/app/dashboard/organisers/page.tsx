import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Organisers } from "@/components/admin/dashboard/sections/Organisers";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.organisers };

export default function OrganisersPage() {
  return <Organisers />;
}
