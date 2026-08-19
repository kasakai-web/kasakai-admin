"use client";

import { useEffect, useState } from "react";
import {
  SUMMARY_FOUR, SUMMARY_ITEM, STAT_LABEL, SUMMARY_VALUE, PAY_SUB, BADGE, BADGE_GREEN, BADGE_AMBER,
  BADGE_RED, BADGE_BLUE, BADGE_VIOLET, BADGE_GRAY, TOOLBAR, SEARCH_INPUT, FILTER_SELECT,
  TABLE_WRAP, TABLE, ACTION_BTN, FORM_ERROR, LOADING_STATE,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import {
  formatCurrency, formatDateTime, formatStatusLabel, badgeClassForStatus,
} from "../shared/format";
import { Head } from "../shared/components";

type AdminPaymentRow = {
  id: string; playerName: string; playerPhone?: string | null;
  type: string; amountPaise: number; balanceAfterPaise?: number;
  gameTitle?: string | null;
  organiserName?: string | null; organiserPhone?: string | null;
  description?: string | null;
  razorpayOrderId?: string | null; razorpayPaymentId?: string | null;
  paidAt?: string | null; status: string;
};

type AdminPaymentSummary = {
  totalTopUpPaise?: number; totalDebitPaise?: number;
  totalRefundedPaise?: number; pendingCount?: number;
};

type AdminPaymentListResponse = {
  success: boolean; count?: number;
  total?: number; page?: number; limit?: number; totalPages?: number;
  data: AdminPaymentRow[]; message?: string;
};

const TXN_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  topup:       { label: "Top-up",      cls: BADGE_GREEN  },
  lock:        { label: "Lock",        cls: BADGE_AMBER  },
  unlock:      { label: "Unlock",      cls: BADGE_GRAY   },
  debit:       { label: "Debit",       cls: BADGE_BLUE   },
  refund:      { label: "Refund",      cls: BADGE_VIOLET },
  backout_fee: { label: "Backout Fee", cls: BADGE_RED    },
  bonus:       { label: "Bonus",       cls: BADGE_GREEN  },
  withdrawal:  { label: "Withdrawal",  cls: BADGE_RED    },
};

export function Payments() {
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Pagination — page + rows-per-page live in the URL (?page=2&limit=50) ──
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  // Debounced search — avoids one request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (typeFilter   !== "all") params.set("type", typeFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data, loading, error, refresh } = useAdminFetch<AdminPaymentListResponse>(
    `/admin/payments?${params.toString()}`,
    { errorMessage: "Failed to load payments." },
  );

  /* The header totals are their own request, with a constant path — so they are
     fetched once per visit and NOT re-summed every time the page or a filter
     changes. Refresh re-asks for both. */
  const { data: summaryBody, refresh: refreshSummary } = useAdminFetch<{ data?: AdminPaymentSummary }>(
    "/admin/payments/summary",
    { cache: true, errorMessage: "Failed to load payment totals." },
  );

  const payments = data?.data ?? [];
  const summary: AdminPaymentSummary = summaryBody?.data ?? {};
  const total    = data?.total ?? payments.length;

  const filtered = payments; // server already filtered + paginated

  return (
    <>
      <Head title="Payments" sub={loading ? "Loading…" : `${total} wallet transactions`} />

      {/* Summary cards */}
      <div className={SUMMARY_FOUR}>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Top-ups</div>
          <div className={`${SUMMARY_VALUE} text-success!`}>{formatCurrency(summary.totalTopUpPaise)}</div>
          <div className={PAY_SUB}>Razorpay recharges</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Debits</div>
          <div className={SUMMARY_VALUE}>{formatCurrency(summary.totalDebitPaise)}</div>
          <div className={PAY_SUB}>Game fees &amp; backout charges</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Refunded</div>
          <div className={`${SUMMARY_VALUE} text-violet!`}>{formatCurrency(summary.totalRefundedPaise)}</div>
          <div className={PAY_SUB}>Cancellations &amp; refunds</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Pending</div>
          <div className={`${SUMMARY_VALUE} text-warning!`}>{summary.pendingCount ?? 0}</div>
          <div className={PAY_SUB}>Unconfirmed transactions</div>
        </div>
      </div>

      {/* Filters */}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search player, phone, game, Razorpay ID…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        <select className={FILTER_SELECT} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}>
          <option value="all">All Types</option>
          <option value="topup">Top-up</option>
          <option value="lock">Lock</option>
          <option value="unlock">Unlock</option>
          <option value="debit">Debit</option>
          <option value="refund">Refund</option>
          <option value="backout_fee">Backout Fee</option>
          <option value="bonus">Bonus</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button className={ACTION_BTN} type="button" onClick={() => { refresh(); refreshSummary(); }}>Refresh</button>
      </div>

      {error   && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading transactions…</div>}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Txn ID</th><th>Player</th><th>Type</th><th>Amount</th>
              <th>Balance After</th><th>Game</th><th>Organiser</th>
              <th>Description / Razorpay</th><th>Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="p-6! text-center text-muted!">No transactions found.</td></tr>
            )}
            {filtered.map((p) => {
              const txnMeta = TXN_TYPE_LABEL[p.type] || { label: p.type, cls: BADGE_GRAY };
              return (
                <tr key={String(p.id)}>
                  <td className="font-mono text-[11px]! text-muted!">
                    {String(p.id).slice(-8).toUpperCase()}
                  </td>
                  <td>
                    <div className="font-medium">{p.playerName}</div>
                    {p.playerPhone && <div className="text-[11px] text-muted">{p.playerPhone}</div>}
                  </td>
                  <td>
                    <span className={`${BADGE} ${txnMeta.cls}`}>
                      {txnMeta.label}
                    </span>
                  </td>
                  <td className={`font-semibold ${["refund", "unlock", "bonus"].includes(p.type) ? "text-success!" : ["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "text-danger!" : "text-body!"}`}>
                    {["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "−" : "+"}{formatCurrency(p.amountPaise)}
                  </td>
                  <td className="text-[12px] text-muted">{formatCurrency(p.balanceAfterPaise)}</td>
                  <td>{p.gameTitle || <span className="text-muted">—</span>}</td>
                  <td>
                    {p.organiserName
                      ? <>
                          <div className="font-medium">{p.organiserName}</div>
                          {p.organiserPhone && <div className="text-[11px] text-muted">{p.organiserPhone}</div>}
                        </>
                      : <span className="text-muted">—</span>
                    }
                  </td>
                  <td className="max-w-[180px]">
                    {p.description && <div className="text-[12px]">{p.description}</div>}
                    {p.razorpayPaymentId && (
                      <div className="mt-[2px] font-mono text-[10px] text-muted">
                        {p.razorpayPaymentId}
                      </div>
                    )}
                    {!p.description && !p.razorpayPaymentId && <span className="text-muted">—</span>}
                  </td>
                  <td>{formatDateTime(p.paidAt)}</td>
                  <td><span className={`${BADGE} ${badgeClassForStatus(p.status)}`}>{formatStatusLabel(p.status)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
        label="transactions"
      />
    </>
  );
}
