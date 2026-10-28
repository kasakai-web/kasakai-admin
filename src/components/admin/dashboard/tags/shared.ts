// Shared bits for the behaviour-tag screens.
//
// Nothing about what a tag MEANS lives here. Every tag, its rule, its evidence
// and whether a segment is allowed are the SERVER's answers
// (utils/tagRules.js); these screens render what comes back. The fetch wrapper
// and button atoms are the pass screens' own — one set of them is enough.

import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "../passes/v2/shared";

export {
  adminFetch, API_BASE, BTN, BTN_PRIMARY, BTN_DANGER, FIELD, FIELD_LABEL, CARD, ERROR_BOX, WARN_BOX,
  shortDate, shortDateTime, rupees,
} from "../passes/v2/shared";
export { downloadText } from "../discounts/shared";

export type EntityType = "player" | "game" | "organiser" | "turf";

export const ENTITY_LABEL: Record<EntityType, string> = {
  player: "Players",
  game: "Games",
  organiser: "Organisers",
  turf: "Venues",
};
export const ENTITY_ONE: Record<EntityType, string> = {
  player: "player",
  game: "game",
  organiser: "organiser",
  turf: "venue",
};
export const ENTITY_TYPES: EntityType[] = ["player", "game", "organiser", "turf"];

/** The long form of a rule, written by the server from its own thresholds. */
export type ExplainView = {
  title: string;
  meaning: string;
  earned: string;
  /** When a held tag is lost. */
  kept: string;
  looksAt?: string | null;
  needs?: string | null;
  onlyOne?: string | null;
  example?: string | null;
  note?: string | null;
};
export type Explain = ExplainView & {
  /** Overrides for a definition shared by several kinds — a game's metro is not "where most games were". */
  byEntity?: Partial<Record<EntityType, Partial<ExplainView>>>;
};

export type Definition = {
  id: string;
  def: string;
  version: number;
  entities: EntityType[];
  key: string;
  rule: string;
  sensitive: boolean;
  informational: boolean;
  explain: Explain | null;
};

export type TimeBand = { key: string; label: string; fromHour: number; toHour: number };

/** The few thresholds the "How tags work" guide quotes. The server sends them all. */
export type Thresholds = {
  WINDOW_DAYS: number;
  HABIT_GAMES: number;
  HABIT_DAYS: number;
  RELIABILITY_DAYS: number;
  venueLoyal: { min: number; in: number; out: number };
};

export type Definitions = {
  canManage: boolean;
  live: boolean;
  defsVersion: string;
  namespaces: string[];
  namespaceLabels?: Record<string, string>;
  timeBands?: TimeBand[];
  thresholds?: Thresholds;
  manualTags: { key: string; label: string }[];
  definitions: Definition[];
};

export type ExplorerRow = {
  entityType: EntityType;
  key: string;
  namespace: string;
  count: number;
  gained30d: number;
  lost30d: number;
  source: "rule" | "manual" | "ai";
  def: string | null;
  rule: string | null;
  sensitive: boolean;
  informational: boolean;
};

export type Band = "low" | "medium" | "high";

export type TagRow = {
  _id: string;
  key: string;
  namespace: string;
  source: "rule" | "manual" | "ai";
  status: "active" | "expired" | "removed" | "suppressed";
  def: string | null;
  rule: string | null;
  sensitive: boolean;
  informational: boolean;
  confidence: Band | null;
  evidence: Record<string, unknown>;
  firstTaggedAt?: string | null;
  lastConfirmedAt?: string | null;
  endedAt?: string | null;
  expiresAt?: string | null;
  addedBy?: { _id: string; name?: string | null } | null;
  endedBy?: { _id: string; name?: string | null } | null;
  suppressedBy?: { _id: string; name?: string | null } | null;
  suppressedAt?: string | null;
  note?: string | null;
};

export type EntityTags = { live: TagRow[]; history: TagRow[] };

export type Segment = { entityType: EntityType; all: string[]; any: string[]; none: string[] };

export type SampleRow = {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  since?: string;
  status?: string;
  scheduledAt?: string;
  venue?: string;
  slug?: string | null;
  metro?: string;
  active?: boolean;
  /** The entity's live tags. */
  tags?: string[];
};

