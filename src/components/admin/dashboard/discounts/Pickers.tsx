"use client";

/* Pickers for the things a discount names: organisers and games to include or
 * exclude, and the player and game the preview tests against.
 *
 * Organisers and games are SEARCHED rather than typed. A pasted ObjectId that is
 * one character off does not fail loudly — the campaign saves, and quietly
 * applies to nothing — which is the same reason the pass rule builder picks
 * cities and venues from the registries (passes/v2/RulePickers.tsx). Cities and
 * venues are picked with those very components.
 *
 * A picked value cycles off → include → exclude → off, because an exclusion
 * beats an inclusion in the engine and a value in both lists should be
 * unrepresentable rather than merely discouraged. */

import { useEffect, useMemo, useState } from "react";
import { cycleValue } from "../passes/v2/RulePickers";
import {
  adminFetch, rupees, shortDateTime, FIELD, FIELD_LABEL,
  LookupGame, LookupOrganiser, LookupPlayer,
} from "./shared";

const CHIP = "cursor-pointer rounded-md border px-[10px] py-[4px] text-left font-mono text-[11px] tracking-[0.04em]";
const CHIP_ON = "border-fg bg-fg text-black";
const CHIP_EXCLUDE = "border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.12)] text-danger";
const ROW = "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border px-2 py-[7px] text-left text-[12.5px] text-body hover:bg-[rgba(255,255,255,0.04)]";

type Kind = "organisers" | "games";
type Item = { _id: string; label: string; sub?: string };

const toItem = (kind: Kind, row: LookupOrganiser | LookupGame): Item => (
  kind === "games"
    ? {
      _id: row._id,
      label: (row as LookupGame).title || "Game",
      sub: `${shortDateTime((row as LookupGame).scheduledAt)}${(row as LookupGame).turfName ? ` · ${(row as LookupGame).turfName}` : ""} · ${rupees((row as LookupGame).feePaise)}`,
    }
    : { _id: row._id, label: (row as LookupOrganiser).name, sub: (row as LookupOrganiser).phone || undefined }
);

/** Debounced search against one of the discount lookups. */
function useLookup<T>(path: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await adminFetch<T[]>(path);
      if (cancelled) return;
      setRows(res.ok ? res.data || [] : []);
      setLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [path]);
  return { rows: path ? rows : [], loading: path ? loading : false };
}

/**
 * Include / exclude a set of organisers or games. What is picked is shown by
 * NAME, resolved once from the server, so a saved campaign reopens readable.
 */
