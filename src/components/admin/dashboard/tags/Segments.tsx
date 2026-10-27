"use client";

/* Segments — "who has these tags?"

   Three lists: tags they must ALL have, tags they need at least ONE of, tags
   they must NOT have. A term ending ":*" matches any tag that starts with it
   ("venue:loyal:*" = loyal to any venue). Count shows how many match and a
   sample of 20; Export downloads the full list as CSV with masked phones;
   Save keeps the expression for a campaign to use.

   The server validates every expression — including refusing one with no
   positive term, because "NOT churned" alone matches everyone without that tag,
   accounts that never played included. */

import { useState } from "react";
import {
  TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, BADGE, BADGE_BLUE,
  SUMMARY_VALUE, STAT_LABEL,
} from "../shared/styles";
import { useAdminFetch } from "../shared/useAdminFetch";
import {
  adminFetch, BTN, BTN_PRIMARY, BTN_DANGER, FIELD, FIELD_LABEL, CARD, CHIP, BAND_TONE, WARN_BOX,
  ENTITY_LABEL, ENTITY_ONE, ENTITY_TYPES, shortDate, shortDateTime, downloadText, exportSegmentCsv,
  suggestionsFor,
  type Definitions, type EntityType, type SampleRow, type SavedSegment, type Segment, type SegmentPreview,
} from "./shared";

type Terms = { all: string[]; any: string[]; none: string[] };
const EMPTY: Terms = { all: [], any: [], none: [] };

export type SegmentSeed = {
  segment: Segment;
  preview: SegmentPreview | null;
  error?: string;
  /** The Explorer tag it was built from, for the way back. */
  from?: { entityType: EntityType; key: string };
};

function describe(t: Terms): string {
  const parts = [...t.all];
  if (t.any.length) parts.push(t.any.length === 1 ? t.any[0] : `(${t.any.join(" OR ")})`);
  for (const x of t.none) parts.push(`NOT ${x}`);
  return parts.join(" AND ");
}

export async function previewSegment(segment: Segment) {
  return adminFetch<SegmentPreview>("/admin/tags/segments/preview", { method: "POST", body: JSON.stringify(segment) });
}

