"use client";

/* One player, everything — GET /admin/analytics/players/:id.

   Verdict first (utils/playerInsights.js#concludePlayer), then the evidence:
   games, money, passes, ratings, profile, and every game they ever booked.
   Money is the wallet LEDGER summed by type, never the Wallet's running
   counters, which skip bonuses and admin adjustments. A pass's net is the value
   it covered minus what was paid for it. Each block exports itself to Excel;
   the header button exports the whole report. */

import {
  STATS_GRID, TWO_COL, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, GAME_INFO_GRID, BADGE,
  BADGE_GRAY, BADGE_GREEN, BADGE_AMBER, SECTION_TITLE, STAT_LABEL, TOPBAR_BTN, TOPBAR_BTN_PRIMARY,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import { Avatar, InfoCell } from "../shared/components";
import {
  formatCurrency, formatDate, formatDateTime, formatStatusLabel, badgeClassForStatus, daysAgoLabel,
} from "../shared/format";
import { Columns, SERIES, monthLabel, pctText } from "./charts";
import { Verdict, Kpi, Block, ExportButton } from "./verdicts";
import { downloadSheets, exportPlayerReport, reportSheets } from "./exportExcel";
import type { ApiResponse, PlayerReportData, PlayerGameRow } from "./types";

const stars = (v: number | null | undefined) => (v == null ? "—" : `★ ${v.toFixed(1)}`);
const SOURCE: Record<string, string> = { purchase: "Bought", grant: "Granted", migration: "Migrated (v1)", compensation: "Compensation" };

function signedCurrency(paise: number) {
  if (!paise) return formatCurrency(0);
  return `${paise > 0 ? "+" : "−"}${formatCurrency(Math.abs(paise))}`;
}

function Favourites({ title, rows }: { title: string; rows: { label: string; games: number }[] }) {
  return (
    <div>
      <div className={STAT_LABEL + " mb-2!"}>{title}</div>
      {rows.length === 0 ? <div className="text-[13px] text-muted">—</div> : (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-3 text-[13px] text-body">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 font-mono text-muted">{r.games}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function seatNote(g: PlayerGameRow) {
  if (g.backedOut) return <div className="mt-[3px] text-[11px] text-warning">Backed out{g.backoutType === "post_cutoff" ? " (after cutoff)" : ""}</div>;
  if (g.removed) return <div className="mt-[3px] text-[11px] text-muted">Removed by organiser</div>;
  if (g.optedOut) return <div className="mt-[3px] text-[11px] text-warning">Opted out</div>;
  return null;
}

export function PlayerReport({ id }: { id: string }) {
  const { data: res, loading, error, refresh } = useAdminFetch<ApiResponse<PlayerReportData>>(
    `/admin/analytics/players/${id}`,
    { errorMessage: "Failed to load this player." },
  );
  const d = res?.data;

  if (error) return <div className={FORM_ERROR}>{error}</div>;
  if (!d) return <div className={LOADING_STATE}>Loading the player…</div>;

  const { profile: p, activity: a, money: m, ratings: r } = d;
  const multiYear = new Set(d.monthly.map((x) => x.month.slice(0, 4))).size > 1;
  /** A block's Excel button: one part of the report, as its own file. */
  const save = (part: keyof typeof reportSheets) => () => downloadSheets(`kasakai-player-${part}`, reportSheets[part](d));
  const passTotals = d.passes.reduce(
    (t, x) => ({ price: t.price + x.pricePaidPaise, covered: t.covered + x.coveredPaise }),
    { price: 0, covered: 0 },
  );

  return (
    <div className={`flex flex-col gap-5 pb-4 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={p.name} src={p.profileImage} size={48} />
        <div className="flex-1">
          <div className={SECTION_TITLE}>{p.name}</div>
          <div className="mt-[6px] flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className={`${BADGE} ${p.isVerified ? BADGE_GREEN : BADGE_AMBER}`}>{p.isVerified ? "Verified" : "Not verified"}</span>
            <span>{p.phone}</span>
            {p.email ? <span>· {p.email}</span> : null}
            <span>· joined {formatDate(p.joinedAt)}{p.daysSinceJoined != null ? ` (${p.daysSinceJoined}d ago)` : ""}</span>
          </div>
        </div>
        <button type="button" className={TOPBAR_BTN} onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        <ExportButton label="Export to Excel" className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} onExport={() => exportPlayerReport(d)} />
      </div>

      <div className="-mb-5">
        <Verdict label="How this player is doing" conclusions={d.conclusions} />
      </div>

      {/* ── Games ── */}
      <Block title="Games" sub="Played = their own seat in a completed game, not marked absent or no-show." onExport={save("games")}>
        <div className={STATS_GRID + " mb-4!"}>
          <Kpi label="Games played" value={a.gamesPlayed} sub={`${a.bookings} bookings · ${a.upcoming} upcoming`} />
          <Kpi label="Attendance" value={pctText(a.attendancePct)} sub={`${a.present} present · ${a.noShows} no-show where marked`} />
          <Kpi label="Last played" value={a.lastPlayedAt ? daysAgoLabel(a.daysSinceLastGame) : "Never"} sub={a.firstPlayedAt ? `First game ${formatDate(a.firstPlayedAt)}` : undefined} />
          <Kpi label="Pace" value={a.gamesPerMonth == null ? "—" : `${a.gamesPerMonth}/mo`} sub={a.daysToFirstGame == null ? "No game yet" : `First game ${a.daysToFirstGame}d after signup`} />
        </div>
        <div className={GAME_INFO_GRID}>
          <InfoCell label="No-shows" value={a.noShows} tone={a.noShows ? "text-danger" : undefined} />
          <InfoCell label="Backouts" value={a.backouts} tone={a.backouts ? "text-warning" : undefined} />
          <InfoCell label="Opted out" value={a.optedOut} />
          <InfoCell label="Absent (told organiser)" value={a.absent} />
          <InfoCell label="Removed by organiser" value={a.removed} />
          <InfoCell label="Games cancelled on them" value={a.cancelledOnThem} />
          <InfoCell label="Guests brought" value={a.guestsBrought} />
          <InfoCell label="Feedback given" value={a.feedbackGiven} />
          <InfoCell label="Upcoming" value={a.upcoming} tone={a.upcoming ? "text-info" : undefined} />
        </div>
        <div className={TWO_COL + " mb-0!"}>
          <div>
            <div className={STAT_LABEL}>Games by month · last 12</div>
            <Columns
              rows={d.monthly.map((x) => ({
                label: multiYear ? `${monthLabel(x.month)} ${x.month.slice(2, 4)}` : monthLabel(x.month),
                value: x.games,
                color: SERIES.healthy,
              }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Favourites title="Venues" rows={d.favourites.venues} />
            <Favourites title="Organisers" rows={d.favourites.organisers} />
            <Favourites title="Formats" rows={d.favourites.formats} />
            <Favourites title="When" rows={d.favourites.slots} />
          </div>
        </div>
      </Block>

      {/* ── Money ── */}
      <Block title="Money" sub="Summed from the wallet ledger. Admin adjustments are listed apart from what the player did." onExport={save("money")}>
        <div className={STATS_GRID + " mb-4!"}>
          <Kpi label="Topped up" value={formatCurrency(m.topUpPaise)} sub={`${m.topUps} top-ups${m.lastTopUpAt ? ` · last ${formatDate(m.lastTopUpAt)}` : ""}`} />
          <Kpi label="Spent on games" value={formatCurrency(m.netGameSpendPaise)} sub={`After ${formatCurrency(m.refundPaise)} refunded`} />
          <Kpi label="Saved" value={formatCurrency(m.discountSavedPaise + m.passCoveredPaise)} sub={`Discounts ${formatCurrency(m.discountSavedPaise)} · pass ${formatCurrency(m.passCoveredPaise)}`} />
          <Kpi label="Balance now" value={formatCurrency(m.balancePaise)} sub={`${formatCurrency(m.lockedPaise)} locked for upcoming games`} />
        </div>
        <div className={GAME_INFO_GRID + " mb-0!"}>
          <InfoCell label="Booked (gross)" value={formatCurrency(m.gameSpendPaise)} />
          <InfoCell label="Refunded" value={formatCurrency(m.refundPaise)} tone="text-success" />
          <InfoCell label="Backout fees paid" value={formatCurrency(m.backoutFeePaise)} tone={m.backoutFeePaise ? "text-warning" : undefined} />
          <InfoCell label="Recharge bonus earned" value={formatCurrency(m.bonusPaise)} />
          <InfoCell label="Spent on passes" value={formatCurrency(m.passPurchasePaise)} />
          <InfoCell label="Paid at checkout (old flow)" value={formatCurrency(m.directPaise)} />
          <InfoCell label="Discount saved" value={<>{formatCurrency(m.discountSavedPaise)}<div className="text-[11px] text-muted">{m.discountedGames} games</div></>} />
          <InfoCell label="Pass covered" value={<>{formatCurrency(m.passCoveredPaise)}<div className="text-[11px] text-muted">{m.passCoveredGames} games</div></>} />
          <InfoCell label="Admin credits / debits" value={`${formatCurrency(m.adminCreditPaise)} / ${formatCurrency(m.adminDebitPaise)}`} />
        </div>
      </Block>

      {/* ── Passes ── */}
      <Block
        title="Passes"
        sub={d.passes.length
          ? `Paid ${formatCurrency(passTotals.price)}, covered ${formatCurrency(passTotals.covered)} of games — net ${signedCurrency(passTotals.covered - passTotals.price)} to the player.`
          : "Value covered minus the price paid, per pass."}
        onExport={d.passes.length ? save("passes") : undefined}
      >
        {d.legacyPass ? (
          <div className="mb-3 text-[13px] text-muted">
            Legacy pass: <span className="text-body">{d.legacyPass.label}</span>
            {d.legacyPass.expiryDate ? ` till ${formatDate(d.legacyPass.expiryDate)}` : ""} — no price or usage was recorded for v1 passes.
          </div>
        ) : null}
        {d.passes.length === 0 ? (
          d.legacyPass ? null : <div className="text-[13px] text-muted">Has never held a pass.</div>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>Pass</th><th>Source</th><th>Status</th><th>Valid</th><th>Price</th><th>Games covered</th><th>Value covered</th><th>Net</th><th>Left</th></tr>
              </thead>
              <tbody>
                {d.passes.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}<div className="font-mono text-[11px] text-muted">{x.code}</div></td>
                    <td>{SOURCE[x.source] || x.source}</td>
                    <td><span className={`${BADGE} ${badgeClassForStatus(x.status)}`}>{formatStatusLabel(x.status)}</span></td>
                    <td className="whitespace-nowrap! font-mono text-[12px]">{formatDate(x.activatesAt)} – {x.expiresAt ? formatDate(x.expiresAt) : "no expiry"}</td>
                    <td className="font-mono">{formatCurrency(x.pricePaidPaise)}</td>
                    <td className="font-mono">{x.games}</td>
                    <td className="font-mono">{formatCurrency(x.coveredPaise)}</td>
                    <td className={`font-mono ${x.netPaise >= 0 ? "text-success!" : "text-danger!"}`}>{signedCurrency(x.netPaise)}</td>
                    <td className="font-mono text-[12px]">
                      {x.remainingGames == null && x.remainingPaise == null ? "Unlimited" : [
                        x.remainingGames != null ? `${x.remainingGames} games` : null,
                        x.remainingPaise != null ? formatCurrency(x.remainingPaise) : null,
                      ].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      {/* ── Ratings ── */}
      <Block title="Ratings" sub="Organisers rate conduct and gameplay; players rate each other after a game." onExport={save("ratings")}>
        <div className={STATS_GRID + " mb-4!"}>
          <Kpi label="Conduct" value={stars(r.conduct)} sub={`From ${r.count} organiser${r.count === 1 ? "" : "s"}`} />
          <Kpi label="Gameplay" value={stars(r.gameplay)} sub={r.skill ? `Skill snapshot ${stars(r.skill.gameplay)} · ${r.skill.confidence}% confidence` : "No skill snapshot yet"} />
          <Kpi label="From other players" value={stars(r.peer.avg)} sub={`${r.peer.count} peer rating${r.peer.count === 1 ? "" : "s"}`} />
          <Kpi label="Ratings they give" value={stars(r.given.game)} sub={`Avg game rating · ${r.given.count} feedback${r.given.organiser != null ? ` · organisers ${stars(r.given.organiser)}` : ""}`} />
        </div>
        {r.byOrganiser.length ? (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead><tr><th>Organiser</th><th>Conduct</th><th>Gameplay</th><th>Games seen</th><th>Last rated</th></tr></thead>
              <tbody>
                {r.byOrganiser.map((o, i) => (
                  <tr key={o.organiser + i}>
                    <td>{o.organiser}</td>
                    <td className="font-mono">{stars(o.conduct)}</td>
                    <td className="font-mono">{stars(o.gameplay)}</td>
                    <td className="font-mono">{o.gamesObserved}</td>
                    <td className="font-mono">{formatDate(o.lastRatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Block>

      {/* ── Profile ── */}
      <Block title="Profile" onExport={save("profile")}>
        <div className={GAME_INFO_GRID + " mb-0!"}>
          <InfoCell label="City" value={p.location || "—"} />
          <InfoCell label="Skill level" value={formatStatusLabel(p.preferences.skillLevel || undefined)} />
          <InfoCell label="Preferred format" value={p.preferences.preferredFormat || "—"} />
          <InfoCell label="Positions" value={p.preferences.positions.join(", ") || "—"} />
          <InfoCell label="Referral code" value={p.referralCode || "—"} />
          <InfoCell label="Players invited" value={p.invitedCount} />
        </div>
      </Block>

      {/* ── History ── */}
      <Block title={`Every game (${d.games.length})`} sub="Newest first. Saved = pass cover or discount on their own seat."
        onExport={d.games.length ? save("history") : undefined}>
        {d.games.length === 0 ? <div className="text-[13px] text-muted">Has never booked a game.</div> : (
          <div className={`${TABLE_WRAP} max-h-[460px]`}>
            <table className={TABLE}>
              <thead>
                <tr><th>Date</th><th>Game</th><th>Venue</th><th>Organiser</th><th>Status</th><th>Attended</th><th>Paid</th><th>Saved</th><th>Backout fee</th></tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.id}>
                    <td className="whitespace-nowrap!">{formatDateTime(g.scheduledAt)}</td>
                    <td>{g.title}{g.format ? <div className="text-[11px] text-muted">{g.format}</div> : null}</td>
                    <td>{g.venue || "—"}</td>
                    <td>{g.organiserName || "—"}</td>
                    <td>
                      <span className={`${BADGE} ${badgeClassForStatus(g.status || undefined)}`}>{formatStatusLabel(g.status || undefined)}</span>
                      {seatNote(g)}
                    </td>
                    <td>
                      {g.attendanceMarked
                        ? <span className={`${BADGE} ${badgeClassForStatus(g.attended)}`}>{formatStatusLabel(g.attended)}</span>
                        : <span className="text-[12px] text-muted">Not marked</span>}
                    </td>
                    <td className="font-mono">{formatCurrency(g.amountPaidPaise)}<div className="text-[11px] text-muted">{formatStatusLabel(g.paymentStatus || undefined)}</div></td>
                    <td className="font-mono">
                      {g.passBenefitPaise ? <span className={`${BADGE} ${BADGE_GRAY}`}>Pass {formatCurrency(g.passBenefitPaise)}</span> : null}
                      {g.discountPaise ? <span className={`${BADGE} ${BADGE_GRAY}`}>Offer {formatCurrency(g.discountPaise)}</span> : null}
                      {!g.passBenefitPaise && !g.discountPaise ? "—" : null}
                    </td>
                    <td className="font-mono">
                      {g.backoutFeeChargedPaise ? <>{formatCurrency(g.backoutFeeChargedPaise)}{g.backoutFeeReturned ? <div className="text-[11px] text-success">returned</div> : null}</> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </div>
  );
}
