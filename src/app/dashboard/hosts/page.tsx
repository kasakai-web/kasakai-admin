import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Hosts } from "@/components/admin/dashboard/sections/Hosts";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.hosts };

export default function HostsPage() {
  return <Hosts />;
}
