"use client";

/* Delete confirmation for a player or an organiser.
   DELETE /admin/users/:id serves both — it tries Player, then Organiser — and
   it REQUIRES a reason, which is why this is a modal with a field rather than a
   bare confirm. Deleting is irreversible and cascades (a player's wallet and
   transactions go too), so the destructive button stays disabled until the
   admin has typed why. */

import { useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  SECTION_TITLE, SEARCH_INPUT, ACTION_BTN, FORM_ERROR, MODAL_OVERLAY, MODAL,
  MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL,
} from "./styles";
import { API_BASE } from "./api";

export type DeleteTarget = { id: string; name: string };

export function DeleteUserModal({
  target,
  label = "User",
  extraWarning,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget;
  /** What to call this record in the UI — "Player" or "Organiser". */
  label?: string;
  /** Consequences specific to this kind of record, shown above the reason. */
  extraWarning?: React.ReactNode;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  async function submit() {
    if (!reason.trim()) { setError(`Please provide a reason for deletion.`); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/users/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Delete failed."); return; }
      onDeleted(target.name);
    } catch { setError("Cannot reach the server."); }
    finally { setBusy(false); }
  }

  return (
    <div className={MODAL_OVERLAY} onClick={busy ? undefined : onClose}>
      <div className={`${MODAL} max-w-[460px]!`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>Delete {label}</div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose}>✕</button>
        </div>

        <div className="mb-[14px] text-[14px] text-body">
          Are you sure you want to delete <strong>{target.name}</strong>?{" "}
          <span className="text-danger">This action cannot be undone.</span>
        </div>

        {extraWarning && (
          <div className="mb-[14px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3 text-[13px] text-warning">
            {extraWarning}
          </div>
        )}

        <label className={FORM_LABEL}>
          Reason for deletion
          <input
            className={`${SEARCH_INPUT} mt-[6px]! w-full`}
            placeholder="e.g. Fake account, policy violation, user request…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && reason.trim() && !busy) submit(); }}
            autoFocus
          />
        </label>

        {error && <div className={`${FORM_ERROR} mt-[10px]`}>{error}</div>}

        <div className={`${MODAL_ACTIONS} mt-[18px]`}>
          <button className={ACTION_BTN} type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={`${ACTION_BTN} border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!`}
            type="button"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Deleting…" : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The confirmation toast both directories show after a successful delete. */
export function DeletedToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-7 left-1/2 z-[10000] flex min-w-[280px] -translate-x-1/2 items-center gap-[10px] rounded-xl border-[1.5px] border-[rgba(239,68,68,0.4)] bg-[rgba(17,20,36,0.97)] px-5 py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
      <span className="text-[13px] font-semibold text-fg">{message}</span>
    </div>
  );
}
