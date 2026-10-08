"use client";

/* The full detail of one game — roster, waitlist, ratings. Lives here rather than
   in sections/Games.tsx because two sections open it (Games and the Analytics
   drill-down), and importing it from a section would ship that whole section in
   the other's bundle. */

import {
  SECTION_TITLE, STAT_LABEL, BADGE, BADGE_BLUE, BADGE_GRAY, TABLE_WRAP, TABLE, FORM_ERROR,
  LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_LARGE, MODAL_HEAD, MODAL_CLOSE, GAME_INFO_GRID,
  GAME_INFO_CELL, BLOCK_TITLE, BLOCK_TITLE_SUCCESS, SUMMARY_FOUR, SUMMARY_ITEM, SUMMARY_VALUE, PAY_SUB,
} from "./styles";
import { useAdminFetch } from "./useAdminFetch";
import {
  formatDate, formatCurrency, formatDateTime, formatStatusLabel, badgeClassForStatus,
  starRating, starValue,
} from "./format";

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

// What the players said about this game — the GameFeedback records for it, the
// same ones the Feedback section lists platform-wide, narrowed to one game.
type GameFeedbackEntry = {
  _id: string;
  player?: { _id?: string; name?: string; phone?: string } | null;
  gameRating: number;
  // Optional on the form, so either can be NA — never treat a blank as zero.
  organiserRating?: number | null;
  venueRating?: number | null;
  tags?: string[];
  comment?: string | null;
  submittedAt?: string;
};

type GameFeedbackBlock = {
  summary: {
    count: number;
    // Live, non-guest registrations — the players who were allowed to rate.
    eligible: number;
    responseRate: number | null;
    avgGame: number | null;
    avgOrganiser: number | null;
    avgVenue: number | null;
    tagCounts: Record<string, number>;
  };
  entries: GameFeedbackEntry[];
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
  feedback?: GameFeedbackBlock;
};

export function GameDetailModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
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

  // Player-submitted ratings for this game. Older responses predate the field,
  // so treat a missing block as "no ratings" rather than assuming it is there.
  const fb = game.feedback;
  const ratingCount = fb?.summary.count ?? 0;
  const eligible = fb?.summary.eligible ?? 0;
  // Organiser and venue stars are optional, so each card says how many of the
  // responses actually carried one — an average over 2 of 9 is a different claim.
  const ratedCount = (key: "organiserRating" | "venueRating") =>
    (fb?.entries || []).filter((f) => f[key] != null && f[key]! > 0).length;
  const topTags = Object.entries(fb?.summary.tagCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  // A game nobody has played cannot have ratings, and an empty block there is
  // just noise — but a completed game with none is itself worth seeing.
  const showRatings = ratingCount > 0 || game.status === "completed";

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

            {/* Player ratings — what the players said about this game. The form
                only opens once the game is completed, so a game that has not been
                played yet gets no section at all rather than an empty one. */}
            {showRatings && (
            <>
              <div className={BLOCK_TITLE}>Player Ratings ({ratingCount})</div>
              {ratingCount === 0 ? (
                <div className="border border-border bg-surface px-4 py-4 text-center text-[13px] text-muted">
                  {eligible > 0
                    ? `None of the ${eligible} player${eligible === 1 ? " who" : "s who"} played ${eligible === 1 ? "has" : "have"} rated this game yet.`
                    : "No player was eligible to rate this game."}
                </div>
              ) : (
                <>
                  <div className={SUMMARY_FOUR}>
                    <div className={SUMMARY_ITEM}>
                      <div className={STAT_LABEL}>Game</div>
                      <div className={`${SUMMARY_VALUE} text-warning!`}>{starValue(fb!.summary.avgGame)}</div>
                      <div className={PAY_SUB}>{ratingCount} rating{ratingCount === 1 ? "" : "s"}</div>
                    </div>
                    <div className={SUMMARY_ITEM}>
                      <div className={STAT_LABEL}>Organiser</div>
                      <div className={`${SUMMARY_VALUE} text-warning!`}>{starValue(fb!.summary.avgOrganiser)}</div>
                      <div className={PAY_SUB}>{ratedCount("organiserRating")} rated</div>
                    </div>
                    <div className={SUMMARY_ITEM}>
                      <div className={STAT_LABEL}>Venue</div>
                      <div className={`${SUMMARY_VALUE} text-warning!`}>{starValue(fb!.summary.avgVenue)}</div>
                      <div className={PAY_SUB}>{ratedCount("venueRating")} rated</div>
                    </div>
                    <div className={SUMMARY_ITEM}>
                      <div className={STAT_LABEL}>Responses</div>
                      <div className={SUMMARY_VALUE}>{ratingCount} / {eligible || "—"}</div>
                      <div className={PAY_SUB}>
                        {fb!.summary.responseRate != null ? `${fb!.summary.responseRate}% of eligible players` : "No eligible players"}
                      </div>
                    </div>
                  </div>

                  {topTags.length > 0 && (
                    <div className="mb-[14px] flex flex-wrap items-center gap-[6px]">
                      {topTags.map(([tag, n]) => (
                        <span key={tag} className={`${BADGE} ${BADGE_GRAY}`}>{tag} · {n}</span>
                      ))}
                    </div>
                  )}

                  <div className={TABLE_WRAP}>
                    <table className={TABLE}>
                      <thead>
                        <tr><th>#</th><th>Player</th><th>Game ★</th><th>Organiser ★</th><th>Venue ★</th><th>Tags</th><th>Comment</th><th>Submitted</th></tr>
                      </thead>
                      <tbody>
                        {fb!.entries.map((f, i) => (
                          <tr key={f._id}>
                            <td>{i + 1}</td>
                            <td>
                              {f.player?.name || "Unknown"}
                              {f.player?.phone && <div className="text-[11px] text-muted">{f.player.phone}</div>}
                            </td>
                            <td className="whitespace-nowrap text-warning!">{starRating(f.gameRating)}</td>
                            <td className="whitespace-nowrap text-warning!">{starRating(f.organiserRating)}</td>
                            <td className="whitespace-nowrap text-warning!">{starRating(f.venueRating)}</td>
                            <td>
                              {(f.tags || []).length === 0
                                ? <span className="text-muted">—</span>
                                : (f.tags || []).map((tag) => (
                                    <span key={tag} className={`${BADGE} ${BADGE_GRAY} mr-[3px]`}>{tag}</span>
                                  ))}
                            </td>
                            {/* Wraps rather than truncating — the modal is the place
                                an admin came to read the whole thing. */}
                            <td className="min-w-[220px] whitespace-normal text-[13px]">
                              {f.comment || <span className="text-muted">—</span>}
                            </td>
                            <td className="whitespace-nowrap">{formatDate(f.submittedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
            )}

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
