"use client";

/* The scope, run over real games — the feature that makes targeting safe.
 *
 * An admin cannot reason about "Delhi NCR, these four venues, not this
 * organiser" in the abstract. They can reason about eleven named games, how
 * many of them the offer would make free, and the most it could ever cost. So
 * the unsaved draft is posted to the same engine the booking uses and run over
 * the games actually on the calendar (PRD §4 step 4: "explicitly show the number
 * of upcoming games matched"). */

import { useCallback, useEffect, useState } from "react";
import { adminFetch, rupees, shortDateTime, BTN, CARD, FIELD, Campaign, ScopePreview as Preview, payloadOf } from "./shared";

export function ScopePreview({ draft }: { draft: Campaign }) {
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const [showGames, setShowGames] = useState(false);

  const run = useCallback(async () => {
    const res = await adminFetch<Preview>("/admin/discounts/scope-preview", {
      method: "POST",
      body: JSON.stringify({ ...payloadOf(draft), days }),
    });
    if (!res.ok) { setErr(res.message || "Preview failed."); setPreview(null); return; }
    setErr("");
    setPreview(res.data || null);
  }, [draft, days]);

  useEffect(() => {
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Against real games</span>
        <select className={`${FIELD} w-[130px]`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Next 7 days</option>
          <option value={30}>Next 30 days</option>
          <option value={60}>Next 60 days</option>
          <option value={90}>Next 90 days</option>
        </select>
      </div>

      {err && <div className="text-[12px] text-danger">{err}</div>}
      {!preview && !err && <div className="text-[12px] text-muted">Checking…</div>}

      {preview && (
        <>
          <div className="text-[15px] leading-[1.5] text-fg">
            Applies to <b className="text-accent">{preview.gamesMatched}</b> of the {preview.gamesConsidered} games
            scheduled in the next {preview.windowDays} days.
          </div>
          <div className="mt-1 font-mono text-[12px] leading-[1.7] text-muted">
            {Object.entries(preview.byMetro).map(([metro, n]) => (
              <span key={metro} className="mr-3">{metro} {n}</span>
            ))}
          </div>

          {preview.gamesMadeFree > 0 && (
            <div className="mt-2 rounded-md border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.06)] px-[12px] py-[8px] text-[12px] text-[#fbbf24]">
              {preview.gamesMadeFree} of these game{preview.gamesMadeFree === 1 ? " is" : "s are"} priced at or below the
              saving, so the offer makes {preview.gamesMadeFree === 1 ? "it" : "them"} free.
            </div>
          )}

          {/* The number that turns an abstract offer into a decision (§4 step 7). */}
          <div className="mt-2 rounded-md border border-border-2 bg-surface-2 px-[12px] py-[8px] text-[12.5px] text-body">
            {preview.maxCostPaise != null
              ? <>The limits you set cap what this can cost at <b className="text-fg">{rupees(preview.maxCostPaise)}</b>.</>
              : <span className="text-[#fbbf24]">No budget, total-use or per-game cap — nothing bounds what this can cost.</span>}
          </div>

          {preview.games.length > 0 && (
            <button type="button" className={`${BTN} mt-3`} onClick={() => setShowGames((v) => !v)}>
              {showGames ? "Hide the games" : `See ${preview.games.length === preview.gamesMatched ? "the" : "the first"} ${preview.games.length} games`}
            </button>
          )}
          {showGames && (
            <div className="mt-3 flex max-h-[300px] flex-col gap-[6px] overflow-y-auto">
              {preview.games.map((g) => (
                <div key={g._id} className="flex items-center justify-between gap-3 border-b border-border py-[6px] text-[12px]">
                  <span className="min-w-0 truncate text-body">
                    {g.title || "Game"} · {shortDateTime(g.scheduledAt)}{g.turfName ? ` · ${g.turfName}` : ""}
                  </span>
                  <span className="shrink-0 font-mono text-muted">
                    {rupees(g.feePaise)} → <b className="text-accent">{rupees(g.payablePaise)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
