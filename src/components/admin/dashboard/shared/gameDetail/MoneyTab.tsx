"use client";

/* One game's money, from the same report the organiser sees (getFinancialSummary,
   narrowed with ?gameId=) plus the wallet ledger by type for cancellation fees.
   Pass cover and discounts are shown BESIDE revenue, never netted into it —
   they are money never collected, not money refunded. */

import { STAT_LABEL, SUMMARY_FOUR, SUMMARY_ITEM, SUMMARY_VALUE, PAY_SUB, LOADING_STATE, FORM_ERROR } from "../styles";
import { formatCurrency } from "../format";
import { useAdminFetch } from "../useAdminFetch";

type Row = {
  revenuePaise: number; refundedPaise: number;
  passSeats: number; passCoveredPaise: number; passReimbursablePaise: number;
  offerSeats: number; offerDiscountPaise: number; offerReimbursablePaise: number;
  hostSeats: number; hostDiscountPaise: number;
  earlyBirdSeats: number; earlyBirdSavingPaise: number;
  paidPlayers: unknown[]; paidGuests: unknown[];
};

export function MoneyTab({ gameId }: { gameId: string }) {
  const fin = useAdminFetch<{ data?: { games: Row[] } }>(`/admin/games/${gameId}/act/financial?gameId=${gameId}`, { errorMessage: "Could not load the money for this game." });
  const tl  = useAdminFetch<{ data?: { moneyByType: Record<string, number> } }>(`/admin/games/${gameId}/timeline`);
  const g = fin.data?.data?.games?.[0];
  const byType = tl.data?.data?.moneyByType || {};

  if (fin.loading) return <div className={LOADING_STATE}>Loading money…</div>;
  if (fin.error) return <div className={FORM_ERROR}>{fin.error}</div>;
  if (!g) return <div className="text-[13px] text-muted">No money has moved on this game.</div>;

  const owed = (g.passReimbursablePaise || 0) + (g.offerReimbursablePaise || 0);
  const cell = (label: string, value: number, sub?: string, tone = "") => (
    <div className={SUMMARY_ITEM}>
      <div className={STAT_LABEL}>{label}</div>
      <div className={`${SUMMARY_VALUE} ${tone}`}>{formatCurrency(value)}</div>
      {sub && <div className={PAY_SUB}>{sub}</div>}
    </div>
  );

  return (
    <>
      <div className={`${SUMMARY_FOUR} mb-px`}>
        {cell("Collected", g.revenuePaise, `${g.paidPlayers.length} players · ${g.paidGuests.length} guests`, "text-success!")}
        {cell("Refunded", g.refundedPaise)}
        {cell("Net", g.revenuePaise - g.refundedPaise)}
        {cell("Cancellation fees", byType.backout_fee || 0, "charged to players who left")}
      </div>
      <div className={SUMMARY_FOUR}>
        {cell("Pass covered", g.passCoveredPaise, `${g.passSeats} seats · ${formatCurrency(g.passReimbursablePaise)} reimbursable`)}
        {cell("KasaKai offers", g.offerDiscountPaise, `${g.offerSeats} seats · ${formatCurrency(g.offerReimbursablePaise)} owed back`)}
        {cell("Host discounts", g.hostDiscountPaise, `${g.hostSeats} host spots`)}
        {cell("Owed to organiser", owed, "pass + offer reimbursement", "text-warning!")}
      </div>
      {g.earlyBirdSeats > 0 && (
        <div className="mt-2 text-[12px] text-muted">
          Early-bird: {g.earlyBirdSeats} seat{g.earlyBirdSeats === 1 ? "" : "s"} sold below list, {formatCurrency(g.earlyBirdSavingPaise)} in total
          {g.earlyBirdSeats > 1 ? ` (${formatCurrency(Math.round(g.earlyBirdSavingPaise / g.earlyBirdSeats))} per seat on average)` : ""}
          {" "}— the organiser&apos;s own price, not a KasaKai discount.
        </div>
      )}
    </>
  );
}
