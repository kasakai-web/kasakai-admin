"use client";

/* The catalogue — every pass product, with the numbers that say whether it
 * works: how many were issued, how many redemptions they took, the value
 * delivered, and the value-to-price ratio.
 *
 * That last one is the number that predicts renewal. A pass whose median holder
 * extracts 5× its price is mispriced; one at 0.8× churns. */

import { useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import {
  adminFetch, Product, rupees, shortDate, BTN, BTN_PRIMARY, CARD, ERROR_BOX, STATUS_TONE,
} from "./shared";
import { ProductEditor } from "./ProductEditor";

type ProductsResponse = { success: boolean; data: Product[] };

export function PassCatalogue() {
  const [msg, setMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  // `loading` is derived from which request the held data belongs to — see
  // shared/useAdminFetch. The older shape called setLoading(true) inside the
  // effect, which cascades a render before paint on every mount.
  const { data, loading, error, refresh } = useAdminFetch<ProductsResponse>(
    "/admin/pass-products",
    { errorMessage: "Could not load pass products." },
  );
  const products = data?.data ?? [];
  const err = actionErr || error;

  const setStatus = async (p: Product, status: Product["status"]) => {
    const res = await adminFetch(`/admin/pass-products/${p._id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { setActionErr(res.message || "Could not change that status."); return; }
    setActionErr("");
    setMsg(`"${p.name}" is now ${status}.`);
    refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] text-muted">
          {products.length} product{products.length === 1 ? "" : "s"}
        </div>
        <button type="button" className={`${BTN} ${BTN_PRIMARY}`} onClick={() => setCreating(true)}>
          + New pass
        </button>
      </div>

      {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}
      {msg && <div className="mb-4 text-[12px] text-[#4ade80]">{msg}</div>}
      {loading && <div className="text-[13px] text-muted">Loading…</div>}

      <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
        {products.map((p) => (
          <div key={p._id} className={CARD}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-fg">{p.name}</div>
                <div className="font-mono text-[11px] text-muted">{p.code}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.deprecated && (
                  <span className="rounded-full border border-border-2 px-[8px] py-[2px] font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                    legacy
                  </span>
                )}
                <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_TONE[p.status]}`}>
                  {p.status}
                </span>
              </div>
            </div>

            <div className="mb-3 text-[13px] leading-[1.5] text-body">
              {p.described?.summary || "—"}
            </div>

            <div className="mb-3 grid grid-cols-4 gap-2 border-y border-border py-3 text-center max-[640px]:grid-cols-2">
              <Stat label="Issued" value={String(p.stats?.issued ?? 0)} sub={`${p.stats?.live ?? 0} live`} />
              <Stat label="Redemptions" value={String(p.stats?.redemptions ?? 0)} />
              <Stat label="Value given" value={rupees(p.stats?.benefitPaise)} />
              <Stat
                label="Value / price"
                value={p.stats?.valueRatio != null ? `${p.stats.valueRatio}×` : "—"}
                sub={p.pricePaise ? rupees(p.pricePaise) : "grant only"}
              />
            </div>

            <div className="mb-3 font-mono text-[11px] text-muted">
              Funded by {p.funding?.model}
              {p.funding?.model === "shared" ? ` (${p.funding.organiserSharePercent}% organiser)` : ""}
              {p.stats?.reimbursementPaise
                ? ` · ${rupees(p.stats.reimbursementPaise)} reimbursable`
                : ""}
              {p.createdAt ? ` · created ${shortDate(p.createdAt)}` : ""}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN} onClick={() => setEditing(p)}>Edit</button>
              {p.status !== "active" && (
                <button type="button" className={BTN} onClick={() => setStatus(p, "active")}>Activate</button>
              )}
              {p.status === "active" && (
                <button type="button" className={BTN} onClick={() => setStatus(p, "paused")}>Pause</button>
              )}
              {p.status !== "retired" && (
                <button type="button" className={BTN} onClick={() => setStatus(p, "retired")}>Retire</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && products.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border-2 p-10 text-center text-[13px] text-muted">
          No pass products yet. The migration seeds one per legacy pass type; anything new starts here.
        </div>
      )}

      {(creating || editing) && (
        <ProductEditor
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(m) => { setCreating(false); setEditing(null); setMsg(m); refresh(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[17px] font-bold text-fg">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted">{label}</div>
      {sub && <div className="mt-[2px] font-mono text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
