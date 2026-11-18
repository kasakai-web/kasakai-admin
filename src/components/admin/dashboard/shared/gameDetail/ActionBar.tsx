"use client";

/* The game-wide actions: edit, move kickoff, change format, open / confirm /
   complete, SOS, invite, cancel. Shown only to a superadmin (canControl).

   Deliberately absent (each breaks a rule the backend keeps on purpose): a free
   status dropdown, cancel without refund, and editing the fee — a format change
   is the only way the fee moves, and only down. */

import { useState } from "react";
import { ACTION_BTN, FORM_GRID, FORM_LABEL, FILTER_SELECT } from "../styles";
import { formatCurrency } from "../format";
import { adminFetch } from "../../passes/v2/shared";
import { useAdminFetch } from "../useAdminFetch";
import {
  ActionDialog, DANGER_BTN, INPUT, act, isActiveReg, toIstInput, fromIstInput, type GameFull,
} from "./common";

type Dialog = null | "edit" | "kickoff" | "format" | "open" | "confirm" | "complete" | "sos" | "invite" | "cancel";
const FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"];
const LIVE = ["open", "tentative", "confirmed"];

export function ActionBar({ game, onChanged }: { game: GameFull; onChanged: (msg?: string) => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const done = (msg?: string) => { setDialog(null); onChanged(msg); };
  const status = game.status || "";
  // Read once when the panel opens; the server re-checks every rule anyway.
  const [openedAt] = useState(Date.now);
  const started = game.scheduledAt ? new Date(game.scheduledAt).getTime() <= openedAt : false;
  const final = status === "completed" || status === "cancelled";

  const btn = (key: Dialog, label: string, show = true, cls = ACTION_BTN) =>
    show ? <button key={key} className={cls} type="button" onClick={() => setDialog(key)}>{label}</button> : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-[6px] border border-border bg-surface px-3 py-[10px]">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Admin controls</span>
        {btn("edit", "Edit", !final)}
        {btn("kickoff", "Move kickoff", !final && !started)}
        {btn("format", "Change format", LIVE.includes(status) && game.format !== "Screening")}
        {btn("open", "Open registration", status === "draft")}
        {btn("confirm", "Confirm", status === "open" || status === "tentative")}
        {btn("complete", "Mark complete", status === "confirmed" && started)}
        {btn("sos", "SOS", LIVE.includes(status) && !started)}
        {btn("invite", "Invite", LIVE.includes(status) && !started)}
        <span className="flex-1" />
        {btn("cancel", "Cancel game", !final, DANGER_BTN)}
      </div>

      {dialog === "edit" && <EditDialog game={game} onClose={close} onDone={done} />}
      {dialog === "kickoff" && <KickoffDialog game={game} onClose={close} onDone={done} />}
      {dialog === "format" && <FormatDialog game={game} onClose={close} onDone={done} />}
      {dialog === "open" && (
        <ActionDialog title="Open registration" confirmLabel="Open" onClose={close} onDone={done}
          run={() => act(game._id, "open", "PATCH")}>
          Players will be able to find and join this game.
        </ActionDialog>
      )}
      {dialog === "confirm" && (
        <ActionDialog title="Confirm game" confirmLabel="Confirm" onClose={close} onDone={done}
          run={() => act(game._id, "confirm", "PATCH")}>
          Every player is told the game is on. A confirmed game is never moved back to open.
        </ActionDialog>
      )}
      {dialog === "complete" && (
        <ActionDialog title="Mark complete" confirmLabel="Mark complete" onClose={close} onDone={done}
          run={() => act(game._id, "complete", "PATCH")}>
          Feedback opens for the players. Attendance can then be marked on the Roster tab.
        </ActionDialog>
      )}
      {dialog === "sos" && <SosDialog game={game} onClose={close} onDone={done} />}
      {dialog === "invite" && <InviteDialog game={game} onClose={close} onDone={done} />}
      {dialog === "cancel" && <CancelDialog game={game} onClose={close} onDone={done} />}
    </>
  );
}

type DialogProps = { game: GameFull; onClose: () => void; onDone: (msg?: string) => void };

