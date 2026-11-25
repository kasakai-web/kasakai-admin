"use client";

/* Organiser permissions (Organiser_Permissions_Plan.md §4).
   - OrganiserPermissionsModal: one organiser — level, the 13 toggles with caps,
     freeze, transfer games, pause series, and the change / risky-action log.
   - LevelsModal: the three presets + platform kill switches.
   Any admin may look; only a superadmin may save (the server enforces it too).
   Every save is logged with the admin who made it; a reason is optional and,
   when given, the organiser sees it in their note. */

import { useState } from "react";
import {
  SECTION_TITLE, BADGE, BADGE_GREEN, BADGE_AMBER, BADGE_RED, BADGE_BLUE, ACTION_BTN,
  MODAL_OVERLAY, MODAL, MODAL_LARGE, MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL, FORM_ERROR,
  FILTER_SELECT, SEARCH_INPUT, LOADING_STATE,
} from "./styles";
import { adminFetch } from "../passes/v2/shared";
import { useAdminFetch } from "./useAdminFetch";

export type Level = "new" | "trusted" | "partner";
export const LEVELS: Level[] = ["new", "trusted", "partner"];
export const LEVEL_LABEL: Record<Level, string> = { new: "New", trusted: "Trusted", partner: "Partner" };
export const LEVEL_BADGE: Record<Level, string> = { new: BADGE_AMBER, trusted: BADGE_BLUE, partner: BADGE_GREEN };

type Feature = { key: string; group: string; label: string; capUnit?: string };
type Entry = { on: boolean; cap: number | null; source?: "level" | "custom" | "killSwitch" };
type Table = Record<string, Entry>;
type Config = { features: Feature[]; levels: Record<Level, Table>; killSwitches: Record<string, boolean> };
type OrgPerms = {
  trustLevel: Level; suspended: boolean; overrides: Record<string, Entry>; permissions: Table;
  frozen: boolean; frozenAt: string | null; frozenReason: string | null;
  qualify: { gamesCompleted: number; cancellationRate: number; averageRating: number; ratings: number };
};
type LogRow = { _id: string; at: string; action: string; adminName?: string; adminEmail?: string; reason?: string; before?: unknown; after?: unknown; detail?: unknown; game?: { title?: string } | null; actor?: { name?: string } | null };

const INPUT = `${SEARCH_INPUT} min-w-0! w-full`;
const PRIMARY = `${ACTION_BTN} border-fg! bg-fg! text-black!`;
const DANGER = `${ACTION_BTN} border-[rgba(239,68,68,0.5)]! text-danger!`;
const TAB = (on: boolean) => `${ACTION_BTN} ${on ? "border-fg! text-fg!" : ""}`;

/** Is the signed-in admin a superadmin? (Edit controls are greyed otherwise.) */
export function useIsSuperadmin() {
  const { data } = useAdminFetch<{ admin?: { role?: string } }>("/admin/me", { cache: true });
  return data?.admin?.role === "superadmin";
}

function groupBy(features: Feature[]) {
  const out: Record<string, Feature[]> = {};
  for (const f of features) (out[f.group] ||= []).push(f);
  return out;
}

/* One toggle row: on/off + optional cap. */
function ToggleRow({ f, value, onChange, badge, disabled, onReset }: {
  f: Feature; value: Entry; onChange: (v: Entry) => void; badge?: React.ReactNode; disabled?: boolean; onReset?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[10px] border-b border-border py-[8px] text-[13px]">
      <label className="flex min-w-[260px] flex-1 cursor-pointer items-center gap-2 text-body">
        <input type="checkbox" checked={value.on} disabled={disabled}
          onChange={(e) => onChange({ ...value, on: e.target.checked })} />
        {f.label}
      </label>
      {f.capUnit && (
        <label className="flex items-center gap-[6px] text-[12px] text-muted">
          Cap
          <input className={`${FILTER_SELECT} w-[80px]`} type="number" min={0} disabled={disabled || !value.on}
            value={value.cap ?? ""} placeholder="none"
            onChange={(e) => onChange({ ...value, cap: e.target.value === "" ? null : Number(e.target.value) })} />
          <span>{f.capUnit}</span>
        </label>
      )}
      {badge}
      {onReset && <button type="button" className={ACTION_BTN} disabled={disabled} onClick={onReset}>Reset to level</button>}
    </div>
  );
}

