"use client";

/* Analytics — one row per topic, each expanding in place; opening one folds the
   other. Only a topic that has been opened mounts, so a collapsed one costs
   nothing; once open it stays mounted, so its filters survive being folded away.
   A new topic is one line in TOPICS.

   Games — how football games are performing. (Screening events are not covered
   here; each event has its own analytics page in the streaming section.)

   The topic reads top-down the way an admin asks the question: first the verdict
   in one sentence, then one card per area, then the ranked findings, and only
   then the charts and tables those verdicts were drawn from. Every verdict comes
   from the backend's conclusions engine (utils/analyticsInsights.js); this file
   renders, it never judges.

   Things it deliberately does:
   • No average fill. How games went is shown as how many STRUGGLED — played
     under the engine's UNDER_FILL_PCT, or cancelled, automatically or by the
     organiser — out of those played or cancelled, plus the median fill of the
     games that have one. An average let a few full games hide the empty ones.
   • Everything exports. Each block has its own Excel button and the toolbar
     exports the lot (analytics/exportExcel.ts — one builder per block).
   • "Unique players" is a list, not just a number: the Players KPI and the
     players-turning-up finding open the players behind it (PlayerListDrawer).
   • Everything is clickable. A verdict card scrolls to its evidence; a KPI, a
     chart mark or a table row opens the games it is made of (GameListDrawer);
     a city, venue, organiser, month or day can narrow the whole page, verdicts
     included; legends hide series; table headers sort.
   • Every date is the PLAY date — the kick-off. */

