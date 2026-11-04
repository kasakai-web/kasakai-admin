"use client";

/* The Dashboard's "Power players" box and the list behind it, from one request
   (GET /admin/dashboard/power-players), so the count and the list cannot
   disagree. The rule lives on the server (utils/powerPlayers.js): 2+ games in
   each of 3+ Mon–Sun IST weeks within the last 30 days, counting played own
   seats as the Analytics page does. Admin-only — players are never told. Not
   the `freq:power` behaviour tag, which is a 90-day average. */

import { useEffect, useState } from "react";
import {
  PANEL, STAT_LABEL, STAT_VALUE, STAT_DELTA, NEUTRAL, TOPBAR_BTN, TOPBAR_BTN_PRIMARY, ACTION_BTN,
  FORM_ERROR, LOADING_STATE, SEARCH_INPUT,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { UserDetailModal } from "../shared/UserDetailModal";
import { ExportButton } from "../analytics/verdicts";
import { downloadSheets } from "../analytics/exportExcel";

type Week = { monday: string; start: string; end: string; partial: boolean };
type PowerPlayer = {
  id: string;
  name: string;
  phone: string | null;
  games: number;
  qualifyingWeeks: number;
  perWeek: number[];
  lastGameAt: string | null;
};
type PowerPlayersData = {
  generatedAt: string;
  rule: { windowDays: number; minGamesPerWeek: number; minWeeks: number; text: string };
  from: string;
  to: string;
  weeks: Week[];
  count: number;
  players: PowerPlayer[];
};

const PAGE = 100;
const ymdDate = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`);
const dayMonth = (ymd: string) =>
  ymdDate(ymd).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const weekLabel = (w: Week) => (w.start === w.end ? dayMonth(w.start) : `${dayMonth(w.start)} – ${dayMonth(w.end)}`);
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—";
const count = (n: number) => n.toLocaleString("en-IN");

function exportPlayers(d: PowerPlayersData) {
  const weekCols = d.weeks.map((w, i) => ({ header: `Week ${weekLabel(w)}${w.partial ? " (part)" : ""}`, key: `w${i}`, width: 20 }));
  return downloadSheets("kasakai-power-players", [{
    name: "Power players",
    notes: [
      `Power players (${d.count}) — ${dayMonth(d.from)} to ${dayMonth(d.to)}`,
      `Rule: ${d.rule.text}. Own seats in completed games, not marked absent or no-show; guests are not counted.`,
    ],
    columns: [
      { header: "Player", key: "name", width: 28 },
      { header: "Phone", key: "phone", width: 16 },
      { header: `Games (${d.rule.windowDays} days)`, key: "games", width: 14 },
      { header: `Weeks with ${d.rule.minGamesPerWeek}+`, key: "qualifyingWeeks", width: 14 },
      ...weekCols,
      { header: "Last game (IST)", key: "last", width: 18 },
    ],
    rows: d.players.map((p) => ({
      ...p,
      phone: p.phone ?? "",
      last: shortDate(p.lastGameAt),
      ...Object.fromEntries(p.perWeek.map((n, i) => [`w${i}`, n])),
    })),
  }]);
}

function PowerPlayersDrawer({ d, onClose }: { d: PowerPlayersData; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [userId, setUserId] = useState<string | null>(null);

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

  const q = query.trim().toLowerCase();
  const visible = d.players.filter((p) => !q || `${p.name} ${p.phone ?? ""}`.toLowerCase().includes(q));
  const min = d.rule.minGamesPerWeek;

  return (
    <>
      <div className="fixed inset-0 z-[900] bg-[rgba(0,0,0,0.55)]" onClick={onClose} role="presentation" />
      <aside
        className="fixed inset-y-0 right-0 z-[901] flex w-[min(760px,100vw)] flex-col border-l border-border-2 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Power players"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Admin only · players are not told</div>
            <div className="mt-1 text-[16px] font-semibold text-fg">Power players · {count(d.count)}</div>
            <div className="mt-1 font-mono text-[12px] text-muted">
              {d.rule.text} · {dayMonth(d.from)} – {dayMonth(d.to)}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {d.count ? <ExportButton label="Excel ↓" className={TOPBAR_BTN} onExport={() => exportPlayers(d)} /> : null}
            <button type="button" className={TOPBAR_BTN} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="flex flex-col gap-2 border-b border-border px-5 py-3">
          <input
            type="search"
            className={SEARCH_INPUT}
            placeholder="Find a player — name or phone"
            aria-label="Find a player"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          />
          <div className="font-mono text-[11.5px] text-muted">
            Games per week, oldest first: {d.weeks.map((w) => `${weekLabel(w)}${w.partial ? "*" : ""}`).join(" · ")}.
            {" "}Highlighted weeks have {min}+ games; * = only partly inside the {d.rule.windowDays} days.
            {" "}Own seats in completed games, not marked absent or no-show; guests not counted. Click a player for their details.
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!visible.length ? (
            <div className={LOADING_STATE}>{q ? `Nobody matches “${query.trim()}”.` : "No power players in the last 30 days."}</div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {visible.slice(0, shown).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setUserId(p.id)}
                    className="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 border border-transparent border-b-border-2 bg-transparent px-2 py-[10px] text-left hover:border-border-2 hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-fg">{p.name}</span>
                      <span className="block font-mono text-[11.5px] text-muted">{p.phone || "—"}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="flex gap-1" aria-label={`Games per week: ${p.perWeek.join(", ")}`}>
                        {p.perWeek.map((n, i) => (
                          <span
                            key={i}
                            title={`${weekLabel(d.weeks[i])}: ${n} game${n === 1 ? "" : "s"}`}
                            className={`inline-flex h-6 w-6 items-center justify-center border font-mono text-[11.5px] ${
                              n >= min ? "border-fg text-fg" : "border-border-2 text-muted"
                            }`}
                          >
                            {n}
                          </span>
                        ))}
                      </span>
                      <span className="w-[110px] text-right font-mono text-[11.5px] text-muted">
                        <span className="block text-body">{p.games} games</span>
                        <span className="block">last {shortDate(p.lastGameAt)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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

export function PowerPlayers() {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useAdminFetch<{ data?: PowerPlayersData }>("/admin/dashboard/power-players", {
    cache: true,
    errorMessage: "Failed to load power players.",
  });
  const d = data?.data ?? null;

  return (
    <div className={`${PANEL} mb-5 flex flex-wrap items-center justify-between gap-4`}>
      <div>
        <div className={STAT_LABEL}>Power players · last {d?.rule.windowDays ?? 30} days</div>
        <div className={STAT_VALUE}>{d ? count(d.count) : "—"}</div>
        {error ? (
          <div className={`${FORM_ERROR} mt-1`}>{error}</div>
        ) : (
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>
            {d ? `${d.rule.text}. Admin only — players are not told.` : loading ? "Loading…" : " "}
          </div>
        )}
      </div>
      <button
        type="button"
        className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`}
        disabled={!d}
        onClick={() => setOpen(true)}
      >
        View power players
      </button>
      {open && d ? <PowerPlayersDrawer d={d} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
