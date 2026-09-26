"use client";

/* Bulk grants (§14.3) — one product, one segment, one reason, one undo.
 *
 * "A mis-targeted bulk grant is the most expensive mistake this screen can
 * make", and everything here is shaped by that sentence:
 *
 *  • Nothing is issued until a COUNT has come back and been looked at. The
 *    server dry-runs by default — a request without `confirm: true` issues
 *    nothing — so the number an admin approves is produced by the same predicate
 *    that then does the granting.
 *  • An empty segment is REFUSED. Targeting everybody is spelled out with its
 *    own switch, exactly as `rules: [{}]` spells out an unconditional pass,
 *    because reading a half-filled form as "everyone" is how an accident becomes
 *    a platform-wide giveaway.
 *  • Every batch stays undoable for 24 hours, and the list below is where that
 *    lives. Long enough for the mistake to be noticed, short enough that a
 *    player who has started using their pass keeps it.
 *
 * No rule is evaluated here. The segment is sent and the server answers, the
 * same discipline the rule builder follows. */

import { useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import {
  adminFetch, Product, rupees, shortDateTime,
  BTN, BTN_PRIMARY, BTN_DANGER, CARD, ERROR_BOX, WARN_BOX, FIELD, FIELD_LABEL,
} from "./shared";

type Segment = {
  everyone: boolean;
  metros: string[];
  minGamesPlayed: number;
  maxGamesPlayed: number;
  lastPlayedBefore: string | null;
  neverPlayed: boolean;
  minSpendPaise: number;
  holdsNoPass: boolean;
};

type Target = {
  _id: string; name: string; phone: string;
  gamesPlayed: number; metro: string | null; lastPlayedAt: string | null;
  spentPaise: number; holdsPass: boolean;
};

type Preview = {
  dryRun: boolean;
  description: string;
  warnings?: string[];
  candidates: number;
  matched: number;
  skippedHolding: number;
  targetCount: number;
  targets: Target[];
  product?: { _id: string; name: string };
  described?: { summary: string; expiresText: string };
  batch?: string;
  issued?: number;
  failures?: { player: string; name: string; errors: string[] }[];
};

type Batch = {
  batch: string; name: string; reason: string | null;
  issued: number; revoked: number; live: number; used: number;
  benefitPaise: number; grantedAt: string;
  undoableUntil: string; undoable: boolean;
};

type ProductsResponse = { success: boolean; data: Product[] };
type BatchesResponse = { success: boolean; data: Batch[] };

/* Cities come from the same registry the rule builder reads — utils/metro.js,
 * served by GET /turfs/city-options. Typed slugs are how a grant silently
 * targets nobody: a mistyped one saves fine, the count comes back zero, and an
 * empty segment looks exactly like a city with no players. */
type CityOptions = {
  success: boolean;
  data: { metros: { slug: string; label: string }[] };
};

const emptySegment = (): Segment => ({
  everyone: false,
  metros: [],
  minGamesPlayed: 0,
  maxGamesPlayed: 0,
  lastPlayedBefore: null,
  neverPlayed: false,
  minSpendPaise: 0,
  holdsNoPass: true,
});

const numOr0 = (v: string) => Math.max(0, Math.trunc(Number(v) || 0));

export function BulkGrant() {
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("");
  const [segment, setSegment] = useState<Segment>(emptySegment);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: productData } = useAdminFetch<ProductsResponse>("/admin/pass-products", { cache: true });
  const { data: cityData } = useAdminFetch<CityOptions>("/turfs/city-options", { cache: true });
  const { data: batchData, refresh: refreshBatches } =
    useAdminFetch<BatchesResponse>("/admin/player-passes/bulk", { errorMessage: "Could not load past grants." });

  const products = (productData?.data ?? []).filter((p) => p.grantable && p.status === "active");
  const cityOptions = cityData?.data?.metros ?? [];
  const batches = batchData?.data ?? [];
  const patch = (p: Partial<Segment>) => { setSegment((s) => ({ ...s, ...p })); setPreview(null); };

  const toggleCity = (slug: string) =>
    patch({ metros: segment.metros.includes(slug)
      ? segment.metros.filter((m) => m !== slug)
      : [...segment.metros, slug] });

  const body = (confirm: boolean) => JSON.stringify({
    productId,
    reason,
    confirm,
    segment: {
      ...segment,
      // Sent as absent rather than "" so the server's date parsing never sees an
      // empty string and quietly reads it as the epoch.
      lastPlayedBefore: segment.lastPlayedBefore || undefined,
    },
  });

  const run = async (confirm: boolean) => {
    setBusy(true);
    setErr("");
    setMsg("");
    const res = await adminFetch<Preview>("/admin/player-passes/bulk", { method: "POST", body: body(confirm) });
    setBusy(false);
    if (!res.ok) {
      setErr([res.message, ...(res.details || [])].filter(Boolean).join(" "));
      if (!confirm) setPreview(null);
      return;
    }
    setPreview(res.data || null);
    if (confirm) {
      setMsg(`${res.data?.issued ?? 0} pass${res.data?.issued === 1 ? "" : "es"} granted.`);
      refreshBatches();
    }
  };

  const undo = async (b: Batch) => {
    const why = window.prompt(
      `Withdraw all ${b.live} live pass${b.live === 1 ? "" : "es"} from this grant? Say why.`,
      "Mis-targeted bulk grant",
    );
    if (!why) return;
    const res = await adminFetch(`/admin/player-passes/bulk/${b.batch}/undo`, {
      method: "POST",
      body: JSON.stringify({ reason: why }),
    });
    if (!res.ok) { setErr(res.message || "Could not undo that grant."); return; }
    setErr("");
    setMsg("Grant withdrawn. Games already played on those passes stand.");
    refreshBatches();
  };

  const canPreview = !!productId && !!reason.trim();

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD}>
        <h3 className="mb-1 text-[15px] font-bold text-fg">Grant a pass to a segment</h3>
        <p className="mb-4 text-[12px] leading-relaxed text-muted">
          Nothing is issued until you have seen the count. Every pass in a run shares one reason and one
          batch, and the batch can be withdrawn for 24 hours.
        </p>

        <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
          <div>
            <label className={FIELD_LABEL}>Pass</label>
            <select className={FIELD} value={productId}
              onChange={(e) => { setProductId(e.target.value); setPreview(null); }}>
              <option value="">Choose a pass…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Reason (required, stored on every pass)</label>
            <input className={FIELD} value={reason}
              onChange={(e) => { setReason(e.target.value); setPreview(null); }}
              placeholder="Win-back push for lapsed Delhi players, Oct" />
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Who</div>

          <div className="mb-4">
            <label className={FIELD_LABEL}>Where they play</label>
            <div className="flex flex-wrap gap-2">
              {cityOptions.length === 0 && (
                <span className="font-mono text-[11px] text-muted">Loading cities…</span>
              )}
              {cityOptions.map((c) => (
                <button key={c.slug} type="button"
                  onClick={() => toggleCity(c.slug)}
                  className={`${BTN} ${segment.metros.includes(c.slug) ? BTN_PRIMARY : ""}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Read from the venues they actually play at, not the free-text city on their profile. A
              player whose city we cannot tell is never swept into a city-scoped grant.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>Games played, min</label>
              <input className={FIELD} value={segment.minGamesPlayed || ""}
                onChange={(e) => patch({ minGamesPlayed: numOr0(e.target.value) })} placeholder="any" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Games played, max</label>
              <input className={FIELD} value={segment.maxGamesPlayed || ""}
                onChange={(e) => patch({ maxGamesPlayed: numOr0(e.target.value) })} placeholder="any" />
            </div>
            <div>
              <label className={FIELD_LABEL}>Last played before</label>
              <input className={FIELD} type="date" value={segment.lastPlayedBefore || ""}
                onChange={(e) => patch({ lastPlayedBefore: e.target.value || null })} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Spent at least (₹)</label>
              <input className={FIELD} value={segment.minSpendPaise ? segment.minSpendPaise / 100 : ""}
                onChange={(e) => patch({ minSpendPaise: numOr0(e.target.value) * 100 })} placeholder="any" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-body">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={segment.holdsNoPass}
                onChange={(e) => patch({ holdsNoPass: e.target.checked })} />
              Only players holding no live pass
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={segment.neverPlayed}
                onChange={(e) => patch({ neverPlayed: e.target.checked, minGamesPlayed: 0, lastPlayedBefore: null })} />
              Only players who have never played
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={segment.everyone}
                onChange={(e) => patch({ everyone: e.target.checked })} />
              <span className={segment.everyone ? "text-[#fbbf24]" : ""}>Every player on the platform</span>
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            A segment with no filters is refused. If you really mean everybody, tick the last box — the
            same way an unconditional pass has to say so rather than be inferred from a blank rule.
          </p>
        </div>

        {err && <div className={`${ERROR_BOX} mt-4`}>{err}</div>}
        {msg && <div className="mt-4 text-[12px] text-[#4ade80]">{msg}</div>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={BTN} disabled={!canPreview || busy} onClick={() => run(false)}>
            {busy ? "Counting…" : "Count who this hits"}
          </button>
          {preview?.dryRun && (
            <button type="button" className={`${BTN} ${BTN_PRIMARY}`}
              disabled={busy || preview.targetCount === 0}
              onClick={() => run(true)}>
              Grant to {preview.targetCount} player{preview.targetCount === 1 ? "" : "s"}
            </button>
          )}
          {!canPreview && (
            <span className="font-mono text-[11px] text-muted">Pick a pass and give a reason first.</span>
          )}
        </div>
      </div>

      {preview && (
        <div className={CARD}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[14px] font-semibold text-fg">{preview.description}</span>
            <span className="font-mono text-[12px] text-muted">
              {preview.candidates} considered · {preview.matched} matched
              {preview.skippedHolding > 0 && ` · ${preview.skippedHolding} already hold it`}
            </span>
          </div>
          {preview.described && (
            <div className="mb-3 text-[12px] text-body">
              {preview.described.summary} {preview.described.expiresText}
            </div>
          )}
          {(preview.warnings || []).map((w) => (
            <div key={w} className={`${WARN_BOX} mb-2`}>{w}</div>
          ))}

          {preview.targetCount === 0 ? (
            <div className={ERROR_BOX}>
              That segment matches nobody right now. Widen it, or check whether they already hold this pass.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-[0.08em] text-muted">
                      <th className="py-2">Player</th>
                      <th>Phone</th>
                      <th>Games</th>
                      <th>City</th>
                      <th>Last played</th>
                      <th>Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.targets.map((t) => (
                      <tr key={t._id} className="border-b border-border text-body">
                        <td className="py-2 text-fg">{t.name}</td>
                        <td className="font-mono text-muted">{t.phone}</td>
                        <td className="font-mono">{t.gamesPlayed}</td>
                        <td className="font-mono text-muted">{t.metro || "—"}</td>
                        <td className="font-mono text-muted">
                          {t.lastPlayedAt ? shortDateTime(t.lastPlayedAt) : "never"}
                        </td>
                        <td className="font-mono">{rupees(t.spentPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.targetCount > preview.targets.length && (
                <p className="mt-2 font-mono text-[11px] text-muted">
                  Showing the first {preview.targets.length} of {preview.targetCount}.
                </p>
              )}
            </>
          )}

          {preview.failures && preview.failures.length > 0 && (
            <div className={`${ERROR_BOX} mt-4`}>
              {preview.failures.length} pass{preview.failures.length === 1 ? "" : "es"} could not be issued:{" "}
              {preview.failures.slice(0, 5).map((f) => f.name).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* ── Past grants, and the undo ── */}
      <div className={CARD}>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Past bulk grants
        </div>
        {batches.length === 0 ? (
          <p className="text-[13px] text-muted">No bulk grant has been run yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {batches.map((b) => (
              <div key={b.batch} className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                <div className="min-w-[200px] flex-1">
                  <div className="text-[13.5px] font-semibold text-fg">{b.name}</div>
                  <div className="mt-[2px] text-[12px] text-body">{b.reason || "No reason recorded"}</div>
                  <div className="mt-[2px] font-mono text-[11px] text-muted">
                    {shortDateTime(b.grantedAt)} · {b.batch}
                  </div>
                </div>
                <div className="text-right font-mono text-[11.5px] text-muted">
                  <div>{b.issued} issued · {b.live} live</div>
                  <div>{b.used} used · {rupees(b.benefitPaise)} given</div>
                  <div>
                    {b.undoable
                      ? `undoable until ${shortDateTime(b.undoableUntil)}`
                      : b.live === 0 ? "fully withdrawn" : "past the 24-hour window"}
                  </div>
                </div>
                {b.undoable && (
                  <button type="button" className={`${BTN} ${BTN_DANGER}`} onClick={() => undo(b)}>
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Undoing revokes every live pass in the batch. Passes already spent are revoked too, but a
          revocation only stops FUTURE redemptions — a game somebody has already turned up for is never
          clawed back.
        </p>
      </div>
    </div>
  );
}
