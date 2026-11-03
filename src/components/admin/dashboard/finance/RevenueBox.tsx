"use client";

import { useState } from "react";
import { STAT_CARD, STAT_LABEL, STAT_VALUE, STAT_DELTA, UP, DOWN, NEUTRAL, FILTER_SELECT } from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { REVENUE_PERIODS, formatRupees, rangeText, type RevenuePeriod, type RevenueSummary } from "./revenue";

/* The Finance page's revenue figure: one box, a dropdown of periods, and each
   option fetched on its own. Always the whole platform — the Revenue tab's
   filters do not reach it. While the next period loads, the last one stays on
   screen, faded, rather than blanking the box. */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ChangeLine({ s }: { s: RevenueSummary }) {
  const c = s.comparison;
  if (!c) return null;
  if (c.reason === "not_enough_data") {
    return (
      <div className={`${STAT_DELTA} ${NEUTRAL}`}>
        Not enough data to compare with {c.label} (under {s.minCompareGames} games)
      </div>
    );
  }
  if (c.reason === "nothing_before" || c.pct == null) {
    return <div className={`${STAT_DELTA} ${NEUTRAL}`}>Nothing received in {c.label}</div>;
  }
  const tone = c.pct > 0 ? UP : c.pct < 0 ? DOWN : NEUTRAL;
  const arrow = c.pct > 0 ? "▲" : c.pct < 0 ? "▼" : "•";
  return (
    <div className={`${STAT_DELTA} ${tone}`} title={`${rangeText(c.from, c.to)}: ${formatRupees(c.receivedPaise)} from ${plural(c.completedGames, "game")}`}>
      {arrow} {Math.abs(c.pct)}% vs {c.label}{" "}
      <span className={NEUTRAL}>({formatRupees(c.receivedPaise)})</span>
    </div>
  );
}

export function RevenueBox({ className = "" }: { className?: string }) {
  const [period, setPeriod] = useState<RevenuePeriod>("this_month");
  const { data, loading, error } = useAdminFetch<{ data?: RevenueSummary }>(
    `/admin/revenue/summary?period=${period}`,
    { cache: true, errorMessage: "Failed to load revenue." },
  );
  const s = data?.data ?? null;

  return (
    <div className={`${STAT_CARD} flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={STAT_LABEL}>Revenue received</div>
          <div className="font-mono text-[11.5px] text-muted-2">
            {loading ? "Loading…" : s ? rangeText(s.from, s.to) : " "}
          </div>
        </div>
        <select
          className={FILTER_SELECT}
          value={period}
          onChange={(e) => setPeriod(e.target.value as RevenuePeriod)}
          aria-label="Revenue period"
        >
          {REVENUE_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {error ? <div className="mt-3 text-[13px] text-danger">{error}</div> : null}

      <div className={`mt-4 flex flex-1 flex-col transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
        <div className={STAT_VALUE}>{s ? formatRupees(s.receivedPaise) : "—"}</div>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px] text-body">
          <span><b className="font-medium text-fg">{s ? s.completedGames : "—"}</b> games played</span>
          <span><b className="font-medium text-fg">{s ? formatRupees(s.avgPerGamePaise) : "—"}</b> avg per game</span>
        </div>
        {s ? (
          <div className="flex flex-col gap-1">
            <ChangeLine s={s} />
            {s.pendingGames > 0 ? (
              <div className={`${STAT_DELTA} ${NEUTRAL}`}>
                +{formatRupees(s.pendingPaise)} on {plural(s.pendingGames, "game")} not yet completed
              </div>
            ) : null}
            {s.feePaise > 0 || s.cancelledGames > 0 ? (
              <div className={`${STAT_DELTA} ${NEUTRAL}`}>
                {[
                  s.feePaise > 0 ? `incl. ${formatRupees(s.feePaise)} cancellation fees` : null,
                  s.cancelledGames > 0 ? `${plural(s.cancelledGames, "game")} cancelled` : null,
                ].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
