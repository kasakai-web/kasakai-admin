"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { DashboardSection } from "./constants";
import { getAdminToken } from "@/lib/admin-session";
import { PassPage } from "./passes/PassPage";

/* ── Tailwind atoms (migrated 1:1 from dashboard.module.css) ─────────────────────
   Repeated design-system classes as shared utility-string constants; one-off
   styles are inlined directly on their elements. Values match the module exactly. */
// Section chrome
const SECTION_HEAD = "mb-[18px] flex items-center justify-between max-[900px]:flex-wrap max-[900px]:gap-[10px]";
const SECTION_TITLE = "font-mono text-[14px] font-medium uppercase tracking-[0.08em]";
const SECTION_SUB = "mt-[3px] text-[13.5px] text-muted";
// Stat / summary grids (1px gap over the border-coloured bg draws the cell separators)
const STATS_GRID = "mb-6 grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
const QUICK_STATS = "grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
const SUMMARY_FOUR = "grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
const PAYMENT_SUMMARY = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1";
const SUMMARY_THREE = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1";
const STAT_CARD = "bg-surface px-[22px] py-5";
const SUMMARY_ITEM = "bg-surface p-4";
const PAY_CARD = "bg-surface p-4";
const STAT_LABEL = "mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-muted";
const STAT_VALUE = "mb-[6px] font-mono text-[36px] font-medium text-fg";
const SUMMARY_VALUE = "font-mono text-[24px] font-medium text-fg";
const PAY_VALUE = "font-mono text-[24px] font-medium text-fg";
const STAT_DELTA = "font-mono text-[12px]";
const UP = "text-success";
const DOWN = "text-danger";
const NEUTRAL = "text-muted";
const PAY_SUB = "mt-1 font-mono text-[11px] text-muted";
// Panels
const TWO_COL = "mb-6 grid grid-cols-2 gap-5 max-[900px]:grid-cols-1";
const PANEL = "border border-border bg-surface px-5 py-[18px]";
const PANEL_WARN = "border-[rgba(245,158,11,0.25)]!";
const PANEL_TITLE = "mb-[6px] text-[15px] font-semibold text-fg";
const PANEL_SUB = "mb-3 text-[13.5px] text-muted";
const FEED = "flex flex-col gap-[10px]";
const FEED_ROW = "flex items-center justify-between gap-[10px]";
const FEED_TITLE = "text-[13.5px] text-body";
const FEED_SUB = "mt-[3px] font-mono text-[11px] text-muted";
// Badges (BADGE is always paired with a colour variant, so it carries no colour itself)
const BADGE = "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[3px] border px-2 py-[3px] font-mono text-[11px] tracking-[0.08em]";
const BADGE_GREEN = "border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] text-success";
const BADGE_AMBER = "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] text-warning";
const BADGE_RED = "border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] text-danger";
const BADGE_BLUE = "border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)] text-info";
const BADGE_VIOLET = "border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] text-violet";
const BADGE_GRAY = "border-border-2 bg-[rgba(255,255,255,0.05)] text-muted";
// Toolbar + inputs
const TOOLBAR = "mb-[18px] flex flex-wrap gap-[10px]";
const SEARCH_INPUT = "min-w-[260px] flex-1 border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";
const FILTER_SELECT = "border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";
// Tables (cell rules applied via descendant variants; per-cell overrides use `!`)
const TABLE_WRAP = "overflow-x-auto border border-border";
const TABLE = "w-full min-w-[760px] border-collapse max-[900px]:min-w-[1000px] [&_th]:sticky [&_th]:top-0 [&_th]:z-[2] [&_th]:whitespace-nowrap [&_th]:border-b-2 [&_th]:border-b-info [&_th]:bg-[image:linear-gradient(180deg,#1a252d_0%,#121a1f_100%)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-fg [&_td]:border-b [&_td]:border-b-border-2 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td]:text-[14px] [&_td]:text-body [&_tbody_tr:hover]:bg-[rgba(255,255,255,0.025)]";
// Buttons
const ACTION_BTN = "cursor-pointer border border-border-2 bg-transparent px-[10px] py-1 font-mono text-[11px] tracking-[0.06em] text-muted hover:border-[#555] hover:text-fg";
const ACTIONS = "flex gap-[6px]";
const TOPBAR_BTN = "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
// Feedback / status
const FORM_ERROR = "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const LOADING_STATE = "px-6 py-12 text-center text-[14px] text-muted";
// Modals
const MODAL_OVERLAY = "fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[rgba(0,0,0,0.65)] px-4 py-10 backdrop-blur-[4px]";
const MODAL = "w-full max-w-[720px] rounded-xl border border-border-2 bg-surface p-7 max-[640px]:px-4 max-[640px]:py-5";
const MODAL_LARGE = "max-w-[900px]!";
const MODAL_HEAD = "mb-6 flex items-center justify-between";
const MODAL_CLOSE = "cursor-pointer rounded-md border-none bg-transparent px-2 py-1 text-[18px] text-muted transition-[background] duration-150 hover:bg-surface-2 hover:text-fg";
const MODAL_FORM = "flex flex-col gap-5";
const MODAL_ACTIONS = "flex justify-end gap-[10px] border-t border-border pt-2";
const FORM_GRID = "grid grid-cols-2 gap-[14px] max-[640px]:grid-cols-1";
const FORM_LABEL = "flex flex-col gap-[6px] text-[12px] uppercase tracking-[0.05em] text-muted [&_input]:mt-[2px] [&_select]:mt-[2px]";
const CHECKBOX_ROW = "flex flex-wrap gap-4";
const CHECK_LABEL = "flex cursor-pointer items-center gap-2 text-[13px] text-body";
// Game detail
const GAME_INFO_GRID = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-2";
const GAME_INFO_CELL = "bg-surface px-4 py-[14px] text-[13px] text-body";
const BLOCK_TITLE = "mt-4 mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-warning";
const BLOCK_TITLE_SUCCESS = "mt-4 mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-success";
// Notifications feed
const NOTIF_FEED = "flex flex-col overflow-hidden border border-border";
const NOTIF_ITEM = "flex items-start justify-between gap-[14px] border-b border-border-2 px-4 py-[14px]";
const NOTIF_MSG = "text-[14px] leading-[1.45] text-body";
const NOTIF_TIME = "mt-1 font-mono text-[11px] text-muted";
// Tab bar
const TAB_BAR = "mb-5 flex border-b border-border";
const TAB = "mb-[-1px] cursor-pointer border-none border-b-2 border-b-transparent bg-transparent px-[18px] py-[10px] font-mono text-[12px] uppercase tracking-[0.06em] text-muted transition-[color,border-color] duration-150 hover:text-body";
const TAB_ACTIVE = "text-fg! border-b-fg!";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1";

// Backend origin (strips /api/v1 suffix) — used to resolve relative upload paths
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

// Module-level cache: avoids re-fetching Users / Organisers on every tab switch
const _adminCache = new Map<string, { data: unknown; ts: number }>();
const ADMIN_CACHE_TTL = 60_000; // 60 s
function adminCacheGet<T>(key: string): T | null {
  const hit = _adminCache.get(key);
  if (hit && Date.now() - hit.ts < ADMIN_CACHE_TTL) return hit.data as T;
  return null;
}
function adminCacheSet(key: string, data: unknown) { _adminCache.set(key, { data, ts: Date.now() }); }

// Shared class for pagination (Prev/Next/First/Last) buttons
function pagerBtnCls(disabled: boolean): string {
  return `whitespace-nowrap rounded-md border px-[13px] py-[7px] text-[13px] font-bold transition-[background] duration-150 ${
    disabled
      ? "cursor-not-allowed border-border bg-transparent text-muted-2 opacity-50"
      : "cursor-pointer border-info bg-[rgba(59,130,246,0.14)] text-fg opacity-100"
  }`;
}

// Shared class for the bright "Page X / Y" indicator pill
const pagerPillCls = "mx-[2px] whitespace-nowrap rounded-md bg-[#facc15] px-3 py-[6px] text-[13px] font-extrabold text-[#0b1114]";

function resolveImageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${BACKEND_ORIGIN}${src.startsWith("/") ? src : `/${src}`}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
};

type AdminOrganiserRow = {
  id: string; name: string; phone: string; email?: string | null;
  profileImage?: string | null;
  whatsappNumber?: string | null; isVerified?: boolean; isActive?: boolean;
  approvalStatus?: string; status: string;
  gamesHosted?: number; totalPlayersManaged?: number;
  rating?: number; totalRatingsReceived?: number; cancellationRate?: number;
  earningsPaise?: number; pendingPayoutPaise?: number;
  joinedAt?: string | null; location?: string | null; suspendReason?: string | null;
};

type AdminGameRow = {
  id: string; title: string; venue?: string | null; scheduledAt?: string | null;
  format?: string | null; players: { registered: number; totalSlots: number };
  feeInPaise?: number; organiserName?: string; status: string;
};

type AdminPaymentRow = {
  id: string; playerName: string; playerPhone?: string | null;
  type: string; amountPaise: number; balanceAfterPaise?: number;
  gameTitle?: string | null;
  organiserName?: string | null; organiserPhone?: string | null;
  description?: string | null;
  razorpayOrderId?: string | null; razorpayPaymentId?: string | null;
  paidAt?: string | null; status: string;
};

type AdminPaymentSummary = {
  totalTopUpPaise?: number; totalDebitPaise?: number;
  totalRefundedPaise?: number; pendingCount?: number;
};

type AdminPaymentListResponse = {
  success: boolean; count?: number; summary?: AdminPaymentSummary;
  total?: number; page?: number; limit?: number; totalPages?: number;
  data: AdminPaymentRow[]; message?: string;
};

