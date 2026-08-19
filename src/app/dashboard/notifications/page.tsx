import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { Notifications } from "@/components/admin/dashboard/sections/Notifications";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles.notifications };

export default function NotificationsPage() {
  return <Notifications />;
}
