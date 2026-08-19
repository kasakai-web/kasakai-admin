import type { Metadata } from "next";
import { sectionTitles } from "@/components/admin/dashboard/constants";
import { WalletAdmin } from "@/components/admin/dashboard/sections/WalletAdmin";

// The root layout appends "| Kasa Kai Admin"; sectionTitles keeps the tab and
// the topbar breadcrumb reading the same name.
export const metadata: Metadata = { title: sectionTitles["wallet-admin"] };

export default function WalletAdminPage() {
  return <WalletAdmin />;
}