function ReasonAndSave({ reason, setReason, busy, error, onSave, label = "Save", disabled, danger }: {
  reason: string; setReason: (s: string) => void; busy: boolean; error: string; onSave: () => void; label?: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <div className="mt-[14px] flex flex-col gap-[10px]">
      <label className={FORM_LABEL}>
        Reason (optional, the organiser sees it)
        <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} disabled={disabled} />
      </label>
      {error && <div className={FORM_ERROR}>{error}</div>}
      <div className={MODAL_ACTIONS}>
        <button type="button" className={danger ? DANGER : PRIMARY} disabled={busy || disabled} onClick={onSave}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}

/* ── One organiser ───────────────────────────────────────────────────────── */

export function OrganiserPermissionsModal({ organiser, candidates, onClose, onChanged }: {
  organiser: { id: string; name: string };
  /** Active, approved organisers a transfer can go to. */
  candidates: { id: string; name: string }[];
  onClose: () => void; onChanged: () => void;
}) {
  const isSuper = useIsSuperadmin();
  const [tab, setTab] = useState<"permissions" | "controls" | "log">("permissions");
  const cfg = useAdminFetch<{ data?: Config }>("/admin/organiser-permissions/config");
  const org = useAdminFetch<{ data?: OrgPerms }>(`/admin/organisers/${organiser.id}/permissions`);
  const p = org.data?.data;
  const features = cfg.data?.data?.features ?? [];

  // Drafts over the saved values; cleared after a save.
  const [levelDraft, setLevel] = useState<Level | null>(null);
  const level: Level = levelDraft ?? p?.trustLevel ?? "partner";
  const [edits, setEdits] = useState<Record<string, Entry | null>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const levelTable = cfg.data?.data?.levels?.[level];
  const kill = cfg.data?.data?.killSwitches ?? {};
  // What the screen shows: kill switch → pending edit → saved override → level preset.
  const shown = (k: string): Entry & { source: string } => {
    if (kill[k]) return { on: false, cap: null, source: "killSwitch" };
    if (k in edits) return edits[k] ? { ...edits[k]!, source: "custom" } : { ...(levelTable?.[k] ?? { on: true, cap: null }), source: "level" };
    if (p?.overrides?.[k]) return { ...p.overrides[k], source: "custom" };
    return { ...(levelTable?.[k] ?? { on: true, cap: null }), source: "level" };
  };

  async function run(path: string, method: string, body: object, okMsg: string) {
    setBusy(true); setError(""); setMsg("");
    const r = await adminFetch(path, { method, body: JSON.stringify({ ...body, reason: reason.trim() }) });
    setBusy(false);
    if (!r.ok) { setError(r.message || "Failed."); return false; }
    setReason(""); setMsg(okMsg); setLevel(null); setEdits({}); org.refresh(); onChanged();
    return true;
  }

  const savePermissions = () => run(`/admin/organisers/${organiser.id}/permissions`, "PATCH",
    { trustLevel: level, overrides: edits }, "Saved. The organiser has been notified.");

  return (
    <div className={MODAL_OVERLAY} onClick={busy ? undefined : onClose}>
      <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div>
            <div className={SECTION_TITLE}>Permissions · {organiser.name}</div>
            {p && (
              <div className="mt-[6px] flex flex-wrap gap-[6px]">
                <span className={`${BADGE} ${p.suspended ? BADGE_RED : LEVEL_BADGE[p.trustLevel]}`}>{p.suspended ? "Suspended" : LEVEL_LABEL[p.trustLevel]}</span>
                {p.frozen && <span className={`${BADGE} ${BADGE_RED}`}>Frozen</span>}
              </div>
            )}
          </div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!isSuper && <div className="mb-3 text-[12.5px] text-muted">Read only: only a super admin can change permissions.</div>}
        <div className="mb-4 flex gap-[6px]">
          <button type="button" className={TAB(tab === "permissions")} onClick={() => setTab("permissions")}>Permissions</button>
          <button type="button" className={TAB(tab === "controls")} onClick={() => setTab("controls")}>Freeze &amp; transfer</button>
          <button type="button" className={TAB(tab === "log")} onClick={() => setTab("log")}>Log</button>
        </div>

        {(cfg.loading || org.loading) && <div className={LOADING_STATE}>Loading…</div>}
        {(cfg.error || org.error) && <div className={FORM_ERROR}>{cfg.error || org.error}</div>}
        {msg && <div className="mb-3 text-[13px] text-success">{msg}</div>}

        {p && tab === "permissions" && (
          <>
            <div className="mb-3 text-[12.5px] text-muted">
              Qualifies to move up? {p.qualify.gamesCompleted} games completed · {p.qualify.cancellationRate}% cancelled ·
              {" "}{p.qualify.ratings ? `★ ${p.qualify.averageRating} (${p.qualify.ratings})` : "no ratings yet"}
            </div>
            <label className={`${FORM_LABEL} mb-3 max-w-[260px]`}>
              Level
              <select className={FILTER_SELECT} value={level} disabled={!isSuper} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </label>
            <div className="mb-2 text-[12px] text-muted">Suspend / reactivate stays on the organiser list. Changing a toggle makes it <em>custom</em> for this organiser.</div>
            {Object.entries(groupBy(features)).map(([group, list]) => (
              <div key={group} className="mb-3">
                <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{group}</div>
                {list.map((f) => {
                  const v = shown(f.key);
                  return (
                    <ToggleRow key={f.key} f={f} value={v} disabled={!isSuper || v.source === "killSwitch"}
                      onChange={(nv) => setEdits((e) => ({ ...e, [f.key]: { on: nv.on, cap: nv.cap } }))}
                      onReset={v.source === "custom" ? () => setEdits((e) => ({ ...e, [f.key]: null })) : undefined}
                      badge={v.source === "custom" ? <span className={`${BADGE} ${BADGE_AMBER}`}>custom</span>
                        : v.source === "killSwitch" ? <span className={`${BADGE} ${BADGE_RED}`}>off for everyone</span> : null} />
                  );
                })}
              </div>
            ))}
            <ReasonAndSave reason={reason} setReason={setReason} busy={busy} error={error} disabled={!isSuper} onSave={savePermissions} />
          </>
        )}

        {p && tab === "controls" && (
          <ControlsTab organiserId={organiser.id} others={candidates.filter((c) => c.id !== organiser.id)} frozen={p.frozen} frozenReason={p.frozenReason} isSuper={isSuper}
            reason={reason} setReason={setReason} busy={busy} error={error} run={run} />
        )}

        {tab === "log" && <LogTab organiserId={organiser.id} />}
      </div>
    </div>
  );
}

