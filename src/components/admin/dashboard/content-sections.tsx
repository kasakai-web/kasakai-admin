"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import styles from "./dashboard.module.css";
import type { DashboardSection } from "./constants";
import { getAdminToken } from "@/lib/admin-session";
import { PassPage } from "./passes/PassPage";

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

// Shared style for pagination (Prev/Next/First/Last) buttons
function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 700,
    padding: "7px 13px",
    borderRadius: "6px",
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--muted2)" : "var(--white)",
    background: disabled ? "transparent" : "rgba(59,130,246,0.14)",
    border: `1px solid ${disabled ? "var(--border)" : "var(--blue)"}`,
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
}

// Shared style for the bright "Page X / Y" indicator pill
const pagerPillStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 800, color: "#0b1114", background: "#facc15",
  padding: "6px 12px", borderRadius: "6px", whiteSpace: "nowrap", margin: "0 2px",
};

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
  summary?: { avgGame?: number | null; tagCounts?: Record<string, number> };
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
  if (["active", "approved", "verified", "present", "paid", "success"].includes(v)) return styles.badgeGreen;
  if (["pending", "in review", "review", "draft", "waiting", "notified"].includes(v)) return styles.badgeAmber;
  if (["suspended", "rejected", "inactive", "banned", "cancelled", "forfeited", "no_show", "failed"].includes(v)) return styles.badgeRed;
  if (["confirmed", "open"].includes(v)) return styles.badgeBlue;
  if (["completed"].includes(v)) return styles.badgeViolet;
  return styles.badgeGray;
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
    <div className={styles.sectionHead}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.sectionSub}>{sub}</div>
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
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{u ? u.total : "—"}</div>
          <div className={`${styles.statDelta} ${styles.neutral}`}>{u ? `${u.players} players · ${u.organisers} organisers` : "Loading…"}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Games</div>
          <div className={styles.statValue}>{g ? g.active : "—"}</div>
          <div className={`${styles.statDelta} ${styles.neutral}`}>{g ? `${g.total} total · ${g.completed} completed` : "Loading…"}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Net Revenue</div>
          <div className={styles.statValue}>{f ? formatCurrency(f.netRevenuePaise) : "—"}</div>
          <div className={`${styles.statDelta} ${styles.neutral}`}>After refunds</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Platform Wallet</div>
          <div className={styles.statValue}>{f ? formatCurrency(f.totalWalletBalancePaise) : "—"}</div>
          <div className={`${styles.statDelta} ${styles.neutral}`}>All player balances</div>
        </div>
      </div>

      <div className={styles.twoCol}>
        <div className={`${styles.panel} ${styles.panelWarn}`}>
          <div className={styles.statLabel}>Action Required</div>
          <div className={styles.panelTitle}>Review Pending Organisers</div>
          <div className={styles.panelSub}>Check the Organisers section to approve or reject pending applications.</div>
          <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} type="button" onClick={() => onNavigate("organisers")}>
            Review Now
          </button>
        </div>
        <div className={styles.panel}>
          <div className={styles.statLabel}>Quick Links</div>
          <div className={styles.feed}>
            <div className={styles.feedRow}><div><div className={styles.feedTitle}>Finance Overview</div><div className={styles.feedSub}>Player wallets &amp; organiser earnings</div></div><button className={styles.actionBtn} onClick={() => onNavigate("finance")} type="button">Go</button></div>
            <div className={styles.feedRow}><div><div className={styles.feedTitle}>Games &amp; Events</div><div className={styles.feedSub}>View registrations &amp; details</div></div><button className={styles.actionBtn} onClick={() => onNavigate("games")} type="button">Go</button></div>
            <div className={styles.feedRow}><div><div className={styles.feedTitle}>Notifications</div><div className={styles.feedSub}>Platform-wide notification log</div></div><button className={styles.actionBtn} onClick={() => onNavigate("notifications")} type="button">Go</button></div>
            <div className={styles.feedRow}><div><div className={styles.feedTitle}>Player Feedback</div><div className={styles.feedSub}>Post-game ratings &amp; comments</div></div><button className={styles.actionBtn} onClick={() => onNavigate("feedback")} type="button">Go</button></div>
          </div>
        </div>
      </div>

      <div className={styles.quickStats}>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Total Players</div><div className={styles.summaryValue}>{u?.players ?? "—"}</div></div>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Total Organisers</div><div className={styles.summaryValue}>{u?.organisers ?? "—"}</div></div>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Games Completed</div><div className={styles.summaryValue}>{g?.completed ?? "—"}</div></div>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Games Cancelled</div><div className={styles.summaryValue}>{g ? <span style={{ color: "var(--red)" }}>{g.cancelled}</span> : "—"}</div></div>
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
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue}, 50%, 32%)`, border: "1.5px solid rgba(255,255,255,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.42), fontWeight: 700, color: "#fff", userSelect: "none",
      letterSpacing: 0,
    }}>
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
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.12)", display: "block",
          cursor: "pointer", transition: "opacity 0.15s, transform 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.82"; (e.currentTarget as HTMLImageElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.opacity = "1";    (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
        onError={() => setImgFailed(true)}
      />

      {/* ── Photo lightbox ── */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
            animation: "lbFadeIn 0.2s ease both",
          }}
        >
          {/* inject keyframes once */}
          <style>{`
            @keyframes lbFadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes lbPopIn  { from { opacity:0; transform:scale(0.88) } to { opacity:1; transform:scale(1) } }
          `}</style>

          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
              animation: "lbPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              title="Close"
              style={{
                position: "absolute", top: "-14px", right: "-14px",
                width: "34px", height: "34px", borderRadius: "50%",
                background: "#1e2030", border: "1.5px solid rgba(255,255,255,0.18)",
                color: "#e0e8f8", fontSize: "16px", fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1, lineHeight: 1,
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#2e3248"; b.style.borderColor = "rgba(255,255,255,0.35)"; b.style.color = "#fff"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#1e2030"; b.style.borderColor = "rgba(255,255,255,0.18)"; b.style.color = "#e0e8f8"; }}
            >
              ✕
            </button>

            {/* Enlarged photo */}
            <img
              src={resolvedSrc}
              alt={name}
              style={{
                width: "min(320px, 80vw)",
                height: "min(320px, 80vw)",
                borderRadius: "16px",
                objectFit: "cover",
                border: "2px solid rgba(255,255,255,0.14)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
                display: "block",
              }}
            />

            {/* Name label */}
            <div style={{
              color: "#e8eef8", fontSize: "15px", fontWeight: 700,
              textAlign: "center", letterSpacing: "0.02em",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}>
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
    const base: React.CSSProperties = {
      display: "inline-block", marginLeft: "6px", fontSize: "13px", lineHeight: 1,
      fontWeight: 800, color: "#0b1114", background: "#facc15",
      borderRadius: "4px", padding: "1px 4px",
    };
    if (sortKey !== key) return <span style={{ ...base, background: "rgba(250,204,21,0.22)", color: "#facc15" }}>↕</span>;
    return <span style={base}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }
  const thSort: React.CSSProperties = { cursor: "pointer", userSelect: "none" };

  // The server returns the already-filtered, already-sorted page.
  const rows = users;

  return (
    <>
      <Head title="All Users" sub={loading ? "Loading…" : `${total} registered users`} />
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search by name, phone, email, location…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={styles.filterSelect} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as "all" | AdminUserRow["role"]); setPage(1); }}>
          <option value="all">All roles</option>
          <option value="player">Players</option>
          <option value="organiser">Organisers</option>
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {error && <div className={styles.formError}>{error}</div>}
      {loading && <div className={styles.loadingState}>Loading users…</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={thSort} onClick={() => toggleSort("name")}>Name{sortIcon("name")}</th>
              <th>Phone</th><th>Role</th><th>Email</th><th>Location</th>
              <th style={thSort} onClick={() => toggleSort("games")}>Games{sortIcon("games")}</th>
              <th style={thSort} onClick={() => toggleSort("conduct")}>Conduct{sortIcon("conduct")}</th>
              <th style={thSort} onClick={() => toggleSort("gameplay")}>Gameplay{sortIcon("gameplay")}</th>
              <th style={thSort} onClick={() => toggleSort("money")}>Earnings / Spent{sortIcon("money")}</th>
              <th style={thSort} onClick={() => toggleSort("joined")}>Joined{sortIcon("joined")}</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No users match the current filters.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => onOpenDetail(u.name)} style={{ cursor: "pointer" }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Avatar name={u.name} src={u.profileImage} size={36} />
                    <span style={{ fontWeight: 500 }}>{u.name}</span>
                  </div>
                </td>
                <td>{u.phone}</td>
                <td><span className={`${styles.badge} ${u.role === "organiser" ? styles.badgeBlue : styles.badgeGray}`}>{u.role === "organiser" ? "Organiser" : "Player"}</span></td>
                <td>{u.email || "—"}</td>
                <td>{u.location || "—"}</td>
                <td>
                  {u.role === "organiser" ? (u.gamesHosted ?? 0) : (u.gamesPlayed ?? 0)}
                  {u.role === "player" && (u.noShowCount ?? 0) > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--red)" }}>{u.noShowCount} no-show{(u.noShowCount ?? 0) > 1 ? "s" : ""}</div>
                  )}
                </td>
                {/* Conduct: players show conduct avg; organisers show their single rating */}
                <td>
                  {u.role === "organiser"
                    ? (u.rating != null && u.rating > 0
                        ? <span style={{ color: "var(--amber)", fontWeight: 600 }}>★ {(u.rating as number).toFixed(1)}<span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 400, marginLeft: "3px" }}>(org)</span></span>
                        : <span style={{ color: "var(--muted)", fontSize: "12px" }}>No ratings</span>)
                    : (u.conductRating != null && u.conductRating > 0
                        ? <span style={{ color: "var(--amber)", fontWeight: 600 }}>★ {u.conductRating.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>)
                  }
                </td>
                {/* Gameplay: players only */}
                <td>
                  {u.role === "organiser"
                    ? <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>
                    : (u.gameplayRating != null && u.gameplayRating > 0
                        ? <span style={{ color: "var(--amber)", fontWeight: 600 }}>★ {u.gameplayRating.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>)
                  }
                </td>
                <td>
                  {u.role === "organiser"
                    ? <span style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(u.earningsPaise)}</span>
                    : <span style={{ color: "var(--red)" }}>{formatCurrency(u.totalSpentPaise)}</span>
                  }
                  {u.role === "player" && (u.walletBalancePaise ?? 0) > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--green)" }}>Bal: {formatCurrency(u.walletBalancePaise)}</div>
                  )}
                </td>
                <td>{formatDate(u.joinedAt)}</td>
                <td><span className={`${styles.badge} ${badgeClassForStatus(u.status)}`}>{formatStatusLabel(u.status)}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.actionBtn}
                    style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.4)" }}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Showing <strong style={{ color: "var(--white)" }}>{(page - 1) * PAGE_SIZE + 1}</strong>–
            <strong style={{ color: "var(--white)" }}>{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
            <strong style={{ color: "var(--white)" }}>{total}</strong> users
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span style={pagerPillStyle}>Page {page} / {totalPages}</span>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.sectionTitle}>Delete User</div>
              <button className={styles.modalClose} type="button" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div style={{ marginBottom: "14px", color: "var(--text)", fontSize: "14px" }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?{" "}
              <span style={{ color: "var(--red)" }}>This action cannot be undone.</span>
            </div>
            <label className={styles.formLabel}>
              Reason for deletion
              <input
                className={styles.searchInput}
                style={{ width: "100%", marginTop: "6px" }}
                placeholder="e.g. Fake account, policy violation, user request…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </label>
            {deleteError && <div className={styles.formError} style={{ marginTop: "10px" }}>{deleteError}</div>}
            <div className={styles.modalActions} style={{ marginTop: "18px" }}>
              <button className={styles.actionBtn} type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className={styles.actionBtn}
                style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.5)", background: "var(--red-bg)" }}
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
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, display: "flex", alignItems: "center", gap: "10px", padding: "13px 20px", background: "rgba(17,20,36,0.97)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: "280px" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>{toast}</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Avatar name={o.name} src={o.profileImage} size={36} />
          <div>
            <div style={{ fontWeight: 500 }}>{o.name}</div>
            {o.suspendReason && <div style={{ fontSize: "11px", color: "var(--red)" }}>{o.suspendReason}</div>}
          </div>
        </div>
      </td>
      <td>
        <div>{o.phone}</div>
        {o.whatsappNumber && o.whatsappNumber !== o.phone && (
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>WA: {o.whatsappNumber}</div>
        )}
      </td>
      <td>{o.email || "—"}</td>
      <td>{o.location || "—"}</td>
      <td>{formatDate(o.joinedAt)}</td>
      <td>
        <div>{o.gamesHosted ?? 0} hosted</div>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{o.totalPlayersManaged ?? 0} players</div>
      </td>
      <td>
        {o.rating != null && o.rating > 0
          ? <div style={{ color: "var(--amber)", fontWeight: 600 }}>★ {o.rating.toFixed(1)}<span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400, marginLeft: "4px" }}>({o.totalRatingsReceived ?? 0})</span></div>
          : <div style={{ color: "var(--muted)", fontSize: "12px" }}>No ratings yet</div>
        }
      </td>
      <td>
        {o.cancellationRate != null && o.cancellationRate > 0
          ? <span style={{ color: o.cancellationRate > 20 ? "var(--red)" : "var(--amber)" }}>{o.cancellationRate.toFixed(1)}%</span>
          : <span style={{ color: "var(--muted)" }}>0%</span>
        }
      </td>
      <td>
        <div style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(o.earningsPaise)}</div>
        {(o.pendingPayoutPaise ?? 0) > 0 && (
          <div style={{ fontSize: "11px", color: "var(--amber)" }}>Pending: {formatCurrency(o.pendingPayoutPaise)}</div>
        )}
      </td>
      <td>
        <span className={`${styles.badge} ${badgeClassForStatus(o.status)}`}>{formatStatusLabel(o.status)}</span>
      </td>
      <td>
        <div className={styles.actions}>
          {o.approvalStatus === "pending" && (
            <>
              <button
                className={styles.actionBtn}
                style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.4)" }}
                disabled={busy}
                onClick={() => doAction(o.id, "approve")}
              >
                {actionBusy === o.id + "approve" ? "…" : "Approve"}
              </button>
              <button
                className={styles.actionBtn}
                style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.4)" }}
                disabled={busy}
                onClick={() => doAction(o.id, "reject")}
              >
                {actionBusy === o.id + "reject" ? "…" : "Reject"}
              </button>
            </>
          )}
          {o.approvalStatus === "approved" && o.isActive && (
            <button
              className={styles.actionBtn}
              style={{ color: "var(--amber)", borderColor: "rgba(245,158,11,0.4)" }}
              disabled={busy}
              onClick={() => { setSuspendTarget(o); setSuspendReason(""); }}
            >
              Suspend
            </button>
          )}
          {!o.isActive && o.approvalStatus !== "pending" && o.approvalStatus !== "rejected" && (
            <button
              className={styles.actionBtn}
              style={{ color: "var(--green)", borderColor: "rgba(34,197,94,0.4)" }}
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
    <div className={styles.tableWrap} style={{ marginBottom: "20px" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th><th>Phone / WhatsApp</th><th>Email</th><th>Location</th>
            <th>Joined</th><th>Games</th><th>Rating</th><th>Cancel Rate</th>
            <th>Earnings</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={11} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>{emptyMsg}</td></tr>
          )}
          {rows.map((o) => <ORow key={o.id} o={o} />)}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Head title="Organisers" sub={loading ? "Loading…" : `${organisers.length} total organisers`} />
      {error && <div className={styles.formError}>{error}</div>}
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search by name, phone, WhatsApp, email, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={styles.actionBtn} type="button" onClick={() => fetchOrganisers(true)}>Refresh</button>
      </div>
      {loading && <div className={styles.loadingState}>Loading organisers…</div>}
      <div className={styles.blockTitle}>Pending Verification ({applySearch(pending).length})</div>
      <OTable rows={applySearch(pending)} emptyMsg="No pending organisers." />
      <div className={styles.blockTitleSuccess}>Approved &amp; Active ({applySearch(approved).length})</div>
      <OTable rows={applySearch(approved)} emptyMsg="No approved organisers." />
      <div className={styles.blockTitle}>Rejected / Suspended ({applySearch(other).length})</div>
      <OTable rows={applySearch(other)} emptyMsg="None." />

      {/* Suspend reason modal */}
      {suspendTarget && (
        <div className={styles.modalOverlay} onClick={() => setSuspendTarget(null)}>
          <div className={styles.modal} style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.sectionTitle}>Suspend Organiser</div>
              <button className={styles.modalClose} type="button" onClick={() => setSuspendTarget(null)}>✕</button>
            </div>
            <div style={{ marginBottom: "14px", color: "var(--text)", fontSize: "14px" }}>
              Suspending <strong>{suspendTarget.name}</strong>. They will not be able to create or manage games.
            </div>
            <label className={styles.formLabel}>
              Reason (shown to admin log)
              <input
                className={styles.searchInput}
                style={{ width: "100%", marginTop: "6px" }}
                placeholder="e.g. Multiple complaints from players"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </label>
            {actionError && <div className={styles.formError} style={{ marginTop: "10px" }}>{actionError}</div>}
            <div className={styles.modalActions} style={{ marginTop: "18px" }}>
              <button className={styles.actionBtn} type="button" onClick={() => setSuspendTarget(null)}>Cancel</button>
              <button
                className={styles.actionBtn}
                style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.5)", background: "var(--red-bg)" }}
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
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={`${styles.modal} ${styles.modalLarge}`} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHead}>
            <div className={styles.sectionTitle}>Loading…</div>
            <button className={styles.modalClose} onClick={onClose} type="button">✕</button>
          </div>
          <div className={styles.loadingState}>Loading game data…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={`${styles.modal} ${styles.modalLarge}`} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHead}>
            <div className={styles.sectionTitle}>Error</div>
            <button className={styles.modalClose} onClick={onClose} type="button">✕</button>
          </div>
          <div className={styles.formError}>{error}</div>
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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.sectionTitle}>{loading ? "Loading…" : (game?.title || "Game Detail")}</div>
            {game && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
                <span className={`${styles.badge} ${styles.badgeGray}`}>{game.format}</span>
                <span style={{ color: "var(--muted)", fontSize: "13px" }}>{formatDateTime(game.scheduledAt)}</span>
                <span className={`${styles.badge} ${badgeClassForStatus(game.status)}`}>{formatStatusLabel(game.status)}</span>
              </div>
            )}
          </div>
          <button className={styles.modalClose} onClick={onClose} type="button">✕</button>
        </div>

        {loading && <div className={styles.loadingState}>Loading game data…</div>}
        {error   && <div className={styles.formError}>{error}</div>}

        {game && (
          <div style={{ overflowY: "auto", maxHeight: "calc(85vh - 110px)" }}>

            {/* Info grid */}
            <div className={styles.gameInfoGrid}>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Venue</div><div>{game.turf?.name || "—"}{game.turf?.address?.city ? `, ${game.turf.address.city}` : ""}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Organiser</div><div>{game.organiser?.name || "—"}<br /><span style={{ fontSize: "11px", color: "var(--muted)" }}>{game.organiser?.phone || ""}</span></div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Fee / Player</div><div>{formatCurrency(game.feeInPaise)}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Slots Filled</div><div>{regs.length} / {game.totalSlots ?? "—"}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Min Players</div><div>{game.minPlayers ?? "—"}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Duration</div><div>{game.durationMins ? `${game.durationMins} min` : "—"}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Paid Registrations</div><div style={{ color: "var(--green)" }}>{paidCount}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Guest Slots</div><div>{guestCount}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Total Revenue</div><div style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(totalRevPaise)}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Attended (Present)</div><div>{game.attendanceMarked ? presentCount : "Not marked"}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Organiser Playing</div><div>{game.organiserIsPlaying ? "Yes" : "No"}</div></div>
              <div className={styles.gameInfoCell}><div className={styles.statLabel}>Attendance Marked</div><div>{game.attendanceMarked ? "Yes" : "No"}</div></div>
              {game.cancelReason && (
                <div className={styles.gameInfoCell} style={{ gridColumn: "1 / -1" }}>
                  <div className={styles.statLabel}>Cancellation Reason</div>
                  <div style={{ color: "var(--red)" }}>{game.cancelReason} {game.cancelledAt ? `· ${formatDate(game.cancelledAt)}` : ""}</div>
                </div>
              )}
            </div>

            {/* Registrations */}
            <div className={styles.blockTitleSuccess}>Registrations ({regs.length})</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>#</th><th>Player / Guest</th><th>Type</th><th>Position</th><th>Team Pref</th><th>Payment</th><th>Amount Paid</th><th>Attended</th><th>Signed Up</th></tr>
                </thead>
                <tbody>
                  {regs.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No registrations.</td></tr>}
                  {regs.map((r, i) => (
                    <tr key={r._id}>
                      <td>{i + 1}</td>
                      <td>
                        {r.plusOneName
                          ? <span>{r.plusOneName} <span className={`${styles.badge} ${styles.badgeGray}`}>Guest</span></span>
                          : r.player?.name || "Unknown"
                        }
                        {!r.plusOneName && r.player?.phone && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{r.player.phone}</div>}
                      </td>
                      <td>{r.plusOneName ? <span className={`${styles.badge} ${styles.badgeGray}`}>Guest</span> : <span className={`${styles.badge} ${styles.badgeBlue}`}>Player</span>}</td>
                      <td>{formatStatusLabel(r.preferredPosition)}</td>
                      <td>{formatStatusLabel(r.teamPreference)}</td>
                      <td><span className={`${styles.badge} ${badgeClassForStatus(r.paymentStatus)}`}>{formatStatusLabel(r.paymentStatus)}</span></td>
                      <td>{formatCurrency(r.amountPaidPaise)}</td>
                      <td><span className={`${styles.badge} ${badgeClassForStatus(r.attended)}`}>{formatStatusLabel(r.attended)}</span></td>
                      <td>{formatDate(r.signedUpAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Waitlist */}
            {(game.waitlist?.length ?? 0) > 0 && (
              <>
                <div className={styles.blockTitle} style={{ marginTop: "20px" }}>Waitlist ({game.waitlist.length})</div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>#</th><th>Player</th><th>Phone</th><th>Position</th><th>Status</th><th>Joined</th></tr></thead>
                    <tbody>
                      {game.waitlist.map((w, i) => (
                        <tr key={w._id}>
                          <td>{i + 1}</td>
                          <td>{w.player?.name || "Unknown"}</td>
                          <td>{w.player?.phone || "—"}</td>
                          <td>{formatStatusLabel(w.preferredPosition)}</td>
                          <td><span className={`${styles.badge} ${badgeClassForStatus(w.status)}`}>{formatStatusLabel(w.status)}</span></td>
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
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search games, venue, organiser…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={styles.actionBtn} type="button" onClick={fetchGames}>Refresh</button>
      </div>
      {error && <div className={styles.formError}>{error}</div>}
      {loading && <div className={styles.loadingState}>Loading games…</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Game</th><th>Venue</th><th>Date</th><th>Format</th><th>Players</th><th>Fee</th><th>Organiser</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No games found.</td></tr>}
            {filtered.map((g) => (
              <tr key={g.id}>
                <td>{g.title}</td>
                <td>{g.venue || "—"}</td>
                <td>{formatDateTime(g.scheduledAt)}</td>
                <td><span className={`${styles.badge} ${styles.badgeGray}`}>{g.format || "—"}</span></td>
                <td>{`${g.players?.registered || 0} / ${g.players?.totalSlots || 0}`}</td>
                <td>{formatCurrency(g.feeInPaise)}</td>
                <td>{g.organiserName || "—"}</td>
                <td><span className={`${styles.badge} ${badgeClassForStatus(g.status)}`}>{formatStatusLabel(g.status)}</span></td>
                <td>
                  <button className={styles.actionBtn} type="button" onClick={() => setDetailGameId(g.id)}>
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
  topup:       { label: "Top-up",      cls: "badgeGreen"  },
  lock:        { label: "Lock",        cls: "badgeAmber"  },
  unlock:      { label: "Unlock",      cls: "badgeGray"   },
  debit:       { label: "Debit",       cls: "badgeBlue"   },
  refund:      { label: "Refund",      cls: "badgeViolet" },
  backout_fee: { label: "Backout Fee", cls: "badgeRed"    },
  bonus:       { label: "Bonus",       cls: "badgeGreen"  },
  withdrawal:  { label: "Withdrawal",  cls: "badgeRed"    },
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
      <div className={styles.summaryFour}>
        <div className={styles.summaryItem}>
          <div className={styles.statLabel}>Total Top-ups</div>
          <div className={styles.summaryValue} style={{ color: "var(--green)" }}>{formatCurrency(summary.totalTopUpPaise)}</div>
          <div className={styles.paySub}>Razorpay recharges</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.statLabel}>Total Debits</div>
          <div className={styles.summaryValue}>{formatCurrency(summary.totalDebitPaise)}</div>
          <div className={styles.paySub}>Game fees &amp; backout charges</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.statLabel}>Total Refunded</div>
          <div className={styles.summaryValue} style={{ color: "var(--violet)" }}>{formatCurrency(summary.totalRefundedPaise)}</div>
          <div className={styles.paySub}>Cancellations &amp; refunds</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.summaryValue} style={{ color: "var(--amber)" }}>{summary.pendingCount ?? 0}</div>
          <div className={styles.paySub}>Unconfirmed transactions</div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search player, phone, game, Razorpay ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={styles.filterSelect} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
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
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button className={styles.actionBtn} type="button" onClick={fetchPayments}>Refresh</button>
      </div>

      {error   && <div className={styles.formError}>{error}</div>}
      {loading && <div className={styles.loadingState}>Loading transactions…</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Txn ID</th><th>Player</th><th>Type</th><th>Amount</th>
              <th>Balance After</th><th>Game</th><th>Organiser</th>
              <th>Description / Razorpay</th><th>Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No transactions found.</td></tr>
            )}
            {filtered.map((p) => {
              const txnMeta = TXN_TYPE_LABEL[p.type] || { label: p.type, cls: "badgeGray" };
              return (
                <tr key={String(p.id)}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--muted)" }}>
                    {String(p.id).slice(-8).toUpperCase()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.playerName}</div>
                    {p.playerPhone && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{p.playerPhone}</div>}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[txnMeta.cls as keyof typeof styles]}`}>
                      {txnMeta.label}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: ["refund", "unlock", "bonus"].includes(p.type) ? "var(--green)" : ["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "var(--red)" : "var(--text)" }}>
                    {["debit", "lock", "backout_fee", "withdrawal"].includes(p.type) ? "−" : "+"}{formatCurrency(p.amountPaise)}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--muted)" }}>{formatCurrency(p.balanceAfterPaise)}</td>
                  <td>{p.gameTitle || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td>
                    {p.organiserName
                      ? <>
                          <div style={{ fontWeight: 500 }}>{p.organiserName}</div>
                          {p.organiserPhone && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{p.organiserPhone}</div>}
                        </>
                      : <span style={{ color: "var(--muted)" }}>—</span>
                    }
                  </td>
                  <td style={{ maxWidth: "180px" }}>
                    {p.description && <div style={{ fontSize: "12px" }}>{p.description}</div>}
                    {p.razorpayPaymentId && (
                      <div style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
                        {p.razorpayPaymentId}
                      </div>
                    )}
                    {!p.description && !p.razorpayPaymentId && <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td>{formatDateTime(p.paidAt)}</td>
                  <td><span className={`${styles.badge} ${badgeClassForStatus(p.status)}`}>{formatStatusLabel(p.status)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Showing <strong style={{ color: "var(--white)" }}>{(page - 1) * PAGE_SIZE + 1}</strong>–
            <strong style={{ color: "var(--white)" }}>{Math.min(page * PAGE_SIZE, total)}</strong> of{" "}
            <strong style={{ color: "var(--white)" }}>{total}</strong> transactions
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span style={pagerPillStyle}>Page {page} / {totalPages}</span>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
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
      <div className={styles.summaryThree}>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Total (DB)</div><div className={styles.summaryValue}>{loading ? "—" : total}</div></div>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Unread</div><div className={styles.summaryValue} style={{ color: "var(--amber)" }}>{loading ? "—" : unread}</div></div>
        <div className={styles.summaryItem}><div className={styles.statLabel}>Read</div><div className={styles.summaryValue} style={{ color: "var(--green)" }}>{loading ? "—" : notifs.length - unread}</div></div>
      </div>
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search notifications…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All recipients</option>
          <option value="player">Players only</option>
          <option value="organiser">Organisers only</option>
        </select>
      </div>
      {loading ? (
        <div className={styles.loadingState}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>No notifications found.</div>
      ) : (
        <div className={styles.notifFeed}>
          {filtered.map((n) => (
            <div key={n._id} className={styles.notifItem}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                  <span className={`${styles.badge} ${styles.badgeGray}`}>{TYPE_LABEL[n.type] || n.type}</span>
                  <span className={`${styles.badge} ${n.recipientRole === "organiser" ? styles.badgeBlue : styles.badgeGray}`}>{n.recipientRole}</span>
                  {n.recipientName && (
                    <span style={{ fontSize: "13px", color: "var(--white)", fontWeight: 600 }}>
                      {n.recipientName}
                      {n.recipientPhone && (
                        <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: "6px", fontSize: "11px" }}>
                          {n.recipientPhone}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className={styles.notifMsg}><strong>{n.title}</strong> — {n.body}</div>
                <div className={styles.notifTime}>{notifTimeAgo(n.createdAt)}</div>
              </div>
              <span className={`${styles.badge} ${n.isRead ? styles.badgeGreen : styles.badgeAmber}`}>{n.isRead ? "Read" : "Unread"}</span>
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
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [summary, setSummary]   = useState<{ avgGame?: number | null; tagCounts?: Record<string, number> }>({});
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

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setFbLoading(false); setFbError("Admin session missing."); return; }
    fetch(`${API_BASE}/admin/feedback?limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: FeedbackApiResponse) => {
        if (d.success) { setFeedback(d.data || []); setSummary(d.summary || {}); }
        else setFbError(d.message || "Failed to load feedback.");
      })
      .catch(() => setFbError("Cannot reach the server."))
      .finally(() => setFbLoading(false));
  }, []);

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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  function sortIcon(key: FbSortKey) {
    if (sortKey !== key) return <span style={{ color: "var(--muted2)", marginLeft: "4px" }}>↕</span>;
    return <span style={{ marginLeft: "4px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  // ── Tab 2 helpers ──────────────────────────────────────────────────────────
  function togglePrSort(key: PrSortKey) {
    if (prSortKey === key) setPrSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPrSortKey(key); setPrSortDir("desc"); }
  }
  function prSortIcon(key: PrSortKey) {
    if (prSortKey !== key) return <span style={{ color: "var(--muted2)", marginLeft: "4px" }}>↕</span>;
    return <span style={{ marginLeft: "4px" }}>{prSortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thSort: React.CSSProperties = { cursor: "pointer", userSelect: "none" };

  // ── Unique filter lists ──────────────────────────────────────────────────────
  const fbOrganisers = useMemo(() => {
    const s = new Set<string>();
    feedback.forEach(f => { if (f.game?.organiser?.name) s.add(f.game.organiser.name); });
    return Array.from(s).sort();
  }, [feedback]);

  const fbTurfs = useMemo(() => {
    const s = new Set<string>();
    feedback.forEach(f => { if (f.game?.turf?.name) s.add(f.game.turf.name); });
    return Array.from(s).sort();
  }, [feedback]);

  const fbGames = useMemo(() => {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const map = new Map<string, string>(); // "title||YYYY-MM-DD" → display label
    feedback.forEach(f => {
      const title = f.game?.title;
      if (!title) return;
      const dateOnly = (f.game?.scheduledAt || "").slice(0, 10); // "2025-06-09" — no timezone shift
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
    // YYYY-MM-DD strings sort lexicographically = chronologically; newest first
    return Array.from(map.entries()).sort((a, b) => {
      const dA = a[0].split("||")[1] || "";
      const dB = b[0].split("||")[1] || "";
      return dB !== dA ? dB.localeCompare(dA) : a[1].localeCompare(b[1]);
    });
  }, [feedback]);

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

  const fbFiltered = feedback.filter((f) => {
    const q = fbSearch.trim().toLowerCase();
    const matchSearch = !q || [
      f.submittedBy?.name || "", f.submittedBy?.phone || "",
      f.game?.title || "", f.game?.organiser?.name || "",
      f.game?.turf?.name || "", f.comment || "",
    ].join(" ").toLowerCase().includes(q);
    const matchOrg  = !fbOrganiser || f.game?.organiser?.name === fbOrganiser;
    const matchTurf = !fbTurf || f.game?.turf?.name === fbTurf;
    const matchGame = !fbGame || (() => {
      const [ft, fd] = fbGame.split("||");
      return f.game?.title === ft && (f.game?.scheduledAt || "").slice(0, 10) === fd;
    })();
    const matchDate = inDateRange(f.createdAt, fbDateRange);
    return matchSearch && matchOrg && matchTurf && matchGame && matchDate;
  });

  const fbSorted = [...fbFiltered].sort((a, b) => {
    let av = 0, bv = 0;
    if (sortKey === "date")           { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
    if (sortKey === "gameRating")     { av = a.gameRating ?? 0;       bv = b.gameRating ?? 0; }
    if (sortKey === "organiserRating"){ av = a.organiserRating ?? 0;  bv = b.organiserRating ?? 0; }
    if (sortKey === "venueRating")    { av = a.venueRating ?? 0;      bv = b.venueRating ?? 0; }
    return sortDir === "asc" ? av - bv : bv - av;
  });

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
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === "player" ? styles.tabActive : ""}`}
          type="button"
          onClick={() => setTab("player")}
        >
          Player → Platform ({feedback.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "organiser" ? styles.tabActive : ""}`}
          type="button"
          onClick={() => setTab("organiser")}
        >
          Organiser → Players ({prTotal})
        </button>
      </div>

      {/* ── Tab 1: Player feedback ─────────────────────────────────────────── */}
      {tab === "player" && (
        <>
          <div className={styles.paymentSummary}>
            <div className={styles.payCard}><div className={styles.statLabel}>Total Submissions</div><div className={styles.payValue}>{fbLoading ? "—" : feedback.length}</div><div className={styles.paySub}>Post-game feedback</div></div>
            <div className={styles.payCard}><div className={styles.statLabel}>Avg Game Rating</div><div className={styles.payValue} style={{ color: "var(--amber)" }}>{summary.avgGame != null ? `${summary.avgGame} / 5` : "—"}</div><div className={styles.paySub}>Across all submitted feedback</div></div>
            <div className={styles.payCard}>
              <div className={styles.statLabel}>Top Tags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                {topTags.length === 0 ? <span style={{ color: "var(--muted)", fontSize: "13px" }}>—</span> : topTags.map(([tag, count]) => (
                  <span key={tag} className={`${styles.badge} ${styles.badgeGray}`}>{tag} ({count})</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.toolbar}>
            <input className={styles.searchInput} placeholder="Search player, organiser, turf, game, comment…" value={fbSearch} onChange={(e) => setFbSearch(e.target.value)} />
            <select className={styles.filterSelect} value={fbOrganiser} onChange={(e) => setFbOrganiser(e.target.value)}>
              <option value="">All Organisers</option>
              {fbOrganisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={styles.filterSelect} value={fbTurf} onChange={(e) => setFbTurf(e.target.value)}>
              <option value="">All Turfs</option>
              {fbTurfs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={styles.filterSelect} value={fbGame} onChange={(e) => setFbGame(e.target.value)}>
              <option value="">All Games</option>
              {fbGames.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => setFbDateRange(r)}
                  style={{ padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
                    background: fbDateRange === r ? "var(--accent)" : "var(--surface)",
                    border: `1px solid ${fbDateRange === r ? "var(--accent)" : "var(--border2)"}`,
                    color: fbDateRange === r ? "#000" : "var(--muted)",
                    fontWeight: fbDateRange === r ? 700 : 400 }}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(fbOrganiser || fbTurf || fbGame || fbDateRange !== "all" || fbSearch) && (
              <button type="button"
                onClick={() => { setFbOrganiser(""); setFbTurf(""); setFbGame(""); setFbDateRange("all"); setFbSearch(""); }}
                style={{ padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
                  background: "rgba(241,118,127,0.1)", border: "1px solid rgba(241,118,127,0.35)",
                  color: "var(--danger)", whiteSpace: "nowrap" }}>
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!fbLoading && (
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px" }}>
              Showing <strong style={{ color: "var(--white)" }}>{fbSorted.length}</strong> of {feedback.length} entries
            </div>
          )}

          {fbError   && <div className={styles.formError}>{fbError}</div>}
          {fbLoading && <div className={styles.loadingState}>Loading feedback…</div>}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Game</th>
                  <th>Organiser</th>
                  <th>Turf / Venue</th>
                  <th style={thSort} onClick={() => toggleSort("date")}>Date{sortIcon("date")}</th>
                  <th style={thSort} onClick={() => toggleSort("gameRating")}>Game ★{sortIcon("gameRating")}</th>
                  <th style={thSort} onClick={() => toggleSort("organiserRating")}>Organiser ★{sortIcon("organiserRating")}</th>
                  <th style={thSort} onClick={() => toggleSort("venueRating")}>Venue ★{sortIcon("venueRating")}</th>
                  <th>Tags</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {!fbLoading && fbSorted.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No feedback submitted yet.</td></tr>
                )}
                {fbSorted.map((f) => (
                  <tr key={f._id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{f.submittedBy?.name || "—"}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>{f.submittedBy?.phone || ""}</div>
                    </td>
                    <td>
                      {f.game?.title || "—"}
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>{f.game?.format || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.organiser?.name || "—"}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>{f.game?.organiser?.phone || ""}</div>
                    </td>
                    <td>
                      <div>{f.game?.turf?.name || "—"}</div>
                      {(f.game?.turf?.address?.area || f.game?.turf?.address?.city) && (
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {[f.game?.turf?.address?.area, f.game?.turf?.address?.city].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(f.createdAt)}</td>
                    <td style={{ color: "var(--amber)" }}>{starRating(f.gameRating)}</td>
                    <td style={{ color: "var(--amber)" }}>{starRating(f.organiserRating)}</td>
                    <td style={{ color: "var(--amber)" }}>{starRating(f.venueRating)}</td>
                    <td>
                      {(f.tags || []).map((tag) => (
                        <span key={tag} className={`${styles.badge} ${styles.badgeGray}`} style={{ marginRight: "3px" }}>{tag}</span>
                      ))}
                    </td>
                    <td style={{ maxWidth: "200px" }}>
                      {!f.comment ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : f.comment.length <= TRUNC ? (
                        <span style={{ fontSize: "13px" }}>{f.comment}</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px", display: "inline-block" }}>
                            {f.comment}
                          </span>
                          <button
                            type="button"
                            title="View full comment"
                            onClick={() => setCommentModal({ comment: f.comment!, player: f.submittedBy?.name || "Unknown", game: f.game?.title || "Unknown game" })}
                            style={{ flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--white)", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
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

          {/* Full-comment modal */}
          {commentModal && (
            <div className={styles.modalOverlay} onClick={() => setCommentModal(null)}>
              <div className={styles.modal} style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <div>
                    <div className={styles.sectionTitle}>Full Comment</div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>
                      {commentModal.player} &nbsp;·&nbsp; {commentModal.game}
                    </div>
                  </div>
                  <button className={styles.modalClose} type="button" onClick={() => setCommentModal(null)}>✕</button>
                </div>
                <p style={{ fontSize: "15px", lineHeight: "1.75", color: "var(--text)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
          <div className={styles.summaryThree}>
            <div className={styles.summaryItem}><div className={styles.statLabel}>Total Ratings</div><div className={styles.summaryValue}>{prLoading ? "—" : prTotal}</div></div>
            <div className={styles.summaryItem}>
              <div className={styles.statLabel}>Avg Conduct</div>
              <div className={styles.summaryValue} style={{ color: "var(--amber)" }}>
                {prRows.length > 0
                  ? (prRows.reduce((s, r) => s + r.conductRating, 0) / prRows.length).toFixed(1)
                  : "—"}
              </div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.statLabel}>Avg Gameplay</div>
              <div className={styles.summaryValue} style={{ color: "var(--amber)" }}>
                {prRows.length > 0
                  ? (prRows.reduce((s, r) => s + r.gameplayRating, 0) / prRows.length).toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          <div className={styles.toolbar}>
            <input className={styles.searchInput} placeholder="Search player, organiser, game, notes…" value={prSearch} onChange={(e) => setPrSearch(e.target.value)} />
            <select className={styles.filterSelect} value={prOrganiser} onChange={(e) => setPrOrganiser(e.target.value)}>
              <option value="">All Organisers</option>
              {prOrganisers.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={styles.filterSelect} value={prGame} onChange={(e) => setPrGame(e.target.value)}>
              <option value="">All Games</option>
              {prGames.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {DATE_RANGES.map(r => (
                <button key={r} type="button" onClick={() => setPrDateRange(r)}
                  style={{ padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
                    background: prDateRange === r ? "var(--accent)" : "var(--surface)",
                    border: `1px solid ${prDateRange === r ? "var(--accent)" : "var(--border2)"}`,
                    color: prDateRange === r ? "#000" : "var(--muted)",
                    fontWeight: prDateRange === r ? 700 : 400 }}>
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {(prOrganiser || prGame || prDateRange !== "all" || prSearch) && (
              <button type="button"
                onClick={() => { setPrOrganiser(""); setPrGame(""); setPrDateRange("all"); setPrSearch(""); }}
                style={{ padding: "7px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
                  background: "rgba(241,118,127,0.1)", border: "1px solid rgba(241,118,127,0.35)",
                  color: "var(--danger)", whiteSpace: "nowrap" }}>
                ✕ Clear Filters
              </button>
            )}
          </div>
          {!prLoading && (
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px" }}>
              Showing <strong style={{ color: "var(--white)" }}>{prSorted.length}</strong> of {prTotal} entries
            </div>
          )}

          {prError   && <div className={styles.formError}>{prError}</div>}
          {prLoading && <div className={styles.loadingState}>Loading player ratings…</div>}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Organiser</th>
                  <th>Game</th>
                  <th>Position</th>
                  <th style={thSort} onClick={() => togglePrSort("conduct")}>Conduct ★{prSortIcon("conduct")}</th>
                  <th style={thSort} onClick={() => togglePrSort("gameplay")}>Gameplay ★{prSortIcon("gameplay")}</th>
                  <th style={thSort} onClick={() => togglePrSort("avg")}>Avg ★{prSortIcon("avg")}</th>
                  <th style={thSort} onClick={() => togglePrSort("date")}>Date{prSortIcon("date")}</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!prLoading && prSorted.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No organiser ratings submitted yet.</td></tr>
                )}
                {prSorted.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.playerName}</div>
                      {r.playerPhone && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{r.playerPhone}</div>}
                    </td>
                    <td>
                      <div>{r.organiserName}</div>
                      {r.organiserPhone && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{r.organiserPhone}</div>}
                    </td>
                    <td>
                      <div>{r.gameTitle || "—"}</div>
                      {r.gameFormat && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{r.gameFormat}</div>}
                    </td>
                    <td>
                      {r.preferredPosition
                        ? <span className={`${styles.badge} ${styles.badgeGray}`}>{formatStatusLabel(r.preferredPosition)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>
                      }
                      {r.gkAffinity != null && (
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>GK: {r.gkAffinity}/5</div>
                      )}
                    </td>
                    <td style={{ color: "var(--amber)", fontWeight: 600 }}>★ {r.conductRating.toFixed(1)}</td>
                    <td style={{ color: "var(--amber)", fontWeight: 600 }}>★ {r.gameplayRating.toFixed(1)}</td>
                    <td style={{ fontWeight: 700 }}>
                      <span style={{ color: r.avgRating >= 4 ? "var(--green)" : r.avgRating >= 3 ? "var(--amber)" : "var(--red)" }}>
                        ★ {r.avgRating.toFixed(1)}
                      </span>
                    </td>
                    <td>{formatDate(r.ratedAt)}</td>
                    <td style={{ maxWidth: "180px" }}>
                      {!r.notes ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : r.notes.length <= TRUNC ? (
                        <span style={{ fontSize: "13px" }}>{r.notes}</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px", display: "inline-block" }}>
                            {r.notes}
                          </span>
                          <button
                            type="button"
                            title="View full notes"
                            onClick={() => setNotesModal({ notes: r.notes!, player: r.playerName, organiser: r.organiserName })}
                            style={{ flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--white)", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
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
            <div className={styles.modalOverlay} onClick={() => setNotesModal(null)}>
              <div className={styles.modal} style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHead}>
                  <div>
                    <div className={styles.sectionTitle}>Organiser Notes</div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>
                      {notesModal.organiser} &nbsp;→&nbsp; {notesModal.player}
                    </div>
                  </div>
                  <button className={styles.modalClose} type="button" onClick={() => setNotesModal(null)}>✕</button>
                </div>
                <p style={{ fontSize: "15px", lineHeight: "1.75", color: "var(--text)", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Raised By</th><th>Type</th><th>Game</th><th>Description</th><th>Raised</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>Arjun Mehta</td><td><span className={`${styles.badge} ${styles.badgeRed}`}>Refund request</span></td><td>Monday 6v6</td><td>Says refund not received after cancellation</td><td>14 min ago</td><td><span className={`${styles.badge} ${styles.badgeRed}`}>Open</span></td><td><button className={styles.actionBtn} onClick={() => onOpenDetail("Refund Request — Arjun Mehta")}>Resolve</button></td></tr>
            <tr><td>Rohit Sinha</td><td><span className={`${styles.badge} ${styles.badgeAmber}`}>Backout fee</span></td><td>Saturday 7v7</td><td>Claims family emergency, requesting fee waiver</td><td>3 hr ago</td><td><span className={`${styles.badge} ${styles.badgeRed}`}>Open</span></td><td><button className={styles.actionBtn} onClick={() => onOpenDetail("Backout Fee — Rohit Sinha")}>Resolve</button></td></tr>
            <tr><td>Priya Nair</td><td><span className={`${styles.badge} ${styles.badgeBlue}`}>Team fairness</span></td><td>Friday 5v5</td><td>Teams were unbalanced — all high rated on one side</td><td>1 day ago</td><td><span className={`${styles.badge} ${styles.badgeAmber}`}>In review</span></td><td><button className={styles.actionBtn} onClick={() => onOpenDetail("Team Fairness — Priya Nair")}>Resolve</button></td></tr>
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
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.sectionTitle}>Communities</div>
          <div className={styles.sectionSub}>Active communities across India</div>
        </div>
        <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} type="button">+ Add Community</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Community</th><th>City</th><th>Organiser</th><th>Members</th><th>Games (MTD)</th><th>WhatsApp</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>FC Bengaluru Sundays</td><td>Bengaluru</td><td>Vikram Rao</td><td>84</td><td>18</td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>Linked</span></td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>Active</span></td><td><button className={styles.actionBtn} onClick={() => onOpenDetail("FC Bengaluru Sundays")}>View</button></td></tr>
            <tr><td>Weekend Warriors Mumbai</td><td>Mumbai</td><td>Neha Kapoor</td><td>62</td><td>12</td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>Linked</span></td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>Active</span></td><td><button className={styles.actionBtn} onClick={() => onOpenDetail("Weekend Warriors Mumbai")}>View</button></td></tr>
            <tr><td>Delhi Football Club</td><td>Delhi</td><td>Pending</td><td>0</td><td>0</td><td><span className={`${styles.badge} ${styles.badgeAmber}`}>Pending</span></td><td><span className={`${styles.badge} ${styles.badgeAmber}`}>Setup</span></td><td><button className={styles.actionBtn}>Activate</button></td></tr>
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

  const inp = styles.searchInput;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div className={styles.sectionTitle}>{initial ? "Edit Venue" : "Add Venue"}</div>
          <button className={styles.modalClose} onClick={onClose} type="button">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>Name *<input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <label className={styles.formLabel}>Short Name<input className={inp} value={form.shortName} onChange={(e) => set("shortName", e.target.value)} /></label>
            <label className={styles.formLabel}>Address Line 1 *<input className={inp} value={form["address.line1"]} onChange={(e) => set("address.line1", e.target.value)} required /></label>
            <label className={styles.formLabel}>Address Line 2<input className={inp} value={form["address.line2"]} onChange={(e) => set("address.line2", e.target.value)} /></label>
            <label className={styles.formLabel}>Area *<input className={inp} value={form["address.area"]} onChange={(e) => set("address.area", e.target.value)} required /></label>
            <label className={styles.formLabel}>City *<input className={inp} value={form["address.city"]} onChange={(e) => set("address.city", e.target.value)} required /></label>
            <label className={styles.formLabel}>State *<input className={inp} value={form["address.state"]} onChange={(e) => set("address.state", e.target.value)} required /></label>
            <label className={styles.formLabel}>Pincode *<input className={inp} value={form["address.pincode"]} onChange={(e) => set("address.pincode", e.target.value)} required /></label>
            <label className={styles.formLabel}>
              Surface Type
              <select className={styles.filterSelect} value={form.surfaceType} onChange={(e) => set("surfaceType", e.target.value)}>
                <option value="artificial_turf">Artificial Turf</option>
                <option value="natural_grass">Natural Grass</option>
                <option value="concrete">Concrete</option>
                <option value="indoor">Indoor</option>
              </select>
            </label>
            <label className={styles.formLabel}>Pitches<input className={inp} type="number" min={1} value={form.numberOfPitches} onChange={(e) => set("numberOfPitches", Number(e.target.value))} /></label>
            <label className={styles.formLabel}>Contact Name<input className={inp} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
            <label className={styles.formLabel}>Contact Phone<input className={inp} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
            <label className={styles.formLabel}>Google Maps URL<input className={inp} value={form.googleMapsUrl} onChange={(e) => set("googleMapsUrl", e.target.value)} /></label>
            <label className={styles.formLabel}>Parking Notes<input className={inp} value={form.parkingNotes} onChange={(e) => set("parkingNotes", e.target.value)} /></label>
          </div>
          <div className={styles.checkboxRow}>
            {(["hasFloodlights", "hasChangingRooms", "hasParking", "hasRefreshments"] as const).map((k) => (
              <label key={k} className={styles.checkLabel}>
                <input type="checkbox" checked={form[k] as boolean} onChange={(e) => set(k, e.target.checked)} />
                {k.replace("has", "")}
              </label>
            ))}
          </div>
          {error && <div className={styles.formError}>{error}</div>}
          <div className={styles.modalActions}>
            <button className={styles.actionBtn} type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} type="submit" disabled={saving}>
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
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.sectionTitle}>Venues &amp; Turfs</div>
          <div className={styles.sectionSub}>
            {loading ? "Loading…" : (search || statusFilter !== "all" ? `${filtered.length} of ${turfs.length} venues` : `${turfs.length} registered venues`)}
          </div>
        </div>
        <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} type="button" onClick={() => setModalTurf("new")}>+ Add Venue</button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Venues</div><div className={styles.statValue}>{turfs.length}</div><div className={`${styles.statDelta} ${styles.neutral}`}>Registered turfs</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Active</div><div className={styles.statValue}>{activeCount}</div><div className={`${styles.statDelta} ${styles.up}`}>Open for games</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Discontinued</div><div className={styles.statValue}>{turfs.length - activeCount}</div><div className={`${styles.statDelta} ${styles.down}`}>Not in use</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Games Hosted</div><div className={styles.statValue} style={{ color: "var(--amber)" }}>{totalGames}</div><div className={`${styles.statDelta} ${styles.neutral}`}>Across all venues</div></div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search venue, area, city, state…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "discontinued")}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {error && <div className={styles.formError}>{error}</div>}
      {loading ? (
        <div className={styles.loadingState}>Loading venues…</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Venue</th><th>Area</th><th>City</th><th>State</th><th>Surface</th><th>Pitches</th><th>Floodlights</th><th>Verified</th><th>Status</th><th>Games</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>{turfs.length === 0 ? "No venues yet." : "No venues match the current filters."}</td></tr>}
              {filtered.map((t) => {
                const busy = actionLoading !== null;
                return (
                  <tr key={t._id} style={!t.isActive ? { opacity: 0.62 } : undefined}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td>{t.address.area}</td>
                    <td>{t.address.city}</td>
                    <td>{t.address.state}</td>
                    <td><span className={`${styles.badge} ${styles.badgeGray}`}>{surfaceLabel(t.surfaceType)}</span></td>
                    <td>{t.numberOfPitches}</td>
                    <td><span className={`${styles.badge} ${t.hasFloodlights ? styles.badgeGreen : styles.badgeGray}`}>{t.hasFloodlights ? "Yes" : "No"}</span></td>
                    <td><span className={`${styles.badge} ${t.isVerified ? styles.badgeGreen : styles.badgeAmber}`}>{t.isVerified ? "Verified" : "Pending"}</span></td>
                    <td><span className={`${styles.badge} ${t.isActive ? styles.badgeGreen : styles.badgeRed}`}>{t.isActive ? "Active" : "Discontinued"}</span></td>
                    <td>
                      <span style={{
                        display: "inline-block", minWidth: 30, textAlign: "center",
                        fontWeight: 700, fontSize: 13, padding: "3px 9px", borderRadius: 6,
                        color: (t.totalGamesHosted || 0) > 0 ? "#0b1114" : "var(--muted)",
                        background: (t.totalGamesHosted || 0) > 0 ? "var(--amber)" : "rgba(255,255,255,0.05)",
                      }}>{t.totalGamesHosted || 0}</span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} type="button" onClick={() => setModalTurf(t)}>Edit</button>
                        {!t.isVerified && <button className={styles.actionBtn} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/verify`)}>Verify</button>}
                        {t.isActive
                          ? <button className={styles.actionBtn} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/discontinue`)}>Discontinue</button>
                          : <button className={styles.actionBtn} type="button" disabled={busy} onClick={() => adminAction(`/turfs/${t._id}/reactivate`)}>Reactivate</button>
                        }
                        <button className={styles.actionBtn} type="button" onClick={() => onOpenDetail(t.name)}>View</button>
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
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><div className={styles.statLabel}>Platform Balance</div><div className={styles.statValue}>{formatCurrency(walletSum.totalBalancePaise)}</div><div className={`${styles.statDelta} ${styles.neutral}`}>All player wallets combined</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Top-ups</div><div className={styles.statValue}>{formatCurrency(walletSum.totalTopUpPaise)}</div><div className={`${styles.statDelta} ${styles.up}`}>Lifetime recharges</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Spent</div><div className={styles.statValue}>{formatCurrency(walletSum.totalSpentPaise)}</div><div className={`${styles.statDelta} ${styles.down}`}>Game registrations</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Refunded</div><div className={styles.statValue}>{formatCurrency(walletSum.totalRefundedPaise)}</div><div className={`${styles.statDelta} ${styles.neutral}`}>Cancellations &amp; backouts</div></div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button className={`${styles.tab} ${tab === "wallets" ? styles.tabActive : ""}`} onClick={() => setTab("wallets")} type="button">
          Player Wallets ({walletTotal})
        </button>
        <button className={`${styles.tab} ${tab === "earnings" ? styles.tabActive : ""}`} onClick={() => setTab("earnings")} type="button">
          Organiser Earnings ({earningsTotal})
        </button>
      </div>

      {/* Player Wallets */}
      {tab === "wallets" && (
        <>
          {/* ── Recharge offers config ───────────────────────────────────────── */}
          <div style={{ border: "1px solid var(--border2)", borderRadius: 12, padding: 16, marginBottom: 16, background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--white)" }}>💸 Wallet Recharge Offers</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, maxWidth: 520, lineHeight: 1.45 }}>
                  Flat bonus added to a player&apos;s wallet for each recharge range. The ranges are fixed — you set the bonus amount per range.
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: "var(--white)", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={offerEnabled} onChange={(e) => setOfferEnabled(e.target.checked)} />
                {offerEnabled ? "Offers Enabled" : "Offers Disabled"}
              </label>
            </div>

            {offersErr && <div className={styles.formError} style={{ marginTop: 10 }}>{offersErr}</div>}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              {offerTiers.map((t) => (
                <div key={t.key} style={{ flex: "1 1 170px", border: "1px solid var(--border2)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 7 }}>Recharge <strong style={{ color: "var(--white)" }}>{t.label}</strong></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>Bonus ₹</span>
                    <input
                      type="number" min={0} step={1} value={offerDraft[t.key] ?? ""}
                      onChange={(e) => setOfferDraft((p) => ({ ...p, [t.key]: e.target.value }))}
                      style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--white)", fontSize: 14 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button className={`${styles.topbarBtn} ${styles.topbarBtnPrimary}`} onClick={saveOffers} disabled={offersSaving || offersLoading} type="button">
                {offersSaving ? "Saving…" : "Save Offers"}
              </button>
              {offersMsg && <span style={{ color: "var(--green)", fontSize: 13, fontWeight: 600 }}>{offersMsg}</span>}
              {offersLoading && <span style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</span>}
            </div>
          </div>

          <div className={styles.toolbar}>
            <input className={styles.searchInput} placeholder="Search by name, phone or email…" value={walletSearch} onChange={(e) => { setWalletSearch(e.target.value); setWalletPage(1); }} />
          </div>
          {walletsError && <div className={styles.formError}>{walletsError}</div>}
          {walletsLoading && <div className={styles.loadingState}>Loading wallets…</div>}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Player</th><th>Phone</th><th>Email</th><th>Balance</th><th>Total Top-ups</th><th>Total Spent</th><th>Total Refunded</th><th>Last Updated</th></tr>
              </thead>
              <tbody>
                {!walletsLoading && filteredWallets.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No wallets found.</td></tr>}
                {filteredWallets.map((w) => (
                  <tr key={w._id}>
                    <td>{w.user?.name || "Unknown"}</td>
                    <td>{w.user?.phone || "—"}</td>
                    <td>{w.user?.email || "—"}</td>
                    <td style={{ color: (w.balancePaise || 0) > 0 ? "var(--green)" : "var(--muted)", fontWeight: 600 }}>{formatCurrency(w.balancePaise)}</td>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Showing <strong style={{ color: "var(--white)" }}>{(walletPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong style={{ color: "var(--white)" }}>{Math.min(walletPage * PAGE_SIZE, walletTotal)}</strong> of{" "}
                <strong style={{ color: "var(--white)" }}>{walletTotal}</strong> wallets
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button style={pagerBtnStyle(walletPage <= 1)} type="button" disabled={walletPage <= 1} onClick={() => setWalletPage(1)}>« First</button>
                <button style={pagerBtnStyle(walletPage <= 1)} type="button" disabled={walletPage <= 1} onClick={() => setWalletPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span style={pagerPillStyle}>Page {walletPage} / {walletTotalPages}</span>
                <button style={pagerBtnStyle(walletPage >= walletTotalPages)} type="button" disabled={walletPage >= walletTotalPages} onClick={() => setWalletPage((p) => Math.min(walletTotalPages, p + 1))}>Next ›</button>
                <button style={pagerBtnStyle(walletPage >= walletTotalPages)} type="button" disabled={walletPage >= walletTotalPages} onClick={() => setWalletPage(walletTotalPages)}>Last »</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Organiser Earnings */}
      {tab === "earnings" && (
        <>
          <div className={styles.toolbar}>
            <input className={styles.searchInput} placeholder="Search organiser by name or phone…" value={earningsSearch} onChange={(e) => { setEarningsSearch(e.target.value); setEarningsPage(1); }} />
          </div>
          {earningsError && <div className={styles.formError}>{earningsError}</div>}
          {earningsLoading && <div className={styles.loadingState}>Loading organiser earnings…</div>}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Organiser</th><th>Phone</th><th>Total Games</th><th>Completed</th><th>Cancelled</th><th>Paid Regs</th><th>Guest Slots</th><th>Total Revenue</th></tr>
              </thead>
              <tbody>
                {!earningsLoading && filteredEarnings.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No earnings data yet.</td></tr>}
                {filteredEarnings.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.name}
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>{e.email || ""}</div>
                    </td>
                    <td>{e.phone || "—"}</td>
                    <td>{e.totalGames}</td>
                    <td><span style={{ color: "var(--green)" }}>{e.completedGames}</span></td>
                    <td><span style={{ color: e.cancelledGames > 0 ? "var(--red)" : "var(--muted)" }}>{e.cancelledGames}</span></td>
                    <td>{e.totalPaidRegistrations}</td>
                    <td>{e.totalGuestSlots}</td>
                    <td style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(e.totalRevenuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!earningsLoading && earningsTotal > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Showing <strong style={{ color: "var(--white)" }}>{(earningsPage - 1) * PAGE_SIZE + 1}</strong>–
                <strong style={{ color: "var(--white)" }}>{Math.min(earningsPage * PAGE_SIZE, earningsTotal)}</strong> of{" "}
                <strong style={{ color: "var(--white)" }}>{earningsTotal}</strong> organisers
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button style={pagerBtnStyle(earningsPage <= 1)} type="button" disabled={earningsPage <= 1} onClick={() => setEarningsPage(1)}>« First</button>
                <button style={pagerBtnStyle(earningsPage <= 1)} type="button" disabled={earningsPage <= 1} onClick={() => setEarningsPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span style={pagerPillStyle}>Page {earningsPage} / {earningsTotalPages}</span>
                <button style={pagerBtnStyle(earningsPage >= earningsTotalPages)} type="button" disabled={earningsPage >= earningsTotalPages} onClick={() => setEarningsPage((p) => Math.min(earningsTotalPages, p + 1))}>Next ›</button>
                <button style={pagerBtnStyle(earningsPage >= earningsTotalPages)} type="button" disabled={earningsPage >= earningsTotalPages} onClick={() => setEarningsPage(earningsTotalPages)}>Last »</button>
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", textAlign: "center", padding: "40px" }}>
      <div style={{ width: 56, height: 56, borderRadius: "16px", background: "rgba(59,130,246,0.1)", border: "1.5px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      </div>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 800, color: "#3b82f6", letterSpacing: "0.18em", textTransform: "uppercase" }}>Streaming</p>
        <h2 style={{ margin: "0 0 10px", fontSize: "22px", fontWeight: 800, color: "var(--white)" }}>Guest List</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "360px", lineHeight: 1.7 }}>Per-event door verification table. Manage walk-in guests, verify ticket codes, and track entry in real time.</p>
      </div>
      <div style={{ marginTop: "8px", padding: "6px 16px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: "999px" }}>
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#3b82f6", letterSpacing: "0.16em", textTransform: "uppercase" }}>Coming Soon</span>
      </div>
    </div>
  );
}

function ScrFinance() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", textAlign: "center", padding: "40px" }}>
      <div style={{ width: 56, height: 56, borderRadius: "16px", background: "rgba(91,230,178,0.08)", border: "1.5px solid rgba(91,230,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
      </div>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.18em", textTransform: "uppercase" }}>Streaming</p>
        <h2 style={{ margin: "0 0 10px", fontSize: "22px", fontWeight: 800, color: "var(--white)" }}>Streaming Finance</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "360px", lineHeight: 1.7 }}>Revenue analytics for screening events. Track ticket sales, payout breakdowns, and venue-level financial performance.</p>
      </div>
      <div style={{ marginTop: "8px", padding: "6px 16px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", borderRadius: "999px" }}>
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.16em", textTransform: "uppercase" }}>Coming Soon</span>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={!loading ? onClose : undefined} />
      <div style={{ position: "relative", width: "100%", maxWidth: "460px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "14px" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "10px", background: "rgba(91,230,178,0.12)", border: "1px solid rgba(91,230,178,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.2" strokeLinecap="round">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: "var(--white)" }}>Adjust Wallet</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
              <strong style={{ color: "var(--white)" }}>{target.name}</strong>
              <span style={{ marginLeft: "8px", color: "#5be6b2" }}>Current: ₹{availableRupees}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Credit / Debit toggle */}
          <div style={{ display: "flex", gap: "8px" }}>
            {(["credit", "debit"] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                style={{ flex: 1, height: "38px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  background: mode === m ? (m === "credit" ? "rgba(91,230,178,0.18)" : "rgba(239,68,68,0.15)") : "none",
                  border: `1.5px solid ${mode === m ? (m === "credit" ? "rgba(91,230,178,0.5)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
                  color: mode === m ? (m === "credit" ? "#5be6b2" : "#ef4444") : "var(--muted)",
                }}>
                {m === "credit" ? "+ Credit" : "− Debit"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Amount (₹)</label>
            <input
              type="number" min="1" step="any" value={amount} onChange={e => { setAmount(e.target.value); setError(null); }}
              placeholder="e.g. 100"
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: `1.5px solid ${error && !note.trim() ? "var(--border)" : error ? "var(--border)" : "var(--border)"}`, borderRadius: "9px", padding: "10px 13px", fontSize: "14px", color: "var(--white)", outline: "none", fontFamily: "inherit" }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
              disabled={loading}
            />
          </div>

          {/* Note */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>Reason / Note <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="text" value={note} onChange={e => { setNote(e.target.value); setError(null); }}
              placeholder="e.g. Bonus credit for referral"
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: "9px", padding: "10px 13px", fontSize: "13px", color: "var(--white)", outline: "none", fontFamily: "inherit" }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(91,230,178,0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
              disabled={loading}
            />
          </div>

          {error && <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontWeight: 600 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 22px", display: "flex", gap: "10px" }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ flex: 1, height: "42px", background: "none", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--muted)", fontSize: "13px", fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            style={{ flex: 2, height: "42px", background: loading ? "rgba(91,230,178,0.06)" : "rgba(91,230,178,0.15)", border: "1.5px solid rgba(91,230,178,0.4)", borderRadius: "9px", color: "#5be6b2", fontSize: "13px", fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, transition: "all 0.15s" }}>
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
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, display: "flex", alignItems: "center", gap: "10px", padding: "13px 20px", background: "rgba(17,20,36,0.97)", border: "1.5px solid rgba(91,230,178,0.4)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: "260px" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>{toast}</span>
        </div>
      )}

      <Head title="Player Wallets" sub={loading ? "Loading…" : `${total} player wallets`} />

      {/* Summary cards */}
      {summary && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Balance</div><div className={styles.statValue}>{formatCurrency(summary.totalBalancePaise)}</div><div className={`${styles.statDelta} ${styles.neutral}`}>All player wallets</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Top-ups</div><div className={styles.statValue}>{formatCurrency(summary.totalTopUpPaise)}</div><div className={`${styles.statDelta} ${styles.up}`}>Lifetime recharges</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Spent</div><div className={styles.statValue}>{formatCurrency(summary.totalSpentPaise)}</div><div className={`${styles.statDelta} ${styles.down}`}>Game registrations</div></div>
          <div className={styles.statCard}><div className={styles.statLabel}>Total Refunded</div><div className={styles.statValue}>{formatCurrency(summary.totalRefundedPaise)}</div><div className={`${styles.statDelta} ${styles.neutral}`}>Cancellations</div></div>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.searchInput} placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.actionBtn} type="button" onClick={fetchWallets}>Refresh</button>
      </div>

      {error && <div className={styles.formError}>{error}</div>}
      {loading && <div className={styles.loadingState}>Loading wallets…</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
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
              <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No wallets found.</td></tr>
            )}
            {wallets.map(w => {
              const available = (w.balancePaise || 0) - (w.lockedPaise || 0);
              return (
                <tr key={w._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{w.user?.name || "Unknown"}</div>
                    {w.user?.email && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{w.user.email}</div>}
                  </td>
                  <td>{w.user?.phone || "—"}</td>
                  <td style={{ color: (w.balancePaise || 0) > 0 ? "var(--green)" : "var(--muted)", fontWeight: 600 }}>{formatCurrency(w.balancePaise)}</td>
                  <td style={{ color: (w.lockedPaise || 0) > 0 ? "var(--amber)" : "var(--muted)" }}>{formatCurrency(w.lockedPaise)}</td>
                  <td style={{ color: available > 0 ? "var(--green)" : "var(--muted)", fontWeight: 600 }}>{formatCurrency(available)}</td>
                  <td>{formatCurrency(w.totalTopUpPaise)}</td>
                  <td>{formatCurrency(w.totalSpentPaise)}</td>
                  <td>{formatDate(w.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.actionBtn}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Showing <strong style={{ color: "var(--white)" }}>{(page - 1) * WALLET_PAGE_SIZE + 1}</strong>–
            <strong style={{ color: "var(--white)" }}>{Math.min(page * WALLET_PAGE_SIZE, total)}</strong> of{" "}
            <strong style={{ color: "var(--white)" }}>{total}</strong> wallets
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
            <button style={pagerBtnStyle(page <= 1)} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
            <span style={pagerPillStyle}>Page {page} / {totalPages}</span>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
            <button style={pagerBtnStyle(page >= totalPages)} type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
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
