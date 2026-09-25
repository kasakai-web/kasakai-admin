"use client";

/* Pickers for the rule dimensions that name real things.
 *
 * These four clauses used to be free-text boxes asking an admin to type
 * comma-separated slugs — and, for venues and organisers, raw ObjectIds copied
 * out of the database. A mistyped slug does not fail loudly: the rule saves, the
 * preview quietly reports zero matches, and a pass that covers nothing looks
 * exactly like a pass whose city simply has no games this month.
 *
 * So the options come from the same registries the rest of the platform uses —
 * `GET /turfs/city-options` (which is utils/metro.js, the one place a city is
 * defined) and `GET /turfs/admin/all`. Adding a city to the registry is still
 * the only step needed to offer it here.
 *
 * Both lists are small, cached across mounts, and fetched once: a few dozen
 * venues and a fixed set of metros. Nothing here validates — the engine still
 * owns the rule, and the preview panel beside the builder is what says whether
 * the result matches any real games. */

import { useMemo, useState } from "react";
import { useAdminFetch } from "../../shared/useAdminFetch";
import { FIELD, FIELD_LABEL } from "./shared";

type CityOptions = {
  success: boolean;
  data: {
    metros: { slug: string; label: string; state?: string; cities: { slug: string; label: string }[] }[];
  };
};

type TurfRow = { _id: string; name: string; metro?: string | null; citySlug?: string | null; isActive?: boolean };
type TurfList = { success: boolean; data: TurfRow[] };

const CHIP =
  "cursor-pointer rounded-md border px-[10px] py-[4px] text-left font-mono text-[11px] tracking-[0.04em]";
const CHIP_OFF = "border-border-2 bg-transparent text-muted hover:border-[#555]";
const CHIP_ON = "border-fg bg-fg text-black";
const CHIP_EXCLUDE = "border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.12)] text-danger";

/** off → include → exclude → off. One control for both halves of a dimension. */
export type TriState = "off" | "include" | "exclude";

function Tri({
  label,
  state,
  onCycle,
  title,
}: {
  label: string;
  state: TriState;
  onCycle: () => void;
  title?: string;
}) {
  const cls = state === "include" ? CHIP_ON : state === "exclude" ? CHIP_EXCLUDE : CHIP_OFF;
  return (
    <button type="button" className={`${CHIP} ${cls}`} onClick={onCycle} title={title}>
      {label}
    </button>
  );
}

/**
 * Cycle a value through off → include → exclude → off, returning the next
 * include/exclude pair.
 *
 * An exclusion always beats an inclusion in the engine, so a value must never
 * sit in both lists — cycling rather than offering two checkboxes makes that
 * unrepresentable instead of merely discouraged.
 */
export function cycleValue(
  value: string,
  include: string[] | undefined,
  exclude: string[] | undefined,
): { include?: string[]; exclude?: string[] } {
  const inc = new Set(include || []);
  const exc = new Set(exclude || []);

  if (inc.has(value)) {           // include → exclude
    inc.delete(value);
    exc.add(value);
  } else if (exc.has(value)) {    // exclude → off
    exc.delete(value);
  } else {                        // off → include
    inc.add(value);
  }

  // An empty clause is DROPPED, never stored as [] — "no constraint" and
  // "constrained to nothing" must not look alike to the engine.
  return {
    include: inc.size ? [...inc] : undefined,
    exclude: exc.size ? [...exc] : undefined,
  };
}

const stateOf = (v: string, include?: string[], exclude?: string[]): TriState =>
  include?.includes(v) ? "include" : exclude?.includes(v) ? "exclude" : "off";

/**
 * What the dimension currently means, in words, under the chips.
 *
 * Clicking nothing is not "nothing" — an absent clause is NO CONSTRAINT, so the
 * pass covers every city and every venue. That is the permissive direction and
 * the expensive one to get wrong: an admin who means "Gurugram only" and
 * forgets to click has sold a pass valid everywhere, and neither the save nor
 * the preview complains, because covering everything is perfectly valid.
 *
 * So the effective scope is stated live rather than left to be inferred from
 * which chips happen to be lit.
 */
function ScopeLine({
  include, exclude, labelFor, everything, everythingIsFine = false,
}: {
  include?: string[];
  exclude?: string[];
  labelFor: (value: string) => string;
  everything: string;
  /** Set where selecting nothing is a narrowing the admin already made
   *  elsewhere (the sub-cities of a metro they picked), so it does not need the
   *  warning tint the top-level dimensions get. */
  everythingIsFine?: boolean;
}) {
  const inc = include || [];
  const exc = exclude || [];
  const names = (list: string[]) => list.map(labelFor).join(", ");

  if (!inc.length && !exc.length) {
    return everythingIsFine ? (
      <div className="mt-[6px] text-[11px] text-muted">{everything}.</div>
    ) : (
      <div className="mt-[6px] text-[11px] text-[#fbbf24]">
        {everything} — nothing selected means no limit on this.
      </div>
    );
  }

  return (
    <div className="mt-[6px] text-[11px] text-muted">
      {inc.length ? <>Only <b className="text-fg">{names(inc)}</b></> : <>Everywhere</>}
      {exc.length ? <>, except <b className="text-danger">{names(exc)}</b></> : null}
    </div>
  );
}

