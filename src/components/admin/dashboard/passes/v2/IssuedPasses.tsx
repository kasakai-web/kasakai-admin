"use client";

/* Issued passes — one row per pass somebody holds or held.
 *
 * A pass is never deleted; it changes status. This list IS the history, and a
 * better one than the v1 `Player.passHistory` array, which carried no reason,
 * no price and no revoking admin.
 *
 * Every destructive action asks for a reason, because "why does this player
 * have a free pass?" has to stay answerable a month later. */

import { useEffect, useState } from "react";
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

// One row of GET /admin/players — the search the Legacy (v1) screen runs, so a
// player is found here exactly as they are found there.
type PlayerHit = { id: string; name: string; phone: string; email: string | null; location: string | null };
type PlayersResponse = { success: boolean; data: PlayerHit[] };

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
          placeholder="Search by player name, phone or pass name"
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

const MIN_SEARCH = 2;
const MAX_HITS = 8;

// A number arrives pasted from WhatsApp as "+91 99306 04869", and is stored with
// or without the +91. Its last ten digits are a substring of either, so a
// phone-shaped entry is searched by those; anything else is sent as typed.
function searchTerm(raw: string) {
  const term = raw.trim();
  if (!/^[\d\s+()-]+$/.test(term)) return term;
  const digits = term.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/* Granting takes a player, a product and a REASON. The reason is required by
 * the server, not merely by this form — it is the field v1's passHistory never
 * had, and the whole point of keeping the row.
 *
 * The player is FOUND rather than typed: the server grants by id, and no admin
 * screen shows one. The search is the Legacy (v1) screen's own, so name, phone
 * and email all work here the way they do there. */
function GrantDialog({
  products,
  onClose,
  onGranted,
}: {
  products: Product[];
  onClose: () => void;
  onGranted: (message: string) => void;
}) {
  const [player, setPlayer] = useState<PlayerHit | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [productId, setProductId] = useState(products[0]?._id || "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced, as on the legacy screen — one request per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm(search)), 300);
    return () => clearTimeout(t);
  }, [search]);

  const searching = !player && debounced.length >= MIN_SEARCH;
  const { data: found, loading: finding, error: findErr } = useAdminFetch<PlayersResponse>(
    searching
      ? `/admin/players?${new URLSearchParams({ search: debounced, limit: String(MAX_HITS) }).toString()}`
      : null,
    { errorMessage: "Could not search players." },
  );
  const hits = searching ? found?.data ?? [] : [];

  const choose = (hit: PlayerHit) => {
    setPlayer(hit);
    setSearch("");
    setDebounced("");
  };

  const grant = async () => {
    if (!player) return;
    setSaving(true);
    setErr("");
    const res = await adminFetch("/admin/player-passes", {
      method: "POST",
      body: JSON.stringify({ playerId: player.id, productId, reason }),
    });
    setSaving(false);
    if (!res.ok) { setErr([res.message, ...(res.details || [])].filter(Boolean).join(" ")); return; }
    onGranted(`Pass granted to ${player.name}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.75)] p-6">
      <div className="w-full max-w-[520px] rounded-[16px] border border-border bg-bg p-6">
        <h3 className="mb-4 text-[16px] font-bold text-fg">Grant a pass</h3>
        {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}

        <div className="flex flex-col gap-3">
          <div>
            <label className={FIELD_LABEL}>Player</label>
            {player ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border-2 bg-surface-2 px-2 py-[6px]">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-fg">{player.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">
                    {player.phone}{player.email ? ` · ${player.email}` : ""}
                  </div>
                </div>
                <button type="button" className={BTN} onClick={() => setPlayer(null)}>Change</button>
              </div>
            ) : (
              <>
                <input
                  className={FIELD}
                  value={search}
                  placeholder="Search by name, phone or email…"
                  autoFocus
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && (
                  <div className="mt-2 max-h-[240px] divide-y divide-border overflow-y-auto rounded-md border border-border-2">
                    {findErr && <div className="px-3 py-2 text-[12px] text-danger">{findErr}</div>}
                    {!findErr && hits.length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-muted">
                        {finding ? "Searching…" : "No players match that."}
                      </div>
                    )}
                    {hits.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        className="block w-full cursor-pointer bg-transparent px-3 py-2 text-left hover:bg-surface-2"
                        onClick={() => choose(hit)}
                      >
                        <div className="text-[13px] font-semibold text-fg">{hit.name}</div>
                        <div className="font-mono text-[11px] text-muted">
                          {hit.phone}
                          {hit.email ? ` · ${hit.email}` : ""}
                          {hit.location ? ` · ${hit.location}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
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
            disabled={saving || !player || !productId || !reason} onClick={grant}>
            {saving ? "Granting…" : "Grant"}
          </button>
        </div>
      </div>
    </div>
  );
}
