"use client";

import { sectionPaths, sectionTitles, type DashboardSection } from "./constants";
import { NotificationBell } from "./notifications/NotificationBell";

type TopbarProps = {
  activeSection: DashboardSection;
  onVerifyOrganisers: () => void;
  onOpenSidebar: () => void;
};

export function Topbar({ activeSection, onVerifyOrganisers, onOpenSidebar }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-7 max-[640px]:px-[14px]">
      <button
        className="hidden cursor-pointer border-none bg-transparent text-fg max-[900px]:inline-flex"
        onClick={onOpenSidebar}
        type="button"
        aria-label="Open sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h14M2 9h14M2 14h14" />
        </svg>
      </button>
      <div className="mr-6 flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] shrink-0 flex-col overflow-hidden border-[1.5px] border-[#333]">
          <div className="flex flex-1 items-center justify-center bg-fg">
            <span className="font-mono text-[8px] font-black tracking-[0.08em] text-black">KASA</span>
          </div>
          <div className="flex flex-1 items-center justify-center border-t-[1.5px] border-t-[#333] bg-black">
            <span className="font-mono text-[8px] font-black tracking-[0.08em] text-fg">KAI</span>
          </div>
        </div>
        <span className="text-[12px] font-semibold text-muted">Admin</span>
      </div>
      <span className="font-mono text-[13px] font-medium uppercase tracking-[0.1em]">
        {sectionTitles[activeSection]}
      </span>
      <span className="font-mono text-[12px] text-muted">
        <span className="text-muted-2">/ </span>
        {sectionPaths[activeSection]}
      </span>
      <div className="ml-auto flex items-center gap-[10px]">
        <NotificationBell />
        <button
          className="flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg"
          type="button"
        >
          Export
        </button>
        <button
          className="flex cursor-pointer items-center gap-[6px] border border-fg bg-fg px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-black hover:border-[#555] hover:text-fg"
          type="button"
          onClick={onVerifyOrganisers}
        >
          Verify Organisers
        </button>
      </div>
    </header>
  );
}
