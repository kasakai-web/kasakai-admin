"use client";

import { useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  STATS_GRID, STAT_CARD, STAT_LABEL, STAT_VALUE, STAT_DELTA, UP, DOWN, NEUTRAL, TOOLBAR,
  SEARCH_INPUT, TABLE_WRAP, TABLE, ACTION_BTN, FORM_ERROR, LOADING_STATE,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination, useResetPageOnFilterChange } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { formatDate, formatCurrency } from "../shared/format";
import { Head } from "../shared/components";

type AdminWalletRow = {
  _id: string;
  user?: { _id?: string; name?: string; phone?: string; email?: string } | null;
  balancePaise: number;
  lockedPaise: number;
  totalTopUpPaise: number;
  totalSpentPaise: number;
  totalRefundedPaise: number;
  updatedAt?: string;
};

type AdminWalletListResponse = {
  success: boolean;
  count?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  data: AdminWalletRow[];
  message?: string;
};

type AdminWalletSummary = {
  totalBalancePaise: number; totalTopUpPaise: number;
  totalSpentPaise: number; totalRefundedPaise: number;
};

type AdjustTarget = { userId: string; name: string; balancePaise: number };

function AdjustWalletModal({ target, onClose, onSuccess }: {
  target: AdjustTarget;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}) {
  const [mode, setMode]     = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    const rupees = parseFloat(amount);
    if (!amount || isNaN(rupees) || rupees <= 0) { setError("Enter a valid amount greater than 0."); return; }
    if (!note.trim()) { setError("A reason / note is required."); return; }

    const amountPaise = Math.round(rupees * 100) * (mode === "debit" ? -1 : 1);
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/wallets/${target.userId}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountPaise, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to adjust wallet."); setLoading(false); return; }
      onSuccess(data.data.balancePaise);
      onClose();
    } catch { setError("Cannot reach the server."); setLoading(false); }
  };

  const availableRupees = ((target.balancePaise) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.65)] backdrop-blur-[3px]" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start gap-[14px] border-b border-border px-6 pt-[22px] pb-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.12)]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.2" strokeLinecap="round">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-fg">Adjust Wallet</h3>
            <p className="m-0 text-[13px] text-muted">
              <strong className="text-fg">{target.name}</strong>
              <span className="ml-2 text-accent">Current: ₹{availableRupees}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-[14px] px-6 py-5">
          {/* Credit / Debit toggle */}
          <div className="flex gap-2">
            {(["credit", "debit"] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                className={`h-[38px] flex-1 cursor-pointer rounded-lg border-[1.5px] text-[13px] font-bold transition-all duration-150 ${
                  mode === m
                    ? (m === "credit" ? "border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.18)] text-accent" : "border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.15)] text-danger")
                    : "border-border bg-transparent text-muted"
                }`}>
                {m === "credit" ? "+ Credit" : "− Debit"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-[6px] block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Amount (₹)</label>
            <input
              type="number" min="1" step="any" value={amount} onChange={e => { setAmount(e.target.value); setError(null); }}
              placeholder="e.g. 100"
              className="box-border w-full rounded-[9px] border-[1.5px] border-border bg-[#0b1114] px-[13px] py-[10px] text-[14px] text-fg outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "#24313b")}
              disabled={loading}
            />
          </div>

          {/* Note */}
          <div>
            <label className="mb-[6px] block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Reason / Note <span className="text-danger">*</span></label>
            <input
              type="text" value={note} onChange={e => { setNote(e.target.value); setError(null); }}
              placeholder="e.g. Bonus credit for referral"
              className="box-border w-full rounded-[9px] border-[1.5px] border-border bg-[#0b1114] px-[13px] py-[10px] text-[13px] text-fg outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "#24313b")}
              disabled={loading}
            />
          </div>

          {error && <p className="m-0 text-[12px] font-semibold text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 pb-[22px]">
          <button type="button" onClick={onClose} disabled={loading}
            className={`h-[42px] flex-1 rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted ${loading ? "cursor-default opacity-50" : "cursor-pointer opacity-100"}`}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className={`h-[42px] flex-[2] rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.4)] text-[13px] font-extrabold text-accent transition-all duration-150 ${loading ? "cursor-default bg-[rgba(91,230,178,0.06)] opacity-60" : "cursor-pointer bg-[rgba(91,230,178,0.15)] opacity-100"}`}>
            {loading ? "Saving…" : "Confirm Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WalletAdmin() {
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  // ── Pagination — page + rows-per-page live in the URL (?page=2&limit=50) ──
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  // Debounce the search box…
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  // …and rewind to page 1 only once the query actually CHANGES. Resetting from
  // inside the debounce would fire on mount too, throwing away a `?page=` link.
  useResetPageOnFilterChange(resetPage, [search]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

  const { data, loading, error, setData, refresh } = useAdminFetch<AdminWalletListResponse>(
    `/admin/wallets?${params.toString()}`,
    { errorMessage: "Failed to load wallets." },
  );

  /* Money totals are their own request, with a constant path — fetched once per
     visit rather than re-summed on every page change. */
  const { data: summaryBody, refresh: refreshSummary } = useAdminFetch<{ data?: AdminWalletSummary }>(
    "/admin/wallets/summary",
    { cache: true, errorMessage: "Failed to load wallet totals." },
  );

  const wallets = data?.data ?? [];
  const summary = summaryBody?.data ?? null;
  const total   = data?.total ?? wallets.length;

  const handleAdjustSuccess = (userId: string, newBalancePaise: number) => {
    setData((prev) => prev && ({
      ...prev,
      data: (prev.data || []).map(w => w.user?._id === userId ? { ...w, balancePaise: newBalancePaise } : w),
    }));
    setToast("Wallet adjusted successfully.");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <>
      {adjustTarget && (
        <AdjustWalletModal
          target={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSuccess={(bal) => handleAdjustSuccess(adjustTarget.userId, bal)}
        />
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[10000] flex min-w-[260px] -translate-x-1/2 items-center gap-[10px] rounded-xl border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(17,20,36,0.97)] px-5 py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-[13px] font-semibold text-fg">{toast}</span>
        </div>
      )}

      <Head title="Player Wallets" sub={loading ? "Loading…" : `${total} player wallets`} />

      {/* Summary cards */}
      {summary && (
        <div className={STATS_GRID}>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Balance</div><div className={STAT_VALUE}>{formatCurrency(summary.totalBalancePaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>All player wallets</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Top-ups</div><div className={STAT_VALUE}>{formatCurrency(summary.totalTopUpPaise)}</div><div className={`${STAT_DELTA} ${UP}`}>Lifetime recharges</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Spent</div><div className={STAT_VALUE}>{formatCurrency(summary.totalSpentPaise)}</div><div className={`${STAT_DELTA} ${DOWN}`}>Game registrations</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Refunded</div><div className={STAT_VALUE}>{formatCurrency(summary.totalRefundedPaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Cancellations</div></div>
        </div>
      )}

      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={ACTION_BTN} type="button" onClick={() => { refresh(); refreshSummary(); }}>Refresh</button>
      </div>

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading wallets…</div>}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Phone</th>
              <th>Balance</th>
              <th>Locked</th>
              <th>Available</th>
              <th>Total Top-ups</th>
              <th>Total Spent</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && wallets.length === 0 && (
              <tr><td colSpan={9} className="p-8! text-center text-muted!">No wallets found.</td></tr>
            )}
            {wallets.map(w => {
              const available = (w.balancePaise || 0) - (w.lockedPaise || 0);
              return (
                <tr key={w._id}>
                  <td>
                    <div className="font-semibold">{w.user?.name || "Unknown"}</div>
                    {w.user?.email && <div className="text-[11px] text-muted">{w.user.email}</div>}
                  </td>
                  <td>{w.user?.phone || "—"}</td>
                  <td className={`font-semibold ${(w.balancePaise || 0) > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(w.balancePaise)}</td>
                  <td className={(w.lockedPaise || 0) > 0 ? "text-warning!" : "text-muted!"}>{formatCurrency(w.lockedPaise)}</td>
                  <td className={`font-semibold ${available > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(available)}</td>
                  <td>{formatCurrency(w.totalTopUpPaise)}</td>
                  <td>{formatCurrency(w.totalSpentPaise)}</td>
                  <td>{formatDate(w.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={ACTION_BTN}
                      onClick={() => setAdjustTarget({ userId: w.user?._id || w._id, name: w.user?.name || "Unknown", balancePaise: w.balancePaise || 0 })}
                    >
                      Adjust
                    </button>
                  </td>
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
        label="wallets"
      />
    </>
  );
}
