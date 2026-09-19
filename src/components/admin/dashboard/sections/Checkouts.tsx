"use client";

import { useEffect, useState } from "react";
import {
  BADGE, BADGE_GREEN, BADGE_AMBER, BADGE_RED, BADGE_BLUE, BADGE_GRAY,
  TOOLBAR, SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP, TABLE, ACTION_BTN,
  FORM_ERROR, LOADING_STATE, SUMMARY_ITEM, STAT_LABEL, SUMMARY_VALUE, PAY_SUB,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { formatCurrency, formatDateTime } from "../shared/format";

// Booking checkouts — the state a wallet-only payment never had.
//
// A wallet booking was one atomic thing: the money moved and the seat was
// taken, or neither happened. Collecting at the gateway puts a human and their
// UPI app in the middle of it, so a booking now has a middle, and this is the
// screen for the rows stuck in it.
//
// It opens on the exceptions, not on a list of everything. "Paid but never
// booked" and "refund started but not landed" are the two questions support
// actually arrives with, and they are the two nothing else can answer — a
// successful checkout leaves an ordinary wallet transaction on the Payments
// page and needs nothing here.

type AttemptRow = {
  id: string;
  playerName: string; playerPhone?: string | null;
  gameTitle?: string | null; gameAt?: string | null;
  purpose: string; seats: number;
  totalPaise: number; walletPaise: number; directPaise: number;
  paymentStatus: string; bookingStatus: string;
  refundStatus: string; refundReason?: string | null; refundedPaise: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpayRefundId?: string | null;
  walletEarmarked: boolean;
  expiresAt: string; paidAt?: string | null; settledAt?: string | null;
  createdAt: string; note?: string | null;
};

type AttemptListResponse = {
  success: boolean;
  total?: number; page?: number; limit?: number; totalPages?: number;
  summary?: { paidUnbooked: number; refundPending: number; live: number };
  data: AttemptRow[];
};

const PURPOSE_LABEL: Record<string, string> = {
  game_booking:  "Book game",
  add_guest:     "Add guest",
  guest_confirm: "Confirm guest",
  invite_join:   "Accept invite",
  approved_join: "Approved request",
  rejoin:        "Rejoin",
};

const PAYMENT_BADGE: Record<string, string> = {
  created:   BADGE_AMBER,
  paid:      BADGE_GREEN,
  failed:    BADGE_RED,
  abandoned: BADGE_GRAY,
};

const BOOKING_BADGE: Record<string, string> = {
  none:      BADGE_AMBER,
  claiming:  BADGE_BLUE,
  booked:    BADGE_GREEN,
  no_spot:   BADGE_RED,
  expired:   BADGE_GRAY,
  cancelled: BADGE_GRAY,
};

const REFUND_BADGE: Record<string, string> = {
  none:    BADGE_GRAY,
  pending: BADGE_AMBER,
  done:    BADGE_GREEN,
  failed:  BADGE_RED,
};

const VIEWS = [
  { value: "exceptions",     label: "Needs attention" },
  { value: "paid_unbooked",  label: "Paid, not booked" },
  { value: "refund_pending", label: "Refund outstanding" },
  { value: "live",           label: "In flight" },
  { value: "all",            label: "All checkouts" },
] as const;

const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Checkouts() {
  const [search, setSearch] = useState("");
  const [view, setView]     = useState<string>("exceptions");
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit), view });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

  const { data, loading, error, refresh } = useAdminFetch<AttemptListResponse>(
    `/admin/payment-attempts?${params.toString()}`,
    { errorMessage: "Failed to load checkouts." },
  );

  const rows    = data?.data ?? [];
  const total   = data?.total ?? rows.length;
  const summary = data?.summary ?? { paidUnbooked: 0, refundPending: 0, live: 0 };

  return (
    <>
      {/* The three counts are the reason to open this screen, so they lead. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Paid, not booked</div>
          <div className={`${SUMMARY_VALUE} ${summary.paidUnbooked > 0 ? "text-danger!" : "text-success!"}`}>
            {summary.paidUnbooked}
          </div>
          <div className={PAY_SUB}>Money taken, no spot, no refund</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Refund outstanding</div>
          <div className={`${SUMMARY_VALUE} ${summary.refundPending > 0 ? "text-warning!" : "text-success!"}`}>
            {summary.refundPending}
          </div>
          <div className={PAY_SUB}>Started, not confirmed by the gateway</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>In flight</div>
          <div className={SUMMARY_VALUE}>{summary.live}</div>
          <div className={PAY_SUB}>Payment sheets open right now</div>
        </div>
      </div>

      <div className={TOOLBAR}>
        <input
          className={SEARCH_INPUT}
          placeholder="Search order, payment or refund ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <select
          className={FILTER_SELECT}
          value={view}
          onChange={(e) => { setView(e.target.value); resetPage(); }}
        >
          {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <button className={ACTION_BTN} type="button" onClick={refresh}>Refresh</button>
      </div>

      {error   && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading checkouts…</div>}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Attempt</th><th>Player</th><th>For</th>
              <th>Wallet</th><th>Collected</th><th>Total</th>
              <th>Payment</th><th>Booking</th><th>Refund</th>
              <th>Gateway IDs</th><th>Opened</th><th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="p-6! text-center text-muted!">
                  {view === "exceptions"
                    ? "Nothing needs attention — every payment either booked a spot or was refunded."
                    : "No checkouts found."}
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={String(a.id)}>
                <td className="font-mono text-[11px]! text-muted!">{String(a.id).slice(-8).toUpperCase()}</td>
                <td>
                  <div className="font-medium">{a.playerName}</div>
                  {a.playerPhone && <div className="text-[11px] text-muted">{a.playerPhone}</div>}
                </td>
                <td>
                  <div className="text-[12px]">{PURPOSE_LABEL[a.purpose] || label(a.purpose)}</div>
                  <div className="text-[11px] text-muted">
                    {a.gameTitle || "—"}{a.seats > 1 ? ` · ${a.seats} seats` : ""}
                  </div>
                </td>
                {/* Still earmarked means the player's own balance is held against
                    a checkout that went nowhere — they cannot spend it. */}
                <td className="text-[12px]">
                  {formatCurrency(a.walletPaise)}
                  {a.walletEarmarked && a.walletPaise > 0 && (
                    <div className="text-[10px] text-warning">held</div>
                  )}
                </td>
                <td className="text-[12px] font-semibold">{formatCurrency(a.directPaise)}</td>
                <td className="text-[12px] text-muted">{formatCurrency(a.totalPaise)}</td>
                <td><span className={`${BADGE} ${PAYMENT_BADGE[a.paymentStatus] || BADGE_GRAY}`}>{label(a.paymentStatus)}</span></td>
                <td><span className={`${BADGE} ${BOOKING_BADGE[a.bookingStatus] || BADGE_GRAY}`}>{label(a.bookingStatus)}</span></td>
                <td>
                  <span className={`${BADGE} ${REFUND_BADGE[a.refundStatus] || BADGE_GRAY}`}>{label(a.refundStatus)}</span>
                  {a.refundReason && <div className="mt-[2px] text-[10px] text-muted">{label(a.refundReason)}</div>}
                  {a.refundedPaise > 0 && <div className="text-[10px] text-muted">{formatCurrency(a.refundedPaise)}</div>}
                </td>
                <td className="max-w-[180px] font-mono text-[10px] text-muted">
                  {a.razorpayOrderId   && <div>{a.razorpayOrderId}</div>}
                  {a.razorpayPaymentId && <div>{a.razorpayPaymentId}</div>}
                  {a.razorpayRefundId  && <div>{a.razorpayRefundId}</div>}
                  {!a.razorpayOrderId && !a.razorpayPaymentId && <span>—</span>}
                </td>
                <td className="text-[12px]">{formatDateTime(a.createdAt)}</td>
                <td className="text-[12px] text-muted">{formatDateTime(a.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
        label="checkouts"
      />
    </>
  );
}
