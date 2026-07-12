"use client";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { ScrEvent, ScrShow, ScrShowTicket, scrStatusBadge, backBtnStyle, inp } from "./types";
import { scrApi, type ApiScrEvent, type ApiScrShow, type ApiScrTier, type CreateScrEventPayload } from "@/lib/screening-api";

// ── static data ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "TV Screenings", "Music", "Nightlife", "Social Mixers", "Performances",
  "Open Mics", "Comedy", "Sports", "Food & Drinks", "Esports",
  "Games & Quizzes", "Fitness Activities", "Kids", "Art Exhibitions",
  "Fests & Fairs", "Conferences & Talks", "Workshops", "Adventure",
];

const SUB_CATS: Record<string, string[]> = {
  "TV Screenings": ["Football Screenings", "Cricket Screenings", "F1 Screenings", "Movie Screenings", "Olympics Screenings", "Concert Screenings"],
  "Sports": ["Football", "Cricket", "Tennis", "Badminton", "Running", "Cycling"],
  "Music": ["Live Music", "DJ Night", "Open Mic", "Classical"],
  "Food & Drinks": ["Dining Experience", "Bar Night", "Wine Tasting", "Food Festival"],
};

const LANGUAGES = [
  "English", "Hindi", "Hinglish", "Bengali", "Telugu", "Tamil", "Tanglish",
  "Marathi", "Gujarati", "Kannada", "Punjabi", "Malayalam", "French", "Spanish", "German",
];

const AGE_OPTS = ["All ages", ...Array.from({ length: 50 }, (_, i) => String(i + 1))];

// ── time format helpers ───────────────────────────────────────────────────────

