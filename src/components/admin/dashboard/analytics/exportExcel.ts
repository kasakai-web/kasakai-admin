/* Excel exports for the Analytics topics.

   One workbook writer (downloadSheets) and one builder per block, so a block's
   own Export button and its topic's "Export to Excel" write the same sheet and
   cannot disagree. exceljs is imported on demand — it is large and only an
   export needs it (same as screening/AnalyticsPage.tsx). Lists of games and
   players are fetched whole from the endpoints the drawers page through.
   No average fill appears anywhere: how games went is COUNTED (struggled, out of
   the games played or cancelled) and fill is summarised by the median. */

import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "../shared/api";
import type {
  AnalyticsData, BreakdownRow, Conclusions, DrillResponse, DrillRow, PlayerReportData, PlayersOverview,
  UniquePlayer, UniquePlayersData,
} from "./types";

// ── The writer ───────────────────────────────────────────────────────────────

export type Sheet = {
  name: string;
  /** Lines above the table; the first is bold. Say what it is and which view. */
  notes?: string[];
  columns: { header: string; key: string; width?: number }[];
  rows: object[];
};

/** One workbook, a worksheet per sheet, downloaded as `<file>-<today>.xlsx`. */
export async function downloadSheets(file: string, sheets: Sheet[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kasa Kai Admin";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31)); // Excel's limit
    s.notes?.forEach((line, i) => {
      ws.addRow([line]).font = { bold: i === 0 };
    });
    if (s.notes?.length) ws.addRow([]);
    const head = ws.addRow(s.columns.map((c) => c.header));
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1F17" } };
    ws.views = [{ state: "frozen", ySplit: head.number }];
    s.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width ?? 14;
    });
    for (const r of s.rows) ws.addRow(s.columns.map((c) => (r as Record<string, unknown>)[c.key] ?? null));
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Fetching whole lists ─────────────────────────────────────────────────────

async function adminGet<T>(path: string): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin session missing.");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data) throw new Error(body.message || "Could not load the data to export.");
  return body.data as T;
}

const MAX_GAME_ROWS = 2000; // 40 drill-down pages

export type GameList = { rows: DrillRow[]; total: number };

/** Every game in a slice, worst first, from the endpoint the games drawer pages through. */
export async function fetchSliceGames(query: URLSearchParams): Promise<GameList> {
  const rows: DrillRow[] = [];
  let total = 0;
  for (let page = 1; rows.length < MAX_GAME_ROWS; page++) {
    const q = new URLSearchParams(query);
    q.set("page", String(page));
    const d = await adminGet<NonNullable<DrillResponse["data"]>>(`/admin/analytics/games?${q}`);
    rows.push(...d.rows);
    total = d.total;
    if (page >= d.pages) break;
  }
  return { rows: rows.slice(0, MAX_GAME_ROWS), total };
}

/** The unique players of the page's view, or of the two windows its trends compare. */
export function fetchUniquePlayers(pageQuery: string, compare: boolean) {
  const q = new URLSearchParams(pageQuery);
  if (compare) q.set("scope", "compare");
  return adminGet<UniquePlayersData>(`/admin/analytics/unique-players?${q}`);
}

// ── Shared pieces ────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<string, string> = {
  good: "Good", watch: "Watch", concern: "Concern", insufficient: "Not enough data", info: "Info",
};
const TAG_TEXT: Record<string, string> = { new: "New", returning: "Returning", stopped: "Stopped coming" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, JS weekday values
const DAY_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PARTS = ["morning", "afternoon", "evening", "night"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const istDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "";
const istDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }) : "";
const rupees = (paise: number | null | undefined) => (paise == null ? null : paise / 100);
const generated = (iso: string) => `Generated ${istDateTime(iso)} IST`;

/** A two-column Field / Value sheet. */
const kv = (name: string, notes: string[], pairs: [string, unknown][]): Sheet => ({
  name,
  notes,
  columns: [{ header: "Field", key: "field", width: 34 }, { header: "Value", key: "value", width: 30 }],
  rows: pairs.map(([field, value]) => ({ field, value })),
});

