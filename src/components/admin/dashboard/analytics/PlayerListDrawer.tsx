"use client";

/* The players behind "unique players" — GET /admin/analytics/unique-players,
   built from the same stages as the count, so the list and the number agree.

   From the "players turning up" finding it shows the two windows that trend
   compares, each player tagged against the other window (new / returning, or
   returning / stopped). From the Players KPI it lists everyone in the view.
   Same shell as the games drawer; a row opens that player's details, and the
   lists download to Excel. */

import { useEffect, useState } from "react";
import {
  BADGE, BADGE_AMBER, BADGE_BLUE, BADGE_GREEN, FORM_ERROR, LOADING_STATE, SEARCH_INPUT, TOPBAR_BTN, ACTION_BTN,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { UserDetailModal } from "../shared/UserDetailModal";
import { MetricSwitch } from "./charts";
import { ExportButton } from "./verdicts";
import { downloadSheets, playerListSheets } from "./exportExcel";
import type { ApiResponse, UniquePlayer, UniquePlayersData } from "./types";

export type PlayerListRequest = {
  /** The two compared windows, rather than the whole view. */
  compare: boolean;
  label: string;
};

type Tag = NonNullable<UniquePlayer["tag"]>;
const TAG: Record<Tag, { text: string; badge: string }> = {
  new: { text: "New", badge: BADGE_GREEN },
  returning: { text: "Returning", badge: BADGE_BLUE },
  stopped: { text: "Stopped", badge: BADGE_AMBER },
};
const PAGE = 100;

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—";

export function PlayerListDrawer({ request, pageQuery, view, onClose }: {
  request: PlayerListRequest;
  /** The page's own filters, as a query string. */
  pageQuery: string;
  /** Those filters in words, for the export's heading. */
  view: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"recent" | "prior">("recent");
  const [tag, setTag] = useState<"all" | Tag>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [userId, setUserId] = useState<string | null>(null);

  const qs = new URLSearchParams(pageQuery);
  if (request.compare) qs.set("scope", "compare");
  const { data, loading, error } = useAdminFetch<ApiResponse<UniquePlayersData>>(
    `/admin/analytics/unique-players?${qs}`,
    { errorMessage: "Failed to load players." },
  );
  const d = data?.data;

  // Escape closes the innermost layer first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (userId) setUserId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  const list = !d ? [] : d.compare ? d[tab] : d.players;
  const q = query.trim().toLowerCase();
  const visible = list.filter((p) =>
    (tag === "all" || p.tag === tag) && (!q || `${p.name} ${p.phone ?? ""}`.toLowerCase().includes(q)));
  const tagKeys: Tag[] = tab === "recent" ? ["new", "returning"] : ["returning", "stopped"];
  const pick = (next: () => void) => {
    next();
    setShown(PAGE);
  };

  return (
    <>
      <div className="fixed inset-0 z-[900] bg-[rgba(0,0,0,0.55)]" onClick={onClose} role="presentation" />
      <aside
        className="fixed inset-y-0 right-0 z-[901] flex w-[min(760px,100vw)] flex-col border-l border-border-2 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Players: ${request.label}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Players behind this number</div>
            <div className="mt-1 text-[16px] font-semibold text-fg">{request.label}</div>
            <div className="mt-1 font-mono text-[12px] text-muted">
              {d
                ? d.compare
                  ? `${d.recent.length} in ${d.recentLabel} · ${d.prior.length} in ${d.label}`
                  : `${d.players.length} players · own seats, guests excluded`
                : loading ? "Loading…" : ""}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {d ? (
              <ExportButton
                label="Excel ↓"
                className={TOPBAR_BTN}
                onExport={() => downloadSheets("kasakai-players", playerListSheets(d, view))}
              />
            ) : null}
            <button type="button" className={TOPBAR_BTN} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        {d ? (
          <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {d.compare ? (
                <MetricSwitch<"recent" | "prior">
                  label="Period"
                  value={tab}
                  onChange={(k) => pick(() => { setTab(k); setTag("all"); })}
                  options={[
                    { key: "recent", label: `Recent · ${d.recent.length}` },
                    { key: "prior", label: `Before · ${d.prior.length}` },
                  ]}
                />
              ) : null}
              {d.compare ? (
                <MetricSwitch<"all" | Tag>
                  label="Compared with the other period"
                  value={tag}
                  onChange={(k) => pick(() => setTag(k))}
                  options={[
                    { key: "all", label: `All · ${list.length}` },
                    ...tagKeys.map((k) => ({ key: k, label: `${TAG[k].text} · ${list.filter((p) => p.tag === k).length}` })),
                  ]}
                />
              ) : null}
            </div>
            <input
              type="search"
              className={SEARCH_INPUT}
              placeholder="Find a player — name or phone"
              aria-label="Find a player"
              value={query}
              onChange={(e) => pick(() => setQuery(e.target.value))}
            />
            {d.compare ? (
              <div className="font-mono text-[11.5px] text-muted">
                {tab === "recent"
                  ? `New = did not play in ${d.label}; Returning = played in both.`
                  : "Returning = also played in the recent period; Stopped = has not played since."}
                {" "}Most games first. Click a player for their details.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error ? <div className={FORM_ERROR}>{error}</div> : null}
          {!d && loading ? <div className={LOADING_STATE}>Loading players…</div> : null}
          {d && !visible.length ? <div className={LOADING_STATE}>{q ? `Nobody matches “${query.trim()}”.` : "No players."}</div> : null}
          {visible.length ? (
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {visible.slice(0, shown).map((p, i) => (
                <li key={(p.id ?? "none") + i}>
                  <button
                    type="button"
                    disabled={!p.id}
                    onClick={() => p.id && setUserId(p.id)}
                    className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 border border-transparent border-b-border-2 bg-transparent px-2 py-[10px] text-left enabled:hover:border-border-2 enabled:hover:bg-[rgba(255,255,255,0.03)] disabled:cursor-default"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-fg">{p.name}</span>
                      <span className="block font-mono text-[11.5px] text-muted">{p.phone || "—"}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-right font-mono text-[11.5px] text-muted">
                        <span className="block text-body">{p.games} game{p.games === 1 ? "" : "s"}</span>
                        <span className="block">last {shortDate(p.lastGameAt)}</span>
                      </span>
                      {p.tag ? <span className={`${BADGE} ${TAG[p.tag].badge} w-[86px] justify-center`}>{TAG[p.tag].text}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {visible.length > shown ? (
            <div className="flex justify-center py-3">
              <button type="button" className={ACTION_BTN} onClick={() => setShown((n) => n + PAGE)}>
                Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {userId ? <UserDetailModal userId={userId} onClose={() => setUserId(null)} /> : null}
    </>
  );
}
