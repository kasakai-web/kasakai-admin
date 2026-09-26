"use client";

/* The ledger, and the economics on top of it.
 *
 * One row per covered seat, with the value forgone on it. This is the record v1
 * never kept: a covered seat wrote `amountPaidPaise: 0` and a ₹0 wallet row
 * with a free-text description, and the organiser earnings report sums exactly
 * that field — so every pass game quietly reduced an organiser's reported
 * earnings with nothing anywhere saying why.
 *
 * `Reimbursable` is the §9 disclosure: what the platform owes an organiser for
 * seats it gave away on their pitch. v2 RECORDS it and does not settle it —
 * money still moves off-platform — but an invoice line is not nothing. */

import { useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import {
  Product, rupees, shortDateTime, BTN, CARD, ERROR_BOX,
} from "./shared";

type LedgerRow = {
  _id: string;
  feePaise: number;
  benefitPaise: number;
  paidPaise: number;
  seatType: "own" | "guest";
  status: string;
  fundedBy: string;
  reimbursementPaise: number;
  createdAt: string;
  matched?: { metro?: string | null; citySlug?: string | null; format?: string | null };
  player?: { _id: string; name: string } | null;
  game?: { _id: string; title?: string; scheduledAt?: string } | null;
  product?: { _id: string; name: string; code: string } | null;
};

type Page = { rows: LedgerRow[]; total: number; page: number; limit: number };

type Analytics = {
  totals: {
    issued: number; live: number; redemptions: number;
    revenuePaise: number; benefitPaise: number; reimbursementPaise: number;
  };
};

type LedgerResponse    = { success: boolean; data: Page };
type AnalyticsResponse = { success: boolean; data: Analytics };
type ProductsResponse  = { success: boolean; data: Product[] };

export function RedemptionLedger() {
  const [product, setProduct] = useState("");
  const [pageNo, setPageNo] = useState(1);

  const params = new URLSearchParams({ page: String(pageNo), limit: "50" });
  if (product) params.set("product", product);

  const { data: ledgerData, error } = useAdminFetch<LedgerResponse>(
    `/admin/pass-redemptions?${params.toString()}`,
    { errorMessage: "Could not load the ledger." },
  );
  const { data: econData } = useAdminFetch<AnalyticsResponse>("/admin/pass-analytics");
  const { data: productData } = useAdminFetch<ProductsResponse>("/admin/pass-products", { cache: true });

  const page      = ledgerData?.data ?? null;
  const analytics = econData?.data ?? null;
  const products  = productData?.data ?? [];
  const err       = error;

  return (
    <div>
      {analytics && (
        <div className={`${CARD} mb-5`}>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Across every pass
          </div>
          <div className="grid grid-cols-5 gap-3 text-center max-[900px]:grid-cols-2">
            <Tile label="Issued" value={String(analytics.totals.issued)} sub={`${analytics.totals.live} live`} />
            <Tile label="Redemptions" value={String(analytics.totals.redemptions)} />
            <Tile label="Revenue" value={rupees(analytics.totals.revenuePaise)} />
            <Tile label="Value given" value={rupees(analytics.totals.benefitPaise)} />
            <Tile
              label="Reimbursable"
              value={rupees(analytics.totals.reimbursementPaise)}
              sub="owed to organisers"
            />
          </div>

          {/* The per-product breakdown lives on the Economics tab, where it can
              be windowed and where "net" is split by who actually bears it.
              Printing an all-time copy of it here as well would give the two
              tabs different numbers for the same question. */}
          <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
            All-time, across every product. The <strong className="text-body">Economics</strong> tab
            breaks this down by product, city and organiser over a window, and says who bears each
            covered seat.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-[10px]">
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={product} onChange={(e) => { setProduct(e.target.value); setPageNo(1); }}>
          <option value="">Every product</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="py-2">When</th>
              <th>Player</th>
              <th>Game</th>
              <th>Pass</th>
              <th>Seat</th>
              <th>Fee</th>
              <th>Covered</th>
              <th>Paid</th>
              <th>Funded by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(page?.rows || []).map((r) => (
              <tr key={r._id} className="border-b border-border text-body">
                <td className="py-2 font-mono text-muted">{shortDateTime(r.createdAt)}</td>
                <td className="text-fg">{r.player?.name || "—"}</td>
                <td className="max-w-[200px] truncate">{r.game?.title || "—"}</td>
                <td>{r.product?.name || "—"}</td>
                <td className="font-mono">{r.seatType}</td>
                <td className="font-mono">{rupees(r.feePaise)}</td>
                <td className="font-mono text-accent">−{rupees(r.benefitPaise)}</td>
                <td className="font-mono">{rupees(r.paidPaise)}</td>
                <td className="font-mono text-muted">
                  {r.fundedBy}
                  {r.reimbursementPaise ? ` (${rupees(r.reimbursementPaise)})` : ""}
                </td>
                <td className={`font-mono ${r.status === "released" ? "text-muted line-through" : ""}`}>
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && page.total > page.limit && (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={BTN} disabled={pageNo <= 1}
            onClick={() => setPageNo((n) => Math.max(1, n - 1))}>Previous</button>
          <span className="font-mono text-[12px] text-muted">
            {(pageNo - 1) * page.limit + 1}–{Math.min(pageNo * page.limit, page.total)} of {page.total}
          </span>
          <button type="button" className={BTN} disabled={pageNo * page.limit >= page.total}
            onClick={() => setPageNo((n) => n + 1)}>Next</button>
        </div>
      )}

      {page && page.rows.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border-2 p-10 text-center text-[13px] text-muted">
          No redemptions yet. Every seat a pass covers from now on lands here.
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[20px] font-bold text-fg">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted">{label}</div>
      {sub && <div className="mt-[2px] font-mono text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