/** Headline, area verdicts and findings — any topic's conclusions. */
function conclusionsSheet(c: Conclusions<string>, notes: string[]): Sheet {
  return {
    name: "Conclusions",
    notes: [...notes, `Headline: ${c.headline}`],
    columns: [
      { header: "Kind", key: "kind", width: 10 },
      { header: "Title", key: "title", width: 46 },
      { header: "Status", key: "status", width: 16 },
      { header: "Key figure", key: "figure", width: 24 },
      { header: "Detail", key: "detail", width: 100 },
    ],
    rows: [
      ...c.areas.map((a) => ({
        kind: "Area",
        title: a.title,
        status: STATUS_TEXT[a.status],
        figure: a.figure == null ? "" : `${a.figure}${a.figureUnit ?? ""} ${a.figureLabel ?? ""}`.trim(),
        detail: a.summary,
      })),
      ...c.insights.map((i) => ({ kind: "Finding", title: i.title, status: STATUS_TEXT[i.severity], figure: "", detail: i.detail })),
    ],
  };
}

// ── Games ────────────────────────────────────────────────────────────────────

/** A games sheet's context: the response, and the view it was drawn for ("City: Mumbai · …"). */
export type GamesView = { data: AnalyticsData; view: string };

const fillLine = (d: AnalyticsData) => d.thresholds?.UNDER_FILL_PCT ?? 60;
const struggledNote = (d: AnalyticsData) =>
  `Struggled = played under ${fillLine(d)}% full, or cancelled (automatically or by the organiser), out of the games played or cancelled. ` +
  "Median fill = the typical game among those played or auto-cancelled (at the seats it held); an organiser-cancelled game has no fill.";
const gameNotes = (title: string, { data, view }: GamesView, ...more: string[]) =>
  [`${title} — ${view}`, `${generated(data.generatedAt)} · dates are play dates (kick-off, IST)`, ...more];

const breakdownColumns = (d: AnalyticsData) => [
  { header: "Games", key: "games", width: 9 },
  { header: "Upcoming", key: "upcoming", width: 10 },
  { header: "Played or cancelled", key: "judged", width: 19 },
  { header: "Struggled", key: "underCount", width: 11 },
  { header: "Struggled %", key: "underPct", width: 12 },
  { header: `Played under ${fillLine(d)}%`, key: "underCompleted", width: 17 },
  { header: "Cancelled", key: "cancelled", width: 11 },
  { header: "Auto-cancelled", key: "autoCancelled", width: 15 },
  { header: "Cancelled %", key: "cancellationRatePct", width: 12 },
  { header: "Games with a fill", key: "filled", width: 17 },
  { header: "Median fill %", key: "medianFillPct", width: 14 },
  { header: "P25 fill %", key: "p25FillPct", width: 11 },
  { header: "Seats sold (played)", key: "seatsFilled", width: 18 },
  { header: "Waitlist joins", key: "waitlistEntries", width: 14 },
];

function outcomeOf(g: DrillRow, line: number) {
  if (g.autoCancelled) return "Auto-cancelled";
  if (g.status === "cancelled") return "Cancelled by organiser";
  if (g.atRisk) return "Below minimum";
  if (g.under) return `Played under ${line}% full`;
  if (g.status === "completed") return "Healthy";
  if (g.upcoming) return "Upcoming";
  return g.status;
}

const TAG_NOTE: Record<"recent" | "prior", (label: string) => string> = {
  recent: (label) => `New = did not play in ${label}; Returning = played in both.`,
  prior: () => "Returning = also played in the recent period; Stopped coming = did not.",
};

