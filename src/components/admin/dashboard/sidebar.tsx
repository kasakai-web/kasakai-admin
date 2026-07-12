import styles from "./dashboard.module.css";
import type { DashboardSection } from "./constants";
import { sidebarGroups } from "./constants";

type SidebarProps = {
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export function Sidebar({ activeSection, onNavigate, open, onClose, onLogout }: SidebarProps) {
  return (
    <>
      {open ? <div className={styles.sidebarOverlay} onClick={onClose} role="presentation" /> : null}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoBlock}>
            <div className={styles.logoT}>
              <span>KASA</span>
            </div>
            <div className={styles.logoB}>
              <span>KAI</span>
            </div>
          </div>
          <div className={styles.logoWordmark}>
            <p className={styles.logoWordTop}>KASA</p>
            <p className={styles.logoWordBottom}>KAI</p>
          </div>
          <span className={styles.adminBadge}>ADMIN</span>
        </div>

        <nav className={styles.sidebarNav}>
          {sidebarGroups.map((group) => (
            <div key={group.label} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{group.label}</div>
              {group.items.map((item) => {
                const isActive = item.section === activeSection;
                return (
                  <button
                    key={item.section}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                    onClick={() => {
                      onNavigate(item.section);
                      onClose();
                    }}
                    type="button"
                    {...(item.accent ? { "data-accent": item.accent } : {})}
                  >
                    {item.label}
                    {item.badge ? (
                      <span className={`${styles.navBadge} ${item.badgeTone === "red" ? styles.navBadgeRed : ""}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminInfo}>
            <div className={styles.adminAvatar}>SU</div>
            <div>
              <div className={styles.adminName}>Super Admin</div>
              <div className={styles.adminRole}>Root Access</div>
            </div>
          </div>
          <button type="button" className={styles.sidebarLogout} onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
