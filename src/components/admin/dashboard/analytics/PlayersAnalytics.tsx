"use client";

/* Analytics → Players. Two views behind one search box:

   • nobody picked — how the player base is doing over the chosen date range
     (the Games presets, past-only): the verdict from utils/playerInsights.js,
     then signups, new players, first-timers per week, activation, ratings and
     the most active players as evidence;
   • a player picked — their full report (PlayerReport).

   Every number that counts people opens them: a verdict card, a KPI, a
   finding's "Show players" and a month bar open PlayerBaseDrawer; the New
   players block shows its list inline. Every name opens that player's report.
   The range lives in the topic, not the overview, so it survives a visit to a
   report. Each block exports itself to Excel; the toolbar exports the lot. */

import { useEffect, useState } from "react";
import {
  STATS_GRID, TWO_COL, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, SEARCH_INPUT, TOPBAR_BTN, TOPBAR_BTN_PRIMARY, ACTION_BTN,
  TOOLBAR, FILTER_SELECT,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { Avatar } from "../shared/components";
import { formatCurrency, formatDate, daysAgoLabel } from "../shared/format";
import { Columns, MetricSwitch, SERIES, monthLabel, pctText } from "./charts";
import { Verdict, Kpi, Block, ExportButton } from "./verdicts";
import { PlayerReport } from "./PlayerReport";
import { PlayerBaseDrawer, PlayerBaseList, type PlayerListAsk } from "./PlayerBaseList";
import { downloadSheets, exportPlayersWorkbook, playerSheets } from "./exportExcel";
import { PAST_PRESETS, presetRange, rangeQuery, type Preset } from "./range";
import type { ApiResponse, PlayerListKind, PlayerSection, PlayersOverview } from "./types";

const SECTION_ID: Record<PlayerSection, string> = { signups: "pl-monthly", ratings: "pl-ratings", top: "pl-top", weekly: "pl-weekly" };

/** The players each verdict card counted. */
const AREA_LIST: Record<string, (d: PlayersOverview) => PlayerListAsk> = {
  signups: (d) => ({ kind: "signups", label: `Signups · ${d.window.recentLabel}` }),
  activation: () => ({ kind: "activation", label: "Activation — verified, joined 14+ days ago" }),
  retention: () => ({ kind: "retention", label: "Second game — first game 30+ days ago" }),
  active: (d) => ({ kind: "active", label: `Active players · ${d.window.recentLabel}` }),
  ratings: () => ({ kind: "rated", label: "Rated players — lowest conduct first" }),
};
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** "2026-09-28" (a Monday) → "28 Sep". */
const weekLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

const daysSinceIso = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const stars = (v: number | null) => (v == null ? "—" : `★ ${v.toFixed(1)}`);

// ── Search ───────────────────────────────────────────────────────────────────

type PickRow = { id: string; name: string; phone: string; profileImage?: string | null; gamesPlayed?: number };

function PlayerPicker({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading } = useAdminFetch<{ data?: PickRow[] }>(
    term.length >= 2 ? `/admin/users?search=${encodeURIComponent(term)}&limit=8` : null,
    { errorMessage: "Search failed." },
  );
  const rows = data?.data ?? [];
  const open = term.length >= 2 && q.trim().length >= 2;

  return (
    <div className="relative mb-5">
      <input
        type="search"
        className={`${SEARCH_INPUT} w-full`}
        placeholder="Look up a player — name, phone or email"
        aria-label="Look up a player"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {open ? (
        <ul className="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-[340px] list-none overflow-y-auto border border-border-2 bg-surface p-0 shadow-lg">
          {loading ? <li className="px-4 py-3 text-[13px] text-muted">Searching…</li> : null}
          {!loading && !rows.length ? <li className="px-4 py-3 text-[13px] text-muted">No players match “{term}”.</li> : null}
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-2 text-left hover:bg-surface-2"
                onClick={() => { onPick(r.id); setQ(""); setTerm(""); }}
              >
                <Avatar name={r.name} src={r.profileImage} size={28} />
                <span className="flex-1 text-[14px] text-fg">{r.name}</span>
                <span className="font-mono text-[12px] text-muted">{r.phone}</span>
                <span className="w-[70px] text-right font-mono text-[12px] text-muted">{r.gamesPlayed ?? 0} games</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── New players ──────────────────────────────────────────────────────────────

type NewWindow = "today" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth";
const NEW_WINDOWS: { key: NewWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This week" },
  { key: "lastWeek", label: "Last week" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];
type NewTab = Extract<PlayerListKind, "accounts" | "firstGame">;

/* Its own window, independent of the page's range. */
function NewPlayers({ onPlayer }: { onPlayer: (id: string) => void }) {
  const [win, setWin] = useState<NewWindow>("thisWeek");
  const [tab, setTab] = useState<NewTab>("accounts");
  const r = presetRange(win);
  const rq = rangeQuery(r).toString();
  const when = `${NEW_WINDOWS.find((w) => w.key === win)!.label} (${r.from === r.to ? r.from : `${r.from} → ${r.to}`})`;

  return (
    <Block
      id="pl-new"
      title="New players"
      sub="Signed up = opened an account in the window, with their first game if they have played one. First game = played their first ever game in the window, whenever they joined. Weeks run Monday to Sunday (IST)."
      action={
        <div className="flex flex-wrap gap-2">
          <MetricSwitch<NewTab>
            label="Which new players"
            value={tab}
            onChange={setTab}
            options={[{ key: "accounts", label: "Signed up" }, { key: "firstGame", label: "First game" }]}
          />
          <MetricSwitch<NewWindow> label="When" value={win} onChange={setWin} options={NEW_WINDOWS} />
        </div>
      }
    >
      <div className="max-h-[520px] overflow-y-auto pr-1">
        <PlayerBaseList
          key={tab + rq}
          ask={{ kind: tab, label: `${tab === "accounts" ? "Signed up" : "First game"} · ${when}` }}
          rangeQuery={rq}
          onPlayer={onPlayer}
        />
      </div>
    </Block>
  );
}

// ── The player base ──────────────────────────────────────────────────────────

type MonthMetric = "signups" | "firstGames" | "active";
const MONTH_METRIC: Record<MonthMetric, { label: string; unit: string; color: string; kind: PlayerListKind }> = {
  signups: { label: "Signups", unit: "signups", color: SERIES.healthy, kind: "monthSignups" },
  firstGames: { label: "First game", unit: "new players", color: SERIES.upcoming, kind: "monthFirst" },
  active: { label: "Active players", unit: "players", color: SERIES.auto, kind: "monthActive" },
};

type Range = { preset: Preset; custom: { from: string; to: string } };

function Overview({ range, setRange, onPlayer }: {
  range: Range; setRange: (r: Range) => void; onPlayer: (id: string) => void;
}) {
  const r = presetRange(range.preset, range.custom);
  const customIncomplete = range.preset === "custom" && (!r.from || !r.to || r.from > r.to);
  const rq = rangeQuery(r).toString();
  const { data: res, loading, error, refresh } = useAdminFetch<ApiResponse<PlayersOverview>>(
    customIncomplete ? null : `/admin/analytics/players${rq ? `?${rq}` : ""}`,
    { cache: true, errorMessage: "Failed to load player analytics." },
  );
  const [metric, setMetric] = useState<MonthMetric>("signups");
  const [week, setWeek] = useState<number | null>(null);
  const [list, setList] = useState<PlayerListAsk | null>(null);
  const d = res?.data;

  const toolbar = (
    <div className={TOOLBAR}>
      <select className={FILTER_SELECT} value={range.preset} onChange={(e) => setRange({ ...range, preset: e.target.value as Preset })} aria-label="Date range">
        {PAST_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {range.preset === "custom" ? (
        <>
          <input type="date" className={FILTER_SELECT} value={range.custom.from} max={range.custom.to || undefined}
            onChange={(e) => setRange({ ...range, custom: { ...range.custom, from: e.target.value } })} aria-label="From" />
          <input type="date" className={FILTER_SELECT} value={range.custom.to} min={range.custom.from || undefined}
            onChange={(e) => setRange({ ...range, custom: { ...range.custom, to: e.target.value } })} aria-label="To" />
        </>
      ) : null}
      <div className="ml-auto flex gap-2">
        <button type="button" className={TOPBAR_BTN} onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        <ExportButton label="Export to Excel" className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} disabled={!d} onExport={async () => { if (d) await exportPlayersWorkbook(d); }} />
      </div>
    </div>
  );

  if (customIncomplete) return <>{toolbar}<div className={LOADING_STATE}>Pick a start and end date.</div></>;
  if (error) return <>{toolbar}<div className={FORM_ERROR}>{error}</div></>;
  if (!d) return <>{toolbar}<div className={LOADING_STATE}>Crunching the numbers…</div></>;

  const t = d.totals;
  const w = d.window;
  const ranged = !!w.from;
  const multiYear = new Set(d.monthly.map((m) => m.month.slice(0, 4))).size > 1;
  const latest = d.weekly.at(-1);
  const before = d.weekly.at(-2);
  const picked = week == null ? null : d.weekly[week];

  return (
    <>
      {toolbar}
      <div className={loading ? "opacity-60 transition-opacity" : ""}>
        <Verdict
          label="How the player base is doing"
          conclusions={d.conclusions}
          footnote={<>
            Trends compare {w.recentLabel} with {w.priorLabel} · updated{" "}
            {new Date(d.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
            {" · "}click a card for its players
          </>}
          findingsSub="Worst first. Small groups are never judged. “Show players” lists everyone a finding is about; click a name to open that player."
          onPlayer={onPlayer}
          areaHint="See the players →"
          onArea={(key) => AREA_LIST[key] && setList(AREA_LIST[key](d))}
          actions={(i) => (
            <>
              {i.playerList ? (
                <button type="button" className={ACTION_BTN} onClick={() => setList({ ...i.playerList!, label: i.title })}>
                  Show players
                </button>
              ) : null}
              <button type="button" className={ACTION_BTN} onClick={() => scrollToId(SECTION_ID[i.section])}>
                See evidence ↓
              </button>
            </>
          )}
        />

        <div className="flex flex-col gap-5 pb-4">
          <div className={STATS_GRID + " mb-0!"}>
            <Kpi
              label={ranged ? "Joined" : "Players"}
              value={t.players}
              sub={`${t.verified} verified · ${t.players - t.verified} never finished signup`}
              onClick={() => setList({ kind: "accounts", label: ranged ? "Joined in this view" : "Every account" })}
              hint="List them"
            />
            <Kpi
              label="Have played"
              value={pctText(t.playedPct)}
              sub={`${t.played} players · ${pctText(t.activationPct)} of those who joined 14+ days ago`}
              onClick={() => setList({ kind: "accounts", tag: "Played", label: ranged ? "Joined in this view and have played" : "Accounts that have played" })}
              hint="List them"
            />
            <Kpi
              label={`Active · ${w.figureLabel}`}
              value={t.active30}
              sub={`${t.activePrior30} in ${w.priorLabel}`}
              onClick={() => setList(AREA_LIST.active(d))}
              hint="List them"
            />
            <Kpi
              label="2nd game ≤ 30 days"
              value={pctText(t.secondIn30Pct)}
              sub={`Of ${t.repeatBase} whose first game was 30+ days ago · ever came back: ${pctText(t.repeatPct)}`}
              onClick={() => setList(AREA_LIST.retention(d))}
              hint="List them"
            />
            <Kpi
              label={`Signups · ${w.figureLabel}`}
              value={t.signups30}
              sub={`${t.signupsPrior30} in ${w.priorLabel}`}
              onClick={() => setList(AREA_LIST.signups(d))}
              hint="List them"
            />
            <Kpi label="To first game" value={t.medianDaysToFirstGame == null ? "—" : `${Math.round(t.medianDaysToFirstGame)}d`}
              sub={`Median days from signup${ranged ? ", first games in this view" : ""}`} />
            <Kpi
              label="Ratings"
              value={stars(t.avgConduct)}
              sub={`Conduct · gameplay ${stars(t.avgGameplay)} · ${t.rated} rated`}
              onClick={() => setList(AREA_LIST.ratings(d))}
              hint="List them"
            />
            <Kpi label="Topped up" value={pctText(t.payersPct)} sub={`${t.payers} players · ${formatCurrency(t.topUpPaise)} ${ranged ? "in this view" : "all time"}`} />
          </div>

          <NewPlayers onPlayer={onPlayer} />

          <Block
            id="pl-monthly"
            title="Month by month"
            sub={`${ranged ? "The months of this view" : "Last 12 months"}, IST. Click a bar for the players behind it.`}
            onExport={() => downloadSheets("kasakai-players-by-month", [playerSheets.monthly(d)])}
            action={
              <MetricSwitch<MonthMetric>
                label="Monthly metric"
                value={metric}
                onChange={setMetric}
                options={(Object.keys(MONTH_METRIC) as MonthMetric[]).map((k) => ({ key: k, label: MONTH_METRIC[k].label }))}
              />
            }
          >
            <Columns
              unit={MONTH_METRIC[metric].unit}
              onSelect={(i) => setList({
                kind: MONTH_METRIC[metric].kind,
                month: d.monthly[i].month,
                label: `${MONTH_METRIC[metric].label} · ${monthLabel(d.monthly[i].month, true)}`,
              })}
              rows={d.monthly.map((m) => ({
                label: multiYear ? `${monthLabel(m.month)} ${m.month.slice(2, 4)}` : monthLabel(m.month),
                value: m[metric],
                color: MONTH_METRIC[metric].color,
              }))}
            />
            <p className="mt-3 mb-0 max-w-[900px] text-[12.5px] leading-[1.55] text-muted">
              <b className="text-body">Signups</b> — accounts opened that month.{" "}
              <b className="text-body">First game</b> — players whose first ever game was that month.{" "}
              <b className="text-body">Active players</b> — everyone who actually played that month: at least one completed game,
              in their own seat (the guests they bring are not counted), not marked absent or no-show by the organiser. A player counts
              once per month however many games they played, so a regular appears in every month they played and a booking for a
              game not yet played does not count.
            </p>
          </Block>

          <Block
            id="pl-weekly"
            title="First-time players per week"
            sub={`${latest?.current
              ? `${latest.firstGames} this week · ${before?.firstGames ?? 0} last week · last 12 weeks`
              : `The 12 weeks to the week of ${latest ? weekLabel(latest.week) : "—"}`}, Monday to Sunday (IST). Click a week to see who they were.`}
            onExport={() => downloadSheets("kasakai-first-timers", [playerSheets.weekly(d)])}
          >
            <Columns
              unit="first-timers"
              selected={week}
              onSelect={(i) => setWeek((x) => (x === i ? null : i))}
              rows={d.weekly.map((wk) => ({
                label: wk.current ? "This wk" : weekLabel(wk.week),
                value: wk.firstGames,
                color: SERIES.upcoming,
                note: `Week of ${weekLabel(wk.week)}`,
              }))}
            />
            {picked ? (
              <div className="mt-4 border-t border-border-2 pt-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] text-body">
                    <span className="font-semibold text-fg">{picked.firstGames}</span> played their first game in the week of {weekLabel(picked.week)}
                    {" · "}
                    {picked.players.filter((p) => p.games > 1).length} of the {picked.players.length} listed have played again
                  </span>
                  <button type="button" className={ACTION_BTN} onClick={() => setWeek(null)}>Close</button>
                </div>
                <div className="flex flex-wrap gap-[6px]">
                  {picked.players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPlayer(p.id)}
                      title={p.games > 1 ? `Has played ${p.games} games` : "Has not played a second game yet"}
                      className="cursor-pointer rounded-full border border-border-2 bg-surface-2 px-3 py-[2px] font-mono text-[12px] text-body hover:border-fg hover:text-fg"
                    >
                      {p.name}
                      <span className={p.games > 1 ? "text-success" : "text-muted-2"}> · {p.games}</span>
                    </button>
                  ))}
                  {picked.firstGames > picked.players.length ? (
                    <span className="self-center font-mono text-[11.5px] text-muted">…and {picked.firstGames - picked.players.length} more</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Block>

          <div className={TWO_COL + " mb-0!"}>
            <Block title="Games played per player"
              sub={ranged ? "Accounts that existed by the end of this view, by games played in it." : "Every account, by games actually played."}
              onExport={() => downloadSheets("kasakai-games-per-player", [playerSheets.gamesDistribution(d)])}>
              <Columns unit="players" rows={d.gamesDistribution.map((b) => ({ label: b.label, value: b.players, color: b.key === "0" ? SERIES.neutral : SERIES.healthy }))} />
            </Block>
            <Block id="pl-ratings" title="Gameplay ratings"
              sub="Each rated player's average across the organisers who rated them. A standing rating — the date range does not change it."
              onExport={() => downloadSheets("kasakai-gameplay-ratings", [playerSheets.ratings(d)])}>
              <Columns unit="players" rows={d.ratingDistribution.map((b) => ({ label: b.label, value: b.players, color: b.key === "1" ? SERIES.under : SERIES.healthy }))} />
            </Block>
          </div>

          <Block id="pl-top" title="Most active players" sub={`Top 50 by games played${ranged ? " in this view" : ""}. Click a row for the full report.`}
            onExport={() => downloadSheets("kasakai-most-active-players", [playerSheets.top(d)])}>
            {d.topPlayers.length === 0 ? <div className={LOADING_STATE}>Nobody played a game{ranged ? " in this view" : " yet"}.</div> : (
              <div className={`${TABLE_WRAP} max-h-[420px]`}>
                <table className={TABLE}>
                  <thead>
                    <tr><th>Player</th><th>Games</th><th>Last played</th><th>Joined</th><th>Conduct</th><th>Gameplay</th><th>Topped up</th></tr>
                  </thead>
                  <tbody>
                    {d.topPlayers.map((p) => (
                      <tr key={p.id} className="cursor-pointer" onClick={() => onPlayer(p.id)} title="Open the full report">
                        <td>
                          <span className="flex items-center gap-2">
                            <Avatar name={p.name} src={p.profileImage} size={26} />
                            <span className="font-medium">{p.name}</span>
                          </span>
                        </td>
                        <td className="font-mono">{p.games}</td>
                        <td className="font-mono">{daysAgoLabel(daysSinceIso(p.lastPlayedAt))}</td>
                        <td className="font-mono">{formatDate(p.joinedAt)}</td>
                        <td className="font-mono">{stars(p.conduct)}</td>
                        <td className="font-mono">{stars(p.gameplay)}</td>
                        <td className="font-mono">{formatCurrency(p.topUpPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Block>
        </div>
      </div>

      {list ? (
        <PlayerBaseDrawer
          key={JSON.stringify(list) + rq}
          ask={list}
          rangeQuery={rq}
          onPlayer={onPlayer}
          onClose={() => setList(null)}
        />
      ) : null}
    </>
  );
}

// ── Topic ────────────────────────────────────────────────────────────────────

export function PlayersAnalytics() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>({ preset: "all", custom: { from: "", to: "" } });
  return (
    <>
      <PlayerPicker onPick={setPlayerId} />
      {playerId ? (
        <>
          <button type="button" className={`${TOPBAR_BTN} mb-4`} onClick={() => setPlayerId(null)}>← All players</button>
          <PlayerReport key={playerId} id={playerId} />
        </>
      ) : (
        <Overview range={range} setRange={setRange} onPlayer={setPlayerId} />
      )}
    </>
  );
}
