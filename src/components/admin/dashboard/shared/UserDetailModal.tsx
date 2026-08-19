"use client";

/* The user detail drawer, shared by the Players and Organisers directories.
   GET /admin/users/:id/details serves both roles off one route, so this renders
   both shapes: a player's game history and wallet, an organiser's hosted games
   and earnings. It lived inside the Players section until Organisers needed it
   too — one copy, so the two pages cannot drift apart. */

import {
  SECTION_TITLE, BADGE, BADGE_BLUE, BADGE_GRAY, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE,
  MODAL_OVERLAY, MODAL, MODAL_LARGE, MODAL_HEAD, MODAL_CLOSE, GAME_INFO_GRID,
  BLOCK_TITLE, BLOCK_TITLE_SUCCESS,
} from "./styles";
import { useAdminFetch } from "./useAdminFetch";
import {
  formatDate, formatCurrency, formatDateTime, formatStatusLabel, badgeClassForStatus,
  daysAgoLabel, stalenessClass,
} from "./format";
import { Avatar, InfoCell } from "./components";

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

export function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
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