"use client";

/* The games behind a number. Every chart mark, table row and finding on the
   Analytics page can open this drawer with a `Slice`; it asks
   /admin/analytics/games for exactly those games — built server-side from the
   same fact rows the chart was drawn from, so the count on the mark and the
   count in the list cannot disagree — worst first.

   For a city, venue, organiser, month or day it also offers to narrow the whole
   page to that slice, which re-runs the verdicts for it. Sort, outcome and search
   run server-side (the list is paged), and the Excel download is the whole list
   as currently sorted and filtered. */

import { useEffect, useState } from "react";
import { BADGE, BADGE_AMBER, BADGE_BLUE, BADGE_GRAY, BADGE_GREEN, BADGE_RED, BADGE_VIOLET, FILTER_SELECT, FORM_ERROR, LOADING_STATE, TOPBAR_BTN, TOPBAR_BTN_PRIMARY } from "../shared/styles";
import { pagerBtnCls } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { GameDetailModal } from "../shared/GameDetailModal";
import { Meter, SERIES } from "./charts";
import { ExportButton } from "./verdicts";
import { downloadSheets, fetchSliceGames, gameSheets } from "./exportExcel";
import type { DrillResponse, DrillRow, Slice } from "./types";

export type DrawerRequest = {
  slice: Slice;
  /** Plain description for the header: "Mumbai · underperforming". */
  label: string;
  /** The name to show on a page-filter chip, when this slice can narrow the page. */
  narrowLabel?: string;
};

/** Slice → query params. Booleans travel as "1"; absent keys are not sent. */
export function sliceParams(slice: Slice): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(slice)) {
    if (v === undefined || v === null || v === false || v === "") continue;
    q.set(k, v === true ? "1" : String(v));
  }
  return q;
}

/** Can this slice narrow the whole page? Cities, venues, organisers, months and days can. */
export function canNarrow(slice: Slice) {
  return !!((slice.metroKey && slice.metroKey !== "__none__") || slice.turf || slice.organiser || slice.month || slice.day);
}

/* Keys match DRILL_SORTS / DRILL_OUTCOMES in admin.analytics.controller.js. */
const SORTS = [
  ["worst", "Worst first"], ["best", "Best first"], ["newest", "Newest first"], ["oldest", "Oldest first"], ["waitlist", "Most waitlisted"],
] as const;
const OUTCOMES = [
  ["", "All outcomes"], ["healthy", "Healthy"], ["under", "Under-filled"], ["auto", "Auto-cancelled"],
  ["organiser", "Cancelled by organiser"], ["atRisk", "Below minimum"], ["upcoming", "Upcoming"],
] as const;

const playDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

/* `under` (struggled) is also true of every cancelled game, so the cancellations
   are named first. */
function Verdict({ g }: { g: DrillRow }) {
  if (g.autoCancelled) return <span className={`${BADGE} ${BADGE_VIOLET}`}>Auto-cancelled</span>;
  if (g.status === "cancelled") return <span className={`${BADGE} ${BADGE_GRAY}`}>Cancelled by organiser</span>;
  if (g.atRisk) return <span className={`${BADGE} ${BADGE_AMBER}`}>Below minimum</span>;
  if (g.under) return <span className={`${BADGE} ${BADGE_RED}`}>Under-filled</span>;
  if (g.status === "completed") return <span className={`${BADGE} ${BADGE_GREEN}`}>Healthy</span>;
  if (g.upcoming) return <span className={`${BADGE} ${BADGE_BLUE}`}>Upcoming</span>;
  return <span className={`${BADGE} ${BADGE_GRAY}`}>{g.status}</span>;
}

