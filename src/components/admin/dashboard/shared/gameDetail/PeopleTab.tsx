"use client";

/* Who runs the game besides its owner: co-organisers and facilitators. Adding a
   co-organiser picks a real organiser account (never a typed name), because
   game notifications and access go to that account. */

import { useState } from "react";
import { BLOCK_TITLE, TABLE_WRAP, TABLE, ACTION_BTN, ACTIONS, FILTER_SELECT, FORM_ERROR, BADGE } from "../styles";
import { formatDate, formatStatusLabel, badgeClassForStatus as badgeCls } from "../format";
import { useAdminFetch } from "../useAdminFetch";
import { adminFetch } from "../../passes/v2/shared";
import { DANGER_BTN, INPUT, PRIMARY_BTN, act, type GameFull } from "./common";

type OrgOption = { id: string; name: string; phone: string | null; status: string };
type Fac = { _id: string; status: string; player: { _id: string; name: string; phone?: string }; invitedAt?: string };
type FacPanel = { facilitators: Fac[]; candidates: { _id: string; name: string; phone?: string }[]; maxLive: number };

export function PeopleTab({ game, onChanged }: { game: GameFull; onChanged: (msg?: string) => void }) {
  const can = !!game.canControl && game.status !== "completed" && game.status !== "cancelled";
  const fac = useAdminFetch<{ data?: FacPanel }>(`/admin/games/${game._id}/act/facilitators`);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<OrgOption[]>([]);
  const [perm, setPerm] = useState("view");
  const [facPick, setFacPick] = useState("");

  const call = async (path: string, method: string, body: object | undefined, msg: string, after?: () => void) => {
    setError("");
    const r = await act(game._id, path, method, body);
    if (!r.ok) { setError(r.message || "Action failed."); return; }
    after?.(); onChanged(msg);
  };

  const search = async () => {
    const r = await adminFetch<OrgOption[]>(`/admin/organisers/options?search=${encodeURIComponent(q.trim())}`);
    setOptions(r.ok ? (r.data || []).filter((o) => o.status === "approved" && String(o.id) !== String(game.organiser?._id)) : []);
  };

  const facs = (fac.data?.data?.facilitators || []).filter((f) => ["invited", "accepted"].includes(f.status));
  const candidates = (fac.data?.data?.candidates || []).filter((c) => !facs.some((f) => f.player._id === c._id));

  return (
    <>
      {error && <div className={`${FORM_ERROR} mb-3`}>{error}</div>}

      <div className={BLOCK_TITLE}>Owner</div>
      <div className="mb-4 text-[13px]">
        {game.organiser?.name || "—"} <span className="font-mono text-[11px] text-muted">{game.organiser?.phone}</span>
        {game.organiser && game.organiser.isActive === false && <span className={`${BADGE} ${badgeCls("cancelled")} ml-2`}>Suspended</span>}
      </div>

      <div className={BLOCK_TITLE}>Co-organisers ({game.coOrganisers?.length ?? 0})</div>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Name</th><th>Phone</th><th>Access</th>{can && <th></th>}</tr></thead>
          <tbody>
            {(game.coOrganisers || []).length === 0 && <tr><td colSpan={4} className="p-4! text-center text-muted!">None.</td></tr>}
            {(game.coOrganisers || []).map((c) => (
              <tr key={c._id}>
                <td>{c.organiser?.name || "—"}</td>
                <td>{c.organiser?.phone || "—"}</td>
                <td>{can ? (
                  <select className={FILTER_SELECT} value={c.permission}
                    onChange={(e) => call(`co-organisers/${c._id}`, "PATCH", { permission: e.target.value }, "Access changed.")}>
                    <option value="view">View</option><option value="edit">Edit</option>
                  </select>
                ) : formatStatusLabel(c.permission)}</td>
                {can && <td><button className={DANGER_BTN} type="button" onClick={() => call(`co-organisers/${c._id}`, "DELETE", undefined, "Co-organiser removed.")}>Remove</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className={`${INPUT} max-w-[240px]`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find organiser by name / phone"
            onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) search(); }} />
          <button className={ACTION_BTN} type="button" onClick={search} disabled={!q.trim()}>Search</button>
          <select className={FILTER_SELECT} value={perm} onChange={(e) => setPerm(e.target.value)} aria-label="Access">
            <option value="view">View</option><option value="edit">Edit</option>
          </select>
          {options.map((o) => (
            <button key={o.id} className={PRIMARY_BTN} type="button"
              onClick={() => call("co-organisers", "POST", { organiserId: o.id, permission: perm }, `${o.name} added.`, () => setOptions([]))}>
              + {o.name}
            </button>
          ))}
        </div>
      )}

      <div className={`${BLOCK_TITLE} mt-5!`}>Facilitators ({facs.length})</div>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Name</th><th>Status</th><th>Asked</th>{can && <th></th>}</tr></thead>
          <tbody>
            {facs.length === 0 && <tr><td colSpan={4} className="p-4! text-center text-muted!">None.</td></tr>}
            {facs.map((f) => (
              <tr key={f._id}>
                <td>{f.player?.name}</td>
                <td><span className={`${BADGE} ${badgeCls(f.status)}`}>{formatStatusLabel(f.status)}</span></td>
                <td>{formatDate(f.invitedAt)}</td>
                {can && <td><button className={DANGER_BTN} type="button" onClick={() => call(`facilitators/${f._id}`, "DELETE", undefined, "Facilitator removed.", fac.refresh)}>Remove</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can && candidates.length > 0 && (
        <div className={`${ACTIONS} mt-2 items-center`}>
          <select className={FILTER_SELECT} value={facPick} onChange={(e) => setFacPick(e.target.value)} aria-label="Approved host">
            <option value="">Pick one of the organiser&apos;s hosts…</option>
            {candidates.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button className={PRIMARY_BTN} type="button" disabled={!facPick}
            onClick={() => call("facilitators", "POST", { playerId: facPick }, "Asked to facilitate.", () => { setFacPick(""); fac.refresh(); })}>
            Ask to facilitate
          </button>
        </div>
      )}
    </>
  );
}