export type SegmentPreview = {
  segment: Segment;
  describe: string;
  count: number;
  truncated: boolean;
  /** The requested page of who matches (named "sample" from when it was only ever the first 20). */
  sample: SampleRow[];
  page?: number;
  pageSize?: number;
  pages?: number;
};

export type SavedSegment = {
  _id: string;
  name: string;
  entityType: EntityType;
  expr: { all: string[]; any: string[]; none: string[] };
  note?: string | null;
  createdBy?: { _id: string; name?: string | null } | null;
  lastCount?: number | null;
  lastCountedAt?: string | null;
  createdAt?: string;
};

export type RunCounts = {
  entities: number;
  added: number;
  kept: number;
  expired: number;
  failed: number;
  byKey: Record<string, number>;
};

export type TagRun = {
  _id: string;
  runKey: string;
  trigger: "schedule" | "manual";
  dryRun: boolean;
  status: "running" | "done" | "failed" | "abandoned";
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  defsVersion?: string | null;
  counts?: Partial<Record<EntityType, RunCounts>>;
  cohortCuts?: Record<string, unknown>;
  skipped?: { turfsWithoutSlug?: number };
  manualExpired?: number;
  errorLog?: string[];
  startedBy?: { _id?: string; name?: string | null } | null;
};

// ── Presentation ─────────────────────────────────────────────────────────────

export const BAND_TONE: Record<Band, string> = {
  high: "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] text-success",
  medium: "border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.08)] text-info",
  low: "border-border-2 bg-[rgba(255,255,255,0.04)] text-muted",
};
export const MANUAL_TONE = "border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.1)] text-violet";
export const SENSITIVE_TONE = "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] text-warning";
export const SUPPRESSED_TONE = "border-border-2 bg-transparent text-muted-2 line-through";

export const CHIP = "inline-flex items-center gap-[6px] rounded-[4px] border px-2 py-[3px] font-mono text-[11.5px]";

/** The chip colour for a live tag: suppressed, manual, sensitive, then confidence. */
export function toneFor(t: Pick<TagRow, "status" | "source" | "sensitive" | "confidence">): string {
  if (t.status === "suppressed") return SUPPRESSED_TONE;
  if (t.source === "manual") return MANUAL_TONE;
  if (t.sensitive) return SENSITIVE_TONE;
  return BAND_TONE[t.confidence || "low"];
}

const PERCENT_KEYS = /share|change|fill$/i;
const words = (k: string) => k.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();

function evidenceValue(key: string, v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    if (key === "cuts" || key.endsWith("Cuts")) return v.map((x) => (typeof x === "number" ? `₹${Math.round(x / 100)}` : String(x))).join(" / ");
    return `${v.length}`;
  }
  if (typeof v === "number") {
    if (/paise$/i.test(key)) return `₹${Math.round(v / 100).toLocaleString("en-IN")}`;
    if (PERCENT_KEYS.test(key) && Math.abs(v) <= 1) return `${Math.round(v * 100)}%`;
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return v;
  }
  return null;
}

/** "games 9 · at turf 8 · share 89% · window last 9 games" */
export function describeEvidence(ev: Record<string, unknown> | null | undefined): string {
  if (!ev) return "";
  return Object.entries(ev)
    .map(([k, v]) => {
      const shown = evidenceValue(k, v);
      return shown == null ? null : `${words(k.replace(/Paise$/, ""))} ${shown}`;
    })
    .filter(Boolean)
    .join(" · ");
}

/** The co-players a social:squad row names, by id — the only list evidence carries. */
export const squadIds = (ev: Record<string, unknown>) =>
  Array.isArray(ev?.coPlayers) ? (ev.coPlayers as { id: string; games: number }[]) : [];

/**
 * Keys an admin can type in a segment, for one entity type: every key seen live
 * or in the last run, the manual list, and a "prefix:*" form of every
 * definition whose key ends in a placeholder ("venue:loyal:*").
 */
