"use client";

import { useDashboard } from "@/context/dashboard-context";
import { ContentSections } from "@/components/admin/dashboard/content-sections";

export default function DashboardPage() {
  const { activeSection, onOpenDetail, onNavigate } = useDashboard();
  return (
    <ContentSections
      activeSection={activeSection}
      onOpenDetail={onOpenDetail}
      onNavigate={onNavigate}
    />
  );
}
