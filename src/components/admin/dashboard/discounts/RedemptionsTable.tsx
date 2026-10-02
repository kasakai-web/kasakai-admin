"use client";

/* The discount ledger — one row per seat an offer was applied to.
 *
 * The four states are the whole story of a use: HELD while a booking is in
 * flight, CONSUMED once the seat exists, RELEASED when the booking never
 * happened, RETURNED when the game was cancelled or the organiser removed the
 * player. Only the last two give the use back; a player cancelling leaves it
 * consumed. The CSV is the transaction-level record finance reconciles against
 * (§8). */

import { useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import { getAdminToken } from "@/lib/admin-session";
import {
  API_BASE, rupees, shortDateTime, downloadText, BTN, ERROR_BOX,
  Campaign, Redemption, REDEMPTION_TONE,
} from "./shared";

type Page = { rows: Redemption[]; total: number; page: number; limit: number };

export function RedemptionsTable({ campaignId = null, campaigns = [] }: { campaignId?: string | null; campaigns?: Campaign[] }) {
  const [campaign, setCampaign] = useState(campaignId || "");
  const [state, setState] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [exportErr, setExportErr] = useState("");
  const [exporting, setExporting] = useState(false);

  const params = new URLSearchParams({ page: String(pageNo), limit: "50" });
  if (campaign) params.set("campaign", campaign);
  if (state) params.set("state", state);

  const { data, loading, error } = useAdminFetch<{ success: boolean; data: Page }>(
    `/admin/discount-redemptions?${params.toString()}`,
    { errorMessage: "Could not load the ledger." },
  );
  const page = data?.data ?? null;

  // A plain link cannot carry the admin's bearer token, so the export is fetched
  // and handed over as a file.
  const exportCsv = async () => {
    setExporting(true);
    setExportErr("");
    try {
      const q = new URLSearchParams({ format: "csv" });
      if (campaign) q.set("campaign", campaign);
      if (state) q.set("state", state);
      const res = await fetch(`${API_BASE}/admin/discount-redemptions?${q.toString()}`, {
        headers: { Authorization: `Bearer ${getAdminToken() || ""}` },
      });
      if (!res.ok) throw new Error("Export failed.");
      downloadText(`discount-redemptions${campaign ? `-${campaign.slice(-6)}` : ""}.csv`, await res.text());
    } catch {
      setExportErr("Could not export the ledger.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        {!campaignId && (
          <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
            value={campaign} onChange={(e) => { setCampaign(e.target.value); setPageNo(1); }}>
            <option value="">Every campaign</option>
            {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={state} onChange={(e) => { setState(e.target.value); setPageNo(1); }}>
          <option value="">Every state</option>
          <option value="held">Held</option>
          <option value="consumed">Consumed</option>
          <option value="released">Released</option>
          <option value="returned">Returned</option>
        </select>
        <button type="button" className={`${BTN} ml-auto`} disabled={exporting} onClick={exportCsv}>
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      {(error || exportErr) && <div className={`${ERROR_BOX} mb-4`}>{error || exportErr}</div>}
      {loading && !page && <div className="text-[13px] text-muted">Loading…</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="py-2">When</th>
              <th>Player</th>
              <th>Game</th>
              {!campaignId && <th>Campaign</th>}
              <th>Via</th>
              <th>Fee</th>
              <th>Discount</th>
              <th>Paid</th>
              <th>Funded by</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {(page?.rows || []).map((r) => (
              <tr key={r._id} className="border-b border-border text-body">
                <td className="py-2 font-mono text-muted">{shortDateTime(r.createdAt)}</td>
                <td className="text-fg">{r.player?.name || "—"}</td>
                <td className="max-w-[200px] truncate" title={r.game?.title}>
                  {r.game?.title || "—"}
                  {r.game?.scheduledAt && <span className="ml-1 font-mono text-[10.5px] text-muted">{shortDateTime(r.game.scheduledAt)}</span>}
                </td>
                {!campaignId && (
                  <td className="max-w-[160px] truncate" title={r.campaign?.name}>
                    {r.campaign?.name || "—"} <span className="font-mono text-[10px] text-muted">v{r.campaignVersion}</span>
                  </td>
                )}
                <td className="font-mono">{r.source === "code" ? (r.codeText || "code") : "auto"}</td>
                <td className="font-mono">{rupees(r.basePaise)}</td>
                <td className="font-mono text-accent">−{rupees(r.savingPaise)}</td>
                <td className="font-mono">{rupees(r.paidPaise)}</td>
                <td className="font-mono text-muted">{r.fundedBy}</td>
                <td className={`font-mono ${REDEMPTION_TONE[r.state]}`} title={r.releaseReason || undefined}>{r.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && page.total > page.limit && (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={BTN} disabled={pageNo <= 1} onClick={() => setPageNo((n) => Math.max(1, n - 1))}>
            Previous
          </button>
          <span className="font-mono text-[12px] text-muted">
            {(pageNo - 1) * page.limit + 1}–{Math.min(pageNo * page.limit, page.total)} of {page.total}
          </span>
          <button type="button" className={BTN} disabled={pageNo * page.limit >= page.total} onClick={() => setPageNo((n) => n + 1)}>
            Next
          </button>
        </div>
      )}

      {page && page.rows.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border-2 p-10 text-center text-[13px] text-muted">
          No redemptions yet. Every seat an offer is applied to lands here.
        </div>
      )}
    </div>
  );
}
