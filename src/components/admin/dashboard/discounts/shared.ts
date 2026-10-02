// Shared bits for the discount screens.
//
// Every rule question — does an offer apply, what does it take off, may this be
// saved — is answered by the SERVER (utils/discountRules.js). These screens send
// a draft and render what comes back, the same discipline the pass catalogue
// follows, so the form and the till can never drift apart.
//
// The fetch wrapper, buttons and money helpers are the pass screens' own; one
// set of them is enough.

import { adminFetch } from "../passes/v2/shared";

export {
  adminFetch, rupees, toPaise, toRs, shortDate, shortDateTime,
  API_BASE, BTN, BTN_PRIMARY, BTN_DANGER, FIELD, FIELD_LABEL, CARD, ERROR_BOX, WARN_BOX,
} from "../passes/v2/shared";

export type CampaignType = "general" | "first_game";
export type Trigger = "auto" | "code";
export type CodeMode = "shared" | "unique";
export type StoredStatus = "draft" | "live" | "paused" | "archived";
export type DisplayState = "draft" | "scheduled" | "active" | "paused" | "exhausted" | "expired" | "archived";

export type Scope = {
  metros?: string[];
  metrosExclude?: string[];
  citySlugs?: string[];
  citySlugsExclude?: string[];
  turfs?: string[];
  turfsExclude?: string[];
  organisers?: string[];
  organisersExclude?: string[];
  games?: string[];
  gamesExclude?: string[];
};

export type Campaign = {
  _id: string;
  name: string;
  description?: string;
  title: string;
  terms?: string;
  type: CampaignType;
  trigger: Trigger;
  /** "shared": a code the admin typed (FIRST50). "unique": generated from the
   *  admin's first name (UJJWAL3R4EW), with a set number of uses. Both are
   *  stored in plain text in `code`. */
  codeMode: CodeMode;
  code?: string | null;
  benefit: { mode: "flat" | "percent"; flatPaise: number; percent: number; capPaise: number };
  scope: Scope;
  timing: { startsAt: string | null; endsAt: string | null; gameFrom: string | null; gameTo: string | null };
  limits: { perPlayer: number; perGame: number; totalUses: number; budgetPaise: number };
  /** Always KasaKai — the platform bears every discount. */
  funding: { model: "platform"; note?: string };
  priority: number;
  status: StoredStatus;
  /** "uses_spent" when the campaign archived itself — every use was spent. */
  archiveReason?: "manual" | "uses_spent" | null;
  version: number;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
  usage?: { uses: number; spentPaise: number };
  state?: DisplayState;
  described?: Described;
  stats?: CampaignStats | null;
};

export type Described = {
  title: string;
  terms: string | null;
  savingText: string;
  conditions: string[];
};

export type CampaignStats = {
  held: number;
  consumed: number;
  released: number;
  returned: number;
  discountGivenPaise: number;
  heldPaise: number;
  players: number;
};

export type Validation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  described: Described;
  example: { feePaise: number; savingPaise: number; payablePaise: number };
};

export type ScopePreview = {
  windowDays: number;
  gamesConsidered: number;
  gamesMatched: number;
  gamesMadeFree: number;
  byMetro: Record<string, number>;
  maxCostPaise: number | null;
  games: {
    _id: string; title?: string; scheduledAt: string; feePaise: number;
    savingPaise: number; payablePaise: number; turfName?: string | null;
    organiserName?: string | null; metro?: string | null;
  }[];
};

export type PreviewResult = {
  campaignId: string;
  name: string;
  title: string;
  trigger: Trigger;
  code: string | null;
  isDraft: boolean;
  eligible: boolean;
  reason: string;
  reasonText: string | null;
  scopeMiss: string | null;
  savingPaise: number;
  payablePaise: number;
};

export type BookingPreview = {
  game: { _id: string; title?: string; scheduledAt: string; status: string; feePaise: number; turfName?: string | null };
  player: { _id: string; name: string; isNew: boolean; firstGameUsed: boolean; alreadyIn: boolean };
  pass: { covered: boolean; name: string | null; payablePaise: number };
  applied: PreviewResult | null;
  payablePaise: number;
  results: PreviewResult[];
};

