"use client";

/* The teams as they stand, and every sheet that was announced. Distribute /
   publish / move / restore are the organiser's own actions — an admin change
   counts as the organiser's, so the automation stands down until it is published. */

import { useState } from "react";
import { BADGE, BADGE_GRAY, BADGE_GREEN, BADGE_AMBER, BLOCK_TITLE, TABLE_WRAP, TABLE, ACTION_BTN, FORM_ERROR, LOADING_STATE } from "../styles";
import { formatDateTime, formatStatusLabel } from "../format";
import { useAdminFetch } from "../useAdminFetch";
import { PRIMARY_BTN, act, type GameFull } from "./common";

type Assignment = { id: string; name: string; team: "A" | "B"; isGoalkeeper?: boolean };
type Current = {
  assignments: Assignment[]; colours: { A: string; B: string }; quality?: string;
  skillDifference?: number; warnings: string[]; published: boolean;
};
type Sheet = {
  _id: string; revision: number; publishedAt: string; publishedByRole?: string;
  teams?: { A?: { colour?: string }; B?: { colour?: string } };
  members: { name: string; team: "A" | "B"; colour: string; announcement?: string }[];
};

export function TeamsTab({ game, onChanged }: { game: GameFull; onChanged: (msg?: string) => void }) {
  const can = !!game.canControl;
  const live = game.status !== "completed" && game.status !== "cancelled";
  const cur = useAdminFetch<{ data?: Current }>(`/admin/games/${game._id}/act/teams/current`, { errorMessage: "" });
  const sheets = useAdminFetch<{ data?: { history: Sheet[] } }>(`/admin/games/${game._id}/act/teams/sheets`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const teams = cur.data?.data || null;

  const run = async (path: string, body: object | undefined, msg: string) => {
    setBusy(true); setError("");
    const r = await act(game._id, path, "POST", body);
    setBusy(false);
    if (!r.ok) { setError(r.message || "Action failed."); return; }
    cur.refresh(); sheets.refresh(); onChanged(msg);
  };

  const side = (t: "A" | "B") => (teams?.assignments || []).filter((a) => a.team === t);

  return (
    <>
      {error && <div className={`${FORM_ERROR} mb-3`}>{error}</div>}

      {can && live && (
        <div className="mb-3 flex flex-wrap gap-[6px]">
          <button className={ACTION_BTN} type="button" disabled={busy}
            onClick={() => {
              if (teams?.published && !window.confirm("The teams have already been sent. Make a new split?")) return;
              run("distribute", {}, "Teams distributed — not sent yet.");
            }}>Distribute</button>
          {teams && !teams.published && (
            <>
              <button className={PRIMARY_BTN} type="button" disabled={busy} onClick={() => run("teams/publish", {}, "Teams published to players.")}>Publish</button>
              {(sheets.data?.data?.history?.length ?? 0) > 0 && (
                <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => run("teams/restore", {}, "Back to the sent teams.")}>Back to the sent teams</button>
              )}
            </>
          )}
        </div>
      )}

      {cur.loading ? <div className={LOADING_STATE}>Loading teams…</div>
        : !teams ? <div className="border border-border bg-surface px-4 py-4 text-center text-[13px] text-muted">Teams have not been distributed yet.</div>
        : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className={`${BADGE} ${teams.published ? BADGE_GREEN : BADGE_AMBER}`}>{teams.published ? "Sent to players" : "Draft — not sent"}</span>
              {teams.quality && <span className={`${BADGE} ${BADGE_GRAY}`}>Balance: {teams.quality}</span>}
              {teams.skillDifference != null && <span className="text-muted">skill gap {teams.skillDifference}</span>}
            </div>
            {teams.warnings?.length > 0 && (
              <ul className="mb-3 list-disc pl-5 text-[12px] text-warning">{teams.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            )}
            <div className="grid grid-cols-2 gap-px border border-border bg-border max-[640px]:grid-cols-1">
              {(["A", "B"] as const).map((t) => (
                <div key={t} className="bg-surface p-4">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                    {formatStatusLabel(teams.colours?.[t]) || `Team ${t}`} · {side(t).length}
                  </div>
                  {side(t).map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-[3px] text-[13px]">
                      <span>{a.name}{a.isGoalkeeper ? " 🧤" : ""}</span>
                      {can && live && (
                        <button className={ACTION_BTN} type="button" disabled={busy} title="Move to the other team"
                          onClick={() => run("teams/move", { memberId: a.id }, `${a.name} moved.`)}>⇄</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

      <div className={`${BLOCK_TITLE} mt-5!`}>Sent sheets ({sheets.data?.data?.history?.length ?? 0})</div>
      {(sheets.data?.data?.history?.length ?? 0) === 0
        ? <div className="text-[13px] text-muted">Nothing has been announced to players yet.</div>
        : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead><tr><th>Revision</th><th>Sent</th><th>By</th><th>Team A</th><th>Team B</th></tr></thead>
              <tbody>
                {sheets.data!.data!.history.map((s) => (
                  <tr key={s._id}>
                    <td>{s.revision}</td>
                    <td className="whitespace-nowrap">{formatDateTime(s.publishedAt)}</td>
                    <td>{formatStatusLabel(s.publishedByRole)}</td>
                    {(["A", "B"] as const).map((t) => (
                      <td key={t} className="min-w-[180px] whitespace-normal text-[12px]">
                        {s.members.filter((m) => m.team === t).map((m) => m.name).join(", ")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
