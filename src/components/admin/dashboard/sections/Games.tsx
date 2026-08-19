"use client";

import { useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  SECTION_TITLE, STAT_LABEL, BADGE, BADGE_BLUE, BADGE_GRAY, TOOLBAR, SEARCH_INPUT, FILTER_SELECT,
  TABLE_WRAP, TABLE, ACTION_BTN, ACTIONS, FORM_ERROR, LOADING_STATE, MODAL_OVERLAY, MODAL,
  MODAL_LARGE, MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL, GAME_INFO_GRID, GAME_INFO_CELL,
  BLOCK_TITLE, BLOCK_TITLE_SUCCESS,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import {
  formatDate, formatCurrency, formatDateTime, formatStatusLabel, badgeClassForStatus,
} from "../shared/format";
import { Head } from "../shared/components";

type AdminGameRow = {
  id: string; title: string; venue?: string | null; scheduledAt?: string | null;
  format?: string | null; players: { registered: number; totalSlots: number };
  feeInPaise?: number; organiserName?: string; status: string;
};

// Game detail
type GameRegistration = {
  _id: string;
  player?: { _id?: string; name?: string; phone?: string; email?: string } | null;
  plusOneName?: string | null; preferredPosition?: string; teamPreference?: string;
  paymentStatus?: string; amountPaidPaise?: number; attended?: string;
  signedUpAt?: string; assignedTeam?: string;
};

type GameWaitlistEntry = {
  _id: string;
  player?: { _id?: string; name?: string; phone?: string } | null;
  joinedAt?: string; status?: string; preferredPosition?: string;
};

type GameDetail = {
  _id: string; title?: string; format?: string; status?: string;
  scheduledAt?: string; durationMins?: number; feeInPaise?: number;
  totalSlots?: number; minPlayers?: number; organiserIsPlaying?: boolean;
  cancelReason?: string | null; cancelledAt?: string | null;
  completedAt?: string | null; attendanceMarked?: boolean;
  organiser?: { name?: string; phone?: string; email?: string } | null;
  turf?: { name?: string; address?: { area?: string; city?: string; state?: string } } | null;
  registrations: GameRegistration[];
  waitlist: GameWaitlistEntry[];
};

function GameDetailModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { data, loading, error } = useAdminFetch<{ success?: boolean; data?: GameDetail; message?: string }>(
    `/admin/games/${gameId}`,
    { errorMessage: "Failed to load game." },
  );
  const game = data?.success ? data.data ?? null : null;

  if (loading) {
    return (
      <div className={MODAL_OVERLAY} onClick={onClose}>
        <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
          <div className={MODAL_HEAD}>
            <div className={SECTION_TITLE}>Loading…</div>
            <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
          </div>
          <div className={LOADING_STATE}>Loading game data…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={MODAL_OVERLAY} onClick={onClose}>
        <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
          <div className={MODAL_HEAD}>
            <div className={SECTION_TITLE}>Error</div>
            <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
          </div>
          <div className={FORM_ERROR}>{error}</div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const regs = game.registrations || [];
  const paidCount = regs.filter((r) => r.paymentStatus === "paid").length;
  const guestCount = regs.filter((r) => r.plusOneName).length;
  const totalRevPaise = regs.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + (r.amountPaidPaise || 0), 0);
  const presentCount = regs.filter((r) => r.attended === "present").length;

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={`${MODAL} ${MODAL_LARGE}`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div>
            <div className={SECTION_TITLE}>{loading ? "Loading…" : (game?.title || "Game Detail")}</div>
            {game && (
              <div className="mt-[6px] flex items-center gap-2">
                <span className={`${BADGE} ${BADGE_GRAY}`}>{game.format}</span>
                <span className="text-[13px] text-muted">{formatDateTime(game.scheduledAt)}</span>
                <span className={`${BADGE} ${badgeClassForStatus(game.status)}`}>{formatStatusLabel(game.status)}</span>
              </div>
            )}
          </div>
          <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
        </div>

        {loading && <div className={LOADING_STATE}>Loading game data…</div>}
        {error   && <div className={FORM_ERROR}>{error}</div>}

        {game && (
          <div className="max-h-[calc(85vh-110px)] overflow-y-auto">

            {/* Info grid */}
            <div className={GAME_INFO_GRID}>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Venue</div><div>{game.turf?.name || "—"}{game.turf?.address?.city ? `, ${game.turf.address.city}` : ""}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Organiser</div><div>{game.organiser?.name || "—"}<br /><span className="text-[11px] text-muted">{game.organiser?.phone || ""}</span></div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Fee / Player</div><div>{formatCurrency(game.feeInPaise)}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Slots Filled</div><div>{regs.length} / {game.totalSlots ?? "—"}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Min Players</div><div>{game.minPlayers ?? "—"}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Duration</div><div>{game.durationMins ? `${game.durationMins} min` : "—"}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Paid Registrations</div><div className="text-success">{paidCount}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Guest Slots</div><div>{guestCount}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Total Revenue</div><div className="font-semibold text-success!">{formatCurrency(totalRevPaise)}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Attended (Present)</div><div>{game.attendanceMarked ? presentCount : "Not marked"}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Organiser Playing</div><div>{game.organiserIsPlaying ? "Yes" : "No"}</div></div>
              <div className={GAME_INFO_CELL}><div className={STAT_LABEL}>Attendance Marked</div><div>{game.attendanceMarked ? "Yes" : "No"}</div></div>
              {game.cancelReason && (
                <div className={`${GAME_INFO_CELL} col-span-full`}>
                  <div className={STAT_LABEL}>Cancellation Reason</div>
                  <div className="text-danger">{game.cancelReason} {game.cancelledAt ? `· ${formatDate(game.cancelledAt)}` : ""}</div>
                </div>
              )}
            </div>

            {/* Registrations */}
            <div className={BLOCK_TITLE_SUCCESS}>Registrations ({regs.length})</div>
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  <tr><th>#</th><th>Player / Guest</th><th>Type</th><th>Position</th><th>Team Pref</th><th>Payment</th><th>Amount Paid</th><th>Attended</th><th>Signed Up</th></tr>
                </thead>
                <tbody>
                  {regs.length === 0 && <tr><td colSpan={9} className="p-6! text-center text-muted!">No registrations.</td></tr>}
                  {regs.map((r, i) => (
                    <tr key={r._id}>
                      <td>{i + 1}</td>
                      <td>
                        {r.plusOneName
                          ? <span>{r.plusOneName} <span className={`${BADGE} ${BADGE_GRAY}`}>Guest</span></span>
                          : r.player?.name || "Unknown"
                        }
                        {!r.plusOneName && r.player?.phone && <div className="text-[11px] text-muted">{r.player.phone}</div>}
                      </td>
                      <td>{r.plusOneName ? <span className={`${BADGE} ${BADGE_GRAY}`}>Guest</span> : <span className={`${BADGE} ${BADGE_BLUE}`}>Player</span>}</td>
                      <td>{formatStatusLabel(r.preferredPosition)}</td>
                      <td>{formatStatusLabel(r.teamPreference)}</td>
                      <td><span className={`${BADGE} ${badgeClassForStatus(r.paymentStatus)}`}>{formatStatusLabel(r.paymentStatus)}</span></td>
                      <td>{formatCurrency(r.amountPaidPaise)}</td>
                      <td><span className={`${BADGE} ${badgeClassForStatus(r.attended)}`}>{formatStatusLabel(r.attended)}</span></td>
                      <td>{formatDate(r.signedUpAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Waitlist */}
            {(game.waitlist?.length ?? 0) > 0 && (
              <>
                <div className={`${BLOCK_TITLE} mt-5!`}>Waitlist ({game.waitlist.length})</div>
                <div className={TABLE_WRAP}>
                  <table className={TABLE}>
                    <thead><tr><th>#</th><th>Player</th><th>Phone</th><th>Position</th><th>Status</th><th>Joined</th></tr></thead>
                    <tbody>
                      {game.waitlist.map((w, i) => (
                        <tr key={w._id}>
                          <td>{i + 1}</td>
                          <td>{w.player?.name || "Unknown"}</td>
                          <td>{w.player?.phone || "—"}</td>
                          <td>{formatStatusLabel(w.preferredPosition)}</td>
                          <td><span className={`${BADGE} ${badgeClassForStatus(w.status)}`}>{formatStatusLabel(w.status)}</span></td>
                          <td>{formatDate(w.joinedAt)}</td>
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

export function Games() {
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailGameId, setDetailGameId] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<AdminGameRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError]   = useState("");
  const [cancelBusy, setCancelBusy]     = useState(false);
  const [toast, setToast]               = useState<string | null>(null);

  // ── Pagination — page + rows-per-page live in the URL (?page=2&limit=50) ──
  const { page, limit, setPage, setLimit, resetPage } = usePagination();

  // Debounced search — avoids one request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data: listBody, loading, error, refresh } = useAdminFetch<{
    data?: AdminGameRow[]; total?: number;
  }>(`/admin/games?${params.toString()}`, { errorMessage: "Failed to load games." });

  // Constant path, so the platform-wide count is fetched once per visit rather
  // than recounted on every page change.
  const { data: summaryBody, refresh: refreshSummary } = useAdminFetch<{ data?: { total?: number } }>(
    "/admin/games/summary",
    { cache: true, errorMessage: "Failed to load game totals." },
  );

  // `games` is the page being shown; `total` is what the filters match, and
  // `grandTotal` every game on the platform (what the header counts).
  const games      = listBody?.data ?? [];
  const total      = listBody?.total ?? games.length;
  const grandTotal = summaryBody?.data?.total ?? total;

  async function doCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { setCancelError("Please provide a reason for cancellation."); return; }
    setCancelBusy(true); setCancelError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/games/${cancelTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.message || "Cancel failed."); return; }
      const cancelledTitle = cancelTarget.title;
      setCancelTarget(null);
      setCancelReason("");
      setToast(`"${cancelledTitle}" has been cancelled. Players were refunded and notified.`);
      setTimeout(() => setToast(null), 4000);
      refresh();
    } catch { setCancelError("Cannot reach the server."); }
    finally { setCancelBusy(false); }
  }

  // The server returns the already-filtered, already-paginated page.
  const filtered = games;

  return (
    <>
      <Head title="Games & Events" sub={loading ? "Loading…" : `${grandTotal} games across all organisers`} />
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search games, venue, organiser…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={ACTION_BTN} type="button" onClick={() => { refresh(); refreshSummary(); }}>Refresh</button>
      </div>
      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading games…</div>}
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr><th>Game</th><th>Venue</th><th>Date</th><th>Format</th><th>Players</th><th>Fee</th><th>Organiser</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="p-6! text-center text-muted!">No games found.</td></tr>}
            {filtered.map((g) => (
              <tr key={g.id}>
                <td>{g.title}</td>
                <td>{g.venue || "—"}</td>
                <td>{formatDateTime(g.scheduledAt)}</td>
                <td><span className={`${BADGE} ${BADGE_GRAY}`}>{g.format || "—"}</span></td>
                <td>{`${g.players?.registered || 0} / ${g.players?.totalSlots || 0}`}</td>
                <td>{formatCurrency(g.feeInPaise)}</td>
                <td>{g.organiserName || "—"}</td>
                <td><span className={`${BADGE} ${badgeClassForStatus(g.status)}`}>{formatStatusLabel(g.status)}</span></td>
                <td>
                  <div className={ACTIONS}>
                    <button className={ACTION_BTN} type="button" onClick={() => setDetailGameId(g.id)}>
                      View Detail
                    </button>
                    {!["cancelled", "completed"].includes((g.status || "").toLowerCase()) && (
                      <button
                        className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                        type="button"
                        onClick={() => { setCancelTarget(g); setCancelReason(""); setCancelError(""); }}
                      >
                        Cancel
                      </button>
                    )}
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
        label="games"
      />

      {detailGameId && (
        <GameDetailModal gameId={detailGameId} onClose={() => setDetailGameId(null)} />
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className={MODAL_OVERLAY} onClick={() => setCancelTarget(null)}>
          <div className={`${MODAL} max-w-[460px]!`} onClick={(e) => e.stopPropagation()}>
            <div className={MODAL_HEAD}>
              <div className={SECTION_TITLE}>Cancel Game</div>
              <button className={MODAL_CLOSE} type="button" onClick={() => setCancelTarget(null)}>✕</button>
            </div>
            <div className="mb-[14px] text-[14px] text-body">
              Are you sure you want to cancel <strong>{cancelTarget.title}</strong>?{" "}
              <span className="text-danger">
                This cancels the game, refunds every paid player, and notifies everyone involved. This action cannot be undone.
              </span>
            </div>
            <label className={FORM_LABEL}>
              Reason for cancellation
              <input
                className={`${SEARCH_INPUT} mt-[6px]! w-full`}
                placeholder="e.g. Duplicate listing, organiser request, policy violation…"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </label>
            {cancelError && <div className={`${FORM_ERROR} mt-[10px]`}>{cancelError}</div>}
            <div className={`${MODAL_ACTIONS} mt-[18px]`}>
              <button className={ACTION_BTN} type="button" onClick={() => setCancelTarget(null)}>Back</button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!`}
                type="button"
                disabled={cancelBusy}
                onClick={doCancel}
              >
                {cancelBusy ? "Cancelling…" : "Confirm Cancel"}
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