// ── Cities ───────────────────────────────────────────────────────────────────

export function MetroCityPicker({
  metros, metrosExclude, citySlugs, citySlugsExclude, onChange,
}: {
  metros?: string[];
  metrosExclude?: string[];
  citySlugs?: string[];
  citySlugsExclude?: string[];
  onChange: (patch: Record<string, string[] | undefined>) => void;
}) {
  const { data } = useAdminFetch<CityOptions>("/turfs/city-options", { cache: true });
  const options = data?.data?.metros || [];
  // Only the metros the admin has actually picked get their cities listed —
  // every sub-city of every metro at once is a wall of chips nobody reads.
  const openMetros = useMemo(
    () => new Set([...(metros || []), ...(metrosExclude || [])]),
    [metros, metrosExclude],
  );

  if (!options.length) return null;

  return (
    <div>
      <label className={FIELD_LABEL}>
        Cities — click once to include, twice to exclude, again to clear
      </label>
      <div className="flex flex-wrap gap-[6px]">
        {options.map((m) => (
          <Tri
            key={m.slug}
            label={m.label}
            title={m.slug}
            state={stateOf(m.slug, metros, metrosExclude)}
            onCycle={() => {
              const next = cycleValue(m.slug, metros, metrosExclude);
              onChange({ metros: next.include, metrosExclude: next.exclude });
            }}
          />
        ))}
      </div>

      <ScopeLine
        include={metros}
        exclude={metrosExclude}
        labelFor={(v) => options.find((m) => m.slug === v)?.label || v}
        everything="Every city"
      />

      {[...openMetros].map((slug) => {
        const metro = options.find((m) => m.slug === slug);
        if (!metro || !metro.cities.length) return null;
        return (
          <div key={slug} className="mt-[10px]">
            <div className="mb-[5px] text-[10px] uppercase tracking-[0.08em] text-muted">
              Narrow {metro.label} to particular cities (optional)
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {metro.cities.map((c) => (
                <Tri
                  key={c.slug}
                  label={c.label}
                  title={c.slug}
                  state={stateOf(c.slug, citySlugs, citySlugsExclude)}
                  onCycle={() => {
                    const next = cycleValue(c.slug, citySlugs, citySlugsExclude);
                    onChange({ citySlugs: next.include, citySlugsExclude: next.exclude });
                  }}
                />
              ))}
            </div>
            {/* "Nothing selected" means something different here than it does
                for the metro row above: the whole metro, which the admin has
                already chosen, rather than everywhere. */}
            <ScopeLine
              include={citySlugs}
              exclude={citySlugsExclude}
              labelFor={(v) => metro.cities.find((c) => c.slug === v)?.label || v}
              everything={`The whole of ${metro.label}`}
              everythingIsFine
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Venues ───────────────────────────────────────────────────────────────────

export function TurfPicker({
  turfs, turfsExclude, onChange,
}: {
  turfs?: string[];
  turfsExclude?: string[];
  onChange: (patch: Record<string, string[] | undefined>) => void;
}) {
  const { data, loading } = useAdminFetch<TurfList>("/turfs/admin/all", { cache: true });
  const [q, setQ] = useState("");

  // Memoised so the filter below does not see a new array identity on every
  // render — `data?.data || []` allocates a fresh [] each time it is falsy.
  const rows = useMemo(() => data?.data || [], [data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const picked = new Set([...(turfs || []), ...(turfsExclude || [])]);
    return rows
      // A chosen venue stays visible whatever the search says, or filtering
      // would hide a selection the admin cannot then see to undo.
      .filter((t) => picked.has(t._id) || !needle || `${t.name} ${t.citySlug || ""}`.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [rows, q, turfs, turfsExclude]);

  return (
    <div>
      <label className={FIELD_LABEL}>
        Venues — click once to include, twice to exclude, again to clear
      </label>
      <input
        className={`${FIELD} mb-[8px]`}
        placeholder={loading ? "Loading venues…" : `Search ${rows.length} venues`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex max-h-[180px] flex-wrap gap-[6px] overflow-y-auto">
        {shown.map((t) => (
          <Tri
            key={t._id}
            label={t.citySlug ? `${t.name} · ${t.citySlug}` : t.name}
            state={stateOf(t._id, turfs, turfsExclude)}
            onCycle={() => {
              const next = cycleValue(t._id, turfs, turfsExclude);
              onChange({ turfs: next.include, turfsExclude: next.exclude });
            }}
          />
        ))}
        {!loading && !shown.length && (
          <span className="text-[11px] text-muted">No venues match that.</span>
        )}
      </div>
      <ScopeLine
        include={turfs}
        exclude={turfsExclude}
        labelFor={(v) => rows.find((t) => t._id === v)?.name || v}
        everything="Every venue"
      />
    </div>
  );
}
