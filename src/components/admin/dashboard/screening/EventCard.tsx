"use client";
import React, { memo, useState } from "react";
import styles from "../dashboard.module.css";
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
    <div className={styles.scrEventCard}>
      <div className={styles.scrEventCardImg} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!imgErr && ev.image ? (
          <img src={ev.image} alt={ev.title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setImgErr(true)} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #0d0d1a 0%, #090910 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="22" height="15" rx="2" stroke="#1e2240" strokeWidth="1.5" fill="#0c0c1a"/>
              <path d="M12 16v3" stroke="#1e2240" strokeWidth="1.5"/>
              <path d="M8 21h8" stroke="#1e2240" strokeWidth="1.5"/>
              <line x1="3" y1="7" x2="21" y2="7" stroke="#12122a" strokeWidth="0.75"/>
              <line x1="3" y1="11" x2="21" y2="11" stroke="#12122a" strokeWidth="0.75"/>
              <circle cx="12" cy="8.5" r="4" stroke="#1e2240" strokeWidth="1" fill="#10102a"/>
              <polygon points="10.5,6.5 10.5,10.5 14.5,8.5" fill="#1e2240"/>
            </svg>
            <span style={{ fontSize: "7px", fontWeight: 800, color: "#1e2240", letterSpacing: "0.18em", textTransform: "uppercase" }}>No Preview</span>
          </div>
        )}
      </div>

      <div className={styles.scrEventCardContent}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--white)", lineHeight: 1.35, flex: 1, minWidth: 0 }}>{ev.title}</h3>
          <span style={{ flexShrink: 0, marginTop: "2px", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
        </div>

        {/* Venue + date */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>{ev.venue}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>{ev.date}</span>
          </div>
        </div>

        {/* Capacity bar */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
              {sold === capacity ? "Sold Out" : `${sold} / ${capacity} slots`}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {priceRs && <span style={{ fontSize: "12px", fontWeight: 700, color: "#5be6b2" }}>{priceRs}</span>}
              <span style={{ fontSize: "11px", fontWeight: 700, color: fillColor }}>{fillPct}%</span>
            </div>
          </div>
          <div style={{ height: "4px", borderRadius: "999px", background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${fillPct}%`, background: fillColor, borderRadius: "999px", transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={onManage}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "rgba(91,230,178,0.1)", border: "1.5px solid rgba(91,230,178,0.3)", borderRadius: "8px", color: "#5be6b2", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
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
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "8px", color: "var(--muted)", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--white)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--muted2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{icon}</svg>
              {label}
            </button>
          ))}
          {onPublish && (
            <button type="button" onClick={onPublish}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", color: "#22c55e", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
              {ev.status === "completed" ? "Reopen (Publish)" : "Publish"}
            </button>
          )}
          {onComplete && (
            <button type="button" onClick={onComplete}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px", color: "#818cf8", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.16)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              Complete
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", color: "#f59e0b", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.08)"; }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Cancel
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
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
