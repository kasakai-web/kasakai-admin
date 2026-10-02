"use client";

/* One campaign, end to end: what it is, what it has cost, what it led to.
 *
 * "Did the offer drive attended games, and what did it cost?" (§1 goal 6) is
 * answered from the ledger and the roster — redemptions, the bookings they
 * priced, how many of those players were marked present, how many cancelled —
 * never inferred from a viewed badge or a pending payment.
 *
 * Pausing takes effect on the very next booking (the hold re-reads the status
 * inside its own update) and touches no booking already made. */

import { useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import {
  adminFetch, rupees, shortDate, shortDateTime, BTN, BTN_PRIMARY, BTN_DANGER, CARD, ERROR_BOX, WARN_BOX,
  Campaign, CampaignDetail as Detail, STATE_TONE, TYPE_LABEL, usesLabel,
} from "./shared";
import { RedemptionsTable } from "./RedemptionsTable";

const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  edited: "Edited",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
  unarchived: "Restored (paused)",
};

export function CampaignDetail({
  campaignId, canManage, onClose, onEdit, onChanged,
}: {
  campaignId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: (c: Campaign) => void;
  onChanged: (message: string) => void;
}) {
  const { data, loading, error, refresh } = useAdminFetch<{ success: boolean; data: Detail }>(
    `/admin/discounts/${campaignId}`,
    { errorMessage: "Could not load that campaign." },
  );
  const c = data?.data ?? null;
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!c?.code) return;
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionErr("Could not copy — select the code and copy it by hand.");
    }
  };

  const setStatus = async (status: Campaign["status"]) => {
    if (!c) return;
    if (status === "archived" && !window.confirm(`Archive "${c.title}"? It stops applying immediately. Bookings already made keep their price.`)) return;
    setBusy(true);
    const res = await adminFetch<Campaign>(`/admin/discounts/${c._id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!res.ok) { setActionErr([res.message, ...(res.details || [])].filter(Boolean).join(" ")); return; }
    setActionErr("");
    refresh();
    onChanged(`"${c.title}" is now ${res.data?.state || status}.`);
  };

  const stats = c?.stats;
  const budgetLeft = c && c.limits.budgetPaise ? Math.max(0, c.limits.budgetPaise - (c.usage?.spentPaise || 0)) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(0,0,0,0.75)] p-6 max-[640px]:p-2">
      <div className="mx-auto max-w-[1100px] rounded-[16px] border border-border bg-[#0b1114] p-6 max-[640px]:p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-fg">{c?.title || "Campaign"}</h2>
            {c && (
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                <span>{c.name}</span>
                <span>·</span>
                <span>v{c.version}</span>
                <span className={`rounded-full border px-[8px] py-[1px] uppercase tracking-[0.08em] ${STATE_TONE[c.state || "draft"]}`}>
                  {c.state}
                </span>
              </div>
            )}
          </div>
          <button type="button" className={BTN} onClick={onClose}>Close</button>
        </div>

        {(error || actionErr) && <div className={`${ERROR_BOX} mb-4`}>{actionErr || error}</div>}
        {loading && !c && <div className="text-[13px] text-muted">Loading…</div>}

        {c && (
          <div className="flex flex-col gap-4">
            {c.status === "archived" && c.archiveReason === "uses_spent" && (
              <div className={WARN_BOX}>
                <b>Archived automatically</b> — all {c.limits.totalUses} use{c.limits.totalUses === 1 ? " was" : "s were"} spent
                {c.archivedAt ? ` (${shortDateTime(c.archivedAt)})` : ""}. To give out more, restore it, raise the number
                of uses and publish it again{c.codeMode === "unique" ? " — the code stays the same" : ""}.
              </div>
            )}

            {/* ── The code, readable any time ── */}
            {c.trigger === "code" && c.code && (
              <div className={`${CARD} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                    {c.codeMode === "unique" ? "Unique code" : "Shared code"}
                  </div>
                  <div className="mt-1 select-all font-mono text-[22px] font-bold tracking-[0.08em] text-fg">{c.code}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {usesLabel(c) ?? "unlimited uses"}
                    {c.limits.perPlayer ? ` · ${c.limits.perPlayer} per player` : ""}
                  </div>
                </div>
                <button type="button" className={BTN} onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button>
              </div>
            )}

            {canManage && (
              <div className="flex flex-wrap gap-2">
                {c.status !== "archived" && <button type="button" className={BTN} onClick={() => onEdit(c)}>Edit</button>}
                {(c.status === "draft" || c.status === "paused") && (
                  <button type="button" className={`${BTN} ${BTN_PRIMARY}`} disabled={busy} onClick={() => setStatus("live")}>
                    {c.status === "draft" ? "Publish" : "Resume"}
                  </button>
                )}
                {c.status === "live" && (
                  <button type="button" className={BTN} disabled={busy} onClick={() => setStatus("paused")}>Pause</button>
                )}
                {c.status !== "archived" && (
                  <button type="button" className={`${BTN} ${BTN_DANGER}`} disabled={busy} onClick={() => setStatus("archived")}>Archive</button>
                )}
                {c.status === "archived" && (
                  <button type="button" className={BTN} disabled={busy} onClick={() => setStatus("paused")}>Restore (paused)</button>
                )}
              </div>
            )}

            {/* ── The numbers ── */}
            <div className={`${CARD} grid grid-cols-4 gap-4 text-center max-[900px]:grid-cols-2`}>
              <Tile label="Uses" value={String((stats?.consumed || 0) + (stats?.held || 0))}
                sub={`${stats?.consumed || 0} booked${stats?.held ? ` · ${stats.held} in checkout` : ""}`} />
              <Tile label="Discount given" value={rupees(stats?.discountGivenPaise)}
                sub={stats?.players ? `${stats.players} player${stats.players === 1 ? "" : "s"}` : undefined} />
              <Tile label="Budget used" value={rupees(c.usage?.spentPaise)}
                sub={budgetLeft != null ? `${rupees(budgetLeft)} left of ${rupees(c.limits.budgetPaise)}` : "no budget cap"} />
              <Tile label="Attended" value={String(c.attendance.attended)}
                sub={`of ${c.attendance.bookings} booking${c.attendance.bookings === 1 ? "" : "s"} · ${c.attendance.cancelled} cancelled`} />
            </div>
            <p className="-mt-2 text-[11px] text-muted">
              &quot;Attended&quot; counts players the organiser marked present. Given back so far:
              {" "}{stats?.returned || 0} returned (game cancelled / organiser removed) · {stats?.released || 0} released (booking never completed).
            </p>

            <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
              {/* ── What it is ── */}
              <div className={CARD}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">The offer</div>
                <div className="text-[14px] font-semibold text-fg">{c.described?.savingText}</div>
                <div className="mt-1 font-mono text-[11.5px] text-muted">
                  {TYPE_LABEL[c.type]} ·{" "}
                  {c.trigger === "auto" ? "applied automatically" : `${c.codeMode === "unique" ? "unique" : "shared"} code ${c.code || "—"}`}
                  {" "}· funded by KasaKai{c.funding.note ? ` (${c.funding.note})` : ""}
                  {" "}· priority {c.priority}
                </div>
                {c.terms && <div className="mt-2 text-[12.5px] text-body">{c.terms}</div>}
                <ul className="mt-2 list-disc pl-5 text-[12px] leading-[1.6] text-muted">
                  {(c.described?.conditions || []).map((line) => <li key={line}>{line}</li>)}
                </ul>
                <div className="mt-3 font-mono text-[11px] leading-[1.7] text-muted">
                  Limits: {c.limits.perPlayer || "∞"} per player · {c.limits.perGame || "∞"} per game ·{" "}
                  {c.limits.totalUses || "∞"} total · {c.limits.budgetPaise ? rupees(c.limits.budgetPaise) : "no"} budget
                  <br />
                  Booking window: {c.timing.startsAt ? shortDateTime(c.timing.startsAt) : "from publish"} →{" "}
                  {c.timing.endsAt ? shortDateTime(c.timing.endsAt) : "no end"}
                  {(c.timing.gameFrom || c.timing.gameTo) && (
                    <>
                      <br />
                      Games: {c.timing.gameFrom ? shortDate(c.timing.gameFrom) : "any"} → {c.timing.gameTo ? shortDate(c.timing.gameTo) : "any"}
                    </>
                  )}
                </div>
              </div>

              {/* ── Per game ── */}
              <div className={CARD}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Where it was used</div>
                {c.perGame.length === 0 && <div className="text-[12px] text-muted">Not used on any game yet.</div>}
                <div className="flex max-h-[240px] flex-col gap-[6px] overflow-y-auto">
                  {c.perGame.map((g) => (
                    <div key={g._id} className="flex items-center justify-between gap-3 border-b border-border py-[5px] text-[12px]">
                      <span className="min-w-0 truncate text-body">
                        {g.title || "Game"}
                        {g.scheduledAt && <span className="ml-1 font-mono text-[10.5px] text-muted">{shortDateTime(g.scheduledAt)}</span>}
                        {g.status === "cancelled" && <span className="ml-1 text-[10.5px] text-danger">cancelled</span>}
                      </span>
                      <span className="shrink-0 font-mono text-muted">
                        {g.uses} use{g.uses === 1 ? "" : "s"} · <span className="text-accent">−{rupees(g.savingPaise)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={CARD}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Redemptions</div>
              <RedemptionsTable campaignId={c._id} />
            </div>

            {/* ── Who changed what ── */}
            <div className={CARD}>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Audit log</div>
              {c.audit.length === 0 && <div className="text-[12px] text-muted">Nothing recorded yet.</div>}
              <div className="flex flex-col gap-[6px]">
                {c.audit.map((a) => (
                  <div key={a._id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-[5px] text-[12px]">
                    <span className="text-body">
                      <b className="text-fg">{ACTION_LABEL[a.action] || a.action}</b>
                      {a.actorName ? ` by ${a.actorName}` : ""}
                      {a.actorRole ? <span className="ml-1 font-mono text-[10.5px] text-muted">({a.actorRole})</span> : null}
                      {a.note ? <span className="ml-2 text-muted">— {a.note}</span> : null}
                    </span>
                    <span className="font-mono text-[11px] text-muted">v{a.version} · {shortDateTime(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[20px] font-bold text-fg">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted">{label}</div>
      {sub && <div className="mt-[2px] font-mono text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