function ControlsTab({ organiserId, others, frozen, frozenReason, isSuper, reason, setReason, busy, error, run }: {
  organiserId: string; others: { id: string; name: string }[]; frozen: boolean; frozenReason: string | null; isSuper: boolean;
  reason: string; setReason: (s: string) => void; busy: boolean; error: string;
  run: (path: string, method: string, body: object, okMsg: string) => Promise<boolean>;
}) {
  const [action, setAction] = useState<"freeze" | "transfer" | "pause">("freeze");
  const [toId, setToId] = useState("");

  const save = () => {
    if (action === "freeze") {
      return run(`/admin/organisers/${organiserId}/freeze`, "POST", { frozen: !frozen }, frozen ? "Unfrozen." : "Frozen. Existing games still run.");
    }
    if (action === "transfer") {
      return run(`/admin/organisers/${organiserId}/transfer`, "POST", { toOrganiserId: toId }, "Upcoming games and schedules moved. Both organisers were notified.");
    }
    return run(`/admin/organisers/${organiserId}/pause-series`, "POST", {}, "Recurring schedules paused.");
  };

  return (
    <div className="flex flex-col gap-3 text-[13.5px] text-body">
      <div className="flex gap-[6px]">
        <button type="button" className={TAB(action === "freeze")} onClick={() => setAction("freeze")}>{frozen ? "Unfreeze" : "Freeze"}</button>
        <button type="button" className={TAB(action === "transfer")} onClick={() => setAction("transfer")}>Transfer games</button>
        <button type="button" className={TAB(action === "pause")} onClick={() => setAction("pause")}>Pause all series</button>
      </div>
      {action === "freeze" && (frozen
        ? <div>Frozen{frozenReason ? `: ${frozenReason}` : ""}. Unfreezing lets them create games and take new players again.</div>
        : <div>Freezing stops new games, new players and waitlist promotions. Their existing games still run. Different from Suspend: they can still log in.</div>)}
      {action === "transfer" && (
        <>
          <div>Moves every upcoming game and live recurring schedule to another organiser. Completed games stay (earnings history).</div>
          <label className={FORM_LABEL}>
            Move to
            <select className={FILTER_SELECT} value={toId} disabled={!isSuper} onChange={(e) => setToId(e.target.value)}>
              <option value="">Pick an organiser…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </>
      )}
      {action === "pause" && <div>Pauses every active recurring schedule of this organiser. No new games are made until each is resumed.</div>}
      <ReasonAndSave reason={reason} setReason={setReason} busy={busy} error={error}
        disabled={!isSuper || (action === "transfer" && !toId)} onSave={save} danger={action !== "pause" && !(action === "freeze" && frozen)}
        label={action === "freeze" ? (frozen ? "Unfreeze" : "Freeze") : action === "transfer" ? "Transfer" : "Pause all"} />
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  cancel: "Cancelled a game", remove_player: "Removed a player", edit: "Edited fee / policy / kickoff",
  switch_format: "Switched format", sos: "Sent an SOS", invite: "Sent invites",
  permissions: "Permissions changed", level: "Level changed", freeze: "Frozen", unfreeze: "Unfrozen",
  transfer: "Games transferred", pause_series: "Series paused",
};
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const short = (v: unknown) => (v == null ? "" : JSON.stringify(v).slice(0, 160));

function LogTab({ organiserId }: { organiserId: string }) {
  const { data, loading, error } = useAdminFetch<{ data?: { audits: LogRow[]; actions: LogRow[] } }>(`/admin/organisers/${organiserId}/logs`);
  const d = data?.data;
  if (loading) return <div className={LOADING_STATE}>Loading…</div>;
  if (error) return <div className={FORM_ERROR}>{error}</div>;
  const block = (title: string, rows: LogRow[], admin: boolean) => (
    <div className="mb-4">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{title}</div>
      {rows.length === 0 && <div className="text-[13px] text-muted">Nothing yet.</div>}
      {rows.map((r) => (
        <div key={r._id} className="border-b border-border py-[6px] text-[13px]">
          <div className="text-body">{ACTION_LABEL[r.action] || r.action}{r.game?.title ? ` · ${r.game.title}` : ""}</div>
          <div className="font-mono text-[11px] text-muted">
            {fmt(r.at)} · {admin ? `by ${r.adminName || r.adminEmail || "admin"}` : r.actor?.name || "organiser"}
            {r.reason ? ` · “${r.reason}”` : ""}
          </div>
          {admin
            ? <div className="font-mono text-[11px] text-muted">{short(r.before)} → {short(r.after)}</div>
            : r.detail ? <div className="font-mono text-[11px] text-muted">{short(r.detail)}</div> : null}
        </div>
      ))}
    </div>
  );
  return <>{block("Admin changes", d?.audits ?? [], true)}{block("Risky organiser actions", d?.actions ?? [], false)}</>;
}

/* ── Platform: presets + kill switches ───────────────────────────────────── */

export function LevelsModal({ onClose }: { onClose: () => void }) {
  const isSuper = useIsSuperadmin();
  const { data, loading, error: loadErr, refresh } = useAdminFetch<{ data?: Config }>("/admin/organiser-permissions/config");
  const cfg = data?.data;
  const [tab, setTab] = useState<Level | "kill">("new");
  const [levelsDraft, setLevels] = useState<Record<Level, Table> | null>(null);
  const [killDraft, setKill] = useState<Record<string, boolean> | null>(null);
  const levels = levelsDraft ?? cfg?.levels ?? null;
  const kill = killDraft ?? cfg?.killSwitches ?? {};
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setError(""); setMsg("");
    const r = tab === "kill"
      ? await adminFetch("/admin/organiser-permissions/kill-switches", { method: "PUT", body: JSON.stringify({ killSwitches: Object.fromEntries((cfg?.features ?? []).map((f) => [f.key, !!kill[f.key]])), reason: reason.trim() }) })
      : await adminFetch("/admin/organiser-permissions/levels", { method: "PUT", body: JSON.stringify({ levels, reason: reason.trim() }) });
    setBusy(false);
    if (!r.ok) { setError(r.message || "Failed."); return; }
    setReason(""); setMsg("Saved. Applies on the organisers' next request."); setLevels(null); setKill(null); refresh();
  }

  return (
    <div className={MODAL_OVERLAY} onClick={busy ? undefined : onClose}>
      <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>Organiser levels &amp; kill switches</div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {!isSuper && <div className="mb-3 text-[12.5px] text-muted">Read only: only a super admin can change these.</div>}
        <div className="mb-4 flex flex-wrap gap-[6px]">
          {LEVELS.map((l) => <button key={l} type="button" className={TAB(tab === l)} onClick={() => setTab(l)}>{LEVEL_LABEL[l]}</button>)}
          <button type="button" className={TAB(tab === "kill")} onClick={() => setTab("kill")}>Kill switches</button>
        </div>
        {loading && <div className={LOADING_STATE}>Loading…</div>}
        {loadErr && <div className={FORM_ERROR}>{loadErr}</div>}
        {msg && <div className="mb-3 text-[13px] text-success">{msg}</div>}
        {cfg && levels && tab !== "kill" && (
          <>
            <div className="mb-2 text-[12px] text-muted">Applies to everyone on {LEVEL_LABEL[tab]}, except toggles set custom on an organiser.</div>
            {cfg.features.map((f) => (
              <ToggleRow key={f.key} f={f} value={levels[tab][f.key]} disabled={!isSuper}
                onChange={(v) => setLevels({ ...levels, [tab]: { ...levels[tab], [f.key]: { on: v.on, cap: v.cap } } })} />
            ))}
          </>
        )}
        {cfg && tab === "kill" && (
          <>
            <div className="mb-2 text-[12px] text-muted">A ticked feature is OFF for every organiser, whatever their level or custom toggles. New actions only; existing games keep running.</div>
            {cfg.features.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-center gap-2 border-b border-border py-[8px] text-[13px] text-body">
                <input type="checkbox" checked={!!kill[f.key]} disabled={!isSuper} onChange={(e) => setKill({ ...kill, [f.key]: e.target.checked })} />
                {f.label}
                {kill[f.key] && <span className={`${BADGE} ${BADGE_RED}`}>off for everyone</span>}
              </label>
            ))}
          </>
        )}
        {cfg && <ReasonAndSave reason={reason} setReason={setReason} busy={busy} error={error} disabled={!isSuper} onSave={save} />}
      </div>
    </div>
  );
}

