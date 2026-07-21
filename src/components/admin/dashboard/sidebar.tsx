import type { DashboardSection } from "./constants";
import { sidebarGroups } from "./constants";

type SidebarProps = {
  activeSection: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

const NAV_BASE =
  "relative flex w-full cursor-pointer items-center gap-[10px] rounded-md border-none bg-transparent px-[10px] py-2 text-left text-[14px] font-medium text-muted transition-[color,background] duration-150 hover:bg-[rgba(255,255,255,0.04)]";

/* The active-item accent bar (::before) shared across accents */
const NAV_BAR =
  "before:absolute before:left-[-12px] before:top-1/2 before:h-[18px] before:w-[2px] before:-translate-y-1/2 before:content-['']";

const NAV_ACCENT = {
  default: {
    hover: "hover:text-fg",
    active: `text-fg bg-[rgba(255,255,255,0.07)] ${NAV_BAR} before:bg-fg`,
  },
  teal: {
    hover: "hover:text-[#5be6b2]",
    active: `text-[#5be6b2] bg-[rgba(91,230,178,0.08)] ${NAV_BAR} before:bg-[#5be6b2]`,
  },
  blue: {
    hover: "hover:text-[#60a5fa]",
    active: `text-[#60a5fa] bg-[rgba(96,165,250,0.08)] ${NAV_BAR} before:bg-[#60a5fa]`,
  },
  amber: {
    hover: "hover:text-[#f59e0b]",
    active: `text-[#f59e0b] bg-[rgba(245,158,11,0.08)] ${NAV_BAR} before:bg-[#f59e0b]`,
  },
} as const;

const BADGE_BASE = "ml-auto rounded-[3px] border px-[6px] py-px font-mono text-[10px]";
const BADGE_AMBER = "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] text-warning";
const BADGE_RED = "border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] text-danger";

export function Sidebar({ activeSection, onNavigate, open, onClose, onLogout }: SidebarProps) {
  return (
    <>
      {open ? (
        <div
          className="hidden bg-[rgba(0,0,0,0.6)] max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-[49] max-[900px]:block"
          onClick={onClose}
          role="presentation"
        />
      ) : null}
      <aside
        className={`sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface max-[900px]:fixed max-[900px]:z-[50] max-[900px]:transition-[left] max-[900px]:duration-[280ms] max-[900px]:ease-in-out ${
          open ? "max-[900px]:left-0" : "max-[900px]:left-[-240px]"
        }`}
      >
        <div className="flex shrink-0 items-center gap-[10px] border-b border-border px-5 pt-5 pb-[18px]">
          <div className="flex h-8 w-8 shrink-0 flex-col overflow-hidden border-[1.5px] border-[#2a2a2a]">
            <div className="flex flex-1 items-center justify-center bg-fg text-black">
              <span className="font-mono text-[8.5px] font-extrabold leading-none tracking-[0.1em]">
                KASA
              </span>
            </div>
            <div className="flex flex-1 items-center justify-center border-t-[1.5px] border-t-[#2a2a2a] bg-black text-fg">
              <span className="font-mono text-[8.5px] font-extrabold leading-none tracking-[0.1em]">
                KAI
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-0 leading-none">
            <p className="m-0 font-mono text-[16px] font-extrabold leading-none tracking-[0.14em]">KASA</p>
            <p className="m-0 font-mono text-[16px] font-extrabold leading-none tracking-[0.14em] text-muted">
              KAI
            </p>
          </div>
          <span className="ml-auto border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[7px] py-[3px] font-mono text-[8px] uppercase tracking-[0.14em] text-danger">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="mb-1 px-3">
              <div className="px-2 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = item.section === activeSection;
                const accent = NAV_ACCENT[item.accent ?? "default"];
                return (
                  <button
                    key={item.section}
                    className={`${NAV_BASE} ${accent.hover} ${isActive ? accent.active : ""}`}
                    onClick={() => {
                      onNavigate(item.section);
                      onClose();
                    }}
                    type="button"
                    {...(item.accent ? { "data-accent": item.accent } : {})}
                  >
                    {item.label}
                    {item.badge ? (
                      <span
                        className={`${BADGE_BASE} ${item.badgeTone === "red" ? BADGE_RED : BADGE_AMBER}`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-[14px]">
          <div className="flex items-center gap-[10px]">
            <div className="flex h-[30px] w-[30px] items-center justify-center border border-border-2 bg-surface-2 font-mono text-[11px] font-semibold">
              SU
            </div>
            <div>
              <div className="text-[14px] font-semibold">Super Admin</div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">Root Access</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 w-full cursor-pointer border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] px-[10px] py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f87171] hover:border-[rgba(239,68,68,0.55)] hover:bg-[rgba(239,68,68,0.2)] hover:text-[#fee2e2]"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