function toAmPm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h % 12) || 12).toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function toHHMM(ampm: string): string {
  if (!ampm) return "";
  const clean = ampm.trim().toUpperCase();
  const isPM = clean.includes("PM");
  const num = clean.replace(/[APM\s]/g, "");
  const [hStr, mStr = "0"] = num.split(":");
  let h = parseInt(hStr) || 0;
  const m = parseInt(mStr) || 0;
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── shared helpers ────────────────────────────────────────────────────────────

function SideCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
      {accent && <div style={{ height: "3px", background: accent }} />}
      <div style={{ padding: "16px" }}>
        <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function SideRow({ label, sub, icon, accent, onClick }: { label: string; sub?: string; icon?: React.ReactNode; accent?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", width: "100%", padding: "9px 0", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", gap: "10px", textAlign: "left", transition: "opacity 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      {icon && <div style={{ width: 28, height: 28, borderRadius: "7px", background: accent ? `${accent}15` : "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "1px" }}>{sub}</div>}
      </div>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--muted2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function TicketRow({ ticket, isLast }: { ticket: ScrShowTicket; isLast: boolean }) {
  const fillPct   = Math.min(100, Math.round((ticket.sold / Math.max(1, ticket.qty)) * 100));
  const fillColor = fillPct >= 90 ? "#ef4444" : fillPct >= 60 ? "#f59e0b" : "#5be6b2";
  return (
    <div style={{ padding: "10px 0", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", gap: "12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>{ticket.name}</span>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "13px", color: "#5be6b2", fontWeight: 700 }}>₹{Math.round(ticket.pricePaise / 100)}</span>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>{ticket.sold}/{ticket.qty} sold</span>
        </div>
      </div>
      <div style={{ height: "3px", borderRadius: "999px", background: "var(--surface2)" }}>
        <div style={{ height: "100%", width: `${fillPct}%`, background: fillColor, borderRadius: "999px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function TierManageCard({ tier, onEdit, onDelete }: {
  tier: ApiScrTier; onEdit: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fillPct   = Math.min(100, Math.round((tier.sold / Math.max(1, tier.capacity)) * 100));
  const fillColor = fillPct >= 90 ? "#ef4444" : fillPct >= 60 ? "#f59e0b" : "#5be6b2";
  const canDelete = tier.sold === 0;

  return (
    <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--white)" }}>{tier.name}</span>
            {tier.isDisabled && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#f59e0b", padding: "2px 7px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px" }}>DISABLED</span>
            )}
            {tier.salesEndDate && (
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--muted)", padding: "2px 7px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "999px" }}>
                Ends {new Date(tier.salesEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
            <span style={{ color: "#5be6b2", fontWeight: 700 }}>₹{Math.round(tier.pricePaise / 100)}</span>
            {" · "}
            <span>{tier.sold}/{tier.capacity} sold</span>
            {tier.showIds && tier.showIds.length > 0 && (
              <span style={{ marginLeft: "6px", color: "var(--muted2)" }}>· {tier.showIds.length} show{tier.showIds.length !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        {!confirmDelete && (
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button type="button" onClick={onEdit} title="Edit ticket"
              style={{ width: 32, height: 32, borderRadius: "8px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(91,230,178,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(91,230,178,0.08)")}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" title={canDelete ? "Delete ticket" : `${tier.sold} sold — cannot delete`}
              onClick={() => canDelete && setConfirmDelete(true)}
              style={{ width: 32, height: 32, borderRadius: "8px", background: canDelete ? "rgba(239,68,68,0.08)" : "var(--bg)", border: `1px solid ${canDelete ? "rgba(239,68,68,0.2)" : "var(--border)"}`, cursor: canDelete ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", opacity: canDelete ? 1 : 0.35 }}
              onMouseEnter={e => canDelete && (e.currentTarget.style.background = "rgba(239,68,68,0.18)")}
              onMouseLeave={e => { if (canDelete) e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        )}
        {confirmDelete && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>Delete?</span>
            <button type="button" onClick={() => { setConfirmDelete(false); onDelete(); }}
              style={{ padding: "5px 12px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "7px", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Yes</button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              style={{ padding: "5px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "7px", color: "var(--muted)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
      <div style={{ height: "4px", borderRadius: "999px", background: "var(--surface2)" }}>
        <div style={{ height: "100%", width: `${fillPct}%`, background: fillColor, borderRadius: "999px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// ── Overview form helpers ─────────────────────────────────────────────────────

function OvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "14px" }}>
      <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "var(--white)" }}>{title}</p>
      <div style={{ height: "1px", background: "var(--border)", margin: "12px 0 16px" }} />
      {children}
    </div>
  );
}

function OvLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
    </label>
  );
}

function OvSelect({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ ...inp, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, appearance: "none" as const }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function GuideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}<span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span></span>
      {children}
    </div>
  );
}

function MultiSelect({ options, value, onChange, max, disabled }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; max?: number; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (opt: string) => {
    if (disabled) return;
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else if (!max || value.length < max) onChange([...value, opt]);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => !disabled && setOpen(p => !p)}
        style={{ ...inp, minHeight: "42px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
        {value.length === 0
          ? <span style={{ color: "var(--muted)", fontSize: "13px" }}>Select…</span>
          : value.map(v => (
              <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", background: "rgba(91,230,178,0.1)", border: "1px solid rgba(91,230,178,0.3)", borderRadius: "999px", fontSize: "12px", color: "#5be6b2", fontWeight: 600 }}>
                {v}
                {!disabled && (
                  <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#5be6b2", padding: 0, lineHeight: 1, display: "flex" }}>
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </span>
            ))}
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", maxHeight: "220px", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {options.map(opt => {
            const selected = value.includes(opt);
            const capped   = !selected && !!max && value.length >= max;
            return (
              <div key={opt} onClick={() => !capped && toggle(opt)}
                style={{ padding: "9px 14px", cursor: capped ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "10px", opacity: capped ? 0.4 : 1, background: selected ? "rgba(91,230,178,0.07)" : "none" }}
                onMouseEnter={(e) => { if (!selected && !capped) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = selected ? "rgba(91,230,178,0.07)" : "none"; }}>
                <div style={{ width: 16, height: 16, borderRadius: "4px", border: `1.5px solid ${selected ? "#5be6b2" : "var(--border)"}`, background: selected ? "#5be6b2" : "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selected && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span style={{ fontSize: "13px", color: selected ? "#5be6b2" : "var(--white)", fontWeight: selected ? 600 : 400 }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Uploads the file immediately; calls onUpload with the returned server URL.
function ImageUploadBox({ label, ratio, maxSize, existingUrl, disabled, onUpload }: {
  label: string; ratio: string; maxSize: string; existingUrl?: string; disabled?: boolean;
  onUpload?: (url: string) => void;
}) {
  const [preview,    setPreview]    = useState(existingUrl ?? "");
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync if parent updates existingUrl (e.g. after loadEvent)
  useEffect(() => { if (existingUrl) setPreview(existingUrl); }, [existingUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadErr("");
    setPreview(URL.createObjectURL(f)); // immediate local preview
    if (onUpload) {
      setUploading(true);
      try {
        const url = await scrApi.uploadImage(f);
        setPreview(url);
        onUpload(url);
      } catch {
        setUploadErr("Upload failed — try again");
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted2)" }}>{ratio}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: "11px", color: "var(--muted2)" }}>Max {maxSize}</p>
          {preview && (
            <img src={preview} alt="preview" style={{ height: "44px", width: "auto", borderRadius: "6px", border: "1px solid var(--border)", objectFit: "cover" }} />
          )}
          <button type="button" onClick={() => !disabled && !uploading && fileRef.current?.click()}
            style={{ padding: "6px 14px", background: "none", border: "1px solid var(--border)", borderRadius: "7px", color: (disabled || uploading) ? "var(--muted2)" : "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: (disabled || uploading) ? "not-allowed" : "pointer" }}>
            {uploading ? "Uploading…" : preview ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
      {uploadErr && <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#ef4444" }}>{uploadErr}</p>}
      {!preview && !disabled && (
        <div onClick={() => fileRef.current?.click()}
          style={{ border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "20px", textAlign: "center", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(91,230,178,0.4)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" style={{ display: "block", margin: "0 auto 6px" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Click to upload</span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}

// ── Add Show Drawer ────────────────────────────────────────────────────────────

function AddShowDrawer({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (show: ScrShow, raw: { date: string; startTime: string; endTime: string }) => void;
}) {
  const [date, setDate]       = useState("");
  const [startTime, setStart] = useState("");
  const [endTime, setEnd]     = useState("");
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const firstRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTimeout(() => firstRef.current?.focus(), 80); }
    else { setDate(""); setStart(""); setEnd(""); setErrors({}); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const fmt = useCallback((t: string) => { const [h,m] = t.split(":").map(Number); return `${((h%12)||12).toString().padStart(2,"0")}:${m.toString().padStart(2,"0")} ${h>=12?"PM":"AM"}`; }, []);

  const handleSave = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = "Required";
    if (!startTime) errs.startTime = "Required";
    if (!endTime) errs.endTime = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const d = new Date(date + "T12:00:00");
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateLabel = `${days[d.getDay()]}, ${d.getDate()} ${mons[d.getMonth()]}`;

    onSave(
      {
        id: `show-${Date.now()}`,
        dateLabel,
        timeLabel: `${fmt(startTime)} to ${fmt(endTime)}`,
        status: "active", expanded: false,
        tickets: [],
      },
      { date: new Date(date + "T12:00:00").toISOString(), startTime: fmt(startTime), endTime: fmt(endTime) }
    );
    onClose();
  }, [date, startTime, endTime, onSave, onClose, fmt]);

  const fe = (k: string): React.CSSProperties => ({ ...inp, marginTop: "6px", borderColor: errors[k] ? "rgba(239,68,68,0.6)" : undefined });

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: "min(480px,100vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "-6px 0 40px rgba(0,0,0,0.45)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.16em", textTransform: "uppercase" }}>Shows</p>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>Add New Show</h3>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "22px" }}>
          <p style={{ margin: "0 0 20px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
            Adding a new show date makes this event available to book again. Ticket tiers are shared across all shows and can be edited in the Tickets section.
          </p>
          <div style={{ marginBottom: "18px" }}>
            <OvLabel required>Show Date</OvLabel>
            <input ref={firstRef} type="date" value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: "" })); }} style={fe("date")} />
            {errors.date && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.date}</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <OvLabel required>Start Time</OvLabel>
              <input type="time" value={startTime} onChange={e => { setStart(e.target.value); setErrors(p => ({ ...p, startTime: "" })); }} style={fe("startTime")} />
              {errors.startTime && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.startTime}</p>}
            </div>
            <div>
              <OvLabel required>End Time</OvLabel>
              <input type="time" value={endTime} onChange={e => { setEnd(e.target.value); setErrors(p => ({ ...p, endTime: "" })); }} style={fe("endTime")} />
              {errors.endTime && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.endTime}</p>}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button type="button" onClick={handleSave} style={{ flex: 2, height: "42px", background: "rgba(91,230,178,0.12)", border: "1.5px solid rgba(91,230,178,0.45)", borderRadius: "9px", color: "#5be6b2", fontSize: "13px", fontWeight: 800, cursor: "pointer" }}>Save Show</button>
        </div>
      </div>
    </>
  );
}

// ── Add Ticket Drawer ─────────────────────────────────────────────────────────

const SALES_END_UNITS     = ["Minutes", "Hours", "Days"];
const SALES_END_STRATEGIES = ["Before Show Start", "Before Show End"];
const GST_OPTIONS          = ["None / Exempt", "CGST+SGST 5%", "CGST+SGST 12%", "CGST+SGST 18%", "IGST 18%"];

function ScopeOption({ selected, onClick, title, sub, comingSoon }: {
  selected: boolean; onClick: () => void; title: string; sub: string; comingSoon?: boolean;
}) {
  return (
    <button type="button" onClick={comingSoon ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", width: "100%", background: selected ? "rgba(91,230,178,0.06)" : "var(--bg)", border: `1.5px solid ${selected ? "rgba(91,230,178,0.35)" : "var(--border)"}`, borderRadius: "11px", cursor: comingSoon ? "not-allowed" : "pointer", textAlign: "left", opacity: comingSoon ? 0.5 : 1, transition: "all 0.15s" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: `2px solid ${selected ? "#5be6b2" : "var(--border)"}`, background: selected ? "rgba(91,230,178,0.15)" : "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5be6b2" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>{title}</p>
          {comingSoon && (
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", padding: "2px 7px", background: "var(--surface2)", borderRadius: "999px", letterSpacing: "0.06em" }}>SOON</span>
          )}
        </div>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>{sub}</p>
      </div>
    </button>
  );
}

function parseDuration(timeLabel: string): string {
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)\s+to\s+(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return "";
  const toMin = (h: string, mi: string, ap: string) => (parseInt(h) % 12 + (ap.toUpperCase() === "PM" ? 12 : 0)) * 60 + parseInt(mi);
  const start = toMin(m[1], m[2], m[3]);
  const end   = toMin(m[4], m[5], m[6]);
  let diff = end - start;
  const spansDay = diff <= 0;
  if (spansDay) diff += 24 * 60;
  const hrs = Math.floor(diff / 60), mins = diff % 60;
  const parts: string[] = [];
  if (hrs)  parts.push(`${hrs} hour${hrs !== 1 ? "s" : ""}`);
  if (mins) parts.push(`${mins} min${mins !== 1 ? "s" : ""}`);
  return `Duration: ${parts.join(" ")}${spansDay ? " (spans across 1 calendar day)" : ""}`;
}

type NewTier = {
  name: string; pricePaise: number; capacity: number; description: string;
  salesEndDate: string | null; isDisabled: boolean; showIds: string[];
};

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        background: done || active ? "rgba(91,230,178,0.15)" : "var(--bg)",
        border: `1.5px solid ${done || active ? "#5be6b2" : "var(--border)"}`,
        transition: "all 0.2s",
      }}>
        {done ? (
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
        ) : (
          <span style={{ fontSize: "10px", fontWeight: 900, color: active ? "#5be6b2" : "var(--muted2)" }}>{n}</span>
        )}
      </div>
      <span style={{ fontSize: "11px", fontWeight: 700, color: done || active ? "#5be6b2" : "var(--muted2)", transition: "color 0.2s" }}>
        {n === 1 ? "Details" : "Availability"}
      </span>
    </div>
  );
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: "999px", border: "none", cursor: "pointer", padding: 2, flexShrink: 0,
      background: on ? "rgba(91,230,178,0.3)" : "var(--bg)",
      outline: `1.5px solid ${on ? "#5be6b2" : "var(--border)"}`,
      transition: "all 0.2s", display: "flex", alignItems: "center",
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%", background: on ? "#5be6b2" : "var(--muted2)",
        transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 0.2s, background 0.2s",
      }} />
    </button>
  );
}

function AddTicketDrawer({ open, onClose, onSave, shows }: {
  open: boolean; onClose: () => void; shows: ApiScrShow[];
  onSave: (tier: NewTier) => Promise<void>;
}) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [name, setName]               = useState("Regular Ticket");
  const [description, setDescription] = useState("");
  const [priceRs, setPriceRs]         = useState("");
  const [quantity, setQuantity]       = useState("");
  const [errors, setErrors]           = useState<Record<string, string>>({});
  // Step 2 state
  const [showScope, setShowScope]     = useState<"all" | "specific">("all");
  const [selectedShowIds, setSelectedShowIds] = useState<Set<string>>(new Set());
  const [hasSalesEnd, setHasSalesEnd] = useState(false);
  const [salesEndDate, setSalesEndDate] = useState("");
  const [isDisabled, setIsDisabled]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const resetAll = useCallback(() => {
    setStep(1); setName("Regular Ticket"); setDescription(""); setPriceRs(""); setQuantity("");
    setErrors({}); setShowScope("all"); setSelectedShowIds(new Set());
    setHasSalesEnd(false); setSalesEndDate(""); setIsDisabled(false);
    setSaving(false); setSaveError(null);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => nameRef.current?.focus(), 80); }
    else { resetAll(); }
  }, [open, resetAll]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const validateStep1 = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Required";
    const p = Number(priceRs);
    if (priceRs === "" || isNaN(p) || p < 0) errs.price = "Enter a valid price (0 for free)";
    const q = Number(quantity);
    if (!quantity || isNaN(q) || q < 1) errs.quantity = "Minimum 1 seat";
    return errs;
  }, [name, priceRs, quantity]);

  const handleNext = useCallback(() => {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  }, [validateStep1]);

  const toggleShowId = useCallback((id: string) => {
    setSelectedShowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        pricePaise: Math.round(Number(priceRs) * 100),
        capacity: Number(quantity),
        description: description.trim(),
        salesEndDate: hasSalesEnd && salesEndDate ? new Date(salesEndDate).toISOString() : null,
        isDisabled,
        showIds: showScope === "specific" ? Array.from(selectedShowIds) : [],
      });
      onClose();
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    }
  }, [name, priceRs, quantity, description, hasSalesEnd, salesEndDate, isDisabled, showScope, selectedShowIds, onSave, onClose]);

  const fe = (k: string): React.CSSProperties => ({ ...inp, marginTop: "6px", borderColor: errors[k] ? "rgba(239,68,68,0.6)" : undefined });

  const formatShow = (s: ApiScrShow) => {
    const d = new Date(s.date);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const time = s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime;
    return { label, time };
  };

  return (
    <>
      <div onClick={() => { if (!saving) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: "min(520px,100vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "-6px 0 40px rgba(0,0,0,0.45)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 14px" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {step === 1 ? "Ticket Details" : "Availability Settings"}
              </p>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>Add Ticket</h3>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 22px 14px" }}>
            <StepDot n={1} active={step === 1} done={step === 2} />
            <div style={{ flex: 1, height: "1px", background: step === 2 ? "rgba(91,230,178,0.3)" : "var(--border)", transition: "background 0.3s" }} />
            <StepDot n={2} active={step === 2} done={false} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px", display: "flex", flexDirection: "column", gap: "18px" }}>

          {step === 1 ? (
            <>
              {/* Name */}
              <div>
                <OvLabel required>Ticket Name</OvLabel>
                <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="e.g. Regular, VIP, Early Bird" style={fe("name")} />
                {errors.name && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <OvLabel>Description</OvLabel>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's included — e.g. Free snack + drink, Front row seating" rows={3}
                  style={{ ...inp, marginTop: "6px", resize: "vertical", minHeight: "80px", fontFamily: "inherit" }} />
              </div>

              {/* Price + Qty side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <OvLabel required>Price (₹)</OvLabel>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--muted)", fontWeight: 700, pointerEvents: "none" }}>₹</span>
                    <input type="number" min="0" step="1" value={priceRs}
                      onChange={e => { setPriceRs(e.target.value); setErrors(p => ({ ...p, price: "" })); }}
                      placeholder="0" style={{ ...fe("price"), paddingLeft: "26px" }} />
                  </div>
                  {errors.price && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.price}</p>}
                </div>
                <div>
                  <OvLabel required>Total Slots</OvLabel>
                  <input type="number" min="1" value={quantity}
                    onChange={e => { setQuantity(e.target.value); setErrors(p => ({ ...p, quantity: "" })); }}
                    placeholder="e.g. 100" style={fe("quantity")} />
                  {errors.quantity && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.quantity}</p>}
                </div>
              </div>

              <div style={{ background: "rgba(91,230,178,0.04)", border: "1px solid rgba(91,230,178,0.12)", borderRadius: "10px", padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted2)", lineHeight: 1.6 }}>
                  Set price to <strong style={{ color: "var(--white)" }}>0</strong> for a free ticket. Tax is not added separately — enter the final amount customers will pay.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Show slot assignment */}
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Which Shows</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(["all", "specific"] as const).map(scope => (
                    <button key={scope} type="button" onClick={() => setShowScope(scope)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", background: showScope === scope ? "rgba(91,230,178,0.06)" : "var(--bg)", border: `1.5px solid ${showScope === scope ? "rgba(91,230,178,0.4)" : "var(--border)"}`, borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${showScope === scope ? "#5be6b2" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {showScope === scope && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5be6b2" }} />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: showScope === scope ? "var(--white)" : "var(--muted)" }}>
                          {scope === "all" ? "All shows" : "Specific shows"}
                        </p>
                        <p style={{ margin: "1px 0 0", fontSize: "11px", color: "var(--muted2)" }}>
                          {scope === "all" ? "Ticket valid for every show date" : "Choose which show dates this ticket covers"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {showScope === "specific" && (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {shows.length === 0 ? (
                      <div style={{ padding: "14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "9px", fontSize: "12px", color: "var(--muted2)", textAlign: "center" }}>
                        No shows added yet — add shows first then come back
                      </div>
                    ) : shows.map(s => {
                      const { label, time } = formatShow(s);
                      const checked = selectedShowIds.has(s._id);
                      return (
                        <button key={s._id} type="button" onClick={() => toggleShowId(s._id)}
                          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", background: checked ? "rgba(91,230,178,0.05)" : "var(--bg)", border: `1.5px solid ${checked ? "rgba(91,230,178,0.35)" : "var(--border)"}`, borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                          <div style={{ width: 17, height: 17, borderRadius: "4px", border: `2px solid ${checked ? "#5be6b2" : "var(--border)"}`, background: checked ? "rgba(91,230,178,0.12)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                            {checked && <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: checked ? "var(--white)" : "var(--muted)" }}>{label}</p>
                            <p style={{ margin: "1px 0 0", fontSize: "11px", color: "var(--muted2)" }}>{time}</p>
                          </div>
                          {s.status !== "active" && (
                            <span style={{ fontSize: "9px", fontWeight: 800, color: "#ef4444", letterSpacing: ".1em", textTransform: "uppercase", flexShrink: 0 }}>{s.status}</span>
                          )}
                        </button>
                      );
                    })}
                    {showScope === "specific" && selectedShowIds.size > 0 && (
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#5be6b2", fontWeight: 700 }}>
                        {selectedShowIds.size} show{selectedShowIds.size > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Sales cutoff */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Sales End Date</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Stop selling after a specific date & time</p>
                  </div>
                  <ToggleSwitch on={hasSalesEnd} onChange={setHasSalesEnd} />
                </div>
                {hasSalesEnd && (
                  <div style={{ marginTop: "12px" }}>
                    <input type="datetime-local" value={salesEndDate} onChange={e => setSalesEndDate(e.target.value)}
                      style={{ ...inp, marginTop: 0, colorScheme: "dark" }} />
                    <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Customers cannot buy after this moment</p>
                  </div>
                )}
              </div>

              {/* Disable ticket */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Disable Ticket</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted2)" }}>
                      {isDisabled ? "Hidden from customers — enable later from ticket settings" : "Visible to customers immediately after saving"}
                    </p>
                  </div>
                  <ToggleSwitch on={isDisabled} onChange={setIsDisabled} />
                </div>
                {isDisabled && (
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "7px", padding: "8px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "7px" }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    <p style={{ margin: 0, fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>Ticket will be saved as disabled — not visible on the event page</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
            {step === 1 ? (
              <>
                <button type="button" onClick={onClose} disabled={saving}
                  style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="button" onClick={handleNext}
                  style={{ flex: 2, height: "42px", background: "rgba(91,230,178,0.12)", border: "1.5px solid rgba(91,230,178,0.45)", borderRadius: "9px", color: "#5be6b2", fontSize: "13px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  Next
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} disabled={saving}
                  style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Back
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  style={{ flex: 2, height: "42px", background: saving ? "rgba(91,230,178,0.06)" : "rgba(91,230,178,0.12)", border: "1.5px solid rgba(91,230,178,0.45)", borderRadius: "9px", color: "#5be6b2", fontSize: "13px", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {saving ? "Saving…" : "Add Ticket"}
                  {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div style={{ padding: "0 22px 14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontWeight: 600, padding: "9px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>{saveError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Edit Ticket Drawer (slides from LEFT) ────────────────────────────────────

function EditTicketDrawer({ open, onClose, tier, shows, onSave, onSaveShows }: {
  open: boolean; onClose: () => void; tier: ApiScrTier | null;
  shows: ApiScrShow[]; onSave: (updated: ApiScrTier) => Promise<void>;
  onSaveShows?: (updated: { _id: string; date: string; startTime: string; endTime: string }[]) => Promise<void>;
}) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [priceRs, setPriceRs]         = useState("");
  const [quantity, setQuantity]       = useState("");
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [showScope, setShowScope]     = useState<"all" | "specific">("all");
  const [selectedShowIds, setSelectedShowIds] = useState<Set<string>>(new Set());
  const [hasSalesEnd, setHasSalesEnd] = useState(false);
  const [salesEndDate, setSalesEndDate] = useState("");
  const [isDisabled, setIsDisabled]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  // Show time edits: keyed by show._id, values are HH:MM strings for <input type="time">
  const [showEdits, setShowEdits]     = useState<Record<string, { date: string; startTime: string; endTime: string }>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && tier) {
      setStep(1); setErrors({}); setSaving(false); setSaveError(null);
      setName(tier.name);
      setDescription(tier.description || "");
      setPriceRs(String(Math.round(tier.pricePaise / 100)));
      setQuantity(String(tier.capacity));
      const hasIds = tier.showIds && tier.showIds.length > 0;
      setShowScope(hasIds ? "specific" : "all");
      setSelectedShowIds(new Set(hasIds ? tier.showIds : []));
      const sd = tier.salesEndDate;
      setHasSalesEnd(!!sd);
      setSalesEndDate(sd ? new Date(sd).toISOString().slice(0, 16) : "");
      setIsDisabled(tier.isDisabled || false);
      // Initialize show edits from current show data
      const edits: Record<string, { date: string; startTime: string; endTime: string }> = {};
      shows.forEach(s => {
        edits[s._id] = {
          date: s.date ? new Date(s.date).toISOString().slice(0, 10) : "",
          startTime: toHHMM(s.startTime),
          endTime: toHHMM(s.endTime || ""),
        };
      });
      setShowEdits(edits);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open, tier, shows]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const minCapacity = tier?.sold ?? 0;

  const validateStep1 = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Required";
    const p = Number(priceRs);
    if (priceRs === "" || isNaN(p) || p < 0) errs.price = "Enter a valid price (0 for free)";
    const q = Number(quantity);
    if (!quantity || isNaN(q) || q < 1) errs.quantity = "Minimum 1 seat";
    else if (q < minCapacity) errs.quantity = `Cannot go below ${minCapacity} — that many tickets already sold`;
    return errs;
  }, [name, priceRs, quantity, minCapacity]);

  const handleNext = useCallback(() => {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setStep(2);
  }, [validateStep1]);

  const toggleShowId = useCallback((id: string) => {
    setSelectedShowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!tier) return;
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); setStep(1); return; }
    setSaving(true); setSaveError(null);
    try {
      if (onSaveShows && shows.length > 0 && Object.keys(showEdits).length > 0) {
        const updatedShows = shows.map(s => ({
          _id: s._id,
          date: showEdits[s._id]?.date ? new Date(showEdits[s._id].date + "T12:00:00").toISOString() : s.date,
          startTime: showEdits[s._id]?.startTime ? toAmPm(showEdits[s._id].startTime) : s.startTime,
          endTime: showEdits[s._id]?.endTime ? toAmPm(showEdits[s._id].endTime) : (s.endTime || ""),
        }));
        await onSaveShows(updatedShows);
      }
      await onSave({
        ...tier,
        name: name.trim(),
        pricePaise: Math.round(Number(priceRs) * 100),
        capacity: Number(quantity),
        description: description.trim(),
        salesEndDate: hasSalesEnd && salesEndDate ? new Date(salesEndDate).toISOString() : null,
        isDisabled,
        showIds: showScope === "specific" ? Array.from(selectedShowIds) : [],
      });
      onClose();
    } catch (e) {
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    }
  }, [tier, name, priceRs, quantity, description, hasSalesEnd, salesEndDate, isDisabled, showScope, selectedShowIds, onSave, onSaveShows, onClose, validateStep1, showEdits, shows]);

  const fe = (k: string): React.CSSProperties => ({ ...inp, marginTop: "6px", borderColor: errors[k] ? "rgba(239,68,68,0.6)" : undefined });

  const formatShow = (s: ApiScrShow) => {
    const d = new Date(s.date);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const time = s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime;
    return { label, time };
  };

  return (
    <>
      <div onClick={() => { if (!saving) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, width: "min(520px,100vw)", background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "6px 0 40px rgba(0,0,0,0.45)", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 14px" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#c8f135", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {step === 1 ? "Edit Details" : "Availability Settings"}
              </p>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>Edit Ticket</h3>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 22px 14px" }}>
            <StepDot n={1} active={step === 1} done={step === 2} />
            <div style={{ flex: 1, height: "1px", background: step === 2 ? "rgba(200,241,53,0.3)" : "var(--border)", transition: "background 0.3s" }} />
            <StepDot n={2} active={step === 2} done={false} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {step === 1 ? (
            <>
              <div>
                <OvLabel required>Ticket Name</OvLabel>
                <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="e.g. Regular, VIP, Early Bird" style={fe("name")} />
                {errors.name && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.name}</p>}
              </div>
              <div>
                <OvLabel>Description</OvLabel>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's included — e.g. Free snack + drink, Front row seating" rows={3}
                  style={{ ...inp, marginTop: "6px", resize: "vertical", minHeight: "80px", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <OvLabel required>Price (₹)</OvLabel>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--muted)", fontWeight: 700, pointerEvents: "none" }}>₹</span>
                    <input type="number" min="0" step="1" value={priceRs}
                      onChange={e => { setPriceRs(e.target.value); setErrors(p => ({ ...p, price: "" })); }}
                      placeholder="0" style={{ ...fe("price"), paddingLeft: "26px" }} />
                  </div>
                  {errors.price && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.price}</p>}
                </div>
                <div>
                  <OvLabel required>Total Slots</OvLabel>
                  <input type="number" min={minCapacity || 1} value={quantity}
                    onChange={e => { setQuantity(e.target.value); setErrors(p => ({ ...p, quantity: "" })); }}
                    placeholder="e.g. 100" style={fe("quantity")} />
                  {errors.quantity
                    ? <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#ef4444" }}>{errors.quantity}</p>
                    : minCapacity > 0 && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Min {minCapacity} ({minCapacity} already sold)</p>
                  }
                </div>
              </div>
              <div style={{ background: "rgba(200,241,53,0.04)", border: "1px solid rgba(200,241,53,0.12)", borderRadius: "10px", padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted2)", lineHeight: 1.6 }}>
                  Price changes apply to future purchases only — existing tickets keep the price they were bought at.
                  {minCapacity > 0 && <> Capacity can&apos;t go below <strong style={{ color: "var(--white)" }}>{minCapacity}</strong> (already sold).</>}
                </p>
              </div>

              {/* Show time editing */}
              {shows.length > 0 && (
                <div>
                  <div style={{ marginBottom: "10px" }}>
                    <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Show Times</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted2)" }}>Update date &amp; time for each show</p>
                  </div>
                  {shows.map(s => {
                    const d = new Date(s.date);
                    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    const edit = showEdits[s._id] || { date: "", startTime: "", endTime: "" };
                    return (
                      <div key={s._id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", marginBottom: "8px" }}>
                        <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "var(--white)" }}>{label}</p>
                        <div>
                          <OvLabel required>Date</OvLabel>
                          <input type="date" value={edit.date}
                            onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], date: e.target.value } }))}
                            style={{ ...inp, marginTop: "6px" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                          <div>
                            <OvLabel required>Start Time</OvLabel>
                            <input type="time" value={edit.startTime}
                              onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], startTime: e.target.value } }))}
                              style={{ ...inp, marginTop: "6px" }} />
                          </div>
                          <div>
                            <OvLabel>End Time</OvLabel>
                            <input type="time" value={edit.endTime}
                              onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], endTime: e.target.value } }))}
                              style={{ ...inp, marginTop: "6px" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Which Shows</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(["all", "specific"] as const).map(scope => (
                    <button key={scope} type="button" onClick={() => setShowScope(scope)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", background: showScope === scope ? "rgba(91,230,178,0.06)" : "var(--bg)", border: `1.5px solid ${showScope === scope ? "rgba(91,230,178,0.4)" : "var(--border)"}`, borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${showScope === scope ? "#5be6b2" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {showScope === scope && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5be6b2" }} />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: showScope === scope ? "var(--white)" : "var(--muted)" }}>
                          {scope === "all" ? "All shows" : "Specific shows"}
                        </p>
                        <p style={{ margin: "1px 0 0", fontSize: "11px", color: "var(--muted2)" }}>
                          {scope === "all" ? "Ticket valid for every show date" : "Choose which show dates this ticket covers"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {showScope === "specific" && (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {shows.length === 0 ? (
                      <div style={{ padding: "14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "9px", fontSize: "12px", color: "var(--muted2)", textAlign: "center" }}>
                        No shows added yet
                      </div>
                    ) : shows.map(s => {
                      const { label, time } = formatShow(s);
                      const checked = selectedShowIds.has(s._id);
                      return (
                        <button key={s._id} type="button" onClick={() => toggleShowId(s._id)}
                          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", background: checked ? "rgba(91,230,178,0.05)" : "var(--bg)", border: `1.5px solid ${checked ? "rgba(91,230,178,0.35)" : "var(--border)"}`, borderRadius: "9px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                          <div style={{ width: 17, height: 17, borderRadius: "4px", border: `2px solid ${checked ? "#5be6b2" : "var(--border)"}`, background: checked ? "rgba(91,230,178,0.12)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {checked && <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: checked ? "var(--white)" : "var(--muted)" }}>{label}</p>
                            <p style={{ margin: "1px 0 0", fontSize: "11px", color: "var(--muted2)" }}>{time}</p>
                          </div>
                          {s.status !== "active" && (
                            <span style={{ fontSize: "9px", fontWeight: 800, color: "#ef4444", letterSpacing: ".1em", textTransform: "uppercase", flexShrink: 0 }}>{s.status}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Sales End Date</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Stop selling after a specific date & time</p>
                  </div>
                  <ToggleSwitch on={hasSalesEnd} onChange={setHasSalesEnd} />
                </div>
                {hasSalesEnd && (
                  <div style={{ marginTop: "12px" }}>
                    <input type="datetime-local" value={salesEndDate} onChange={e => setSalesEndDate(e.target.value)}
                      style={{ ...inp, marginTop: 0, colorScheme: "dark" }} />
                    <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Customers cannot buy after this moment</p>
                  </div>
                )}
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Disable Ticket</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted2)" }}>
                      {isDisabled ? "Hidden from customers — enable to go live" : "Visible to customers immediately after saving"}
                    </p>
                  </div>
                  <ToggleSwitch on={isDisabled} onChange={setIsDisabled} />
                </div>
                {isDisabled && (
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "7px", padding: "8px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "7px" }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    <p style={{ margin: 0, fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>This ticket is hidden — customers cannot see or buy it</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
            {step === 1 ? (
              <>
                <button type="button" onClick={onClose} disabled={saving}
                  style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="button" onClick={handleNext}
                  style={{ flex: 2, height: "42px", background: "rgba(200,241,53,0.12)", border: "1.5px solid rgba(200,241,53,0.45)", borderRadius: "9px", color: "#c8f135", fontSize: "13px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  Next
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} disabled={saving}
                  style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Back
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  style={{ flex: 2, height: "42px", background: saving ? "rgba(200,241,53,0.06)" : "rgba(200,241,53,0.12)", border: "1.5px solid rgba(200,241,53,0.45)", borderRadius: "9px", color: "#c8f135", fontSize: "13px", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {saving ? "Saving…" : "Save Changes"}
                  {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div style={{ padding: "0 22px 14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontWeight: 600, padding: "9px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>{saveError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Edit Venue Drawer ─────────────────────────────────────────────────────────

function EditVenueDrawer({ open, onClose, initialName, initialCity, initialMapUrl, onSave }: {
  open: boolean; onClose: () => void;
  initialName: string; initialCity: string; initialMapUrl: string;
  onSave: (name: string, city: string, mapUrl: string) => Promise<void>;
}) {
  const [name, setName]           = useState(initialName);
  const [city, setCity]           = useState(initialCity);
  const [mapUrl, setMapUrl]       = useState(initialMapUrl);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName); setCity(initialCity); setMapUrl(initialMapUrl);
      setSaving(false); setSaveError(null);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open, initialName, initialCity, initialMapUrl]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      await onSave(name.trim(), city.trim(), mapUrl.trim());
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={() => { if (!saving) onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: "min(480px,100vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", boxShadow: "-6px 0 40px rgba(0,0,0,0.45)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.16em", textTransform: "uppercase" }}>Venue</p>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>Edit Venue</h3>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "22px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <OvLabel required>Venue Name</OvLabel>
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. The Local Cafe" style={{ ...inp, marginTop: "6px" }} />
          </div>
          <div>
            <OvLabel required>City / Area</OvLabel>
            <input value={city} onChange={e => setCity(e.target.value)}
              placeholder="e.g. Koramangala, Bangalore" style={{ ...inp, marginTop: "6px" }} />
          </div>
          <div>
            <OvLabel>Google Maps URL</OvLabel>
            <input type="url" value={mapUrl} onChange={e => setMapUrl(e.target.value)}
              placeholder="https://maps.google.com/?q=..." style={{ ...inp, marginTop: "6px" }} />
            <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Customers tap this to open the venue in Google Maps</p>
          </div>
          <div style={{ background: "rgba(91,230,178,0.04)", border: "1px solid rgba(91,230,178,0.12)", borderRadius: "10px", padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted2)", lineHeight: 1.6 }}>
              Venue changes go live immediately on the customer-facing event page.
            </p>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
              style={{ flex: 2, height: "42px", background: saving ? "rgba(91,230,178,0.06)" : "rgba(91,230,178,0.12)", border: "1.5px solid rgba(91,230,178,0.45)", borderRadius: "9px", color: "#5be6b2", fontSize: "13px", fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: (saving || !name.trim()) ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              {saving ? "Saving…" : "Save Venue"}
              {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
            </button>
          </div>
          {saveError && (
            <div style={{ padding: "0 22px 14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontWeight: 600, padding: "9px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>{saveError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Poc = { id: string; name: string; email: string; phone: string };

export function ScrManageEventPage({ ev, onBack }: { ev: ScrEvent; onBack: () => void }) {
  const router = useRouter();

  // Shows tab state
  const [tab, setTab]               = useState<"shows" | "overview">("shows");
  const [shows, setShows]                   = useState<ScrShow[]>([]);
  const [fullShows, setFullShows]           = useState<ApiScrShow[]>([]);
  const [fullTiers, setFullTiers]           = useState<ApiScrTier[]>([]);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);
  const [editingTier, setEditingTier]       = useState<ApiScrTier | null>(null);
  const [venueDrawerOpen, setVenueDrawerOpen] = useState(false);
  const [tierSaveToast, setTierSaveToast]   = useState<string | null>(null);

  // Overview tab state — all initialised empty; useEffect populates from API
  const [eventName, setEventName]         = useState(ev.title);
  const [description, setDescription]     = useState("");
  const [categories, setCategories]       = useState<string[]>([]);
  const [subCategories, setSubCats]       = useState<string[]>([]);
  const [venueLocation, setVenueLoc]      = useState("");
  const [venueCity, setVenueCity]         = useState("");
  const [locationUrl, setLocationUrl]     = useState("");
  const [ownRestaurant, setOwnRest]       = useState<"yes" | "no">("no");
  const [instagramLink, setIgLink]        = useState("");
  const [language, setLanguage]           = useState<string[]>([]);
  const [minAge, setMinAge]               = useState("All ages");
  const [ticketAge, setTicketAge]         = useState("All ages");
  const [venueType, setVenueType]         = useState("Indoor");
  const [seating, setSeating]             = useState("Seated & Standing");
  const [kidFriendly, setKidFriendly]     = useState("No");
  const [petFriendly, setPetFriendly]     = useState("No");
  const [gatesOpen, setGatesOpen]         = useState(false);
  const [gatesOpenMinutes, setGatesOpenMinutes] = useState(30);
  const [imgUrl, setImgUrl]               = useState(ev.image || "");
  const [posterUrl, setPosterUrl]         = useState("");
  const [pocs, setPocs]                   = useState<Poc[]>(() =>
    ev.contacts.length > 0
      ? ev.contacts.map((c, i) => ({ id: `poc-${i}`, name: c.name, email: c.email, phone: c.phone }))
      : [{ id: "poc-0", name: "", email: "", phone: "" }]
  );
  const [showOrganiser, setShowOrganiser] = useState<boolean>(ev.showOrganiser ?? false);
  const [sendCopies, setSendCopies]       = useState(false);
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const [extraContent, setExtraContent]   = useState<Record<string, string>>({});
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const badge      = scrStatusBadge(ev.status);
  const allExpired = shows.every(s => s.status === "expired");
  const isLocked   = ev.status === "published";

  // Load full event data to populate all form fields
  useEffect(() => {
    setLoadingOverview(true);
    scrApi.getEvent(ev.id)
      .then((full: ApiScrEvent) => {
        setEventName(full.title || ev.title);
        setDescription(full.description || "");
        setCategories(full.categories || []);
        setSubCats(full.subCategories || []);
        setLanguage(full.languages || []);
        setOwnRest(full.ownRestaurant ? "yes" : "no");
        setIgLink(full.venueInstagram || "");
        setMinAge(full.minAgeEntry > 0 ? String(full.minAgeEntry) : "All ages");
        setTicketAge(full.minAgePaid > 0 ? String(full.minAgePaid) : "All ages");
        setVenueType(full.isIndoor === false ? "Outdoor" : "Indoor");
        setSeating(full.isSeated === true ? "Seated" : full.isSeated === false ? "Standing" : "Seated & Standing");
        setKidFriendly(full.kidFriendly === true ? "Yes" : "No");
        setPetFriendly(full.petFriendly === true ? "Yes" : "No");
        const gateMin = full.gatesOpenBefore || 0;
        setGatesOpen(gateMin > 0);
        setGatesOpenMinutes(gateMin > 0 ? gateMin : 30);
        setImgUrl(full.image || "");
        setPosterUrl(full.poster || "");
        setVenueLoc(full.venueName || "");
        setVenueCity(full.location || "");
        setLocationUrl(full.locationUrl || "");
        if (full.contacts?.length) {
          setPocs(full.contacts.map((c, i) => ({ id: `poc-${i}`, name: c.name, email: c.email, phone: c.phone })));
        }
        setShowOrganiser(full.showOrganiser ?? false);
        // Populate extra sections from stored data
        const storedSections = (full.extraSections || []).filter(s => s.content);
        if (storedSections.length) {
          setExtraSections(storedSections.map(s => s.type));
          const content: Record<string, string> = {};
          storedSections.forEach(s => { content[s.type] = s.content; });
          setExtraContent(content);
        }
        // Transform API shows to display format
        const displayShows: ScrShow[] = (full.shows || []).map(s => {
          const d = new Date(s.date);
          const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const dateLabel = `${days[d.getDay()]}, ${d.getDate()} ${mons[d.getMonth()]}`;
          const timeLabel = s.endTime ? `${s.startTime} to ${s.endTime}` : s.startTime;
          const isExpired = new Date(s.date) < new Date();
          return {
            id: s._id,
            dateLabel,
            timeLabel,
            status: (isExpired ? "expired" : "active") as "active" | "expired",
            expanded: false,
            tickets: (full.tiers || []).map(t => ({
              id: String(t._id), name: t.name, qty: t.capacity, sold: t.sold, pricePaise: t.pricePaise,
            })),
          };
        });
        setShows(displayShows);
        setFullShows(full.shows || []);
        setFullTiers(full.tiers || []);
      })
      .catch(err => console.error("[ManagePage] Failed to load event:", err))
      .finally(() => setLoadingOverview(false));
  }, [ev.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleShow        = useCallback((id: string) => setShows(p => p.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s)), []);
  const openDrawer        = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer       = useCallback(() => setDrawerOpen(false), []);
  const openTicketDrawer  = useCallback(() => setTicketDrawerOpen(true), []);
  const closeTicketDrawer = useCallback(() => setTicketDrawerOpen(false), []);
  const openEditDrawer    = useCallback((tier: ApiScrTier) => setEditingTier(tier), []);
  const closeEditDrawer   = useCallback(() => setEditingTier(null), []);

  const showTierToast = useCallback((msg: string) => {
    setTierSaveToast(msg);
    setTimeout(() => setTierSaveToast(null), 2200);
  }, []);

  const handleSaveTicket = useCallback(async (tier: NewTier) => {
    const updatedTiers = [
      ...fullTiers.map(t => ({
        _id: t._id, name: t.name, pricePaise: t.pricePaise, capacity: t.capacity,
        description: t.description, salesEndDate: t.salesEndDate ?? null,
        isDisabled: t.isDisabled ?? false, showIds: t.showIds ?? [],
      })),
      tier,
    ];
    const saved = await scrApi.updateEvent(ev.id, { tiers: updatedTiers });
    // Refresh from real response so _ids are always valid MongoDB ObjectIds
    setFullTiers(saved.tiers || []);
    setShows(p => p.map(s => ({
      ...s,
      tickets: (saved.tiers || []).map(t => ({ id: String(t._id), name: t.name, qty: t.capacity, sold: t.sold, pricePaise: t.pricePaise })),
    })));
  }, [ev.id, fullTiers]);

  const handleEditSave = useCallback(async (updated: ApiScrTier) => {
    const updatedTiers = fullTiers.map(t =>
      t._id === updated._id
        ? { _id: updated._id, name: updated.name, pricePaise: updated.pricePaise, capacity: updated.capacity, description: updated.description, salesEndDate: updated.salesEndDate ?? null, isDisabled: updated.isDisabled ?? false, showIds: updated.showIds ?? [] }
        : { _id: t._id, name: t.name, pricePaise: t.pricePaise, capacity: t.capacity, description: t.description, salesEndDate: t.salesEndDate ?? null, isDisabled: t.isDisabled ?? false, showIds: t.showIds ?? [] }
    );
    const saved = await scrApi.updateEvent(ev.id, { tiers: updatedTiers });
    setFullTiers(saved.tiers || []);
    setShows(p => p.map(s => ({
      ...s,
      tickets: (saved.tiers || []).map(t => ({ id: String(t._id), name: t.name, qty: t.capacity, sold: t.sold, pricePaise: t.pricePaise })),
    })));
    showTierToast("Ticket updated successfully");
  }, [ev.id, fullTiers, showTierToast]);

  const handleDeleteTier = useCallback(async (tierId: string) => {
    const updatedTiers = fullTiers
      .filter(t => t._id !== tierId)
      .map(t => ({ _id: t._id, name: t.name, pricePaise: t.pricePaise, capacity: t.capacity, description: t.description, salesEndDate: t.salesEndDate ?? null, isDisabled: t.isDisabled ?? false, showIds: t.showIds ?? [] }));
    const saved = await scrApi.updateEvent(ev.id, { tiers: updatedTiers });
    setFullTiers(saved.tiers || []);
    setShows(p => p.map(s => ({
      ...s,
      tickets: (saved.tiers || []).map(t => ({ id: String(t._id), name: t.name, qty: t.capacity, sold: t.sold, pricePaise: t.pricePaise })),
    })));
    showTierToast("Ticket deleted");
  }, [ev.id, fullTiers, showTierToast]);

  const handleSaveShow = useCallback(async (newShow: ScrShow, raw: { date: string; startTime: string; endTime: string }) => {
    // Optimistic add — include existing tiers as tickets so they appear immediately
    const optimisticShow: ScrShow = {
      ...newShow,
      tickets: fullTiers.map(t => ({ id: String(t._id), name: t.name, qty: t.capacity, sold: 0, pricePaise: t.pricePaise })),
    };
    setShows(p => [optimisticShow, ...p]);
    const newRaw = { date: raw.date, startTime: raw.startTime, endTime: raw.endTime };
    // Keep existing show _id values so Mongoose preserves them — avoids stale ID references
    const updatedShows = [
      ...fullShows.map(s => ({ _id: s._id, date: s.date, startTime: s.startTime, endTime: s.endTime })),
      newRaw,
    ] as CreateScrEventPayload["shows"];
    try {
      const saved = await scrApi.updateEvent(ev.id, { shows: updatedShows });
      // Use real _ids from the response to avoid fake-id issues on next save
      setFullShows(saved.shows || []);
      // Replace the optimistic fake ID with the real MongoDB _id returned by the server
      const realShow = (saved.shows || []).at(-1);
      if (realShow) {
        setShows(p => p.map(s => s.id === newShow.id ? { ...s, id: realShow._id } : s));
      }
    } catch (err) {
      console.error("[ManagePage] Failed to save show:", err);
      setShows(p => p.filter(s => s.id !== newShow.id));
      showTierToast("Failed to save show — please try again");
    }
  }, [ev.id, fullShows, fullTiers, showTierToast]);

  const handleSaveVenue = useCallback(async (name: string, city: string, mapUrl: string) => {
    await scrApi.updateEvent(ev.id, { venueName: name, location: city, locationUrl: mapUrl });
    setVenueLoc(name);
    setVenueCity(city);
    setLocationUrl(mapUrl);
    showTierToast("Venue updated");
  }, [ev.id, showTierToast]);

  const handleUpdateShows = useCallback(async (updatedShows: { _id: string; date: string; startTime: string; endTime: string }[]) => {
    // Keep _id so Mongoose preserves the same ObjectIds — allows UI to match by id after save
    const payload = updatedShows.map(s => ({ _id: s._id, date: s.date, startTime: s.startTime, endTime: s.endTime })) as CreateScrEventPayload["shows"];
    const saved = await scrApi.updateEvent(ev.id, { shows: payload });
    setFullShows(saved.shows || []);
    setShows(prev => prev.map(s => {
      const updated = (saved.shows || []).find(sh => sh._id === s.id);
      if (!updated) return s;
      const d = new Date(updated.date);
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return {
        ...s,
        dateLabel: `${days[d.getDay()]}, ${d.getDate()} ${mons[d.getMonth()]}`,
        timeLabel: updated.endTime ? `${updated.startTime} to ${updated.endTime}` : updated.startTime,
      };
    }));
    showTierToast("Show times updated");
  }, [ev.id, showTierToast]);

  // Live sold/capacity from fullTiers — updates immediately after Add Ticket
  const liveCapacity = useMemo(() => fullTiers.reduce((s, t) => s + t.capacity, 0) || (ev.capacity ?? 0), [fullTiers, ev.capacity]);
  const liveSold     = useMemo(() => fullTiers.reduce((s, t) => s + t.sold, 0),    [fullTiers]);

  const availableSubCats = useMemo(() => {
    const all = new Set<string>();
    categories.forEach(c => { (SUB_CATS[c] ?? []).forEach(s => all.add(s)); });
    return Array.from(all);
  }, [categories]);

  const addPoc = useCallback(() => setPocs(p => [...p, { id: `poc-${Date.now()}`, name: "", email: "", phone: "" }]), []);
  const updatePoc = useCallback((id: string, field: keyof Poc, val: string) =>
    setPocs(p => p.map(poc => poc.id === id ? { ...poc, [field]: val } : poc)), []);
  const removePoc = useCallback((id: string) => setPocs(p => p.filter(poc => poc.id !== id)), []);

  const toggleExtra = useCallback((sec: string) =>
    setExtraSections(p => p.includes(sec) ? p.filter(s => s !== sec) : [...p, sec]), []);

  const handleSaveOverview = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const minAgeNum    = minAge === "All ages"    ? 0 : Number(minAge);
      const ticketAgeNum = ticketAge === "All ages" ? 0 : Number(ticketAge);
      const isIndoorVal  = venueType === "Indoor" ? true : venueType === "Outdoor" ? false : null;
      const isSeatedVal  = seating === "Seated" ? true : seating === "Standing" ? false : null;

      await scrApi.updateEvent(ev.id, {
        title:           eventName.trim() || ev.title,
        description,
        categories,
        subCategories,
        languages:       language,
        venueName:       venueLocation,
        location:        venueCity,
        locationUrl:     locationUrl,
        ownRestaurant:   ownRestaurant === "yes",
        venueInstagram:  instagramLink,
        isIndoor:        isIndoorVal,
        isSeated:        isSeatedVal,
        kidFriendly:     kidFriendly === "Yes",
        petFriendly:     petFriendly === "Yes",
        minAgeEntry:     minAgeNum,
        minAgePaid:      ticketAgeNum,
        gatesOpenBefore: gatesOpen ? gatesOpenMinutes : 0,
        contacts:        pocs.map(p => ({ name: p.name, email: p.email, phone: p.phone })),
        showOrganiser,
        ...(imgUrl    ? { image:  imgUrl }    : {}),
        ...(posterUrl ? { poster: posterUrl } : {}),
        extraSections: extraSections.map(sec => ({
          type:    sec,
          content: extraContent[sec] || "",
        })),
      });
      setSaveMsg("Saved");
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [ev.id, ev.title, eventName, description, categories, subCategories, language, venueLocation, venueCity, locationUrl, ownRestaurant, instagramLink, venueType, seating, kidFriendly, petFriendly, minAge, ticketAge, gatesOpen, gatesOpenMinutes, pocs, showOrganiser, imgUrl, posterUrl, extraSections, extraContent]);

  return (
    <>
      <div style={{ paddingBottom: 48 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={onBack} style={backBtnStyle}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.15em", textTransform: "uppercase" }}>Streaming Events</p>
            <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "var(--white)" }}>Manage Event</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
          </div>
          <span style={{ flexShrink: 0, marginTop: "4px", padding: "5px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
        </div>

        <div style={{ height: "1px", background: "var(--border)", margin: "16px 0 24px" }} />

        <div className={styles.scrManageLayout}>
          {/* ── LEFT ── */}
          <div>
            {/* Tab bar */}
            <div className={styles.scrManageTabBar}>
              {([
                { key: "shows",    label: "Shows & Tickets", icon: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></> },
                { key: "overview", label: "Overview",         icon: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
              ] as const).map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`${styles.scrManageTab} ${tab === t.key ? styles.scrManageTabActive : ""}`}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: "6px", verticalAlign: "middle" }}>{t.icon}</svg>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Shows tab ── */}
            {tab === "shows" && (
              <div>
                {loadingOverview ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
                    <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <>
                    {/* ── Venue ── */}
                    <div style={{ marginBottom: "24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "9px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 700, color: "var(--white)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {venueLocation || <span style={{ color: "var(--muted2)" }}>No venue set</span>}
                          </p>
                          <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                            {venueCity || "No city set"}
                            {locationUrl && <span style={{ marginLeft: "8px", color: "#5be6b2", fontWeight: 600 }}>· Maps linked</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => setVenueDrawerOpen(true)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 13px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.25)", borderRadius: "8px", color: "#5be6b2", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit Venue
                        </button>
                      </div>
                    </div>

                    {/* ── Ticket Types ── */}
                    <div style={{ marginBottom: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Ticket Types</p>
                          {fullTiers.length > 0 && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted2)" }}>{fullTiers.length} tier{fullTiers.length !== 1 ? "s" : ""} · {liveSold} sold · {liveCapacity - liveSold} remaining</p>
                          )}
                        </div>
                        <button type="button" onClick={openTicketDrawer}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 13px", background: "rgba(91,230,178,0.1)", border: "1px solid rgba(91,230,178,0.3)", borderRadius: "8px", color: "#5be6b2", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                          Add Ticket
                        </button>
                      </div>
                      {fullTiers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 24px", border: "1.5px dashed var(--border)", borderRadius: "12px" }}>
                          <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>No ticket types yet</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted2)" }}>Click "Add Ticket" to create your first ticket tier</p>
                        </div>
                      ) : fullTiers.map(tier => (
                        <TierManageCard
                          key={tier._id}
                          tier={tier}
                          onEdit={() => openEditDrawer(tier)}
                          onDelete={() => handleDeleteTier(tier._id)}
                        />
                      ))}
                    </div>

                    {/* ── Show Dates ── */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Show Dates</p>
                        <button type="button" onClick={openDrawer}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 13px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                          Add Show
                        </button>
                      </div>
                      {shows.length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 24px", border: "1.5px dashed var(--border)", borderRadius: "12px", marginBottom: "8px" }}>
                          <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>No shows scheduled yet</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted2)" }}>Add a show date to go live with your tickets</p>
                        </div>
                      )}
                      {shows.length > 0 && allExpired && (
                        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                          <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 600 }}>All shows have expired. Add a new show date to continue selling.</span>
                        </div>
                      )}
                      {shows.map(show => (
                        <div key={show.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", marginBottom: "8px", overflow: "hidden" }}>
                          <button type="button" onClick={() => toggleShow(show.id)}
                            style={{ display: "flex", alignItems: "center", width: "100%", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", gap: "12px", textAlign: "left" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: show.status === "active" ? "#22c55e" : "#444", flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "var(--white)" }}>{show.dateLabel}</p>
                              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{show.timeLabel}</p>
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: show.status === "active" ? "rgba(34,197,94,0.1)" : "var(--surface2)", color: show.status === "active" ? "#22c55e" : "var(--muted)", border: `1px solid ${show.status === "active" ? "rgba(34,197,94,0.25)" : "var(--border)"}` }}>
                              {show.status === "active" ? "Active" : "Expired"}
                            </span>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: show.expanded ? "rotate(180deg)" : "none", flexShrink: 0 }}><path d="M7.5 9.75l4.5 4.5 4.5-4.5"/></svg>
                          </button>
                          {show.expanded && (
                            <div style={{ padding: "0 18px 14px", borderTop: "1px solid var(--border)" }}>
                              <p style={{ margin: "12px 0 8px", fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Ticket Sales This Show</p>
                              {show.tickets.length === 0
                                ? <p style={{ fontSize: "12px", color: "var(--muted2)", margin: 0 }}>No tickets assigned to this show</p>
                                : show.tickets.map((t, i) => <TicketRow key={t.id} ticket={t} isLast={i === show.tickets.length - 1} />)
                              }
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Overview tab ── */}
            {tab === "overview" && (
              <div>
                {loadingOverview ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
                    <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <>
                    {isLocked && (
                      <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "11px 16px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 600 }}>This event is published. Some fields may be restricted. Contact <strong>events.moderation@kasakai.in</strong> for structural changes.</span>
                      </div>
                    )}

                    {/* Event Name + Description */}
                    <OvSection title="Event Info">
                      <div style={{ marginBottom: "14px" }}>
                        <OvLabel>Event Name</OvLabel>
                        <input value={eventName} onChange={e => setEventName(e.target.value)} disabled={isLocked}
                          style={{ ...inp, opacity: isLocked ? 0.55 : 1, cursor: isLocked ? "not-allowed" : "text" }} />
                      </div>
                      <div>
                        <OvLabel required>Event Description</OvLabel>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={7} disabled={isLocked}
                          style={{ ...inp, resize: "vertical", lineHeight: 1.7, opacity: isLocked ? 0.55 : 1, cursor: isLocked ? "not-allowed" : "text" } as React.CSSProperties} />
                        <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--muted2)" }}>{description.length} characters</p>
                      </div>
                    </OvSection>

                    {/* Event Type */}
                    <OvSection title="Event Type">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "14px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <OvLabel required>Category</OvLabel>
                            <span style={{ fontSize: "11px", color: "var(--muted2)" }}>Upto 2</span>
                          </div>
                          <MultiSelect options={CATEGORIES} value={categories} onChange={setCategories} max={2} disabled={isLocked} />
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <OvLabel>Sub-Category</OvLabel>
                            <span style={{ fontSize: "11px", color: "var(--muted2)" }}>Upto 2</span>
                          </div>
                          <MultiSelect options={availableSubCats.length ? availableSubCats : ["Select a category first"]} value={subCategories} onChange={setSubCats} max={2} disabled={isLocked || availableSubCats.length === 0} />
                        </div>
                      </div>
                    </OvSection>

                    {/* Venue */}
                    <OvSection title="Set Up Venue">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                        <div>
                          <OvLabel required>Venue Name</OvLabel>
                          <input value={venueLocation} onChange={e => setVenueLoc(e.target.value)}
                            style={{ ...inp }} placeholder="e.g. The Local Cafe" />
                        </div>
                        <div>
                          <OvLabel required>City / Area</OvLabel>
                          <input value={venueCity} onChange={e => setVenueCity(e.target.value)}
                            style={{ ...inp }} placeholder="e.g. Koramangala, Bangalore" />
                        </div>
                      </div>
                      <div style={{ marginBottom: "14px" }}>
                        <OvLabel required>Hosting at your restaurant?</OvLabel>
                        <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
                          {(["yes","no"] as const).map(v => (
                            <label key={v} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.55 : 1 }}>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${ownRestaurant === v ? "#5be6b2" : "var(--border)"}`, background: ownRestaurant === v ? "#5be6b2" : "none", flexShrink: 0, cursor: "pointer" }}
                                onClick={() => !isLocked && setOwnRest(v)} />
                              <span style={{ fontSize: "13px", color: "var(--muted)", textTransform: "capitalize" }}>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: "14px" }}>
                        <OvLabel>Google Maps URL</OvLabel>
                        <input type="url" placeholder="https://maps.google.com/?q=..." value={locationUrl} onChange={e => setLocationUrl(e.target.value)}
                          style={{ ...inp }} />
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted2)" }}>Customers tap this to navigate to the venue</p>
                      </div>
                      <div>
                        <OvLabel>Instagram Link</OvLabel>
                        <input type="url" placeholder="https://instagram.com/yourvenue" value={instagramLink} onChange={e => setIgLink(e.target.value)} disabled={isLocked}
                          style={{ ...inp, opacity: isLocked ? 0.55 : 1 }} />
                      </div>
                    </OvSection>

                    {/* Event Card Images */}
                    <OvSection title="Event Card Images">
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <ImageUploadBox
                          label="Landscape for Website" ratio="16:9 · 1600×900px" maxSize="1.5MB"
                          existingUrl={imgUrl} disabled={isLocked}
                          onUpload={url => setImgUrl(url)}
                        />
                        <ImageUploadBox
                          label="Portrait for App" ratio="3:4 · 900×1200px" maxSize="1.5MB"
                          existingUrl={posterUrl} disabled={isLocked}
                          onUpload={url => setPosterUrl(url)}
                        />
                      </div>
                    </OvSection>

                    {/* Event Guide */}
                    <OvSection title="Event Guide">
                      <div style={{ marginBottom: "12px" }}>
                        <GuideRow label="Language(s)">
                          <MultiSelect options={LANGUAGES} value={language} onChange={setLanguage} disabled={isLocked} />
                        </GuideRow>
                        <GuideRow label="Minimum age for entry">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <OvSelect value={minAge} onChange={setMinAge} options={AGE_OPTS} disabled={isLocked} />
                            <span style={{ fontSize: "12px", color: "var(--muted)", whiteSpace: "nowrap" }}>&amp; above</span>
                          </div>
                        </GuideRow>
                        <GuideRow label="Age for paid entry">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <OvSelect value={ticketAge} onChange={setTicketAge} options={AGE_OPTS} disabled={isLocked} />
                            <span style={{ fontSize: "12px", color: "var(--muted)", whiteSpace: "nowrap" }}>&amp; above</span>
                          </div>
                        </GuideRow>
                        <GuideRow label="Indoor or Outdoor?">
                          <OvSelect value={venueType} onChange={setVenueType} options={["Indoor","Outdoor"]} disabled={isLocked} />
                        </GuideRow>
                        <GuideRow label="Seated or Standing?">
                          <OvSelect value={seating} onChange={setSeating} options={["Seated","Standing","Seated & Standing"]} disabled={isLocked} />
                        </GuideRow>
                        <GuideRow label="Kid-friendly?">
                          <OvSelect value={kidFriendly} onChange={setKidFriendly} options={["Yes","No"]} disabled={isLocked} />
                        </GuideRow>
                        <GuideRow label="Pet-friendly?">
                          <OvSelect value={petFriendly} onChange={setPetFriendly} options={["Yes","No"]} disabled={isLocked} />
                        </GuideRow>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "center", padding: "12px 0" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>Gates open before start?<span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span></span>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <button type="button" onClick={() => !isLocked && setGatesOpen(p => !p)}
                              style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: isLocked ? "not-allowed" : "pointer", padding: 0, opacity: isLocked ? 0.5 : 1 }}>
                              <div style={{ width: 40, height: 22, borderRadius: "999px", background: gatesOpen ? "#5be6b2" : "var(--surface2)", border: `1.5px solid ${gatesOpen ? "#5be6b2" : "var(--border)"}`, position: "relative", transition: "background 0.2s" }}>
                                <div style={{ position: "absolute", top: "2px", left: gatesOpen ? "20px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: gatesOpen ? "#000" : "var(--muted)", transition: "left 0.2s" }} />
                              </div>
                              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>{gatesOpen ? "Yes" : "No"}</span>
                            </button>
                            {gatesOpen && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <input type="number" min="5" max="120" value={gatesOpenMinutes}
                                  onChange={e => setGatesOpenMinutes(Number(e.target.value))}
                                  disabled={isLocked}
                                  style={{ ...inp, width: "64px", padding: "4px 8px", fontSize: "13px" }} />
                                <span style={{ fontSize: "12px", color: "var(--muted)" }}>min</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </OvSection>

                    {/* Add More Sections */}
                    <div style={{ background: "rgba(91,230,178,0.03)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "14px" }}>
                      <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 800, color: "var(--white)" }}>Add More Sections</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {["Event Instructions","Youtube Video","Prohibited Items","FAQs"].map(sec => {
                          const active = extraSections.includes(sec);
                          return (
                            <button key={sec} type="button" onClick={() => toggleExtra(sec)}
                              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 14px", background: active ? "rgba(91,230,178,0.1)" : "var(--surface)", border: `1px solid ${active ? "rgba(91,230,178,0.35)" : "var(--border)"}`, borderRadius: "8px", color: active ? "#5be6b2" : "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                              {active
                                ? <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                                : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                              }
                              {sec}
                            </button>
                          );
                        })}
                      </div>
                      {extraSections.map(sec => (
                        <div key={sec} style={{ marginTop: "14px" }}>
                          <OvLabel>{sec}</OvLabel>
                          <textarea rows={3} placeholder={`Enter ${sec.toLowerCase()}…`} value={extraContent[sec] || ""}
                            onChange={e => setExtraContent(p => ({ ...p, [sec]: e.target.value }))}
                            style={{ ...inp, resize: "vertical" } as React.CSSProperties} />
                        </div>
                      ))}
                    </div>

                    {/* Point of Contact */}
                    <OvSection title="Point of Contact">
                      <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--muted)" }}>Add POCs with whom event feedback will be shared</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "14px" }}>
                        {pocs.map((poc) => (
                          <div key={poc.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "10px", alignItems: "center" }}>
                            <input value={poc.name}  onChange={e => updatePoc(poc.id, "name",  e.target.value)} placeholder="Name"  style={inp} />
                            <input value={poc.email} onChange={e => updatePoc(poc.id, "email", e.target.value)} placeholder="Email" type="email" style={inp} />
                            <input value={poc.phone} onChange={e => updatePoc(poc.id, "phone", e.target.value)} placeholder="Phone" type="tel"   style={inp} />
                            {pocs.length > 1 && (
                              <button type="button" onClick={() => removePoc(poc.id)}
                                style={{ width: 32, height: 32, borderRadius: "7px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addPoc}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.25)", borderRadius: "8px", color: "#5be6b2", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        Add POC
                      </button>
                    </OvSection>

                    {/* Show organiser toggle */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>Show organiser details to customers</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>If ON, name, email &amp; phone will be visible on the event page</p>
                      </div>
                      <button type="button" onClick={() => setShowOrganiser(p => !p)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                        <div style={{ width: 40, height: 22, borderRadius: "999px", background: showOrganiser ? "#5be6b2" : "var(--surface2)", border: `1.5px solid ${showOrganiser ? "#5be6b2" : "var(--border)"}`, position: "relative", transition: "background 0.2s" }}>
                          <div style={{ position: "absolute", top: "2px", left: showOrganiser ? "20px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: showOrganiser ? "#000" : "var(--muted)", transition: "left 0.2s" }} />
                        </div>
                      </button>
                    </div>

                    {/* Send copy toggle */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>Send a copy of every sale to organiser</p>
                      <button type="button" onClick={() => setSendCopies(p => !p)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <div style={{ width: 40, height: 22, borderRadius: "999px", background: sendCopies ? "#5be6b2" : "var(--surface2)", border: `1.5px solid ${sendCopies ? "#5be6b2" : "var(--border)"}`, position: "relative", transition: "background 0.2s" }}>
                          <div style={{ position: "absolute", top: "2px", left: sendCopies ? "20px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: sendCopies ? "#000" : "var(--muted)", transition: "left 0.2s" }} />
                        </div>
                      </button>
                    </div>

                    {/* Save button */}
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px" }}>
                      <button type="button" onClick={handleSaveOverview} disabled={saving}
                        style={{ padding: "12px 40px", background: saving ? "rgba(91,230,178,0.4)" : "#5be6b2", border: "none", borderRadius: "10px", color: "#000", fontSize: "14px", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 0 24px rgba(91,230,178,0.22)", letterSpacing: "0.04em" }}
                        onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#79eebc"; }}
                        onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#5be6b2"; }}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                      {saveMsg && (
                        <span style={{ fontSize: "13px", fontWeight: 600, color: saveMsg === "Saved" ? "#5be6b2" : "#ef4444" }}>
                          {saveMsg}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT sidebar ── */}
          <div className={styles.scrManageSidebar}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ height: "120px", overflow: "hidden", position: "relative" }}>
                {imgUrl || ev.image ? (
                  <img src={imgUrl || ev.image} alt={ev.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "var(--surface2)" }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(18,26,31,0.9), transparent)" }} />
                <span style={{ position: "absolute", bottom: "10px", left: "12px", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
              </div>
              <div style={{ padding: "14px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "var(--white)", lineHeight: 1.4 }}>{ev.title}</p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1, background: "var(--bg)", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: 800, color: "var(--white)" }}>{liveSold}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>Sold</p>
                  </div>
                  <div style={{ flex: 1, background: "var(--bg)", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <p style={{ margin: "0 0 2px", fontSize: "18px", fontWeight: 800, color: "var(--white)" }}>{liveCapacity - liveSold}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>Left</p>
                  </div>
                </div>
              </div>
            </div>

            <SideCard title="Organiser Tools" accent="#5be6b2">
              <SideRow label="Generate OneLink" sub="Share booking link" accent="#5be6b2"
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>} />
              <SideRow label="Add Attendees" sub="Manual entry" accent="#5be6b2"
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
              <SideRow label="Send Communication" accent="#5be6b2"
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.92a16 16 0 006.29 6.29l1.28-1.29a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>} />
              <SideRow label="Manage Discounts" accent="#5be6b2"
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>} />
            </SideCard>

            <SideCard title="Analytics" accent="#a78bfa">
              <SideRow label="View Insights" accent="#a78bfa"
                onClick={() => router.push(`/dashboard/streaming/${ev.id}/analytics`)}
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>} />
              <SideRow label="Attendees" sub="View ticket holders" accent="#a78bfa"
                onClick={() => router.push(`/dashboard/streaming/${ev.id}/attendees`)}
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
              <SideRow label="Door Scan" sub="Scan entry codes" accent="#a78bfa"
                onClick={() => router.push(`/dashboard/streaming/${ev.id}/scan`)}
                icon={<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M17 17h3M17 14h3"/></svg>} />
            </SideCard>
          </div>
        </div>
      </div>

      <AddShowDrawer open={drawerOpen} onClose={closeDrawer} onSave={handleSaveShow} />
      <AddTicketDrawer open={ticketDrawerOpen} onClose={closeTicketDrawer} onSave={handleSaveTicket} shows={fullShows} />
      <EditTicketDrawer open={editingTier !== null} onClose={closeEditDrawer} tier={editingTier} shows={fullShows} onSave={handleEditSave} onSaveShows={handleUpdateShows} />
      <EditVenueDrawer open={venueDrawerOpen} onClose={() => setVenueDrawerOpen(false)}
        initialName={venueLocation} initialCity={venueCity} initialMapUrl={locationUrl}
        onSave={handleSaveVenue} />

      {/* Success toast */}
      {tierSaveToast && (
        <div style={{ position: "fixed", bottom: "32px", left: "50%", transform: "translateX(-50%)", zIndex: 9999, pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 24px", background: "rgba(10,10,10,0.92)", border: "1.5px solid rgba(91,230,178,0.45)", borderRadius: "14px", boxShadow: "0 8px 40px rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", whiteSpace: "nowrap" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(91,230,178,0.15)", border: "1.5px solid rgba(91,230,178,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>{tierSaveToast}</span>
          </div>
        </div>
      )}
    </>
  );
}