export function suggestionsFor(entityType: EntityType, defs: Definitions | null, seen: string[]): string[] {
  const out = new Set<string>(seen);
  for (const m of defs?.manualTags ?? []) out.add(m.key);
  for (const d of defs?.definitions ?? []) {
    if (!d.entities.includes(entityType)) continue;
    for (const alt of d.key.split(/\|(?![^<]*>)/)) {
      if (!alt.includes("<")) out.add(alt);
      else if (/<[^>]+>$/.test(alt)) out.add(alt.replace(/<[^>]+>$/, "*"));
    }
  }
  return [...out].sort();
}

/**
 * The definition a key comes from — for keys known only from a run's counts,
 * which carry no rule text. Same matching as the server's defForKey: literal
 * keys first, a placeholder matches one hyphenated word.
 */
export function definitionFor(entityType: EntityType, key: string, defs: Definitions | null): Definition | null {
  const list = (defs?.definitions ?? [])
    .filter((d) => d.entities.includes(entityType))
    .sort((a, b) => (a.key.match(/</g) || []).length - (b.key.match(/</g) || []).length);
  for (const d of list) {
    const alts = d.key.replace(/<[^>]+>/g, "\u0000").split("|");
    const re = new RegExp(`^(?:${alts
      .map((a) => a.replace(/[.*+?^${}()[\]\\]/g, "\\$&").replace(/\u0000/g, "[a-z0-9-]+"))
      .join("|")})$`);
    if (re.test(key)) return d;
  }
  return null;
}

/** A definition's explanation for one kind of entity, with that kind's overrides applied. */
export function explainFor(d: Definition | null | undefined, entityType: EntityType): ExplainView | null {
  if (!d?.explain) return null;
  const { byEntity, ...base } = d.explain;
  return { ...base, ...(byEntity?.[entityType] ?? {}) };
}

/** An explorer row joined with what the last run counted, and the definition behind it. */
export type ExplorerTableRow = ExplorerRow & {
  lastRun: number | null;
  lastRunShare: number | null;
  definition: Definition | null;
};

/**
 * Every key worth a row: live ones from the explorer, plus keys only the last
 * run counted — during the dry-run weeks, that is all of them.
 */
export function explorerRows(explorer: ExplorerRow[] | null, lastRun: TagRun | null, defs: Definitions | null): ExplorerTableRow[] {
  const out = new Map<string, ExplorerTableRow>();
  for (const r of explorer ?? []) {
    out.set(`${r.entityType}|${r.key}`, { ...r, lastRun: null, lastRunShare: null, definition: definitionFor(r.entityType, r.key, defs) });
  }
  if (lastRun) {
    for (const t of ENTITY_TYPES) {
      const counts = lastRun.counts?.[t];
      if (!counts) continue;
      for (const [key, n] of Object.entries(counts.byKey || {})) {
        const id = `${t}|${key}`;
        const share = counts.entities ? n / counts.entities : null;
        const existing = out.get(id);
        if (existing) { existing.lastRun = n; existing.lastRunShare = share; continue; }
        const d = definitionFor(t, key, defs);
        out.set(id, {
          entityType: t, key, namespace: key.split(":")[0], count: 0, gained30d: 0, lost30d: 0,
          source: "rule", def: d?.def ?? null, rule: d?.rule ?? null,
          sensitive: !!d?.sensitive, informational: !!d?.informational,
          lastRun: n, lastRunShare: share, definition: d,
        });
      }
    }
  }
  return [...out.values()];
}

export const pct = (x: number | null) => (x == null ? "" : `${x < 0.01 && x > 0 ? "<1" : Math.round(x * 100)}%`);

/** POST a segment for CSV and hand back the text — the one endpoint that is not JSON. */
export async function exportSegmentCsv(
  body: Segment & { includeSensitive?: boolean },
): Promise<{ ok: true; csv: string; exported: number } | { ok: false; message: string }> {
  const token = getAdminToken();
  if (!token) return { ok: false, message: "Admin session missing." };
  try {
    const res = await fetch(`${API_BASE}/admin/tags/segments/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err?.message || "Export failed." };
    }
    // Counted from the file itself: the API's X-Segment-* headers are not
    // exposed by its CORS setup, so a browser on another origin cannot read them.
    const csv = await res.text();
    return { ok: true, csv, exported: Math.max(0, csv.split("\n").length - 1) };
  } catch {
    return { ok: false, message: "Cannot reach the server." };
  }
}
