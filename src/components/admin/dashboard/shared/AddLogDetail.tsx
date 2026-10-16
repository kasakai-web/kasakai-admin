"use client";

/* Internal log an admin keeps about a player — a call, a complaint, a promise
   made. Append-only (GET/POST /admin/players/:id/notes), and stored on the
   Player with `select: false`, so nothing the player or an organiser can read
   ever carries it. */

import { useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import { SECTION_TITLE, ACTION_BTN, FORM_ERROR, LOADING_STATE, MODAL_CLOSE, BLOCK_TITLE } from "./styles";
import { useAdminFetch } from "./useAdminFetch";
import { formatDateTime } from "./format";
import { API_BASE } from "./api";

type AdminNote = { _id: string; text: string; adminName?: string | null; createdAt: string };

const MAX = 5000;

export function AddLogDetail({ player, onClose }: { player: { id: string; name: string }; onClose: () => void }) {
  const { data, loading, error, refresh } = useAdminFetch<{ data?: AdminNote[] }>(
    `/admin/players/${player.id}/notes`,
    { errorMessage: "Failed to load notes." },
  );
  const [saved, setSaved] = useState<AdminNote[] | null>(null);
  const notes = saved ?? data?.data ?? [];

  const [text, setText]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save() {
    if (!text.trim()) return;
    setBusy(true); setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/admin/players/${player.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ text: text.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setSaveError(body.message || "Could not save the note."); return; }
      setSaved(body.data ?? []);
      setText("");
    } catch { setSaveError("Cannot reach the server."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-[rgba(0,0,0,0.55)]" onClick={busy ? undefined : onClose}>
      <aside
        className="absolute top-0 right-0 flex h-full w-full max-w-[440px] flex-col border-l border-border-2 bg-surface p-6 max-[640px]:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className={SECTION_TITLE}>Log Details</div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose}>✕</button>
        </div>
        <div className="mb-4 text-[13px] text-muted">
          {player.name} · <span className="text-warning">Admin only — never shown to the player</span>
        </div>

        <textarea
          className="min-h-[140px] w-full resize-y border border-border-2 bg-surface-2 p-3 text-[13px] text-fg"
          placeholder="What happened, what was discussed, what was agreed…"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !busy) save(); }}
          autoFocus
        />
        <div className="mt-1 mb-3 flex items-center justify-between text-[11px] text-muted">
          <span>Ctrl+Enter to save</span>
          <span>{text.length}/{MAX}</span>
        </div>
        {saveError && <div className={`${FORM_ERROR} mb-3`}>{saveError}</div>}
        <button
          className={`${ACTION_BTN} py-2! text-[12px]! border-info! text-fg!`}
          type="button"
          disabled={busy || !text.trim()}
          onClick={save}
        >
          {busy ? "Saving…" : "Save Log"}
        </button>

        <div className={BLOCK_TITLE}>History ({notes.length})</div>
        <div className="flex-1 overflow-y-auto">
          {loading && !saved && <div className={LOADING_STATE}>Loading notes…</div>}
          {error && <div className={FORM_ERROR}>{error} <button className="underline" onClick={refresh}>Retry</button></div>}
          {!loading && !error && notes.length === 0 && <div className="text-[13px] text-muted">No notes yet.</div>}
          {notes.map((n) => (
            <div key={n._id} className="mb-3 border border-border-2 px-3 py-[10px]">
              <div className="mb-1 text-[11px] text-muted">
                {formatDateTime(n.createdAt)}{n.adminName ? ` · ${n.adminName}` : ""}
              </div>
              <div className="whitespace-pre-wrap text-[13px] text-body">{n.text}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
