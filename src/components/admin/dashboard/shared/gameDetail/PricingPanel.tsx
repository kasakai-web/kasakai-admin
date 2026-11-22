"use client";

/* The early-bird ladder the organiser set, and — for a superadmin — adding a
   tier, removing one, or stopping early-bird altogether.

   Every save is the organiser's own updateGame ladder edit (PATCH act/pricing),
   so its rules hold: a tier with seats sold or held keeps its price and can't
   shrink below them, tiers must rise in price and stay under the fee, and no new
   tier may undercut a price already paid. That is why "Stop early-bird" does not
   wipe a tier with sales — it shrinks it to the seats already taken, so nobody
   new gets the cheap price and a held join request still converts at the price
   its player was shown. With nothing sold, it removes the ladder outright. */

import { useState } from "react";
import { BLOCK_TITLE, TABLE_WRAP, TABLE, ACTION_BTN, FORM_LABEL, FORM_GRID, BADGE, BADGE_RED } from "../styles";
import { formatCurrency } from "../format";
import { ActionDialog, DANGER_BTN, INPUT, PRIMARY_BTN, act, type GameFull, type LadderTier } from "./common";

const taken = (t: LadderTier) => (t.sold || 0) + (t.held || 0);
const strip = (t: LadderTier) => ({
  label: t.label || null, pricePaise: t.pricePaise, seats: t.seats, closesHoursBefore: t.closesHoursBefore ?? null,
});

export function PricingPanel({ game, onChanged }: { game: GameFull; onChanged: (msg?: string) => void }) {
  const can = !!game.canControl && game.status !== "completed" && game.status !== "cancelled";
  const stored = game.pricing?.tiers || [];
  // null = nothing pending; otherwise the ladder the admin is about to save.
  const [draft, setDraft] = useState<LadderTier[] | null>(null);
  const [confirm, setConfirm] = useState<null | { tiers: LadderTier[] | null; summary: string }>(null);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("");
  const [closes, setCloses] = useState("");

  const rows = draft ?? stored;
  const anyTaken = stored.some((t) => taken(t) > 0);

  const addTier = () => {
    const t: LadderTier = {
      label: label.trim() || null,
      pricePaise: Math.round(Number(price) * 100),
      seats: Number(seats),
      closesHoursBefore: closes === "" ? null : Number(closes),
      sold: 0, held: 0,
    };
    setDraft([...rows, t].sort((a, b) => a.pricePaise - b.pricePaise));
    setLabel(""); setPrice(""); setSeats(""); setCloses("");
  };

  const stopEarlyBird = () => {
    const kept = stored.filter((t) => taken(t) > 0).map((t) => ({ ...t, seats: taken(t) }));
    setConfirm({
      tiers: kept.length ? kept : null,
      summary: kept.length
        ? `Unsold tiers are removed and each tier with sales is closed at the seats already taken (${kept.map((t) => `${formatCurrency(t.pricePaise)}: ${t.seats}`).join(", ")}). Every new seat costs the full fee.`
        : "The ladder is removed. Every seat costs the full fee.",
    });
  };

  if (!stored.length && !can) return null;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className={BLOCK_TITLE}>Early-bird pricing {stored.length ? `(${stored.length} tier${stored.length === 1 ? "" : "s"})` : "— flat fee"}</div>
        {can && stored.length > 0 && !draft && (
          <button className={DANGER_BTN} type="button" onClick={stopEarlyBird}>{anyTaken ? "Stop early-bird" : "Remove ladder"}</button>
        )}
      </div>

      {rows.length > 0 && (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead><tr><th>#</th><th>Label</th><th>Price</th><th>Sold</th><th>Closes</th>{can && <th></th>}</tr></thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={`${t.pricePaise}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{t.label || (i === 0 ? "Early bird" : `Tier ${i + 1}`)}</td>
                  <td>{formatCurrency(t.pricePaise)}</td>
                  <td className="min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{t.sold || 0} of {t.seats} sold</span>
                      {taken(t) >= t.seats && <span className={`${BADGE} ${BADGE_RED}`}>Sold out</span>}
                    </div>
                    {/* Sold solid, held (pending join requests) lighter. */}
                    <div className="mt-1 flex h-[4px] w-full overflow-hidden rounded-[2px] bg-border">
                      <div className="bg-success" style={{ width: `${Math.min(100, ((t.sold || 0) / t.seats) * 100)}%` }} />
                      <div className="bg-warning opacity-60" style={{ width: `${Math.min(100, ((t.held || 0) / t.seats) * 100)}%` }} />
                    </div>
                    {(t.held || 0) > 0 && <div className="mt-[2px] text-[11px] text-muted">+{t.held} held for join requests</div>}
                  </td>
                  <td>{t.closesHoursBefore == null ? "When sold out" : `${t.closesHoursBefore} h before`}</td>
                  {can && (
                    <td>{taken(t) > 0
                      ? <span className="text-[11px] text-muted">has sales</span>
                      : <button className={ACTION_BTN} type="button" onClick={() => setDraft(rows.filter((_, j) => j !== i))}>Remove</button>}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-1 text-[12px] text-muted">
        Full fee {formatCurrency(game.feeInPaise)}.
        {game.pricing?.highWaterPaise ? ` Highest early-bird price paid so far: ${formatCurrency(game.pricing.highWaterPaise)} — a new tier can't be cheaper.` : ""}
      </div>

      {can && (
        <div className="mt-3 border border-border bg-surface p-3">
          <div className={FORM_GRID}>
            <label className={FORM_LABEL}>Label (optional)<input className={INPUT} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Early bird" /></label>
            <label className={FORM_LABEL}>Price (₹)<input className={INPUT} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label className={FORM_LABEL}>Seats<input className={INPUT} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} /></label>
            <label className={FORM_LABEL}>Closes (hours before kickoff, blank = when sold out)<input className={INPUT} type="number" min={0} value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button className={ACTION_BTN} type="button" disabled={!(Number(price) > 0 && Number(seats) >= 1)} onClick={addTier}>+ Add tier</button>
            {draft && (
              <>
                <button className={ACTION_BTN} type="button" onClick={() => setDraft(null)}>Discard changes</button>
                <button className={PRIMARY_BTN} type="button"
                  onClick={() => setConfirm({
                    tiers: draft.length ? draft : null,
                    summary: draft.length ? `Save a ${draft.length}-tier ladder.` : "Remove the ladder. Every seat costs the full fee.",
                  })}>Save ladder</button>
              </>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <ActionDialog title="Change early-bird pricing" confirmLabel="Save" needsReason
          onClose={() => setConfirm(null)}
          onDone={(m) => { setConfirm(null); setDraft(null); onChanged(m || "Early-bird pricing updated."); }}
          run={(reason) => act(game._id, "pricing", "PATCH", {
            pricing: confirm.tiers ? { tiers: confirm.tiers.map(strip) } : null,
            reason,
          })}>
          {confirm.summary}
          <div className="text-[12px] text-muted">
            Seats already sold keep the price they were bought at. Players are not told; the organisers get a note.
          </div>
        </ActionDialog>
      )}
    </>
  );
}
