// Shared bits for the pass catalogue screens.
//
// Every rule question — what a pass covers, what it is worth, whether the
// product is valid — is answered by the SERVER (utils/passRules.js). These
// screens send a draft and render what comes back. Duplicating the engine here
// would only give the two a way to drift, which is the same reason the recharge
// offer panel validates nowhere but the server.

import { getAdminToken } from "@/lib/admin-session";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1";

export const BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
export const BTN_PRIMARY = "border-fg! bg-fg! text-black!";
export const BTN_DANGER = "border-[rgba(239,68,68,0.35)]! text-danger!";
export const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
export const FIELD_LABEL =
  "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";
export const CARD = "rounded-[14px] border border-border bg-surface p-5";
export const ERROR_BOX =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
export const WARN_BOX =
  "rounded-md border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.08)] px-[14px] py-[10px] text-[12px] text-[#fbbf24]";

export const rupees = (paise: number | null | undefined) =>
  `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;
export const toPaise = (rs: string) => Math.round(Number(rs || 0) * 100);
export const toRs = (paise: number | null | undefined) =>
  paise ? String(Math.round(paise) / 100) : "";

export const shortDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
      })
    : "—";

export const shortDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";

/** One fetch wrapper, so every screen reports a missing session the same way. */
export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; data?: T; message?: string; details?: string[] }> {
  const token = getAdminToken();
  if (!token) return { ok: false, message: "Admin session missing." };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { ok: false, message: body?.message || "Request failed.", details: body?.details || undefined };
    }
    return { ok: true, data: body?.data as T };
  } catch {
    return { ok: false, message: "Cannot reach the server." };
  }
}

// ── The shapes the server sends ───────────────────────────────────────────────

export type Rule = {
  weekdays?: number[];
  dayType?: ("weekday" | "weekend")[];
  timeWindows?: { from: string; to: string }[];
  daysOfMonth?: { from: number; to: number };
  metros?: string[];
  metrosExclude?: string[];
  citySlugs?: string[];
  citySlugsExclude?: string[];
  turfs?: string[];
  turfsExclude?: string[];
  organisers?: string[];
  organisersExclude?: string[];
  communities?: string[];
  formats?: string[];
  feePaise?: { min?: number; max?: number };
  visibility?: ("public" | "private")[];
  minHoursBefore?: number;
};

export type Benefit = {
  mode: "free" | "flat" | "percent" | "capped_free";
  amountPaise?: number;
  percent?: number;
  maxBenefitPaise?: number;
  coverUptoPaise?: number;
  coversGuests?: number;
};

export type Limits = {
  maxRedemptions: number;
  maxBenefitPaise: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  maxPerTurf: number;
  maxPerOrganiser: number;
};

export type Validity = {
  mode: "fixed_days" | "calendar_month" | "half_month" | "absolute";
  days?: number;
  monthAnchor?: "current" | "next";
  half?: 1 | 2;
  startsAt?: string | null;
  endsAt?: string | null;
  activationMode: "on_issue" | "on_first_use" | "on_date";
};

export type Described = {
  benefitText: string;
  scopeText: string;
  summary: string;
  expiresText: string;
};

export type ProductStats = {
  issued: number; live: number; paid: number; revenuePaise: number;
  redemptions: number; benefitPaise: number; reimbursementPaise: number;
  playerCount: number; valueRatio: number | null;
};

export type Product = {
  _id: string;
  code: string;
  name: string;
  subtitle?: string;
  description?: string;
  /** Selling points for the public /passes page, one per bullet. */
  highlights?: string[];
  status: "draft" | "active" | "paused" | "retired";
  deprecated?: boolean;
  pricePaise: number;
  purchasable: boolean;
  grantable: boolean;
  validity: Validity;
  benefit: Benefit;
  limits: Limits;
  rules: Rule[];
  funding: { model: "organiser" | "platform" | "shared"; organiserSharePercent: number };
  inventory?: { maxIssued: number; issuedCount: number; maxPerPlayer: number };
  described?: Described;
  stats?: ProductStats | null;
  createdAt?: string;
};

export type Preview = {
  windowDays: number;
  gamesConsidered: number;
  gamesMatched: number;
  byMetro: Record<string, number>;
  feeRangePaise: { min: number | null; max: number | null };
  totalSeatValuePaise: number;
  worstCaseBenefitPaise: number;
  games: {
    _id: string; title?: string; scheduledAt: string; feePaise: number;
    format?: string; turfName?: string | null; organiserName?: string | null;
    metro?: string | null; benefitPaise: number;
  }[];
};

export const STATUS_TONE: Record<string, string> = {
  active: "text-[#4ade80]",
  draft: "text-muted",
  paused: "text-[#fbbf24]",
  retired: "text-danger",
  pending: "text-[#60a5fa]",
  exhausted: "text-[#fbbf24]",
  expired: "text-muted",
  revoked: "text-danger",
  refunded: "text-danger",
};

export const emptyRule = (): Rule => ({});

export const emptyProduct = (): Product => ({
  _id: "",
  code: "",
  name: "",
  subtitle: "",
  description: "",
  highlights: [],
  status: "draft",
  pricePaise: 0,
  purchasable: false,
  grantable: true,
  validity: { mode: "fixed_days", days: 30, activationMode: "on_issue" },
  benefit: { mode: "free", coversGuests: 0 },
  limits: {
    maxRedemptions: 0, maxBenefitPaise: 0, maxPerDay: 0,
    maxPerWeek: 0, maxPerMonth: 0, maxPerTurf: 0, maxPerOrganiser: 0,
  },
  // An unconditional pass must SAY so: one empty rule means "any game", and the
  // server refuses a product with no rules at all rather than inferring it.
  rules: [{}],
  funding: { model: "organiser", organiserSharePercent: 0 },
});