export type Redemption = {
  _id: string;
  state: "held" | "consumed" | "released" | "returned";
  source: "auto" | "code";
  codeText?: string | null;
  basePaise: number;
  savingPaise: number;
  paidPaise: number;
  fundedBy: string;
  campaignVersion: number;
  createdAt: string;
  releaseReason?: string | null;
  terms?: { title?: string | null };
  player?: { _id: string; name: string; phone?: string } | null;
  game?: { _id: string; title?: string; scheduledAt?: string } | null;
  campaign?: { _id: string; name: string; title: string } | null;
};

export type AuditRow = {
  _id: string;
  action: string;
  actorName?: string | null;
  actorRole?: string | null;
  version: number;
  note?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

export type CampaignDetail = Campaign & {
  attendance: { bookings: number; attended: number; cancelled: number };
  perGame: { _id: string; uses: number; savingPaise: number; title?: string; scheduledAt?: string; status?: string; feeInPaise?: number }[];
  audit: AuditRow[];
};

export type LookupPlayer = { _id: string; name: string; phone?: string | null; email?: string | null; gamesPlayed?: number };
export type LookupGame = { _id: string; title: string; scheduledAt: string; feePaise: number; status: string; turfName?: string | null };
export type LookupOrganiser = { _id: string; name: string; phone?: string | null };

// ── Labels ────────────────────────────────────────────────────────────────────

export const STATE_TONE: Record<DisplayState, string> = {
  draft:     "border-border-2 text-muted",
  scheduled: "border-[rgba(96,165,250,0.35)] text-[#60a5fa]",
  active:    "border-[rgba(74,222,128,0.35)] text-[#4ade80]",
  paused:    "border-[rgba(251,191,36,0.35)] text-[#fbbf24]",
  exhausted: "border-[rgba(251,146,60,0.35)] text-[#fb923c]",
  expired:   "border-border-2 text-muted",
  archived:  "border-[rgba(239,68,68,0.3)] text-danger",
};

export const TYPE_LABEL: Record<CampaignType, string> = {
  general:    "General",
  first_game: "First game",
};

export const REDEMPTION_TONE: Record<Redemption["state"], string> = {
  held:     "text-[#60a5fa]",
  consumed: "text-[#4ade80]",
  released: "text-muted line-through",
  returned: "text-[#fbbf24]",
};

/** An ISO instant as the value a `datetime-local` input wants, in IST. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // IST is a fixed +05:30 with no DST, so shifting the instant and reading
  // its UTC fields gives the IST wall clock regardless of the browser's zone.
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

/** A `datetime-local` value, read as IST wall-clock time, back to an ISO instant. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}:00+05:30`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const emptyCampaign = (): Campaign => ({
  _id: "",
  name: "",
  description: "",
  title: "",
  terms: "",
  type: "general",
  trigger: "auto",
  codeMode: "shared",
  code: "",
  benefit: { mode: "flat", flatPaise: 5000, percent: 10, capPaise: 5000 },
  scope: {},
  timing: { startsAt: null, endsAt: null, gameFrom: null, gameTo: null },
  limits: { perPlayer: 1, perGame: 0, totalUses: 0, budgetPaise: 0 },
  funding: { model: "platform", note: "" },
  priority: 0,
  status: "draft",
  version: 1,
});

/** The body create / update / validate / preview all post — exactly the editable fields. */
export function payloadOf(c: Campaign) {
  return {
    _id: c._id || undefined,
    name: c.name,
    description: c.description,
    title: c.title,
    terms: c.terms,
    type: c.type,
    trigger: c.trigger,
    codeMode: c.codeMode,
    code: c.trigger === "code" ? c.code : null,
    benefit: c.benefit,
    scope: c.scope,
    timing: c.timing,
    limits: c.limits,
    funding: c.funding,
    priority: c.priority,
  };
}

/**
 * A fresh code made from the signed-in admin's first name (UJJWAL3R4EW) that no
 * campaign holds yet. The server makes it — the name, the alphabet and the clash
 * check all live there.
 */
export async function generateCode(): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  const res = await adminFetch<{ code: string }>("/admin/discounts/generate-code", { method: "POST" });
  if (!res.ok || !res.data?.code) return { ok: false, message: res.message || "Could not generate a code." };
  return { ok: true, code: res.data.code };
}

/** "7 of 10 uses" — how far a capped campaign has gone. Null when uncapped. */
export function usesLabel(c: Pick<Campaign, "limits" | "usage">): string | null {
  const cap = c.limits?.totalUses || 0;
  if (!cap) return null;
  return `${c.usage?.uses || 0} of ${cap} use${cap === 1 ? "" : "s"}`;
}

/** Save a CSV string as a download — the ledger export. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