export const gameSheets = {
  conclusions: (v: GamesView) =>
    conclusionsSheet(v.data.conclusions, gameNotes("Games — conclusions", v,
      v.data.comparison.none
        ? "Upcoming view — nothing earlier to compare."
        : `Trends compare ${v.data.comparison.recentLabel} with ${v.data.comparison.label}.`,
      struggledNote(v.data))),

  keyNumbers: (v: GamesView): Sheet => {
    const { totals: t, fill: f, upcoming: u } = v.data.games;
    return kv("Key numbers", gameNotes("Games — key numbers", v, struggledNote(v.data)), [
      ["Games (drafts excluded)", t.nonDraft],
      ["Played", t.completed],
      ["Still to play", t.upcoming],
      ["Drafts", t.byStatus.draft || 0],
      ["Cancelled", t.cancelled],
      ["…automatically (too few players)", t.autoCancelled],
      ["…by the organiser", Math.max(0, t.cancelled - t.autoCancelled)],
      ["Cancelled % (of played or cancelled)", t.cancellationRatePct],
      ["Played or cancelled", f.judged],
      ["Struggled", f.underCount],
      ["Struggled %", f.underPct],
      [`Played under ${fillLine(v.data)}% full`, f.underCompleted],
      ["Games with a fill (played or auto-cancelled)", f.filled],
      ["Median fill % at the end", f.medianFillPct],
      ["Median fill % 24h before kick-off", f.medianFill24Pct],
      ["Games that existed 24h before kick-off", f.judged24],
      ["Full games (played)", f.fullGames],
      ["Unique players (own seats, guests excluded)", t.uniquePlayers],
      ["Seats sold (played games)", t.seatsFilled],
      ["Upcoming below their minimum", u.atRisk],
      ["…kicking off within 7 days", u.atRiskSoon],
    ]);
  },

  daily: (v: GamesView): Sheet => ({
    name: "By play day",
    notes: gameNotes("Games per play day", v,
      ...(v.data.games.daily.capped ? [`The ${v.data.games.daily.days.length} days the chart shows.`] : [])),
    columns: [
      { header: "Day", key: "day", width: 12 },
      { header: "Games", key: "games", width: 9 },
      { header: "Played", key: "completed", width: 9 },
      { header: "Cancelled", key: "cancelled", width: 11 },
      { header: "Auto-cancelled", key: "autoCancelled", width: 15 },
      { header: `Played under ${fillLine(v.data)}%`, key: "underCompleted", width: 17 },
      { header: "Seats sold", key: "seatsSold", width: 11 },
    ],
    rows: v.data.games.daily.days,
  }),

  monthly: (v: GamesView): Sheet => ({
    name: "By play month",
    notes: gameNotes("Games by play month", v, struggledNote(v.data)),
    columns: [{ header: "Month", key: "month", width: 10 }, ...breakdownColumns(v.data)],
    rows: v.data.games.monthly,
  }),

  fill: (v: GamesView): Sheet => {
    const f = v.data.games.fill;
    const at24 = new Map(f.buckets24.map((b) => [b.key, b.games]));
    return {
      name: "How full",
      notes: gameNotes("How full games finished", v,
        `24h before = the ${f.judged24} games that existed a day before kick-off, as they stood then.`),
      columns: [
        { header: "Bucket", key: "label", width: 24 },
        { header: "Games at the end", key: "games", width: 16 },
        { header: "Counts as struggled", key: "struggled", width: 19 },
        { header: "Games 24h before", key: "at24", width: 17 },
      ],
      rows: f.buckets.map((b) => ({ label: b.label, games: b.games, struggled: b.under ? "Yes" : "No", at24: at24.get(b.key) ?? null })),
    };
  },

  outcomes: (v: GamesView): Sheet => ({
    name: "Outcomes",
    notes: gameNotes("Games by status", v),
    columns: [{ header: "Status", key: "status", width: 14 }, { header: "Games", key: "n", width: 10 }],
    rows: Object.entries(v.data.games.totals.byStatus).map(([status, n]) => ({ status: cap(status), n })),
  }),

  /** The heatmap as it looks: one row per metric and time of day, a column per weekday. */
  slotGrid: (v: GamesView): Sheet => {
    const cells = v.data.games.breakdowns.slots;
    const metrics: [string, (c: (typeof cells)[number]) => unknown][] = [
      ["% struggled", (c) => c.underPct],
      ["Typical fill %", (c) => c.medianFillPct],
      ["Games", (c) => c.games],
      ["Cancelled of total", (c) => `${c.cancelled}/${c.games}`],
    ];
    return {
      name: "Time slots grid",
      notes: gameNotes("When games work — weekday × kick-off time (IST)", v, struggledNote(v.data),
        "Typical fill = the median: half the slot's played (or auto-cancelled) games ended at least this full."),
      columns: [{ header: "Metric", key: "metric", width: 20 }, { header: "Time of day", key: "part", width: 12 },
        ...DAYS.map((d) => ({ header: d, key: d, width: 9 }))],
      rows: metrics.flatMap(([metric, value]) => PARTS.map((part) => ({
        metric,
        part: cap(part),
        ...Object.fromEntries(DAY_INDEX.map((w, i) => {
          const c = cells.find((x) => x.weekday === w && x.daypart === part);
          return [DAYS[i], c ? value(c) : null];
        })),
      }))),
    };
  },

  slots: (v: GamesView): Sheet => ({
    name: "Time slots",
    notes: gameNotes("When games work — one row per weekday and kick-off time (IST)", v, struggledNote(v.data)),
    columns: [
      { header: "Day", key: "day", width: 7 },
      { header: "Time of day", key: "part", width: 12 },
      { header: "Cancelled of total", key: "cancelledOf", width: 17 },
      ...breakdownColumns(v.data),
      { header: "Full games", key: "fullGames", width: 11 },
    ],
    rows: [...v.data.games.breakdowns.slots]
      .sort((a, b) => DAY_INDEX.indexOf(a.weekday) - DAY_INDEX.indexOf(b.weekday) || PARTS.indexOf(a.daypart) - PARTS.indexOf(b.daypart))
      .map((r) => ({ ...r, day: DAY_NAME[r.weekday], part: cap(r.daypart), cancelledOf: `${r.cancelled}/${r.games}` })),
  }),

  breakdown: (v: GamesView, name: string, rows: BreakdownRow[], extras: { header: string; key: keyof BreakdownRow }[] = []): Sheet => ({
    name,
    notes: gameNotes(name, v, struggledNote(v.data)),
    columns: [
      { header: "Name", key: "label", width: 32 },
      ...extras.map((x) => ({ header: x.header, key: x.key as string, width: 16 })),
      ...breakdownColumns(v.data),
    ],
    rows,
  }),

  /** A list of games — what a drawer, or a slice of the page, is made of. */
  games: (name: string, title: string, view: string, line: number, list: GameList): Sheet => ({
    name,
    notes: [`${title} — ${view}`,
      `${list.total} games, worst first${list.rows.length < list.total ? ` — the first ${list.rows.length} are listed` : ""}. Dates are kick-off (IST).`],
    columns: [
      { header: "Game", key: "title", width: 34 },
      { header: "Played (IST)", key: "played", width: 22 },
      { header: "Venue", key: "venue", width: 26 },
      { header: "City", key: "city", width: 14 },
      { header: "Organiser", key: "organiser", width: 22 },
      { header: "Format", key: "format", width: 9 },
      { header: "Status", key: "status", width: 11 },
      { header: "Outcome", key: "outcome", width: 22 },
      { header: "Seats", key: "seats", width: 7 },
      { header: "Slots", key: "totalSlots", width: 7 },
      { header: "Min players", key: "minPlayers", width: 11 },
      { header: "Fill %", key: "fillPct", width: 8 },
      { header: "Fill % 24h before", key: "fill24Pct", width: 16 },
      { header: "Waitlist joins", key: "waitlistEntries", width: 14 },
      { header: "Cancel reason", key: "cancelReason", width: 40 },
    ],
    rows: list.rows.map((g) => ({ ...g, played: istDateTime(g.scheduledAt), status: cap(g.status), outcome: outcomeOf(g, line) })),
  }),
};

