import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Users } from "@/components/admin/dashboard/sections/Users";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.users };

export default function UsersPage() {
  return <Users />;
}
