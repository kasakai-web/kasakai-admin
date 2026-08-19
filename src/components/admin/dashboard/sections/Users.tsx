"use client";

import { useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  SECTION_TITLE, BADGE, BADGE_BLUE, BADGE_GRAY, TOOLBAR, SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP,
  TABLE, ACTION_BTN, ACTIONS, FORM_ERROR, LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_LARGE,
  MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL, GAME_INFO_GRID, BLOCK_TITLE,
  BLOCK_TITLE_SUCCESS,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import {
  formatDate, formatCurrency, formatDateTime, formatStatusLabel, badgeClassForStatus,
  daysAgoLabel, stalenessClass,
} from "../shared/format";
import { Head, Avatar, InfoCell } from "../shared/components";

type AdminUserRow = {
  id: string; name: string; phone: string; email?: string | null;
  role: "player" | "organiser"; isVerified?: boolean;
  profileImage?: string | null;
  gamesPlayed?: number; gamesHosted?: number;
  noShowCount?: number; backoutCount?: number;
  rating?: number;
  // player-specific conduct/gameplay averages (from organiser ratings)
  conductRating?: number | null; gameplayRating?: number | null; ratingCount?: number;
  // player-specific wallet fields
  totalSpentPaise?: number; walletBalancePaise?: number;
  // organiser-specific
  earningsPaise?: number; pendingPayoutPaise?: number;
  cancellationRate?: number;
  joinedAt?: string | null; status: string; location?: string | null;
  // engagement — games that actually happened (played for a player, hosted for an organiser)
  completedGames?: number; lastGameAt?: string | null; daysSinceLastGame?: number | null;
};

// ── User detail drawer (GET /admin/users/:id/details) ────────────────────────
type UserDetailGame = {
  id: string; title: string; format?: string | null; status?: string | null;
  scheduledAt?: string | null; venue?: string | null;
  organiserName?: string | null; organiserPhone?: string | null;
  feeInPaise?: number;
  // player rows
  registered?: boolean; attended?: string; attendanceMarked?: boolean;
  paymentStatus?: string | null; amountPaidPaise?: number;
  signedUpAt?: string | null; optedOut?: boolean; optedOutReason?: string | null;
  backedOut?: boolean; backedOutAt?: string | null; backoutType?: "pre_cutoff" | "post_cutoff" | null;
  removed?: boolean; removedAt?: string | null;
  guestCount?: number; guestNames?: string[];
  // organiser rows
  registrations?: number; presentCount?: number; revenuePaise?: number;
  cancelReason?: string | null;
};

type UserDetailTxn = {
  id: string; type: string; amountPaise: number; balanceAfterPaise?: number;
  description?: string | null; gameTitle?: string | null; status?: string;
  createdAt?: string | null;
};

type UserDetail = {
  role: "player" | "organiser";
  profile: {
    id: string; name: string; phone: string; whatsappNumber?: string | null;
    email?: string | null; profileImage?: string | null; isVerified?: boolean;
    status: string; location?: string | null;
    joinedAt?: string | null; daysSinceJoined?: number | null;
    referralCode?: string | null; invitedCount?: number;
    preferences?: { positions?: string[]; preferredFormat?: string | null; skillLevel?: string | null; preferredLocations?: string[] };
    pass?: { type: string; label: string; startDate?: string | null; expiryDate?: string | null } | null;
    approvalStatus?: string; approvedAt?: string | null; suspendReason?: string | null;
  };
  activity: {
    totalRegistrations?: number; gamesPlayed: number; gamesAttended?: number;
    upcomingGames?: number; cancelledOnThem?: number; optedOutCount?: number;
    noShowCount?: number; backoutCount?: number; guestsBrought?: number;
    firstPlayedAt?: string | null; lastPlayedAt?: string | null;
    daysSinceLastGame?: number | null; neverPlayed: boolean;
    feedbackSubmitted?: number;
    // organiser-only
    totalGames?: number; completedGames?: number; cancelledGames?: number;
    distinctPlayersServed?: number; cancellationRate?: number;
  };
  ratings: { conduct?: number | null; gameplay?: number | null; count: number; average?: number };
  wallet?: {
    balancePaise: number; lockedPaise: number; totalTopUpPaise: number;
    totalSpentPaise: number; totalRefundedPaise: number;
    lastTopUpAt?: string | null; lastTopUpPaise?: number;
  };
  earnings?: { totalRevenuePaise: number; totalEarningsPaise: number; pendingPayoutPaise: number };
  games: UserDetailGame[];
  gamesTruncated?: boolean;
  transactions?: UserDetailTxn[];
};

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, loading, error } = useAdminFetch<{ success?: boolean; data?: UserDetail; message?: string }>(
    `/admin/users/${userId}/details`,
    { errorMessage: "Failed to load user details." },
  );
  const detail = data?.success ? data.data ?? null : null;

  const p = detail?.profile;
  const a = detail?.activity;
  const isPlayer = detail?.role === "player";

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className="flex items-center gap-3">
            {p && <Avatar name={p.name} src={p.profileImage} size={44} />}
            <div>
              <div className={SECTION_TITLE}>{p?.name || "User Details"}</div>
              {p && (
                <div className="mt-[6px] flex flex-wrap items-center gap-2">
                  <span className={`${BADGE} ${isPlayer ? BADGE_GRAY : BADGE_BLUE}`}>{isPlayer ? "Player" : "Organiser"}</span>
                  <span className={`${BADGE} ${badgeClassForStatus(p.status)}`}>{formatStatusLabel(p.status)}</span>
                  <span className="text-[13px] text-muted">{p.phone}</span>
                  {p.email && <span className="text-[13px] text-muted">· {p.email}</span>}
                </div>
              )}
            </div>
          </div>
          <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
        </div>

        {loading && <div className={LOADING_STATE}>Loading user details…</div>}
        {error   && <div className={FORM_ERROR}>{error}</div>}

        {detail && p && a && (
          <div className="max-h-[calc(85vh-130px)] overflow-y-auto">

            {/* Engagement callout — the headline the business team is scanning for */}
            <div
              className={`mb-5 border px-4 py-3 text-[13.5px] ${
                a.neverPlayed
                  ? "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.07)] text-danger"
                  : (a.daysSinceLastGame ?? 0) > 60
                    ? "border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] text-warning"
                    : "border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.06)] text-success"
              }`}
            >
              {a.neverPlayed ? (
                <>
                  <strong>Never {isPlayer ? "played a game" : "hosted a completed game"}</strong>
                  {" — "}signed up {formatDate(p.joinedAt)}
                  {p.daysSinceJoined != null && ` (${p.daysSinceJoined} days ago)`}.
                </>
              ) : (
                <>
                  <strong>Last {isPlayer ? "played" : "hosted"} {formatDate(a.lastPlayedAt)}</strong>
                  {" — "}{daysAgoLabel(a.daysSinceLastGame)} · {a.gamesPlayed} game{a.gamesPlayed === 1 ? "" : "s"}{" "}
                  {isPlayer ? "played" : "hosted"} since {formatDate(a.firstPlayedAt)}.
                </>
              )}
            </div>

            {/* Activity stats */}
            <div className={BLOCK_TITLE_SUCCESS}>Activity</div>
            <div className={GAME_INFO_GRID}>
              {isPlayer ? (
                <>
                  <InfoCell label="Games Played" value={a.gamesPlayed} tone="font-semibold text-fg!" />
                  <InfoCell label="Marked Present" value={a.gamesAttended ?? 0} />
                  <InfoCell label="Total Registrations" value={a.totalRegistrations ?? 0} />
                  <InfoCell label="Upcoming Games" value={a.upcomingGames ?? 0} tone={(a.upcomingGames ?? 0) > 0 ? "text-info" : undefined} />
                  <InfoCell label="Last Played" value={a.lastPlayedAt ? formatDate(a.lastPlayedAt) : "Never"} tone={stalenessClass(a.neverPlayed ? null : a.daysSinceLastGame)} />
                  <InfoCell label="First Played" value={a.firstPlayedAt ? formatDate(a.firstPlayedAt) : "—"} />
                  <InfoCell label="No-Shows" value={a.noShowCount ?? 0} tone={(a.noShowCount ?? 0) > 0 ? "text-danger" : undefined} />
                  <InfoCell label="Backouts" value={a.backoutCount ?? 0} tone={(a.backoutCount ?? 0) > 0 ? "text-warning" : undefined} />
                  <InfoCell label="Opted Out" value={a.optedOutCount ?? 0} />
                  <InfoCell label="Cancelled On Them" value={a.cancelledOnThem ?? 0} />
                  <InfoCell label="Guests Brought" value={a.guestsBrought ?? 0} />
                  <InfoCell label="Feedback Given" value={a.feedbackSubmitted ?? 0} />
                </>
              ) : (
                <>
                  <InfoCell label="Games Hosted (Done)" value={a.completedGames ?? 0} tone="font-semibold text-fg!" />
                  <InfoCell label="Games Created" value={a.totalGames ?? 0} />
                  <InfoCell label="Upcoming Games" value={a.upcomingGames ?? 0} tone={(a.upcomingGames ?? 0) > 0 ? "text-info" : undefined} />
                  <InfoCell label="Cancelled Games" value={a.cancelledGames ?? 0} tone={(a.cancelledGames ?? 0) > 0 ? "text-danger" : undefined} />
                  <InfoCell label="Last Hosted" value={a.lastPlayedAt ? formatDate(a.lastPlayedAt) : "Never"} tone={stalenessClass(a.neverPlayed ? null : a.daysSinceLastGame)} />
                  <InfoCell label="First Hosted" value={a.firstPlayedAt ? formatDate(a.firstPlayedAt) : "—"} />
                  <InfoCell label="Total Registrations" value={a.totalRegistrations ?? 0} />
                  <InfoCell label="Distinct Players" value={a.distinctPlayersServed ?? 0} />
                  <InfoCell label="Cancellation Rate" value={`${a.cancellationRate ?? 0}%`} />
                </>
              )}
            </div>

            {/* Profile */}
            <div className={BLOCK_TITLE}>Profile</div>
            <div className={GAME_INFO_GRID}>
              <InfoCell label="Phone" value={p.phone || "—"} />
              <InfoCell label="WhatsApp" value={p.whatsappNumber || "—"} />
              <InfoCell label="Email" value={p.email || "—"} />
              <InfoCell label="Location" value={p.location || "—"} />
              <InfoCell label="Joined" value={<>{formatDate(p.joinedAt)}{p.daysSinceJoined != null && <span className="ml-[6px] text-[11px] text-muted">({p.daysSinceJoined}d)</span>}</>} />
              <InfoCell label="Verified" value={p.isVerified ? "Yes" : "No"} tone={p.isVerified ? "text-success" : "text-warning"} />
              {isPlayer ? (
                <>
                  <InfoCell label="Skill Level" value={formatStatusLabel(p.preferences?.skillLevel || undefined)} />
                  <InfoCell label="Preferred Format" value={p.preferences?.preferredFormat || "—"} />
                  <InfoCell label="Positions" value={(p.preferences?.positions || []).join(", ") || "—"} />
                  <InfoCell label="Referral Code" value={p.referralCode || "—"} />
                  <InfoCell label="Players Invited" value={p.invitedCount ?? 0} />
                  <InfoCell
                    label="Active Pass"
                    value={p.pass ? <>{p.pass.label}<div className="text-[11px] text-muted">till {formatDate(p.pass.expiryDate)}</div></> : "None"}
                    tone={p.pass ? "text-violet" : undefined}
                  />
                  <InfoCell label="Conduct Rating" value={detail.ratings.conduct ? `★ ${detail.ratings.conduct.toFixed(1)}` : "—"} tone="text-warning" />
                  <InfoCell label="Gameplay Rating" value={detail.ratings.gameplay ? `★ ${detail.ratings.gameplay.toFixed(1)}` : "—"} tone="text-warning" />
                  <InfoCell label="Ratings Received" value={detail.ratings.count} />
                </>
              ) : (
                <>
                  <InfoCell label="Approval" value={formatStatusLabel(p.approvalStatus)} />
                  <InfoCell label="Approved On" value={formatDate(p.approvedAt)} />
                  <InfoCell label="Rating" value={detail.ratings.average ? `★ ${detail.ratings.average.toFixed(1)}` : "—"} tone="text-warning" />
                  <InfoCell label="Ratings Received" value={detail.ratings.count} />
                  {p.suspendReason && <InfoCell label="Suspend Reason" value={p.suspendReason} tone="text-danger" />}
                </>
              )}
            </div>

            {/* Money */}
            <div className={BLOCK_TITLE}>{isPlayer ? "Wallet" : "Earnings"}</div>
            <div className={GAME_INFO_GRID}>
              {isPlayer && detail.wallet ? (
                <>
                  <InfoCell label="Balance" value={formatCurrency(detail.wallet.balancePaise)} tone="font-semibold text-success!" />
                  <InfoCell label="Locked" value={formatCurrency(detail.wallet.lockedPaise)} tone="text-warning" />
                  <InfoCell label="Total Top-Up" value={formatCurrency(detail.wallet.totalTopUpPaise)} />
                  <InfoCell label="Total Spent" value={formatCurrency(detail.wallet.totalSpentPaise)} tone="text-danger" />
                  <InfoCell label="Total Refunded" value={formatCurrency(detail.wallet.totalRefundedPaise)} />
                  <InfoCell
                    label="Last Top-Up"
                    value={detail.wallet.lastTopUpAt
                      ? <>{formatDate(detail.wallet.lastTopUpAt)}<div className="text-[11px] text-muted">{formatCurrency(detail.wallet.lastTopUpPaise)}</div></>
                      : "Never"}
                    tone={detail.wallet.lastTopUpAt ? undefined : "text-danger"}
                  />
                </>
              ) : detail.earnings ? (
                <>
                  <InfoCell label="Collected From Games" value={formatCurrency(detail.earnings.totalRevenuePaise)} tone="font-semibold text-success!" />
                  <InfoCell label="Recorded Earnings" value={formatCurrency(detail.earnings.totalEarningsPaise)} />
                  <InfoCell label="Pending Payout" value={formatCurrency(detail.earnings.pendingPayoutPaise)} tone="text-warning" />
                </>
              ) : null}
            </div>

            {/* Game history */}
            <div className={BLOCK_TITLE_SUCCESS}>
              {isPlayer ? "Game History" : "Games Hosted"} ({detail.games.length}{detail.gamesTruncated ? "+" : ""})
            </div>
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  {isPlayer ? (
                    <tr><th>Date</th><th>Game</th><th>Venue</th><th>Organiser</th><th>Status</th><th>Attended</th><th>Paid</th><th>Guests</th></tr>
                  ) : (
                    <tr><th>Date</th><th>Game</th><th>Venue</th><th>Format</th><th>Status</th><th>Players</th><th>Present</th><th>Revenue</th></tr>
                  )}
                </thead>
                <tbody>
                  {detail.games.length === 0 && (
                    <tr><td colSpan={8} className="p-8! text-center text-muted!">
                      {isPlayer ? "This user has never registered for a game." : "This organiser has never created a game."}
                    </td></tr>
                  )}
                  {detail.games.map((g) => (
                    <tr key={g.id}>
                      <td className="whitespace-nowrap!">{formatDateTime(g.scheduledAt)}</td>
                      <td>{g.title}{isPlayer && g.format && <div className="text-[11px] text-muted">{g.format}</div>}</td>
                      <td>{g.venue || "—"}</td>
                      {isPlayer ? (
                        <>
                          <td>{g.organiserName || "—"}</td>
                          <td>
                            <span className={`${BADGE} ${badgeClassForStatus(g.status || undefined)}`}>{formatStatusLabel(g.status || undefined)}</span>
                            {g.backedOut ? (
                              <div className="mt-[3px] text-[11px] text-warning" title={g.backedOutAt ? formatDateTime(g.backedOutAt) : undefined}>
                                Backed out{g.backoutType === "post_cutoff" ? " (after cutoff)" : ""}
                              </div>
                            ) : g.removed ? (
                              // Not the player's doing — kept visually distinct from a backout.
                              <div className="mt-[3px] text-[11px] text-muted" title={g.removedAt ? formatDateTime(g.removedAt) : undefined}>
                                Removed by organiser
                              </div>
                            ) : g.optedOut ? (
                              <div className="mt-[3px] text-[11px] text-warning">Opted out{g.optedOutReason === "format_change" ? " (format change)" : ""}</div>
                            ) : null}
                          </td>
                          <td>
                            {g.attendanceMarked
                              ? <span className={`${BADGE} ${badgeClassForStatus(g.attended)}`}>{formatStatusLabel(g.attended)}</span>
                              : <span className="text-[12px] text-muted">Not marked</span>}
                          </td>
                          <td>{formatCurrency(g.amountPaidPaise)}<div className="text-[11px] text-muted">{formatStatusLabel(g.paymentStatus || undefined)}</div></td>
                          <td>{(g.guestCount ?? 0) > 0 ? <span title={(g.guestNames || []).join(", ")}>{g.guestCount}</span> : "—"}</td>
                        </>
                      ) : (
                        <>
                          <td>{g.format || "—"}</td>
                          <td><span className={`${BADGE} ${badgeClassForStatus(g.status || undefined)}`}>{formatStatusLabel(g.status || undefined)}</span></td>
                          <td>{g.registrations ?? 0}</td>
                          <td>{g.presentCount ?? 0}</td>
                          <td className="text-success!">{formatCurrency(g.revenuePaise)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.gamesTruncated && (
              <div className="mt-2 text-[12px] text-muted">Showing the {detail.games.length} most recent games only.</div>
            )}

            {/* Wallet transactions (players only) */}
            {isPlayer && (detail.transactions?.length ?? 0) > 0 && (
              <>
                <div className={`${BLOCK_TITLE} mt-5!`}>Recent Wallet Transactions ({detail.transactions!.length})</div>
                <div className={TABLE_WRAP}>
                  <table className={TABLE}>
                    <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Game</th><th>Description</th><th>Status</th></tr></thead>
                    <tbody>
                      {detail.transactions!.map((t) => (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap!">{formatDateTime(t.createdAt)}</td>
                          <td><span className={`${BADGE} ${BADGE_GRAY}`}>{formatStatusLabel(t.type)}</span></td>
                          <td className={["topup", "refund", "bonus", "unlock"].includes(t.type) ? "text-success!" : "text-danger!"}>
                            {formatCurrency(t.amountPaise)}
                          </td>
                          <td>{formatCurrency(t.balanceAfterPaise)}</td>
                          <td>{t.gameTitle || "—"}</td>
                          <td>{t.description || "—"}</td>
                          <td><span className={`${BADGE} ${badgeClassForStatus(t.status)}`}>{formatStatusLabel(t.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Users() {
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRow["role"]>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  type UserSortKey = "name" | "joined" | "games" | "conduct" | "gameplay" | "money" | "lastgame";
  const [sortKey, setSortKey] = useState<UserSortKey>("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Pagination — page + rows-per-page live in the URL (?page=2&limit=50) ──
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  // Debounced search term — avoids one request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError]   = useState("");
  const [deleteBusy, setDeleteBusy]     = useState(false);
  const [toast, setToast]               = useState<string | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: sortKey,
    dir: sortDir,
  });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (roleFilter !== "all")     params.set("role", roleFilter);
  if (statusFilter !== "all")   params.set("status", statusFilter);
  if (activityFilter !== "all") params.set("activity", activityFilter);

  // Aliased: `doDelete` below has its own local `data` for the mutation response.
  const { data: listBody, loading, error, refresh } = useAdminFetch<{
    data?: AdminUserRow[]; total?: number; totalPages?: number;
  }>(`/admin/users?${params.toString()}`, { cache: true, errorMessage: "Failed to load users." });

  const users = listBody?.data ?? [];
  const total = listBody?.total ?? users.length;

  async function doDelete() {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) { setDeleteError("Please provide a reason for deletion."); return; }
    setDeleteBusy(true); setDeleteError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.message || "Delete failed."); return; }
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      setDeleteReason("");
      setToast(`${deletedName} has been successfully deleted.`);
      setTimeout(() => setToast(null), 3000);
      // If we just removed the only row on a page past the first, step back one.
      if (users.length === 1 && page > 1) setPage(page - 1);
      else refresh();
    } catch { setDeleteError("Cannot reach the server."); }
    finally { setDeleteBusy(false); }
  }

  function toggleSort(key: UserSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    resetPage();
  }
  function sortIcon(key: UserSortKey) {
    const base = "ml-[6px] inline-block rounded-[4px] px-1 py-px text-[13px] font-extrabold leading-none";
    if (sortKey !== key) return <span className={`${base} bg-[rgba(250,204,21,0.22)] text-[#facc15]`}>↕</span>;
    return <span className={`${base} bg-[#facc15] text-[#0b1114]`}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }
  const thSort = "cursor-pointer select-none";

  // The server returns the already-filtered, already-sorted page.
  const rows = users;

  return (
    <>
      <Head title="All Users" sub={loading ? "Loading…" : `${total} registered users`} />
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone, email, location…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        <select className={FILTER_SELECT} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as "all" | AdminUserRow["role"]); resetPage(); }}>
          <option value="all">All roles</option>
          <option value="player">Players</option>
          <option value="organiser">Organisers</option>
        </select>
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className={FILTER_SELECT} value={activityFilter} onChange={(e) => { setActivityFilter(e.target.value); resetPage(); }}>
          <option value="all">All activity</option>
          <option value="never">Never played</option>
          <option value="active_30">Played in last 30 days</option>
          <option value="inactive_30">No game in 30+ days</option>
          <option value="inactive_60">No game in 60+ days</option>
          <option value="inactive_90">No game in 90+ days</option>
        </select>
      </div>
      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading users…</div>}
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={thSort} onClick={() => toggleSort("name")}>Name{sortIcon("name")}</th>
              <th>Phone</th><th>Role</th><th>Email</th><th>Location</th>
              <th className={thSort} onClick={() => toggleSort("games")}>Games{sortIcon("games")}</th>
              <th className={thSort} onClick={() => toggleSort("conduct")}>Conduct{sortIcon("conduct")}</th>
              <th className={thSort} onClick={() => toggleSort("gameplay")}>Gameplay{sortIcon("gameplay")}</th>
              <th className={thSort} onClick={() => toggleSort("money")}>Earnings / Spent{sortIcon("money")}</th>
              <th className={thSort} onClick={() => toggleSort("lastgame")}>Last Game{sortIcon("lastgame")}</th>
              <th className={thSort} onClick={() => toggleSort("joined")}>Joined{sortIcon("joined")}</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={13} className="p-8! text-center text-muted!">No users match the current filters.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setDetailUserId(u.id)} className="cursor-pointer">
                <td>
                  <div className="flex items-center gap-[10px]">
                    <Avatar name={u.name} src={u.profileImage} size={36} />
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td>{u.phone}</td>
                <td><span className={`${BADGE} ${u.role === "organiser" ? BADGE_BLUE : BADGE_GRAY}`}>{u.role === "organiser" ? "Organiser" : "Player"}</span></td>
                <td>{u.email || "—"}</td>
                <td>{u.location || "—"}</td>
                <td>
                  {u.role === "organiser" ? (u.gamesHosted ?? 0) : (u.gamesPlayed ?? 0)}
                  {u.role === "player" && (u.noShowCount ?? 0) > 0 && (
                    <div className="text-[11px] text-danger">{u.noShowCount} no-show{(u.noShowCount ?? 0) > 1 ? "s" : ""}</div>
                  )}
                </td>
                {/* Conduct: players show conduct avg; organisers show their single rating */}
                <td>
                  {u.role === "organiser"
                    ? (u.rating != null && u.rating > 0
                        ? <span className="font-semibold text-warning!">★ {(u.rating as number).toFixed(1)}<span className="ml-[3px] text-[10px] font-normal text-muted">(org)</span></span>
                        : <span className="text-[12px] text-muted">No ratings</span>)
                    : (u.conductRating != null && u.conductRating > 0
                        ? <span className="font-semibold text-warning!">★ {u.conductRating.toFixed(1)}</span>
                        : <span className="text-[12px] text-muted">—</span>)
                  }
                </td>
                {/* Gameplay: players only */}
                <td>
                  {u.role === "organiser"
                    ? <span className="text-[12px] text-muted">—</span>
                    : (u.gameplayRating != null && u.gameplayRating > 0
                        ? <span className="font-semibold text-warning!">★ {u.gameplayRating.toFixed(1)}</span>
                        : <span className="text-[12px] text-muted">—</span>)
                  }
                </td>
                <td>
                  {u.role === "organiser"
                    ? <span className="font-semibold text-success!">{formatCurrency(u.earningsPaise)}</span>
                    : <span className="text-danger">{formatCurrency(u.totalSpentPaise)}</span>
                  }
                  {u.role === "player" && (u.walletBalancePaise ?? 0) > 0 && (
                    <div className="text-[11px] text-success">Bal: {formatCurrency(u.walletBalancePaise)}</div>
                  )}
                </td>
                {/* Last completed game — the dormancy signal */}
                <td>
                  {u.lastGameAt ? (
                    <>
                      <span className="whitespace-nowrap">{formatDate(u.lastGameAt)}</span>
                      <div className={`text-[11px] ${stalenessClass(u.daysSinceLastGame)}`}>{daysAgoLabel(u.daysSinceLastGame)}</div>
                    </>
                  ) : (
                    <span className="text-[12px] font-semibold text-danger">Never played</span>
                  )}
                </td>
                <td>{formatDate(u.joinedAt)}</td>
                <td><span className={`${BADGE} ${badgeClassForStatus(u.status)}`}>{formatStatusLabel(u.status)}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className={ACTIONS}>
                    <button
                      className={ACTION_BTN}
                      type="button"
                      onClick={() => setDetailUserId(u.id)}
                    >
                      View Details
                    </button>
                    <button
                      className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                      type="button"
                      onClick={() => { setDeleteTarget(u); setDeleteReason(""); setDeleteError(""); }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={setLimit}
        label="users"
      />

      {/* User detail drawer */}
      {detailUserId && (
        <UserDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className={MODAL_OVERLAY} onClick={() => setDeleteTarget(null)}>
          <div className={`${MODAL} max-w-[460px]!`} onClick={(e) => e.stopPropagation()}>
            <div className={MODAL_HEAD}>
              <div className={SECTION_TITLE}>Delete User</div>
              <button className={MODAL_CLOSE} type="button" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="mb-[14px] text-[14px] text-body">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?{" "}
              <span className="text-danger">This action cannot be undone.</span>
            </div>
            <label className={FORM_LABEL}>
              Reason for deletion
              <input
                className={`${SEARCH_INPUT} mt-[6px]! w-full`}
                placeholder="e.g. Fake account, policy violation, user request…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </label>
            {deleteError && <div className={`${FORM_ERROR} mt-[10px]`}>{deleteError}</div>}
            <div className={`${MODAL_ACTIONS} mt-[18px]`}>
              <button className={ACTION_BTN} type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!`}
                type="button"
                disabled={deleteBusy}
                onClick={doDelete}
              >
                {deleteBusy ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[10000] flex min-w-[280px] -translate-x-1/2 items-center gap-[10px] rounded-xl border-[1.5px] border-[rgba(239,68,68,0.4)] bg-[rgba(17,20,36,0.97)] px-5 py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-[13px] font-semibold text-fg">{toast}</span>
        </div>
      )}
    </>
  );
}
