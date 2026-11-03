"use client";

/* The Dashboard's "Average games per day" and "Active players" boxes, from one
   request (GET /admin/dashboard/activity). Both numbers are worked out on the
   server by the same code the Analytics page uses — games per day is its verdict
   card, active players is the Players topic's monthly count — so nothing here
   re-derives either. Renders two grid cells, not a wrapper, so the boxes sit in
   the Dashboard's stats grid beside the revenue box. */

import { STAT_CARD, STAT_LABEL, STAT_VALUE, STAT_DELTA, NEUTRAL } from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { ChangeTag, StatusChip } from "../analytics/verdicts";
import { dayDate } from "../analytics/range";
import type { Area } from "../analytics/types";

type ActivePlayers = {
  /** "2026-10" — the current IST month, so far. */
  month: string;
  players: number;
  lastMonth: { month: string; players: number };
  /** Over the full months since the first one anybody played; null before then. */
  average: { players: number; months: number } | null;
  monthly: { month: string; players: number }[];
};

type Activity = {
  generatedAt: string;
  perDay: Area & { days: number; recentCompleted: number; priorCompleted: number };
  activePlayers: ActivePlayers;
};

const monthName = (ym: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long" }).format(dayDate(`${ym}-01`));

const count = (n: number) => n.toLocaleString("en-IN");

function GamesPerDayBox({ d, loading, error }: { d: Activity["perDay"] | null; loading: boolean; error: string }) {
  return (
    <div className={STAT_CARD}>
      <div className="mb-[10px] flex items-center justify-between gap-2">
        <span className={`${STAT_LABEL} mb-0!`}>Average games per day</span>
        {d ? <StatusChip status={d.status} /> : null}
      </div>
      <div className={STAT_VALUE}>
        {d?.figure ?? "—"}
        {d?.figure != null ? <span className="ml-2 text-[12px] font-normal text-muted">a day</span> : null}
      </div>
      {error ? (
        <div className={`${STAT_DELTA} text-danger`}>{error}</div>
      ) : !d ? (
        <div className={`${STAT_DELTA} ${NEUTRAL}`}>{loading ? "Loading…" : " "}</div>
      ) : (
        <div className="flex flex-col gap-1">
          {d.change ? <ChangeTag change={d.change} /> : null}
          <div className={`${STAT_DELTA} ${NEUTRAL}`} title={d.summary}>
            {count(d.recentCompleted)} completed in the last {d.days} days · {count(d.priorCompleted)} in the {d.days} before
          </div>
          {d.status === "insufficient" && !d.change ? (
            <div className={`${STAT_DELTA} ${NEUTRAL}`}>{d.summary}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ActivePlayersBox({ a, loading, error }: { a: ActivePlayers | null; loading: boolean; error: string }) {
  return (
    <div className={STAT_CARD} title="Players who played at least one completed game that month (not marked absent). Guests are not counted.">
      <div className={STAT_LABEL}>Active players {a ? `· ${monthName(a.month)}` : "this month"}</div>
      <div className={STAT_VALUE}>
        {a ? count(a.players) : "—"}
        {a ? <span className="ml-2 text-[12px] font-normal text-muted">so far</span> : null}
      </div>
      {error ? (
        <div className={`${STAT_DELTA} text-danger`}>{error}</div>
      ) : !a ? (
        <div className={`${STAT_DELTA} ${NEUTRAL}`}>{loading ? "Loading…" : " "}</div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>
            Last month ({monthName(a.lastMonth.month)}): <b className="font-medium text-fg">{count(a.lastMonth.players)}</b>
          </div>
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>
            {a.average ? (
              <>
                Monthly average: <b className="font-medium text-fg">{count(a.average.players)}</b>{" "}
                (last {a.average.months === 1 ? "full month" : `${a.average.months} full months`})
              </>
            ) : "No full month played yet"}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivityBoxes() {
  const { data, loading, error } = useAdminFetch<{ data?: Activity }>("/admin/dashboard/activity", {
    cache: true,
    errorMessage: "Failed to load.",
  });
  const activity = data?.data ?? null;
  return (
    <>
      <GamesPerDayBox d={activity?.perDay ?? null} loading={loading} error={error} />
      <ActivePlayersBox a={activity?.activePlayers ?? null} loading={loading} error={error} />
    </>
  );
}
