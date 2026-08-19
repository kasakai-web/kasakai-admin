/* Display formatters shared by every dashboard section. All date output is
   rendered in IST — the calendar the platform actually runs on. */

import {
  BADGE_GREEN, BADGE_AMBER, BADGE_RED, BADGE_BLUE, BADGE_VIOLET, BADGE_GRAY,
} from "./styles";

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatCurrency(paise?: number) {
  if (typeof paise !== "number") return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatStatusLabel(status?: string) {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function badgeClassForStatus(status?: string) {
  const v = (status || "").toLowerCase();
  if (["active", "approved", "verified", "present", "paid", "success"].includes(v)) return BADGE_GREEN;
  if (["pending", "in review", "review", "draft", "waiting", "notified"].includes(v)) return BADGE_AMBER;
  if (["suspended", "rejected", "inactive", "banned", "cancelled", "forfeited", "no_show", "failed"].includes(v)) return BADGE_RED;
  if (["confirmed", "open"].includes(v)) return BADGE_BLUE;
  if (["completed"].includes(v)) return BADGE_VIOLET;
  return BADGE_GRAY;
}

// "3 days ago" / "today" for whole-day counts coming from the API.
export function daysAgoLabel(days?: number | null) {
  if (days == null) return "—";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

// Colour cue for how stale a user's last game is — drives the dormant-user scan.
export function stalenessClass(days?: number | null) {
  if (days == null) return "text-danger";   // never played
  if (days <= 30) return "text-success";
  if (days <= 90) return "text-warning";
  return "text-danger";
}

export function starRating(rating?: number | null) {
  if (rating == null) return "—";
  const full = Math.min(Math.round(rating), 5);
  return "★".repeat(full) + "☆".repeat(5 - full) + ` ${rating.toFixed(1)}`;
}

export function notifTimeAgo(iso: string): string {
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

export function surfaceLabel(s: string) {
  return ({ natural_grass: "Natural", artificial_turf: "Artificial", concrete: "Concrete", indoor: "Indoor" } as Record<string, string>)[s] ?? s;
}
