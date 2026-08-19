"use client";

import { useEffect, useState } from "react";
import {
  BADGE, TOOLBAR, SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP,
  TABLE, ACTION_BTN, ACTIONS, FORM_ERROR, LOADING_STATE,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { UserDetailModal } from "../shared/UserDetailModal";
import { DeleteUserModal, DeletedToast } from "../shared/DeleteUserModal";
import {
  formatDate, formatCurrency, formatStatusLabel, badgeClassForStatus,
  daysAgoLabel, stalenessClass,
} from "../shared/format";
import { Head, Avatar } from "../shared/components";

/* Players only. Organisers have their own section, so this directory no longer
   mixes the two — which is also what let the endpoint stop loading every player
   document just to render one page. */
type AdminUserRow = {
  id: string; name: string; phone: string; email?: string | null;
  role: "player"; isVerified?: boolean;
  profileImage?: string | null;
  gamesPlayed?: number;
  noShowCount?: number; backoutCount?: number;
  rating?: number;
  // conduct/gameplay averages, from organiser ratings
  conductRating?: number | null; gameplayRating?: number | null; ratingCount?: number;
  totalSpentPaise?: number; walletBalancePaise?: number;
  joinedAt?: string | null; status: string; location?: string | null;
  // engagement — games that actually happened
  completedGames?: number; lastGameAt?: string | null; daysSinceLastGame?: number | null;
};


export function Users() {
  const [search, setSearch]         = useState("");
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
  const [toast, setToast]               = useState<string | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: sortKey,
    dir: sortDir,
  });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (statusFilter !== "all")   params.set("status", statusFilter);
  if (activityFilter !== "all") params.set("activity", activityFilter);

  const { data: listBody, loading, error, refresh } = useAdminFetch<{
    data?: AdminUserRow[]; total?: number; totalPages?: number;
  }>(`/admin/users?${params.toString()}`, { cache: true, errorMessage: "Failed to load players." });

  const users = listBody?.data ?? [];
  const total = listBody?.total ?? users.length;

  function onDeleted(name: string) {
    setDeleteTarget(null);
    setToast(`${name} has been successfully deleted.`);
    setTimeout(() => setToast(null), 3000);
    // If we just removed the only row on a page past the first, step back one.
    if (users.length === 1 && page > 1) setPage(page - 1);
    else refresh();
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
      <Head title="Players" sub={loading ? "Loading…" : `${total} registered players`} />
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone, email, location…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        {/* Approved / suspended / rejected were organiser states; a player is
            active once verified and pending until then. */}
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
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
      {loading && <div className={LOADING_STATE}>Loading players…</div>}
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={thSort} onClick={() => toggleSort("name")}>Name{sortIcon("name")}</th>
              <th>Phone</th><th>Email</th><th>Location</th>
              <th className={thSort} onClick={() => toggleSort("games")}>Games{sortIcon("games")}</th>
              <th className={thSort} onClick={() => toggleSort("conduct")}>Conduct{sortIcon("conduct")}</th>
              <th className={thSort} onClick={() => toggleSort("gameplay")}>Gameplay{sortIcon("gameplay")}</th>
              <th className={thSort} onClick={() => toggleSort("money")}>Spent{sortIcon("money")}</th>
              <th className={thSort} onClick={() => toggleSort("lastgame")}>Last Game{sortIcon("lastgame")}</th>
              <th className={thSort} onClick={() => toggleSort("joined")}>Joined{sortIcon("joined")}</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={12} className="p-8! text-center text-muted!">No players match the current filters.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setDetailUserId(u.id)} className="cursor-pointer">
                <td>
                  <div className="flex items-center gap-[10px]">
                    <Avatar name={u.name} src={u.profileImage} size={36} />
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td>{u.phone}</td>
                <td>{u.email || "—"}</td>
                <td>{u.location || "—"}</td>
                <td>
                  {u.gamesPlayed ?? 0}
                  {(u.noShowCount ?? 0) > 0 && (
                    <div className="text-[11px] text-danger">{u.noShowCount} no-show{(u.noShowCount ?? 0) > 1 ? "s" : ""}</div>
                  )}
                </td>
                <td>
                  {u.conductRating != null && u.conductRating > 0
                    ? <span className="font-semibold text-warning!">★ {u.conductRating.toFixed(1)}</span>
                    : <span className="text-[12px] text-muted">—</span>}
                </td>
                <td>
                  {u.gameplayRating != null && u.gameplayRating > 0
                    ? <span className="font-semibold text-warning!">★ {u.gameplayRating.toFixed(1)}</span>
                    : <span className="text-[12px] text-muted">—</span>}
                </td>
                <td>
                  <span className="text-danger">{formatCurrency(u.totalSpentPaise)}</span>
                  {(u.walletBalancePaise ?? 0) > 0 && (
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
                      onClick={() => setDeleteTarget(u)}
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
        label="players"
      />

      {/* Player detail drawer */}
      {detailUserId && (
        <UserDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)} />
      )}

      {/* Delete confirmation — the reason field is required by the API */}
      {deleteTarget && (
        <DeleteUserModal
          target={{ id: deleteTarget.id, name: deleteTarget.name }}
          label="Player"
          extraWarning="Their wallet, transaction history and notifications are removed with them."
          onClose={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
        />
      )}

      {toast && <DeletedToast message={toast} />}
    </>
  );
}
