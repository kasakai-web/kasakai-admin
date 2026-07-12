"use client";

import styles from "./dashboard.module.css";
import { sectionPaths, sectionTitles, type DashboardSection } from "./constants";
import { NotificationBell } from "./notifications/NotificationBell";

type TopbarProps = {
  activeSection: DashboardSection;
  onVerifyOrganisers: () => void;
  onOpenSidebar: () => void;
};

export function Topbar({ activeSection, onVerifyOrganisers, onOpenSidebar }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <button className={styles.mobileToggle} onClick={onOpenSidebar} type="button" aria-label="Open sidebar">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h14M2 9h14M2 14h14" />
        </svg>
      </button>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginRight: "24px",
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          width: "34px",
          height: "34px",
          overflow: "hidden",
          border: "1.5px solid #333",
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 900, fontSize: "8px", letterSpacing: "0.08em", color: "#000" }}>KASA</span>
          </div>
          <div style={{ flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1.5px solid #333" }}>
            <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 900, fontSize: "8px", letterSpacing: "0.08em", color: "var(--white)" }}>KAI</span>
          </div>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Admin</span>
      </div>
      <span className={styles.topbarTitle}>{sectionTitles[activeSection]}</span>
      <span className={styles.topbarPath}>
        <span className={styles.topbarSep}>/ </span>
        {sectionPaths[activeSection]}
      </span>
      <div className={styles.topbarActions}>
        <NotificationBell />
        <button className={styles.topbarBtn} type="button">
          Export
        </button>
        <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} type="button" onClick={onVerifyOrganisers}>
          Verify Organisers
        </button>
      </div>
    </header>
  );
}