/* ── Bulk "Move to level…" ───────────────────────────────────────────────── */

export function BulkLevelModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const isSuper = useIsSuperadmin();
  const [level, setLevel] = useState<Level>("trusted");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    const r = await adminFetch("/admin/organisers/bulk-level", { method: "POST", body: JSON.stringify({ ids, trustLevel: level, reason: reason.trim() }) });
    setBusy(false);
    if (!r.ok) { setError(r.message || "Failed."); return; }
    onDone();
  }
  return (
    <div className={MODAL_OVERLAY} onClick={busy ? undefined : onClose}>
      <div className={`${MODAL} max-w-[440px]!`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>Move {ids.length} organiser{ids.length === 1 ? "" : "s"} to level</div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <label className={FORM_LABEL}>
          Level
          <select className={FILTER_SELECT} value={level} disabled={!isSuper} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>
        <div className="mt-2 text-[12px] text-muted">Custom toggles on each organiser stay as they are.</div>
        <ReasonAndSave reason={reason} setReason={setReason} busy={busy} error={error} disabled={!isSuper} onSave={save} label="Move" />
      </div>
    </div>
  );
}

export const RiskBadges = ({ flags }: { flags?: { key: string; label: string }[] }) =>
  flags?.length ? (
    <div className="mt-[3px] flex flex-wrap gap-[4px]">
      {flags.map((f) => <span key={f.key} className={`${BADGE} ${BADGE_RED}`} title="Flag only: nothing changes on its own">⚑ {f.label}</span>)}
    </div>
  ) : null;

