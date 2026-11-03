"use client";

import { useState } from "react";
import {
  TOOLBAR, FILTER_SELECT, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, SUMMARY_FOUR, BADGE, BADGE_BLUE,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { Columns, MetricSwitch, SERIES } from "../analytics/charts";
import { Block, ExportButton, Kpi } from "../analytics/verdicts";
import { presetRange, type Preset } from "../analytics/range";
import { downloadSheets } from "../analytics/exportExcel";
import {
  columnLabel, formatRupees, periodLabel, rangeText, revenueSheet, spansYears,
  type Grouping, type RevenueFigures, type RevenueReport, type RevenueRow,
} from "./revenue";

/* Finance → Revenue: money players paid, one row per day, week or month.
   The table's filters (dates, city, organiser) narrow the table and its chart;
   the Revenue box above the tabs always covers the whole platform. */

const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

const RANGES: { key: Preset; label: string }[] = [
  { key: "30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

/* Switching the grouping moves to a range that suits it, unless the admin
   picked their own dates. */
const DEFAULT_RANGE: Record<Grouping, Preset> = { day: "30", week: "90", month: "year" };

type ChartMetric = "received" | "avg" | "games";
const CHART: Record<ChartMetric, { label: string; unit: string; money: boolean; pick: (r: RevenueRow) => number }> = {
  received: { label: "Received", unit: "received", money: true, pick: (r) => r.receivedPaise },
  avg: { label: "Avg per game", unit: "avg per game", money: true, pick: (r) => r.avgPerGamePaise ?? 0 },
  games: { label: "Games played", unit: "games played", money: false, pick: (r) => r.completedGames },
};

type MetroOptions = { data?: { metros?: { slug: string; label: string }[] } };

const NOUN: Record<Grouping, string> = { day: "day", week: "week", month: "month" };

function Figures({ f }: { f: RevenueFigures }) {
  return (
    <>
      <td>{f.completedGames}</td>
      <td className={f.cancelledGames > 0 ? "text-danger!" : "text-muted!"}>{f.cancelledGames}</td>
      <td>{f.paidSeats}</td>
      <td>{formatRupees(f.seatPaise)}</td>
      <td className={f.feePaise > 0 ? "" : "text-muted!"}>{formatRupees(f.feePaise)}</td>
      <td className="font-semibold text-success!">{formatRupees(f.receivedPaise)}</td>
      <td className="font-semibold">{formatRupees(f.avgPerGamePaise)}</td>
      <td className={f.passSeats > 0 ? "" : "text-muted!"}>
        {formatRupees(f.passCoveredPaise)}
        {f.passSeats > 0 ? <span className="text-muted"> · {f.passSeats} seats</span> : null}
      </td>
      <td className={f.offerSeats > 0 ? "" : "text-muted!"}>
        {formatRupees(f.offerDiscountPaise)}
        {f.offerSeats > 0 ? <span className="text-muted"> · {f.offerSeats} seats</span> : null}
      </td>
    </>
  );
}

export function RevenueTab() {
  const [by, setBy] = useState<Grouping>("day");
  const [preset, setPreset] = useState<Preset>(DEFAULT_RANGE.day);
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [metro, setMetro] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [metric, setMetric] = useState<ChartMetric>("received");

  const range = presetRange(preset, custom);
  const customIncomplete = preset === "custom" && (!custom.from || !custom.to || custom.from > custom.to);
  const qs = new URLSearchParams({ by });
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  if (metro) qs.set("metro", metro);
  if (organiser) qs.set("organiser", organiser);

  const { data: body, loading, error } = useAdminFetch<{ data?: RevenueReport }>(
    customIncomplete ? null : `/admin/revenue?${qs.toString()}`,
    { errorMessage: "Failed to load revenue." },
  );
  const { data: metroRes } = useAdminFetch<MetroOptions>("/turfs/city-options", { cache: true });
  const metros = metroRes?.data?.metros || [];
  const report = body?.data ?? null;
  const rows = report?.periods ?? [];
  const withYear = spansYears(rows);

  const pickGrouping = (g: Grouping) => {
    setBy(g);
    if (preset !== "custom") setPreset(DEFAULT_RANGE[g]);
  };

  const rangeName = RANGES.find((r) => r.key === preset)?.label ?? "";
  const view = [
    report?.filters.from && report.filters.to ? rangeText(report.filters.from, report.filters.to) : rangeName,
    report?.filters.metroLabel ? `City: ${report.filters.metroLabel}` : null,
    report?.filters.organiserName ? `Organiser: ${report.filters.organiserName}` : null,
  ].filter(Boolean).join(" · ");

  const chart = CHART[metric];
  const fmt = chart.money ? formatRupees : String;
  const t = report?.totals;

  return (
    <>
      <div className={TOOLBAR}>
        <MetricSwitch label="Group by" value={by} onChange={pickGrouping} options={GROUPINGS} />
        <select className={FILTER_SELECT} value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Kick-off date range">
          {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        {preset === "custom" ? (
          <>
            <input type="date" className={FILTER_SELECT} value={custom.from} max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From" />
            <input type="date" className={FILTER_SELECT} value={custom.to} min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To" />
          </>
        ) : null}
        <select className={FILTER_SELECT} value={metro} onChange={(e) => setMetro(e.target.value)} aria-label="City">
          <option value="">All cities</option>
          {metros.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
        <select className={FILTER_SELECT} value={organiser} onChange={(e) => setOrganiser(e.target.value)} aria-label="Organiser">
          <option value="">All organisers</option>
          {(report?.organisers ?? []).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.games})</option>)}
        </select>
        <div className="ml-auto">
          <ExportButton
            disabled={!report || rows.length === 0}
            onExport={async () => { if (report) await downloadSheets("kasakai-revenue", [revenueSheet(report, view)]); }}
          />
        </div>
      </div>

      {customIncomplete ? <div className={LOADING_STATE}>Pick a start and end date.</div> : null}
      {error ? <div className={`${FORM_ERROR} mb-4`}>{error}</div> : null}
      {!report && loading ? <div className={LOADING_STATE}>Adding up the money…</div> : null}

      {report ? (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {t ? (
            <div className={SUMMARY_FOUR}>
              <Kpi label="Total received" value={formatRupees(t.receivedPaise)}
                sub={t.feePaise > 0 ? `incl. ${formatRupees(t.feePaise)} cancellation fees` : view} />
              <Kpi label="Games played" value={t.completedGames}
                sub={t.cancelledGames ? `${t.cancelledGames} cancelled` : "none cancelled"} />
              <Kpi label="Avg per game" value={formatRupees(t.avgPerGamePaise)} sub={`${t.paidSeats} paid seats`} />
              <Kpi label="Not yet completed" value={t.pendingGames ? formatRupees(t.pendingPaise) : "—"}
                sub={t.pendingGames ? `on ${t.pendingGames} games — not in the total` : "every game in range is settled"} />
            </div>
          ) : null}

          <Block
            title={`${chart.label} per ${NOUN[by]}`}
            sub={`${view}. Completed games only, by kick-off day (IST). Hover a column for its figures.`}
            action={
              <MetricSwitch
                label="Chart metric"
                value={metric}
                onChange={setMetric}
                options={(Object.keys(CHART) as ChartMetric[]).map((k) => ({ key: k, label: CHART[k].label }))}
              />
            }
          >
            <div className="mt-3">
              <Columns
                dense={rows.length > 16}
                unit={chart.unit}
                format={(v) => fmt(v)}
                rows={rows.map((r) => ({
                  label: columnLabel(r, by, withYear),
                  value: chart.pick(r),
                  color: r.current ? SERIES.upcoming : SERIES.completed,
                  note: [
                    periodLabel(r, by, true) + (r.current ? " · so far" : ""),
                    `${r.completedGames} games · ${formatRupees(r.avgPerGamePaise)} avg`,
                    r.pendingGames ? `+${formatRupees(r.pendingPaise)} on ${r.pendingGames} not yet completed` : "",
                  ].filter(Boolean).join(" · "),
                }))}
              />
            </div>
          </Block>

          {report.capped ? (
            <div className="font-mono text-[12px] text-muted">
              Showing the latest {report.maxDays} days. Switch to Weekly or Monthly for a longer view.
            </div>
          ) : null}

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>{NOUN[by][0].toUpperCase() + NOUN[by].slice(1)}</th>
                  <th title="Completed games">Games played</th>
                  <th>Cancelled</th>
                  <th title="Seats that paid something and were kept">Paid seats</th>
                  <th>Seat payments</th>
                  <th title="Cancellation fees charged and not handed back">Fees kept</th>
                  <th>Total received</th>
                  <th title="Total received ÷ games played">Avg per game</th>
                  <th title="Fees passes covered — beside the total, not taken off it">Pass-covered</th>
                  <th title="What KasaKai offers took off — beside the total, not taken off it">Offer discounts</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={10} className="p-8! text-center text-muted!">No games in this range.</td></tr>
                ) : null}
                {[...rows].reverse().map((r) => (
                  <tr key={r.key}>
                    <td className="whitespace-nowrap">
                      {periodLabel(r, by, withYear)}
                      {r.current ? <span className={`${BADGE} ${BADGE_BLUE} ml-2`}>so far</span> : null}
                      {r.partial && by === "month" ? (
                        <div className="text-[11px] text-muted">{rangeText(r.from, r.to)} only</div>
                      ) : null}
                      {r.pendingGames > 0 ? (
                        <div className="text-[11px] text-muted">
                          +{formatRupees(r.pendingPaise)} on {r.pendingGames} not yet completed
                        </div>
                      ) : null}
                    </td>
                    <Figures f={r} />
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 && t ? (
                <tfoot>
                  <tr className="bg-surface-2 font-semibold">
                    <td>Total</td>
                    <Figures f={t} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="m-0 max-w-[900px] text-[12.5px] leading-[1.55] text-muted">
            <b className="text-body">Received</b> is what players paid for seats they kept, plus cancellation fees kept,
            on completed games. Refunds are already out of it, and wallet top-ups are not revenue — a top-up is credit a
            player holds, not a sale. A cancelled game brings in ₹0 and is not in the average. Games not completed yet
            are shown beside the total until they are played. Pass cover and offer discounts are money not collected
            from the player; they are shown beside the total, never taken off it.
          </p>
        </div>
      ) : null}
    </>
  );
}
