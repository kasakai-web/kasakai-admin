"use client";

/* The players behind any number on the Players topic — GET
   /admin/analytics/players/list filters the same per-player facts with the same
   predicate the number was counted with, so the list and the number agree.

   PlayerBaseList is the list itself (the New players block shows it inline);
   PlayerBaseDrawer is the same list in the side drawer that the verdict cards,
   findings and month bars open. A row opens that player's full report. */

import { useEffect, useState } from "react";
import {
  BADGE, BADGE_AMBER, BADGE_BLUE, BADGE_GRAY, BADGE_GREEN, BADGE_RED, FORM_ERROR, LOADING_STATE, SEARCH_INPUT, TOPBAR_BTN, ACTION_BTN,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { MetricSwitch } from "./charts";
import { ExportButton } from "./verdicts";
import { downloadSheets } from "./exportExcel";
import type { ApiResponse, PlayerListData, PlayerListKind } from "./types";

export type PlayerListAsk = {
  kind: PlayerListKind;
  /** Plain description for the header and the export. */
  label: string;
  /** Open pre-filtered to this tag. */
  tag?: string;
  /** Month lists: "2026-09". */
  month?: string;
};

/* Tags are the backend's words (LISTS in admin.playerAnalytics.controller.js). */
const TAG_BADGE: Record<string, string> = {
  Played: BADGE_GREEN, "Back within 30 days": BADGE_GREEN, "Came back": BADGE_GREEN, Returning: BADGE_GREEN,
  "First-timer": BADGE_BLUE,
  "Not played yet": BADGE_AMBER, "Not back yet": BADGE_AMBER, "One game so far": BADGE_AMBER,
  Unverified: BADGE_RED, "Low conduct": BADGE_RED,
};
const PAGE = 100;

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—";

export function PlayerBaseList({ ask, rangeQuery, onPlayer }: {
  ask: PlayerListAsk;
  /** from/to — the page's range, or a block's own. */
  rangeQuery: string;
  onPlayer: (id: string) => void;
}) {
  const [tag, setTag] = useState(ask.tag ?? "all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const qs = new URLSearchParams(rangeQuery);
  qs.set("kind", ask.kind);
  if (ask.month) qs.set("month", ask.month);
  const { data, loading, error } = useAdminFetch<ApiResponse<PlayerListData>>(`/admin/analytics/players/list?${qs}`, {
    errorMessage: "Failed to load players.",
  });
  const d = data?.data;
  const rows = d?.rows ?? [];
  const tags = [...new Set(rows.map((r) => r.tag).filter((t): t is string => !!t))];
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) =>
    (tag === "all" || r.tag === tag) && (!q || `${r.name} ${r.phone ?? ""}`.toLowerCase().includes(q)));
  const pick = (next: () => void) => {
    next();
    setShown(PAGE);
  };

  if (error) return <div className={FORM_ERROR}>{error}</div>;
  if (!d) return <div className={LOADING_STATE}>Loading players…</div>;

  const onExport = () => downloadSheets(`kasakai-players-${ask.kind}`, [{
    name: "Players",
    notes: [ask.label, `${visible.length} players${tag === "all" ? "" : ` · ${tag}`}${q ? ` · matching “${query.trim()}”` : ""}`],
    columns: [
      { header: "Player", key: "name", width: 28 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Joined", key: "joined", width: 14 },
      { header: "First game", key: "first", width: 14 },
      { header: "Last game", key: "last", width: 14 },
      { header: "Games played", key: "games", width: 13 },
      ...(ask.kind === "rated" ? [{ header: "Conduct ★", key: "conduct", width: 10 }] : []),
      { header: "Tag", key: "tag", width: 20 },
    ],
    rows: visible.map((r) => ({
      ...r, joined: shortDate(r.joinedAt), first: shortDate(r.firstGameAt), last: shortDate(r.lastGameAt),
    })),
  }]);

  return (
    <div className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {tags.length ? (
          <MetricSwitch<string>
            label="Filter by tag"
            value={tag}
            onChange={(k) => pick(() => setTag(k))}
            options={[
              { key: "all", label: `All · ${rows.length}` },
              ...tags.map((t) => ({ key: t, label: `${t} · ${rows.filter((r) => r.tag === t).length}` })),
            ]}
          />
        ) : (
          <span className="font-mono text-[12px] text-muted">{d.total} player{d.total === 1 ? "" : "s"}</span>
        )}
        <input
          type="search"
          className={`${SEARCH_INPUT} min-w-[180px]!`}
          placeholder="Find a player — name or phone"
          aria-label="Find a player"
          value={query}
          onChange={(e) => pick(() => setQuery(e.target.value))}
        />
        {visible.length ? <ExportButton label="Excel ↓" className={TOPBAR_BTN} onExport={onExport} /> : null}
      </div>
      {d.total > rows.length ? (
        <div className="font-mono text-[11.5px] text-muted">Showing the first {rows.length} of {d.total}.</div>
      ) : null}

      {!visible.length ? <div className={LOADING_STATE}>{q ? `Nobody matches “${query.trim()}”.` : "No players."}</div> : (
        <ul className="m-0 flex list-none flex-col gap-px p-0">
          {visible.slice(0, shown).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPlayer(r.id)}
                title="Open the full report"
                className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 border border-transparent border-b-border-2 bg-transparent px-2 py-[10px] text-left hover:border-border-2 hover:bg-[rgba(255,255,255,0.03)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-fg">{r.name}</span>
                  <span className="block font-mono text-[11.5px] text-muted">
                    {r.phone || "—"} · joined {shortDate(r.joinedAt)}
                    {r.firstGameAt ? ` · first game ${shortDate(r.firstGameAt)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-right font-mono text-[11.5px] text-muted">
                    <span className="block text-body">
                      {r.games} game{r.games === 1 ? "" : "s"}
                      {ask.kind === "rated" && r.conduct != null ? ` · ★ ${r.conduct.toFixed(1)}` : ""}
                    </span>
                    {r.lastGameAt ? <span className="block">last {shortDate(r.lastGameAt)}</span> : null}
                  </span>
                  {r.tag ? <span className={`${BADGE} ${TAG_BADGE[r.tag] ?? BADGE_GRAY} w-[130px] justify-center`}>{r.tag}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {visible.length > shown ? (
        <div className="flex justify-center py-1">
          <button type="button" className={ACTION_BTN} onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PlayerBaseDrawer({ ask, rangeQuery, onPlayer, onClose }: {
  ask: PlayerListAsk;
  rangeQuery: string;
  onPlayer: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[900] bg-[rgba(0,0,0,0.55)]" onClick={onClose} role="presentation" />
      <aside
        className="fixed inset-y-0 right-0 z-[901] flex w-[min(760px,100vw)] flex-col border-l border-border-2 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Players: ${ask.label}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Players behind this number</div>
            <div className="mt-1 text-[16px] font-semibold text-fg">{ask.label}</div>
          </div>
          <button type="button" className={TOPBAR_BTN} onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PlayerBaseList ask={ask} rangeQuery={rangeQuery} onPlayer={onPlayer} />
        </div>
      </aside>
    </>
  );
}
