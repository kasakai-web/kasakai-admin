"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAdminSession, getAdminSession } from "@/lib/admin-session";
import { Sidebar } from "@/components/admin/dashboard/sidebar";
import { Topbar } from "@/components/admin/dashboard/topbar";
import { DetailPanel } from "@/components/admin/dashboard/detail-panel";
import { DashboardContext } from "@/context/dashboard-context";
import type { DashboardSection } from "@/components/admin/dashboard/constants";
import styles from "@/components/admin/dashboard/dashboard.module.css";

function pathnameToSection(p: string): DashboardSection | null {
  if (p.startsWith("/dashboard/streaming/carousels")) return "scr-crousels";
  if (p.startsWith("/dashboard/streaming/guests")) return "scr-guests";
  if (p.startsWith("/dashboard/streaming/finance")) return "scr-finance";
  if (p.startsWith("/dashboard/streaming")) return "scr-events";
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [username,      setUsername]      = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>("dashboard");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [detailTitle,   setDetailTitle]   = useState<string | null>(null);

  /* ── auth ── */
  useEffect(() => {
    const session = getAdminSession();
    if (!session) { router.replace("/login"); return; }
    setUsername(session.name || session.email);
  }, [router]);

  /* ── sync sidebar highlight from URL ── */
  useEffect(() => {
    const s = pathnameToSection(pathname);
    if (s) setActiveSection(s);
  }, [pathname]);

  const handleNavigate = useCallback((section: DashboardSection) => {
    setActiveSection(section);

    if (section === "scr-events")  { router.push("/dashboard/streaming");         return; }
    if (section === "scr-guests")  { router.push("/dashboard/streaming/guests");  return; }
    if (section === "scr-finance") { router.push("/dashboard/streaming/finance"); return; }
    if (section === "scr-crousels") { router.push("/dashboard/streaming/carousels"); return; }

    /* non-streaming — navigate to /dashboard if currently on a streaming URL */
    if (pathname.startsWith("/dashboard/streaming")) {
      router.push("/dashboard");
    }
  }, [pathname, router]);

  if (!username) return null;

  return (
    <DashboardContext.Provider
      value={{
        activeSection,
        setActiveSection,
        onOpenDetail: setDetailTitle,
        onNavigate: handleNavigate,
      }}
    >
      <div className={styles.root}>
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { clearAdminSession(); router.replace("/login"); }}
        />

        <main className={styles.main}>
          <Topbar
            activeSection={activeSection}
            onVerifyOrganisers={() => handleNavigate("organisers")}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <div className={styles.content}>
            {children}
          </div>
        </main>

        {detailTitle && (
          <DetailPanel
            title={detailTitle}
            rows={[["Record", detailTitle], ["Status", "Active"], ["Updated", "Recently"]]}
            onClose={() => setDetailTitle(null)}
          />
        )}
      </div>
    </DashboardContext.Provider>
  );
}
