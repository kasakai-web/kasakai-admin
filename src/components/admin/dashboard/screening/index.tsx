"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import { scrApi, toUIScrEvent, type UIScrEvent } from "@/lib/screening-api";
import { ScrEvent, scrStatusBadge } from "./types";
import { ScrEventCard } from "./EventCard";

function ScrHead({ total, onCreate }: { total: number; onCreate: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
      <div>
        <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.15em", textTransform: "uppercase" }}>Streaming</p>
        <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "var(--white)" }}>Screening Events</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{total} events across all statuses</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "rgba(91,230,178,0.1)", border: "1.5px solid rgba(91,230,178,0.35)", borderRadius: "10px", color: "#5be6b2", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(91,230,178,0.18)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(91,230,178,0.1)")}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Create Event
      </button>
    </div>
  );
}

type CancelTarget    = { id: string; title: string };
type CompleteTarget  = { id: string; title: string };
type DeleteTarget    = { id: string; title: string; status: string };

function CancelModal({ target, onClose, onConfirm }: {
  target: CancelTarget;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleConfirm = async () => {
    if (!reason.trim()) { setError("Please enter a cancellation reason."); return; }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel event");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={!loading ? onClose : undefined} />
      {/* Modal */}
      <div style={{ position: "relative", width: "100%", maxWidth: "460px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "var(--white)" }}>Cancel Event?</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--white)" }}>{target.title}</strong> — all confirmed ticket holders will be refunded to their original payment method and notified by email.
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
            Cancellation Reason <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={e => { setReason(e.target.value); if (error) setError(null); }}
            placeholder="e.g. The venue is no longer available for this date…"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              background: "var(--bg)", border: `1.5px solid ${error ? "#ef4444" : "var(--border)"}`,
              borderRadius: "10px", padding: "12px 14px", fontSize: "13px",
              color: "var(--white)", fontFamily: "inherit", lineHeight: 1.6,
              outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => { if (!error) e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
            onBlur={e => { if (!error) e.currentTarget.style.borderColor = "var(--border)"; }}
            disabled={loading}
          />
          {error && <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>{error}</p>}

          <div style={{ marginTop: "14px", padding: "12px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "9px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
              This reason will be included in the cancellation email sent to all ticket holders. Refunds will be processed to the original payment method (bank account / UPI / card) within 5–7 business days.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: "10px" }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading || !reason.trim()}
            style={{ flex: 2, height: "42px", background: (loading || !reason.trim()) ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.15)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: "9px", color: "#ef4444", fontSize: "13px", fontWeight: 800, cursor: (loading || !reason.trim()) ? "default" : "pointer", opacity: (loading || !reason.trim()) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "all 0.15s" }}>
            {loading ? "Cancelling…" : (
              <>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                Cancel Event
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ target, onClose, onConfirm }: {
  target: CompleteTarget;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete event");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={!loading ? onClose : undefined} />
      <div style={{ position: "relative", width: "100%", maxWidth: "440px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "10px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "var(--white)" }}>Mark as Completed?</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--white)" }}>{target.title}</strong>
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ padding: "14px 16px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "10px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
              This will mark the event as <strong style={{ color: "#818cf8" }}>Completed</strong>. The event will be closed for new bookings and no further changes can be made to its status.
            </p>
          </div>
          {error && <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: "10px" }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{ flex: 2, height: "42px", background: loading ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.18)", border: "1.5px solid rgba(99,102,241,0.4)", borderRadius: "9px", color: "#818cf8", fontSize: "13px", fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "all 0.15s" }}>
            {loading ? "Completing…" : (
              <>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                Yes, Mark Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ target, onClose, onConfirm }: {
  target: DeleteTarget;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const isCancelled = target.status === "cancelled";

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete event");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={!loading ? onClose : undefined} />
      <div style={{ position: "relative", width: "100%", maxWidth: "440px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "var(--white)" }}>Delete Event Permanently?</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--white)" }}>{target.title}</strong>
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
              {isCancelled
                ? "This cancelled event will be permanently removed from the database. All associated ticket records (already refunded) will be orphaned. This action cannot be undone."
                : "This draft event will be permanently deleted. No tickets have been issued. This action cannot be undone."}
            </p>
          </div>
          {error && <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: "10px" }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{ flex: 2, height: "42px", background: loading ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.15)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: "9px", color: "#ef4444", fontSize: "13px", fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "all 0.15s" }}>
            {loading ? "Deleting…" : (
              <>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                Delete Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScrEvents() {
  const router = useRouter();

  const [events, setEvents]         = useState<UIScrEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ScrEvent["status"]>("all");
  const [cancelTarget, setCancelTarget]     = useState<CancelTarget | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<DeleteTarget | null>(null);
  const [successToast, setSuccessToast]     = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scrApi.listAdmin();
      setEvents(res.events.map(toUIScrEvent));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreate       = useCallback(() => router.push("/dashboard/streaming/create-new-event"), [router]);
  const handleSearch       = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
  const handleStatusFilter = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as typeof statusFilter), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(ev => {
      const matchQ      = !q || [ev.title, ev.venue].join(" ").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || ev.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [events, search, statusFilter]);

  const handleQuickPublish = useCallback(async (id: string) => {
    try {
      await scrApi.publishEvent(id);
      await fetchEvents();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to publish");
    }
  }, [fetchEvents]);

  const handleCancelConfirm = useCallback(async (reason: string) => {
    if (!cancelTarget) return;
    await scrApi.cancelEvent(cancelTarget.id, reason);
    await fetchEvents();
  }, [cancelTarget, fetchEvents]);

  const handleCompleteConfirm = useCallback(async () => {
    if (!completeTarget) return;
    await scrApi.completeEvent(completeTarget.id);
    await fetchEvents();
    setSuccessToast(`"${completeTarget.title}" has been marked as completed.`);
    setTimeout(() => setSuccessToast(null), 2500);
  }, [completeTarget, fetchEvents]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await scrApi.deleteEvent(deleteTarget.id);
    await fetchEvents();
    setSuccessToast(`"${deleteTarget.title}" has been deleted.`);
    setTimeout(() => setSuccessToast(null), 2500);
  }, [deleteTarget, fetchEvents]);

  return (
    <>
      {cancelTarget && (
        <CancelModal
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {completeTarget && (
        <CompleteModal
          target={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onConfirm={handleCompleteConfirm}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {successToast && (
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, display: "flex", alignItems: "center", gap: "10px", padding: "13px 20px", background: "rgba(17,20,36,0.97)", border: "1.5px solid rgba(99,102,241,0.4)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: "280px", maxWidth: "440px" }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: "rgba(99,102,241,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)", lineHeight: 1.4 }}>{successToast}</span>
        </div>
      )}

      <ScrHead total={events.length} onCreate={handleCreate} />

      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search events, venues…" value={search} onChange={handleSearch} />
        <select className={styles.filterSelect} value={statusFilter} onChange={handleStatusFilter}>
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)", fontSize: "14px" }}>
          Loading events…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: "16px 20px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", color: "#ef4444", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span>{error}</span>
          <button type="button" onClick={fetchEvents} style={{ padding: "6px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#ef4444", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--muted)", fontSize: "14px" }}>
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" style={{ display: "block", margin: "0 auto 12px" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          {events.length === 0 ? "No events yet. Create your first screening event." : "No events found."}
        </div>
      )}

      {!loading && filtered.map(ev => (
        <ScrEventCard
          key={ev.id}
          ev={ev}
          onManage={()        => router.push(`/dashboard/streaming/${ev.id}/manage`)}
          onViewAnalytics={()  => router.push(`/dashboard/streaming/${ev.id}/analytics`)}
          onViewEvent={()     => router.push(`/dashboard/streaming/${ev.id}`)}
          onPublish={ev.status === "draft" || ev.status === "completed" ? () => handleQuickPublish(ev.id) : undefined}
          onComplete={ev.status === "published" ? () => setCompleteTarget({ id: ev.id, title: ev.title }) : undefined}
          onCancel={ev.status !== "cancelled" && ev.status !== "completed" ? () => setCancelTarget({ id: ev.id, title: ev.title }) : undefined}
          onDelete={(ev.status === "draft" || ev.status === "cancelled") ? () => setDeleteTarget({ id: ev.id, title: ev.title, status: ev.status }) : undefined}
        />
      ))}
    </>
  );
}
