"use client";

import { useEffect, useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import {
  SUMMARY_THREE, SUMMARY_ITEM, STAT_LABEL, SUMMARY_VALUE, BADGE, BADGE_GREEN, BADGE_AMBER,
  BADGE_BLUE, BADGE_GRAY, TOOLBAR, SEARCH_INPUT, FILTER_SELECT, LOADING_STATE, NOTIF_FEED,
  NOTIF_ITEM, NOTIF_MSG, NOTIF_TIME,
} from "../shared/styles";
import { notifTimeAgo } from "../shared/format";
import { Head } from "../shared/components";

type AdminNotifRow = {
  _id: string; type: string; title: string; body: string;
  isRead: boolean; createdAt: string; recipientRole: string;
  recipientName?: string | null; recipientPhone?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  game_created: "Game Created", game_registered: "Registered",
  game_cancelled: "Cancelled", game_backout_player: "Player Backed Out",
  game_backout_organiser: "Organiser Backout", waitlist_joined: "Waitlist Join",
  waitlist_spot: "Spot Available", waitlist_approved: "Waitlist Approved",
  player_removed: "Removed", wallet_topup: "Top-up",
  wallet_debit: "Debit", refund_credited: "Refund", system: "System",
};

type NotifResponse = {
  success?: boolean;
  data?: {
    notifications?: AdminNotifRow[];
    total?: number;          // rows matching the active filters
    totalPages?: number;
  };
};

type NotifSummary = { total?: number; unread?: number; read?: number };

export function Notifications() {
  const [search, setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // ── Pagination — page + rows-per-page live in the URL (?page=2&limit=50) ──
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  // Debounced search — avoids one request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* Searching and the role filter run on the server: the notification log grows
     with every game, so a client-side filter over one fetched page would only
     ever search the rows that happened to be on screen. */
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (roleFilter !== "all")   params.set("role", roleFilter);

  const { data, loading } = useAdminFetch<NotifResponse>(`/admin/notifications?${params.toString()}`);

  /* Read / unread counts come from their own endpoint on a constant path, so
     they are counted once per visit rather than on every page change. */
  const { data: summaryBody, loading: summaryLoading } = useAdminFetch<{ data?: NotifSummary }>(
    "/admin/notifications/summary",
    { cache: true, errorMessage: "Failed to load notification totals." },
  );

  const notifs: AdminNotifRow[] = data?.success ? data.data?.notifications ?? [] : [];
  const total   = data?.data?.total ?? notifs.length;
  // Counted over every notification, so the cards hold still while paging.
  const summary = summaryBody?.data ?? {};

  return (
    <>
      <Head title="Platform Notifications" sub="In-app notifications across all users" />
      <div className={SUMMARY_THREE}>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total (DB)</div><div className={SUMMARY_VALUE}>{summaryLoading ? "—" : summary.total ?? 0}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Unread</div><div className={`${SUMMARY_VALUE} text-warning!`}>{summaryLoading ? "—" : summary.unread ?? 0}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Read</div><div className={`${SUMMARY_VALUE} text-success!`}>{summaryLoading ? "—" : summary.read ?? 0}</div></div>
      </div>
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search notifications…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        <select className={FILTER_SELECT} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); resetPage(); }}>
          <option value="all">All recipients</option>
          <option value="player">Players only</option>
          <option value="organiser">Organisers only</option>
        </select>
      </div>
      {loading ? (
        <div className={LOADING_STATE}>Loading…</div>
      ) : notifs.length === 0 ? (
        <div className="px-0 py-8 text-center text-[13px] text-muted">No notifications found.</div>
      ) : (
        <div className={NOTIF_FEED}>
          {notifs.map((n) => (
            <div key={n._id} className={NOTIF_ITEM}>
              <div className="flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`${BADGE} ${BADGE_GRAY}`}>{TYPE_LABEL[n.type] || n.type}</span>
                  <span className={`${BADGE} ${n.recipientRole === "organiser" ? BADGE_BLUE : BADGE_GRAY}`}>{n.recipientRole}</span>
                  {n.recipientName && (
                    <span className="text-[13px] font-semibold text-fg">
                      {n.recipientName}
                      {n.recipientPhone && (
                        <span className="ml-[6px] text-[11px] font-normal text-muted">
                          {n.recipientPhone}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className={NOTIF_MSG}><strong>{n.title}</strong> — {n.body}</div>
                <div className={NOTIF_TIME}>{notifTimeAgo(n.createdAt)}</div>
              </div>
              <span className={`${BADGE} ${n.isRead ? BADGE_GREEN : BADGE_AMBER}`}>{n.isRead ? "Read" : "Unread"}</span>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
        label="notifications"
      />
    </>
  );
}
