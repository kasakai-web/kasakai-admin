"use client";

/* The Dashboard's turf list: every venue, what it has brought in, its average
   day and week since its first completed game, and what it took in over the
   last 30 days (GET /admin/revenue/turfs). What counts as income and how each
   figure is taken are decided on the server (backend/src/utils/revenueReport.js —
   `venueIncome`, `venueAverages`, `venueLastDays`): seat payments kept plus
   cancellation fees kept, on completed games; each complete day and Mon–Sun week
   since the first game is ADDED UP (quiet ones at ₹0) and those totals are
   averaged — never one day multiplied by 7 — and the last 30 days is a plain sum.
   Here it is only searched, sorted and exported. */

import { useMemo, useState } from "react";
import {
  PANEL, PANEL_TITLE, PANEL_SUB, TOOLBAR, SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP, TABLE,
  FORM_ERROR, LOADING_STATE, BADGE, BADGE_GRAY, BADGE_RED,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { ExportButton } from "../analytics/verdicts";
import { downloadSheets, type Sheet } from "../analytics/exportExcel";
import { dayDate } from "../analytics/range";
import { formatRupees } from "../finance/revenue";

type Venue = {
  id: string | null;
  name: string;
  metro: string | null;
  metroLabel: string | null;
  area: string | null;
  isActive: boolean;
  deleted: boolean;
  completedGames: number;
  receivedPaise: number;
  seatPaise: number;
  feePaise: number;
  avgPerGamePaise: number | null;
  firstDay: string | null;
  lastDay: string | null;
  /** Each null until the turf has one complete day / week. */
  average: { daily: Avg; weekly: Avg };
  /** The last 30 complete days, summed; from the first game when that is later. Null before a complete day. */
  lastDays: null | { paise: number; games: number; from: string; to: string; days: number; partial: boolean };
};

/** The average of `periods` complete days or weeks. */
type Avg = null | { paise: number; periods: number };

type VenueIncome = {
  generatedAt: string;
  today: string;
  lastDays: number;
  venues: Venue[];
  totals: { completedGames: number; receivedPaise: number };
};

type SortKey = "name" | "city" | "games" | "total" | "perGame" | "perDay" | "perWeek" | "last30" | "first" | "last";

const VALUE: Record<SortKey, (v: Venue) => string | number | null> = {
  name: (v) => v.name.toLowerCase(),
  city: (v) => (v.metroLabel || "").toLowerCase(),
  games: (v) => v.completedGames,
  total: (v) => v.receivedPaise,
  perGame: (v) => v.avgPerGamePaise,
  perDay: (v) => v.average.daily?.paise ?? null,
  perWeek: (v) => v.average.weekly?.paise ?? null,
  last30: (v) => v.lastDays?.paise ?? null,
  first: (v) => v.firstDay,
  last: (v) => v.lastDay,
};

const COLUMNS: { key: SortKey; label: string; title?: string; num?: boolean }[] = [
  { key: "name", label: "Turf" },
  { key: "city", label: "City" },
  { key: "games", label: "Games", title: "Completed games", num: true },
  { key: "total", label: "Total income", title: "Seat payments kept + cancellation fees kept, on completed games", num: true },
  { key: "perGame", label: "Avg / game", title: "Total income ÷ completed games", num: true },
  { key: "perDay", label: "Avg / day", title: "Income of every day since the first game, added up, ÷ the number of days (quiet days count, today does not)", num: true },
  { key: "perWeek", label: "Avg / week", title: "Each full Mon–Sun week's income added up, then averaged over the full weeks", num: true },
  { key: "last30", label: "Last 30 days", title: "Income of the last 30 complete days (up to yesterday), added up. A turf newer than that is summed from its first game", num: true },
  { key: "first", label: "First game" },
  { key: "last", label: "Last game" },
];

const dateText = (ymd: string | null) =>
  ymd ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(dayDate(ymd)) : "—";

const rs = (paise: number | null | undefined) => (paise == null ? null : Math.round(paise) / 100);

const NOUN = { daily: ["day", "days"], weekly: ["full week", "full weeks"] } as const;

/** One average cell: the amount, and underneath how many periods it is over. */
function AvgCell({ a, kind }: { a: Avg; kind: keyof typeof NOUN }) {
  if (!a) {
    return (
      <td className="text-right font-mono text-muted" title={`Not one ${NOUN[kind][0]} complete yet`}>—</td>
    );
  }
  return (
    <td className="text-right font-mono">
      {formatRupees(a.paise)}
      <div className="text-[11px] text-muted-2">{a.periods} {NOUN[kind][a.periods === 1 ? 0 : 1]}</div>
    </td>
  );
}

/** The last-30-days cell: the sum, and underneath its games — or, for a newer turf, where it starts. */
function LastDaysCell({ l }: { l: Venue["lastDays"] }) {
  if (!l) return <td className="text-right font-mono text-muted" title="Not one complete day yet">—</td>;
  const short = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  return (
    <td className="text-right font-mono" title={`${short.format(dayDate(l.from))} – ${short.format(dayDate(l.to))} · ${l.days} days · ${l.games} games`}>
      {formatRupees(l.paise)}
      <div className={`text-[11px] ${l.partial ? "text-warning" : "text-muted-2"}`}>
        {l.partial ? `since ${short.format(dayDate(l.from))} (${l.days} ${l.days === 1 ? "day" : "days"})` : `${l.games} ${l.games === 1 ? "game" : "games"}`}
      </div>
    </td>
  );
}

function venueSheet(d: VenueIncome, rows: Venue[], view: string): Sheet {
  return {
    name: "Turf income",
    notes: [
      `Income per turf — ${view}`,
      "Money players paid for seats they kept, plus cancellation fees kept, on completed games. Amounts in ₹.",
      `Averages: each day and Mon–Sun week since the turf's first completed game is added up (quiet ones at ₹0) and those totals are averaged. Only complete ones count, up to the day before ${dateText(d.today)}; blank = not one complete yet.`,
      `Last ${d.lastDays} days: the income of the ${d.lastDays} complete days up to yesterday, added up. A turf whose first game falls inside them is summed from that game ("From" is later and "Days" under ${d.lastDays}).`,
    ],
    columns: [
      { header: "Turf", key: "name", width: 34 },
      { header: "Area", key: "area", width: 20 },
      { header: "City", key: "city", width: 14 },
      { header: "Status", key: "status", width: 10 },
      { header: "Completed games", key: "games", width: 15 },
      { header: "Seat payments ₹", key: "seat", width: 15 },
      { header: "Fees kept ₹", key: "fees", width: 12 },
      { header: "Total income ₹", key: "total", width: 15 },
      { header: "Avg per game ₹", key: "perGame", width: 15 },
      { header: "Days counted", key: "days", width: 13 },
      { header: "Avg per day ₹", key: "perDay", width: 14 },
      { header: "Full weeks", key: "weeks", width: 11 },
      { header: "Avg per week ₹", key: "perWeek", width: 15 },
      { header: `Last ${d.lastDays} days ₹`, key: "last30", width: 15 },
      { header: `Last ${d.lastDays} days games`, key: "last30Games", width: 18 },
      { header: `Last ${d.lastDays} days from`, key: "last30From", width: 17 },
      { header: `Last ${d.lastDays} days to`, key: "last30To", width: 15 },
      { header: `Last ${d.lastDays} days: days`, key: "last30Days", width: 17 },
      { header: "First game", key: "first", width: 13 },
      { header: "Last game", key: "last", width: 13 },
    ],
    rows: rows.map((v) => ({
      name: v.name,
      area: v.area,
      city: v.metroLabel,
      status: v.deleted ? "Deleted" : v.isActive ? "Active" : "Inactive",
      games: v.completedGames,
      seat: rs(v.seatPaise),
      fees: rs(v.feePaise),
      total: rs(v.receivedPaise),
      perGame: rs(v.avgPerGamePaise),
      days: v.average.daily?.periods ?? null,
      perDay: rs(v.average.daily?.paise),
      weeks: v.average.weekly?.periods ?? null,
      perWeek: rs(v.average.weekly?.paise),
      last30: rs(v.lastDays?.paise),
      last30Games: v.lastDays?.games ?? null,
      last30From: v.lastDays?.from ?? null,
      last30To: v.lastDays?.to ?? null,
      last30Days: v.lastDays?.days ?? null,
      first: v.firstDay,
      last: v.lastDay,
    })),
  };
}

export function TurfIncome() {
  const { data, loading, error } = useAdminFetch<{ data?: VenueIncome }>("/admin/revenue/turfs", {
    cache: true,
    errorMessage: "Failed to load turf income.",
  });
  const d = data?.data ?? null;

  const [query, setQuery] = useState("");
  const [metro, setMetro] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "total", desc: true });

  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of d?.venues || []) if (v.metro) seen.set(v.metro, v.metroLabel || v.metro);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [d]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (d?.venues || []).filter((v) =>
      (!metro || v.metro === metro) &&
      (!q || [v.name, v.area, v.metroLabel].some((s) => s?.toLowerCase().includes(q))));
    const get = VALUE[sort.key];
    // Blanks (no games yet) always sink, whichever way the column is sorted.
    return [...list].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [d, query, metro, sort]);

  const shown = rows.reduce((t, v) => ({ games: t.games + v.completedGames, paise: t.paise + v.receivedPaise }), { games: 0, paise: 0 });
  const played = (d?.venues || []).filter((v) => v.completedGames > 0).length;
  const view = [metro ? cities.find(([k]) => k === metro)?.[1] : "All cities", query.trim() ? `"${query.trim()}"` : null].filter(Boolean).join(" · ");

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !["name", "city"].includes(key) }));

  return (
    <section className={`${PANEL} mb-6`} aria-label="Turf income">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={PANEL_TITLE}>Turf income</div>
          <div className={PANEL_SUB}>
            Every turf: seat payments kept + cancellation fees kept, on completed games. For the averages, each
            day and Mon–Sun week since the turf&apos;s first game is added up (quiet ones at ₹0) and those totals are
            averaged; only complete ones count, so a turf with no full week yet shows —. Last 30 days is the income of
            the 30 complete days up to yesterday, added up; a newer turf shows the date it starts from.
          </div>
        </div>
        <ExportButton
          disabled={!d || rows.length === 0}
          onExport={async () => { if (d) await downloadSheets("kasakai-turf-income", [venueSheet(d, rows, view)]); }}
        />
      </div>

      <div className={TOOLBAR}>
        <input
          className={SEARCH_INPUT}
          placeholder="Search turf, area or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search turfs"
        />
        <select className={FILTER_SELECT} value={metro} onChange={(e) => setMetro(e.target.value)} aria-label="City">
          <option value="">All cities</option>
          {cities.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {error ? <div className={FORM_ERROR}>{error}</div> : null}

      {!d && loading ? (
        <div className={LOADING_STATE}>Loading turfs…</div>
      ) : d ? (
        <>
          <div className="mb-2 font-mono text-[12px] text-muted">
            {rows.length} of {d.venues.length} turfs · {played} have hosted a completed game · showing{" "}
            <b className="font-medium text-fg">{formatRupees(shown.paise)}</b> from {shown.games.toLocaleString("en-IN")} games
          </div>
          <div className={`${TABLE_WRAP} max-h-[560px] overflow-y-auto`}>
            <table className={TABLE}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.title} aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"} className={c.num ? "text-right!" : ""}>
                      <button type="button" className="cursor-pointer uppercase tracking-[inherit]" onClick={() => onSort(c.key)}>
                        {c.label}{sort.key === c.key ? (sort.desc ? " ▼" : " ▲") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="text-center text-muted">No turf matches.</td></tr>
                ) : rows.map((v) => (
                  <tr key={v.id ?? "deleted"}>
                    <td>
                      <div className="text-fg">
                        {v.name}{" "}
                        {v.deleted ? <span className={`${BADGE} ${BADGE_RED}`}>Deleted</span>
                          : !v.isActive ? <span className={`${BADGE} ${BADGE_GRAY}`}>Inactive</span> : null}
                      </div>
                      {v.area ? <div className="font-mono text-[11.5px] text-muted-2">{v.area}</div> : null}
                    </td>
                    <td>{v.metroLabel || "—"}</td>
                    <td className="text-right font-mono">{v.completedGames}</td>
                    <td className="text-right font-mono text-fg">{formatRupees(v.receivedPaise)}</td>
                    <td className="text-right font-mono">{formatRupees(v.avgPerGamePaise)}</td>
                    <AvgCell a={v.average.daily} kind="daily" />
                    <AvgCell a={v.average.weekly} kind="weekly" />
                    <LastDaysCell l={v.lastDays} />
                    <td className="whitespace-nowrap font-mono text-[13px]">{v.firstDay ? dateText(v.firstDay) : "No games yet"}</td>
                    <td className="whitespace-nowrap font-mono text-[13px]">{dateText(v.lastDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
