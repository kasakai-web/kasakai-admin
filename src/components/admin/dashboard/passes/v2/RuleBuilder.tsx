"use client";

/* The rule builder — a row per dimension, "any" by default.
 *
 * A rule is an AND of the clauses set on it; a product is an OR of its rules.
 * That inversion is the whole point of v2: under v1 "weekday + day" meant
 * weekday OR day and was therefore BROADER than either half, so it could never
 * be priced below its own components. Here two clauses narrow each other, and a
 * genuine either/or is expressed by adding a second rule.
 *
 * Nothing here validates. The server owns every rule (utils/passRules.js) and
 * the preview panel beside this one runs the real engine over real games. */

import { Rule, FIELD, FIELD_LABEL, BTN, toPaise, toRs } from "./shared";
import { MetroCityPicker, TurfPicker } from "./RulePickers";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"];

const CHIP =
  "cursor-pointer rounded-md border px-[10px] py-[4px] font-mono text-[11px] tracking-[0.04em]";
const CHIP_OFF = "border-border-2 bg-transparent text-muted hover:border-[#555]";
const CHIP_ON = "border-fg bg-fg text-black";

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`} onClick={onClick}>
      {label}
    </button>
  );
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const current = list || [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  // An empty clause is DROPPED rather than stored empty, so "no constraint" and
  // "constrained to nothing" can never be confused.
  return next.length ? next : undefined;
}

/** Comma-separated ids or slugs → a list, and back. */
const parseList = (raw: string): string[] | undefined => {
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
};
const showList = (list?: string[]) => (list || []).join(", ");

export function RuleBuilder({
  rule,
  index,
  total,
  onChange,
  onRemove,
}: {
  rule: Rule;
  index: number;
  total: number;
  onChange: (next: Rule) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch });
  const clauses = Object.keys(rule).length;

  return (
    <div className="rounded-[10px] border border-border-2 bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Rule {index + 1}
          {clauses === 0 && " · any game"}
          {index > 0 && <span className="ml-2 text-[#60a5fa]">OR</span>}
        </span>
        {total > 1 && (
          <button type="button" className={BTN} onClick={onRemove}>Remove</button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* ── When ── */}
        <div>
          <label className={FIELD_LABEL}>Days</label>
          <div className="flex flex-wrap gap-[6px]">
            <Chip
              on={rule.dayType?.includes("weekday") || false}
              label="Weekdays"
              onClick={() => set({ dayType: toggle(rule.dayType, "weekday") })}
            />
            <Chip
              on={rule.dayType?.includes("weekend") || false}
              label="Weekends"
              onClick={() => set({ dayType: toggle(rule.dayType, "weekend") })}
            />
            <span className="mx-1 self-center text-[11px] text-muted">or pick days:</span>
            {WEEKDAYS.map((d, i) => (
              <Chip
                key={d}
                on={rule.weekdays?.includes(i) || false}
                label={d}
                onClick={() => set({ weekdays: toggle(rule.weekdays, i) })}
              />
            ))}
          </div>
        </div>

        {/* ── Time of day ── */}
        <div>
          <label className={FIELD_LABEL}>
            Kick-off between (a window may cross midnight — 22:00 to 02:00 is a real night slot)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              className={`${FIELD} w-[120px]`}
              value={rule.timeWindows?.[0]?.from || ""}
              onChange={(e) => {
                const from = e.target.value;
                const to = rule.timeWindows?.[0]?.to || "";
                set({ timeWindows: from && to ? [{ from, to }] : undefined });
              }}
            />
            <span className="text-[12px] text-muted">to</span>
            <input
              type="time"
              className={`${FIELD} w-[120px]`}
              value={rule.timeWindows?.[0]?.to || ""}
              onChange={(e) => {
                const to = e.target.value;
                const from = rule.timeWindows?.[0]?.from || "";
                set({ timeWindows: from && to ? [{ from, to }] : undefined });
              }}
            />
            {rule.timeWindows?.length ? (
              <button type="button" className={BTN} onClick={() => set({ timeWindows: undefined })}>
                Any time
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Where ──
            Picked from the real registries rather than typed. A mistyped slug
            or a mis-pasted venue id does not fail loudly — the rule saves and
            the preview reports zero matches, which looks exactly like a city
            that simply has no games this month.

            One control per value, cycling off → include → exclude, because an
            exclusion beats an inclusion in the engine: a value sitting in both
            lists is unrepresentable here rather than merely discouraged. */}
        <MetroCityPicker
          metros={rule.metros}
          metrosExclude={rule.metrosExclude}
          citySlugs={rule.citySlugs}
          citySlugsExclude={rule.citySlugsExclude}
          onChange={(patch) => set(patch as Partial<Rule>)}
        />

        <TurfPicker
          turfs={rule.turfs}
          turfsExclude={rule.turfsExclude}
          onChange={(patch) => set(patch as Partial<Rule>)}
        />

        <div>
          {/* Organisers stay ids for now: there is no small, admin-readable
              organiser list endpoint to pick from, and inventing one for a rule
              dimension nobody has asked for yet is more than this needs. */}
          <label className={FIELD_LABEL}>Organiser ids — only these (optional)</label>
          <input
            className={FIELD}
            value={showList(rule.organisers)}
            onChange={(e) => set({ organisers: parseList(e.target.value) })}
          />
        </div>

        {/* ── What ── */}
        <div>
          <label className={FIELD_LABEL}>Formats</label>
          <div className="flex flex-wrap gap-[6px]">
            {FORMATS.map((f) => (
              <Chip
                key={f}
                on={rule.formats?.includes(f) || false}
                label={f}
                onClick={() => set({ formats: toggle(rule.formats, f) })}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
          <div>
            <label className={FIELD_LABEL}>Fee from (₹)</label>
            <input
              className={FIELD}
              value={toRs(rule.feePaise?.min)}
              onChange={(e) => {
                const min = e.target.value.trim() === "" ? undefined : toPaise(e.target.value);
                const next = { ...(rule.feePaise || {}), min };
                set({ feePaise: next.min == null && next.max == null ? undefined : next });
              }}
            />
          </div>
          <div>
            {/* Both ends inclusive — "up to ₹550" covers a ₹550 game. */}
            <label className={FIELD_LABEL}>Fee up to (₹, inclusive)</label>
            <input
              className={FIELD}
              value={toRs(rule.feePaise?.max)}
              onChange={(e) => {
                const max = e.target.value.trim() === "" ? undefined : toPaise(e.target.value);
                const next = { ...(rule.feePaise || {}), max };
                set({ feePaise: next.min == null && next.max == null ? undefined : next });
              }}
            />
          </div>
          <div>
            {/* Keeps pass holders off the last-minute scramble for a filling
                game — the cannibalisation lever. */}
            <label className={FIELD_LABEL}>Booked at least N hours ahead</label>
            <input
              className={FIELD}
              value={rule.minHoursBefore ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value || 0);
                set({ minHoursBefore: n > 0 ? n : undefined });
              }}
            />
          </div>
        </div>

        <div>
          <label className={FIELD_LABEL}>Visibility</label>
          <div className="flex gap-[6px]">
            <Chip
              on={rule.visibility?.[0] === "public"}
              label="Public games only"
              onClick={() => set({ visibility: rule.visibility?.[0] === "public" ? undefined : ["public"] })}
            />
            <Chip
              on={rule.visibility?.[0] === "private"}
              label="Private games only"
              onClick={() => set({ visibility: rule.visibility?.[0] === "private" ? undefined : ["private"] })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
