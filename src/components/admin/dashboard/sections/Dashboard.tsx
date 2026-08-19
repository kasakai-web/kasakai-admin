"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/context/dashboard-context";
import { getAdminToken } from "@/lib/admin-session";
import {
  STATS_GRID, QUICK_STATS, STAT_CARD, SUMMARY_ITEM, STAT_LABEL, STAT_VALUE, SUMMARY_VALUE,
  STAT_DELTA, NEUTRAL, TWO_COL, PANEL, PANEL_WARN, PANEL_TITLE, PANEL_SUB, FEED, FEED_ROW,
  FEED_TITLE, FEED_SUB, ACTION_BTN, TOPBAR_BTN, TOPBAR_BTN_PRIMARY,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { formatCurrency } from "../shared/format";

// Platform stats
type PlatformStats = {
  users: { players: number; organisers: number; total: number };
  games: { total: number; active: number; completed: number; cancelled: number };
  finance: { totalRevenuePaise: number; totalRefundedPaise: number; netRevenuePaise: number; totalWalletBalancePaise: number };
};

export function Dashboard() {
  const { onNavigate } = useDashboard();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    fetch(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.data); })
      .catch(() => {});
  }, []);

  const u  = stats?.users;
  const g  = stats?.games;
  const f  = stats?.finance;

  return (
    <>
      <div className={STATS_GRID}>
        <div className={STAT_CARD}>
          <div className={STAT_LABEL}>Total Users</div>
          <div className={STAT_VALUE}>{u ? u.total : "—"}</div>
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>{u ? `${u.players} players · ${u.organisers} organisers` : "Loading…"}</div>
        </div>
        <div className={STAT_CARD}>
          <div className={STAT_LABEL}>Active Games</div>
          <div className={STAT_VALUE}>{g ? g.active : "—"}</div>
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>{g ? `${g.total} total · ${g.completed} completed` : "Loading…"}</div>
        </div>
        <div className={STAT_CARD}>
          <div className={STAT_LABEL}>Net Revenue</div>
          <div className={STAT_VALUE}>{f ? formatCurrency(f.netRevenuePaise) : "—"}</div>
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>After refunds</div>
        </div>
        <div className={STAT_CARD}>
          <div className={STAT_LABEL}>Platform Wallet</div>
          <div className={STAT_VALUE}>{f ? formatCurrency(f.totalWalletBalancePaise) : "—"}</div>
          <div className={`${STAT_DELTA} ${NEUTRAL}`}>All player balances</div>
        </div>
      </div>

      <div className={TWO_COL}>
        <div className={`${PANEL} ${PANEL_WARN}`}>
          <div className={STAT_LABEL}>Action Required</div>
          <div className={PANEL_TITLE}>Review Pending Organisers</div>
          <div className={PANEL_SUB}>Check the Organisers section to approve or reject pending applications.</div>
          <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button" onClick={() => onNavigate("organisers")}>
            Review Now
          </button>
        </div>
        <div className={PANEL}>
          <div className={STAT_LABEL}>Quick Links</div>
          <div className={FEED}>
            <div className={FEED_ROW}><div><div className={FEED_TITLE}>Finance Overview</div><div className={FEED_SUB}>Player wallets &amp; organiser earnings</div></div><button className={ACTION_BTN} onClick={() => onNavigate("finance")} type="button">Go</button></div>
            <div className={FEED_ROW}><div><div className={FEED_TITLE}>Games &amp; Events</div><div className={FEED_SUB}>View registrations &amp; details</div></div><button className={ACTION_BTN} onClick={() => onNavigate("games")} type="button">Go</button></div>
            <div className={FEED_ROW}><div><div className={FEED_TITLE}>Notifications</div><div className={FEED_SUB}>Platform-wide notification log</div></div><button className={ACTION_BTN} onClick={() => onNavigate("notifications")} type="button">Go</button></div>
            <div className={FEED_ROW}><div><div className={FEED_TITLE}>Player Feedback</div><div className={FEED_SUB}>Post-game ratings &amp; comments</div></div><button className={ACTION_BTN} onClick={() => onNavigate("feedback")} type="button">Go</button></div>
          </div>
        </div>
      </div>

      <div className={QUICK_STATS}>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total Players</div><div className={SUMMARY_VALUE}>{u?.players ?? "—"}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total Organisers</div><div className={SUMMARY_VALUE}>{u?.organisers ?? "—"}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Games Completed</div><div className={SUMMARY_VALUE}>{g?.completed ?? "—"}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Games Cancelled</div><div className={SUMMARY_VALUE}>{g ? <span className="text-danger">{g.cancelled}</span> : "—"}</div></div>
      </div>
    </>
  );
}