export function GameListDrawer({
  request, pageQuery, view, underLine, onClose, onNarrow,
}: {
  request: DrawerRequest;
  /** The page's own filters (date range, city, venue, organiser) as a query string. */
  pageQuery: string;
  /** Those filters in words, for the export's heading. */
  view: string;
  underLine: number;
  onClose: () => void;
  onNarrow?: (req: DrawerRequest) => void;
}) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sort, setSort] = useState<string>("worst");
  const [outcome, setOutcome] = useState<string>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /** The page's filters, then the slice, then this drawer's own controls. */
  const listQuery = () => {
    const q2 = new URLSearchParams(pageQuery);
    sliceParams(request.slice).forEach((v, k) => q2.set(k, v));
    if (sort !== "worst") q2.set("sort", sort);
    if (outcome) q2.set("outcome", outcome);
    if (q) q2.set("q", q);
    return q2;
  };
  const sortLabel = SORTS.find(([k]) => k === sort)![1];
  const outcomeLabel = outcome ? OUTCOMES.find(([k]) => k === outcome)![1] : null;

  const qs = listQuery();
  qs.set("page", String(page));
  const { data, loading, error } = useAdminFetch<DrillResponse>(`/admin/analytics/games?${qs}`, {
    errorMessage: "Failed to load games.",
  });
  const d = data?.data;

  const onExport = async () => {
    const list = await fetchSliceGames(listQuery());
    const label = [request.label, outcomeLabel, q ? `“${q}”` : null, sortLabel.toLowerCase()].filter(Boolean).join(" · ");
    await downloadSheets("kasakai-games", [gameSheets.games("Games", label, view, underLine, list)]);
  };

  // Escape closes the innermost layer first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailId) setDetailId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[900] bg-[rgba(0,0,0,0.55)]" onClick={onClose} role="presentation" />
      <aside
        className="fixed inset-y-0 right-0 z-[901] flex w-[min(760px,100vw)] flex-col border-l border-border-2 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Games: ${request.label}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Games behind this number</div>
            <div className="mt-1 text-[16px] font-semibold text-fg">{request.label}</div>
            <div className="mt-1 font-mono text-[12px] text-muted">
              {d ? `${d.total} game${d.total === 1 ? "" : "s"} · ${sortLabel.toLowerCase()} · play dates in IST` : loading ? "Loading…" : ""}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {d?.total ? <ExportButton onExport={onExport} label="Excel ↓" className={TOPBAR_BTN} /> : null}
            {onNarrow && canNarrow(request.slice) ? (
              <button type="button" className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} onClick={() => onNarrow(request)}>
                Narrow the whole page to this
              </button>
            ) : null}
            <button type="button" className={TOPBAR_BTN} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
          <input
            type="search"
            className={`${FILTER_SELECT} min-w-[180px] flex-1`}
            placeholder="Search game, venue or organiser"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search games"
          />
          <select className={FILTER_SELECT} value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }} aria-label="Filter by outcome">
            {OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={FILTER_SELECT} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort games">
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? <div className={FORM_ERROR}>{error}</div> : null}
          {!d && loading ? <div className={LOADING_STATE}>Loading games…</div> : null}
          {d && d.rows.length === 0 ? <div className={LOADING_STATE}>No games match.</div> : null}
          {d && d.rows.length > 0 ? (
            <ul className={`m-0 flex list-none flex-col gap-px p-0 ${loading ? "opacity-60" : ""}`}>
              {d.rows.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(g.id)}
                    className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-x-4 gap-y-1 border border-transparent border-b-border-2 bg-transparent px-2 py-3 text-left hover:border-border-2 hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-fg">{g.title}</div>
                      <div className="mt-[2px] font-mono text-[11.5px] text-muted">{playDate(g.scheduledAt)}</div>
                      <div className="mt-[2px] truncate text-[12.5px] text-body">
                        {[g.venue, g.city, g.organiser, g.format].filter(Boolean).join(" · ")}
                      </div>
                      {g.status === "cancelled" && g.cancelReason ? (
                        <div className="mt-[2px] text-[12px] text-muted">{g.cancelReason}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-[6px]">
                      <Verdict g={g} />
                      <Meter value={g.fillPct} color={g.under || g.atRisk ? SERIES.under : SERIES.healthy} />
                      <div className="font-mono text-[11.5px] text-muted">
                        {g.seats}/{g.totalSlots} seats · min {g.minPlayers}
                        {g.waitlistEntries ? ` · ${g.waitlistEntries} waitlisted` : ""}
                      </div>
                      {g.fill24Pct != null ? (
                        <div className="font-mono text-[11.5px] text-muted">{Math.round(g.fill24Pct)}% full 24h before</div>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {d && d.pages > 1 ? (
          <footer className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-[12px] text-muted">
            <button type="button" className={pagerBtnCls(page <= 1)} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {d.page} of {d.pages}</span>
            <button type="button" className={pagerBtnCls(page >= d.pages)} disabled={page >= d.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </footer>
        ) : null}
      </aside>

      {detailId ? <GameDetailModal gameId={detailId} onClose={() => setDetailId(null)} /> : null}
    </>
  );
}
