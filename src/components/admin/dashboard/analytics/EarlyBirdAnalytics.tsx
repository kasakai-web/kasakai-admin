"use client";

/* Analytics → Early-bird pricing. Laddered games against flat ones, over the
   same play-date window — the PRD's metric table made visible.

   The verdicts come from the backend engine (utils/earlyBirdInsights.js); this
   file renders, it never judges. Verdict first, then the numbers behind it:
   both groups side by side, the lead-time distribution, and the same comparison
   per organiser and per city. Every block exports to Excel. */

import { useState } from "react";
import {
  TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, TOPBAR_BTN, TOPBAR_BTN_PRIMARY, TOOLBAR, FILTER_SELECT,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { formatCurrency } from "../shared/format";
import { Empty, SERIES } from "./charts";
import { Verdict, Block, ExportButton } from "./verdicts";
import { downloadSheets, type Sheet } from "./exportExcel";
import { PAST_PRESETS, presetRange, rangeQuery, type Preset } from "./range";
import type { ApiResponse, Conclusions } from "./types";

type Bucket = { key: string; label: string; seats: number; pct: number | null };
type GroupStats = {
  games: number; played: number; seats: number;
  medianLeadHours: number | null; earlySharePct: number | null;
  check1MetPct: number | null; check1Games: number;
  shortCancelPct: number | null; shortCancelled: number;
  revenuePerGamePaise: number | null;
  earlySeatsSold: number; earlyBackoutPct: number | null; earlySavingPaise: number;
  buckets: Bucket[];
};
type Side = { games: number; medianLeadHours: number | null; earlySharePct: number | null; shortCancelPct: number | null; revenuePerGamePaise: number | null };
type Row = { key: string; label: string; ladder: Side; flat: Side; comparable: boolean };
type EarlyBirdData = {
  window: { from: string; to: string };
  capped: boolean;
  thresholds: { MIN_GAMES: number; EARLY_HOURS: number };
  conclusions: Conclusions<string>;
  ladder: GroupStats;
  flat: GroupStats;
  byOrganiser: Row[];
  byCity: Row[];
};

const hrs = (h: number | null) => (h == null ? "—" : h >= 48 ? `${Math.round((h / 24) * 10) / 10} d` : `${Math.round(h * 10) / 10} h`);
const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
const money = (p: number | null) => (p == null ? "—" : formatCurrency(p));

const METRICS: { label: string; get: (g: GroupStats) => string }[] = [
  { label: "Games (played or cancelled)", get: (g) => String(g.games) },
  { label: "Median booking lead time", get: (g) => hrs(g.medianLeadHours) },
  { label: "Seats sold 48+ h out", get: (g) => pct(g.earlySharePct) },
  { label: "At minimum by check-in 1", get: (g) => (g.check1Games ? pct(g.check1MetPct) : "—") },
  { label: "Cancelled short of minimum", get: (g) => `${pct(g.shortCancelPct)} (${g.shortCancelled})` },
  { label: "Revenue per played game", get: (g) => money(g.revenuePerGamePaise) },
];

function sheetsFor(d: EarlyBirdData): Sheet[] {
  const view = `Play dates ${d.window.from} to ${d.window.to}`;
  const side = (prefix: string, s: Side) => ({
    [`${prefix}Games`]: s.games, [`${prefix}Lead`]: s.medianLeadHours, [`${prefix}Early`]: s.earlySharePct,
    [`${prefix}Cancel`]: s.shortCancelPct, [`${prefix}Revenue`]: s.revenuePerGamePaise == null ? null : s.revenuePerGamePaise / 100,
  });
  const breakdownCols = [
    { header: "Name", key: "label", width: 28 },
    { header: "Laddered games", key: "lGames" }, { header: "Flat games", key: "fGames" },
    { header: "Lead h (ladder)", key: "lLead" }, { header: "Lead h (flat)", key: "fLead" },
    { header: "48h+ % (ladder)", key: "lEarly" }, { header: "48h+ % (flat)", key: "fEarly" },
    { header: "Short cancel % (ladder)", key: "lCancel" }, { header: "Short cancel % (flat)", key: "fCancel" },
    { header: "₹ / game (ladder)", key: "lRevenue" }, { header: "₹ / game (flat)", key: "fRevenue" },
    { header: "Comparable", key: "comparable" },
  ];
  const rows = (list: Row[]) => list.map((r) => ({ label: r.label, ...side("l", r.ladder), ...side("f", r.flat), comparable: r.comparable ? "yes" : "too few games" }));
  return [
    {
      name: "Laddered vs flat", notes: ["Early-bird pricing — laddered vs flat games", view],
      columns: [{ header: "Metric", key: "metric", width: 32 }, { header: "Laddered", key: "ladder", width: 16 }, { header: "Flat", key: "flat", width: 16 }],
      rows: METRICS.map((m) => ({ metric: m.label, ladder: m.get(d.ladder), flat: m.get(d.flat) })),
    },
    {
      name: "Lead time", notes: ["Seats by hours booked before kick-off (played games)", view],
      columns: [{ header: "Booked", key: "label", width: 16 }, { header: "Laddered seats", key: "l" }, { header: "Laddered %", key: "lp" }, { header: "Flat seats", key: "f" }, { header: "Flat %", key: "fp" }],
      rows: d.ladder.buckets.map((b, i) => ({ label: b.label, l: b.seats, lp: b.pct, f: d.flat.buckets[i]?.seats, fp: d.flat.buckets[i]?.pct })),
    },
    { name: "By organiser", notes: ["Organisers running at least one laddered game", view], columns: breakdownCols, rows: rows(d.byOrganiser) },
    { name: "By city", notes: ["Cities with at least one laddered game", view], columns: breakdownCols, rows: rows(d.byCity) },
  ];
}

/** Two horizontal bars per bucket — laddered over flat — so the shift is visible at a glance. */
function LeadDistribution({ ladder, flat }: { ladder: GroupStats; flat: GroupStats }) {
  if (!ladder.seats && !flat.seats) return <Empty text="No played seats in this view." />;
  const max = Math.max(1, ...ladder.buckets.map((b) => b.pct ?? 0), ...flat.buckets.map((b) => b.pct ?? 0));
  const bar = (v: number | null, color: string, who: string) => (
    <div className="flex items-center gap-2">
      <span className="w-[64px] shrink-0 font-mono text-[11px] text-muted">{who}</span>
      <div className="h-[10px] flex-1 bg-surface-2">
        <div className="h-full" style={{ width: `${((v ?? 0) / max) * 100}%`, background: color }} />
      </div>
      <span className="w-[48px] shrink-0 text-right font-mono text-[12px] text-fg">{pct(v)}</span>
    </div>
  );
  return (
    <div className="mt-3 flex flex-col gap-3">
      {ladder.buckets.map((b, i) => (
        <div key={b.key} className="grid grid-cols-[110px_1fr] items-center gap-3 max-[640px]:grid-cols-1">
          <span className="text-[13px] text-body">{b.label}</span>
          <div className="flex flex-col gap-1">
            {bar(b.pct, SERIES.completed, "Laddered")}
            {bar(flat.buckets[i]?.pct ?? null, SERIES.auto, "Flat")}
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownTable({ rows, nameHeader }: { rows: Row[]; nameHeader: string }) {
  if (!rows.length) return <Empty text="No laddered games in this view." />;
  const pair = (l: string, f: string) => (
    <span className="font-mono text-[13px]">{l} <span className="text-muted">/ {f}</span></span>
  );
  return (
    <div className={`${TABLE_WRAP} mt-3`}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th>{nameHeader}</th>
            <th>Games L / F</th>
            <th>Median lead L / F</th>
            <th>48h+ L / F</th>
            <th>Short cancel L / F</th>
            <th>₹ / game L / F</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.comparable ? "" : "opacity-60"} title={r.comparable ? undefined : "Too few games on one side to compare"}>
              <td>{r.label}</td>
              <td>{pair(String(r.ladder.games), String(r.flat.games))}</td>
              <td>{pair(hrs(r.ladder.medianLeadHours), hrs(r.flat.medianLeadHours))}</td>
              <td>{pair(pct(r.ladder.earlySharePct), pct(r.flat.earlySharePct))}</td>
              <td>{pair(pct(r.ladder.shortCancelPct), pct(r.flat.shortCancelPct))}</td>
              <td>{pair(money(r.ladder.revenuePerGamePaise), money(r.flat.revenuePerGamePaise))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EarlyBirdAnalytics() {
  const [preset, setPreset] = useState<Preset>("90");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const r = presetRange(preset, custom);
  const customIncomplete = preset === "custom" && (!r.from || !r.to || r.from > r.to);
  const rq = rangeQuery(r).toString();
  const { data: res, loading, error, refresh } = useAdminFetch<ApiResponse<EarlyBirdData>>(
    customIncomplete ? null : `/admin/analytics/early-bird${rq ? `?${rq}` : ""}`,
    { cache: true, errorMessage: "Failed to load early-bird analytics." },
  );
  const d = res?.data;
  const exportBlock = (name: string) => async () => { if (d) await downloadSheets(`early-bird-${name}`, sheetsFor(d).filter((s) => s.name === name)); };

  const toolbar = (
    <div className={TOOLBAR}>
      <select className={FILTER_SELECT} value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Date range">
        {PAST_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {preset === "custom" ? (
        <>
          <input type="date" className={FILTER_SELECT} value={custom.from} max={custom.to || undefined}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <input type="date" className={FILTER_SELECT} value={custom.to} min={custom.from || undefined}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </>
      ) : null}
      <div className="ml-auto flex gap-2">
        <button type="button" className={TOPBAR_BTN} onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        <ExportButton label="Export to Excel" className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} disabled={!d}
          onExport={async () => { if (d) await downloadSheets("early-bird", sheetsFor(d)); }} />
      </div>
    </div>
  );

  if (customIncomplete) return <>{toolbar}<div className={LOADING_STATE}>Pick a start and end date.</div></>;
  if (error) return <>{toolbar}<div className={FORM_ERROR}>{error}</div></>;
  if (!d) return <>{toolbar}<div className={LOADING_STATE}>Crunching the numbers…</div></>;

  return (
    <>
      {toolbar}
      <div className={loading ? "opacity-60 transition-opacity" : ""}>
        <Verdict
          label="Early-bird pricing — laddered vs flat games"
          conclusions={d.conclusions}
          findingsSub="What the ladders cost, and how often early seats are given up."
          footnote={`Play dates ${d.window.from} → ${d.window.to}. Each side needs ${d.thresholds.MIN_GAMES}+ games before it is judged.${d.capped ? " Capped at the latest 5,000 games." : ""}`}
        />

        <Block id="eb-compare" title="Laddered vs flat" sub="The PRD's metric table, both groups over the same dates." onExport={exportBlock("Laddered vs flat")}>
          <div className={`${TABLE_WRAP} mt-3`}>
            <table className={TABLE}>
              <thead><tr><th>Metric</th><th>Laddered</th><th>Flat</th></tr></thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.label}><td>{m.label}</td><td className="font-mono">{m.get(d.ladder)}</td><td className="font-mono">{m.get(d.flat)}</td></tr>
                ))}
                <tr>
                  <td>Early-bird seats sold · given up</td>
                  <td className="font-mono">{d.ladder.earlySeatsSold} · {pct(d.ladder.earlyBackoutPct)}</td>
                  <td className="font-mono text-muted">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Block>

        <Block id="eb-lead" title="Booking lead time" sub={`How long before kick-off each played seat was booked. ${d.ladder.seats} laddered seats, ${d.flat.seats} flat.`} onExport={exportBlock("Lead time")}>
          <LeadDistribution ladder={d.ladder} flat={d.flat} />
        </Block>

        <Block id="eb-organisers" title="By organiser" sub="Organisers running at least one laddered game. Greyed rows have too few games on one side to compare." onExport={exportBlock("By organiser")}>
          <BreakdownTable rows={d.byOrganiser} nameHeader="Organiser" />
        </Block>

        <Block id="eb-cities" title="By city" sub="Where the venue is, from the platform's metro registry." onExport={exportBlock("By city")}>
          <BreakdownTable rows={d.byCity} nameHeader="City" />
        </Block>
      </div>
    </>
  );
}