type AdminNotifRow = {
  _id: string; type: string; title: string; body: string;
  isRead: boolean; createdAt: string; recipientRole: string;
  recipientName?: string | null; recipientPhone?: string | null;
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

// Finance
type WalletRow = {
  _id: string;
  user?: { name?: string; phone?: string; email?: string } | null;
  balancePaise: number; totalTopUpPaise: number;
  totalSpentPaise: number; totalRefundedPaise: number; updatedAt?: string;
};

type WalletApiResponse = {
  success: boolean; count?: number;
  total?: number; page?: number; limit?: number; totalPages?: number;
  summary?: { totalBalancePaise: number; totalTopUpPaise: number; totalSpentPaise: number; totalRefundedPaise: number };
  data: WalletRow[]; message?: string;
};

type OrganiserEarningRow = {
  id: string; name: string; phone?: string; email?: string | null;
  totalGames: number; completedGames: number; cancelledGames: number;
  totalRevenuePaise: number; totalGuestSlots: number; totalPaidRegistrations: number;
};

// Feedback
type FeedbackRow = {
  _id: string;
  game?: {
    title?: string; format?: string; scheduledAt?: string;
    organiser?: { name?: string; phone?: string } | null;
    turf?: { name?: string; address?: { area?: string; city?: string } } | null;
  } | null;
  submittedBy?: { name?: string; phone?: string } | null;
  gameRating: number; organiserRating?: number | null; venueRating?: number | null;
  tags?: string[]; comment?: string | null; createdAt: string;
};

type FeedbackApiResponse = {
  success: boolean; count?: number;
  total?: number; page?: number; limit?: number; totalPages?: number;
  summary?: { avgGame?: number | null; tagCounts?: Record<string, number>; total?: number };
  filters?: { organisers?: string[]; turfs?: string[]; games?: { key: string; label: string }[] };
  data: FeedbackRow[]; message?: string;
};

// Platform stats
type PlatformStats = {
  users: { players: number; organisers: number; total: number };
  games: { total: number; active: number; completed: number; cancelled: number };
  finance: { totalRevenuePaise: number; totalRefundedPaise: number; netRevenuePaise: number; totalWalletBalancePaise: number };
};

// Turf
type TurfAddress = { line1: string; line2?: string; area: string; city: string; state: string; pincode: string; country?: string };
type Turf = {
  _id: string; name: string; shortName?: string; address: TurfAddress;
  surfaceType: string; numberOfPitches: number; pitchSizes: string[];
  hasFloodlights: boolean; hasChangingRooms: boolean; hasParking: boolean; hasRefreshments: boolean;
  contactPhone?: string; contactName?: string; googleMapsUrl?: string; parkingNotes?: string;
  isVerified: boolean; isActive: boolean; totalGamesHosted: number; averageRating: number; createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatCurrency(paise?: number) {
  if (typeof paise !== "number") return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatStatusLabel(status?: string) {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeClassForStatus(status?: string) {
  const v = (status || "").toLowerCase();
  if (["active", "approved", "verified", "present", "paid", "success"].includes(v)) return BADGE_GREEN;
  if (["pending", "in review", "review", "draft", "waiting", "notified"].includes(v)) return BADGE_AMBER;
  if (["suspended", "rejected", "inactive", "banned", "cancelled", "forfeited", "no_show", "failed"].includes(v)) return BADGE_RED;
  if (["confirmed", "open"].includes(v)) return BADGE_BLUE;
  if (["completed"].includes(v)) return BADGE_VIOLET;
  return BADGE_GRAY;
}

function starRating(rating?: number | null) {
  if (rating == null) return "—";
  const full = Math.min(Math.round(rating), 5);
  return "★".repeat(full) + "☆".repeat(5 - full) + ` ${rating.toFixed(1)}`;
}

function notifTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function surfaceLabel(s: string) {
  return ({ natural_grass: "Natural", artificial_turf: "Artificial", concrete: "Concrete", indoor: "Indoor" } as Record<string, string>)[s] ?? s;
}

// ── Shared component props ────────────────────────────────────────────────────

type ContentSectionsProps = {
  activeSection: DashboardSection;
  onOpenDetail: (title: string) => void;
  onNavigate: (section: DashboardSection) => void;
};

function Head({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className={SECTION_HEAD}>
      <div>
        <div className={SECTION_TITLE}>{title}</div>
        <div className={SECTION_SUB}>{sub}</div>
      </div>
      {action}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ onNavigate }: { onNavigate: (s: DashboardSection) => void }) {
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

// ── Shared Avatar component ───────────────────────────────────────────────────

function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [imgFailed, setImgFailed]     = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const initial    = name ? name.charAt(0).toUpperCase() : "?";
  const hue        = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const resolvedSrc = imgFailed ? null : resolveImageUrl(src);

  const fallback = (
    <div
      className="flex shrink-0 select-none items-center justify-center rounded-full border-[1.5px] border-[rgba(255,255,255,0.12)] font-bold tracking-normal text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${hue}, 50%, 32%)` }}
    >
      {initial}
    </div>
  );

  if (!resolvedSrc) return fallback;

  return (
    <>
      <img
        src={resolvedSrc}
        alt={name}
        loading="lazy"
        title={`View photo of ${name}`}
        onClick={() => setLightboxOpen(true)}
        className="block shrink-0 cursor-pointer rounded-full border-[1.5px] border-[rgba(255,255,255,0.12)] object-cover transition-[opacity,transform] duration-150"
        style={{ width: size, height: size }}
        onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.82"; (e.currentTarget as HTMLImageElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.opacity = "1";    (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
        onError={() => setImgFailed(true)}
      />

      {/* ── Photo lightbox ── */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="animate-lb-fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.85)] p-6 backdrop-blur-[10px]"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-lb-pop-in relative flex flex-col items-center gap-[14px]"
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              title="Close"
              className="absolute -right-[14px] -top-[14px] z-[1] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[rgba(255,255,255,0.18)] bg-[#1e2030] text-[16px] font-bold leading-none text-[#e0e8f8] transition-[background,border-color,color] duration-150"
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#2e3248"; b.style.borderColor = "rgba(255,255,255,0.35)"; b.style.color = "#fff"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#1e2030"; b.style.borderColor = "rgba(255,255,255,0.18)"; b.style.color = "#e0e8f8"; }}
            >
              ✕
            </button>

            {/* Enlarged photo */}
            <img
              src={resolvedSrc}
              alt={name}
              className="block h-[min(320px,80vw)] w-[min(320px,80vw)] rounded-2xl border-2 border-[rgba(255,255,255,0.14)] object-cover shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
            />

            {/* Name label */}
            <div className="text-center text-[15px] font-bold tracking-[0.02em] text-[#e8eef8] [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
              {name}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────

function Users({ onOpenDetail }: { onOpenDetail: (t: string) => void }) {
  const [users, setUsers]           = useState<AdminUserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRow["role"]>("all");
  const [statusFilter, setStatusFilter] = useState("all");

  type UserSortKey = "name" | "joined" | "games" | "conduct" | "gameplay" | "money";
  const [sortKey, setSortKey] = useState<UserSortKey>("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Server-side pagination state ──
  const PAGE_SIZE = 25;
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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

  const fetchUsers = useCallback(async (force = false) => {
    const token = getAdminToken();
    if (!token) { setLoading(false); setError("Admin session missing."); return; }
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: sortKey,
      dir: sortDir,
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (roleFilter !== "all")   params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const cacheKey = `${API_BASE}/admin/users?${params.toString()}`;
    if (!force) {
      const cached = adminCacheGet<{ data: AdminUserRow[]; total: number; totalPages: number }>(cacheKey);
      if (cached) { setUsers(cached.data); setTotal(cached.total); setTotalPages(cached.totalPages); setLoading(false); return; }
    }
    setLoading(true); setError("");
    try {
      const res  = await fetch(cacheKey, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to load users."); return; }
      const rows: AdminUserRow[] = data.data || [];
      const t  = data.total ?? rows.length;
      const tp = data.totalPages ?? 1;
      adminCacheSet(cacheKey, { data: rows, total: t, totalPages: tp });
      setUsers(rows); setTotal(t); setTotalPages(tp);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, [page, sortKey, sortDir, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      if (users.length === 1 && page > 1) setPage((p) => p - 1);
      else await fetchUsers(true);
    } catch { setDeleteError("Cannot reach the server."); }
    finally { setDeleteBusy(false); }
  }

  function toggleSort(key: UserSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    setPage(1);
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
        <input className={SEARCH_INPUT} placeholder="Search by name, phone, email, location…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={FILTER_SELECT} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as "all" | AdminUserRow["role"]); setPage(1); }}>
          <option value="all">All roles</option>
          <option value="player">Players</option>
          <option value="organiser">Organisers</option>
        </select>
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
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
              <th className={thSort} onClick={() => toggleSort("joined")}>Joined{sortIcon("joined")}</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={12} className="p-8! text-center text-muted!">No users match the current filters.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => onOpenDetail(u.name)} className="cursor-pointer">
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
                <td>{formatDate(u.joinedAt)}</td>
                <td><span className={`${BADGE} ${badgeClassForStatus(u.status)}`}>{formatStatusLabel(u.status)}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                    type="button"
                    onClick={() => { setDeleteTarget(u); setDeleteReason(""); setDeleteError(""); }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-muted">
            Showing <strong className="text-fg">{(page - 1) * PAGE_SIZE + 1}</strong>–
            <strong className="text-fg">{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
            <strong className="text-fg">{total}</strong> users
          </div>
          <div className="flex items-center gap-[6px]">
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span className={pagerPillCls}>Page {page} / {totalPages}</span>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
          </div>
        </div>
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

// ── Organisers ────────────────────────────────────────────────────────────────

function Organisers({ onOpenDetail }: { onOpenDetail: (t: string) => void }) {
  const [organisers, setOrganisers]     = useState<AdminOrganiserRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [actionBusy, setActionBusy]     = useState<string | null>(null);
  const [actionError, setActionError]   = useState("");
  const [suspendTarget, setSuspendTarget] = useState<AdminOrganiserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const fetchOrganisers = useCallback(async (force = false) => {
    const token = getAdminToken();
    if (!token) { setLoading(false); setError("Admin session missing."); return; }
    const cacheKey = `${API_BASE}/admin/organisers`;
    if (!force) {
      const cached = adminCacheGet<AdminOrganiserRow[]>(cacheKey);
      if (cached) { setOrganisers(cached); setLoading(false); return; }
    }
    setLoading(true); setError("");
    try {
      const res  = await fetch(cacheKey, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to load organisers."); return; }
      adminCacheSet(cacheKey, data.data || []);
      setOrganisers(data.data || []);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrganisers(); }, [fetchOrganisers]);

  async function doAction(id: string, action: "approve" | "reject" | "reactivate", body?: object) {
    setActionBusy(id + action); setActionError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/organisers/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || "Action failed."); return; }
      await fetchOrganisers(true);
    } catch { setActionError("Cannot reach the server."); }
    finally { setActionBusy(null); }
  }

  async function doSuspend() {
    if (!suspendTarget) return;
    setActionBusy(suspendTarget.id + "suspend"); setActionError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/organisers/${suspendTarget.id}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: suspendReason.trim() || "Suspended by admin." }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || "Suspend failed."); return; }
      setSuspendTarget(null); setSuspendReason("");
      await fetchOrganisers(true);
    } catch { setActionError("Cannot reach the server."); }
    finally { setActionBusy(null); }
  }

  // Fix: approved-but-suspended organisers were falling through all three filters
  const pending  = organisers.filter((o) => o.approvalStatus === "pending");
  const approved = organisers.filter((o) => o.approvalStatus === "approved" && o.isActive !== false);
  const other    = organisers.filter((o) => !pending.includes(o) && !approved.includes(o));

  const q = search.trim().toLowerCase();
  const applySearch = (list: AdminOrganiserRow[]) =>
    q ? list.filter((o) => [o.name, o.phone, o.email || "", o.whatsappNumber || "", o.location || ""].join(" ").toLowerCase().includes(q)) : list;

  const ORow = ({ o }: { o: AdminOrganiserRow }) => {
    const busy = actionBusy !== null;
    return (
    <tr>
      <td>
        <div className="flex items-center gap-[10px]">
          <Avatar name={o.name} src={o.profileImage} size={36} />
          <div>
            <div className="font-medium">{o.name}</div>
            {o.suspendReason && <div className="text-[11px] text-danger">{o.suspendReason}</div>}
          </div>
        </div>
      </td>
      <td>
        <div>{o.phone}</div>
        {o.whatsappNumber && o.whatsappNumber !== o.phone && (
          <div className="text-[11px] text-muted">WA: {o.whatsappNumber}</div>
        )}
      </td>
      <td>{o.email || "—"}</td>
      <td>{o.location || "—"}</td>
      <td>{formatDate(o.joinedAt)}</td>
      <td>
        <div>{o.gamesHosted ?? 0} hosted</div>
        <div className="text-[11px] text-muted">{o.totalPlayersManaged ?? 0} players</div>
      </td>
      <td>
        {o.rating != null && o.rating > 0
          ? <div className="font-semibold text-warning!">★ {o.rating.toFixed(1)}<span className="ml-[4px] text-[11px] font-normal text-muted">({o.totalRatingsReceived ?? 0})</span></div>
          : <div className="text-[12px] text-muted">No ratings yet</div>
        }
      </td>
      <td>
        {o.cancellationRate != null && o.cancellationRate > 0
          ? <span className={o.cancellationRate > 20 ? "text-danger" : "text-warning"}>{o.cancellationRate.toFixed(1)}%</span>
          : <span className="text-muted">0%</span>
        }
      </td>
      <td>
        <div className="font-semibold text-success!">{formatCurrency(o.earningsPaise)}</div>
        {(o.pendingPayoutPaise ?? 0) > 0 && (
          <div className="text-[11px] text-warning">Pending: {formatCurrency(o.pendingPayoutPaise)}</div>
        )}
      </td>
      <td>
        <span className={`${BADGE} ${badgeClassForStatus(o.status)}`}>{formatStatusLabel(o.status)}</span>
      </td>
      <td>
        <div className={ACTIONS}>
          {o.approvalStatus === "pending" && (
            <>
              <button
                className={`${ACTION_BTN} border-[rgba(34,197,94,0.4)]! text-success!`}
                disabled={busy}
                onClick={() => doAction(o.id, "approve")}
              >
                {actionBusy === o.id + "approve" ? "…" : "Approve"}
              </button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                disabled={busy}
                onClick={() => doAction(o.id, "reject")}
              >
                {actionBusy === o.id + "reject" ? "…" : "Reject"}
              </button>
            </>
          )}
          {o.approvalStatus === "approved" && o.isActive && (
            <button
              className={`${ACTION_BTN} border-[rgba(245,158,11,0.4)]! text-warning!`}
              disabled={busy}
              onClick={() => { setSuspendTarget(o); setSuspendReason(""); }}
            >
              Suspend
            </button>
          )}
          {!o.isActive && o.approvalStatus !== "pending" && o.approvalStatus !== "rejected" && (
            <button
              className={`${ACTION_BTN} border-[rgba(34,197,94,0.4)]! text-success!`}
              disabled={busy}
              onClick={() => doAction(o.id, "reactivate")}
            >
              {actionBusy === o.id + "reactivate" ? "…" : "Reactivate"}
            </button>
          )}
        </div>
      </td>
    </tr>
    );
  };

  const OTable = ({ rows, emptyMsg }: { rows: AdminOrganiserRow[]; emptyMsg: string }) => (
    <div className={`${TABLE_WRAP} mb-5`}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th>Name</th><th>Phone / WhatsApp</th><th>Email</th><th>Location</th>
            <th>Joined</th><th>Games</th><th>Rating</th><th>Cancel Rate</th>
            <th>Earnings</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={11} className="p-6! text-center text-muted!">{emptyMsg}</td></tr>
          )}
          {rows.map((o) => <ORow key={o.id} o={o} />)}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Head title="Organisers" sub={loading ? "Loading…" : `${organisers.length} total organisers`} />
      {error && <div className={FORM_ERROR}>{error}</div>}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone, WhatsApp, email, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={ACTION_BTN} type="button" onClick={() => fetchOrganisers(true)}>Refresh</button>
      </div>
      {loading && <div className={LOADING_STATE}>Loading organisers…</div>}
      <div className={BLOCK_TITLE}>Pending Verification ({applySearch(pending).length})</div>
      <OTable rows={applySearch(pending)} emptyMsg="No pending organisers." />
      <div className={BLOCK_TITLE_SUCCESS}>Approved &amp; Active ({applySearch(approved).length})</div>
      <OTable rows={applySearch(approved)} emptyMsg="No approved organisers." />
      <div className={BLOCK_TITLE}>Rejected / Suspended ({applySearch(other).length})</div>
      <OTable rows={applySearch(other)} emptyMsg="None." />

      {/* Suspend reason modal */}
      {suspendTarget && (
        <div className={MODAL_OVERLAY} onClick={() => setSuspendTarget(null)}>
          <div className={`${MODAL} max-w-[440px]!`} onClick={(e) => e.stopPropagation()}>
            <div className={MODAL_HEAD}>
              <div className={SECTION_TITLE}>Suspend Organiser</div>
              <button className={MODAL_CLOSE} type="button" onClick={() => setSuspendTarget(null)}>✕</button>
            </div>
            <div className="mb-[14px] text-[14px] text-body">
              Suspending <strong>{suspendTarget.name}</strong>. They will not be able to create or manage games.
            </div>
            <label className={FORM_LABEL}>
              Reason (shown to admin log)
              <input
                className={`${SEARCH_INPUT} mt-[6px]! w-full`}
                placeholder="e.g. Multiple complaints from players"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </label>
            {actionError && <div className={`${FORM_ERROR} mt-[10px]`}>{actionError}</div>}
            <div className={`${MODAL_ACTIONS} mt-[18px]`}>
              <button className={ACTION_BTN} type="button" onClick={() => setSuspendTarget(null)}>Cancel</button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!`}
                type="button"
                disabled={actionBusy !== null}
                onClick={doSuspend}
              >
                {actionBusy !== null ? "Suspending…" : "Confirm Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Game Detail Modal ──────────────────────────────────────────────────────────

function GameDetailModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setError("Admin session missing.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetch(`${API_BASE}/admin/games/${gameId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setGame(d.data);
        } else {
          setError(d.message || "Failed to load game.");
        }
      })
      .catch(() => setError("Cannot reach the server."))
      .finally(() => setLoading(false));
  }, [gameId]);

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

// ── Games ─────────────────────────────────────────────────────────────────────

function Games() {
  const [games, setGames]           = useState<AdminGameRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailGameId, setDetailGameId] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = getAdminToken();
      if (!token) { setError("Admin session missing."); return; }
      const res  = await fetch(`${API_BASE}/admin/games`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to load games."); return; }
      setGames(data.data || []);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const filtered = games.filter((g) => {
    const q = search.trim().toLowerCase();
    return (
      [g.title, g.venue || "", g.organiserName || ""].join(" ").toLowerCase().includes(q) &&
      (statusFilter === "all" || g.status.toLowerCase() === statusFilter)
    );
  });

  return (
    <>
      <Head title="Games & Events" sub={loading ? "Loading…" : `${games.length} games across all organisers`} />
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search games, venue, organiser…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={ACTION_BTN} type="button" onClick={fetchGames}>Refresh</button>
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
                  <button className={ACTION_BTN} type="button" onClick={() => setDetailGameId(g.id)}>
                    View Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailGameId && (
        <GameDetailModal gameId={detailGameId} onClose={() => setDetailGameId(null)} />
      )}
    </>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────

const TXN_TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  topup:       { label: "Top-up",      cls: BADGE_GREEN  },
  lock:        { label: "Lock",        cls: BADGE_AMBER  },
  unlock:      { label: "Unlock",      cls: BADGE_GRAY   },
  debit:       { label: "Debit",       cls: BADGE_BLUE   },
  refund:      { label: "Refund",      cls: BADGE_VIOLET },
  backout_fee: { label: "Backout Fee", cls: BADGE_RED    },
  bonus:       { label: "Bonus",       cls: BADGE_GREEN  },
  withdrawal:  { label: "Withdrawal",  cls: BADGE_RED    },
};

function Payments() {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [summary, setSummary]   = useState<AdminPaymentSummary>({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Server-side pagination state ──
  const PAGE_SIZE = 25;
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Debounced search — avoids one request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPayments = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = getAdminToken();
      if (!token) { setError("Admin session missing."); return; }
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (typeFilter   !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res  = await fetch(`${API_BASE}/admin/payments?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as AdminPaymentListResponse;
      if (!res.ok) { setError(data.message || "Failed to load payments."); return; }
      const rows = data.data || [];
      setPayments(rows);
      setSummary(data.summary || {});
      setTotal(data.total ?? rows.length);
      setTotalPages(data.totalPages ?? 1);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, typeFilter, statusFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filtered = payments; // server already filtered + paginated

  return (
    <>
      <Head title="Payments" sub={loading ? "Loading…" : `${total} wallet transactions`} />

      {/* Summary cards */}
      <div className={SUMMARY_FOUR}>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Top-ups</div>
          <div className={`${SUMMARY_VALUE} text-success!`}>{formatCurrency(summary.totalTopUpPaise)}</div>
          <div className={PAY_SUB}>Razorpay recharges</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Debits</div>
          <div className={SUMMARY_VALUE}>{formatCurrency(summary.totalDebitPaise)}</div>
          <div className={PAY_SUB}>Game fees &amp; backout charges</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Total Refunded</div>
          <div className={`${SUMMARY_VALUE} text-violet!`}>{formatCurrency(summary.totalRefundedPaise)}</div>
          <div className={PAY_SUB}>Cancellations &amp; refunds</div>
        </div>
        <div className={SUMMARY_ITEM}>
          <div className={STAT_LABEL}>Pending</div>
          <div className={`${SUMMARY_VALUE} text-warning!`}>{summary.pendingCount ?? 0}</div>
          <div className={PAY_SUB}>Unconfirmed transactions</div>
        </div>
      </div>

      {/* Filters */}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search player, phone, game, Razorpay ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={FILTER_SELECT} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          <option value="topup">Top-up</option>
          <option value="lock">Lock</option>
          <option value="unlock">Unlock</option>
          <option value="debit">Debit</option>
          <option value="refund">Refund</option>
          <option value="backout_fee">Backout Fee</option>
          <option value="bonus">Bonus</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button className={ACTION_BTN} type="button" onClick={fetchPayments}>Refresh</button>
      </div>

      {error   && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading transactions…</div>}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Txn ID</th><th>Player</th><th>Type</th><th>Amount</th>
              <th>Balance After</th><th>Game</th><th>Organiser</th>
              <th>Description / Razorpay</th><th>Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="p-6! text-center text-muted!">No transactions found.</td></tr>
            )}
            {filtered.map((p) => {
              const txnMeta = TXN_TYPE_LABEL[p.type] || { label: p.type, cls: BADGE_GRAY };
              return (
                <tr key={String(p.id)}>
                  <td className="font-mono text-[11px]! text-muted!">
                    {String(p.id).slice(-8).toUpperCase()}
                  </td>
                  <td>
                    <div className="font-medium">{p.playerName}</div>
                    {p.playerPhone && <div className="text-[11px] text-muted">{p.playerPhone}</div>}
                  </td>
                  <td>
                    <span className={`${BADGE} ${txnMeta.cls}`}>
                      {txnMeta.label}
                    </span>
                  </td>
                  <td className={`font-semibold ${["refund", "unlock", "bonus"].includes(p.type) ? "text-success!" : ["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "text-danger!" : "text-body!"}`}>
                    {["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "−" : "+"}{formatCurrency(p.amountPaise)}
                  </td>
                  <td className="text-[12px] text-muted">{formatCurrency(p.balanceAfterPaise)}</td>
                  <td>{p.gameTitle || <span className="text-muted">—</span>}</td>
                  <td>
                    {p.organiserName
                      ? <>
                          <div className="font-medium">{p.organiserName}</div>
                          {p.organiserPhone && <div className="text-[11px] text-muted">{p.organiserPhone}</div>}
                        </>
                      : <span className="text-muted">—</span>
                    }
                  </td>
                  <td className="max-w-[180px]">
                    {p.description && <div className="text-[12px]">{p.description}</div>}
                    {p.razorpayPaymentId && (
                      <div className="mt-[2px] font-mono text-[10px] text-muted">
                        {p.razorpayPaymentId}
                      </div>
                    )}
                    {!p.description && !p.razorpayPaymentId && <span className="text-muted">—</span>}
                  </td>
                  <td>{formatDateTime(p.paidAt)}</td>
                  <td><span className={`${BADGE} ${badgeClassForStatus(p.status)}`}>{formatStatusLabel(p.status)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-muted">
            Showing <strong className="text-fg">{(page - 1) * PAGE_SIZE + 1}</strong>–
            <strong className="text-fg">{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
            <strong className="text-fg">{total}</strong> transactions
          </div>
          <div className="flex items-center gap-[6px]">
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span className={pagerPillCls}>Page {page} / {totalPages}</span>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  game_created: "Game Created", game_registered: "Registered",
  game_cancelled: "Cancelled", game_backout_player: "Player Backed Out",
  game_backout_organiser: "Organiser Backout", waitlist_joined: "Waitlist Join",
  waitlist_spot: "Spot Available", waitlist_approved: "Waitlist Approved",
  player_removed: "Removed", wallet_topup: "Top-up",
  wallet_debit: "Debit", refund_credited: "Refund", system: "System",
};

function Notifications() {
  const [notifs, setNotifs]   = useState<AdminNotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/admin/notifications?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          const list: AdminNotifRow[] = d.data?.notifications ?? [];
          setNotifs(list);
          setTotal(d.data?.total ?? list.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = notifs.filter((n) => {
    const q = search.trim().toLowerCase();
    return (
      [n.title, n.body, n.recipientRole, n.type, n.recipientName || "", n.recipientPhone || ""].join(" ").toLowerCase().includes(q) &&
      (roleFilter === "all" || n.recipientRole === roleFilter)
    );
  });

  const unread = notifs.filter((n) => !n.isRead).length;

  return (
    <>
      <Head title="Platform Notifications" sub="In-app notifications across all users" />
      <div className={SUMMARY_THREE}>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total (DB)</div><div className={SUMMARY_VALUE}>{loading ? "—" : total}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Unread</div><div className={`${SUMMARY_VALUE} text-warning!`}>{loading ? "—" : unread}</div></div>
        <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Read</div><div className={`${SUMMARY_VALUE} text-success!`}>{loading ? "—" : notifs.length - unread}</div></div>
      </div>
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search notifications…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={FILTER_SELECT} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All recipients</option>
          <option value="player">Players only</option>
          <option value="organiser">Organisers only</option>
        </select>
      </div>
      {loading ? (
        <div className={LOADING_STATE}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-0 py-8 text-center text-[13px] text-muted">No notifications found.</div>
      ) : (
        <div className={NOTIF_FEED}>
          {filtered.map((n) => (
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
    </>
  );
}

// ── Feedback (live) ───────────────────────────────────────────────────────────

type FbSortKey = "date" | "gameRating" | "organiserRating" | "venueRating";
type PrSortKey = "date" | "conduct" | "gameplay" | "avg";
type DateRange = "all" | "today" | "week" | "month";

type CommentModalData = { comment: string; player: string; game: string };

type PlayerRatingRow = {
  id: string;
  playerName: string; playerPhone?: string | null;
  organiserName: string; organiserPhone?: string | null;
  gameTitle?: string | null; gameFormat?: string | null; gameDate?: string | null;
  conductRating: number; gameplayRating: number; avgRating: number;
  preferredPosition?: string | null; gkAffinity?: number | null;
  notes?: string | null; ratedAt?: string | null;
};

function Feedback() {
  const [tab, setTab] = useState<"player" | "organiser">("player");

  // ── Tab 1: Player → Platform (GameFeedback) ────────────────────────────────
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]); // current page only
  const [summary, setSummary]   = useState<{ avgGame?: number | null; tagCounts?: Record<string, number>; total?: number }>({});
  const [fbFilterOpts, setFbFilterOpts] = useState<{ organisers: string[]; turfs: string[]; games: { key: string; label: string }[] }>({ organisers: [], turfs: [], games: [] });
  const [fbLoading, setFbLoading] = useState(true);
  const [fbError, setFbError]     = useState("");
  const [fbSearch, setFbSearch]   = useState("");
  const [sortKey, setSortKey]   = useState<FbSortKey>("date");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [commentModal, setCommentModal] = useState<CommentModalData | null>(null);
  const [fbOrganiser, setFbOrganiser] = useState("");
  const [fbTurf, setFbTurf]           = useState("");
  const [fbGame, setFbGame]           = useState("");
  const [fbDateRange, setFbDateRange] = useState<DateRange>("all");

  // ── Server-side pagination state ──
  const FB_PAGE_SIZE = 25;
  const [fbPage, setFbPage]             = useState(1);
  const [fbTotal, setFbTotal]           = useState(0); // rows matching filters
  const [fbTotalPages, setFbTotalPages] = useState(1);

  // Debounced search — avoids one request per keystroke
  const [fbDebouncedSearch, setFbDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFbDebouncedSearch(fbSearch), 300);
    return () => clearTimeout(t);
  }, [fbSearch]);

  // ── Tab 2: Organiser → Player (PlayerRating) ───────────────────────────────
  const [prRows, setPrRows]       = useState<PlayerRatingRow[]>([]);
  const [prTotal, setPrTotal]     = useState(0);
  const [prLoading, setPrLoading] = useState(true);
  const [prError, setPrError]     = useState("");
  const [prSearch, setPrSearch]   = useState("");
  const [prSortKey, setPrSortKey] = useState<PrSortKey>("date");
  const [prSortDir, setPrSortDir] = useState<"asc" | "desc">("desc");
  const [notesModal, setNotesModal] = useState<{ notes: string; player: string; organiser: string } | null>(null);
  const [prOrganiser, setPrOrganiser] = useState("");
  const [prGame, setPrGame]           = useState("");
  const [prDateRange, setPrDateRange] = useState<DateRange>("all");

  const fetchFeedback = useCallback(async () => {
    setFbLoading(true); setFbError("");
    try {
      const token = getAdminToken();
      if (!token) { setFbError("Admin session missing."); return; }
      const params = new URLSearchParams({
        page: String(fbPage), limit: String(FB_PAGE_SIZE), sortKey, sortDir,
      });
      if (fbDebouncedSearch.trim()) params.set("search", fbDebouncedSearch.trim());
      if (fbOrganiser)            params.set("organiser", fbOrganiser);
      if (fbTurf)                 params.set("turf", fbTurf);
      if (fbGame)                 params.set("game", fbGame);
      if (fbDateRange !== "all")  params.set("dateRange", fbDateRange);
      const res = await fetch(`${API_BASE}/admin/feedback?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = (await res.json()) as FeedbackApiResponse;
      if (!res.ok || !d.success) { setFbError(d.message || "Failed to load feedback."); return; }
      setFeedback(d.data || []);
      setSummary(d.summary || {});
      if (d.filters) setFbFilterOpts({ organisers: d.filters.organisers || [], turfs: d.filters.turfs || [], games: d.filters.games || [] });
      setFbTotal(d.total ?? (d.data?.length ?? 0));
      setFbTotalPages(d.totalPages ?? 1);
    } catch { setFbError("Cannot reach the server."); }
    finally { setFbLoading(false); }
  }, [fbPage, fbDebouncedSearch, sortKey, sortDir, fbOrganiser, fbTurf, fbGame, fbDateRange]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setPrLoading(false); setPrError("Admin session missing."); return; }
    fetch(`${API_BASE}/admin/player-ratings?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setPrRows(d.data || []); setPrTotal(d.count ?? 0); }
        else setPrError(d.message || "Failed to load player ratings.");
      })
      .catch(() => setPrError("Cannot reach the server."))
      .finally(() => setPrLoading(false));
  }, []);

  // ── Tab 1 helpers ──────────────────────────────────────────────────────────
  function toggleSort(key: FbSortKey) {
    setFbPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  function sortIcon(key: FbSortKey) {
    if (sortKey !== key) return <span className="ml-[4px] text-muted-2">↕</span>;
    return <span className="ml-[4px]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  // ── Tab 2 helpers ──────────────────────────────────────────────────────────
  function togglePrSort(key: PrSortKey) {
    if (prSortKey === key) setPrSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPrSortKey(key); setPrSortDir("desc"); }
  }
  function prSortIcon(key: PrSortKey) {
    if (prSortKey !== key) return <span className="ml-[4px] text-muted-2">↕</span>;
    return <span className="ml-[4px]">{prSortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thSort = "cursor-pointer select-none";

  // ── Unique filter lists ──────────────────────────────────────────────────────
  // Player-feedback filter options come from the server (computed over ALL
  // feedback, not just the current page) via `fbFilterOpts`.

  const prOrganisers = useMemo(() => {
    const s = new Set<string>();
    prRows.forEach(r => { if (r.organiserName) s.add(r.organiserName); });
    return Array.from(s).sort();
  }, [prRows]);

  const prGames = useMemo(() => {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const map = new Map<string, string>(); // "title||YYYY-MM-DD" → display label
    prRows.forEach(r => {
      const title = r.gameTitle;
      if (!title) return;
      const dateOnly = (r.gameDate || "").slice(0, 10);
      const key = `${title}||${dateOnly}`;
      if (!map.has(key)) {
        let dateLabel = "";
        if (dateOnly) {
          const [, m, d] = dateOnly.split("-").map(Number);
          dateLabel = `${d} ${MONTHS[m - 1]}`;
        }
        map.set(key, dateLabel ? `${title} — ${dateLabel}` : title);
      }
    });
    return Array.from(map.entries()).sort((a, b) => {
      const dA = a[0].split("||")[1] || "";
      const dB = b[0].split("||")[1] || "";
      return dB !== dA ? dB.localeCompare(dA) : a[1].localeCompare(b[1]);
    });
  }, [prRows]);

  function inDateRange(iso: string | null | undefined, range: DateRange): boolean {
    if (range === "all") return true;
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    if (range === "today") return d.toDateString() === now.toDateString();
    const ms = range === "week" ? 7 * 86400000 : 30 * 86400000;
    return d >= new Date(now.getTime() - ms);
  }

  const DATE_RANGE_LABELS: Record<DateRange, string> = { all: "All Time", today: "Today", week: "7 Days", month: "30 Days" };
  const DATE_RANGES: DateRange[] = ["all", "today", "week", "month"];

  // Player feedback is filtered, sorted and paginated by the server; `feedback`
  // is already the exact page to render.

  const prFiltered = prRows.filter((r) => {
    const q = prSearch.trim().toLowerCase();
    const matchSearch = !q || [r.playerName, r.playerPhone || "", r.organiserName, r.organiserPhone || "", r.gameTitle || "", r.notes || ""].join(" ").toLowerCase().includes(q);
    const matchOrg  = !prOrganiser || r.organiserName === prOrganiser;
    const matchGame = !prGame || (() => {
      const [ft, fd] = prGame.split("||");
      return r.gameTitle === ft && (r.gameDate || "").slice(0, 10) === fd;
    })();
    const matchDate = inDateRange(r.ratedAt, prDateRange);
    return matchSearch && matchOrg && matchGame && matchDate;
  });

  const prSorted = [...prFiltered].sort((a, b) => {
    let av = 0, bv = 0;
    if (prSortKey === "date")     { av = a.ratedAt ? new Date(a.ratedAt).getTime() : 0; bv = b.ratedAt ? new Date(b.ratedAt).getTime() : 0; }
    if (prSortKey === "conduct")  { av = a.conductRating;  bv = b.conductRating; }
    if (prSortKey === "gameplay") { av = a.gameplayRating; bv = b.gameplayRating; }
    if (prSortKey === "avg")      { av = a.avgRating;      bv = b.avgRating; }
    return prSortDir === "asc" ? av - bv : bv - av;
  });

  const topTags = Object.entries(summary.tagCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const TRUNC = 80;

  return (
    <>
      <Head title="Feedback" sub="Player feedback to platform · Organiser ratings to players" />

      {/* Tab bar */}
      <div className={TAB_BAR}>
        <button
          className={`${TAB} ${tab === "player" ? TAB_ACTIVE : ""}`}
          type="button"
          onClick={() => setTab("player")}
        >
          Player → Platform ({summary.total ?? 0})
        </button>
        <button
          className={`${TAB} ${tab === "organiser" ? TAB_ACTIVE : ""}`}
          type="button"
          onClick={() => setTab("organiser")}
        >
          Organiser → Players ({prTotal})
        </button>
      </div>

      {/* ── Tab 1: Player feedback ─────────────────────────────────────────── */}
      {tab === "player" && (
        <>
          <div className={PAYMENT_SUMMARY}>
            <div className={PAY_CARD}><div className={STAT_LABEL}>Total Submissions</div><div className={PAY_VALUE}>{fbLoading ? "—" : (summary.total ?? 0)}</div><div className={PAY_SUB}>Post-game feedback</div></div>
            <div className={PAY_CARD}><div className={STAT_LABEL}>Avg Game Rating</div><div className={`${PAY_VALUE} text-warning!`}>{summary.avgGame != null ? `${summary.avgGame} / 5` : "—"}</div><div className={PAY_SUB}>Across all submitted feedback</div></div>
            <div className={PAY_CARD}>
              <div className={STAT_LABEL}>Top Tags</div>
              <div className="mt-[6px] flex flex-wrap gap-1">
                {topTags.length === 0 ? <span className="text-[13px] text-muted">—</span> : topTags.map(([tag, count]) => (
                  <span key={tag} className={`${BADGE} ${BADGE_GRAY}`}>{tag} ({count})</span>
                ))}
              </div>
            </div>
          </div>

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search player, organiser, turf, game, comment…" value={fbSearch} onChange={(e) => { setFbSearch(e.target.value); setFbPage(1); }} />
            <select className={FILTER_SELECT} value={fbOrganiser} onChange={(e) => { setFbOrganiser(e.target.value); setFbPage(1); }}>
              <option value="">All Organisers</option>
              {fbFilterOpts.organisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={FILTER_SELECT} value={fbTurf} onChange={(e) => { setFbTurf(e.target.value); setFbPage(1); }}>
              <option value="">All Turfs</option>
              {fbFilterOpts.turfs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={FILTER_SELECT} value={fbGame} onChange={(e) => { setFbGame(e.target.value); setFbPage(1); }}>
              <option value="">All Games</option>
              {fbFilterOpts.games.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => { setFbDateRange(r); setFbPage(1); }}
                  className={`cursor-pointer border px-3 py-[7px] text-[12px] ${fbDateRange === r ? "border-accent bg-accent font-bold text-black" : "border-border-2 bg-surface font-normal text-muted"}`}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(fbOrganiser || fbTurf || fbGame || fbDateRange !== "all" || fbSearch) && (
              <button type="button"
                onClick={() => { setFbOrganiser(""); setFbTurf(""); setFbGame(""); setFbDateRange("all"); setFbSearch(""); setFbPage(1); }}
                className="cursor-pointer whitespace-nowrap border border-[rgba(241,118,127,0.35)] bg-[rgba(241,118,127,0.1)] px-3 py-[7px] text-[12px] text-danger">
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!fbLoading && (
            <div className="mb-[10px] text-[12px] text-muted">
              <strong className="text-fg">{fbTotal}</strong> {fbTotal === 1 ? "entry" : "entries"} match
            </div>
          )}

          {fbError   && <div className={FORM_ERROR}>{fbError}</div>}
          {fbLoading && <div className={LOADING_STATE}>Loading feedback…</div>}

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Game</th>
                  <th>Organiser</th>
                  <th>Turf / Venue</th>
                  <th className={thSort} onClick={() => toggleSort("date")}>Date{sortIcon("date")}</th>
                  <th className={thSort} onClick={() => toggleSort("gameRating")}>Game ★{sortIcon("gameRating")}</th>
                  <th className={thSort} onClick={() => toggleSort("organiserRating")}>Organiser ★{sortIcon("organiserRating")}</th>
                  <th className={thSort} onClick={() => toggleSort("venueRating")}>Venue ★{sortIcon("venueRating")}</th>
                  <th>Tags</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {!fbLoading && feedback.length === 0 && (
                  <tr><td colSpan={10} className="p-6! text-center text-muted!">No feedback submitted yet.</td></tr>
                )}
                {feedback.map((f) => (
                  <tr key={f._id}>
                    <td>
                      <div className="font-medium">{f.submittedBy?.name || "—"}</div>
                      <div className="text-[11px] text-muted">{f.submittedBy?.phone || ""}</div>
                    </td>
                    <td>
                      {f.game?.title || "—"}
                      <div className="text-[11px] text-muted">{f.game?.format || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.organiser?.name || "—"}</div>
                      <div className="text-[11px] text-muted">{f.game?.organiser?.phone || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.turf?.name || "—"}</div>
                      {(f.game?.turf?.address?.area || f.game?.turf?.address?.city) && (
                        <div className="text-[11px] text-muted">
                          {[f.game?.turf?.address?.area, f.game?.turf?.address?.city].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(f.createdAt)}</td>
                    <td className="text-warning!">{starRating(f.gameRating)}</td>
                    <td className="text-warning!">{starRating(f.organiserRating)}</td>
                    <td className="text-warning!">{starRating(f.venueRating)}</td>
                    <td>
                      {(f.tags || []).map((tag) => (
                        <span key={tag} className={`${BADGE} ${BADGE_GRAY} mr-[3px]`}>{tag}</span>
                      ))}
                    </td>
                    <td className="max-w-[200px]">
                      {!f.comment ? (
                        <span className="text-muted">—</span>
                      ) : f.comment.length <= TRUNC ? (
                        <span className="text-[13px]">{f.comment}</span>
                      ) : (
                        <div className="flex items-center gap-[6px]">
                          <span className="inline-block max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
                            {f.comment}
                          </span>
                          <button
                            type="button"
                            title="View full comment"
                            onClick={() => setCommentModal({ comment: f.comment!, player: f.submittedBy?.name || "Unknown", game: f.game?.title || "Unknown game" })}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-2 bg-surface-2 text-[13px] leading-none text-fg"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!fbLoading && fbTotal > 0 && (
            <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-muted">
                Showing <strong className="text-fg">{(fbPage - 1) * FB_PAGE_SIZE + 1}</strong>–
                <strong className="text-fg">{Math.min(fbPage * FB_PAGE_SIZE, fbTotal)}</strong> of{" "}
                <strong className="text-fg">{fbTotal}</strong>
              </div>
              <div className="flex items-center gap-[6px]">
                <button className={pagerBtnCls(fbPage <= 1)} type="button" disabled={fbPage <= 1} onClick={() => setFbPage(1)}>« First</button>
                <button className={pagerBtnCls(fbPage <= 1)} type="button" disabled={fbPage <= 1} onClick={() => setFbPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span className={pagerPillCls}>Page {fbPage} / {fbTotalPages}</span>
                <button className={pagerBtnCls(fbPage >= fbTotalPages)} type="button" disabled={fbPage >= fbTotalPages} onClick={() => setFbPage((p) => Math.min(fbTotalPages, p + 1))}>Next ›</button>
                <button className={pagerBtnCls(fbPage >= fbTotalPages)} type="button" disabled={fbPage >= fbTotalPages} onClick={() => setFbPage(fbTotalPages)}>Last »</button>
              </div>
            </div>
          )}

          {/* Full-comment modal */}
          {commentModal && (
            <div className={MODAL_OVERLAY} onClick={() => setCommentModal(null)}>
              <div className={`${MODAL} max-w-[540px]!`} onClick={(e) => e.stopPropagation()}>
                <div className={MODAL_HEAD}>
                  <div>
                    <div className={SECTION_TITLE}>Full Comment</div>
                    <div className="mt-[5px] text-[12px] text-muted">
                      {commentModal.player} &nbsp;·&nbsp; {commentModal.game}
                    </div>
                  </div>
                  <button className={MODAL_CLOSE} type="button" onClick={() => setCommentModal(null)}>✕</button>
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-body">
                  {commentModal.comment}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab 2: Organiser → Player ratings ──────────────────────────────── */}
      {tab === "organiser" && (
        <>
          <div className={SUMMARY_THREE}>
            <div className={SUMMARY_ITEM}><div className={STAT_LABEL}>Total Ratings</div><div className={SUMMARY_VALUE}>{prLoading ? "—" : prTotal}</div></div>
            <div className={SUMMARY_ITEM}>
              <div className={STAT_LABEL}>Avg Conduct</div>
              <div className={`${SUMMARY_VALUE} text-warning!`}>
                {prRows.length > 0
                  ? (prRows.reduce((s, r) => s + r.conductRating, 0) / prRows.length).toFixed(1)
                  : "—"}
              </div>
            </div>
            <div className={SUMMARY_ITEM}>
              <div className={STAT_LABEL}>Avg Gameplay</div>
              <div className={`${SUMMARY_VALUE} text-warning!`}>
                {prRows.length > 0
                  ? (prRows.reduce((s, r) => s + r.gameplayRating, 0) / prRows.length).toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search player, organiser, game, notes…" value={prSearch} onChange={(e) => setPrSearch(e.target.value)} />
            <select className={FILTER_SELECT} value={prOrganiser} onChange={(e) => setPrOrganiser(e.target.value)}>
              <option value="">All Organisers</option>
              {prOrganisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={FILTER_SELECT} value={prGame} onChange={(e) => setPrGame(e.target.value)}>
              <option value="">All Games</option>
              {prGames.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <div className="flex flex-wrap gap-1">
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => setPrDateRange(r)}
                  className={`cursor-pointer border px-3 py-[7px] text-[12px] ${prDateRange === r ? "border-accent bg-accent font-bold text-black" : "border-border-2 bg-surface font-normal text-muted"}`}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(prOrganiser || prGame || prDateRange !== "all" || prSearch) && (
              <button type="button"
                onClick={() => { setPrOrganiser(""); setPrGame(""); setPrDateRange("all"); setPrSearch(""); }}
                className="cursor-pointer whitespace-nowrap border border-[rgba(241,118,127,0.35)] bg-[rgba(241,118,127,0.1)] px-3 py-[7px] text-[12px] text-danger">
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!prLoading && (
            <div className="mb-[10px] text-[12px] text-muted">
              Showing <strong className="text-fg">{prSorted.length}</strong> of {prTotal} entries
            </div>
          )}

          {prError   && <div className={FORM_ERROR}>{prError}</div>}
          {prLoading && <div className={LOADING_STATE}>Loading player ratings…</div>}

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Organiser</th>
                  <th>Game</th>
                  <th>Position</th>
                  <th className={thSort} onClick={() => togglePrSort("conduct")}>Conduct ★{prSortIcon("conduct")}</th>
                  <th className={thSort} onClick={() => togglePrSort("gameplay")}>Gameplay ★{prSortIcon("gameplay")}</th>
                  <th className={thSort} onClick={() => togglePrSort("avg")}>Avg ★{prSortIcon("avg")}</th>
                  <th className={thSort} onClick={() => togglePrSort("date")}>Date{prSortIcon("date")}</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!prLoading && prSorted.length === 0 && (
                  <tr><td colSpan={9} className="p-6! text-center text-muted!">No organiser ratings submitted yet.</td></tr>
                )}
                {prSorted.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      <div className="font-medium">{r.playerName}</div>
                      {r.playerPhone && <div className="text-[11px] text-muted">{r.playerPhone}</div>}
                    </td>
                    <td>
                      <div>{r.organiserName}</div>
                      {r.organiserPhone && <div className="text-[11px] text-muted">{r.organiserPhone}</div>}
                    </td>
                    <td>
                      <div>{r.gameTitle || "—"}</div>
                      {r.gameFormat && <div className="text-[11px] text-muted">{r.gameFormat}</div>}
                    </td>
                    <td>
                      {r.preferredPosition
                        ? <span className={`${BADGE} ${BADGE_GRAY}`}>{formatStatusLabel(r.preferredPosition)}</span>
                        : <span className="text-muted">—</span>
                      }
                      {r.gkAffinity != null && (
                        <div className="mt-[2px] text-[11px] text-muted">GK: {r.gkAffinity}/5</div>
                      )}
                    </td>
                    <td className="font-semibold text-warning!">★ {r.conductRating.toFixed(1)}</td>
                    <td className="font-semibold text-warning!">★ {r.gameplayRating.toFixed(1)}</td>
                    <td className="font-bold">
                      <span className={r.avgRating >= 4 ? "text-success" : r.avgRating >= 3 ? "text-warning" : "text-danger"}>
                        ★ {r.avgRating.toFixed(1)}
                      </span>
                    </td>
                    <td>{formatDate(r.ratedAt)}</td>
                    <td className="max-w-[180px]">
                      {!r.notes ? (
                        <span className="text-muted">—</span>
                      ) : r.notes.length <= TRUNC ? (
                        <span className="text-[13px]">{r.notes}</span>
                      ) : (
                        <div className="flex items-center gap-[6px]">
                          <span className="inline-block max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
                            {r.notes}
                          </span>
                          <button
                            type="button"
                            title="View full notes"
                            onClick={() => setNotesModal({ notes: r.notes!, player: r.playerName, organiser: r.organiserName })}
                            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-2 bg-surface-2 text-[13px] leading-none text-fg"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full-notes modal */}
          {notesModal && (
            <div className={MODAL_OVERLAY} onClick={() => setNotesModal(null)}>
              <div className={`${MODAL} max-w-[540px]!`} onClick={(e) => e.stopPropagation()}>
                <div className={MODAL_HEAD}>
                  <div>
                    <div className={SECTION_TITLE}>Organiser Notes</div>
                    <div className="mt-[5px] text-[12px] text-muted">
                      {notesModal.organiser} &nbsp;→&nbsp; {notesModal.player}
                    </div>
                  </div>
                  <button className={MODAL_CLOSE} type="button" onClick={() => setNotesModal(null)}>✕</button>
                </div>
                <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-body">
                  {notesModal.notes}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Disputes ──────────────────────────────────────────────────────────────────

function Disputes({ onOpenDetail }: { onOpenDetail: (t: string) => void }) {
  return (
    <>
      <Head title="Disputes & Refunds" sub="Open disputes requiring admin resolution" />
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Raised By</th><th>Type</th><th>Game</th><th>Description</th><th>Raised</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>Arjun Mehta</td><td><span className={`${BADGE} ${BADGE_RED}`}>Refund request</span></td><td>Monday 6v6</td><td>Says refund not received after cancellation</td><td>14 min ago</td><td><span className={`${BADGE} ${BADGE_RED}`}>Open</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Refund Request — Arjun Mehta")}>Resolve</button></td></tr>
            <tr><td>Rohit Sinha</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Backout fee</span></td><td>Saturday 7v7</td><td>Claims family emergency, requesting fee waiver</td><td>3 hr ago</td><td><span className={`${BADGE} ${BADGE_RED}`}>Open</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Backout Fee — Rohit Sinha")}>Resolve</button></td></tr>
            <tr><td>Priya Nair</td><td><span className={`${BADGE} ${BADGE_BLUE}`}>Team fairness</span></td><td>Friday 5v5</td><td>Teams were unbalanced — all high rated on one side</td><td>1 day ago</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>In review</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Team Fairness — Priya Nair")}>Resolve</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Communities ───────────────────────────────────────────────────────────────

function Communities({ onOpenDetail }: { onOpenDetail: (t: string) => void }) {
  return (
    <>
      <div className={SECTION_HEAD}>
        <div>
          <div className={SECTION_TITLE}>Communities</div>
          <div className={SECTION_SUB}>Active communities across India</div>
        </div>
        <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button">+ Add Community</button>
      </div>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Community</th><th>City</th><th>Organiser</th><th>Members</th><th>Games (MTD)</th><th>WhatsApp</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>FC Bengaluru Sundays</td><td>Bengaluru</td><td>Vikram Rao</td><td>84</td><td>18</td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Linked</span></td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Active</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("FC Bengaluru Sundays")}>View</button></td></tr>
            <tr><td>Weekend Warriors Mumbai</td><td>Mumbai</td><td>Neha Kapoor</td><td>62</td><td>12</td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Linked</span></td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Active</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Weekend Warriors Mumbai")}>View</button></td></tr>
            <tr><td>Delhi Football Club</td><td>Delhi</td><td>Pending</td><td>0</td><td>0</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Pending</span></td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Setup</span></td><td><button className={ACTION_BTN}>Activate</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Venue / Turf types & modal ────────────────────────────────────────────────

const EMPTY_TURF_FORM = {
  name: "", shortName: "", surfaceType: "artificial_turf",
  numberOfPitches: 1, pitchSizes: ["medium"],
  hasFloodlights: true, hasChangingRooms: false, hasParking: false, hasRefreshments: false,
  contactPhone: "", contactName: "", googleMapsUrl: "", parkingNotes: "",
  "address.line1": "", "address.line2": "", "address.area": "",
  "address.city": "", "address.state": "", "address.pincode": "",
};

type TurfForm = typeof EMPTY_TURF_FORM;

function TurfModal({ initial, onClose, onSaved }: { initial?: Turf | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TurfForm>(
    initial
      ? {
          name: initial.name, shortName: initial.shortName ?? "", surfaceType: initial.surfaceType,
          numberOfPitches: initial.numberOfPitches, pitchSizes: initial.pitchSizes,
          hasFloodlights: initial.hasFloodlights, hasChangingRooms: initial.hasChangingRooms,
          hasParking: initial.hasParking, hasRefreshments: initial.hasRefreshments,
          contactPhone: initial.contactPhone ?? "", contactName: initial.contactName ?? "",
          googleMapsUrl: initial.googleMapsUrl ?? "", parkingNotes: initial.parkingNotes ?? "",
          "address.line1": initial.address.line1, "address.line2": initial.address.line2 ?? "",
          "address.area": initial.address.area, "address.city": initial.address.city,
          "address.state": initial.address.state, "address.pincode": initial.address.pincode,
        }
      : { ...EMPTY_TURF_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k: keyof TurfForm, v: string | number | boolean | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    const body = {
      name: form.name, shortName: form.shortName || undefined,
      surfaceType: form.surfaceType, numberOfPitches: Number(form.numberOfPitches),
      pitchSizes: form.pitchSizes, hasFloodlights: form.hasFloodlights,
      hasChangingRooms: form.hasChangingRooms, hasParking: form.hasParking,
      hasRefreshments: form.hasRefreshments, contactPhone: form.contactPhone || undefined,
      contactName: form.contactName || undefined, googleMapsUrl: form.googleMapsUrl || undefined,
      parkingNotes: form.parkingNotes || undefined,
      address: {
        line1: form["address.line1"], line2: form["address.line2"] || "",
        area: form["address.area"], city: form["address.city"],
        state: form["address.state"], pincode: form["address.pincode"],
      },
    };
    try {
      const url    = initial ? `${API_BASE}/turfs/${initial._id}` : `${API_BASE}/turfs`;
      const method = initial ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save."); return; }
      onSaved();
    } catch { setError("Cannot reach the server."); }
    finally { setSaving(false); }
  };

  const inp = SEARCH_INPUT;

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div className={MODAL} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>{initial ? "Edit Venue" : "Add Venue"}</div>
          <button className={MODAL_CLOSE} onClick={onClose} type="button">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={MODAL_FORM}>
          <div className={FORM_GRID}>
            <label className={FORM_LABEL}>Name *<input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Short Name<input className={inp} value={form.shortName} onChange={(e) => set("shortName", e.target.value)} /></label>
            <label className={FORM_LABEL}>Address Line 1 *<input className={inp} value={form["address.line1"]} onChange={(e) => set("address.line1", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Address Line 2<input className={inp} value={form["address.line2"]} onChange={(e) => set("address.line2", e.target.value)} /></label>
            <label className={FORM_LABEL}>Area *<input className={inp} value={form["address.area"]} onChange={(e) => set("address.area", e.target.value)} required /></label>
            <label className={FORM_LABEL}>City *<input className={inp} value={form["address.city"]} onChange={(e) => set("address.city", e.target.value)} required /></label>
            <label className={FORM_LABEL}>State *<input className={inp} value={form["address.state"]} onChange={(e) => set("address.state", e.target.value)} required /></label>
            <label className={FORM_LABEL}>Pincode *<input className={inp} value={form["address.pincode"]} onChange={(e) => set("address.pincode", e.target.value)} required /></label>
            <label className={FORM_LABEL}>
              Surface Type
              <select className={FILTER_SELECT} value={form.surfaceType} onChange={(e) => set("surfaceType", e.target.value)}>
                <option value="artificial_turf">Artificial Turf</option>
                <option value="natural_grass">Natural Grass</option>
                <option value="concrete">Concrete</option>
                <option value="indoor">Indoor</option>
              </select>
            </label>
            <label className={FORM_LABEL}>Pitches<input className={inp} type="number" min={1} value={form.numberOfPitches} onChange={(e) => set("numberOfPitches", Number(e.target.value))} /></label>
            <label className={FORM_LABEL}>Contact Name<input className={inp} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
            <label className={FORM_LABEL}>Contact Phone<input className={inp} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
            <label className={FORM_LABEL}>Google Maps URL<input className={inp} value={form.googleMapsUrl} onChange={(e) => set("googleMapsUrl", e.target.value)} /></label>
            <label className={FORM_LABEL}>Parking Notes<input className={inp} value={form.parkingNotes} onChange={(e) => set("parkingNotes", e.target.value)} /></label>
          </div>
          <div className={CHECKBOX_ROW}>
            {(["hasFloodlights", "hasChangingRooms", "hasParking", "hasRefreshments"] as const).map((k) => (
              <label key={k} className={CHECK_LABEL}>
                <input type="checkbox" checked={form[k] as boolean} onChange={(e) => set(k, e.target.checked)} />
                {k.replace("has", "")}
              </label>
            ))}
          </div>
          {error && <div className={FORM_ERROR}>{error}</div>}
          <div className={MODAL_ACTIONS}>
            <button className={ACTION_BTN} type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="submit" disabled={saving}>
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Venue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Venues({ onOpenDetail }: { onOpenDetail: (t: string) => void }) {
  const [turfs, setTurfs]           = useState<Turf[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [modalTurf, setModalTurf]   = useState<Turf | null | "new">(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "discontinued">("all");

  const fetchTurfs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_BASE}/turfs/admin/all`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to load turfs."); return; }
      setTurfs(data.data);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTurfs(); }, [fetchTurfs]);

  const adminAction = async (url: string, method = "PATCH") => {
    setActionLoading(url);
    try { await fetch(`${API_BASE}${url}`, { method, headers: { Authorization: `Bearer ${getAdminToken()}` } }); await fetchTurfs(); }
    finally { setActionLoading(null); }
  };

  // Summary (over all venues) + filtered/sorted view (busiest venues first)
  const activeCount   = turfs.filter((t) => t.isActive).length;
  const totalGames    = turfs.reduce((s, t) => s + (t.totalGamesHosted || 0), 0);
  const filtered = turfs
    .filter((t) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || [t.name, t.address.area, t.address.city, t.address.state].join(" ").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? t.isActive : !t.isActive);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (b.totalGamesHosted || 0) - (a.totalGamesHosted || 0));

  return (
    <>
      <div className={SECTION_HEAD}>
        <div>
          <div className={SECTION_TITLE}>Venues &amp; Turfs</div>
          <div className={SECTION_SUB}>
            {loading ? "Loading…" : (search || statusFilter !== "all" ? `${filtered.length} of ${turfs.length} venues` : `${turfs.length} registered venues`)}
          </div>
        </div>
        <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button" onClick={() => setModalTurf("new")}>+ Add Venue</button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className={STATS_GRID}>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Venues</div><div className={STAT_VALUE}>{turfs.length}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Registered turfs</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Active</div><div className={STAT_VALUE}>{activeCount}</div><div className={`${STAT_DELTA} ${UP}`}>Open for games</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Discontinued</div><div className={STAT_VALUE}>{turfs.length - activeCount}</div><div className={`${STAT_DELTA} ${DOWN}`}>Not in use</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Games Hosted</div><div className={`${STAT_VALUE} text-warning!`}>{totalGames}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Across all venues</div></div>
        </div>
      )}

      {/* Filters */}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search venue, area, city, state…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={FILTER_SELECT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "discontinued")}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading ? (
        <div className={LOADING_STATE}>Loading venues…</div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead><tr><th>Venue</th><th>Area</th><th>City</th><th>State</th><th>Surface</th><th>Pitches</th><th>Floodlights</th><th>Verified</th><th>Status</th><th>Games</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={11} className="p-8! text-center text-muted!">{turfs.length === 0 ? "No venues yet." : "No venues match the current filters."}</td></tr>}
              {filtered.map((t) => {
                const busy = actionLoading !== null;
                return (
                  <tr key={t._id} style={!t.isActive ? { opacity: 0.62 } : undefined}>
                    <td className="font-medium">{t.name}</td>
                    <td>{t.address.area}</td>
                    <td>{t.address.city}</td>
                    <td>{t.address.state}</td>
                    <td><span className={`${BADGE} ${BADGE_GRAY}`}>{surfaceLabel(t.surfaceType)}</span></td>
                    <td>{t.numberOfPitches}</td>
                    <td><span className={`${BADGE} ${t.hasFloodlights ? BADGE_GREEN : BADGE_GRAY}`}>{t.hasFloodlights ? "Yes" : "No"}</span></td>
                    <td><span className={`${BADGE} ${t.isVerified ? BADGE_GREEN : BADGE_AMBER}`}>{t.isVerified ? "Verified" : "Pending"}</span></td>
                    <td><span className={`${BADGE} ${t.isActive ? BADGE_GREEN : BADGE_RED}`}>{t.isActive ? "Active" : "Discontinued"}</span></td>
                    <td>
                      <span className={`inline-block min-w-[30px] rounded-md px-[9px] py-[3px] text-center text-[13px] font-bold ${(t.totalGamesHosted || 0) > 0 ? "bg-warning text-[#0b1114]" : "bg-[rgba(255,255,255,0.05)] text-muted"}`}>{t.totalGamesHosted || 0}</span>
                    </td>
                    <td>
                      <div className={ACTIONS}>
                        <button className={ACTION_BTN} type="button" onClick={() => setModalTurf(t)}>Edit</button>
                        {!t.isVerified && <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/verify`)}>Verify</button>}
                        {t.isActive
                          ? <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/discontinue`)}>Discontinue</button>
                          : <button className={ACTION_BTN} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/reactivate`)}>Reactivate</button>
                        }
                        <button className={ACTION_BTN} type="button" onClick={() => onOpenDetail(t.name)}>View</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modalTurf !== null && (
        <TurfModal initial={modalTurf === "new" ? null : modalTurf} onClose={() => setModalTurf(null)} onSaved={() => { setModalTurf(null); fetchTurfs(); }} />
      )}
    </>
  );
}

// ── Finance ───────────────────────────────────────────────────────────────────

type FinanceTab = "wallets" | "earnings";

type OfferTier = { key: string; label: string; minPaise: number; maxPaise: number | null; bonusPaise: number };

function Finance() {
  const [tab, setTab] = useState<FinanceTab>("wallets");

  // Recharge-offer config state
  const [offerEnabled, setOfferEnabled]   = useState(false);
  const [offerTiers, setOfferTiers]       = useState<OfferTier[]>([]);
  const [offerDraft, setOfferDraft]       = useState<Record<string, string>>({}); // tier key → rupee string
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersSaving, setOffersSaving]   = useState(false);
  const [offersMsg, setOffersMsg]         = useState<string | null>(null);
  const [offersErr, setOffersErr]         = useState("");

  const PAGE_SIZE = 25;

  // Wallet state
  const [wallets, setWallets]       = useState<WalletRow[]>([]);
  const [walletSum, setWalletSum]   = useState<{ totalBalancePaise?: number; totalTopUpPaise?: number; totalSpentPaise?: number; totalRefundedPaise?: number }>({});
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletsError, setWalletsError]     = useState("");
  const [walletSearch, setWalletSearch]     = useState("");
  const [walletPage, setWalletPage]         = useState(1);
  const [walletTotal, setWalletTotal]       = useState(0);
  const [walletTotalPages, setWalletTotalPages] = useState(1);
  const [debouncedWalletSearch, setDebouncedWalletSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedWalletSearch(walletSearch), 300);
    return () => clearTimeout(t);
  }, [walletSearch]);

  // Earnings state
  const [earnings, setEarnings]             = useState<OrganiserEarningRow[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError]     = useState("");
  const [earningsSearch, setEarningsSearch]   = useState("");
  const [earningsPage, setEarningsPage]       = useState(1);
  const [earningsTotal, setEarningsTotal]     = useState(0);
  const [earningsTotalPages, setEarningsTotalPages] = useState(1);
  const [debouncedEarningsSearch, setDebouncedEarningsSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEarningsSearch(earningsSearch), 300);
    return () => clearTimeout(t);
  }, [earningsSearch]);

  const fetchWallets = useCallback(async () => {
    setWalletsLoading(true); setWalletsError("");
    try {
      const token = getAdminToken();
      if (!token) { setWalletsError("Admin session missing."); return; }
      const params = new URLSearchParams({ page: String(walletPage), limit: String(PAGE_SIZE) });
      if (debouncedWalletSearch.trim()) params.set("search", debouncedWalletSearch.trim());
      const res  = await fetch(`${API_BASE}/admin/wallets?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as WalletApiResponse;
      if (!res.ok) { setWalletsError(data.message || "Failed to load wallets."); return; }
      const rows = data.data || [];
      setWallets(rows);
      setWalletSum(data.summary || {});
      setWalletTotal(data.total ?? rows.length);
      setWalletTotalPages(data.totalPages ?? 1);
    } catch { setWalletsError("Cannot reach the server."); }
    finally { setWalletsLoading(false); }
  }, [walletPage, debouncedWalletSearch]);

  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true); setEarningsError("");
    try {
      const token = getAdminToken();
      if (!token) { setEarningsError("Admin session missing."); return; }
      const params = new URLSearchParams({ page: String(earningsPage), limit: String(PAGE_SIZE) });
      if (debouncedEarningsSearch.trim()) params.set("search", debouncedEarningsSearch.trim());
      const res  = await fetch(`${API_BASE}/admin/organiser-earnings?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setEarningsError(data.message || "Failed to load earnings."); return; }
      const rows: OrganiserEarningRow[] = data.data || [];
      setEarnings(rows);
      setEarningsTotal(data.total ?? rows.length);
      setEarningsTotalPages(data.totalPages ?? 1);
    } catch { setEarningsError("Cannot reach the server."); }
    finally { setEarningsLoading(false); }
  }, [earningsPage, debouncedEarningsSearch]);

  const fetchOffers = useCallback(async () => {
    setOffersLoading(true); setOffersErr("");
    try {
      const token = getAdminToken();
      if (!token) { setOffersErr("Admin session missing."); return; }
      const res  = await fetch(`${API_BASE}/admin/wallet-offers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.success) { setOffersErr(data.message || "Failed to load offers."); return; }
      setOfferEnabled(!!data.data.enabled);
      setOfferTiers(data.data.tiers || []);
      const draft: Record<string, string> = {};
      (data.data.tiers || []).forEach((t: OfferTier) => { draft[t.key] = String((t.bonusPaise || 0) / 100); });
      setOfferDraft(draft);
    } catch { setOffersErr("Cannot reach the server."); }
    finally { setOffersLoading(false); }
  }, []);

  const saveOffers = async () => {
    setOffersSaving(true); setOffersErr(""); setOffersMsg(null);
    try {
      const token = getAdminToken();
      if (!token) { setOffersErr("Admin session missing."); setOffersSaving(false); return; }
      const bonusPaise: Record<string, number> = {};
      for (const t of offerTiers) {
        const rupees = Number(offerDraft[t.key]);
        if (!Number.isFinite(rupees) || rupees < 0) { setOffersErr(`Invalid bonus for ${t.label}.`); setOffersSaving(false); return; }
        bonusPaise[t.key] = Math.round(rupees * 100);
      }
      const res  = await fetch(`${API_BASE}/admin/wallet-offers`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ enabled: offerEnabled, bonusPaise }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setOffersErr(data.message || "Save failed."); return; }
      setOfferTiers(data.data.tiers || []);
      setOffersMsg("Saved ✓");
      setTimeout(() => setOffersMsg(null), 2500);
    } catch { setOffersErr("Cannot reach the server."); }
    finally { setOffersSaving(false); }
  };

  useEffect(() => { fetchWallets(); }, [fetchWallets]);
  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);
  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  // Server already filtered + paginated each list.
  const filteredWallets  = wallets;
  const filteredEarnings = earnings;

  return (
    <>
      <Head title="Finance" sub="Player wallets, organiser earnings & platform revenue" />

      {/* Summary */}
      <div className={STATS_GRID}>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Platform Balance</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalBalancePaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>All player wallets combined</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Top-ups</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalTopUpPaise)}</div><div className={`${STAT_DELTA} ${UP}`}>Lifetime recharges</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Spent</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalSpentPaise)}</div><div className={`${STAT_DELTA} ${DOWN}`}>Game registrations</div></div>
        <div className={STAT_CARD}><div className={STAT_LABEL}>Total Refunded</div><div className={STAT_VALUE}>{formatCurrency(walletSum.totalRefundedPaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Cancellations &amp; backouts</div></div>
      </div>

      {/* Tabs */}
      <div className={TAB_BAR}>
        <button className={`${TAB} ${tab === "wallets" ? TAB_ACTIVE : ""}`} onClick={() => setTab("wallets")} type="button">
          Player Wallets ({walletTotal})
        </button>
        <button className={`${TAB} ${tab === "earnings" ? TAB_ACTIVE : ""}`} onClick={() => setTab("earnings")} type="button">
          Organiser Earnings ({earningsTotal})
        </button>
      </div>

      {/* Player Wallets */}
      {tab === "wallets" && (
        <>
          {/* ── Recharge offers config ───────────────────────────────────────── */}
          <div className="mb-4 rounded-xl border border-border-2 bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-bold text-fg">💸 Wallet Recharge Offers</div>
                <div className="mt-[3px] max-w-[520px] text-[12px] leading-[1.45] text-muted">
                  Flat bonus added to a player&apos;s wallet for each recharge range. The ranges are fixed — you set the bonus amount per range.
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-[7px] whitespace-nowrap text-[13px] text-fg">
                <input type="checkbox" checked={offerEnabled} onChange={(e) => setOfferEnabled(e.target.checked)} />
                {offerEnabled ? "Offers Enabled" : "Offers Disabled"}
              </label>
            </div>

            {offersErr && <div className={`${FORM_ERROR} mt-[10px]`}>{offersErr}</div>}

            <div className="mt-3 flex flex-wrap gap-3">
              {offerTiers.map((t) => (
                <div key={t.key} className="flex-[1_1_170px] rounded-[10px] border border-border-2 px-3 py-[10px]">
                  <div className="mb-[7px] text-[12px] text-muted">Recharge <strong className="text-fg">{t.label}</strong></div>
                  <div className="flex items-center gap-[6px]">
                    <span className="text-[13px] text-muted">Bonus ₹</span>
                    <input
                      type="number" min={0} step={1} value={offerDraft[t.key] ?? ""}
                      onChange={(e) => setOfferDraft((p) => ({ ...p, [t.key]: e.target.value }))}
                      className="w-[100px] rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] text-[14px] text-fg"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-[14px] flex items-center gap-3">
              <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} onClick={saveOffers} disabled={offersSaving || offersLoading} type="button">
                {offersSaving ? "Saving…" : "Save Offers"}
              </button>
              {offersMsg && <span className="text-[13px] font-semibold text-success">{offersMsg}</span>}
              {offersLoading && <span className="text-[13px] text-muted">Loading…</span>}
            </div>
          </div>

          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search by name, phone or email…" value={walletSearch} onChange={(e) => { setWalletSearch(e.target.value); setWalletPage(1); }} />
          </div>
          {walletsError && <div className={FORM_ERROR}>{walletsError}</div>}
          {walletsLoading && <div className={LOADING_STATE}>Loading wallets…</div>}
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>Player</th><th>Phone</th><th>Email</th><th>Balance</th><th>Total Top-ups</th><th>Total Spent</th><th>Total Refunded</th><th>Last Updated</th></tr>
              </thead>
              <tbody>
                {!walletsLoading && filteredWallets.length === 0 && <tr><td colSpan={8} className="p-8! text-center text-muted!">No wallets found.</td></tr>}
                {filteredWallets.map((w) => (
                  <tr key={w._id}>
                    <td>{w.user?.name || "Unknown"}</td>
                    <td>{w.user?.phone || "—"}</td>
                    <td>{w.user?.email || "—"}</td>
                    <td className={`font-semibold ${(w.balancePaise || 0) > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(w.balancePaise)}</td>
                    <td>{formatCurrency(w.totalTopUpPaise)}</td>
                    <td>{formatCurrency(w.totalSpentPaise)}</td>
                    <td>{formatCurrency(w.totalRefundedPaise)}</td>
                    <td>{formatDate(w.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!walletsLoading && walletTotal > 0 && (
            <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-muted">
                Showing <strong className="text-fg">{(walletPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong className="text-fg">{Math.min(walletPage * PAGE_SIZE, walletTotal)}</strong> of{" "}
                <strong className="text-fg">{walletTotal}</strong> wallets
              </div>
              <div className="flex items-center gap-[6px]">
                <button className={pagerBtnCls(walletPage <= 1)} type="button" disabled={walletPage <= 1} onClick={() => setWalletPage(1)}>« First</button>
                <button className={pagerBtnCls(walletPage <= 1)} type="button" disabled={walletPage <= 1} onClick={() => setWalletPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span className={pagerPillCls}>Page {walletPage} / {walletTotalPages}</span>
                <button className={pagerBtnCls(walletPage >= walletTotalPages)} type="button" disabled={walletPage >= walletTotalPages} onClick={() => setWalletPage((p) => Math.min(walletTotalPages, p + 1))}>Next ›</button>
                <button className={pagerBtnCls(walletPage >= walletTotalPages)} type="button" disabled={walletPage >= walletTotalPages} onClick={() => setWalletPage(walletTotalPages)}>Last »</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Organiser Earnings */}
      {tab === "earnings" && (
        <>
          <div className={TOOLBAR}>
            <input className={SEARCH_INPUT} placeholder="Search organiser by name or phone…" value={earningsSearch} onChange={(e) => { setEarningsSearch(e.target.value); setEarningsPage(1); }} />
          </div>
          {earningsError && <div className={FORM_ERROR}>{earningsError}</div>}
          {earningsLoading && <div className={LOADING_STATE}>Loading organiser earnings…</div>}
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr><th>Organiser</th><th>Phone</th><th>Total Games</th><th>Completed</th><th>Cancelled</th><th>Paid Regs</th><th>Guest Slots</th><th>Total Revenue</th></tr>
              </thead>
              <tbody>
                {!earningsLoading && filteredEarnings.length === 0 && <tr><td colSpan={8} className="p-8! text-center text-muted!">No earnings data yet.</td></tr>}
                {filteredEarnings.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.name}
                      <div className="text-[11px] text-muted">{e.email || ""}</div>
                    </td>
                    <td>{e.phone || "—"}</td>
                    <td>{e.totalGames}</td>
                    <td><span className="text-success">{e.completedGames}</span></td>
                    <td><span className={e.cancelledGames > 0 ? "text-danger" : "text-muted"}>{e.cancelledGames}</span></td>
                    <td>{e.totalPaidRegistrations}</td>
                    <td>{e.totalGuestSlots}</td>
                    <td className="font-semibold text-success!">{formatCurrency(e.totalRevenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!earningsLoading && earningsTotal > 0 && (
            <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-muted">
                Showing <strong className="text-fg">{(earningsPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong className="text-fg">{Math.min(earningsPage * PAGE_SIZE, earningsTotal)}</strong> of{" "}
                <strong className="text-fg">{earningsTotal}</strong> organisers
              </div>
              <div className="flex items-center gap-[6px]">
                <button className={pagerBtnCls(earningsPage <= 1)} type="button" disabled={earningsPage <= 1} onClick={() => setEarningsPage(1)}>« First</button>
                <button className={pagerBtnCls(earningsPage <= 1)} type="button" disabled={earningsPage <= 1} onClick={() => setEarningsPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span className={pagerPillCls}>Page {earningsPage} / {earningsTotalPages}</span>
                <button className={pagerBtnCls(earningsPage >= earningsTotalPages)} type="button" disabled={earningsPage >= earningsTotalPages} onClick={() => setEarningsPage((p) => Math.min(earningsTotalPages, p + 1))}>Next ›</button>
                <button className={pagerBtnCls(earningsPage >= earningsTotalPages)} type="button" disabled={earningsPage >= earningsTotalPages} onClick={() => setEarningsPage(earningsTotalPages)}>Last »</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Streaming — extracted to ./screening/index.tsx ────────────────────────────
// ScrEvents is imported at the top of this file from "./screening".


function ScrGuests() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.1)]">
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      </div>
      <div>
        <p className="mb-[6px] text-[11px] font-extrabold uppercase tracking-[0.18em] text-info">Streaming</p>
        <h2 className="mb-[10px] text-[22px] font-extrabold text-fg">Guest List</h2>
        <p className="m-0 max-w-[360px] text-[13px] leading-[1.7] text-muted">Per-event door verification table. Manage walk-in guests, verify ticket codes, and track entry in real time.</p>
      </div>
      <div className="mt-2 rounded-full border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] px-4 py-[6px]">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-info">Coming Soon</span>
      </div>
    </div>
  );
}

function ScrFinance() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-[rgba(91,230,178,0.2)] bg-[rgba(91,230,178,0.08)]">
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
      </div>
      <div>
        <p className="mb-[6px] text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">Streaming</p>
        <h2 className="mb-[10px] text-[22px] font-extrabold text-fg">Streaming Finance</h2>
        <p className="m-0 max-w-[360px] text-[13px] leading-[1.7] text-muted">Revenue analytics for screening events. Track ticket sales, payout breakdowns, and venue-level financial performance.</p>
      </div>
      <div className="mt-2 rounded-full border border-[rgba(91,230,178,0.2)] bg-[rgba(91,230,178,0.08)] px-4 py-[6px]">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">Coming Soon</span>
      </div>
    </div>
  );
}

// ── WalletAdmin ───────────────────────────────────────────────────────────────

type AdminWalletRow = {
  _id: string;
  user?: { _id?: string; name?: string; phone?: string; email?: string } | null;
  balancePaise: number;
  lockedPaise: number;
  totalTopUpPaise: number;
  totalSpentPaise: number;
  totalRefundedPaise: number;
  updatedAt?: string;
};

type AdminWalletListResponse = {
  success: boolean;
  count?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  summary?: { totalBalancePaise: number; totalTopUpPaise: number; totalSpentPaise: number; totalRefundedPaise: number };
  data: AdminWalletRow[];
  message?: string;
};

type AdjustTarget = { userId: string; name: string; balancePaise: number };

function AdjustWalletModal({ target, onClose, onSuccess }: {
  target: AdjustTarget;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}) {
  const [mode, setMode]     = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    const rupees = parseFloat(amount);
    if (!amount || isNaN(rupees) || rupees <= 0) { setError("Enter a valid amount greater than 0."); return; }
    if (!note.trim()) { setError("A reason / note is required."); return; }

    const amountPaise = Math.round(rupees * 100) * (mode === "debit" ? -1 : 1);
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/wallets/${target.userId}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountPaise, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to adjust wallet."); setLoading(false); return; }
      onSuccess(data.data.balancePaise);
      onClose();
    } catch { setError("Cannot reach the server."); setLoading(false); }
  };

  const availableRupees = ((target.balancePaise) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.65)] backdrop-blur-[3px]" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-start gap-[14px] border-b border-border px-6 pt-[22px] pb-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.12)]">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.2" strokeLinecap="round">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-fg">Adjust Wallet</h3>
            <p className="m-0 text-[13px] text-muted">
              <strong className="text-fg">{target.name}</strong>
              <span className="ml-2 text-accent">Current: ₹{availableRupees}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-[14px] px-6 py-5">
          {/* Credit / Debit toggle */}
          <div className="flex gap-2">
            {(["credit", "debit"] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                className={`h-[38px] flex-1 cursor-pointer rounded-lg border-[1.5px] text-[13px] font-bold transition-all duration-150 ${
                  mode === m
                    ? (m === "credit" ? "border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.18)] text-accent" : "border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.15)] text-danger")
                    : "border-border bg-transparent text-muted"
                }`}>
                {m === "credit" ? "+ Credit" : "− Debit"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-[6px] block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Amount (₹)</label>
            <input
              type="number" min="1" step="any" value={amount} onChange={e => { setAmount(e.target.value); setError(null); }}
              placeholder="e.g. 100"
              className="box-border w-full rounded-[9px] border-[1.5px] border-border bg-[#0b1114] px-[13px] py-[10px] text-[14px] text-fg outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "#24313b")}
              disabled={loading}
            />
          </div>

          {/* Note */}
          <div>
            <label className="mb-[6px] block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Reason / Note <span className="text-danger">*</span></label>
            <input
              type="text" value={note} onChange={e => { setNote(e.target.value); setError(null); }}
              placeholder="e.g. Bonus credit for referral"
              className="box-border w-full rounded-[9px] border-[1.5px] border-border bg-[#0b1114] px-[13px] py-[10px] text-[13px] text-fg outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "#24313b")}
              disabled={loading}
            />
          </div>

          {error && <p className="m-0 text-[12px] font-semibold text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 pb-[22px]">
          <button type="button" onClick={onClose} disabled={loading}
            className={`h-[42px] flex-1 rounded-[9px] border border-border bg-transparent text-[13px] font-bold text-muted ${loading ? "cursor-default opacity-50" : "cursor-pointer opacity-100"}`}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className={`h-[42px] flex-[2] rounded-[9px] border-[1.5px] border-[rgba(91,230,178,0.4)] text-[13px] font-extrabold text-accent transition-all duration-150 ${loading ? "cursor-default bg-[rgba(91,230,178,0.06)] opacity-60" : "cursor-pointer bg-[rgba(91,230,178,0.15)] opacity-100"}`}>
            {loading ? "Saving…" : "Confirm Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}

const WALLET_PAGE_SIZE = 25;

function WalletAdmin() {
  const [wallets, setWallets]   = useState<AdminWalletRow[]>([]);
  const [summary, setSummary]   = useState<AdminWalletListResponse["summary"] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  // Debounce the search box, and reset to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchWallets = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token = getAdminToken();
      if (!token) { setError("Admin session missing."); return; }
      const params = new URLSearchParams({ page: String(page), limit: String(WALLET_PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const res  = await fetch(`${API_BASE}/admin/wallets?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as AdminWalletListResponse;
      if (!res.ok) { setError(data.message || "Failed to load wallets."); return; }
      setWallets(data.data || []);
      setSummary(data.summary || null);
      setTotal(data.total ?? (data.data?.length || 0));
      setTotalPages(data.totalPages ?? 1);
    } catch { setError("Cannot reach the server."); }
    finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const handleAdjustSuccess = (userId: string, newBalancePaise: number) => {
    setWallets(prev => prev.map(w => w.user?._id === userId ? { ...w, balancePaise: newBalancePaise } : w));
    setToast("Wallet adjusted successfully.");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <>
      {adjustTarget && (
        <AdjustWalletModal
          target={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSuccess={(bal) => handleAdjustSuccess(adjustTarget.userId, bal)}
        />
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[10000] flex min-w-[260px] -translate-x-1/2 items-center gap-[10px] rounded-xl border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(17,20,36,0.97)] px-5 py-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-[13px] font-semibold text-fg">{toast}</span>
        </div>
      )}

      <Head title="Player Wallets" sub={loading ? "Loading…" : `${total} player wallets`} />

      {/* Summary cards */}
      {summary && (
        <div className={STATS_GRID}>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Balance</div><div className={STAT_VALUE}>{formatCurrency(summary.totalBalancePaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>All player wallets</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Top-ups</div><div className={STAT_VALUE}>{formatCurrency(summary.totalTopUpPaise)}</div><div className={`${STAT_DELTA} ${UP}`}>Lifetime recharges</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Spent</div><div className={STAT_VALUE}>{formatCurrency(summary.totalSpentPaise)}</div><div className={`${STAT_DELTA} ${DOWN}`}>Game registrations</div></div>
          <div className={STAT_CARD}><div className={STAT_LABEL}>Total Refunded</div><div className={STAT_VALUE}>{formatCurrency(summary.totalRefundedPaise)}</div><div className={`${STAT_DELTA} ${NEUTRAL}`}>Cancellations</div></div>
        </div>
      )}

      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={ACTION_BTN} type="button" onClick={fetchWallets}>Refresh</button>
      </div>

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && <div className={LOADING_STATE}>Loading wallets…</div>}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Phone</th>
              <th>Balance</th>
              <th>Locked</th>
              <th>Available</th>
              <th>Total Top-ups</th>
              <th>Total Spent</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && wallets.length === 0 && (
              <tr><td colSpan={9} className="p-8! text-center text-muted!">No wallets found.</td></tr>
            )}
            {wallets.map(w => {
              const available = (w.balancePaise || 0) - (w.lockedPaise || 0);
              return (
                <tr key={w._id}>
                  <td>
                    <div className="font-semibold">{w.user?.name || "Unknown"}</div>
                    {w.user?.email && <div className="text-[11px] text-muted">{w.user.email}</div>}
                  </td>
                  <td>{w.user?.phone || "—"}</td>
                  <td className={`font-semibold ${(w.balancePaise || 0) > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(w.balancePaise)}</td>
                  <td className={(w.lockedPaise || 0) > 0 ? "text-warning!" : "text-muted!"}>{formatCurrency(w.lockedPaise)}</td>
                  <td className={`font-semibold ${available > 0 ? "text-success!" : "text-muted!"}`}>{formatCurrency(available)}</td>
                  <td>{formatCurrency(w.totalTopUpPaise)}</td>
                  <td>{formatCurrency(w.totalSpentPaise)}</td>
                  <td>{formatDate(w.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={ACTION_BTN}
                      onClick={() => setAdjustTarget({ userId: w.user?._id || w._id, name: w.user?.name || "Unknown", balancePaise: w.balancePaise || 0 })}
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-muted">
            Showing <strong className="text-fg">{(page - 1) * WALLET_PAGE_SIZE + 1}</strong>–
            <strong className="text-fg">{Math.min(page * WALLET_PAGE_SIZE, total)}</strong> of{" "}
            <strong className="text-fg">{total}</strong> wallets
          </div>
          <div className="flex items-center gap-[6px]">
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button className={pagerBtnCls(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span className={pagerPillCls}>Page {page} / {totalPages}</span>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button className={pagerBtnCls(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export function ContentSections({ activeSection, onOpenDetail, onNavigate }: ContentSectionsProps) {
  if (activeSection === "dashboard")     return <Dashboard onNavigate={onNavigate} />;
  if (activeSection === "users")         return <Users onOpenDetail={onOpenDetail} />;
  if (activeSection === "organisers")    return <Organisers onOpenDetail={onOpenDetail} />;
  if (activeSection === "games")         return <Games />;
  if (activeSection === "payments")      return <Payments />;
  if (activeSection === "finance")       return <Finance />;
  if (activeSection === "wallet-admin")  return <WalletAdmin />;
  if (activeSection === "passes")        return <PassPage />;
  if (activeSection === "notifications") return <Notifications />;
  if (activeSection === "feedback")      return <Feedback />;
  if (activeSection === "disputes")      return <Disputes onOpenDetail={onOpenDetail} />;
  if (activeSection === "communities")   return <Communities onOpenDetail={onOpenDetail} />;
  return <Venues onOpenDetail={onOpenDetail} />;
}
