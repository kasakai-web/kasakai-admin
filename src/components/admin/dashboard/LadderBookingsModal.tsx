"use client";

/* One laddered game: each early-bird tier and every seat sold at it, plus the
   seats sold at full price. Read-only, from the plain game detail endpoint.

   Seats are matched to a tier by the PRICE frozen on the row (list − saving,
   backend utils/seatPricing.js rowTierPrice), never by priceTier's index — the
   ladder can be edited after sales. Cancelled and removed seats are listed too,
   marked, because a tier seat is never returned to the tier. */

import {
  SECTION_TITLE, BADGE, BADGE_GRAY, BADGE_GREEN, BLOCK_TITLE, TABLE_WRAP, TABLE,
  MODAL_OVERLAY, MODAL, MODAL_LARGE, MODAL_HEAD, MODAL_CLOSE, LOADING_STATE, FORM_ERROR,
} from "./shared/styles";
import { useAdminFetch } from "./shared/useAdminFetch";
import { formatCurrency, formatDateTime, formatStatusLabel } from "./shared/format";

type Row = {
  _id: string; player?: { name?: string; phone?: string } | null; plusOneName?: string | null;
  amountPaidPaise?: number; paymentStatus?: string; signedUpAt?: string;
  backedOutAt?: string | null; removedAt?: string | null; optedOut?: boolean;
  priceTier?: number | null; listPricePaise?: number; earlyBirdSavingPaise?: number;
};
type Tier = { label?: string | null; pricePaise: number; seats: number; sold?: number; held?: number };
type Game = { title?: string; feeInPaise?: number; pricing?: { tiers?: Tier[] } | null; registrations?: Row[] };
type Group = { key: string; title: string; pricePaise: number; note: string; rows: Row[] };

const tierPrice = (r: Row) => (r.listPricePaise || 0) - (r.earlyBirdSavingPaise || 0);
const seatState = (r: Row) =>
  r.removedAt ? "Removed" : r.backedOutAt ? "Cancelled" : r.optedOut ? "Opted out"
  : ["refunded", "cancelled"].includes(r.paymentStatus || "") ? formatStatusLabel(r.paymentStatus) : null;

export function groupByTier(game: Game): Group[] {
  const tiers = game.pricing?.tiers || [];
  const regs = game.registrations || [];
  const groups: Group[] = tiers.map((t, i) => ({
    key: `t${t.pricePaise}`, pricePaise: t.pricePaise,
    title: t.label || (i === 0 ? "Early bird" : `Tier ${i + 1}`),
    note: `${t.sold || 0} of ${t.seats} sold${t.held ? ` · ${t.held} held by join requests` : ""}`,
    rows: [],
  }));
  for (const r of regs) {
    if (r.priceTier == null) continue;
    const p = tierPrice(r);
    let g = groups.find((x) => x.pricePaise === p);
    if (!g) { // tier price edited or removed after this sale
      g = { key: `t${p}`, pricePaise: p, title: "Tier no longer on the ladder", note: "", rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  groups.sort((a, b) => a.pricePaise - b.pricePaise);
  const full = regs.filter((r) => r.priceTier == null);
  if (full.length) groups.push({ key: "full", pricePaise: game.feeInPaise || 0, title: "Full price", note: "", rows: full });
  return groups;
}

export function LadderBookingsModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { data, loading, error } = useAdminFetch<{ data?: Game }>(`/admin/games/${gameId}`, { errorMessage: "Could not load this game." });
  const game = data?.data;
  const groups = game ? groupByTier(game) : [];

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div>
            <div className={SECTION_TITLE}>Ladder pricing</div>
            {game && <div className="text-[13px] text-muted">{game.title} · full fee {formatCurrency(game.feeInPaise)}</div>}
          </div>
          <button className={MODAL_CLOSE} type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {loading && <div className={LOADING_STATE}>Loading…</div>}
        {error && <div className={FORM_ERROR}>{error}</div>}
        {groups.map((g) => (
          <div key={g.key}>
            <div className={BLOCK_TITLE}>
              {g.title} · {formatCurrency(g.pricePaise)}{g.note && <span className="text-muted"> · {g.note}</span>}
            </div>
            {g.rows.length === 0 ? (
              <div className="text-[13px] text-muted">No seats sold at this price yet.</div>
            ) : (
              <div className={TABLE_WRAP}>
                <table className={TABLE}>
                  <thead><tr><th>Who</th><th>Seat price</th><th>Paid</th><th>Booked</th><th>Status</th></tr></thead>
                  <tbody>
                    {g.rows.map((r) => {
                      const gone = seatState(r);
                      return (
                        <tr key={r._id} className={gone ? "opacity-60" : ""}>
                          <td>
                            {r.plusOneName ? `${r.plusOneName} (guest of ${r.player?.name || "—"})` : r.player?.name || "—"}
                            {!r.plusOneName && r.player?.phone && <div className="text-[11px] text-muted">{r.player.phone}</div>}
                          </td>
                          <td>{formatCurrency(r.priceTier == null ? (r.listPricePaise ?? game?.feeInPaise) : tierPrice(r))}</td>
                          <td>{formatCurrency(r.amountPaidPaise)}</td>
                          <td>{formatDateTime(r.signedUpAt)}</td>
                          <td>{gone ? <span className={`${BADGE} ${BADGE_GRAY}`}>{gone}</span> : <span className={`${BADGE} ${BADGE_GREEN}`}>In game</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {game && (
          <div className="mt-3 text-[12px] text-muted">
            Seat price is the ladder price the seat was sold at. Paid is what the player was actually charged after any pass or offer.
          </div>
        )}
      </div>
    </div>
  );
}
