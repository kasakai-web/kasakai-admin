"use client";
import React, { memo, useState } from "react";
import { SCR_EVENT_CARD, SCR_EVENT_CARD_IMG, SCR_EVENT_CARD_CONTENT } from "../ui";
import { ScrEvent, scrStatusBadge } from "./types";

type Props = {
  ev: ScrEvent;
  onManage?: () => void;
  onViewAnalytics?: () => void;
  onViewEvent?: () => void;
  onPublish?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
};

export const ScrEventCard = memo(function ScrEventCard({ ev, onManage, onViewAnalytics, onViewEvent, onPublish, onCancel, onComplete, onDelete }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const badge = scrStatusBadge(ev.status);
  const capacity = ev.capacity ?? 100;
  const sold = ev.sold ?? 0;
  const fillPct = Math.min(100, Math.round((sold / capacity) * 100));
  const fillColor = fillPct >= 90 ? "#ef4444" : fillPct >= 60 ? "#f59e0b" : "#5be6b2";
  const priceRs = ev.pricePaise ? `₹${Math.round(ev.pricePaise / 100)}` : null;

  return (
    <div className={SCR_EVENT_CARD}>
      <div className={`${SCR_EVENT_CARD_IMG} flex items-center justify-center`}>
        {!imgErr && ev.image ? (
          <img src={ev.image} alt={ev.title} loading="lazy"
            className="block h-full w-full object-cover"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-[6px] bg-[image:linear-gradient(160deg,#0d0d1a_0%,#090910_100%)]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="22" height="15" rx="2" stroke="#1e2240" strokeWidth="1.5" fill="#0c0c1a"/>
              <path d="M12 16v3" stroke="#1e2240" strokeWidth="1.5"/>
              <path d="M8 21h8" stroke="#1e2240" strokeWidth="1.5"/>
              <line x1="3" y1="7" x2="21" y2="7" stroke="#12122a" strokeWidth="0.75"/>
              <line x1="3" y1="11" x2="21" y2="11" stroke="#12122a" strokeWidth="0.75"/>
              <circle cx="12" cy="8.5" r="4" stroke="#1e2240" strokeWidth="1" fill="#10102a"/>
              <polygon points="10.5,6.5 10.5,10.5 14.5,8.5" fill="#1e2240"/>
            </svg>
            <span className="text-[7px] font-extrabold uppercase tracking-[0.18em] text-[#1e2240]">No Preview</span>
          </div>
        )}
      </div>

      <div className={SCR_EVENT_CARD_CONTENT}>
        {/* Title row */}
        <div className="mb-[10px] flex items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 flex-1 text-[17px] font-bold leading-[1.35] text-fg">{ev.title}</h3>
          <span className="mt-[2px] shrink-0 rounded-full border px-[10px] py-[3px] text-[11px] font-bold tracking-[0.04em]" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>{badge.label}</span>
        </div>

        {/* Venue + date */}
        <div className="mb-[14px] flex flex-col gap-[5px]">
          <div className="flex items-center gap-[6px]">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="text-[12px] font-medium text-muted">{ev.venue}</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span className="text-[12px] font-medium text-muted">{ev.date}</span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-4">
          <div className="mb-[5px] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted">
              {sold === capacity ? "Sold Out" : `${sold} / ${capacity} slots`}
            </span>
            <div className="flex items-center gap-2">
              {priceRs && <span className="text-[12px] font-bold text-accent">{priceRs}</span>}
              <span className="text-[11px] font-bold" style={{ color: fillColor }}>{fillPct}%</span>
            </div>
          </div>
          <div className="h-[4px] overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fillPct}%`, background: fillColor }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onManage}
            className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border-[1.5px] border-[rgba(91,230,178,0.3)] bg-[rgba(91,230,178,0.1)] px-4 py-2 text-[12px] font-bold text-accent transition-all duration-150"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(91,230,178,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(91,230,178,0.1)"; }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Manage
          </button>
          {[
            { label: "Analytics", icon: <><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></>, onClick: onViewAnalytics },
            { label: "Preview",   icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,   onClick: onViewEvent },
          ].map(({ label, icon, onClick }) => (
            <button key={label} type="button" onClick={onClick}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-border-2 bg-surface-2 px-[14px] py-2 text-[12px] font-medium text-muted transition-all duration-150"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--white)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--muted2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{icon}</svg>
              {label}
            </button>
          ))}
          {onPublish && (
            <button type="button" onClick={onPublish}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-[14px] py-2 text-[12px] font-bold text-success transition-all duration-150"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
              {ev.status === "completed" ? "Reopen (Publish)" : "Publish"}
            </button>
          )}
          {onComplete && (
            <button type="button" onClick={onComplete}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] px-[14px] py-2 text-[12px] font-bold text-[#818cf8] transition-all duration-150"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.16)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              Complete
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-[14px] py-2 text-[12px] font-bold text-warning transition-all duration-150"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Cancel
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-[14px] py-2 text-[12px] font-bold text-danger transition-all duration-150"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