function EditDialog({ game, onClose, onDone }: DialogProps) {
  const confirmed = game.status === "confirmed";
  const [title, setTitle] = useState(game.title || "");
  const [slots, setSlots] = useState(String(game.totalSlots ?? ""));
  const [min, setMin]     = useState(String(game.minPlayers ?? ""));
  const [dur, setDur]     = useState(String(game.durationMins ?? ""));

  return (
    <ActionDialog title="Edit game" confirmLabel="Save" onClose={onClose} onDone={onDone} needsReason={false}
      run={(reason) => {
        const body: Record<string, unknown> = { reason };
        if (title.trim() && title.trim() !== game.title) body.title = title.trim();
        if (slots && Number(slots) !== game.totalSlots) body.totalSlots = Number(slots);
        if (!confirmed && min && Number(min) !== game.minPlayers) body.minPlayers = Number(min);
        if (dur && Number(dur) !== game.durationMins) body.durationMins = Number(dur);
        return act(game._id, "edit", "PATCH", body);
      }}>
      <label className={FORM_LABEL}>Title<input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <div className={FORM_GRID}>
        <label className={FORM_LABEL}>Total slots<input className={INPUT} type="number" min={2} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
        <label className={FORM_LABEL}>
          Min players{confirmed ? " (locked once confirmed)" : ""}
          <input className={INPUT} type="number" min={2} value={min} disabled={confirmed} onChange={(e) => setMin(e.target.value)} />
        </label>
        <label className={FORM_LABEL}>Duration (min)<input className={INPUT} type="number" min={15} value={dur} onChange={(e) => setDur(e.target.value)} /></label>
      </div>
      <div className="text-[12px] text-muted">Format and fee change only through Change format. Slots cannot go below the seats already taken.</div>
    </ActionDialog>
  );
}

function KickoffDialog({ game, onClose, onDone }: DialogProps) {
  const [when, setWhen] = useState(toIstInput(game.scheduledAt));
  const lc = game.lifecycle || {};
  return (
    <ActionDialog title="Move kickoff" confirmLabel="Move kickoff" onClose={onClose} onDone={onDone} needsReason
      reasonHint="e.g. Turf double-booked — the organisers see this"
      run={(reason) => {
        const iso = fromIstInput(when);
        if (!iso || !game.scheduledAt) return Promise.resolve({ ok: false, message: "Pick a new time." });
        // Check-ins that have not run yet move by the same amount, so they still
        // fall before the new kickoff (updateGame refuses one that would not).
        const delta = new Date(iso).getTime() - new Date(game.scheduledAt).getTime();
        const shift = (at?: string | null, done?: string | null) =>
          at && !done ? new Date(new Date(at).getTime() + delta).toISOString() : undefined;
        const lifecycle: Record<string, string> = {};
        const f = shift(lc.firstCheckAt, lc.firstCheckDoneAt);
        const s = shift(lc.secondCheckAt, lc.secondCheckDoneAt);
        if (f) lifecycle.firstCheckAt = f;
        if (s) lifecycle.secondCheckAt = s;
        return act(game._id, "edit", "PATCH", { scheduledAt: iso, ...(f || s ? { lifecycle } : {}), reason });
      }}>
      <label className={FORM_LABEL}>New kickoff (IST)
        <input className={INPUT} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <div className="text-[12px] text-muted">
        Everyone holding a place is told the new time, as if the organiser moved it. Players who joined before the move can
        leave without a cancellation fee. Check-ins that have not run move by the same amount.
      </div>
    </ActionDialog>
  );
}

function FormatDialog({ game, onClose, onDone }: DialogProps) {
  const [format, setFormat] = useState(game.format && FORMATS.includes(game.format) ? game.format : "7v7");
  const [slots, setSlots]   = useState(String(game.totalSlots ?? ""));
  const [min, setMin]       = useState(String(game.minPlayers ?? ""));
  const [fee, setFee]       = useState(String(Math.round((game.feeInPaise || 0) / 100)));
  const feePaise = Math.round(Number(fee || 0) * 100);
  const diff = (game.feeInPaise || 0) - feePaise;
  const paidSeats = game.registrations.filter((r) => isActiveReg(r) && (r.amountPaidPaise || 0) > 0).length;

  return (
    <ActionDialog title="Change format" confirmLabel="Change format" onClose={onClose} onDone={onDone} needsReason
      disabled={feePaise > (game.feeInPaise || 0)}
      run={(reason) => act(game._id, "format", "POST", { format, maxPlayers: Number(slots), minPlayers: Number(min), feeInPaise: feePaise, reason })}>
      <div className={FORM_GRID}>
        <label className={FORM_LABEL}>Format
          <select className={FILTER_SELECT} value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className={FORM_LABEL}>Fee per player (₹)<input className={INPUT} type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        <label className={FORM_LABEL}>Total slots<input className={INPUT} type="number" min={2} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
        <label className={FORM_LABEL}>Min players<input className={INPUT} type="number" min={2} value={min} onChange={(e) => setMin(e.target.value)} /></label>
      </div>
      {feePaise > (game.feeInPaise || 0)
        ? <div className="text-[13px] text-danger">The fee can only stay the same or go down. A format change never charges players more.</div>
        : <div className="text-[12px] text-muted">
            Players who said &quot;No&quot; to format changes leave with a full refund.
            {diff > 0 ? ` Every paying seat (${paidSeats} now) gets ${formatCurrency(diff)} back.` : ""}
            {" "}Teams already sent are rebuilt and re-sent automatically. Players are told as if the organiser changed it.
          </div>}
    </ActionDialog>
  );
}

