"use client";

/* The preview panel — the feature that makes rule-building safe.
 *
 * An admin cannot reason about
 *   { metros: ['delhi-ncr'], dayType: ['weekend'], feePaise: { max: 55000 } }
 * in the abstract. They can reason about fourteen named games and a rupee
 * figure. So the unsaved draft is posted to the same engine that will decide
 * coverage at the till, run over the games actually on the calendar, and what
 * comes back is the worst case in money.
 *
 * It needs no new data — it is `evaluateRule` over the existing games query. */

import { useCallback, useEffect, useState } from "react";
import {
  adminFetch, Preview, Rule, Benefit, rupees, shortDateTime, BTN, CARD, FIELD,
} from "./shared";

export function RulePreview({ rules, benefit }: { rules: Rule[]; benefit: Benefit }) {
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showGames, setShowGames] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setErr("");
    const res = await adminFetch<Preview>("/admin/pass-products/preview", {
      method: "POST",
      body: JSON.stringify({ rules, benefit, days }),
    });
    if (!res.ok) { setErr(res.message || "Preview failed."); setPreview(null); }
    else setPreview(res.data || null);
    setLoading(false);
  }, [rules, benefit, days]);

  // Re-run whenever the draft changes, debounced — the panel is only useful if
  // it keeps up with the rule being typed.
  useEffect(() => {
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Against real games
        </span>
        <select
          className={`${FIELD} w-[130px]`}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Next 7 days</option>
          <option value={30}>Next 30 days</option>
          <option value={60}>Next 60 days</option>
          <option value={90}>Next 90 days</option>
        </select>
      </div>

      {err && <div className="text-[12px] text-danger">{err}</div>}
      {loading && !preview && <div className="text-[12px] text-muted">Checking…</div>}

      {preview && (
        <>
          <div className="text-[15px] leading-[1.5] text-fg">
            This rule matches <b className="text-accent">{preview.gamesMatched}</b> of the{" "}
            {preview.gamesConsidered} games scheduled in the next {preview.windowDays} days.
          </div>

          <div className="mt-2 font-mono text-[12px] leading-[1.7] text-muted">
            {Object.entries(preview.byMetro).map(([metro, n]) => (
              <span key={metro} className="mr-3">{metro} {n}</span>
            ))}
            {preview.feeRangePaise.min != null && (
              <div>
                Fee {rupees(preview.feeRangePaise.min)}–{rupees(preview.feeRangePaise.max)} ·
                {" "}Total seat value {rupees(preview.totalSeatValuePaise)}
              </div>
            )}
          </div>

          {/* The number that turns an abstract rule into a decision. */}
          <div className="mt-3 rounded-md border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.06)] px-[12px] py-[9px] text-[12.5px] text-[#fbbf24]">
            One holder playing every matched game costs{" "}
            <b>{rupees(preview.worstCaseBenefitPaise)}</b> at this benefit, before any cap.
          </div>

          {preview.games.length > 0 && (
            <button type="button" className={`${BTN} mt-3`} onClick={() => setShowGames((v) => !v)}>
              {showGames ? "Hide the games" : `See the ${preview.gamesMatched} games`}
            </button>
          )}

          {showGames && (
            <div className="mt-3 flex max-h-[320px] flex-col gap-[6px] overflow-y-auto">
              {preview.games.map((g) => (
                <div
                  key={g._id}
                  className="flex items-center justify-between gap-3 border-b border-border py-[6px] text-[12px]"
                >
                  <span className="min-w-0 truncate text-body">
                    {g.title || "Game"} · {shortDateTime(g.scheduledAt)}
                    {g.turfName ? ` · ${g.turfName}` : ""}
                  </span>
                  <span className="shrink-0 font-mono text-muted">
                    {rupees(g.feePaise)} → <b className="text-accent">−{rupees(g.benefitPaise)}</b>
                  </span>
                </div>
              ))}
              {preview.gamesMatched > preview.games.length && (
                <div className="py-1 text-[11px] text-muted">
                  …and {preview.gamesMatched - preview.games.length} more.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