/** The players behind "unique players" — one sheet, or one per compared window. */
export function playerListSheets(d: UniquePlayersData, view: string): Sheet[] {
  const columns = [
    { header: "Player", key: "name", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Games", key: "games", width: 8 },
    { header: "Last game (IST)", key: "last", width: 22 },
    ...(d.compare ? [{ header: "Compared with the other period", key: "tag", width: 28 }] : []),
  ];
  const rows = (list: UniquePlayer[]) =>
    list.map((p) => ({ ...p, last: istDateTime(p.lastGameAt), tag: p.tag ? TAG_TEXT[p.tag] : "" }));
  const about = "Own seats in games running or played; guests are not counted.";
  if (!d.compare) {
    return [{ name: "Players", notes: [`Unique players (${d.players.length}) — ${view}`, about], columns, rows: rows(d.players) }];
  }
  return [
    { name: "Players recent", notes: [`Players in ${d.recentLabel} (${d.recent.length}) — ${view}`, about, TAG_NOTE.recent(d.label)], columns, rows: rows(d.recent) },
    { name: "Players before", notes: [`Players in ${d.label} (${d.prior.length}) — ${view}`, about, TAG_NOTE.prior(d.label)], columns, rows: rows(d.prior) },
  ];
}

/** Everything on the Games topic, plus the struggled games by name and the player lists. */
export async function exportGamesWorkbook(data: AnalyticsData, view: string, pageQuery: string) {
  const v = { data, view };
  const slice = (key: string) => {
    const q = new URLSearchParams(pageQuery);
    q.set(key, "1");
    return fetchSliceGames(q);
  };
  const [struggled, players, compared] = await Promise.all([
    slice("under"),
    fetchUniquePlayers(pageQuery, false),
    data.comparison.none ? null : fetchUniquePlayers(pageQuery, true),
  ]);
  const b = data.games.breakdowns;
  await downloadSheets("kasakai-games-analytics", [
    gameSheets.conclusions(v),
    gameSheets.keyNumbers(v),
    gameSheets.games("Struggled games", "Games that struggled", view, fillLine(data), struggled),
    gameSheets.outcomes(v),
    gameSheets.daily(v),
    gameSheets.monthly(v),
    gameSheets.fill(v),
    gameSheets.slotGrid(v),
    gameSheets.slots(v),
    gameSheets.breakdown(v, "Cities", b.metros),
    gameSheets.breakdown(v, "Venues", b.venues, [{ header: "City", key: "metro" }, { header: "Area", key: "area" }]),
    gameSheets.breakdown(v, "Organisers", b.organisers),
    gameSheets.breakdown(v, "Formats", b.formats),
    ...playerListSheets(players, view),
    ...(compared ? playerListSheets(compared, view) : []),
  ]);
}

// ── Players topic ────────────────────────────────────────────────────────────

const overviewNotes = (title: string, d: PlayersOverview, ...more: string[]) =>
  [`Players — ${title}`, generated(d.generatedAt), d.window.from ? `View: ${d.window.from} → ${d.window.to ?? "today"}` : "View: all time", ...more];

export const playerSheets = {
  conclusions: (d: PlayersOverview) =>
    conclusionsSheet(d.conclusions, overviewNotes("conclusions", d, `Trends compare ${d.window.recentLabel} with ${d.window.priorLabel}.`)),

  keyNumbers: (d: PlayersOverview): Sheet => {
    const t = d.totals;
    const { recentLabel: recent, priorLabel: prior } = d.window;
    return kv("Key numbers", overviewNotes("key numbers", d), [
      [d.window.from ? "Joined in this view (accounts)" : "Players (accounts)", t.players],
      ["Verified", t.verified],
      ["Have played", t.played],
      ["Have played %", t.playedPct],
      ["Activation % (joined 14+ days ago)", t.activationPct],
      [`Active in ${recent}`, t.active30],
      [`Active in ${prior}`, t.activePrior30],
      [`Signups in ${recent}`, t.signups30],
      [`Signups in ${prior}`, t.signupsPrior30],
      ["First game 30+ days ago", t.repeatBase],
      ["2nd game within 30 days %", t.secondIn30Pct],
      ["Ever came back %", t.repeatPct],
      ["Median days from signup to first game", t.medianDaysToFirstGame],
      ["Rated players", t.rated],
      ["Average conduct (★)", t.avgConduct],
      ["Average gameplay (★)", t.avgGameplay],
      ["Topped up (players)", t.payers],
      ["Topped up %", t.payersPct],
      [d.window.from ? "Topped up in this view (₹)" : "Topped up all time (₹)", rupees(t.topUpPaise)],
      [`Topped up in ${recent} (₹)`, rupees(t.topUp30Paise)],
      [`Topped up in ${prior} (₹)`, rupees(t.topUpPrior30Paise)],
    ]);
  },

  monthly: (d: PlayersOverview): Sheet => ({
    name: "Month by month",
    notes: overviewNotes("month by month", d,
      "IST. Active = played at least one completed game that month in their own seat, not marked absent or no-show; once per player per month."),
    columns: [
      { header: "Month", key: "month", width: 10 },
      { header: "Signups", key: "signups", width: 10 },
      { header: "First game", key: "firstGames", width: 11 },
      { header: "Active players", key: "active", width: 14 },
    ],
    rows: d.monthly,
  }),

  weekly: (d: PlayersOverview): Sheet => ({
    name: "First-timers by week",
    notes: overviewNotes("first-time players per week", d,
      "Weeks run Monday to Sunday (IST). Up to 50 players are named per week; Games = every game they have played since."),
    columns: [
      { header: "Week of", key: "week", width: 12 },
      { header: "First-timers", key: "firstGames", width: 13 },
      { header: "Player", key: "name", width: 28 },
      { header: "Games played", key: "games", width: 13 },
    ],
    rows: d.weekly.flatMap((w) => (w.players.length
      ? w.players.map((p) => ({ week: w.week, firstGames: w.firstGames, name: p.name, games: p.games }))
      : [{ week: w.week, firstGames: w.firstGames }])),
  }),

  gamesDistribution: (d: PlayersOverview): Sheet => ({
    name: "Games per player",
    notes: overviewNotes("games played per player", d, "Every account, by games actually played."),
    columns: [{ header: "Games played", key: "label", width: 14 }, { header: "Players", key: "players", width: 10 }],
    rows: d.gamesDistribution,
  }),

  ratings: (d: PlayersOverview): Sheet => ({
    name: "Gameplay ratings",
    notes: overviewNotes("gameplay ratings", d, "Each rated player's average across the organisers who rated them."),
    columns: [{ header: "Rating", key: "label", width: 14 }, { header: "Players", key: "players", width: 10 }],
    rows: d.ratingDistribution,
  }),

  top: (d: PlayersOverview): Sheet => ({
    name: "Most active players",
    notes: overviewNotes("most active players", d, "Top 50 by games played."),
    columns: [
      { header: "Player", key: "name", width: 28 },
      { header: "Games", key: "games", width: 8 },
      { header: "Last played (IST)", key: "last", width: 16 },
      { header: "Joined", key: "joined", width: 14 },
      { header: "Conduct ★", key: "conduct", width: 10 },
      { header: "Gameplay ★", key: "gameplay", width: 11 },
      { header: "Topped up (₹)", key: "topUp", width: 14 },
    ],
    rows: d.topPlayers.map((p) => ({ ...p, last: istDate(p.lastPlayedAt), joined: istDate(p.joinedAt), topUp: rupees(p.topUpPaise) })),
  }),
};

export const exportPlayersWorkbook = (d: PlayersOverview) =>
  downloadSheets("kasakai-players-analytics", [
    playerSheets.conclusions(d), playerSheets.keyNumbers(d), playerSheets.monthly(d), playerSheets.weekly(d),
    playerSheets.gamesDistribution(d), playerSheets.ratings(d), playerSheets.top(d),
  ]);

// ── One player's report ──────────────────────────────────────────────────────

const reportNotes = (title: string, d: PlayerReportData) =>
  [`${d.profile.name} — ${title}`, `${d.profile.phone} · ${generated(d.generatedAt)}`];

export const reportSheets = {
  games: (d: PlayerReportData): Sheet[] => {
    const a = d.activity;
    return [
      kv("Games", reportNotes("games", d), [
        ["Games played", a.gamesPlayed], ["Bookings", a.bookings], ["Upcoming", a.upcoming],
        ["Attendance %", a.attendancePct], ["Present", a.present], ["No-shows", a.noShows],
        ["Absent (told organiser)", a.absent], ["Backouts", a.backouts], ["Opted out", a.optedOut],
        ["Removed by organiser", a.removed], ["Games cancelled on them", a.cancelledOnThem],
        ["Guests brought", a.guestsBrought], ["Feedback given", a.feedbackGiven],
        ["First played", istDate(a.firstPlayedAt)], ["Last played", istDate(a.lastPlayedAt)],
        ["Days since last game", a.daysSinceLastGame], ["Days from signup to first game", a.daysToFirstGame],
        ["Games per month", a.gamesPerMonth],
      ]),
      {
        name: "Games by month",
        notes: reportNotes("games by month, last 12", d),
        columns: [{ header: "Month", key: "month", width: 10 }, { header: "Games", key: "games", width: 8 }],
        rows: d.monthly,
      },
      {
        name: "Favourites",
        notes: reportNotes("where, with whom and when they play most", d),
        columns: [{ header: "Kind", key: "kind", width: 12 }, { header: "Name", key: "label", width: 32 }, { header: "Games", key: "games", width: 8 }],
        rows: (["venues", "organisers", "formats", "slots"] as const).flatMap((k) =>
          d.favourites[k].map((r) => ({ kind: cap(k === "slots" ? "when" : k), ...r }))),
      },
    ];
  },

  money: (d: PlayerReportData): Sheet[] => {
    const m = d.money;
    return [kv("Money", reportNotes("money (₹), from the wallet ledger", d), [
      ["Topped up", rupees(m.topUpPaise)], ["Top-ups", m.topUps], ["Last top-up", istDate(m.lastTopUpAt)],
      ["Booked (gross)", rupees(m.gameSpendPaise)], ["Refunded", rupees(m.refundPaise)],
      ["Spent on games (net)", rupees(m.netGameSpendPaise)], ["Backout fees paid", rupees(m.backoutFeePaise)],
      ["Recharge bonus earned", rupees(m.bonusPaise)], ["Spent on passes", rupees(m.passPurchasePaise)],
      ["Paid at checkout (old flow)", rupees(m.directPaise)],
      ["Discount saved", rupees(m.discountSavedPaise)], ["Discounted games", m.discountedGames],
      ["Pass covered", rupees(m.passCoveredPaise)], ["Pass-covered games", m.passCoveredGames],
      ["Admin credits", rupees(m.adminCreditPaise)], ["Admin debits", rupees(m.adminDebitPaise)],
      ["Balance now", rupees(m.balancePaise)], ["Locked for upcoming games", rupees(m.lockedPaise)],
    ])];
  },

  passes: (d: PlayerReportData): Sheet[] => [{
    name: "Passes",
    notes: [...reportNotes("passes", d), "Net = value covered minus the price paid (₹)."],
    columns: [
      { header: "Pass", key: "name", width: 26 }, { header: "Code", key: "code", width: 14 },
      { header: "Source", key: "source", width: 13 }, { header: "Status", key: "status", width: 11 },
      { header: "From", key: "from", width: 14 }, { header: "Until", key: "until", width: 14 },
      { header: "Price (₹)", key: "price", width: 10 }, { header: "Games covered", key: "games", width: 13 },
      { header: "Value covered (₹)", key: "covered", width: 16 }, { header: "Net (₹)", key: "net", width: 10 },
      { header: "Games left", key: "remainingGames", width: 11 }, { header: "Value left (₹)", key: "left", width: 13 },
    ],
    rows: d.passes.map((x) => ({
      ...x, from: istDate(x.activatesAt), until: x.expiresAt ? istDate(x.expiresAt) : "No expiry",
      price: rupees(x.pricePaidPaise), covered: rupees(x.coveredPaise), net: rupees(x.netPaise), left: rupees(x.remainingPaise),
    })),
  }],

  ratings: (d: PlayerReportData): Sheet[] => {
    const r = d.ratings;
    return [
      kv("Ratings", reportNotes("ratings (★ out of 5)", d), [
        ["Conduct", r.conduct], ["Gameplay", r.gameplay], ["Organisers who rated", r.count],
        ["Skill snapshot", r.skill?.gameplay ?? null], ["Skill confidence %", r.skill?.confidence ?? null],
        ["From other players", r.peer.avg], ["Peer ratings", r.peer.count],
        ["Avg game rating they give", r.given.game], ["Avg organiser rating they give", r.given.organiser],
        ["Avg venue rating they give", r.given.venue], ["Feedback given", r.given.count],
      ]),
      {
        name: "Ratings by organiser",
        notes: reportNotes("ratings by organiser", d),
        columns: [
          { header: "Organiser", key: "organiser", width: 28 }, { header: "Conduct ★", key: "conduct", width: 10 },
          { header: "Gameplay ★", key: "gameplay", width: 11 }, { header: "Games seen", key: "gamesObserved", width: 11 },
          { header: "Last rated", key: "last", width: 14 },
        ],
        rows: r.byOrganiser.map((o) => ({ ...o, last: istDate(o.lastRatedAt) })),
      },
    ];
  },

  profile: (d: PlayerReportData): Sheet[] => {
    const p = d.profile;
    return [kv("Profile", reportNotes("profile", d), [
      ["Name", p.name], ["Phone", p.phone], ["Email", p.email], ["Verified", p.isVerified ? "Yes" : "No"],
      ["Joined", istDate(p.joinedAt)], ["City", p.location], ["Skill level", p.preferences.skillLevel],
      ["Preferred format", p.preferences.preferredFormat], ["Positions", p.preferences.positions.join(", ")],
      ["Referral code", p.referralCode], ["Players invited", p.invitedCount],
    ])];
  },

  history: (d: PlayerReportData): Sheet[] => [{
    name: "Every game",
    notes: [...reportNotes("every game they booked, newest first", d), "Money in ₹. Saved = pass cover or discount on their own seat."],
    columns: [
      { header: "Date (IST)", key: "date", width: 20 }, { header: "Game", key: "title", width: 30 },
      { header: "Format", key: "format", width: 8 }, { header: "Venue", key: "venue", width: 24 },
      { header: "Organiser", key: "organiserName", width: 22 }, { header: "Status", key: "status", width: 11 },
      { header: "Their seat", key: "seat", width: 22 }, { header: "Attended", key: "attended", width: 12 },
      { header: "Paid (₹)", key: "paid", width: 9 }, { header: "Payment", key: "paymentStatus", width: 11 },
      { header: "Pass cover (₹)", key: "pass", width: 13 }, { header: "Discount (₹)", key: "discount", width: 12 },
      { header: "Guests", key: "guestCount", width: 8 }, { header: "Backout fee (₹)", key: "fee", width: 14 },
      { header: "Fee returned", key: "feeReturned", width: 12 },
    ],
    rows: d.games.map((g) => ({
      ...g,
      date: istDateTime(g.scheduledAt),
      seat: g.backedOut ? `Backed out${g.backoutType === "post_cutoff" ? " (after cutoff)" : ""}`
        : g.removed ? "Removed by organiser" : g.optedOut ? "Opted out" : "Held",
      attended: g.attendanceMarked ? g.attended : "Not marked",
      paid: rupees(g.amountPaidPaise), pass: rupees(g.passBenefitPaise), discount: rupees(g.discountPaise),
      fee: rupees(g.backoutFeeChargedPaise), feeReturned: g.backoutFeeChargedPaise ? (g.backoutFeeReturned ? "Yes" : "No") : "",
    })),
  }],
};

export const exportPlayerReport = (d: PlayerReportData) =>
  downloadSheets(`kasakai-player-${d.profile.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, [
    conclusionsSheet(d.conclusions, reportNotes("conclusions", d)),
    ...reportSheets.games(d), ...reportSheets.money(d), ...reportSheets.passes(d),
    ...reportSheets.ratings(d), ...reportSheets.profile(d), ...reportSheets.history(d),
  ]);