type Regular = { id: string; name: string; games: number; phone: string };

function SosDialog({ game, onClose, onDone }: DialogProps) {
  const { data, error } = useAdminFetch<{ data?: { regulars: Regular[] } }>(
    `/admin/games/${game._id}/act/regulars`, { errorMessage: "Could not load regulars." });
  const list = data ? data.data?.regulars || [] : null;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ActionDialog title="SOS to regulars" confirmLabel={`Send to ${picked.size}`} onClose={onClose} onDone={onDone}
      disabled={picked.size === 0}
      run={() => act(game._id, "sos", "POST", { playerIds: [...picked] })}>
      <div className="text-[12px] text-muted">A WhatsApp goes to each picked player in the organiser&apos;s name.</div>
      {error && <div className="text-danger">{error}</div>}
      {list === null && !error && <div className="text-muted">Loading regulars…</div>}
      {list?.length === 0 && <div className="text-muted">This venue has no regulars to ask.</div>}
      <div className="max-h-[280px] overflow-y-auto">
        {list?.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-2 py-1 text-[13px]">
            <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
            {r.name} <span className="font-mono text-[11px] text-muted">{r.phone} · {r.games} games</span>
          </label>
        ))}
      </div>
    </ActionDialog>
  );
}

function InviteDialog({ game, onClose, onDone }: DialogProps) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const linkOn = game.inviteLinkEnabled !== false;

  return (
    <ActionDialog title="Invite" confirmLabel="Send invite" onClose={onClose} onDone={onDone}
      disabled={!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10))}
      run={() => act(game._id, "invite", "POST", { invitees: [{ name: name.trim() || "Player", phone: phone.replace(/\D/g, "").slice(-10) }] })}>
      <div className={FORM_GRID}>
        <label className={FORM_LABEL}>Name<input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={FORM_LABEL}>Mobile<input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 digits" /></label>
      </div>
      <div className="text-[12px] text-muted">The invite reaches them on WhatsApp from the organiser.</div>
      <div className="flex items-center gap-2 border-t border-border pt-3 text-[13px]">
        Shared invite link is <strong>{linkOn ? "on" : "off"}</strong>
        <button className={ACTION_BTN} type="button" onClick={async () => {
          const r = await act(game._id, "invite-link", "PATCH", { enabled: !linkOn });
          if (r.ok) onDone(`Invite link turned ${linkOn ? "off" : "on"}.`); else setLinkMsg(r.message || "Failed.");
        }}>Turn {linkOn ? "off" : "on"}</button>
        {linkMsg && <span className="text-danger">{linkMsg}</span>}
      </div>
    </ActionDialog>
  );
}

function CancelDialog({ game, onClose, onDone }: DialogProps) {
  const live = game.registrations.filter(isActiveReg);
  const refund = live.reduce((s, r) => s + (r.amountPaidPaise || 0), 0);
  return (
    <ActionDialog title="Cancel game" confirmLabel="Cancel game" danger onClose={onClose} onDone={onDone} needsReason
      reasonHint="Players see this reason, as the organiser's"
      run={(reason) => adminFetch(`/admin/games/${game._id}`, { method: "DELETE", body: JSON.stringify({ reason }) })}>
      <div>
        All {live.length} seat{live.length === 1 ? "" : "s"} are refunded in full ({formatCurrency(refund)}), cancellation fees
        already paid go back, and pass uses and discount codes are returned. <span className="text-danger">This cannot be undone.</span>
      </div>
      <div className="text-[12px] text-muted">
        Players are told the organiser cancelled. The organisers are told KasaKai admin cancelled it.
      </div>
    </ActionDialog>
  );
}
