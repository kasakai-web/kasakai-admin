"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminSession } from "@/lib/admin-session";
import { Sidebar } from "./dashboard/sidebar";
import { Topbar } from "./dashboard/topbar";
import { ContentSections } from "./dashboard/content-sections";
import { DetailPanel } from "./dashboard/detail-panel";
import type { DashboardSection } from "./dashboard/constants";
import styles from "./dashboard/dashboard.module.css";

export function DashboardShell() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);

  useEffect(() => {
    const session = getAdminSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    setUsername(session.name || session.email);
  }, [router]);

  if (!username) {
    return null;
  }

  return (
    <div className={styles.root}>
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={() => {
          clearAdminSession();
          router.replace("/login");
        }}
      />

      <main className={styles.main}>
        <Topbar
          activeSection={activeSection}
          onVerifyOrganisers={() => setActiveSection("organisers")}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div className={styles.content}>
          <ContentSections
            activeSection={activeSection}
            onNavigate={setActiveSection}
            onOpenDetail={(title) => setDetailTitle(title)}
          />
        </div>
      </main>

      {detailTitle ? (
        <DetailPanel
          title={detailTitle}
          rows={[
            ["Record", detailTitle],
            ["Status", "Active"],
            ["Updated", "Recently"],
          ]}
          onClose={() => setDetailTitle(null)}
        />
      ) : null}
    </div>
  );
}
