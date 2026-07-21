"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FILTER_SELECT, SEARCH_INPUT, TOOLBAR } from "../ui";
import { scrApi, toUIScrEvent, type UIScrEvent } from "@/lib/screening-api";
import { ScrEvent, scrStatusBadge } from "./types";
import { ScrEventCard } from "./EventCard";

function ScrHead({ total, onCreate }: { total: number; onCreate: () => void }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.15em] text-accent">Streaming</p>
        <h2 className="mb-1 text-[24px] font-extrabold text-fg">Screening Events</h2>
        <p className="m-0 text-[13px] text-muted">{total} events across all statuses</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] border-[rgba(91,230,178,0.35)] bg-[rgba(91,230,178,0.1)] px-[18px] py-[10px] text-[13px] font-bold text-accent transition-all duration-150"
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.65)] backdrop-blur-[3px]" onClick={!loading ? onClose : undefined} />
      {/* Modal */}
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start gap-[14px] border-b border-border px-6 pt-[22px] pb-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-fg">Cancel Event?</h3>
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              <strong className="text-fg">{target.title}</strong> — all confirmed ticket holders will be refunded to their original payment method and notified by email.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-danger">
            Cancellation Reason <span className="text-danger">*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={e => { setReason(e.target.value); if (error) setError(null); }}
            placeholder="e.g. The venue is no longer available for this date…"
            rows={4}
            className={`box-border w-full resize-y rounded-[10px] border-[1.5px] bg-[#0b1114] px-[14px] py-3 text-[13px] leading-[1.6] text-fg outline-none transition-[border-color] duration-150 ${error ? "border-[#ef4444]" : "border-border"}`}
            onFocus={e => { if (!error) e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
            onBlur={e => { if (!error) e.currentTarget.style.borderColor = "var(--border)"; }}
            disabled={loading}
          />
          {error && <p className="mt-[6px] text-[12px] font-semibold text-danger">{error}</p>}

          <div className="mt-[14px] rounded-[9px] border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.06)] px-[14px] py-3">
            <p className="m-0 text-[12px] leading-[1.6] text-muted">
              This reason will be included in the cancellation email sent to all ticket holders. Refunds will be processed to the original payment method (bank account / UPI / card) within 5–7 business days.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 pb-[22px]">
          <button type="button" onClick={onClose} disabled={loading}
            className={`h-[42px] flex-1 rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted ${loading ? "cursor-default opacity-50" : "cursor-pointer opacity-100"}`}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading || !reason.trim()}
            className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(239,68,68,0.4)] text-[13px] font-extrabold text-danger transition-all duration-150 ${(loading || !reason.trim()) ? "cursor-default bg-[rgba(239,68,68,0.06)] opacity-60" : "cursor-pointer bg-[rgba(239,68,68,0.15)] opacity-100"}`}>
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.65)] backdrop-blur-[3px]" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start gap-[14px] border-b border-border px-6 pt-[22px] pb-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.12)]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-fg">Mark as Completed?</h3>
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              <strong className="text-fg">{target.title}</strong>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="rounded-[10px] border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.07)] px-4 py-[14px]">
            <p className="m-0 text-[13px] leading-[1.6] text-muted">
              This will mark the event as <strong className="text-[#818cf8]">Completed</strong>. The event will be closed for new bookings and no further changes can be made to its status.
            </p>
          </div>
          {error && <p className="mt-[10px] text-[12px] font-semibold text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 pb-[22px]">
          <button type="button" onClick={onClose} disabled={loading}
            className={`h-[42px] flex-1 rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted ${loading ? "cursor-default opacity-50" : "cursor-pointer opacity-100"}`}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(99,102,241,0.4)] text-[13px] font-extrabold text-[#818cf8] transition-all duration-150 ${loading ? "cursor-default bg-[rgba(99,102,241,0.08)] opacity-60" : "cursor-pointer bg-[rgba(99,102,241,0.18)] opacity-100"}`}>
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.65)] backdrop-blur-[3px]" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start gap-[14px] border-b border-border px-6 pt-[22px] pb-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-fg">Delete Event Permanently?</h3>
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              <strong className="text-fg">{target.title}</strong>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.07)] px-4 py-[14px]">
            <p className="m-0 text-[13px] leading-[1.6] text-muted">
              {isCancelled
                ? "This cancelled event will be permanently removed from the database. All associated ticket records (already refunded) will be orphaned. This action cannot be undone."
                : "This draft event will be permanently deleted. No tickets have been issued. This action cannot be undone."}
            </p>
          </div>
          {error && <p className="mt-[10px] text-[12px] font-semibold text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 pb-[22px]">
          <button type="button" onClick={onClose} disabled={loading}
            className={`h-[42px] flex-1 rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted ${loading ? "cursor-default opacity-50" : "cursor-pointer opacity-100"}`}>
            Go Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className={`flex h-[42px] flex-[2] items-center justify-center gap-[7px] rounded-[9px] border-[1.5px] border-[rgba(239,68,68,0.4)] text-[13px] font-extrabold text-danger transition-all duration-150 ${loading ? "cursor-default bg-[rgba(239,68,68,0.06)] opacity-60" : "cursor-pointer bg-[rgba(239,68,68,0.15)] opacity-100"}`}>
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
        <div className="fixed bottom-7 left-1/2 z-[10000] flex min-w-[280px] max-w-[440px] -translate-x-1/2 items-center gap-[10px] rounded-xl border-[1.5px] border-[rgba(99,102,241,0.4)] bg-[rgba(17,20,36,0.97)] px-5 py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(99,102,241,0.18)]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span className="text-[13px] font-semibold leading-[1.4] text-fg">{successToast}</span>
        </div>
      )}

      <ScrHead total={events.length} onCreate={handleCreate} />

      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search events, venues…" value={search} onChange={handleSearch} />
        <select className={FILTER_SELECT} value={statusFilter} onChange={handleStatusFilter}>
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading && (
        <div className="px-0 py-16 text-center text-[14px] text-muted">
          Loading events…
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[10px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-[13px] text-danger">
          <span>{error}</span>
          <button type="button" onClick={fetchEvents} className="cursor-pointer rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] px-[14px] py-[6px] text-[11px] font-bold text-danger">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="px-0 py-16 text-center text-[14px] text-muted">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3 block">
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
