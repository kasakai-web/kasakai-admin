"use client";

/* Who is in the game: registrations, join requests, waitlist — and, for a
   superadmin, the organiser's roster actions. A removal is the organiser's own
   removeRegistration: always refunded, always free of a cancellation fee. */

import { useState } from "react";
import {
  BADGE, BADGE_BLUE, BADGE_GRAY, TABLE_WRAP, TABLE, BLOCK_TITLE, BLOCK_TITLE_SUCCESS,
  ACTION_BTN, ACTIONS, FORM_GRID, FORM_LABEL, FILTER_SELECT, FORM_ERROR,
} from "../styles";
import { formatDate, formatCurrency, formatStatusLabel, badgeClassForStatus } from "../format";
import {
  ActionDialog, INPUT, PRIMARY_BTN, act, isActiveReg, regName, type GameFull, type GameRegistration,
} from "./common";

type Props = { game: GameFull; onChanged: (msg?: string) => void };
const ATTENDANCE = ["present", "absent", "no_show", "not_marked"];

export function RosterTab({ game, onChanged }: Props) {
  const can = !!game.canControl;
  const final = game.status === "completed" || game.status === "cancelled";
  const regs = game.registrations || [];
  const requests = (game.invitations || []).filter((i) => i.status === "pending");
  const [removing, setRemoving] = useState<GameRegistration | null>(null);
  const [guestFor, setGuestFor] = useState<GameRegistration | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const quick = async (path: string, method: string, msg: string) => {
    setError("");
    const r = await act(game._id, path, method);
    if (r.ok) onChanged(msg); else setError(r.message || "Action failed.");
  };

  return (
    <>
      {error && <div className={`${FORM_ERROR} mb-3`}>{error}</div>}

      <div className="flex items-center justify-between">
        <div className={BLOCK_TITLE_SUCCESS}>Registrations ({regs.filter(isActiveReg).length} live · {regs.length} rows)</div>
        {can && !final && <button className={PRIMARY_BTN} type="button" onClick={() => setAdding(true)}>+ Add player / guest</button>}
      </div>

      {can && game.status === "completed"
        ? <AttendanceSheet game={game} onChanged={onChanged} />
        : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>#</th><th>Player / Guest</th><th>Type</th><th>Position</th><th>Team</th><th>Payment</th><th>Paid</th><th>Attended</th><th>Signed up</th></tr>
              </thead>
              <tbody>
                {regs.length === 0 && <tr><td colSpan={9} className="p-6! text-center text-muted!">No registrations.</td></tr>}
                {regs.map((r, i) => {
                  const live = isActiveReg(r);
                  const editable = can && !final && live;
                  return (
                    <tr key={r._id} className={live ? "" : "opacity-50"}>
                      <td>{i + 1}</td>
                      <td>
                        <span className="inline-flex items-center gap-[6px] rounded-[3px] border border-border-2 px-2 py-[2px]">
                          {regName(r)}
                          {editable && (
                            <button type="button" title={`Remove ${regName(r)}`} aria-label={`Remove ${regName(r)}`}
                              className="cursor-pointer border-none bg-transparent p-0 text-[12px] leading-none text-danger hover:opacity-70"
                              onClick={() => setRemoving(r)}>✕</button>
                          )}
                        </span>
                        {!r.plusOneName && r.player?.phone && <div className="text-[11px] text-muted">{r.player.phone}</div>}
                        {editable && !r.plusOneName && (
                          <button type="button" className={`${ACTION_BTN} mt-1 px-[6px]! py-0! text-[10px]!`} onClick={() => setGuestFor(r)}>+ Guest</button>
                        )}
                        {!live && <div className="text-[11px] text-muted">{r.removedAt ? "Removed" : r.backedOutAt ? "Cancelled" : r.optedOut ? "Opted out" : formatStatusLabel(r.paymentStatus)}</div>}
                      </td>
                      <td>{r.plusOneName ? <span className={`${BADGE} ${BADGE_GRAY}`}>Guest</span> : <span className={`${BADGE} ${BADGE_BLUE}`}>Player</span>}</td>
                      <td>{formatStatusLabel(r.preferredPosition)}</td>
                      <td>{r.assignedTeam || formatStatusLabel(r.teamPreference)}</td>
                      <td><span className={`${BADGE} ${badgeClassForStatus(r.paymentStatus)}`}>{formatStatusLabel(r.paymentStatus)}</span></td>
                      <td>{formatCurrency(r.amountPaidPaise)}</td>
                      <td><span className={`${BADGE} ${badgeClassForStatus(r.attended)}`}>{formatStatusLabel(r.attended)}</span></td>
                      <td>{formatDate(r.signedUpAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {requests.length > 0 && (
        <>
          <div className={`${BLOCK_TITLE} mt-5!`}>Join requests ({requests.length})</div>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead><tr><th>#</th><th>Who</th><th>Via</th><th>Invited by</th>{can && <th></th>}</tr></thead>
              <tbody>
                {requests.map((q, i) => (
                  <tr key={q._id}>
                    <td>{i + 1}</td>
                    <td>{q.isGuest ? `${q.plusOneName || "Guest"} (guest)` : q.player?.name || q.inviteeName || "Player"}</td>
                    <td>{formatStatusLabel(q.via)}</td>
                    <td>{q.invitedByName || "—"}</td>
                    {can && (
                      <td>
                        <div className={ACTIONS}>
                          <button className={PRIMARY_BTN} type="button" onClick={() => quick(`invitations/${q._id}/approve`, "POST", "Request approved.")}>Approve</button>
                          <button className={ACTION_BTN} type="button" onClick={() => quick(`invitations/${q._id}/reject`, "POST", "Request rejected.")}>Reject</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(game.waitlist?.length ?? 0) > 0 && (
        <>
          <div className={`${BLOCK_TITLE} mt-5!`}>Waitlist ({game.waitlist.length})</div>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead><tr><th>#</th><th>Player</th><th>Phone</th><th>Position</th><th>Status</th><th>Joined</th>{can && !final && <th></th>}</tr></thead>
              <tbody>
                {game.waitlist.map((w, i) => (
                  <tr key={w._id}>
                    <td>{i + 1}</td>
                    <td>{w.player?.name || "Unknown"}</td>
                    <td>{w.player?.phone || "—"}</td>
                    <td>{formatStatusLabel(w.preferredPosition)}</td>
                    <td><span className={`${BADGE} ${badgeClassForStatus(w.status)}`}>{formatStatusLabel(w.status)}</span></td>
                    <td>{formatDate(w.joinedAt)}</td>
                    {can && !final && (
                      <td>{(w.status === "waiting" || w.status === "notified") && (
                        <button className={PRIMARY_BTN} type="button" onClick={() => quick(`waitlist/${w._id}/approve`, "POST", "Waitlisted player approved.")}>Approve</button>
                      )}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {removing && (
        <ActionDialog title="Remove from game" confirmLabel="Remove & refund" danger needsReason
          onClose={() => setRemoving(null)} onDone={(m) => { setRemoving(null); onChanged(m || "Removed."); }}
          run={(reason) => act(game._id, `registrations/${removing._id}`, "DELETE", { reason })}>
          Remove <strong>{regName(removing)}</strong>? {formatCurrency(removing.amountPaidPaise)} goes back to their wallet and
          no cancellation fee is charged. They are told the organiser removed them.
        </ActionDialog>
      )}
      {adding && <AddDialog game={game} onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); onChanged(m); }} />}
      {guestFor && <GuestForPlayerDialog game={game} host={guestFor} onClose={() => setGuestFor(null)} onDone={(m) => { setGuestFor(null); onChanged(m); }} />}
    </>
  );
}

const POSITIONS = ["any", "goalkeeper", "defender", "midfielder", "forward"];
// The organiser's add-guest endpoint reads the app's short codes.
const POSITION_CODE: Record<string, string> = { any: "Any", goalkeeper: "GK", defender: "DEF", midfielder: "MID", forward: "FWD" };

/* A guest under one player — free, like every seat the organiser side adds. */
function GuestForPlayerDialog({ game, host, onClose, onDone }: {
  game: GameFull; host: GameRegistration; onClose: () => void; onDone: (m?: string) => void;
}) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("any");
  const [together, setTogether] = useState(true);
  const hostName = host.player?.name || "this player";
  return (
    <ActionDialog title={`Add a guest for ${hostName}`} confirmLabel="Add guest" onClose={onClose} onDone={(m) => onDone(m || "Guest added.")}
      run={() => act(game._id, `registrations/${host._id}/guest`, "POST", {
        guestName: name.trim(), position, guestRelation: together ? "with" : "none",
      })}>
      <label className={FORM_LABEL}>Guest name (blank = &quot;{hostName.split(" ")[0]} + N&quot;)
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className={FORM_GRID}>
        <label className={FORM_LABEL}>Position
          <select className={FILTER_SELECT} value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => <option key={p} value={p}>{formatStatusLabel(p)}</option>)}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} />
          Play together (same team)
        </label>
      </div>
      <div className="text-[12px] text-muted">
        The guest takes a free spot — nobody is charged. {hostName} is told the organiser added their guest.
      </div>
    </ActionDialog>
  );
}

type Found = { _id: string; name?: string; phone?: string; totalGamesPlayed?: number };

function AddDialog({ game, onClose, onDone }: { game: GameFull; onClose: () => void; onDone: (m?: string) => void }) {
  const [mode, setMode] = useState<"player" | "guest">("player");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [pick, setPick] = useState<Found | null>(null);
  const [guestName, setGuestName] = useState("");
  const [position, setPosition] = useState("any");

  const search = async () => {
    const r = await act<Found[]>(game._id, `search-players?q=${encodeURIComponent(q.trim())}`, "GET");
    setFound(r.ok ? r.data || [] : []);
  };

  return (
    <ActionDialog title="Add to game" confirmLabel="Add" onClose={onClose} onDone={(m) => onDone(m || "Added.")}
      disabled={mode === "player" ? !pick : !guestName.trim()}
      run={() => mode === "player"
        ? act(game._id, "add-player", "POST", { playerId: pick?._id, preferredPosition: position })
        : act(game._id, "add-guest", "POST", { guestName: guestName.trim(), position: POSITION_CODE[position] })}>
      <div className="flex gap-2">
        <button className={mode === "player" ? PRIMARY_BTN : ACTION_BTN} type="button" onClick={() => setMode("player")}>Existing player</button>
        <button className={mode === "guest" ? PRIMARY_BTN : ACTION_BTN} type="button" onClick={() => setMode("guest")}>Organiser&apos;s guest</button>
      </div>
      {mode === "player" ? (
        <>
          <div className="flex gap-2">
            <input className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone"
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) search(); }} />
            <button className={ACTION_BTN} type="button" onClick={search} disabled={!q.trim()}>Search</button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {found.map((p) => (
              <label key={p._id} className="flex cursor-pointer items-center gap-2 py-1 text-[13px]">
                <input type="radio" checked={pick?._id === p._id} onChange={() => setPick(p)} />
                {p.name} <span className="font-mono text-[11px] text-muted">{p.phone} · {p.totalGamesPlayed ?? 0} games</span>
              </label>
            ))}
          </div>
          <div className="text-[12px] text-muted">Added by the organiser, so they are not charged.</div>
        </>
      ) : (
        <label className={FORM_LABEL}>Guest name<input className={INPUT} value={guestName} onChange={(e) => setGuestName(e.target.value)} /></label>
      )}
      <div className={FORM_GRID}>
        <label className={FORM_LABEL}>Position
          <select className={FILTER_SELECT} value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => <option key={p} value={p}>{formatStatusLabel(p)}</option>)}
          </select>
        </label>
      </div>
    </ActionDialog>
  );
}

function AttendanceSheet({ game, onChanged }: Props) {
  const live = game.registrations.filter(isActiveReg);
  const [marks, setMarks] = useState<Record<string, string>>(
    () => Object.fromEntries(live.map((r) => [r._id, r.attended || "not_marked"])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true); setError("");
    const r = await act(game._id, "attendance", "POST", {
      attendance: Object.entries(marks).map(([regId, status]) => ({ regId, status })),
    });
    setBusy(false);
    if (r.ok) onChanged("Attendance saved."); else setError(r.message || "Could not save attendance.");
  };

  return (
    <>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>#</th><th>Player / Guest</th><th>Paid</th><th>Attendance</th></tr></thead>
          <tbody>
            {live.map((r, i) => (
              <tr key={r._id}>
                <td>{i + 1}</td>
                <td>{regName(r)}</td>
                <td>{formatCurrency(r.amountPaidPaise)}</td>
                <td>
                  <select className={FILTER_SELECT} value={marks[r._id]} onChange={(e) => setMarks((m) => ({ ...m, [r._id]: e.target.value }))}>
                    {ATTENDANCE.map((s) => <option key={s} value={s}>{formatStatusLabel(s)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className={`${FORM_ERROR} mt-2`}>{error}</div>}
      <div className="mt-2 flex justify-end">
        <button className={PRIMARY_BTN} type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save attendance"}</button>
      </div>
      <div className="mt-1 text-right text-[12px] text-muted">A no-show is told, and it counts against their reliability.</div>
    </>
  );
}
