"use client";

/* "What would THIS player pay for THIS game, and why?"
 *
 * Every live campaign — plus the draft being edited, as though it were already
 * published — is put through the same engine and the same facts the booking
 * uses, so what this panel says is what the till would do (acceptance 14). An
 * offer that does not apply says why in the words the player would see; a code
 * campaign is tested as though its code had been typed, so the admin sees
 * whether the code WOULD work for them.
 *
 * Nothing is held and nothing is charged: a preview is a question. */

import { useCallback, useEffect, useState } from "react";
import {
  adminFetch, rupees, shortDateTime, BTN, CARD, ERROR_BOX,
  BookingPreview as Preview, Campaign, LookupGame, LookupPlayer, payloadOf,
} from "./shared";
import { GamePicker, PlayerPicker } from "./Pickers";

export function BookingPreview({ draft = null }: { draft?: Campaign | null }) {
  const [player, setPlayer] = useState<LookupPlayer | null>(null);
  const [game, setGame] = useState<LookupGame | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!player || !game) return;
    setLoading(true);
    setErr("");
    const res = await adminFetch<Preview>("/admin/discounts/preview", {
      method: "POST",
      body: JSON.stringify({
        playerId: player._id,
        gameId: game._id,
        ...(draft ? { campaign: payloadOf(draft) } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) { setErr(res.message || "Preview failed."); setPreview(null); return; }
    setPreview(res.data || null);
  }, [player, game, draft]);

  // Re-run as the draft changes, debounced — the panel is only useful if it
  // keeps up with the offer being edited.
  useEffect(() => {
    if (!player || !game) return;
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [run, player, game]);

  return (
    <div className={CARD}>
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
        Test a booking {draft ? "— this draft as if published" : "— every live offer"}
      </div>
      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <PlayerPicker value={player} onChange={(p) => { setPlayer(p); setPreview(null); }} />
        <GamePicker value={game} onChange={(g) => { setGame(g); setPreview(null); }} />
      </div>

      {err && <div className={`${ERROR_BOX} mt-3`}>{err}</div>}
      {loading && !preview && <div className="mt-3 text-[12px] text-muted">Checking…</div>}
      {!player || !game ? (
        <div className="mt-3 text-[12px] text-muted">Pick a player and a game to see exactly what they would be charged.</div>
      ) : null}

      {preview && (
        <div className="mt-4">
          {/* The answer first: the breakdown a player would see. */}
          <div className="rounded-md border border-border-2 bg-surface-2 p-3 font-mono text-[12.5px]">
            <Line label="Game entry" value={rupees(preview.game.feePaise)} />
            {preview.pass.covered && (
              <Line label={`Included with ${preview.pass.name || "pass"}`} value={`−${rupees(preview.game.feePaise - preview.pass.payablePaise)}`} tone="text-accent" />
            )}
            {preview.applied && (
              <Line label={preview.applied.title} value={`−${rupees(preview.applied.savingPaise)}`} tone="text-accent" />
            )}
            <div className="mt-[6px] border-t border-border pt-[6px]">
              <Line label="Entry to pay" value={rupees(preview.payablePaise)} strong />
            </div>
          </div>

          <div className="mt-2 text-[11.5px] leading-[1.6] text-muted">
            {preview.player.name}
            {preview.player.isNew ? " · a first-time player" : " · has played before"}
            {preview.player.firstGameUsed ? " · first-game offer already used" : ""}
            {preview.player.alreadyIn ? " · ALREADY IN THIS GAME — they could not book it again" : ""}
            {" · "}{preview.game.title} · {shortDateTime(preview.game.scheduledAt)}
            {preview.game.status !== "open" && preview.game.status !== "confirmed" ? ` · game is ${preview.game.status}` : ""}
          </div>

          {/* Then every offer, and why each did or did not apply. */}
          <div className="mt-3 flex flex-col gap-[6px]">
            {preview.results.length === 0 && (
              <div className="text-[12px] text-muted">No live offers{draft ? " besides this draft" : ""}.</div>
            )}
            {preview.results.map((r) => (
              <div key={r.campaignId} className="flex items-start justify-between gap-3 border-b border-border pb-[6px] text-[12px]">
                <div className="min-w-0">
                  <div className="truncate text-fg">
                    {r.title}
                    {r.isDraft && <span className="ml-2 rounded border border-border-2 px-[5px] font-mono text-[9px] uppercase text-muted">draft</span>}
                    {r.trigger === "code" && <span className="ml-2 font-mono text-[10px] text-muted">code {r.code || "—"}</span>}
                    {preview.applied?.campaignId === r.campaignId && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">applied</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">{r.name}</div>
                </div>
                <div className="shrink-0 text-right">
                  {r.eligible
                    ? <span className="font-mono text-accent">−{rupees(r.savingPaise)}</span>
                    : <span className="text-[11.5px] text-[#fbbf24]">{r.reasonText || r.reason}</span>}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className={`${BTN} mt-3`} onClick={run}>Re-check</button>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, tone = "text-body", strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[2px]">
      <span className={strong ? "text-fg" : "text-muted"}>{label}</span>
      <span className={`${tone} ${strong ? "text-[15px] font-bold text-fg" : ""}`}>{value}</span>
    </div>
  );
}
