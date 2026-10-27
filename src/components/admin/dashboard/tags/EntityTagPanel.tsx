"use client";

/* One entity's behaviour tags — the block inside the Players, Organisers and
   Games drawers, and the body of the venue Tags modal.

   Live tags are chips coloured by confidence (manual ones violet, sensitive ones
   amber, suppressed ones struck through). Hover shows the rule and evidence;
   clicking opens them with the actions: suppress a wrong rule tag, lift a
   suppression, remove a manual tag. History lists every tag this entity has
   held and lost — rows are never deleted, so "why did they stop being loyal?"
   has an answer.

   What a tag means and why it was earned are the server's words, printed as
   sent. */

import { useMemo, useState } from "react";
import { BLOCK_TITLE, FORM_ERROR } from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import {
  adminFetch, BTN, BTN_PRIMARY, BTN_DANGER, FIELD, FIELD_LABEL, CHIP, shortDate,
  toneFor, describeEvidence, squadIds, ENTITY_ONE,
  type Definitions, type EntityTags, type EntityType, type TagRow,
} from "./shared";

type Props = {
  entityType: EntityType;
  entityId: string;
  /** Hide the block heading — the venue modal has its own. */
  bare?: boolean;
};

const STATUS_WORD: Record<TagRow["status"], string> = {
  active: "active",
  suppressed: "suppressed",
  expired: "expired",
  removed: "removed",
};