export function EntityScopePicker({
  kind, title, include, exclude, onChange,
}: {
  kind: Kind;
  title: string;
  include?: string[];
  exclude?: string[];
  onChange: (next: { include?: string[]; exclude?: string[] }) => void;
}) {
  const [q, setQ] = useState("");
  const [labels, setLabels] = useState<Record<string, Item>>({});
  const picked = useMemo(() => [...(include || []), ...(exclude || [])], [include, exclude]);

  // Names for ids we have not seen yet — a campaign opened for editing.
  const unknown = picked.filter((id) => !labels[id]);
  const unknownKey = unknown.join(",");
  useEffect(() => {
    if (!unknownKey) return;
    let cancelled = false;
    (async () => {
      const res = await adminFetch<(LookupOrganiser | LookupGame)[]>(`/admin/discounts/lookup/${kind}?ids=${unknownKey}`);
      if (cancelled || !res.ok) return;
      setLabels((prev) => {
        const next = { ...prev };
        for (const row of res.data || []) next[row._id] = toItem(kind, row);
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [kind, unknownKey]);

  const term = q.trim();
  const searchPath = kind === "games"
    ? `/admin/discounts/lookup/games?q=${encodeURIComponent(term)}`
    : term.length >= 2 ? `/admin/discounts/lookup/organisers?q=${encodeURIComponent(term)}` : null;
  const { rows, loading } = useLookup<LookupOrganiser | LookupGame>(searchPath);
  const results = rows.map((r) => toItem(kind, r)).filter((r) => !picked.includes(r._id)).slice(0, 12);

  const remember = (item: Item) => setLabels((prev) => ({ ...prev, [item._id]: item }));
  const cycle = (id: string) => onChange(cycleValue(id, include, exclude));

  return (
    <div>
      <label className={FIELD_LABEL}>{title} — click a picked one to switch include → exclude → clear</label>
      {picked.length > 0 && (
        <div className="mb-[8px] flex flex-wrap gap-[6px]">
          {picked.map((id) => {
            const state = include?.includes(id) ? "include" : "exclude";
            const item = labels[id];
            return (
              <button
                key={id}
                type="button"
                className={`${CHIP} ${state === "include" ? CHIP_ON : CHIP_EXCLUDE}`}
                onClick={() => cycle(id)}
                title={item?.sub || id}
              >
                {state === "exclude" ? "✕ " : ""}{item?.label || `…${id.slice(-6)}`}
              </button>
            );
          })}
        </div>
      )}
      <input
        className={FIELD}
        placeholder={kind === "games" ? "Search upcoming games by title or venue" : "Search organisers by name (2+ letters)"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {(term || kind === "games") && (
        <div className="mt-[6px] max-h-[200px] overflow-y-auto rounded-md border border-border">
          {loading && <div className="px-2 py-[7px] text-[12px] text-muted">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-2 py-[7px] text-[12px] text-muted">{term ? "Nothing matches that." : "No upcoming games."}</div>
          )}
          {results.map((item) => (
            <button
              key={item._id}
              type="button"
              className={ROW}
              onClick={() => { remember(item); onChange(cycleValue(item._id, include, exclude)); }}
            >
              <span className="min-w-0 truncate">
                {item.label}
                {item.sub && <span className="ml-2 font-mono text-[11px] text-muted">{item.sub}</span>}
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">+ include</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-[6px] text-[11px] text-muted">
        {!(include || []).length && !(exclude || []).length
          ? <span className="text-[#fbbf24]">Every {kind === "games" ? "game" : "organiser"} — nothing picked means no limit on this.</span>
          : (
            <>
              {(include || []).length
                ? <>Only <b className="text-fg">{(include || []).map((id) => labels[id]?.label || "…").join(", ")}</b></>
                : <>Every {kind === "games" ? "game" : "organiser"}</>}
              {(exclude || []).length
                ? <>, except <b className="text-danger">{(exclude || []).map((id) => labels[id]?.label || "…").join(", ")}</b></>
                : null}
            </>
          )}
      </div>
    </div>
  );
}

/** Pick ONE player — the preview's "test for this person". */
export function PlayerPicker({ value, onChange }: { value: LookupPlayer | null; onChange: (p: LookupPlayer | null) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim();
  const { rows, loading } = useLookup<LookupPlayer>(
    term.length >= 2 ? `/admin/discounts/lookup/players?q=${encodeURIComponent(term)}` : null,
  );

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border-2 bg-surface-2 px-3 py-2 text-[13px]">
        <span className="min-w-0 truncate text-fg">
          {value.name}
          <span className="ml-2 font-mono text-[11px] text-muted">
            {value.phone || value.email || ""}{typeof value.gamesPlayed === "number" ? ` · ${value.gamesPlayed} games` : ""}
          </span>
        </span>
        <button type="button" className="font-mono text-[11px] text-muted hover:text-fg" onClick={() => onChange(null)}>change</button>
      </div>
    );
  }

  return (
    <div>
      <input className={FIELD} placeholder="Search a player by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 && (
        <div className="mt-[6px] max-h-[200px] overflow-y-auto rounded-md border border-border">
          {loading && <div className="px-2 py-[7px] text-[12px] text-muted">Searching…</div>}
          {!loading && rows.length === 0 && <div className="px-2 py-[7px] text-[12px] text-muted">No player matches that.</div>}
          {rows.map((p) => (
            <button key={p._id} type="button" className={ROW} onClick={() => onChange(p)}>
              <span className="min-w-0 truncate">{p.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted">{p.phone || p.email || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick ONE upcoming game — the preview's "for this game". */
export function GamePicker({ value, onChange }: { value: LookupGame | null; onChange: (g: LookupGame | null) => void }) {
  const [q, setQ] = useState("");
  const { rows, loading } = useLookup<LookupGame>(`/admin/discounts/lookup/games?q=${encodeURIComponent(q.trim())}`);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border-2 bg-surface-2 px-3 py-2 text-[13px]">
        <span className="min-w-0 truncate text-fg">
          {value.title}
          <span className="ml-2 font-mono text-[11px] text-muted">
            {shortDateTime(value.scheduledAt)}{value.turfName ? ` · ${value.turfName}` : ""} · {rupees(value.feePaise)}
          </span>
        </span>
        <button type="button" className="font-mono text-[11px] text-muted hover:text-fg" onClick={() => onChange(null)}>change</button>
      </div>
    );
  }

  return (
    <div>
      <input className={FIELD} placeholder="Search upcoming games by title or venue" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-[6px] max-h-[200px] overflow-y-auto rounded-md border border-border">
        {loading && <div className="px-2 py-[7px] text-[12px] text-muted">Searching…</div>}
        {!loading && rows.length === 0 && <div className="px-2 py-[7px] text-[12px] text-muted">No upcoming game matches that.</div>}
        {rows.map((g) => (
          <button key={g._id} type="button" className={ROW} onClick={() => onChange(g)}>
            <span className="min-w-0 truncate">{g.title}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted">
              {shortDateTime(g.scheduledAt)} · {rupees(g.feePaise)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