function TermBox({ label, hint, terms, onChange, listId, tone }: {
  label: string;
  hint: string;
  terms: string[];
  onChange: (next: string[]) => void;
  listId: string;
  tone: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim().toLowerCase();
    if (v && !terms.includes(v)) onChange([...terms, v]);
    setDraft("");
  };
  return (
    <div className="min-w-[240px] flex-1">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="mb-2 flex gap-2">
        <input
          className={FIELD}
          list={listId}
          value={draft}
          placeholder="Type or pick a tag"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className={BTN} onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      <div className="flex min-h-[28px] flex-wrap gap-[6px]">
        {terms.length === 0 && <span className="text-[12px] text-muted-2">{hint}</span>}
        {terms.map((t) => (
          <span key={t} className={`${CHIP} ${tone}`}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(terms.filter((x) => x !== t))}
              className="cursor-pointer border-none bg-transparent p-0 text-[12px] leading-none text-inherit opacity-70 hover:opacity-100">
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SampleTable({ entityType, rows, onOpen }: {
  entityType: EntityType;
  rows: SampleRow[];
  onOpen: (row: SampleRow) => void;
}) {
  const cols: Record<EntityType, [string, (r: SampleRow) => React.ReactNode][]> = {
    player:    [["Phone", (r) => r.phone || "—"], ["City", (r) => r.city || "—"], ["Joined", (r) => shortDate(r.since)]],
    organiser: [["Phone", (r) => r.phone || "—"], ["Status", (r) => r.status || "—"], ["Joined", (r) => shortDate(r.since)]],
    game:      [["Kick-off", (r) => shortDateTime(r.scheduledAt)], ["Status", (r) => r.status || "—"], ["Venue", (r) => r.venue || "—"]],
    turf:      [["Slug", (r) => r.slug || "— (no slug yet)"], ["Metro", (r) => r.metro || "—"], ["Active", (r) => (r.active ? "yes" : "no")]],
  };
  return (
    <div className={TABLE_WRAP}>
      <table className={TABLE}>
        <thead><tr><th>{ENTITY_ONE[entityType]}</th>{cols[entityType].map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <button type="button" onClick={() => onOpen(r)}
                  className="cursor-pointer border-none bg-transparent p-0 text-left text-info hover:underline">
                  {r.name || r.id}
                </button>
              </td>
              {cols[entityType].map(([h, cell]) => <td key={h}>{cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Segments({ defs, seenKeys, seed, onOpenEntity }: {
  defs: Definitions | null;
  /** Keys seen live or in the last run, per entity type — for the suggestions. */
  seenKeys: Record<EntityType, string[]>;
  /** A segment opened from the explorer, already counted. The page remounts this on a new seed. */
  seed: SegmentSeed | null;
  onOpenEntity: (entityType: EntityType, id: string, name: string) => void;
}) {
  const canManage = Boolean(defs?.canManage);
  const [entityType, setEntityType] = useState<EntityType>(seed?.segment.entityType ?? "player");
  const [terms, setTerms] = useState<Terms>(seed ? { all: seed.segment.all, any: seed.segment.any, none: seed.segment.none } : EMPTY);
  const [result, setResult] = useState<SegmentPreview | null>(seed?.preview ?? null);
  const [countedFor, setCountedFor] = useState<string>(seed?.preview ? JSON.stringify(seed.segment) : "");
  const [error, setError] = useState(seed?.error ?? "");
  const [busy, setBusy] = useState(false);
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const saved = useAdminFetch<{ data: SavedSegment[] }>("/admin/tags/segments", { errorMessage: "Could not load saved segments." });

  const segment: Segment = { entityType, ...terms };
  const stale = result !== null && countedFor !== JSON.stringify(segment);
  const hasPositive = terms.all.length + terms.any.length > 0;
  const listId = `tag-suggestions-${entityType}`;
  const suggestions = suggestionsFor(entityType, defs, seenKeys[entityType] || []);

  const count = async (seg: Segment = segment) => {
    setBusy(true); setError(""); setMsg("");
    const res = await previewSegment(seg);
    setBusy(false);
    if (!res.ok || !res.data) { setError(res.message || "Could not count."); setResult(null); return; }
    setResult(res.data);
    setCountedFor(JSON.stringify(seg));
  };

  const exportCsv = async () => {
    setBusy(true); setError(""); setMsg("");
    const res = await exportSegmentCsv({ ...segment, includeSensitive });
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    downloadText(`segment-${entityType}-${new Date().toISOString().slice(0, 10)}.csv`, res.csv);
    setMsg(`Exported ${res.exported.toLocaleString("en-IN")} ${ENTITY_LABEL[entityType].toLowerCase()}${result && result.count > res.exported ? ` (first ${res.exported.toLocaleString("en-IN")} of ${result.count.toLocaleString("en-IN")})` : ""}.`);
  };

  const save = async () => {
    setBusy(true); setError(""); setMsg("");
    const res = await adminFetch<SavedSegment>("/admin/tags/segments", {
      method: "POST",
      body: JSON.stringify({ ...segment, name, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) { setError(res.message || "Could not save."); return; }
    setMsg(`Saved “${name}” — ${res.data?.lastCount?.toLocaleString("en-IN") ?? 0} match today.`);
    setName(""); setNote("");
    saved.refresh();
  };

  const load = (s: SavedSegment) => {
    const seg: Segment = { entityType: s.entityType, ...s.expr };
    setEntityType(s.entityType);
    setTerms({ ...s.expr });
    count(seg);
  };

  const remove = async (s: SavedSegment) => {
    if (!window.confirm(`Delete the saved segment “${s.name}”? Its tags are not affected.`)) return;
    const res = await adminFetch(`/admin/tags/segments/${s._id}`, { method: "DELETE" });
    if (!res.ok) { setError(res.message || "Could not delete."); return; }
    saved.refresh();
  };

  const savedList = saved.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>

      <div className={CARD}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label>
            <span className={FIELD_LABEL}>Who</span>
            <select className={FIELD} value={entityType}
              onChange={(e) => { setEntityType(e.target.value as EntityType); setTerms(EMPTY); setResult(null); }}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t]}</option>)}
            </select>
          </label>
          <div className="text-[12px] text-muted">
            Changing who you are looking for clears the tags, since each kind has its own.
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <TermBox label="Must have all of" hint="e.g. area:city:whitefield" terms={terms.all} listId={listId}
            tone={BAND_TONE.high} onChange={(all) => setTerms({ ...terms, all })} />
          <TermBox label="And at least one of" hint="e.g. life:lapsing, life:churned" terms={terms.any} listId={listId}
            tone={BAND_TONE.medium} onChange={(any) => setTerms({ ...terms, any })} />
          <TermBox label="And none of" hint="e.g. pass:*" terms={terms.none} listId={listId}
            tone="border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] text-danger" onChange={(none) => setTerms({ ...terms, none })} />
        </div>

        <details className="mt-4 text-[12.5px] text-muted">
          <summary className="cursor-pointer select-none text-muted hover:text-fg">How the three boxes combine</summary>
          <div className="mt-2 flex flex-col gap-[6px] border-l-2 border-border-2 pl-3 leading-[1.55] text-body">
            <div><b>Must have all of</b>: every tag here (AND). <b>At least one of</b>: any one of these (OR). <b>None of</b>: none of these (NOT).</div>
            <div>
              End a tag with <span className="font-mono text-fg">:*</span> to match any value. For example,{" "}
              <span className="font-mono text-fg">venue:loyal:*</span> means loyal to any venue, and{" "}
              <span className="font-mono text-fg">pass:*</span> means any pass tag.
            </div>
            <div>
              Example: all of <span className="font-mono text-fg">area:metro:bengaluru</span>, one of{" "}
              <span className="font-mono text-fg">life:lapsing</span> / <span className="font-mono text-fg">life:churned</span>,
              none of <span className="font-mono text-fg">pass:*</span> finds Bengaluru players going quiet who hold no pass.
            </div>
            <div>
              You need at least one tag in the first two boxes. “None of X” on its own would match everyone without X,
              including people who never played.
            </div>
          </div>
        </details>

        {(terms.all.length + terms.any.length + terms.none.length > 0) && (
          <div className="mt-4 font-mono text-[12.5px] text-body">{describe(terms) || "—"}</div>
        )}
        {!hasPositive && terms.none.length > 0 && (
          <div className={`${WARN_BOX} mt-3`}>
            Add at least one tag they must have. “Not X” on its own would match everyone without X, including people who never played.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={`${BTN} ${BTN_PRIMARY}`} disabled={busy || !hasPositive} onClick={() => count()}>
            {busy ? "Working…" : "Count"}
          </button>
          <button type="button" className={BTN} disabled={busy || !hasPositive} onClick={exportCsv}>Export CSV</button>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={includeSensitive} onChange={(e) => setIncludeSensitive(e.target.checked)} />
            Include sensitive tags (no-show risk, lapsing, low satisfaction…)
          </label>
        </div>

        {canManage && hasPositive && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <label className="min-w-[220px]">
              <span className={FIELD_LABEL}>Save as</span>
              <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Whitefield weekday regulars gone quiet" />
            </label>
            <label className="min-w-[220px] flex-1">
              <span className={FIELD_LABEL}>Note</span>
              <input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — what it is for" />
            </label>
            <button type="button" className={BTN} disabled={busy || !name.trim()} onClick={save}>Save segment</button>
          </div>
        )}

        {error && <div className={`${FORM_ERROR} mt-4`}>{error}</div>}
        {msg && <div className="mt-4 text-[12px] text-[#4ade80]">{msg}</div>}
      </div>

      {result && (
        <div className={CARD}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className={STAT_LABEL}>Matching {ENTITY_LABEL[result.segment.entityType].toLowerCase()}</div>
              <div className={SUMMARY_VALUE}>{result.count.toLocaleString("en-IN")}</div>
            </div>
            <div className="font-mono text-[12px] text-muted">{result.describe}</div>
          </div>
          {stale && <div className={`${WARN_BOX} mb-3`}>The tags above have changed since this count — count again.</div>}
          {result.truncated && <div className={`${WARN_BOX} mb-3`}>Very large segment — lists stop at 50,000.</div>}
          {result.sample.length === 0 ? (
            <div className="text-[13px] text-muted">
              Nobody matches.{defs?.live === false ? " Tagging is in dry-run mode, so no tags exist to match yet." : ""}
            </div>
          ) : (
            <>
              <div className="mb-2 text-[12px] text-muted">
                {result.sample.length < result.count ? `A sample of ${result.sample.length}. Export for everyone.` : "Everyone who matches."} Click a name to open it.
              </div>
              <SampleTable entityType={result.segment.entityType} rows={result.sample}
                onOpen={(r) => onOpenEntity(result.segment.entityType, r.id, r.name)} />
            </>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Saved segments</div>
        {saved.error && <div className={FORM_ERROR}>{saved.error}</div>}
        {saved.loading && !saved.data ? (
          <div className={LOADING_STATE}>Loading…</div>
        ) : savedList.length === 0 ? (
          <div className="border border-border bg-surface px-4 py-3 text-[13px] text-muted">No saved segments yet.</div>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead><tr><th>Name</th><th>Who</th><th>Tags</th><th>Last count</th><th></th></tr></thead>
              <tbody>
                {savedList.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="text-fg">{s.name}</div>
                      {s.note && <div className="mt-[2px] text-[12px] text-muted">{s.note}</div>}
                      <div className="mt-[2px] text-[11px] text-muted-2">by {s.createdBy?.name || "an admin"} · {shortDate(s.createdAt)}</div>
                    </td>
                    <td><span className={`${BADGE} ${BADGE_BLUE}`}>{ENTITY_LABEL[s.entityType]}</span></td>
                    <td className="max-w-[360px] font-mono text-[12px]!">{describe(s.expr)}</td>
                    <td className="font-mono">
                      {s.lastCount?.toLocaleString("en-IN") ?? "—"}
                      <div className="text-[11px] text-muted">{shortDate(s.lastCountedAt)}</div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button type="button" className={BTN} onClick={() => load(s)}>Open</button>
                        {canManage && <button type="button" className={`${BTN} ${BTN_DANGER}`} onClick={() => remove(s)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
