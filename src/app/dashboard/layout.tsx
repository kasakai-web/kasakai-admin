"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAdminSession, getAdminSession } from "@/lib/admin-session";
import { Sidebar } from "@/components/admin/dashboard/sidebar";
import { Topbar } from "@/components/admin/dashboard/topbar";
import { DetailPanel } from "@/components/admin/dashboard/detail-panel";
import { DashboardContext } from "@/context/dashboard-context";
import { sectionForPathname, sectionRoutes } from "@/components/admin/dashboard/constants";
import type { DashboardSection } from "@/components/admin/dashboard/constants";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [username,    setUsername]    = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);

  /* The URL is the only source of truth for which section is open — no state to
     drift out of sync on back/forward or a deep link. */
  const activeSection = sectionForPathname(pathname);

  /* ── auth ── */
  useEffect(() => {
    const session = getAdminSession();
    if (!session) { router.replace("/login"); return; }
    setUsername(session.name || session.email);
  }, [router]);

  const handleNavigate = useCallback((section: DashboardSection) => {
    router.push(sectionRoutes[section]);
  }, [router]);

  if (!username) return null;

  return (
    <DashboardContext.Provider
      value={{
        activeSection,
        onOpenDetail: setDetailTitle,
        onNavigate: handleNavigate,
      }}
    >
      <div className="flex min-h-screen bg-[image:radial-gradient(circle_at_8%_6%,rgba(73,148,245,0.16),transparent_30%),radial-gradient(circle_at_92%_92%,rgba(31,197,140,0.12),transparent_32%),linear-gradient(140deg,#060b0f_0%,#0b1318_48%,#101a22_100%)] text-fg antialiased">
        <Sidebar
          activeSection={activeSection}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { clearAdminSession(); router.replace("/login"); }}
        />

        <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            activeSection={activeSection}
            onVerifyOrganisers={() => handleNavigate("organisers")}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <div className="min-w-0 flex-1 overflow-y-auto p-7 max-[640px]:p-4">
            {/* Every list section reads its page number from the query string via
                useSearchParams, which opts the subtree out of prerendering — one
                boundary here covers all of them instead of one per route. */}
            <Suspense fallback={<div className="px-6 py-12 text-center text-[14px] text-muted">Loading…</div>}>
              {children}
            </Suspense>
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
