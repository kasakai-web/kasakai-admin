"use client";

/* Issued passes — one row per pass somebody holds or held.
 *
 * A pass is never deleted; it changes status. This list IS the history, and a
 * better one than the v1 `Player.passHistory` array, which carried no reason,
 * no price and no revoking admin.
 *
 * Every destructive action asks for a reason, because "why does this player
 * have a free pass?" has to stay answerable a month later. */

import { useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import {
  adminFetch, Product, rupees, shortDate, BTN, BTN_PRIMARY, BTN_DANGER,
  CARD, ERROR_BOX, FIELD, FIELD_LABEL, STATUS_TONE,
} from "./shared";

type IssuedRow = {
  _id: string;
  code: string;
  name: string;
  status: string;
  source: string;
  activatesAt: string | null;
  expiresAt: string | null;
  pricePaidPaise: number;
  grantReason: string | null;
  revokeReason: string | null;
  createdAt: string;
  used: { redemptions: number; benefitPaise: number };
  player: { _id: string; name: string; phone: string } | null;
  described: { summary: string; remaining: { redemptions: number | null } };
};

type Page = { rows: IssuedRow[]; total: number; page: number; limit: number };
type IssuedResponse = { success: boolean; data: Page };
type ProductsResponse = { success: boolean; data: Product[] };

export function IssuedPasses() {
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [q, setQ] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [actionErr, setActionErr] = useState("");
  const [msg, setMsg] = useState("");
  const [granting, setGranting] = useState(false);

  const params = new URLSearchParams({ page: String(pageNo), limit: "25" });
  if (status) params.set("status", status);
  if (product) params.set("product", product);
  if (q) params.set("q", q);

  const { data, error, refresh } = useAdminFetch<IssuedResponse>(
    `/admin/player-passes?${params.toString()}`,
    { errorMessage: "Could not load issued passes." },
  );
  const { data: productData } = useAdminFetch<ProductsResponse>("/admin/pass-products", { cache: true });

  const page = data?.data ?? null;
  const products = productData?.data ?? [];
  const err = actionErr || error;

  const revoke = async (row: IssuedRow) => {
    const reason = window.prompt(`Why is ${row.player?.name || "this player"}'s ${row.name} being withdrawn?`);
    if (!reason) return;
    const res = await adminFetch(`/admin/player-passes/${row._id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) { setActionErr(res.message || "Could not revoke that pass."); return; }
    setActionErr("");
    setMsg(`${row.name} withdrawn. Games already played are unaffected.`);
    refresh();
  };

  const extend = async (row: IssuedRow) => {
    const date = window.prompt("New expiry date (YYYY-MM-DD). It stays valid through the whole of that day.");
    if (!date) return;
    const res = await adminFetch(`/admin/player-passes/${row._id}`, {
      method: "PATCH",
      body: JSON.stringify({ expiresAt: `${date}T00:00:00+05:30`, reason: "extended by admin" }),
    });
    if (!res.ok) { setActionErr(res.message || "Could not extend that pass."); return; }
    setActionErr("");
    setMsg(`${row.name} now runs to ${date}.`);
    refresh();
  };

  const topUp = async (row: IssuedRow) => {
    const n = window.prompt("How many more games to add to this pass?");
    if (!n) return;
    const res = await adminFetch(`/admin/player-passes/${row._id}`, {
      method: "PATCH",
      body: JSON.stringify({ addRedemptions: Number(n), reason: `+${n} games by admin` }),
    });
    if (!res.ok) { setActionErr(res.message || "Could not top that pass up."); return; }
    setActionErr("");
    setMsg(`${n} more games added.`);
    refresh();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <input
          className="min-w-[220px] flex-1 border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          placeholder="Search by pass name or code"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPageNo(1); }}
        />
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={status} onChange={(e) => { setStatus(e.target.value); setPageNo(1); }}>
          <option value="">Any status</option>
          {["active", "pending", "exhausted", "expired", "revoked", "refunded"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={product} onChange={(e) => { setProduct(e.target.value); setPageNo(1); }}>
          <option value="">Any product</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <button type="button" className={`${BTN} ${BTN_PRIMARY}`} onClick={() => setGranting(true)}>
          + Grant a pass
        </button>
      </div>

      {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}
      {msg && <div className="mb-4 text-[12px] text-[#4ade80]">{msg}</div>}

      <div className="flex flex-col gap-2">
        {(page?.rows || []).map((row) => (
          <div key={row._id} className={`${CARD} flex flex-wrap items-center justify-between gap-4 py-4`}>
            <div className="min-w-[200px] flex-1">
              <div className="text-[14px] font-semibold text-fg">
                {row.player?.name || "Unknown player"}
                <span className="ml-2 font-mono text-[11px] text-muted">{row.player?.phone}</span>
              </div>
              <div className="mt-[2px] text-[12.5px] text-body">{row.name}</div>
              <div className="mt-[2px] text-[11.5px] text-muted">{row.described?.summary}</div>
              {row.grantReason && <div className="mt-[2px] text-[11px] text-muted">{row.grantReason}</div>}
            </div>

            <div className="text-right font-mono text-[11.5px] text-muted">
              <div className={STATUS_TONE[row.status] || "text-muted"}>{row.status}</div>
              <div>{row.used?.redemptions || 0} used · {rupees(row.used?.benefitPaise)} given</div>
              <div>
                {row.activatesAt ? shortDate(row.activatesAt) : "—"} → {row.expiresAt ? shortDate(row.expiresAt) : "no expiry"}
              </div>
              <div>{row.source}{row.pricePaidPaise ? ` · ${rupees(row.pricePaidPaise)}` : ""}</div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className={BTN} onClick={() => extend(row)}>Extend</button>
              <button type="button" className={BTN} onClick={() => topUp(row)}>Top up</button>
              {!["revoked", "refunded"].includes(row.status) && (
                <button type="button" className={`${BTN} ${BTN_DANGER}`} onClick={() => revoke(row)}>
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
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
          No passes match that.
        </div>
      )}

      {granting && (
        <GrantDialog
          products={products.filter((p) => p.grantable && p.status === "active")}
          onClose={() => setGranting(false)}
          onGranted={(m) => { setGranting(false); setMsg(m); refresh(); }}
        />
      )}
    </div>
  );
}

/* Granting takes a player id, a product and a REASON. The reason is required by
 * the server, not merely by this form — it is the field v1's passHistory never
 * had, and the whole point of keeping the row. */
function GrantDialog({
  products,
  onClose,
  onGranted,
}: {
  products: Product[];
  onClose: () => void;
  onGranted: (message: string) => void;
}) {
  const [playerId, setPlayerId] = useState("");
  const [productId, setProductId] = useState(products[0]?._id || "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const grant = async () => {
    setSaving(true);
    setErr("");
    const res = await adminFetch("/admin/player-passes", {
      method: "POST",
      body: JSON.stringify({ playerId, productId, reason }),
    });
    setSaving(false);
    if (!res.ok) { setErr([res.message, ...(res.details || [])].filter(Boolean).join(" ")); return; }
    onGranted("Pass granted.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.75)] p-6">
      <div className="w-full max-w-[520px] rounded-[16px] border border-border bg-bg p-6">
        <h3 className="mb-4 text-[16px] font-bold text-fg">Grant a pass</h3>
        {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}

        <div className="flex flex-col gap-3">
          <div>
            <label className={FIELD_LABEL}>Player id</label>
            <input className={FIELD} value={playerId} onChange={(e) => setPlayerId(e.target.value.trim())} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Pass</label>
            <select className={FIELD} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Reason (required)</label>
            <input className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Compensation for the cancelled 12 Oct game" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={BTN} onClick={onClose}>Cancel</button>
          <button type="button" className={`${BTN} ${BTN_PRIMARY}`}
            disabled={saving || !playerId || !productId || !reason} onClick={grant}>
            {saving ? "Granting…" : "Grant"}
          </button>
        </div>
      </div>
    </div>
  );
}
