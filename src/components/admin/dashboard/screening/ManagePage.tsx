"use client";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SCR_MANAGE_LAYOUT, SCR_MANAGE_SIDEBAR, SCR_MANAGE_TAB, SCR_MANAGE_TAB_ACTIVE, SCR_MANAGE_TAB_BAR } from "../ui";
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
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      {accent && <div className="h-[3px]" style={{ background: accent }} />}
      <div className="p-4">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{title}</p>
        {children}
      </div>
    </div>
  );
}

function SideRow({ label, sub, icon, accent, onClick }: { label: string; sub?: string; icon?: React.ReactNode; accent?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-[10px] border-b border-border bg-transparent py-[9px] text-left transition-[opacity] duration-150"
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      {icon && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]" style={{ background: accent ? `${accent}15` : "var(--surface2)" }}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-body">{label}</div>
        {sub && <div className="mt-px text-[11px] text-muted">{sub}</div>}
      </div>
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--muted2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function TicketRow({ ticket, isLast }: { ticket: ScrShowTicket; isLast: boolean }) {
  const fillPct   = Math.min(100, Math.round((ticket.sold / Math.max(1, ticket.qty)) * 100));
  const fillColor = fillPct >= 90 ? "#ef4444" : fillPct >= 60 ? "#f59e0b" : "#5be6b2";
  return (
    <div className={`py-[10px] ${isLast ? "" : "border-b border-border"}`}>
      <div className="mb-[6px] flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-fg">{ticket.name}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] font-bold text-accent">₹{Math.round(ticket.pricePaise / 100)}</span>
          <span className="text-[11px] text-muted">{ticket.sold}/{ticket.qty} sold</span>
        </div>
      </div>
      <div className="h-[3px] rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fillPct}%`, background: fillColor }} />
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
    <div className="mb-2 rounded-xl border border-border bg-surface px-4 py-[14px]">
      <div className="mb-[10px] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-[3px] flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-fg">{tier.name}</span>
            {tier.isDisabled && (
              <span className="rounded-full border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.1)] px-[7px] py-[2px] text-[10px] font-bold text-warning">DISABLED</span>
            )}
            {tier.salesEndDate && (
              <span className="rounded-full border border-border bg-[#0b1114] px-[7px] py-[2px] text-[10px] font-semibold text-muted">
                Ends {new Date(tier.salesEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          <p className="m-0 text-[12px] text-muted">
            <span className="font-bold text-accent">₹{Math.round(tier.pricePaise / 100)}</span>
            {" · "}
            <span>{tier.sold}/{tier.capacity} sold</span>
            {tier.showIds && tier.showIds.length > 0 && (
              <span className="ml-[6px] text-muted-2">· {tier.showIds.length} show{tier.showIds.length !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        {!confirmDelete && (
          <div className="flex shrink-0 gap-[6px]">
            <button type="button" onClick={onEdit} title="Edit ticket"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[rgba(91,230,178,0.2)] bg-[rgba(91,230,178,0.08)]"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(91,230,178,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(91,230,178,0.08)")}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" title={canDelete ? "Delete ticket" : `${tier.sold} sold — cannot delete`}
              onClick={() => canDelete && setConfirmDelete(true)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${canDelete ? "cursor-pointer border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] opacity-100" : "cursor-not-allowed border-border bg-[#0b1114] opacity-35"}`}
              onMouseEnter={e => canDelete && (e.currentTarget.style.background = "rgba(239,68,68,0.18)")}
              onMouseLeave={e => { if (canDelete) e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        )}
        {confirmDelete && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[12px] font-semibold text-danger">Delete?</span>
            <button type="button" onClick={() => { setConfirmDelete(false); onDelete(); }}
              className="cursor-pointer rounded-[7px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.15)] px-3 py-[5px] text-[12px] font-bold text-danger">Yes</button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="cursor-pointer rounded-[7px] border border-border bg-[#0b1114] px-3 py-[5px] text-[12px] font-bold text-muted">Cancel</button>
          </div>
        )}
      </div>
      <div className="h-[4px] rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fillPct}%`, background: fillColor }} />
      </div>
    </div>
  );
}

// ── Overview form helpers ─────────────────────────────────────────────────────

function OvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-[14px] rounded-xl border border-border bg-surface p-5">
      <p className="mb-1 text-[15px] font-extrabold text-fg">{title}</p>
      <div className="mx-0 mb-4 mt-3 h-px bg-border" />
      {children}
    </div>
  );
}

function OvLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-[6px] block text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
      {children}{required && <span className="ml-[3px] text-danger">*</span>}
    </label>
  );
}

function OvSelect({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className={`${inp} appearance-none ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function GuideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-4 border-b border-border py-3">
      <span className="text-[13px] font-semibold text-muted">{label}<span className="ml-[3px] text-danger">*</span></span>
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
    <div ref={ref} className="relative">
      <div onClick={() => !disabled && setOpen(p => !p)}
        className={`${inp} flex min-h-[42px] flex-wrap items-center gap-[6px] ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}>
        {value.length === 0
          ? <span className="text-[13px] text-muted">Select…</span>
          : value.map(v => (
              <span key={v} className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(91,230,178,0.3)] bg-[rgba(91,230,178,0.1)] px-[10px] py-[3px] text-[12px] font-semibold text-accent">
                {v}
                {!disabled && (
                  <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }}
                    className="flex cursor-pointer border-none bg-transparent p-0 leading-none text-accent">
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </span>
            ))}
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className={`ml-auto shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[220px] overflow-y-auto rounded-[10px] border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {options.map(opt => {
            const selected = value.includes(opt);
            const capped   = !selected && !!max && value.length >= max;
            return (
              <div key={opt} onClick={() => !capped && toggle(opt)}
                className={`flex items-center gap-[10px] px-[14px] py-[9px] ${capped ? "cursor-not-allowed opacity-40" : "cursor-pointer opacity-100"} ${selected ? "bg-[rgba(91,230,178,0.07)]" : "bg-transparent"}`}
                onMouseEnter={(e) => { if (!selected && !capped) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = selected ? "rgba(91,230,178,0.07)" : "none"; }}>
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${selected ? "border-[#5be6b2] bg-accent" : "border-border bg-transparent"}`}>
                  {selected && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span className={`text-[13px] ${selected ? "font-semibold text-accent" : "font-normal text-fg"}`}>{opt}</span>
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
    <div className="rounded-xl border border-border bg-[#0b1114] p-[14px]">
      <div className="mb-[10px] flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mb-[2px] text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</p>
          <p className="m-0 text-[12px] text-muted-2">{ratio}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="m-0 text-[11px] text-muted-2">Max {maxSize}</p>
          {preview && (
            <img src={preview} alt="preview" className="h-[44px] w-auto rounded-md border border-border object-cover" />
          )}
          <button type="button" onClick={() => !disabled && !uploading && fileRef.current?.click()}
            className={`rounded-[7px] border border-border bg-transparent px-[14px] py-[6px] text-[12px] font-semibold ${(disabled || uploading) ? "cursor-not-allowed text-muted-2" : "cursor-pointer text-muted"}`}>
            {uploading ? "Uploading…" : preview ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
      {uploadErr && <p className="mb-2 text-[11px] text-danger">{uploadErr}</p>}
      {!preview && !disabled && (
        <div onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-border p-5 text-center"
          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(91,230,178,0.4)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-[6px] block"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="text-[12px] text-muted">Click to upload</span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
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

  const fe = (k: string) => `${inp} mt-[6px] ${errors[k] ? "border-[rgba(239,68,68,0.6)]!" : ""}`;

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-[rgba(0,0,0,0.55)] transition-opacity duration-[250ms] ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} />
      <div className={`fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col border-l border-border bg-surface shadow-[-6px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-[280ms] ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div>
            <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">Shows</p>
            <h3 className="m-0 text-[17px] font-extrabold text-fg">Add New Show</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-[#0b1114]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-[22px]">
          <p className="mb-5 text-[12px] leading-[1.6] text-muted">
            Adding a new show date makes this event available to book again. Ticket tiers are shared across all shows and can be edited in the Tickets section.
          </p>
          <div className="mb-[18px]">
            <OvLabel required>Show Date</OvLabel>
            <input ref={firstRef} type="date" value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: "" })); }} className={fe("date")} />
            {errors.date && <p className="mt-1 text-[11px] text-danger">{errors.date}</p>}
          </div>
          <div className="grid grid-cols-2 gap-[14px]">
            <div>
              <OvLabel required>Start Time</OvLabel>
              <input type="time" value={startTime} onChange={e => { setStart(e.target.value); setErrors(p => ({ ...p, startTime: "" })); }} className={fe("startTime")} />
              {errors.startTime && <p className="mt-1 text-[11px] text-danger">{errors.startTime}</p>}
            </div>
            <div>
              <OvLabel required>End Time</OvLabel>
              <input type="time" value={endTime} onChange={e => { setEnd(e.target.value); setErrors(p => ({ ...p, endTime: "" })); }} className={fe("endTime")} />
              {errors.endTime && <p className="mt-1 text-[11px] text-danger">{errors.endTime}</p>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-[10px] border-t border-border px-[22px] py-4">
          <button type="button" onClick={onClose} className="h-[42px] flex-1 cursor-pointer rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">Cancel</button>
          <button type="button" onClick={handleSave} className="h-[42px] flex-[2] cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.45)] bg-[rgba(91,230,178,0.12)] text-[13px] font-extrabold text-accent">Save Show</button>
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
      className={`flex w-full items-center gap-[14px] rounded-[11px] border-[1.5px] px-4 py-[14px] text-left transition-all duration-150 ${selected ? "border-[rgba(91,230,178,0.35)] bg-[rgba(91,230,178,0.06)]" : "border-border bg-[#0b1114]"} ${comingSoon ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100"}`}>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${selected ? "border-[#5be6b2] bg-[rgba(91,230,178,0.15)]" : "border-border bg-surface-2"}`}>
        {selected && <div className="h-2 w-2 rounded-full bg-accent" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="m-0 text-[13px] font-bold text-fg">{title}</p>
          {comingSoon && (
            <span className="rounded-full bg-surface-2 px-[7px] py-[2px] text-[10px] font-bold tracking-[0.06em] text-muted">SOON</span>
          )}
        </div>
        <p className="mt-[2px] text-[12px] text-muted">{sub}</p>
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
    <div className="flex items-center gap-[6px]">
      <div className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200 ${done || active ? "border-[#5be6b2] bg-[rgba(91,230,178,0.15)]" : "border-border bg-[#0b1114]"}`}>
        {done ? (
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
        ) : (
          <span className={`text-[10px] font-black ${active ? "text-accent" : "text-muted-2"}`}>{n}</span>
        )}
      </div>
      <span className={`text-[11px] font-bold transition-[color] duration-200 ${done || active ? "text-accent" : "text-muted-2"}`}>
        {n === 1 ? "Details" : "Availability"}
      </span>
    </div>
  );
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className={`flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-none p-[2px] transition-all duration-200 ${on ? "bg-[rgba(91,230,178,0.3)] [outline:1.5px_solid_#5be6b2]" : "bg-[#0b1114] [outline:1.5px_solid_#24313b]"}`}>
      <div className={`h-[14px] w-[14px] rounded-full transition-[transform,background] duration-200 ${on ? "translate-x-4 bg-accent" : "translate-x-0 bg-muted-2"}`} />
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

  const fe = (k: string) => `${inp} mt-[6px] ${errors[k] ? "border-[rgba(239,68,68,0.6)]!" : ""}`;

  const formatShow = (s: ApiScrShow) => {
    const d = new Date(s.date);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const time = s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime;
    return { label, time };
  };

  return (
    <>
      <div onClick={() => { if (!saving) onClose(); }}
        className={`fixed inset-0 z-40 bg-[rgba(0,0,0,0.55)] transition-opacity duration-[250ms] ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} />
      <div className={`fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col border-l border-border bg-surface shadow-[-6px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-[280ms] ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>

        {/* Header */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between px-[22px] pt-[18px] pb-[14px]">
            <div>
              <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">
                {step === 1 ? "Ticket Details" : "Availability Settings"}
              </p>
              <h3 className="m-0 text-[17px] font-extrabold text-fg">Add Ticket</h3>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-[#0b1114]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 px-[22px] pb-[14px]">
            <StepDot n={1} active={step === 1} done={step === 2} />
            <div className={`h-px flex-1 transition-[background] duration-300 ${step === 2 ? "bg-[rgba(91,230,178,0.3)]" : "bg-border"}`} />
            <StepDot n={2} active={step === 2} done={false} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[22px]">

          {step === 1 ? (
            <>
              {/* Name */}
              <div>
                <OvLabel required>Ticket Name</OvLabel>
                <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="e.g. Regular, VIP, Early Bird" className={fe("name")} />
                {errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <OvLabel>Description</OvLabel>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's included — e.g. Free snack + drink, Front row seating" rows={3}
                  className={`${inp} mt-[6px] min-h-[80px] resize-y`} />
              </div>

              {/* Price + Qty side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <OvLabel required>Price (₹)</OvLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-[13px] font-bold text-muted">₹</span>
                    <input type="number" min="0" step="1" value={priceRs}
                      onChange={e => { setPriceRs(e.target.value); setErrors(p => ({ ...p, price: "" })); }}
                      placeholder="0" className={`${fe("price")} pl-[26px]`} />
                  </div>
                  {errors.price && <p className="mt-1 text-[11px] text-danger">{errors.price}</p>}
                </div>
                <div>
                  <OvLabel required>Total Slots</OvLabel>
                  <input type="number" min="1" value={quantity}
                    onChange={e => { setQuantity(e.target.value); setErrors(p => ({ ...p, quantity: "" })); }}
                    placeholder="e.g. 100" className={fe("quantity")} />
                  {errors.quantity && <p className="mt-1 text-[11px] text-danger">{errors.quantity}</p>}
                </div>
              </div>

              <div className="rounded-[10px] border border-[rgba(91,230,178,0.12)] bg-[rgba(91,230,178,0.04)] px-[14px] py-3">
                <p className="m-0 text-[11px] leading-[1.6] text-muted-2">
                  Set price to <strong className="text-fg">0</strong> for a free ticket. Tax is not added separately — enter the final amount customers will pay.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Show slot assignment */}
              <div>
                <p className="mb-[10px] text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">Which Shows</p>
                <div className="flex flex-col gap-[6px]">
                  {(["all", "specific"] as const).map(scope => (
                    <button key={scope} type="button" onClick={() => setShowScope(scope)}
                      className={`flex cursor-pointer items-center gap-[10px] rounded-[9px] border-[1.5px] px-[14px] py-[11px] text-left transition-all duration-150 ${showScope === scope ? "border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.06)]" : "border-border bg-[#0b1114]"}`}>
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${showScope === scope ? "border-[#5be6b2]" : "border-border"}`}>
                        {showScope === scope && <div className="h-[7px] w-[7px] rounded-full bg-accent" />}
                      </div>
                      <div>
                        <p className={`m-0 text-[13px] font-bold ${showScope === scope ? "text-fg" : "text-muted"}`}>
                          {scope === "all" ? "All shows" : "Specific shows"}
                        </p>
                        <p className="mt-px text-[11px] text-muted-2">
                          {scope === "all" ? "Ticket valid for every show date" : "Choose which show dates this ticket covers"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {showScope === "specific" && (
                  <div className="mt-[10px] flex flex-col gap-[6px]">
                    {shows.length === 0 ? (
                      <div className="rounded-[9px] border border-border bg-[#0b1114] p-[14px] text-center text-[12px] text-muted-2">
                        No shows added yet — add shows first then come back
                      </div>
                    ) : shows.map(s => {
                      const { label, time } = formatShow(s);
                      const checked = selectedShowIds.has(s._id);
                      return (
                        <button key={s._id} type="button" onClick={() => toggleShowId(s._id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-[9px] border-[1.5px] px-[14px] py-[11px] text-left transition-all duration-150 ${checked ? "border-[rgba(91,230,178,0.35)] bg-[rgba(91,230,178,0.05)]" : "border-border bg-[#0b1114]"}`}>
                          <div className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all duration-150 ${checked ? "border-[#5be6b2] bg-[rgba(91,230,178,0.12)]" : "border-border bg-transparent"}`}>
                            {checked && <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`m-0 text-[12px] font-bold ${checked ? "text-fg" : "text-muted"}`}>{label}</p>
                            <p className="mt-px text-[11px] text-muted-2">{time}</p>
                          </div>
                          {s.status !== "active" && (
                            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.1em] text-danger">{s.status}</span>
                          )}
                        </button>
                      );
                    })}
                    {showScope === "specific" && selectedShowIds.size > 0 && (
                      <p className="mt-[2px] text-[11px] font-bold text-accent">
                        {selectedShowIds.size} show{selectedShowIds.size > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Sales cutoff */}
              <div className="rounded-[10px] border border-border bg-[#0b1114] px-4 py-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-body">Sales End Date</p>
                    <p className="mt-[2px] text-[11px] text-muted-2">Stop selling after a specific date & time</p>
                  </div>
                  <ToggleSwitch on={hasSalesEnd} onChange={setHasSalesEnd} />
                </div>
                {hasSalesEnd && (
                  <div className="mt-3">
                    <input type="datetime-local" value={salesEndDate} onChange={e => setSalesEndDate(e.target.value)}
                      className={`${inp} mt-0 [color-scheme:dark]`} />
                    <p className="mt-[5px] text-[11px] text-muted-2">Customers cannot buy after this moment</p>
                  </div>
                )}
              </div>

              {/* Disable ticket */}
              <div className="rounded-[10px] border border-border bg-[#0b1114] px-4 py-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-body">Disable Ticket</p>
                    <p className="mt-[2px] text-[11px] text-muted-2">
                      {isDisabled ? "Hidden from customers — enable later from ticket settings" : "Visible to customers immediately after saving"}
                    </p>
                  </div>
                  <ToggleSwitch on={isDisabled} onChange={setIsDisabled} />
                </div>
                {isDisabled && (
                  <div className="mt-[10px] flex items-center gap-[7px] rounded-[7px] border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-[10px] py-2">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    <p className="m-0 text-[11px] font-semibold text-danger">Ticket will be saved as disabled — not visible on the event page</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0">
          <div className="flex gap-[10px] border-t border-border px-[22px] py-4">
            {step === 1 ? (
              <>
                <button type="button" onClick={onClose} disabled={saving}
                  className="h-[42px] flex-1 cursor-pointer rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">
                  Cancel
                </button>
                <button type="button" onClick={handleNext}
                  className="flex h-[42px] flex-[2] cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.45)] bg-[rgba(91,230,178,0.12)] text-[13px] font-extrabold text-accent">
                  Next
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} disabled={saving}
                  className="flex h-[42px] flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Back
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.45)] text-[13px] font-extrabold text-accent ${saving ? "cursor-default bg-[rgba(91,230,178,0.06)] opacity-70" : "cursor-pointer bg-[rgba(91,230,178,0.12)] opacity-100"}`}>
                  {saving ? "Saving…" : "Add Ticket"}
                  {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div className="px-[22px] pb-[14px]">
              <p className="m-0 rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-3 py-[9px] text-[12px] font-semibold text-danger">{saveError}</p>
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

  const fe = (k: string) => `${inp} mt-[6px] ${errors[k] ? "border-[rgba(239,68,68,0.6)]!" : ""}`;

  const formatShow = (s: ApiScrShow) => {
    const d = new Date(s.date);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const time = s.endTime ? `${s.startTime} – ${s.endTime}` : s.startTime;
    return { label, time };
  };

  return (
    <>
      <div onClick={() => { if (!saving) onClose(); }}
        className={`fixed inset-0 z-40 bg-[rgba(0,0,0,0.55)] transition-opacity duration-[250ms] ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} />
      <div className={`fixed inset-y-0 left-0 z-50 flex w-[min(520px,100vw)] flex-col border-r border-border bg-surface shadow-[6px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-[280ms] ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}>

        {/* Header */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between px-[22px] pt-[18px] pb-[14px]">
            <div>
              <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#c8f135]">
                {step === 1 ? "Edit Details" : "Availability Settings"}
              </p>
              <h3 className="m-0 text-[17px] font-extrabold text-fg">Edit Ticket</h3>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-[#0b1114]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 px-[22px] pb-[14px]">
            <StepDot n={1} active={step === 1} done={step === 2} />
            <div className={`h-px flex-1 transition-[background] duration-300 ${step === 2 ? "bg-[rgba(200,241,53,0.3)]" : "bg-border"}`} />
            <StepDot n={2} active={step === 2} done={false} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[22px]">
          {step === 1 ? (
            <>
              <div>
                <OvLabel required>Ticket Name</OvLabel>
                <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="e.g. Regular, VIP, Early Bird" className={fe("name")} />
                {errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
              </div>
              <div>
                <OvLabel>Description</OvLabel>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's included — e.g. Free snack + drink, Front row seating" rows={3}
                  className={`${inp} mt-[6px] min-h-[80px] resize-y`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <OvLabel required>Price (₹)</OvLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-[13px] font-bold text-muted">₹</span>
                    <input type="number" min="0" step="1" value={priceRs}
                      onChange={e => { setPriceRs(e.target.value); setErrors(p => ({ ...p, price: "" })); }}
                      placeholder="0" className={`${fe("price")} pl-[26px]`} />
                  </div>
                  {errors.price && <p className="mt-1 text-[11px] text-danger">{errors.price}</p>}
                </div>
                <div>
                  <OvLabel required>Total Slots</OvLabel>
                  <input type="number" min={minCapacity || 1} value={quantity}
                    onChange={e => { setQuantity(e.target.value); setErrors(p => ({ ...p, quantity: "" })); }}
                    placeholder="e.g. 100" className={fe("quantity")} />
                  {errors.quantity
                    ? <p className="mt-1 text-[11px] text-danger">{errors.quantity}</p>
                    : minCapacity > 0 && <p className="mt-1 text-[11px] text-muted-2">Min {minCapacity} ({minCapacity} already sold)</p>
                  }
                </div>
              </div>
              <div className="rounded-[10px] border border-[rgba(200,241,53,0.12)] bg-[rgba(200,241,53,0.04)] px-[14px] py-3">
                <p className="m-0 text-[11px] leading-[1.6] text-muted-2">
                  Price changes apply to future purchases only — existing tickets keep the price they were bought at.
                  {minCapacity > 0 && <> Capacity can&apos;t go below <strong className="text-fg">{minCapacity}</strong> (already sold).</>}
                </p>
              </div>

              {/* Show time editing */}
              {shows.length > 0 && (
                <div>
                  <div className="mb-[10px]">
                    <p className="mb-[2px] text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">Show Times</p>
                    <p className="m-0 text-[11px] text-muted-2">Update date &amp; time for each show</p>
                  </div>
                  {shows.map(s => {
                    const d = new Date(s.date);
                    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    const edit = showEdits[s._id] || { date: "", startTime: "", endTime: "" };
                    return (
                      <div key={s._id} className="mb-2 rounded-[10px] border border-border bg-[#0b1114] p-[14px]">
                        <p className="mb-[10px] text-[12px] font-bold text-fg">{label}</p>
                        <div>
                          <OvLabel required>Date</OvLabel>
                          <input type="date" value={edit.date}
                            onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], date: e.target.value } }))}
                            className={`${inp} mt-[6px]`} />
                        </div>
                        <div className="mt-[10px] grid grid-cols-2 gap-[10px]">
                          <div>
                            <OvLabel required>Start Time</OvLabel>
                            <input type="time" value={edit.startTime}
                              onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], startTime: e.target.value } }))}
                              className={`${inp} mt-[6px]`} />
                          </div>
                          <div>
                            <OvLabel>End Time</OvLabel>
                            <input type="time" value={edit.endTime}
                              onChange={e => setShowEdits(p => ({ ...p, [s._id]: { ...p[s._id], endTime: e.target.value } }))}
                              className={`${inp} mt-[6px]`} />
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
                <p className="mb-[10px] text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">Which Shows</p>
                <div className="flex flex-col gap-[6px]">
                  {(["all", "specific"] as const).map(scope => (
                    <button key={scope} type="button" onClick={() => setShowScope(scope)}
                      className={`flex cursor-pointer items-center gap-[10px] rounded-[9px] border-[1.5px] px-[14px] py-[11px] text-left transition-all duration-150 ${showScope === scope ? "border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.06)]" : "border-border bg-[#0b1114]"}`}>
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${showScope === scope ? "border-[#5be6b2]" : "border-border"}`}>
                        {showScope === scope && <div className="h-[7px] w-[7px] rounded-full bg-accent" />}
                      </div>
                      <div>
                        <p className={`m-0 text-[13px] font-bold ${showScope === scope ? "text-fg" : "text-muted"}`}>
                          {scope === "all" ? "All shows" : "Specific shows"}
                        </p>
                        <p className="mt-px text-[11px] text-muted-2">
                          {scope === "all" ? "Ticket valid for every show date" : "Choose which show dates this ticket covers"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {showScope === "specific" && (
                  <div className="mt-[10px] flex flex-col gap-[6px]">
                    {shows.length === 0 ? (
                      <div className="rounded-[9px] border border-border bg-[#0b1114] p-[14px] text-center text-[12px] text-muted-2">
                        No shows added yet
                      </div>
                    ) : shows.map(s => {
                      const { label, time } = formatShow(s);
                      const checked = selectedShowIds.has(s._id);
                      return (
                        <button key={s._id} type="button" onClick={() => toggleShowId(s._id)}
                          className={`flex cursor-pointer items-center gap-3 rounded-[9px] border-[1.5px] px-[14px] py-[11px] text-left transition-all duration-150 ${checked ? "border-[rgba(91,230,178,0.35)] bg-[rgba(91,230,178,0.05)]" : "border-border bg-[#0b1114]"}`}>
                          <div className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border-2 ${checked ? "border-[#5be6b2] bg-[rgba(91,230,178,0.12)]" : "border-border bg-transparent"}`}>
                            {checked && <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`m-0 text-[12px] font-bold ${checked ? "text-fg" : "text-muted"}`}>{label}</p>
                            <p className="mt-px text-[11px] text-muted-2">{time}</p>
                          </div>
                          {s.status !== "active" && (
                            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.1em] text-danger">{s.status}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[10px] border border-border bg-[#0b1114] px-4 py-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-body">Sales End Date</p>
                    <p className="mt-[2px] text-[11px] text-muted-2">Stop selling after a specific date & time</p>
                  </div>
                  <ToggleSwitch on={hasSalesEnd} onChange={setHasSalesEnd} />
                </div>
                {hasSalesEnd && (
                  <div className="mt-3">
                    <input type="datetime-local" value={salesEndDate} onChange={e => setSalesEndDate(e.target.value)}
                      className={`${inp} mt-0 [color-scheme:dark]`} />
                    <p className="mt-[5px] text-[11px] text-muted-2">Customers cannot buy after this moment</p>
                  </div>
                )}
              </div>

              <div className="rounded-[10px] border border-border bg-[#0b1114] px-4 py-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-body">Disable Ticket</p>
                    <p className="mt-[2px] text-[11px] text-muted-2">
                      {isDisabled ? "Hidden from customers — enable to go live" : "Visible to customers immediately after saving"}
                    </p>
                  </div>
                  <ToggleSwitch on={isDisabled} onChange={setIsDisabled} />
                </div>
                {isDisabled && (
                  <div className="mt-[10px] flex items-center gap-[7px] rounded-[7px] border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-[10px] py-2">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    <p className="m-0 text-[11px] font-semibold text-danger">This ticket is hidden — customers cannot see or buy it</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0">
          <div className="flex gap-[10px] border-t border-border px-[22px] py-4">
            {step === 1 ? (
              <>
                <button type="button" onClick={onClose} disabled={saving}
                  className="h-[42px] flex-1 cursor-pointer rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">
                  Cancel
                </button>
                <button type="button" onClick={handleNext}
                  className="flex h-[42px] flex-[2] cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(200,241,53,0.45)] bg-[rgba(200,241,53,0.12)] text-[13px] font-extrabold text-[#c8f135]">
                  Next
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} disabled={saving}
                  className="flex h-[42px] flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Back
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(200,241,53,0.45)] text-[13px] font-extrabold text-[#c8f135] ${saving ? "cursor-default bg-[rgba(200,241,53,0.06)] opacity-70" : "cursor-pointer bg-[rgba(200,241,53,0.12)] opacity-100"}`}>
                  {saving ? "Saving…" : "Save Changes"}
                  {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div className="px-[22px] pb-[14px]">
              <p className="m-0 rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-3 py-[9px] text-[12px] font-semibold text-danger">{saveError}</p>
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
        className={`fixed inset-0 z-40 bg-[rgba(0,0,0,0.55)] transition-opacity duration-[250ms] ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} />
      <div className={`fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col border-l border-border bg-surface shadow-[-6px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-[280ms] ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div>
            <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">Venue</p>
            <h3 className="m-0 text-[17px] font-extrabold text-fg">Edit Venue</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-[#0b1114]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[22px]">
          <div>
            <OvLabel required>Venue Name</OvLabel>
            <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. The Local Cafe" className={`${inp} mt-[6px]`} />
          </div>
          <div>
            <OvLabel required>City / Area</OvLabel>
            <input value={city} onChange={e => setCity(e.target.value)}
              placeholder="e.g. Koramangala, Bangalore" className={`${inp} mt-[6px]`} />
          </div>
          <div>
            <OvLabel>Google Maps URL</OvLabel>
            <input type="url" value={mapUrl} onChange={e => setMapUrl(e.target.value)}
              placeholder="https://maps.google.com/?q=..." className={`${inp} mt-[6px]`} />
            <p className="mt-[5px] text-[11px] text-muted-2">Customers tap this to open the venue in Google Maps</p>
          </div>
          <div className="rounded-[10px] border border-[rgba(91,230,178,0.12)] bg-[rgba(91,230,178,0.04)] px-[14px] py-3">
            <p className="m-0 text-[11px] leading-[1.6] text-muted-2">
              Venue changes go live immediately on the customer-facing event page.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <div className="flex gap-[10px] border-t border-border px-[22px] py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="h-[42px] flex-1 cursor-pointer rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
              className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.45)] text-[13px] font-extrabold text-accent ${saving ? "cursor-default bg-[rgba(91,230,178,0.06)]" : "cursor-pointer bg-[rgba(91,230,178,0.12)]"} ${(saving || !name.trim()) ? "opacity-70" : "opacity-100"}`}>
              {saving ? "Saving…" : "Save Venue"}
              {!saving && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
            </button>
          </div>
          {saveError && (
            <div className="px-[22px] pb-[14px]">
              <p className="m-0 rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-3 py-[9px] text-[12px] font-semibold text-danger">{saveError}</p>
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
      <div className="pb-12">
        {/* Header */}
        <div className="mb-2 flex flex-wrap items-start gap-[14px]">
          <button type="button" onClick={onBack} className={backBtnStyle}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <div className="min-w-0 flex-1">
            <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.15em] text-accent">Streaming Events</p>
            <h2 className="mb-1 text-[20px] font-extrabold text-fg">Manage Event</h2>
            <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted">{ev.title}</p>
          </div>
          <span className="mt-1 shrink-0 rounded-full border px-[14px] py-[5px] text-[11px] font-bold" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>{badge.label}</span>
        </div>

        <div className="mx-0 mb-6 mt-4 h-px bg-border" />

        <div className={SCR_MANAGE_LAYOUT}>
          {/* ── LEFT ── */}
          <div>
            {/* Tab bar */}
            <div className={SCR_MANAGE_TAB_BAR}>
              {([
                { key: "shows",    label: "Shows & Tickets", icon: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></> },
                { key: "overview", label: "Overview",         icon: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
              ] as const).map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`${SCR_MANAGE_TAB} ${tab === t.key ? SCR_MANAGE_TAB_ACTIVE : ""}`}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mr-[6px] align-middle">{t.icon}</svg>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Shows tab ── */}
            {tab === "shows" && (
              <div>
                {loadingOverview ? (
                  <div className="flex justify-center px-0 py-[60px]">
                    <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <>
                    {/* ── Venue ── */}
                    <div className="mb-6 rounded-xl border border-border bg-surface px-[18px] py-[14px]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[rgba(91,230,178,0.2)] bg-[rgba(91,230,178,0.08)]">
                          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-[2px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-fg">
                            {venueLocation || <span className="text-muted-2">No venue set</span>}
                          </p>
                          <p className="m-0 text-[11px] text-muted">
                            {venueCity || "No city set"}
                            {locationUrl && <span className="ml-2 font-semibold text-accent">· Maps linked</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => setVenueDrawerOpen(true)}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-[13px] py-[7px] text-[12px] font-bold text-accent">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit Venue
                        </button>
                      </div>
                    </div>

                    {/* ── Ticket Types ── */}
                    <div className="mb-6">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted">Ticket Types</p>
                          {fullTiers.length > 0 && (
                            <p className="mt-[2px] text-[11px] text-muted-2">{fullTiers.length} tier{fullTiers.length !== 1 ? "s" : ""} · {liveSold} sold · {liveCapacity - liveSold} remaining</p>
                          )}
                        </div>
                        <button type="button" onClick={openTicketDrawer}
                          className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.3)] bg-[rgba(91,230,178,0.1)] px-[13px] py-[7px] text-[12px] font-bold text-accent">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                          Add Ticket
                        </button>
                      </div>
                      {fullTiers.length === 0 ? (
                        <div className="rounded-xl border-[1.5px] border-dashed border-border px-6 py-8 text-center">
                          <p className="mb-1 text-[13px] font-bold text-muted">No ticket types yet</p>
                          <p className="m-0 text-[12px] text-muted-2">Click "Add Ticket" to create your first ticket tier</p>
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
                      <div className="mb-3 flex items-center justify-between">
                        <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted">Show Dates</p>
                        <button type="button" onClick={openDrawer}
                          className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-border bg-[#0b1114] px-[13px] py-[7px] text-[12px] font-bold text-muted">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                          Add Show
                        </button>
                      </div>
                      {shows.length === 0 && (
                        <div className="mb-2 rounded-xl border-[1.5px] border-dashed border-border px-6 py-8 text-center">
                          <p className="mb-1 text-[13px] font-bold text-muted">No shows scheduled yet</p>
                          <p className="m-0 text-[12px] text-muted-2">Add a show date to go live with your tickets</p>
                        </div>
                      )}
                      {shows.length > 0 && allExpired && (
                        <div className="mb-3 flex items-center gap-[10px] rounded-[10px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] px-4 py-3">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                          <span className="text-[12px] font-semibold text-warning">All shows have expired. Add a new show date to continue selling.</span>
                        </div>
                      )}
                      {shows.map(show => (
                        <div key={show.id} className="mb-2 overflow-hidden rounded-xl border border-border bg-surface">
                          <button type="button" onClick={() => toggleShow(show.id)}
                            className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-[18px] py-[14px] text-left">
                            <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: show.status === "active" ? "#22c55e" : "#444" }} />
                            <div className="flex-1">
                              <p className="mb-[2px] text-[14px] font-bold text-fg">{show.dateLabel}</p>
                              <p className="m-0 text-[12px] text-muted">{show.timeLabel}</p>
                            </div>
                            <span className={`rounded-full border px-[10px] py-[3px] text-[11px] font-bold ${show.status === "active" ? "border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.1)] text-success" : "border-border bg-surface-2 text-muted"}`}>
                              {show.status === "active" ? "Active" : "Expired"}
                            </span>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className={`shrink-0 transition-transform duration-200 ${show.expanded ? "rotate-180" : "rotate-0"}`}><path d="M7.5 9.75l4.5 4.5 4.5-4.5"/></svg>
                          </button>
                          {show.expanded && (
                            <div className="border-t border-border px-[18px] pb-[14px]">
                              <p className="mt-3 mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">Ticket Sales This Show</p>
                              {show.tickets.length === 0
                                ? <p className="m-0 text-[12px] text-muted-2">No tickets assigned to this show</p>
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
                  <div className="flex justify-center px-0 py-20">
                    <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <>
                    {isLocked && (
                      <div className="mb-4 flex items-center gap-[10px] rounded-[10px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.06)] px-4 py-[11px]">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span className="text-[12px] font-semibold text-warning">This event is published. Some fields may be restricted. Contact <strong>events.moderation@kasakai.in</strong> for structural changes.</span>
                      </div>
                    )}

                    {/* Event Name + Description */}
                    <OvSection title="Event Info">
                      <div className="mb-[14px]">
                        <OvLabel>Event Name</OvLabel>
                        <input value={eventName} onChange={e => setEventName(e.target.value)} disabled={isLocked}
                          className={`${inp} ${isLocked ? "cursor-not-allowed opacity-[0.55]" : "cursor-text opacity-100"}`} />
                      </div>
                      <div>
                        <OvLabel required>Event Description</OvLabel>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={7} disabled={isLocked}
                          className={`${inp} resize-y leading-[1.7] ${isLocked ? "cursor-not-allowed opacity-[0.55]" : "cursor-text opacity-100"}`} />
                        <p className="mt-[5px] text-[11px] text-muted-2">{description.length} characters</p>
                      </div>
                    </OvSection>

                    {/* Event Type */}
                    <OvSection title="Event Type">
                      <div className="mb-[14px] grid grid-cols-2 gap-4">
                        <div>
                          <div className="mb-[6px] flex justify-between">
                            <OvLabel required>Category</OvLabel>
                            <span className="text-[11px] text-muted-2">Upto 2</span>
                          </div>
                          <MultiSelect options={CATEGORIES} value={categories} onChange={setCategories} max={2} disabled={isLocked} />
                        </div>
                        <div>
                          <div className="mb-[6px] flex justify-between">
                            <OvLabel>Sub-Category</OvLabel>
                            <span className="text-[11px] text-muted-2">Upto 2</span>
                          </div>
                          <MultiSelect options={availableSubCats.length ? availableSubCats : ["Select a category first"]} value={subCategories} onChange={setSubCats} max={2} disabled={isLocked || availableSubCats.length === 0} />
                        </div>
                      </div>
                    </OvSection>

                    {/* Venue */}
                    <OvSection title="Set Up Venue">
                      <div className="mb-[14px] grid grid-cols-2 gap-3">
                        <div>
                          <OvLabel required>Venue Name</OvLabel>
                          <input value={venueLocation} onChange={e => setVenueLoc(e.target.value)}
                            className={inp} placeholder="e.g. The Local Cafe" />
                        </div>
                        <div>
                          <OvLabel required>City / Area</OvLabel>
                          <input value={venueCity} onChange={e => setVenueCity(e.target.value)}
                            className={inp} placeholder="e.g. Koramangala, Bangalore" />
                        </div>
                      </div>
                      <div className="mb-[14px]">
                        <OvLabel required>Hosting at your restaurant?</OvLabel>
                        <div className="mt-2 flex gap-6">
                          {(["yes","no"] as const).map(v => (
                            <label key={v} className={`flex items-center gap-2 ${isLocked ? "cursor-not-allowed opacity-[0.55]" : "cursor-pointer opacity-100"}`}>
                              <div className={`h-4 w-4 shrink-0 cursor-pointer rounded-full border-2 ${ownRestaurant === v ? "border-[#5be6b2] bg-accent" : "border-border bg-transparent"}`}
                                onClick={() => !isLocked && setOwnRest(v)} />
                              <span className="text-[13px] capitalize text-muted">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="mb-[14px]">
                        <OvLabel>Google Maps URL</OvLabel>
                        <input type="url" placeholder="https://maps.google.com/?q=..." value={locationUrl} onChange={e => setLocationUrl(e.target.value)}
                          className={inp} />
                        <p className="mt-1 text-[11px] text-muted-2">Customers tap this to navigate to the venue</p>
                      </div>
                      <div>
                        <OvLabel>Instagram Link</OvLabel>
                        <input type="url" placeholder="https://instagram.com/yourvenue" value={instagramLink} onChange={e => setIgLink(e.target.value)} disabled={isLocked}
                          className={`${inp} ${isLocked ? "opacity-[0.55]" : "opacity-100"}`} />
                      </div>
                    </OvSection>

                    {/* Event Card Images */}
                    <OvSection title="Event Card Images">
                      <div className="flex flex-col gap-[10px]">
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
                      <div className="mb-3">
                        <GuideRow label="Language(s)">
                          <MultiSelect options={LANGUAGES} value={language} onChange={setLanguage} disabled={isLocked} />
                        </GuideRow>
                        <GuideRow label="Minimum age for entry">
                          <div className="flex items-center gap-[10px]">
                            <OvSelect value={minAge} onChange={setMinAge} options={AGE_OPTS} disabled={isLocked} />
                            <span className="whitespace-nowrap text-[12px] text-muted">&amp; above</span>
                          </div>
                        </GuideRow>
                        <GuideRow label="Age for paid entry">
                          <div className="flex items-center gap-[10px]">
                            <OvSelect value={ticketAge} onChange={setTicketAge} options={AGE_OPTS} disabled={isLocked} />
                            <span className="whitespace-nowrap text-[12px] text-muted">&amp; above</span>
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
                        <div className="grid grid-cols-2 items-center gap-4 py-3">
                          <span className="text-[13px] font-semibold text-muted">Gates open before start?<span className="ml-[3px] text-danger">*</span></span>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => !isLocked && setGatesOpen(p => !p)}
                              className={`flex items-center gap-2 border-none bg-transparent p-0 ${isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100"}`}>
                              <div className={`relative h-[22px] w-10 rounded-full border-[1.5px] transition-[background] duration-200 ${gatesOpen ? "border-[#5be6b2] bg-accent" : "border-border bg-surface-2"}`}>
                                <div className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] duration-200 ${gatesOpen ? "left-[20px] bg-black" : "left-[2px] bg-muted"}`} />
                              </div>
                              <span className="text-[12px] font-semibold text-muted">{gatesOpen ? "Yes" : "No"}</span>
                            </button>
                            {gatesOpen && (
                              <div className="flex items-center gap-[6px]">
                                <input type="number" min="5" max="120" value={gatesOpenMinutes}
                                  onChange={e => setGatesOpenMinutes(Number(e.target.value))}
                                  disabled={isLocked}
                                  className={`${inp} w-[64px]! px-2! py-1!`} />
                                <span className="text-[12px] text-muted">min</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </OvSection>

                    {/* Add More Sections */}
                    <div className="mb-[14px] rounded-xl border border-border bg-[rgba(91,230,178,0.03)] px-5 py-4">
                      <p className="mb-3 text-[13px] font-extrabold text-fg">Add More Sections</p>
                      <div className="flex flex-wrap gap-[10px]">
                        {["Event Instructions","Youtube Video","Prohibited Items","FAQs"].map(sec => {
                          const active = extraSections.includes(sec);
                          return (
                            <button key={sec} type="button" onClick={() => toggleExtra(sec)}
                              className={`inline-flex cursor-pointer items-center gap-[7px] rounded-lg border px-[14px] py-[7px] text-[12px] font-semibold ${active ? "border-[rgba(91,230,178,0.35)] bg-[rgba(91,230,178,0.1)] text-accent" : "border-border bg-surface text-muted"}`}>
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
                        <div key={sec} className="mt-[14px]">
                          <OvLabel>{sec}</OvLabel>
                          <textarea rows={3} placeholder={`Enter ${sec.toLowerCase()}…`} value={extraContent[sec] || ""}
                            onChange={e => setExtraContent(p => ({ ...p, [sec]: e.target.value }))}
                            className={`${inp} resize-y`} />
                        </div>
                      ))}
                    </div>

                    {/* Point of Contact */}
                    <OvSection title="Point of Contact">
                      <p className="mb-[14px] text-[12px] text-muted">Add POCs with whom event feedback will be shared</p>
                      <div className="mb-[14px] flex flex-col gap-3">
                        {pocs.map((poc) => (
                          <div key={poc.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-[10px]">
                            <input value={poc.name}  onChange={e => updatePoc(poc.id, "name",  e.target.value)} placeholder="Name"  className={inp} />
                            <input value={poc.email} onChange={e => updatePoc(poc.id, "email", e.target.value)} placeholder="Email" type="email" className={inp} />
                            <input value={poc.phone} onChange={e => updatePoc(poc.id, "phone", e.target.value)} placeholder="Phone" type="tel"   className={inp} />
                            {pocs.length > 1 && (
                              <button type="button" onClick={() => removePoc(poc.id)}
                                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)]">
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addPoc}
                        className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-[18px] py-2 text-[12px] font-bold text-accent">
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        Add POC
                      </button>
                    </OvSection>

                    {/* Show organiser toggle */}
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
                      <div>
                        <p className="mb-[3px] text-[13px] font-bold text-fg">Show organiser details to customers</p>
                        <p className="m-0 text-[11px] text-muted">If ON, name, email &amp; phone will be visible on the event page</p>
                      </div>
                      <button type="button" onClick={() => setShowOrganiser(p => !p)}
                        className="shrink-0 cursor-pointer border-none bg-transparent p-0">
                        <div className={`relative h-[22px] w-10 rounded-full border-[1.5px] transition-[background] duration-200 ${showOrganiser ? "border-[#5be6b2] bg-accent" : "border-border bg-surface-2"}`}>
                          <div className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] duration-200 ${showOrganiser ? "left-[20px] bg-black" : "left-[2px] bg-muted"}`} />
                        </div>
                      </button>
                    </div>

                    {/* Send copy toggle */}
                    <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4">
                      <p className="m-0 text-[13px] font-bold text-fg">Send a copy of every sale to organiser</p>
                      <button type="button" onClick={() => setSendCopies(p => !p)}
                        className="cursor-pointer border-none bg-transparent p-0">
                        <div className={`relative h-[22px] w-10 rounded-full border-[1.5px] transition-[background] duration-200 ${sendCopies ? "border-[#5be6b2] bg-accent" : "border-border bg-surface-2"}`}>
                          <div className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] duration-200 ${sendCopies ? "left-[20px] bg-black" : "left-[2px] bg-muted"}`} />
                        </div>
                      </button>
                    </div>

                    {/* Save button */}
                    <div className="flex items-center justify-center gap-[14px]">
                      <button type="button" onClick={handleSaveOverview} disabled={saving}
                        className={`rounded-[10px] border-none px-10 py-3 text-[14px] font-extrabold tracking-[0.04em] text-black shadow-[0_0_24px_rgba(91,230,178,0.22)] ${saving ? "cursor-not-allowed bg-[rgba(91,230,178,0.4)]" : "cursor-pointer bg-accent"}`}
                        onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#79eebc"; }}
                        onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "#5be6b2"; }}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                      {saveMsg && (
                        <span className={`text-[13px] font-semibold ${saveMsg === "Saved" ? "text-accent" : "text-danger"}`}>
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
          <div className={SCR_MANAGE_SIDEBAR}>
            <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
              <div className="relative h-[120px] overflow-hidden">
                {imgUrl || ev.image ? (
                  <img src={imgUrl || ev.image} alt={ev.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-surface-2" />
                )}
                <div className="absolute inset-0 bg-[image:linear-gradient(to_top,rgba(18,26,31,0.9),transparent)]" />
                <span className="absolute bottom-[10px] left-[12px] rounded-full border px-[10px] py-[3px] text-[11px] font-bold" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>{badge.label}</span>
              </div>
              <div className="p-[14px]">
                <p className="mb-[10px] text-[12px] font-bold leading-[1.4] text-fg">{ev.title}</p>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg bg-[#0b1114] px-3 py-[10px] text-center">
                    <p className="mb-[2px] text-[18px] font-extrabold text-fg">{liveSold}</p>
                    <p className="m-0 text-[10px] font-semibold text-muted">Sold</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-[#0b1114] px-3 py-[10px] text-center">
                    <p className="mb-[2px] text-[18px] font-extrabold text-fg">{liveCapacity - liveSold}</p>
                    <p className="m-0 text-[10px] font-semibold text-muted">Left</p>
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
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[9999] -translate-x-1/2">
          <div className="flex items-center gap-3 whitespace-nowrap rounded-[14px] border-[1.5px] border-[rgba(91,230,178,0.45)] bg-[rgba(10,10,10,0.92)] px-6 py-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-[12px]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.15)]">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <span className="text-[13px] font-bold text-fg">{tierSaveToast}</span>
          </div>
        </div>
      )}
    </>
  );
}
