"use client";

/* Everything that happened to the game, newest first (GET /admin/games/:id/timeline).
   Admin actions are badged — that is the audit log, readable by every admin. */

import { useState } from "react";
import { BADGE, BADGE_AMBER, BADGE_BLUE, BADGE_GRAY, BADGE_GREEN, BADGE_VIOLET, BADGE_RED, LOADING_STATE, FORM_ERROR, FILTER_SELECT } from "../styles";
import { formatCurrency, formatDateTime } from "../format";
import { useAdminFetch } from "../useAdminFetch";

type Event = { at: string; kind: string; text: string; amountPaise?: number; admin?: boolean };
const KIND_BADGE: Record<string, string> = {
  admin: BADGE_RED, money: BADGE_GREEN, teams: BADGE_VIOLET, roster: BADGE_BLUE, lifecycle: BADGE_AMBER, sos: BADGE_AMBER,
};

export function TimelineTab({ gameId }: { gameId: string }) {
  const { data, loading, error } = useAdminFetch<{ data?: { events: Event[]; truncated: boolean; total: number } }>(
    `/admin/games/${gameId}/timeline`, { errorMessage: "Could not load the timeline." });
  const [kind, setKind] = useState("");
  const events = (data?.data?.events || []).filter((e) => !kind || e.kind === kind);

  if (loading) return <div className={LOADING_STATE}>Loading timeline…</div>;
  if (error) return <div className={FORM_ERROR}>{error}</div>;

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <select className={FILTER_SELECT} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter events">
          <option value="">Everything</option>
          {["admin", "game", "roster", "lifecycle", "teams", "money", "sos"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        {data?.data?.truncated && <span className="text-[12px] text-muted">Newest {data.data.events.length} of {data.data.total}</span>}
      </div>
      {events.length === 0 && <div className="text-[13px] text-muted">Nothing here.</div>}
      <div className="flex flex-col border border-border">
        {events.map((e, i) => (
          <div key={`${e.at}-${i}`} className="flex items-start gap-3 border-b border-border-2 px-4 py-[10px] text-[13px] last:border-b-0">
            <span className="w-[130px] shrink-0 font-mono text-[11px] text-muted">{formatDateTime(e.at)}</span>
            <span className={`${BADGE} ${KIND_BADGE[e.kind] || BADGE_GRAY} shrink-0`}>{e.kind}</span>
            <span className="flex-1 text-body">{e.text}</span>
            {e.amountPaise != null && <span className="font-mono text-[12px]">{formatCurrency(e.amountPaise)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
