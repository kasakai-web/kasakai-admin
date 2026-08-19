"use client";

import { useEffect, useState } from "react";
import {
  STATS_GRID, STAT_CARD, STAT_LABEL, STAT_VALUE, STAT_DELTA, UP, DOWN, NEUTRAL, TOOLBAR,
  SEARCH_INPUT, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, TAB_BAR, TAB, TAB_ACTIVE,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { formatDate, formatCurrency } from "../shared/format";
import { Head } from "../shared/components";
import { RechargeOfferPanel } from "../RechargeOfferPanel";

// Finance
type WalletRow = {
  _id: string;
  user?: { name?: string; phone?: string; email?: string } | null;
  balancePaise: number; totalTopUpPaise: number;
  totalSpentPaise: number; totalRefundedPaise: number; updatedAt?: string;
};

type WalletApiResponse = {
  success: boolean; count?: number;
  total?: number; page?: number; limit?: number; totalPages?: number;
  data: WalletRow[]; message?: string;
};

type WalletSummary = {
  totalBalancePaise: number; totalTopUpPaise: number;
  totalSpentPaise: number; totalRefundedPaise: number;
};

type OrganiserEarningRow = {
  id: string; name: string; phone?: string; email?: string | null;
  totalGames: number; completedGames: number; cancelledGames: number;
  totalRevenuePaise: number; totalGuestSlots: number; totalPaidRegistrations: number;
};

type FinanceTab = "wallets" | "earnings";

export function Finance() {
  const [tab, setTab] = useState<FinanceTab>("wallets");

  /* Two independent lists on one route, so each pager namespaces its own URL
     keys — ?walletsPage=3&earningsPage=2 addresses both tabs at once. */
  const walletPager   = usePagination({ key: "wallets" });
  const earningsPager = usePagination({ key: "earnings" });

  // Wallet state
  const [walletSearch, setWalletSearch]     = useState("");
  const [debouncedWalletSearch, setDebouncedWalletSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedWalletSearch(walletSearch), 300);
    return () => clearTimeout(t);
  }, [walletSearch]);

  // Earnings state
  const [earningsSearch, setEarningsSearch]   = useState("");
  const [debouncedEarningsSearch, setDebouncedEarningsSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEarningsSearch(earningsSearch), 300);
    return () => clearTimeout(t);
  }, [earningsSearch]);

  const walletParams = new URLSearchParams({ page: String(walletPager.page), limit: String(walletPager.limit) });
  if (debouncedWalletSearch.trim()) walletParams.set("search", debouncedWalletSearch.trim());

  const earningsParams = new URLSearchParams({ page: String(earningsPager.page), limit: String(earningsPager.limit) });
  if (debouncedEarningsSearch.trim()) earningsParams.set("search", debouncedEarningsSearch.trim());

  const {
    data: walletBody, loading: walletsLoading, error: walletsError,
  } = useAdminFetch<WalletApiResponse>(
    `/admin/wallets?${walletParams.toString()}`,
    { errorMessage: "Failed to load wallets." },
  );

  const {
    data: earningsBody, loading: earningsLoading, error: earningsError,
  } = useAdminFetch<{ data?: OrganiserEarningRow[]; total?: number; totalPages?: number }>(
    `/admin/organiser-earnings?${earningsParams.toString()}`,
    { errorMessage: "Failed to load earnings." },
  );

  /* The four platform figures at the top come from their own endpoint on a
     constant path, so they are fetched once per visit instead of being re-summed
     every time either table pages. */
  const { data: walletSumBody } = useAdminFetch<{ data?: WalletSummary }>(
    "/admin/wallets/summary",
    { cache: true, errorMessage: "Failed to load wallet totals." },
  );

  const wallets     = walletBody?.data ?? [];
  const walletSum: Partial<WalletSummary> = walletSumBody?.data ?? {};
  const walletTotal = walletBody?.total ?? wallets.length;

  const earnings      = earningsBody?.data ?? [];
  const earningsTotal = earningsBody?.total ?? earnings.length;

  // Server already filtered + paginated each list.
  const filteredWallets  = wallets;
  const filteredEarnings = earnings;

  return (
    <>
      <Head title="Finance" sub="Player wallets, organiser earnings & platform revenue" />

      {/* Summary */}
      <div className={STATS_GRID}>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Platform Balance</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalBalancePaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>All player wallets combined</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Top-ups</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalTopUpPaise)}</div><div className={`${STAT_DELTA} ${UP}`}>Lifetime recharges</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Spent</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalSpentPaise)}</div><div className={`${STAT_DELTA} ${DOWN}`}>Game registrations</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Refunded</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalRefundedPaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Cancellations &amp; backouts</div></div>
      </div>

      {/* Tabs */}
      <div className={TAB_BAR}>
        <button className={`${TAB} ${tab === "wallets" ? TAB_ACTIVE : ""}`} onClick={() => setTab("wallets")} type="button">
          Player Wallets ({walletTotal})
        </button>
        <button className={`${TAB} ${tab === "earnings" ? TAB_ACTIVE : ""}`} onClick={() => setTab("earnings")} type="button">
          Organiser Earnings ({earningsTotal})
        </button>
      </div>

      {/* Player Wallets */}
      {tab === "wallets" && (
        <>
          <RechargeOfferPanel />

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search by name, phone or email…" value={walletSearch} onChange={(e) => { setWalletSearch(e.target.value); walletPager.resetPage(); }} />
          </div>
          {walletsError && <div className={FORM_ERROR}>{walletsError}</div>}
          {walletsLoading && <div className={LOADING_STATE}>Loading wallets…</div>}
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>Player</th><th>Phone</th><th>Email</th><th>Balance</th><th>Total Top-ups</th><th>Total Spent</th><th>Total Refunded</th><th>Last Updated</th></tr>
              </thead>
              <tbody>
                {!walletsLoading && filteredWallets.length === 0 && <tr><td colSpan={8} className="p-8! text-center text-muted!">No wallets found.</td></tr>}
                {filteredWallets.map((w) => (
                  <tr key={w._id}>
                    <td>{w.user?.name || "Unknown"}</td>
                    <td>{w.user?.phone || "—"}</td>
                    <td>{w.user?.email || "—"}</td>
                    <td className={`font-semibold ${(w.balancePaise || 0) > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(w.balancePaise)}</td>
                    <td>{formatCurrency(w.totalTopUpPaise)}</td>
                    <td>{formatCurrency(w.totalSpentPaise)}</td>
                    <td>{formatCurrency(w.totalRefundedPaise)}</td>
                    <td>{formatDate(w.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={walletPager.page}
            limit={walletPager.limit}
            total={walletTotal}
            onPageChange={walletPager.setPage}
            onLimitChange={walletPager.setLimit}
            label="wallets"
          />
        </>
      )}

      {/* Organiser Earnings */}
      {tab === "earnings" && (
        <>
          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search organiser by name or phone…" value={earningsSearch} onChange={(e) => { setEarningsSearch(e.target.value); earningsPager.resetPage(); }} />
          </div>
          {earningsError && <div className={FORM_ERROR}>{earningsError}</div>}
          {earningsLoading && <div className={LOADING_STATE}>Loading organiser earnings…</div>}
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>Organiser</th><th>Phone</th><th>Total Games</th><th>Completed</th><th>Cancelled</th><th>Paid Regs</th><th>Guest Slots</th><th>Total Revenue</th></tr>
              </thead>
              <tbody>
                {!earningsLoading && filteredEarnings.length === 0 && <tr><td colSpan={8} className="p-8! text-center text-muted!">No earnings data yet.</td></tr>}
                {filteredEarnings.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.name}
                      <div className="text-[11px] text-muted">{e.email || ""}</div>
                    </td>
                    <td>{e.phone || "—"}</td>
                    <td>{e.totalGames}</td>
                    <td><span className="text-success">{e.completedGames}</span></td>
                    <td><span className={e.cancelledGames > 0 ? "text-danger" : "text-muted"}>{e.cancelledGames}</span></td>
                    <td>{e.totalPaidRegistrations}</td>
                    <td>{e.totalGuestSlots}</td>
                    <td className="font-semibold text-success!">{formatCurrency(e.totalRevenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={earningsPager.page}
            limit={earningsPager.limit}
            total={earningsTotal}
            onPageChange={earningsPager.setPage}
            onLimitChange={earningsPager.setLimit}
            label="organisers"
          />
        </>
      )}
    </>
  );
}