export function EntityTagPanel({ entityType, entityId, bare = false }: Props) {
  const tags = useAdminFetch<{ data: EntityTags }>(`/admin/tags/entities/${entityType}/${entityId}`, {
    errorMessage: "Could not load tags.",
  });
  const defs = useAdminFetch<{ data: Definitions }>("/admin/tags/definitions", { cache: true });
  const canManage = Boolean(defs.data?.data?.canManage);
  const liveMode = defs.data?.data?.live;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [addKey, setAddKey] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addUntil, setAddUntil] = useState("");

  const live = useMemo(
    () => [...(tags.data?.data?.live ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
    [tags.data],
  );
  const history = tags.data?.data?.history ?? [];
  const open = live.find((t) => t.key === openKey) || null;
  const heldManual = new Set(live.filter((t) => t.source === "manual").map((t) => t.key));
  const addable = (defs.data?.data?.manualTags ?? []).filter((m) => !heldManual.has(m.key));

  const act = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    const res = await adminFetch(`/admin/tags/entities/${entityType}/${entityId}/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { setError(res.message || "That did not work."); return false; }
    tags.refresh();
    return true;
  };

  const addManual = async () => {
    if (!addKey) return;
    const ok = await act("manual", {
      key: addKey,
      note: addNote || undefined,
      // An end DATE: the tag lasts through that whole day.
      expiresAt: addUntil ? new Date(`${addUntil}T23:59:59+05:30`).toISOString() : undefined,
    });
    if (ok) { setAddKey(""); setAddNote(""); setAddUntil(""); }
  };

  return (
    <div className="mb-2">
      {!bare && <div className={BLOCK_TITLE}>Behaviour tags ({live.length})</div>}

      {tags.loading && !tags.data && <div className="py-3 text-[13px] text-muted">Loading tags…</div>}
      {tags.error && <div className={FORM_ERROR}>{tags.error}</div>}
      {error && <div className={`${FORM_ERROR} mb-3`}>{error}</div>}

      {!tags.loading && !tags.error && live.length === 0 && (
        <div className="border border-border bg-surface px-4 py-3 text-[13px] text-muted">
          No tags on this {ENTITY_ONE[entityType]}.
          {liveMode === false && " Tagging is still in dry-run mode, so no rule tags have been written yet."}
        </div>
      )}

      {live.length > 0 && (
        <div className="flex flex-wrap gap-[6px] border border-border bg-surface p-3">
          {live.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => { setOpenKey(openKey === t.key ? null : t.key); setNote(""); }}
              title={[t.rule, describeEvidence(t.evidence)].filter(Boolean).join("\n")}
              className={`${CHIP} ${toneFor(t)} cursor-pointer ${openKey === t.key ? "outline outline-1 outline-fg" : ""}`}
            >
              {t.key}
              {t.confidence && t.source === "rule" && t.status === "active" && (
                <span className="text-[10px] opacity-70">{t.confidence}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 border border-border-2 bg-surface-2 px-4 py-3 text-[13px] text-body">
          <div className="mb-1 font-mono text-[12.5px] text-fg">{open.key}</div>
          {open.rule && <div className="mb-1 text-muted">{open.rule}</div>}
          {Object.keys(open.evidence || {}).length > 0 && (
            <div className="mb-1">{describeEvidence(open.evidence)}</div>
          )}
          {squadIds(open.evidence).length > 0 && (
            <div className="mb-1 text-[12px] text-muted">
              Plays with {squadIds(open.evidence).length} regular co-players (ids in the export).
            </div>
          )}
          <div className="text-[12px] text-muted">
            {open.source === "manual"
              ? `Added by ${open.addedBy?.name || "an admin"} on ${shortDate(open.firstTaggedAt)}${open.expiresAt ? ` · ends ${shortDate(open.expiresAt)}` : ""}`
              : `${open.def || "rule"} · since ${shortDate(open.firstTaggedAt)} · confirmed ${shortDate(open.lastConfirmedAt)}`}
            {open.confidence ? ` · ${open.confidence} confidence` : ""}
            {open.sensitive ? " · sensitive (left out of exports by default)" : ""}
            {open.informational ? " · informational only, not for targeting" : ""}
          </div>
          {open.status === "suppressed" && (
            <div className="mt-1 text-[12px] text-warning">
              Suppressed by {open.suppressedBy?.name || "an admin"} on {shortDate(open.suppressedAt)}
              {open.note ? ` — “${open.note}”` : ""}. The nightly run skips this tag here until it is lifted.
            </div>
          )}
          {open.source === "manual" && open.note && <div className="mt-1 text-[12px]">“{open.note}”</div>}

          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {open.source === "rule" && open.status === "active" && (
                <>
                  <input
                    className={`${FIELD} max-w-[320px]`}
                    placeholder="Why is it wrong? (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button type="button" className={BTN} disabled={busy}
                    onClick={() => act("suppress", { key: open.key, note: note || undefined }).then((ok) => ok && setOpenKey(null))}>
                    Suppress
                  </button>
                </>
              )}
              {open.status === "suppressed" && (
                <button type="button" className={BTN} disabled={busy}
                  onClick={() => act("unsuppress", { key: open.key }).then((ok) => ok && setOpenKey(null))}>
                  Lift suppression
                </button>
              )}
              {open.source === "manual" && (
                <button type="button" className={`${BTN} ${BTN_DANGER}`} disabled={busy}
                  onClick={() => act("manual/remove", { key: open.key }).then((ok) => ok && setOpenKey(null))}>
                  Remove tag
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {canManage && addable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[180px]">
            <span className={FIELD_LABEL}>Add a manual tag</span>
            <select className={FIELD} value={addKey} onChange={(e) => setAddKey(e.target.value)}>
              <option value="">Choose…</option>
              {addable.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.key})</option>)}
            </select>
          </label>
          <label className="min-w-[200px] flex-1">
            <span className={FIELD_LABEL}>Note</span>
            <input className={FIELD} value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Optional" />
          </label>
          <label>
            <span className={FIELD_LABEL}>Ends (optional)</span>
            <input type="date" className={FIELD} value={addUntil} onChange={(e) => setAddUntil(e.target.value)} />
          </label>
          <button type="button" className={`${BTN} ${BTN_PRIMARY}`} disabled={busy || !addKey} onClick={addManual}>
            Add
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-[12px] text-muted underline hover:text-fg"
            onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide" : "Show"} history ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 border border-border">
              {history.map((h) => (
                <div key={h._id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-2 px-3 py-2 text-[12.5px] last:border-b-0">
                  <span className="font-mono text-body">{h.key}</span>
                  <span className="text-muted">
                    {STATUS_WORD[h.status]} · {shortDate(h.firstTaggedAt)} → {shortDate(h.endedAt)}
                    {h.endedBy?.name ? ` · by ${h.endedBy.name}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
