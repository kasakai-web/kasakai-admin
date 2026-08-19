"use client";

import { useEffect, useState } from "react";
import {
  SECTION_TITLE, PAYMENT_SUMMARY, SUMMARY_THREE, SUMMARY_ITEM, PAY_CARD, STAT_LABEL,
  SUMMARY_VALUE, PAY_VALUE, PAY_SUB, BADGE, BADGE_GRAY, TOOLBAR, SEARCH_INPUT, FILTER_SELECT,
  TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_HEAD, MODAL_CLOSE,
  TAB_BAR, TAB, TAB_ACTIVE,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { formatDate, formatStatusLabel, starRating } from "../shared/format";
import { Head } from "../shared/components";

// Feedback
type FeedbackRow = {
  _id: string;
  game?: {
    title?: string; format?: string; scheduledAt?: string;
    organiser?: { name?: string; phone?: string } | null;
    turf?: { name?: string; address?: { area?: string; city?: string } } | null;
  } | null;
  submittedBy?: { name?: string; phone?: string } | null;
  gameRating: number; organiserRating?: number | null; venueRating?: number | null;
  tags?: string[]; comment?: string | null; createdAt: string;
};

type FeedbackApiResponse = {
  success: boolean; count?: number;
  total?: number; page?: number; limit?: number; totalPages?: number;
  data: FeedbackRow[]; message?: string;
};

// GET /admin/feedback/summary — cards + dropdown options, over ALL feedback.
type FeedbackSummaryResponse = {
  data?: {
    summary?: { avgGame?: number | null; tagCounts?: Record<string, number>; total?: number };
    filters?: { organisers?: string[]; turfs?: string[]; games?: { key: string; label: string }[] };
  };
};

type FbSortKey = "date" | "gameRating" | "organiserRating" | "venueRating";
type PrSortKey = "date" | "conduct" | "gameplay" | "avg";
type DateRange = "all" | "today" | "week" | "month";

type CommentModalData = { comment: string; player: string; game: string };

// An organiser's STANDING rating of a player — one row per (organiser, player),
// revised over time rather than re-created per game. The game fields describe the
// occasion the opinion was last formed on, not a game the rating belongs to.
type PlayerRatingRow = {
  id: string;
  playerName: string; playerPhone?: string | null;
  organiserName: string; organiserPhone?: string | null;
  lastGameTitle?: string | null; lastGameFormat?: string | null; lastGameDate?: string | null;
  // Either star can be NA — an organiser may rate conduct and skip gameplay.
  conductRating: number | null; gameplayRating: number | null; avgRating: number | null;
  preferredPosition?: string | null; gkAffinity?: number | null;
  notes?: string | null; ratedAt?: string | null;
  gamesObserved?: number; revision?: number;
};

type PlayerRatingApiResponse = {
  success?: boolean; count?: number; message?: string;
  total?: number; page?: number; limit?: number; totalPages?: number;
  data?: PlayerRatingRow[];
};

// GET /admin/player-ratings/summary — cards + dropdown options, over ALL ratings.
type PlayerRatingSummaryResponse = {
  data?: {
    summary?: { total?: number; avgConduct?: number | null; avgGameplay?: number | null };
    filters?: { organisers?: string[]; games?: { key: string; label: string }[] };
  };
};

/** NA stars render as a dash rather than "★ 0.0". */
function star(value: number | null | undefined) {
  return value != null && value > 0 ? `★ ${value.toFixed(1)}` : "—";
}

export function Feedback() {
  const [tab, setTab] = useState<"player" | "organiser">("player");

  // ── Tab 1: Player → Platform (GameFeedback) ────────────────────────────────
  const [fbSearch, setFbSearch]   = useState("");
  const [sortKey, setSortKey]   = useState<FbSortKey>("date");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [commentModal, setCommentModal] = useState<CommentModalData | null>(null);
  const [fbOrganiser, setFbOrganiser] = useState("");
  const [fbTurf, setFbTurf]           = useState("");
  const [fbGame, setFbGame]           = useState("");
  const [fbDateRange, setFbDateRange] = useState<DateRange>("all");

  /* Two tables on one route, so each pager namespaces its own URL keys —
     ?fbPage=3 and ?prPage=2 address the two tabs independently. */
  const fbPager = usePagination({ key: "fb" });
  const prPager = usePagination({ key: "pr" });

  // Debounced search — avoids one request per keystroke
  const [fbDebouncedSearch, setFbDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFbDebouncedSearch(fbSearch), 300);
    return () => clearTimeout(t);
  }, [fbSearch]);

  // ── Tab 2: Organiser → Player (PlayerRating) ───────────────────────────────
  const [prSearch, setPrSearch]   = useState("");
  const [prSortKey, setPrSortKey] = useState<PrSortKey>("date");
  const [prSortDir, setPrSortDir] = useState<"asc" | "desc">("desc");
  const [notesModal, setNotesModal] = useState<{ notes: string; player: string; organiser: string } | null>(null);
  const [prOrganiser, setPrOrganiser] = useState("");
  const [prGame, setPrGame]           = useState("");
  const [prDateRange, setPrDateRange] = useState<DateRange>("all");

  const [prDebouncedSearch, setPrDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setPrDebouncedSearch(prSearch), 300);
    return () => clearTimeout(t);
  }, [prSearch]);

  const fbParams = new URLSearchParams({
    page: String(fbPager.page), limit: String(fbPager.limit), sortKey, sortDir,
  });
  if (fbDebouncedSearch.trim()) fbParams.set("search", fbDebouncedSearch.trim());
  if (fbOrganiser)            fbParams.set("organiser", fbOrganiser);
  if (fbTurf)                 fbParams.set("turf", fbTurf);
  if (fbGame)                 fbParams.set("game", fbGame);
  if (fbDateRange !== "all")  fbParams.set("dateRange", fbDateRange);

  const { data: fbBody, loading: fbLoading, error: fbError } = useAdminFetch<FeedbackApiResponse>(
    `/admin/feedback?${fbParams.toString()}`,
    { errorMessage: "Failed to load feedback." },
  );

  /* Cards and dropdown options are their own request on a constant path: they
     describe ALL feedback, so re-deriving them on every page or filter change
     was pure waste. Fetched once per visit, cached across section switches. */
  const { data: fbSummaryBody, loading: fbSummaryLoading } = useAdminFetch<FeedbackSummaryResponse>(
    "/admin/feedback/summary",
    { cache: true, errorMessage: "Failed to load feedback totals." },
  );

  const feedback = fbBody?.data ?? [];               // current page only
  const summary  = fbSummaryBody?.data?.summary ?? {};
  const fbTotal  = fbBody?.total ?? feedback.length; // rows matching filters
  const fbFilterOpts = {
    organisers: fbSummaryBody?.data?.filters?.organisers ?? [],
    turfs:      fbSummaryBody?.data?.filters?.turfs      ?? [],
    games:      fbSummaryBody?.data?.filters?.games      ?? [],
  };

  /* Player ratings are filtered, sorted and paginated by the server too — the
     table used to fetch a hard-capped 200 rows and slice them here, which
     silently hid every rating past that cap. */
  const prParams = new URLSearchParams({
    page: String(prPager.page), limit: String(prPager.limit),
    sortKey: prSortKey, sortDir: prSortDir,
  });
  if (prDebouncedSearch.trim()) prParams.set("search", prDebouncedSearch.trim());
  if (prOrganiser)            prParams.set("organiser", prOrganiser);
  if (prGame)                 prParams.set("game", prGame);
  if (prDateRange !== "all")  prParams.set("dateRange", prDateRange);

  const { data: prBody, loading: prLoading, error: prError } = useAdminFetch<PlayerRatingApiResponse>(
    `/admin/player-ratings?${prParams.toString()}`,
    { errorMessage: "Failed to load player ratings." },
  );

  const { data: prSummaryBody, loading: prSummaryLoading } = useAdminFetch<PlayerRatingSummaryResponse>(
    "/admin/player-ratings/summary",
    { cache: true, errorMessage: "Failed to load rating totals." },
  );

  const prRows       = prBody?.data ?? [];              // current page only
  const prMatched    = prBody?.total ?? prRows.length;  // rows matching filters
  const prSummary    = prSummaryBody?.data?.summary ?? {};
  const prTotal      = prSummary.total ?? 0;            // every rating
  const prFilterOpts = {
    organisers: prSummaryBody?.data?.filters?.organisers ?? [],
    games:      prSummaryBody?.data?.filters?.games      ?? [],
  };

  // ── Tab 1 helpers ──────────────────────────────────────────────────────────
  function toggleSort(key: FbSortKey) {
    fbPager.resetPage();
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  function sortIcon(key: FbSortKey) {
    if (sortKey !== key) return <span className="ml-[4px] text-muted-2">↕</span>;
    return <span className="ml-[4px]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  // ── Tab 2 helpers ──────────────────────────────────────────────────────────
  function togglePrSort(key: PrSortKey) {
    prPager.resetPage();
    if (prSortKey === key) setPrSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPrSortKey(key); setPrSortDir("desc"); }
  }
  function prSortIcon(key: PrSortKey) {
    if (prSortKey !== key) return <span className="ml-[4px] text-muted-2">↕</span>;
    return <span className="ml-[4px]">{prSortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thSort = "cursor-pointer select-none";

  // ── Unique filter lists ──────────────────────────────────────────────────────
  // Both tabs get their dropdown options from the server, computed over the FULL
  // set rather than the page on screen — `fbFilterOpts` and `prFilterOpts`.

  const DATE_RANGE_LABELS: Record<DateRange, string> = { all: "All Time", today: "Today", week: "7 Days", month: "30 Days" };
  const DATE_RANGES: DateRange[] = ["all", "today", "week", "month"];

  // Both tables are filtered, sorted and paginated by the server; `feedback` and
  // `prRows` are already the exact pages to render.

  const topTags = Object.entries(summary.tagCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const TRUNC = 80;

  return (
    <>
      <Head title="Feedback" sub="Player feedback to platform · Organiser ratings to players" />

      {/* Tab bar */}
      <div className={TAB_BAR}>
        <button
          className={`${TAB} ${tab === "player" ? TAB_ACTIVE : ""}`}
          type="button"
          onClick={() => setTab("player")}
        >
          Player → Platform ({summary.total ?? 0})
        </button>
        <button
          className={`${TAB} ${tab === "organiser" ? TAB_ACTIVE : ""}`}
          type="button"
          onClick={() => setTab("organiser")}
        >
          Organiser → Players ({prTotal})
        </button>
      </div>

      {/* ── Tab 1: Player feedback ─────────────────────────────────────────── */}
      {tab === "player" && (
        <>
          <div className={PAYMENT_SUMMARY}>
            <div className={PAY_CARD}><div className={STAT_LABEL}>Total Submissions</div><div className={PAY_VALUE}>{fbSummaryLoading ? "—" : (summary.total ?? 0)}</div><div className={PAY_SUB}>Post-game feedback</div></div>
            <div className={PAY_CARD}><div className={STAT_LABEL}>Avg Game Rating</div><div className={`${PAY_VALUE} text-warning!`}>{summary.avgGame != null ? `${summary.avgGame} / 5` : "—"}</div><div className={PAY_SUB}>Across all submitted feedback</div></div>
            <div className={PAY_CARD}>
              <div className={STAT_LABEL}>Top Tags</div>
              <div className="mt-[6px] flex flex-wrap gap-1">
                {topTags.length === 0 ? <span className="text-[13px] text-muted">—</span> : topTags.map(([tag, count]) => (
                  <span key={tag} className={`${BADGE} ${BADGE_GRAY}`}>{tag} ({count})</span>
                ))}
              </div>
            </div>
          </div>

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search player, organiser, turf, game, comment…" value={fbSearch} onChange={(e) => { setFbSearch(e.target.value); fbPager.resetPage(); }} />
            <select className={FILTER_SELECT} value={fbOrganiser} onChange={(e) => { setFbOrganiser(e.target.value); fbPager.resetPage(); }}>
              <option value="">All Organisers</option>
              {fbFilterOpts.organisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={FILTER_SELECT} value={fbTurf} onChange={(e) => { setFbTurf(e.target.value); fbPager.resetPage(); }}>
              <option value="">All Turfs</option>
              {fbFilterOpts.turfs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={FILTER_SELECT} value={fbGame} onChange={(e) => { setFbGame(e.target.value); fbPager.resetPage(); }}>
              <option value="">All Games</option>
              {fbFilterOpts.games.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => { setFbDateRange(r); fbPager.resetPage(); }}
                  className={`cursor-pointer border px-3 py-[7px] text-[12px] ${fbDateRange === r ? "border-accent bg-accent font-bold text-black" : "border-border-2 bg-surface font-normal text-muted"}`}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(fbOrganiser || fbTurf || fbGame || fbDateRange !== "all" || fbSearch) && (
              <button type="button"
                onClick={() => { setFbOrganiser(""); setFbTurf(""); setFbGame(""); setFbDateRange("all"); setFbSearch(""); fbPager.resetPage(); }}
                className="cursor-pointer whitespace-nowrap border border-[rgba(241,118,127,0.35)] bg-[rgba(241,118,127,0.1)] px-3 py-[7px] text-[12px] text-danger">
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!fbLoading && (
            <div className="mb-[10px] text-[12px] text-muted">
              <strong className="text-fg">{fbTotal}</strong> {fbTotal === 1 ? "entry" : "entries"} match
            </div>
          )}

          {fbError   && <div className={FORM_ERROR}>{fbError}</div>}
          {fbLoading && <div className={LOADING_STATE}>Loading feedback…</div>}

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Game</th>
                  <th>Organiser</th>
                  <th>Turf / Venue</th>
                  <th className={thSort} onClick={() => toggleSort("date")}>Date{sortIcon("date")}</th>
                  <th className={thSort} onClick={() => toggleSort("gameRating")}>Game ★{sortIcon("gameRating")}</th>
                  <th className={thSort} onClick={() => toggleSort("organiserRating")}>Organiser ★{sortIcon("organiserRating")}</th>
                  <th className={thSort} onClick={() => toggleSort("venueRating")}>Venue ★{sortIcon("venueRating")}</th>
                  <th>Tags</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {!fbLoading && feedback.length === 0 && (
                  <tr><td colSpan={10} className="p-6! text-center text-muted!">No feedback submitted yet.</td></tr>
                )}
                {feedback.map((f) => (
                  <tr key={f._id}>
                    <td>
                      <div className="font-medium">{f.submittedBy?.name || "—"}</div>
                      <div className="text-[11px] text-muted">{f.submittedBy?.phone || ""}</div>
                    </td>
                    <td>
                      {f.game?.title || "—"}
                      <div className="text-[11px] text-muted">{f.game?.format || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.organiser?.name || "—"}</div>
                      <div className="text-[11px] text-muted">{f.game?.organiser?.phone || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.turf?.name || "—"}</div>
                      {(f.game?.turf?.address?.area || f.game?.turf?.address?.city) && (
                        <div className="text-[11px] text-muted">
                          {[f.game?.turf?.address?.area, f.game?.turf?.address?.city].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(f.createdAt)}</td>
                    <td className="text-warning!">{starRating(f.gameRating)}</td>
                    <td className="text-warning!">{starRating(f.organiserRating)}</td>
                    <td className="text-warning!">{starRating(f.venueRating)}</td>
                    <td>
                      {(f.tags || []).map((tag) => (
                        <span key={tag} className={`${BADGE} ${BADGE_GRAY} mr-[3px]`}>{tag}</span>
                      ))}
                    </td>
                    <td className="max-w-[200px]">
                      {!f.comment ? (
                        <span className="text-muted">—</span>
                      ) : f.comment.length <= TRUNC ? (
                        <span className="text-[13px]">{f.comment}</span>
                      ) : (
                        <div className="flex items-center gap-[6px]">
                          <span className="inline-block max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
                            {f.comment}
                          </span>
                          <button
                            type="button"
                            title="View full comment"
                            onClick={() => setCommentModal({ comment: f.comment!, player: f.submittedBy?.name || "Unknown", game: f.game?.title || "Unknown game" })}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-2 bg-surface-2 text-[13px] leading-none text-fg"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={fbPager.page}
            limit={fbPager.limit}
            total={fbTotal}
            onPageChange={fbPager.setPage}
            onLimitChange={fbPager.setLimit}
            label="entries"
          />

          {/* Full-comment modal */}
          {commentModal && (
            <div className={MODAL_OVERLAY} onClick={() => setCommentModal(null)}>
              <div className={`${MODAL} max-w-[540px]!`} onClick={(e) => e.stopPropagation()}>
                <div className={MODAL_HEAD}>
                  <div>
                    <div className={SECTION_TITLE}>Full Comment</div>
                    <div className="mt-[5px] text-[12px] text-muted">
                      {commentModal.player} &nbsp;·&nbsp; {commentModal.game}
                    </div>
                  </div>
                  <button className={MODAL_CLOSE} type="button" onClick={() => setCommentModal(null)}>✕</button>
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-body">
                  {commentModal.comment}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab 2: Organiser → Player ratings ──────────────────────────────── */}
      {tab === "organiser" && (
        <>
          <div className={SUMMARY_THREE}>
            <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total Ratings</div><div className={SUMMARY_VALUE}>{prSummaryLoading ? "—" : prTotal}</div></div>
            <div className={SUMMARY_ITEM}>
              <div className={STAT_LABEL}>Avg Conduct</div>
              <div className={`${SUMMARY_VALUE} text-warning!`}>
                {prSummaryLoading ? "—" : prSummary.avgConduct != null ? prSummary.avgConduct.toFixed(1) : "—"}
              </div>
            </div>
            <div className={SUMMARY_ITEM}>
              <div className={STAT_LABEL}>Avg Gameplay</div>
              <div className={`${SUMMARY_VALUE} text-warning!`}>
                {prSummaryLoading ? "—" : prSummary.avgGameplay != null ? prSummary.avgGameplay.toFixed(1) : "—"}
              </div>
            </div>
          </div>

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search player, organiser, game, notes…" value={prSearch} onChange={(e) => { setPrSearch(e.target.value); prPager.resetPage(); }} />
            <select className={FILTER_SELECT} value={prOrganiser} onChange={(e) => { setPrOrganiser(e.target.value); prPager.resetPage(); }}>
              <option value="">All Organisers</option>
              {prFilterOpts.organisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={FILTER_SELECT} value={prGame} onChange={(e) => { setPrGame(e.target.value); prPager.resetPage(); }}>
              <option value="">Any Last Game</option>
              {prFilterOpts.games.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => { setPrDateRange(r); prPager.resetPage(); }}
                  className={`cursor-pointer border px-3 py-[7px] text-[12px] ${prDateRange === r ? "border-accent bg-accent font-bold text-black" : "border-border-2 bg-surface font-normal text-muted"}`}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(prOrganiser || prGame || prDateRange !== "all" || prSearch) && (
              <button type="button"
                onClick={() => { setPrOrganiser(""); setPrGame(""); setPrDateRange("all"); setPrSearch(""); prPager.resetPage(); }}
                className="cursor-pointer whitespace-nowrap border border-[rgba(241,118,127,0.35)] bg-[rgba(241,118,127,0.1)] px-3 py-[7px] text-[12px] text-danger">
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!prLoading && (
            <div className="mb-[10px] text-[12px] text-muted">
              <strong className="text-fg">{prMatched}</strong> of {prTotal} {prTotal === 1 ? "entry" : "entries"} match
            </div>
          )}

          {prError   && <div className={FORM_ERROR}>{prError}</div>}
          {prLoading && <div className={LOADING_STATE}>Loading player ratings…</div>}

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Organiser</th>
                  <th>Last Rated In</th>
                  <th>Position</th>
                  <th className={thSort} onClick={() => togglePrSort("conduct")}>Conduct ★{prSortIcon("conduct")}</th>
                  <th className={thSort} onClick={() => togglePrSort("gameplay")}>Gameplay ★{prSortIcon("gameplay")}</th>
                  <th className={thSort} onClick={() => togglePrSort("avg")}>Avg ★{prSortIcon("avg")}</th>
                  <th className={thSort} onClick={() => togglePrSort("date")}>Date{prSortIcon("date")}</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!prLoading && prRows.length === 0 && (
                  <tr><td colSpan={9} className="p-6! text-center text-muted!">
                    {prTotal === 0 ? "No organiser ratings submitted yet." : "No ratings match the current filters."}
                  </td></tr>
                )}
                {prRows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      <div className="font-medium">{r.playerName}</div>
                      {r.playerPhone && <div className="text-[11px] text-muted">{r.playerPhone}</div>}
                    </td>
                    <td>
                      <div>{r.organiserName}</div>
                      {r.organiserPhone && <div className="text-[11px] text-muted">{r.organiserPhone}</div>}
                    </td>
                    <td>
                      <div>{r.lastGameTitle || "—"}</div>
                      <div className="text-[11px] text-muted">
                        {r.lastGameFormat && <span>{r.lastGameFormat} · </span>}
                        {r.gamesObserved ?? 0} game{(r.gamesObserved ?? 0) === 1 ? "" : "s"} observed
                        {(r.revision ?? 1) > 1 && <span> · rev {r.revision}</span>}
                      </div>
                    </td>
                    <td>
                      {r.preferredPosition
                        ? <span className={`${BADGE} ${BADGE_GRAY}`}>{formatStatusLabel(r.preferredPosition)}</span>
                        : <span className="text-muted">—</span>
                      }
                      {r.gkAffinity != null && (
                        <div className="mt-[2px] text-[11px] text-muted">GK: {r.gkAffinity}/5</div>
                      )}
                    </td>
                    <td className="font-semibold text-warning!">{star(r.conductRating)}</td>
                    <td className="font-semibold text-warning!">{star(r.gameplayRating)}</td>
                    <td className="font-bold">
                      <span className={
                        r.avgRating == null ? "text-muted"
                          : r.avgRating >= 4 ? "text-success"
                          : r.avgRating >= 3 ? "text-warning"
                          : "text-danger"
                      }>
                        {star(r.avgRating)}
                      </span>
                    </td>
                    <td>{formatDate(r.ratedAt)}</td>
                    <td className="max-w-[180px]">
                      {!r.notes ? (
                        <span className="text-muted">—</span>
                      ) : r.notes.length <= TRUNC ? (
                        <span className="text-[13px]">{r.notes}</span>
                      ) : (
                        <div className="flex items-center gap-[6px]">
                          <span className="inline-block max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
                            {r.notes}
                          </span>
                          <button
                            type="button"
                            title="View full notes"
                            onClick={() => setNotesModal({ notes: r.notes!, player: r.playerName, organiser: r.organiserName })}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-2 bg-surface-2 text-[13px] leading-none text-fg"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={prPager.page}
            limit={prPager.limit}
            total={prMatched}
            onPageChange={prPager.setPage}
            onLimitChange={prPager.setLimit}
            label="ratings"
          />

          {/* Full-notes modal */}
          {notesModal && (
            <div className={MODAL_OVERLAY} onClick={() => setNotesModal(null)}>
              <div className={`${MODAL} max-w-[540px]!`} onClick={(e) => e.stopPropagation()}>
                <div className={MODAL_HEAD}>
                  <div>
                    <div className={SECTION_TITLE}>Organiser Notes</div>
                    <div className="mt-[5px] text-[12px] text-muted">
                      {notesModal.organiser} &nbsp;→&nbsp; {notesModal.player}
                    </div>
                  </div>
                  <button className={MODAL_CLOSE} type="button" onClick={() => setNotesModal(null)}>✕</button>
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-body">
                  {notesModal.notes}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
