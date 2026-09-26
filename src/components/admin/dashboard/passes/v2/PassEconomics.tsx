"use client";

/* Pass economics (§14.4) — what the programme costs, who it costs, and whether
 * it is working.
 *
 * Nothing is computed here. Every figure comes from `utils/passEconomics.js` on
 * the server, which is pure and tested, because these are the numbers a
 * commercial decision gets made on and a screen is the worst place to keep an
 * arithmetic rule.
 *
 * Two things this screen is careful about:
 *
 *  • It never prints one number called "net". A covered seat costs the ORGANISER
 *    the fee they never collected and costs the PLATFORM only what the platform
 *    reimburses, so both sides are named. One blended figure is how a product
 *    that loses an organiser ₹40,000 gets signed off as profitable.
 *  • Cannibalisation is labelled as the proxy it is. We cannot observe whether a
 *    covered seat would have sold at full price; we can observe whether the game
 *    ended up full. Presenting the second as the first would be the most
 *    consequential lie on the page. */

import { useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import { Product, rupees, CARD, ERROR_BOX } from "./shared";

type ProductRow = {
  _id: string;
  code: string | null;
  name: string;
  status: string | null;
  deprecated: boolean;
  pricePaise: number;
  funding: { model: string; organiserSharePercent: number; overridesConsent?: boolean };
  seats: number;
  playerCount: number;
  issued: number;
  paid: number;
  live: number;
  revenuePaise: number;
  benefitPaise: number;
  reimbursementPaise: number;
  organiserBornePaise: number;
  platformNetPaise: number;
  netPaise: number;
  marginPercent: number | null;
};

type Economics = {
  window: { from: string | null; to: string | null };
  products: ProductRow[];
  cities: {
    metro: string | null; label: string; seats: number;
    benefitPaise: number; reimbursementPaise: number;
    playerCount: number; organiserCount: number;
  }[];
  organisers: {
    _id: string; name: string; phone: string | null; seats: number; gameCount: number;
    coveredPaise: number; reimbursablePaise: number; bornePaise: number;
  }[];
  totals: {
    seats: number; issued: number; paid: number; live: number;
    revenuePaise: number; benefitPaise: number; reimbursementPaise: number;
    organiserBornePaise: number; platformNetPaise: number; netPaise: number;
    marginPercent: number | null;
  };
  valueRatio: {
    counted: number; grantedExcluded: number; median: number | null; max: number | null;
    buckets: { key: string; label: string; count: number; share: number | null }[];
  };
  cannibalisation: {
    seats: number; onFullGames: number; onShortGames: number; unclassified: number;
    benefitOnFullPaise: number; benefitOnShortPaise: number;
    ratePercent: number | null; incrementalRatePercent: number | null; capped: boolean;
  };
  incrementality: {
    players: number; excluded: number;
    baselinePerWeek: number | null; windowPerWeek: number | null;
    upliftPerWeek: number | null; upliftPercent: number | null;
    playedMoreCount: number; playedMorePercent: number | null;
    baselineDays?: number; capped?: boolean;
  };
};

type EconomicsResponse = { success: boolean; data: Economics };
type ProductsResponse = { success: boolean; data: Product[] };

const WINDOWS = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last year", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;

/* Floored to IST midnight, and that is load-bearing: this string is part of the
 * fetch path, and `useAdminFetch` refetches whenever the path changes. A raw
 * `Date.now()` differs on every render, so each response re-rendered the page,
 * minted a new path and fetched again — the table reloaded forever. */
const IST_OFFSET_MS = 330 * 60000;
const DAY_MS = 86400000;
const sinceISO = (days: number) => {
  if (days <= 0) return null;
  const istMidnight = Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return new Date(istMidnight - days * DAY_MS).toISOString();
};

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
const signed = (paise: number) => `${paise < 0 ? "−" : ""}${rupees(Math.abs(paise))}`;

export function PassEconomics() {
  const [windowKey, setWindowKey] = useState<string>("90");
  const [product, setProduct] = useState("");

  const days = WINDOWS.find((w) => w.key === windowKey)?.days ?? 90;
  const params = new URLSearchParams();
  const from = sinceISO(days);
  if (from) params.set("from", from);
  if (product) params.set("product", product);

  const { data, error } = useAdminFetch<EconomicsResponse>(
    `/admin/pass-economics${params.toString() ? `?${params}` : ""}`,
    { errorMessage: "Could not load pass economics." },
  );
  const { data: productData } = useAdminFetch<ProductsResponse>("/admin/pass-products", { cache: true });

  const econ = data?.data ?? null;
  const products = productData?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={windowKey} onChange={(e) => setWindowKey(e.target.value)}>
          {WINDOWS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
        </select>
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="">Every product</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <span className="font-mono text-[11px] text-muted">
          Revenue counts passes SOLD in the window; cost counts seats COVERED in it.
        </span>
      </div>

      {error && <div className={`${ERROR_BOX} mb-4`}>{error}</div>}

      {!econ ? (
        <div className="rounded-[14px] border border-dashed border-border-2 p-10 text-center text-[13px] text-muted">
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* ── Who is out of pocket ──
              Five figures rather than one, because "net" is meaningless without
              saying whose. */}
          <div className={CARD}>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Money
            </div>
            <div className="grid grid-cols-5 gap-3 max-[900px]:grid-cols-2">
              <Tile label="Revenue" value={rupees(econ.totals.revenuePaise)}
                sub={`${econ.totals.paid} sold · ${econ.totals.issued} issued`} />
              <Tile label="Value given" value={rupees(econ.totals.benefitPaise)}
                sub={`over ${econ.totals.seats} seat${econ.totals.seats === 1 ? "" : "s"}`} />
              <Tile label="Reimbursable" value={rupees(econ.totals.reimbursementPaise)}
                sub="platform owes organisers" tone="accent" />
              <Tile label="Borne by organisers" value={rupees(econ.totals.organiserBornePaise)}
                sub="the silent transfer" tone={econ.totals.organiserBornePaise > 0 ? "warn" : undefined} />
              <Tile label="Platform net" value={signed(econ.totals.platformNetPaise)}
                sub={econ.totals.marginPercent == null ? "no sales" : `${econ.totals.marginPercent}% margin`}
                tone={econ.totals.platformNetPaise < 0 ? "danger" : "good"} />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              If the platform bore every covered seat instead, the whole programme would be at{" "}
              <span className="font-mono text-body">{signed(econ.totals.netPaise)}</span>. That is the
              ceiling on how bad this can get, and it is the figure that stays true however the funding
              models are set.
            </p>
          </div>

          {/* ── The metric that decides whether the programme is working ── */}
          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <div className={CARD}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                Cannibalisation
              </div>
              {econ.cannibalisation.ratePercent == null ? (
                <p className="text-[13px] text-muted">
                  No covered seat in this window could be classified yet.
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="font-mono text-[32px] font-bold text-fg leading-none">
                        {pct(econ.cannibalisation.ratePercent)}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                        on games that ended up full
                      </div>
                    </div>
                    <div className="pb-1">
                      <div className="font-mono text-[18px] font-bold text-[#4ade80] leading-none">
                        {pct(econ.cannibalisation.incrementalRatePercent)}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                        on games that never filled
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-[#fbbf24]"
                      style={{ width: `${econ.cannibalisation.ratePercent}%` }} />
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted">
                    {rupees(econ.cannibalisation.benefitOnFullPaise)} given on full games ·{" "}
                    {rupees(econ.cannibalisation.benefitOnShortPaise)} on short ones
                    {econ.cannibalisation.unclassified > 0 &&
                      ` · ${econ.cannibalisation.unclassified} unclassified`}
                  </div>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                    A <strong className="text-body">proxy, not a verdict.</strong> We cannot see whether a
                    covered seat would have sold at full price — only whether the game reached capacity,
                    which it did <em>with</em> that seat in it. Read the right-hand figure as the safer
                    one: those seats are games an organiser would otherwise have played short.
                    {econ.cannibalisation.capped && " Capped at the 5,000 most recent seats."}
                  </p>
                </>
              )}
            </div>

            <div className={CARD}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                Incremental play
              </div>
              {!econ.incrementality.players ? (
                <p className="text-[13px] text-muted">
                  No holder in this window has both a baseline and a live pass window yet.
                </p>
              ) : (
                <>
                  <div className="flex items-end gap-6">
                    <div>
                      <div className="font-mono text-[32px] font-bold text-fg leading-none">
                        {econ.incrementality.upliftPerWeek! > 0 ? "+" : ""}
                        {econ.incrementality.upliftPerWeek}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                        games/week per holder
                      </div>
                    </div>
                    <div className="pb-1 font-mono text-[12px] text-muted">
                      <div>{econ.incrementality.baselinePerWeek} before</div>
                      <div className="text-body">{econ.incrementality.windowPerWeek} during</div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[11px] text-muted">
                    {econ.incrementality.playedMoreCount} of {econ.incrementality.players} holders played
                    more ({pct(econ.incrementality.playedMorePercent)})
                    {econ.incrementality.upliftPercent != null &&
                      ` · ${econ.incrementality.upliftPercent > 0 ? "+" : ""}${econ.incrementality.upliftPercent}%`}
                  </div>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                    Each holder&apos;s rate while their pass was live, against their own{" "}
                    {econ.incrementality.baselineDays ?? 90}-day baseline before it started. Holders with
                    no baseline — they joined when they bought — are excluded rather than scored as
                    infinite uplift
                    {econ.incrementality.excluded > 0 && `: ${econ.incrementality.excluded} here`}.
                    {econ.incrementality.capped && " Sampled at the 500 most recent passes."}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Value-to-price ──
              Buckets rather than a mean: the mean of {0.1, 0.1, 9} is 3.1 and
              describes nobody. The shape is the finding. */}
          <div className={CARD}>
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                What holders extract per rupee paid
              </span>
              {econ.valueRatio.counted > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  median {econ.valueRatio.median}× · max {econ.valueRatio.max}× ·{" "}
                  {econ.valueRatio.counted} paid pass{econ.valueRatio.counted === 1 ? "" : "es"}
                </span>
              )}
            </div>
            {econ.valueRatio.counted === 0 ? (
              <p className="text-[13px] text-muted">
                No pass has been paid for in this window — a granted pass has no price to be a multiple of.
              </p>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  {econ.valueRatio.buckets.map((b) => (
                    <div key={b.key} className="flex-1 text-center">
                      <div className="mb-1 font-mono text-[11px] text-body">{b.count}</div>
                      <div className="mx-auto w-full rounded-t bg-accent/70"
                        style={{ height: `${Math.max(3, (b.share || 0) * 0.9)}px`, minHeight: 3 }} />
                      <div className="mt-2 text-[10px] text-muted">{b.label}</div>
                      <div className="font-mono text-[10px] text-muted">{pct(b.share)}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
                  The low end predicts churn — a holder who never used it will not renew. The high end is
                  the pricing problem: a pass whose median holder takes several times its price is a
                  subsidy with a receipt.
                  {econ.valueRatio.grantedExcluded > 0 &&
                    ` ${econ.valueRatio.grantedExcluded} granted pass${econ.valueRatio.grantedExcluded === 1 ? " is" : "es are"} excluded — a free pass has no ratio.`}
                </p>
              </>
            )}
          </div>

          {/* ── Per product ── */}
          <div className={CARD}>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              By product
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
                    <th className="py-2">Product</th>
                    <th>Funded by</th>
                    <th>Sold</th>
                    <th>Seats</th>
                    <th>Revenue</th>
                    <th>Value given</th>
                    <th>Reimbursable</th>
                    <th>Organiser bears</th>
                    <th>Platform net</th>
                  </tr>
                </thead>
                <tbody>
                  {econ.products.map((r) => (
                    <tr key={r._id} className="border-b border-border text-body">
                      <td className="py-2 text-fg">
                        {r.name}
                        {r.deprecated && <span className="ml-2 text-[10px] text-muted">legacy</span>}
                      </td>
                      <td className="font-mono text-muted">
                        {r.funding.model}
                        {r.funding.model === "shared" ? ` ${r.funding.organiserSharePercent}%` : ""}
                        {r.funding.overridesConsent && (
                          <span className="ml-1 text-[#fbbf24]" title="Seats holders even on games that opted out">⚠</span>
                        )}
                      </td>
                      <td className="font-mono">{r.paid}</td>
                      <td className="font-mono">{r.seats}</td>
                      <td className="font-mono">{rupees(r.revenuePaise)}</td>
                      <td className="font-mono">{rupees(r.benefitPaise)}</td>
                      <td className="font-mono text-accent">{rupees(r.reimbursementPaise)}</td>
                      <td className={`font-mono ${r.organiserBornePaise > 0 ? "text-[#fbbf24]" : "text-muted"}`}>
                        {rupees(r.organiserBornePaise)}
                      </td>
                      <td className={`font-mono ${r.platformNetPaise < 0 ? "text-danger" : "text-[#4ade80]"}`}>
                        {signed(r.platformNetPaise)}
                      </td>
                    </tr>
                  ))}
                  {econ.products.length === 0 && (
                    <tr><td colSpan={9} className="py-6 text-center text-muted">Nothing in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Per city and per organiser ── */}
          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <div className={CARD}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                By city
              </div>
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
                    <th className="py-2">City</th>
                    <th>Seats</th>
                    <th>Players</th>
                    <th>Value given</th>
                    <th>Reimbursable</th>
                  </tr>
                </thead>
                <tbody>
                  {econ.cities.map((c) => (
                    <tr key={c.metro || "unknown"} className="border-b border-border text-body">
                      <td className="py-2 text-fg">{c.label}</td>
                      <td className="font-mono">{c.seats}</td>
                      <td className="font-mono">{c.playerCount}</td>
                      <td className="font-mono">{rupees(c.benefitPaise)}</td>
                      <td className="font-mono text-accent">{rupees(c.reimbursementPaise)}</td>
                    </tr>
                  ))}
                  {econ.cities.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted">Nothing in this window.</td></tr>
                  )}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                No revenue column: a pass is bought once and spent wherever its rule reaches, so splitting
                its price across cities would be an invented number — and an invented number in a P&amp;L
                is worse than a missing one.
              </p>
            </div>

            <div className={CARD}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                Reimbursement owed, by organiser
              </div>
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
                    <th className="py-2">Organiser</th>
                    <th>Seats</th>
                    <th>Not collected</th>
                    <th>We owe</th>
                    <th>They bear</th>
                  </tr>
                </thead>
                <tbody>
                  {econ.organisers.map((o) => (
                    <tr key={o._id} className="border-b border-border text-body">
                      <td className="py-2 text-fg">{o.name}</td>
                      <td className="font-mono">{o.seats}</td>
                      <td className="font-mono">{rupees(o.coveredPaise)}</td>
                      <td className="font-mono text-accent">{rupees(o.reimbursablePaise)}</td>
                      <td className={`font-mono ${o.bornePaise > 0 ? "text-[#fbbf24]" : "text-muted"}`}>
                        {rupees(o.bornePaise)}
                      </td>
                    </tr>
                  ))}
                  {econ.organisers.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted">Nothing in this window.</td></tr>
                  )}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Recorded, not settled. Reimbursement moves off-platform until an organiser balance exists;
                this is the invoice line, and the same figures appear in each organiser&apos;s own
                Financials.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone?: "accent" | "good" | "warn" | "danger";
}) {
  const colour = tone === "accent" ? "text-accent"
    : tone === "good" ? "text-[#4ade80]"
    : tone === "warn" ? "text-[#fbbf24]"
    : tone === "danger" ? "text-danger"
    : "text-fg";
  return (
    <div>
      <div className={`font-mono text-[20px] font-bold ${colour}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted">{label}</div>
      {sub && <div className="mt-[2px] font-mono text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