import { useState } from "react";
import {
  STATS_GRID, STAT_LABEL, PANEL, PANEL_TITLE, TOOLBAR, FILTER_SELECT, TABLE_WRAP, TABLE,
  FORM_ERROR, LOADING_STATE, TOPBAR_BTN, TOPBAR_BTN_PRIMARY, ACTION_BTN, SEARCH_INPUT,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { Head } from "../shared/components";
import type {
  AnalyticsResponse, AnalyticsData, EvidenceSection, BreakdownRow, PageFilters, Slice,
} from "../analytics/types";
import {
  SERIES, StackedColumns, PercentLine, Columns, SlotHeatmap, Meter, Empty, MetricSwitch,
  pctText, monthLabel, type HeatMetric, type StackSeries,
} from "../analytics/charts";
import { GameListDrawer, canNarrow, type DrawerRequest } from "../analytics/GameListDrawer";
import { PlayerListDrawer, type PlayerListRequest } from "../analytics/PlayerListDrawer";
import {
  downloadSheets, exportGamesWorkbook, gameSheets, type Sheet,
} from "../analytics/exportExcel";
import { Verdict, Kpi, Block, ExportButton } from "../analytics/verdicts";
import { PlayersAnalytics } from "../analytics/PlayersAnalytics";
import { PRESETS, dayDate, istYMD, monthRange, presetRange, type Preset } from "../analytics/range";

const dayLabel = (ymd: string) => dayDate(ymd).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const dayFull = (ymd: string) =>
  dayDate(ymd).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYPART_PLURAL: Record<string, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings", night: "nights" };

const SECTION_ID: Record<EvidenceSection, string> = {
  daily: "ev-daily", monthly: "ev-monthly", status: "ev-status", fill: "ev-fill",
  metros: "ev-metros", venues: "ev-venues", organisers: "ev-organisers", slots: "ev-slots",
  upcoming: "ev-upcoming",
};

/** Which evidence block each verdict card scrolls to. Upcoming has no block — its card opens the games. */
const AREA_SECTION: Record<string, EvidenceSection> = {
  growth: "monthly", demand: "fill", cancellations: "status",
};

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** The same five stacks on the per-day and per-month charts. */
const gameSeries = (underLine: number): StackSeries[] => [
  { key: "healthy", label: "Healthy", color: SERIES.healthy },
  { key: "under", label: `Under ${underLine}% full`, color: SERIES.under },
  { key: "auto", label: "Auto-cancelled", color: SERIES.auto },
  { key: "cancelled", label: "Cancelled by organiser", color: SERIES.neutral },
  { key: "upcoming", label: "Upcoming / not closed", color: SERIES.upcoming },
];

const stackValues = (r: { games: number; completed: number; cancelled: number; autoCancelled: number; underCompleted: number }) => ({
  healthy: Math.max(0, r.completed - r.underCompleted),
  under: r.underCompleted,
  auto: r.autoCancelled,
  cancelled: Math.max(0, r.cancelled - r.autoCancelled),
  upcoming: Math.max(0, r.games - r.completed - r.cancelled),
});

// ── Conclusions block ────────────────────────────────────────────────────────

function Conclusions({ data, onDrill, onPlayers }: {
  data: AnalyticsData; onDrill: (r: DrawerRequest) => void; onPlayers: (r: PlayerListRequest) => void;
}) {
  return (
    <Verdict
      label="How games are doing"
      conclusions={data.conclusions}
      onArea={(key) => {
        if (AREA_SECTION[key]) scrollToId(SECTION_ID[AREA_SECTION[key]]);
        else if (key === "upcoming") {
          onDrill(data.games.upcoming.atRisk
            ? { slice: { upcoming: true, atRisk: true }, label: "Upcoming games below minimum" }
            : { slice: { upcoming: true }, label: "Upcoming games" });
        }
      }}
      footnote={<>
        {data.comparison.none
          ? "Looking ahead by play date — nothing earlier to compare"
          : `Trends compare ${data.comparison.recentLabel} with ${data.comparison.label}`}
        {" · "}updated {new Date(data.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
        {" · "}click a card for its evidence
      </>}
      findingsSub="Worst first. Groups with too few games are never judged. “Show games” lists exactly the games a finding is about."
      actions={(i) => (
        <>
          {i.slice ? (
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => onDrill({
                slice: i.slice!,
                label: i.sliceLabel || i.title,
                narrowLabel: (i.sliceLabel || "").split(" · ")[0] || undefined,
              })}
            >
              Show games
            </button>
          ) : null}
          {i.list === "players" ? (
            <button type="button" className={ACTION_BTN} onClick={() => onPlayers({ compare: true, label: i.title })}>
              See evidence →
            </button>
          ) : i.section === "upcoming" ? null : (
            <button type="button" className={ACTION_BTN} onClick={() => scrollToId(SECTION_ID[i.section])}>
              See evidence ↓
            </button>
          )}
        </>
      )}
    />
  );
}

// ── Ranked tables (cities, venues, organisers, formats) ──────────────────────

type SortKey = "name" | "games" | "under" | "median" | "cancelled" | "waitlist";
type Sort = { key: SortKey; dir: "asc" | "desc" };
const FIRST_DIR: Record<SortKey, Sort["dir"]> = {
  name: "asc", games: "desc", under: "desc", median: "desc", cancelled: "desc", waitlist: "desc",
};
const SORT_VALUE: Record<Exclude<SortKey, "name">, (r: BreakdownRow) => number> = {
  games: (r) => r.games,
  under: (r) => r.underPct ?? -1,
  median: (r) => r.medianFillPct ?? -1,
  cancelled: (r) => r.cancelled,
  waitlist: (r) => r.waitlistEntries,
};
/** > 0 when `a` performed better: fuller typical game, then fewer struggling. */
const better = (a: BreakdownRow, b: BreakdownRow) =>
  (a.medianFillPct ?? -1) - (b.medianFillPct ?? -1) || (b.underPct ?? 101) - (a.underPct ?? 101);
/** > 0 when `a` did worse: more struggling, then emptier typical game. */
const worse = (a: BreakdownRow, b: BreakdownRow) =>
  (a.underPct ?? -1) - (b.underPct ?? -1) || (b.medianFillPct ?? 101) - (a.medianFillPct ?? 101);

const HILITE = "cursor-pointer rounded-md border border-border-2 bg-surface-2 px-3 py-[6px] text-left font-mono text-[12px] text-body hover:border-fg hover:text-fg";

function RankTable({ rows, nameHeader, sub, minGames, underLine, sliceFor, narrowable, onDrill, onNarrow }: {
  rows: BreakdownRow[];
  nameHeader: string;
  /** A muted second line under each name — a venue's city and area. */
  sub?: (r: BreakdownRow) => string | null;
  minGames: number;
  underLine: number;
  sliceFor: (r: BreakdownRow) => Slice | null;
  narrowable?: boolean;
  onDrill: (r: DrawerRequest) => void;
  onNarrow?: (r: DrawerRequest) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "median", dir: "desc" });
  const [query, setQuery] = useState("");
  if (!rows.length) return <Empty />;

  const judged = (r: BreakdownRow) => r.judged >= minGames;
  const q = query.trim().toLowerCase();
  const fillSort = sort.key === "under" || sort.key === "median";
  const sign = sort.dir === "asc" ? 1 : -1;
  const visible = rows
    .filter((r) => !q || `${r.label} ${sub?.(r) ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) =>
      // On a fill sort, groups too small to judge sink whichever way it runs.
      (fillSort ? Number(judged(b)) - Number(judged(a)) : 0) ||
      (sort.key === "name" ? sign * a.label.localeCompare(b.label) : sign * (SORT_VALUE[sort.key](a) - SORT_VALUE[sort.key](b))) ||
      -better(a, b) ||
      b.games - a.games);

  const pool = rows.filter(judged);
  const best = pool.length >= 2 ? pool.reduce((x, r) => (better(r, x) > 0 ? r : x)) : null;
  const weakest = pool.length >= 2 ? pool.reduce((x, r) => (worse(r, x) > 0 ? r : x)) : null;

  const drill = (r: BreakdownRow, under = false) => {
    const slice = sliceFor(r);
    if (!slice) return;
    onDrill({
      slice: under ? { ...slice, under: true } : slice,
      label: under ? `${r.label} · struggled` : r.label,
      narrowLabel: narrowable ? r.label : undefined,
    });
  };
  const th = (key: SortKey, label: string, title?: string) => {
    const active = sort.key === key;
    return (
      <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} title={title}>
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }))}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg hover:text-info"
        >
          {label}
          {active ? (sort.dir === "asc" ? " ▲" : " ▼") : <span className="text-muted-2"> ↕</span>}
        </button>
      </th>
    );
  };
  const showFocus = !!(narrowable && onNarrow);

  return (
    <>
      {best ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={HILITE} onClick={() => drill(best)} title={`List ${best.label}'s games`}>
            <span className="text-success">▲ Best</span> {best.label} — usually {pctText(best.medianFillPct)} full · {best.underCount} of {best.judged} struggled
          </button>
          {weakest && weakest !== best ? (
            <button type="button" className={HILITE} onClick={() => drill(weakest, true)} title={`List the games that struggled in ${weakest.label}`}>
              <span className="text-danger">▼ Weakest</span> {weakest.label} — {weakest.underCount} of {weakest.judged} struggled · usually {pctText(weakest.medianFillPct)} full
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length > 8 ? (
        <div className="mb-2 flex">
          <input
            type="search"
            className={SEARCH_INPUT}
            placeholder={`Find a ${nameHeader.toLowerCase()}…`}
            aria-label={`Find a ${nameHeader.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      <div className={`${TABLE_WRAP} max-h-[420px]`}>
        <table className={TABLE + " min-w-[720px]! max-[900px]:min-w-[720px]!"}>
          <thead>
            <tr>
              <th className="w-10">#</th>
              {th("name", nameHeader)}
              {th("games", "Games")}
              {th("under", "Struggled", `Played under ${underLine}% full, or cancelled (automatically or by the organiser) — out of the games played or cancelled`)}
              {th("median", "Usually", "How full the typical (median) played game was")}
              {th("cancelled", "Cancelled", "Cancelled games; “auto” = called off for too few players")}
              {th("waitlist", "Waitlist", "Players who joined a waitlist, across every game here — upcoming ones included")}
              {showFocus ? <th aria-label="Narrow the page" /> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const slice = sliceFor(r);
              const thin = !judged(r);
              const second = sub?.(r);
              return (
                <tr
                  key={(r.id || r.key || r.label) + i}
                  className={`${thin ? "opacity-60" : ""} ${slice ? "cursor-pointer" : ""}`}
                  onClick={slice ? () => drill(r) : undefined}
                  title={slice ? "Click to list these games" : undefined}
                >
                  <td className="font-mono text-muted">{i + 1}</td>
                  <td>
                    <span className="block font-medium text-fg">{r.label}</span>
                    {second ? <span className="block text-[12px] text-muted">{second}</span> : null}
                  </td>
                  <td className="font-mono">{r.games}{r.upcoming ? <span className="text-muted"> ({r.upcoming} upcoming)</span> : null}</td>
                  <td title={`${r.underCount} of ${r.judged} games played or cancelled struggled: ${r.underCompleted} played under ${underLine}% full, ` +
                    `${r.cancelled} cancelled${r.autoCancelled ? ` (${r.autoCancelled} automatically)` : ""}.${thin ? ` Under ${minGames} games — not judged.` : ""}`}>
                    <div className="flex items-center gap-2">
                      <Meter value={r.underPct} color={SERIES.under} />
                      <span className="whitespace-nowrap font-mono text-[12px] text-muted">{r.underCount} of {r.judged}</span>
                    </div>
                  </td>
                  <td title={r.filled
                    ? `Half of the ${r.filled} games played here ended at least ${pctText(r.medianFillPct)} full; the weakest quarter ${pctText(r.p25FillPct)} or less.`
                    : "No games played yet."}
                  >
                    <div className="flex items-center gap-1">
                      <Meter value={r.medianFillPct} />
                      {r.medianFillPct != null ? <span className="text-[12px] text-muted">full</span> : null}
                    </div>
                  </td>
                  <td className="font-mono">{r.cancelled}{r.autoCancelled ? <span className="text-muted"> ({r.autoCancelled} auto)</span> : null}</td>
                  <td className="font-mono">{r.waitlistEntries || <span className="text-muted-2">—</span>}</td>
                  {showFocus ? (
                    <td>
                      {slice && canNarrow(slice) ? (
                        <button
                          type="button"
                          className={ACTION_BTN}
                          title={`Narrow the whole page to ${r.label}`}
                          onClick={(e) => { e.stopPropagation(); onNarrow!({ slice, label: r.label, narrowLabel: r.label }); }}
                        >
                          Focus
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 font-mono text-[11px] text-muted-2">
        {q && !visible.length ? `Nothing matches “${query.trim()}”. · ` : ""}
        Click a row for its games{showFocus ? " · Focus narrows the whole page to it" : ""} · click a heading to sort ·
        “Usually” is the median played game — half ended at least that full · faded rows have under {minGames} games
        played or cancelled and are not judged.
      </div>
    </>
  );
}

/** Every game in the view by status — sits right under the verdicts. */
function Outcomes({ data, view, onDrill }: { data: AnalyticsData; view: string; onDrill: (r: DrawerRequest) => void }) {
  const g = data.games;
  const statusOrder = ["completed", "confirmed", "tentative", "open", "cancelled", "draft"];
  return (
    <Block
      id="ev-status"
      title="Outcomes"
      sub={`Cancellation rate ${pctText(g.totals.cancellationRatePct)} of ${g.totals.decided} games played or cancelled · ${g.totals.autoCancelled} auto-cancelled for too few players. Click a status for its games.`}
      onExport={async () => downloadSheets("kasakai-outcomes", [gameSheets.outcomes({ data, view })])}
    >
      <div className="grid grid-cols-6 gap-px border border-border bg-border max-[900px]:grid-cols-3">
        {statusOrder.map((s) => {
          const n = g.totals.byStatus[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              disabled={!n || s === "draft"}
              onClick={() => onDrill({ slice: { status: s }, label: `Status: ${s}` })}
              className="cursor-pointer border-none bg-surface p-3 text-left enabled:hover:bg-surface-2 disabled:cursor-default"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{s}</div>
              <div className="font-mono text-[20px] text-fg">{n}</div>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

// ── Evidence blocks ──────────────────────────────────────────────────────────

type DayMetric = "games" | "seats";
type MonthMetric = "games" | "under" | "median" | "cancelled";
type FillAt = "end" | "24h";

/** What each heatmap view shows — printed under the grid. */
const heatExplain = (metric: HeatMetric, underLine: number, minGames: number) => ({
  under: `The share of the slot's games — played or cancelled — that struggled: played under ${underLine}% full, or cancelled ` +
    "(automatically or by the organiser). Upcoming games are not counted yet.",
  median: "Typical fill is the median: line the slot's played games up from emptiest to fullest and take the middle one — " +
    "half finished at least this full, half at most. 100% means more than half of them sold out. Auto-cancelled games count at " +
    `the seats they held; organiser-cancelled and upcoming games have no final fill and are left out. Faded = fewer than ${minGames} such games.`,
  games: "Every game in the slot, whatever happened to it (drafts excluded).",
  cancelled: "Cancelled games out of every game in the slot — 25/60 is 25 of 60 cancelled, whoever called them off. " +
    "Brighter = more cancellations.",
})[metric];

function GamesEvidence({ data, minGames, view, onDrill, onNarrow, onPlayers }: {
  data: AnalyticsData; minGames: number;
  /** The page's filters in words — for the exports. */
  view: string;
  onDrill: (r: DrawerRequest) => void; onNarrow: (r: DrawerRequest) => void; onPlayers: (r: PlayerListRequest) => void;
}) {
  const g = data.games;
  const underLine = data.thresholds?.UNDER_FILL_PCT ?? 60;
  const v = { data, view };
  /** A block's Excel button: its sheets, built only when clicked. */
  const save = (file: string, sheets: () => Sheet[]) => () => downloadSheets(`kasakai-${file}`, sheets());
  const series = gameSeries(underLine);
  const [dayMetric, setDayMetric] = useState<DayMetric>("games");
  const [monthMetric, setMonthMetric] = useState<MonthMetric>("games");
  const [fillAt, setFillAt] = useState<FillAt>("end");
  const [heatMetric, setHeatMetric] = useState<HeatMetric>("under");

  // Per day
  const days = g.daily.days;
  const hosted = days.reduce((s, d) => s + d.games - d.cancelled, 0);
  const seatsSold = days.reduce((s, d) => s + d.seatsSold, 0);
  const drillDay = (i: number) => {
    const d = days[i];
    if (!d.games) return;
    const name = dayFull(d.day);
    onDrill({ slice: { day: d.day }, label: name, narrowLabel: name });
  };

  // Per month
  const multiYear = new Set(g.monthly.map((m) => m.month.slice(0, 4))).size > 1;
  const shortMonth = (ym: string) => (multiYear ? `${monthLabel(ym)} ${ym.slice(2, 4)}` : monthLabel(ym));
  const drillMonth = (i: number, extra: Slice = {}) => {
    const m = g.monthly[i];
    const name = monthLabel(m.month, true);
    const suffix = extra.under ? " · struggled" : extra.status ? ` · ${extra.status}` : "";
    onDrill({ slice: { month: m.month, ...extra }, label: name + suffix, narrowLabel: name });
  };

  const bucketColor = (key: string) =>
    key === "auto" ? SERIES.auto : key === "under" ? SERIES.under : key === "cancelled" ? SERIES.neutral : SERIES.healthy;
  const organiserCancelled = Math.max(0, g.totals.cancelled - g.totals.autoCancelled);

  return (
    <div className="flex flex-col gap-5">
      <div className={STATS_GRID + " mb-0!"}>
        <Kpi
          label="Games played"
          value={g.totals.run - g.totals.upcoming}
          sub={`${g.totals.upcoming} still to play · ${g.totals.byStatus.draft || 0} drafts`}
          onClick={() => onDrill({ slice: { status: "completed" }, label: "Completed games" })}
          hint="List them"
        />
        <Kpi
          label="Cancelled"
          value={g.totals.cancelled}
          sub={`${g.totals.autoCancelled} auto (too few players) · ${organiserCancelled} by organiser · ${pctText(g.totals.cancellationRatePct)} of finished`}
          onClick={g.totals.cancelled ? () => onDrill({ slice: { status: "cancelled" }, label: "Cancelled games" }) : undefined}
          hint="List them"
        />
        <Kpi
          label="Fill 24h before"
          value={pctText(g.fill.medianFill24Pct)}
          sub={`Typical game a day out · ${pctText(g.fill.medianFillPct)} at the end`}
          onClick={g.fill.judged24 ? () => { setFillAt("24h"); scrollToId("ev-fill"); } : undefined}
          hint="Compare"
        />
        <Kpi
          label="Players"
          value={g.totals.uniquePlayers}
          sub="Different people with their own seat in a game played or still to come here, each counted once however many games they booked. Guests, players who backed out and cancelled games are left out; no-shows still count."
          onClick={g.totals.uniquePlayers ? () => onPlayers({ compare: false, label: "Players in this view" }) : undefined}
          hint="List them"
        />
      </div>

      <Block
        id="ev-daily"
        title="Games per day"
        sub={days.length
          ? `Avg ${(hosted / days.length).toFixed(1)} games hosted and ${Math.round(seatsSold / days.length)} seats sold a day over ${days.length} days (cancelled games excluded)` +
            (g.daily.capped ? ` — the ${data.comparison.none ? "first" : "latest"} ${days.length} days of this view` : "") +
            ". Click a day for its games; click a legend item to hide it."
          : "No games in this view."}
        onExport={save("games-per-day", () => [gameSheets.daily(v)])}
        action={
          <MetricSwitch<DayMetric>
            label="Daily metric"
            value={dayMetric}
            onChange={setDayMetric}
            options={[{ key: "games", label: "Games" }, { key: "seats", label: "Seats sold" }]}
          />
        }
      >
        <StackedColumns
          rows={days.map((d) => ({
            label: dayLabel(d.day),
            fullLabel: dayFull(d.day),
            values: dayMetric === "games" ? stackValues(d) : { seats: d.seatsSold },
          }))}
          series={dayMetric === "games" ? series : [{ key: "seats", label: "Seats sold (games that ran)", color: SERIES.healthy }]}
          unit={dayMetric === "games" ? "games" : "seats"}
          onSelect={drillDay}
          focus={days.findLastIndex((d) => d.day <= istYMD(new Date()))}
        />
      </Block>

      <Block
        id="ev-monthly"
        title="Games by play month"
        sub="Bucketed by kick-off date (IST). Click a month to list its games; click a legend item to hide it."
        onExport={save("games-by-month", () => [gameSheets.monthly(v)])}
        action={
          <MetricSwitch<MonthMetric>
            label="Monthly metric"
            value={monthMetric}
            onChange={setMonthMetric}
            options={[
              { key: "games", label: "Games" },
              { key: "under", label: "% struggled" },
              { key: "median", label: "Typical fill" },
              { key: "cancelled", label: "% cancelled" },
            ]}
          />
        }
      >
        {monthMetric === "games" ? (
          <StackedColumns
            rows={g.monthly.map((m) => ({ label: shortMonth(m.month), fullLabel: monthLabel(m.month, true), values: stackValues(m) }))}
            onSelect={(i) => drillMonth(i)}
            series={series}
          />
        ) : (
          <PercentLine
            label={monthMetric === "under" ? "Struggled" : monthMetric === "cancelled" ? "Cancelled" : "Typical fill"}
            nUnit={monthMetric === "median" ? "games played" : "games played or cancelled"}
            color={monthMetric === "under" ? SERIES.under : monthMetric === "cancelled" ? SERIES.auto : SERIES.healthy}
            onSelect={(i) => drillMonth(i, monthMetric === "under" ? { under: true } : monthMetric === "cancelled" ? { status: "cancelled" } : {})}
            points={g.monthly.map((m) => {
              const n = monthMetric === "median" ? m.filled : m.judged;
              return {
                label: shortMonth(m.month),
                fullLabel: monthLabel(m.month, true),
                value: !n ? null : monthMetric === "under" ? m.underPct : monthMetric === "cancelled" ? m.cancellationRatePct : m.medianFillPct,
                n,
                extra: monthMetric === "under" ? `${m.underCompleted} played under ${underLine}% · ${m.cancelled} cancelled`
                  : monthMetric === "cancelled" ? `${m.cancelled} cancelled · ${m.autoCancelled} auto`
                  : `Weakest quarter ≤ ${pctText(m.p25FillPct)}`,
              };
            })}
          />
        )}
      </Block>

      <Block
        id="ev-fill"
        title="How full games finished"
        onExport={save("how-full", () => [gameSheets.fill(v)])}
        sub={fillAt === "end"
          ? `Every game played or auto-cancelled, beside the games organisers called off. Struggled = played under ${underLine}% full, or cancelled for any reason. Click a bar for its games.`
          : `The ${g.fill.judged24} finished games that existed 24 hours before kick-off, as they stood then — typically ${pctText(g.fill.medianFill24Pct)} full, against ${pctText(g.fill.medianFillPct)} at the end. Games created later, or called off before then, are left out.`}
        action={
          <MetricSwitch<FillAt>
            label="When"
            value={fillAt}
            onChange={setFillAt}
            options={[{ key: "end", label: "At the end" }, { key: "24h", label: "24h before kick-off" }]}
          />
        }
      >
        {fillAt === "end" ? (
          <Columns
            rows={g.fill.buckets.map((b) => ({
              label: b.label,
              value: b.games,
              color: bucketColor(b.key),
              note: b.under ? "Counts as struggled" : undefined,
            }))}
            onSelect={(i) => {
              const b = g.fill.buckets[i];
              onDrill({ slice: { bucket: b.key }, label: b.key === "cancelled" ? "Cancelled by organiser" : `Finished: ${b.label}` });
            }}
          />
        ) : (
          <Columns
            rows={g.fill.buckets24.map((b) => ({ label: b.label, value: b.games, color: b.under ? SERIES.under : SERIES.healthy }))}
            onSelect={(i) => {
              const b = g.fill.buckets24[i];
              onDrill({ slice: { bucket24: b.key }, label: `24h before kick-off: ${b.label}` });
            }}
          />
        )}
      </Block>

      <Block
        id="ev-slots"
        title="When games work"
        sub="By weekday and kick-off time (IST). Click a cell to list its games."
        onExport={save("time-slots", () => [gameSheets.slotGrid(v), gameSheets.slots(v)])}
        action={
          <MetricSwitch<HeatMetric>
            label="Heatmap metric"
            value={heatMetric}
            onChange={setHeatMetric}
            options={[
              { key: "under", label: "% struggled" },
              { key: "median", label: "Typical fill" },
              { key: "games", label: "Games" },
              { key: "cancelled", label: "Cancelled" },
            ]}
          />
        }
      >
        <SlotHeatmap
          cells={g.breakdowns.slots}
          minGames={minGames}
          metric={heatMetric}
          onSelect={(weekday, daypart) => {
            const name = `${WEEKDAY[weekday]} ${DAYPART_PLURAL[daypart] || daypart}`;
            onDrill(heatMetric === "cancelled"
              ? { slice: { weekday, daypart, status: "cancelled" }, label: `${name} · cancelled` }
              : { slice: { weekday, daypart }, label: name });
          }}
        />
        <p className="mt-3 mb-0 max-w-[900px] text-[12.5px] leading-[1.55] text-muted">{heatExplain(heatMetric, underLine, minGames)}</p>
      </Block>

      <Block id="ev-metros" title="Cities" sub="Best first — the fullest typical game among cities with enough games played or cancelled."
        onExport={save("cities", () => [gameSheets.breakdown(v, "Cities", g.breakdowns.metros)])}>
        <RankTable rows={g.breakdowns.metros} nameHeader="City" minGames={minGames} underLine={underLine}
          onDrill={onDrill} onNarrow={onNarrow} narrowable
          sliceFor={(r) => ({ metroKey: r.key ?? "__none__" })} />
      </Block>

      <Block id="ev-venues" title="Venues" sub="Top 50 by games, best first. The waitlist column shows where players are queueing for a spot."
        onExport={save("venues", () => [gameSheets.breakdown(v, "Venues", g.breakdowns.venues, [{ header: "City", key: "metro" }, { header: "Area", key: "area" }])])}>
        <RankTable rows={g.breakdowns.venues} nameHeader="Venue" minGames={minGames} underLine={underLine}
          onDrill={onDrill} onNarrow={onNarrow} narrowable
          sub={(r) => [r.metro, r.area].filter(Boolean).join(" · ") || null}
          sliceFor={(r) => (r.id ? { turf: r.id } : null)} />
      </Block>

      <Block id="ev-organisers" title="Organisers" sub="Top 50 by games run, best first."
        onExport={save("organisers", () => [gameSheets.breakdown(v, "Organisers", g.breakdowns.organisers)])}>
        <RankTable rows={g.breakdowns.organisers} nameHeader="Organiser" minGames={minGames} underLine={underLine}
          onDrill={onDrill} onNarrow={onNarrow} narrowable
          sliceFor={(r) => (r.id ? { organiser: r.id } : null)} />
      </Block>

      <Block id="ev-formats" title="Formats" onExport={save("formats", () => [gameSheets.breakdown(v, "Formats", g.breakdowns.formats)])}>
        <RankTable rows={g.breakdowns.formats} nameHeader="Format" minGames={minGames} underLine={underLine} onDrill={onDrill}
          sliceFor={(r) => (r.key ? { format: r.key } : null)} />
      </Block>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

type MetroOptions = { data?: { metros?: { slug: string; label: string }[] } };

const CHIP = "inline-flex items-center gap-2 rounded-full border border-border-2 bg-surface-2 py-[3px] pr-1 pl-3 font-mono text-[12px] text-body";
const CHIP_X = "cursor-pointer rounded-full border-none bg-transparent px-[7px] py-[1px] text-muted hover:bg-[rgba(255,255,255,0.08)] hover:text-fg";

function GamesAnalytics() {
  const [preset, setPreset] = useState<Preset>("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState<PageFilters>({ metro: "", turf: null, organiser: null });
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null);
  const [players, setPlayers] = useState<PlayerListRequest | null>(null);

  const range = presetRange(preset, custom);
  const customIncomplete = preset === "custom" && (!custom.from || !custom.to || custom.from > custom.to);
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  if (filters.metro) qs.set("metro", filters.metro);
  if (filters.turf) qs.set("turf", filters.turf.id);
  if (filters.organiser) qs.set("organiser", filters.organiser.id);
  const pageQuery = qs.toString();
  const path = customIncomplete ? null : `/admin/analytics${pageQuery ? `?${pageQuery}` : ""}`;

  const { data: res, loading, error, refresh } = useAdminFetch<AnalyticsResponse>(path, {
    errorMessage: "Failed to load analytics.",
  });
  const { data: metroRes } = useAdminFetch<MetroOptions>("/turfs/city-options", { cache: true });
  const metros = metroRes?.data?.metros || [];
  const data = res?.data ?? null;
  const minGames = data?.thresholds?.MIN_GAMES ?? 5;

  /** Narrow the whole page to a slice — the verdicts re-run for it. */
  const onNarrow = (req: DrawerRequest) => {
    const { slice } = req;
    const name = req.narrowLabel || req.label;
    if (slice.month) {
      setCustom(monthRange(slice.month));
      setPreset("custom");
    }
    if (slice.day) {
      setCustom({ from: slice.day, to: slice.day });
      setPreset("custom");
    }
    if (slice.metroKey && slice.metroKey !== "__none__") setFilters((f) => ({ ...f, metro: slice.metroKey! }));
    if (slice.turf) setFilters((f) => ({ ...f, turf: { id: slice.turf!, label: name } }));
    if (slice.organiser) setFilters((f) => ({ ...f, organiser: { id: slice.organiser!, label: name } }));
    setDrawer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dateLabel = preset === "all" ? null
    : preset === "custom" ? (custom.from && custom.to ? (custom.from === custom.to ? custom.from : `${custom.from} → ${custom.to}`) : null)
    : PRESETS.find((p) => p.key === preset)?.label ?? null;
  const metroName = filters.metro ? metros.find((m) => m.slug === filters.metro)?.label || data?.filters.metroLabel || filters.metro : null;
  const chips: { key: string; text: string; clear: () => void }[] = [
    ...(dateLabel ? [{ key: "date", text: `Played: ${dateLabel}`, clear: () => setPreset("all") }] : []),
    ...(metroName ? [{ key: "metro", text: `City: ${metroName}`, clear: () => setFilters((f) => ({ ...f, metro: "" })) }] : []),
    ...(filters.turf ? [{ key: "turf", text: `Venue: ${filters.turf.label}`, clear: () => setFilters((f) => ({ ...f, turf: null })) }] : []),
    ...(filters.organiser ? [{ key: "org", text: `Organiser: ${filters.organiser.label}`, clear: () => setFilters((f) => ({ ...f, organiser: null })) }] : []),
  ];

  const view = chips.map((c) => c.text).join(" · ") || "All time";

  return (
    <>
      <div className={TOOLBAR}>
        <select className={FILTER_SELECT} value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Play date range">
          {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {preset === "custom" ? (
          <>
            <input type="date" className={FILTER_SELECT} value={custom.from} max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="Played from" />
            <input type="date" className={FILTER_SELECT} value={custom.to} min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="Played to" />
          </>
        ) : null}
        <select className={FILTER_SELECT} value={filters.metro} onChange={(e) => setFilters((f) => ({ ...f, metro: e.target.value }))} aria-label="City">
          <option value="">All cities</option>
          {metros.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" className={TOPBAR_BTN} onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <ExportButton
            label="Export to Excel"
            className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`}
            disabled={!data}
            onExport={async () => { if (data) await exportGamesWorkbook(data, view, pageQuery); }}
          />
        </div>
      </div>

      {chips.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Showing</span>
          {chips.map((c) => (
            <span key={c.key} className={CHIP}>
              {c.text}
              <button type="button" className={CHIP_X} onClick={c.clear} aria-label={`Remove ${c.text}`}>✕</button>
            </span>
          ))}
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent font-mono text-[12px] text-muted underline hover:text-fg"
            onClick={() => { setPreset("all"); setFilters({ metro: "", turf: null, organiser: null }); }}
          >
            Clear all
          </button>
        </div>
      ) : null}

      {customIncomplete ? <div className={LOADING_STATE}>Pick a start and end date.</div> : null}
      {error ? <div className={`${FORM_ERROR} mb-4`}>{error}</div> : null}
      {!data && loading ? <div className={LOADING_STATE}>Crunching the numbers…</div> : null}

      {data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <Conclusions data={data} onDrill={setDrawer} onPlayers={setPlayers} />
          <div className="mb-6"><Outcomes data={data} view={view} onDrill={setDrawer} /></div>
          <div className={STAT_LABEL}>The evidence</div>
          <GamesEvidence data={data} minGames={minGames} view={view}
            onDrill={setDrawer} onNarrow={onNarrow} onPlayers={setPlayers} />
        </div>
      ) : null}

      {drawer ? (
        <GameListDrawer
          key={JSON.stringify(drawer.slice) + pageQuery}
          request={drawer}
          pageQuery={pageQuery}
          view={view}
          underLine={data?.thresholds?.UNDER_FILL_PCT ?? 60}
          onClose={() => setDrawer(null)}
          onNarrow={onNarrow}
        />
      ) : null}

      {players ? (
        <PlayerListDrawer
          key={String(players.compare) + pageQuery}
          request={players}
          pageQuery={pageQuery}
          view={view}
          onClose={() => setPlayers(null)}
        />
      ) : null}
    </>
  );
}

// ── The hub ──────────────────────────────────────────────────────────────────

const TOPICS = [
  {
    key: "games",
    title: "Games",
    sub: "How football games are performing, by the day they are played.",
    Component: GamesAnalytics,
  },
  {
    key: "players",
    title: "Players",
    sub: "Signups, who actually plays, who comes back, ratings — and a full report on any one player.",
    Component: PlayersAnalytics,
  },
];

export function Analytics() {
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  return (
    <>
      <Head title="Analytics" sub="Open a topic — each starts with the verdict, then the numbers behind it." />
      <div className="flex flex-col gap-3">
        {TOPICS.map(({ key, title, sub, Component }) => (
          <details
            key={key}
            name="analytics-topic" // one topic open at a time — the browser closes the other
            className={`${PANEL} group p-0!`}
            onToggle={(e) => {
              if (e.currentTarget.open) setOpened((s) => (s.has(key) ? s : new Set(s).add(key)));
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-[rgba(255,255,255,0.03)] [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="font-mono text-[13px] text-muted transition-transform duration-150 group-open:rotate-90">▸</span>
              <span>
                <span className={`${PANEL_TITLE} mb-0! block`}>{title}</span>
                <span className="block text-[13px] text-muted">{sub}</span>
              </span>
            </summary>
            {opened.has(key) ? (
              <div className="border-t border-border px-5 pt-5 pb-1 max-[640px]:px-3">
                <Component />
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </>
  );
}
