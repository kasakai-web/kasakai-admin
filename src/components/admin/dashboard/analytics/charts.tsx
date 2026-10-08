"use client";

/* Small, dependency-free charts for the Analytics section.

   Bars, stacks, histograms and the heatmap are plain HTML (flex / grid), so
   they reflow at any width and their text never scales with a viewBox. The one
   line chart is SVG with a non-scaling stroke under HTML labels.

   Every mark is a button: hover shows the numbers, click lists the games behind
   them (the section wires `onSelect` to the drill-down drawer). On a stacked
   chart each legend item is a button too: click it to hide or show that series.

   Colour, validated with the dataviz palette checker on the admin's dark surface
   #121a1f (adjacent CVD ΔE ≥ 17, normal-vision ΔE ≥ 24, all ≥ 3:1). A colour
   belongs to an ENTITY, never a rank, and is the same on every chart:
     healthy game → blue · underperforming → orange · auto-cancelled → violet
     upcoming → aqua · other cancellations / not marked → neutral grey
   Text is never painted in a series colour; every multi-series chart has a legend. */

import { useLayoutEffect, useRef, useState } from "react";

export const SERIES = {
  healthy: "#3987e5",
  under: "#d95926",
  auto: "#9085e9",
  upcoming: "#199e70",
  neutral: "#5f6f79",
} as const;

/* One-hue ordinal ramps, dark-mode bounds (low → high), lightness monotonic.
   Blue for "more is better" (fill, games); orange — the next categorical slot,
   per the dataviz rule for a second sequential context — for "more is worse". */
const RAMP_BLUE = ["#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef"];
const RAMP_ORANGE = ["#5c2a14", "#7d3519", "#9e421e", "#bf4f22", "#d95926", "#e9784a", "#f29d78"];

export const pctText = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);

export function monthLabel(ym: string, withYear = false) {
  const [y, m] = ym.split("-").map(Number);
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] || ym;
  return withYear ? `${name} ${y}` : name;
}

const CLICK_HINT = "Click to list these games";

// ── Hover tooltip ────────────────────────────────────────────────────────────

type Tip = { x: number; y: number; lines: string[] } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, lines: string[]) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = "clientX" in e ? e.clientX - box.left : target.left + target.width / 2 - box.left;
    const y = "clientY" in e ? e.clientY - box.top : target.top - box.top;
    setTip({ x, y, lines });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md border border-border-2 bg-[#0b1114] px-[10px] py-2 font-mono text-[11.5px] leading-[1.5] text-body shadow-lg"
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      <div className="mb-[2px] text-fg">{tip.lines[0]}</div>
      {tip.lines.slice(1).map((l) => (
        <div key={l} className={l === CLICK_HINT ? "mt-1 text-muted" : ""}>{l}</div>
      ))}
    </div>
  ) : null;
  return { ref, show, hide, node };
}

/** Props every clickable mark shares — hover, keyboard focus, click. */
function markProps(
  tip: Pick<ReturnType<typeof useTip>, "show" | "hide">,
  lines: string[],
  onSelect?: () => void,
) {
  const full = onSelect ? [...lines, CLICK_HINT] : lines;
  return {
    type: "button" as const,
    onMouseMove: (e: React.MouseEvent) => tip.show(e, full),
    onFocus: (e: React.FocusEvent) => tip.show(e, full),
    onMouseLeave: tip.hide,
    onBlur: tip.hide,
    onClick: onSelect,
    "aria-label": lines.join(", "),
    className: onSelect ? "cursor-pointer" : "cursor-default",
  };
}

// ── Controls ─────────────────────────────────────────────────────────────────

export function MetricSwitch<K extends string>({
  options, value, onChange, label,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-border-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`cursor-pointer border-none px-3 py-[5px] font-mono text-[11.5px] transition-colors ${
            value === o.key ? "bg-fg text-black" : "bg-transparent text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** With `onToggle`, each item is a button that hides or shows its series. */
export function Legend({ items, hidden, onToggle }: {
  items: StackSeries[];
  hidden?: ReadonlySet<string>;
  onToggle?: (key: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-muted">
      {items.map((i) => {
        const off = !!hidden?.has(i.key);
        const swatch = (
          <span
            className="inline-block h-[10px] w-[10px] rounded-[2px]"
            style={{ background: off ? "transparent" : i.color, boxShadow: off ? `inset 0 0 0 1px ${i.color}` : undefined }}
          />
        );
        return onToggle ? (
          <button
            key={i.key}
            type="button"
            aria-pressed={!off}
            title={off ? `Show ${i.label}` : `Hide ${i.label}`}
            onClick={() => onToggle(i.key)}
            className={`inline-flex cursor-pointer items-center gap-[6px] border-none bg-transparent p-0 font-mono text-[11.5px] ${off ? "text-muted-2 line-through" : "text-muted hover:text-fg"}`}
          >
            {swatch}
            {i.label}
          </button>
        ) : (
          <span key={i.key} className="inline-flex items-center gap-[6px]">{swatch}{i.label}</span>
        );
      })}
    </div>
  );
}

// ── Stacked columns (games per play day / month) ─────────────────────────────

export type StackSeries = { key: string; label: string; color: string };

/* Columns never shrink below MIN_COL; a long series scrolls sideways under a
   fixed y-axis and opens with `focus` (today, on the per-day chart) centred. */
export function StackedColumns({
  rows, series, height = 190, unit = "games", onSelect, focus,
}: {
  rows: { label: string; fullLabel: string; values: Record<string, number> }[];
  series: StackSeries[];
  height?: number;
  unit?: string;
  onSelect?: (index: number) => void;
  /** The column to centre when the chart is wider than its panel. */
  focus?: number;
}) {
  const { ref: tipRef, show, hide, node: tipNode } = useTip();
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const col = focus == null ? null : box?.querySelectorAll<HTMLElement>("[data-col]")[focus];
    if (box && col) box.scrollLeft = col.offsetLeft + col.offsetWidth / 2 - box.clientWidth / 2;
  }, [focus, rows.length]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const shown = series.filter((s) => !hidden.has(s.key));
  const totals = rows.map((r) => shown.reduce((s, x) => s + (r.values[x.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const every = Math.min(Math.max(1, Math.ceil(rows.length / 12)), 7); // ≤ 12 axis labels, at least weekly once it scrolls
  const gaps = Math.max(0, shown.length - 1) * 2;

  if (!rows.length) return <Empty />;
  return (
    <div ref={tipRef} className="relative">
      <Legend items={series} hidden={hidden} onToggle={series.length > 1 ? toggle : undefined} />
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-5 text-right font-mono text-[10.5px] text-muted-2" style={{ height }}>
          <span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span>
        </div>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="relative w-max min-w-full">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: (height - 20) / 2 }} />
            <div className="flex items-end gap-[3px] border-b border-border-2" style={{ height: height - 20 }}>
              {rows.map((r, i) => {
                const visible = shown.filter((s) => (r.values[s.key] || 0) > 0);
                const lines = [r.fullLabel, ...shown.filter((s) => r.values[s.key]).map((s) => `${s.label}: ${r.values[s.key]}`), `Total: ${totals[i]} ${unit}`];
                const p = markProps({ show, hide }, lines, onSelect && (() => onSelect(i)));
                return (
                  <button
                    key={r.label + i}
                    {...p}
                    data-col
                    className={`${p.className} flex h-full min-w-[10px] flex-1 flex-col-reverse items-stretch gap-[2px] border-none bg-transparent p-0 outline-none hover:bg-[rgba(255,255,255,0.04)] focus-visible:bg-[rgba(255,255,255,0.06)]`}
                  >
                    {visible.map((s, j) => (
                      <span
                        key={s.key}
                        className={j === visible.length - 1 ? "rounded-t-[4px]" : ""}
                        // Reserve the 2px gaps up front so the tallest column never overflows.
                        style={{ background: s.color, height: `calc((100% - ${gaps}px) * ${(r.values[s.key] || 0) / max})` }}
                      />
                    ))}
                  </button>
                );
              })}
            </div>
            <div className="flex h-5 gap-[3px] pt-1">
              {rows.map((r, i) => (
                // The label hangs centred over its column, free to be wider than it.
                <span key={r.label + i} className="relative min-w-[10px] flex-1 font-mono text-[10.5px] text-muted-2">
                  {i % every === 0 ? (
                    <span className={`absolute whitespace-nowrap ${i ? "left-1/2 -translate-x-1/2" : "left-0"}`}>{r.label}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {tipNode}
    </div>
  );
}

// ── Line (0–100%) over play months ───────────────────────────────────────────

export function PercentLine({
  points, height = 170, color = SERIES.healthy, label, nUnit = "finished games", onSelect,
}: {
  points: { label: string; fullLabel: string; value: number | null; n: number; extra?: string }[];
  height?: number;
  color?: string;
  label: string;
  /** What each point's `n` counts — "games played or cancelled". */
  nUnit?: string;
  onSelect?: (index: number) => void;
}) {
  const { ref: tipRef, show, hide, node: tipNode } = useTip();
  const valid = points.filter((p) => p.value != null);
  if (valid.length < 2) return <Empty text="Needs at least two months with finished games." />;
  const xs = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const ys = (v: number) => 100 - v;
  const d = points
    .map((p, i) => (p.value == null ? null : `${xs(i)},${ys(p.value)}`))
    .filter(Boolean)
    .map((pt, i) => `${i ? "L" : "M"}${pt}`)
    .join(" ");
  const every = Math.max(1, Math.ceil(points.length / 12));

  return (
    <div ref={tipRef} className="relative">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-5 text-right font-mono text-[10.5px] text-muted-2" style={{ height }}>
          <span>100%</span><span>50%</span><span>0%</span>
        </div>
        <div className="relative flex-1">
          <div className="relative border-b border-border-2" style={{ height: height - 20 }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={label} role="img">
              <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {points.map((p, i) => {
              if (p.value == null) return null;
              const lines = [p.fullLabel, `${label}: ${pctText(p.value)}`, `${p.n} ${nUnit}`, ...(p.extra ? [p.extra] : [])];
              const mp = markProps({ show, hide }, lines, onSelect && (() => onSelect(i)));
              return (
                <button
                  key={p.label + i}
                  {...mp}
                  className={`${mp.className} absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-none bg-transparent p-0`}
                  style={{ left: `${xs(i)}%`, top: `${ys(p.value)}%` }}
                >
                  <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ background: color }} />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between pt-1">
            {points.map((p, i) => (
              <span key={p.label + i} className="w-0 flex-1 truncate text-center font-mono text-[10.5px] text-muted-2 first:text-left last:text-right">
                {i % every === 0 || i === points.length - 1 ? p.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      {tipNode}
    </div>
  );
}

// ── Columns, one colour per column's entity (fill buckets, weeks) ────────────

/** `selected` dims every other column — for a chart whose click picks a column. */
export function Columns({
  rows, height = 160, unit = "games", onSelect, selected = null,
}: {
  rows: { label: string; value: number; color: string; note?: string }[];
  height?: number;
  unit?: string;
  onSelect?: (index: number) => void;
  selected?: number | null;
}) {
  const { ref: tipRef, show, hide, node: tipNode } = useTip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <Empty />;
  return (
    <div ref={tipRef} className="relative">
      <div className="flex items-end gap-2 border-b border-border-2" style={{ height }}>
        {rows.map((r, i) => {
          const p = markProps(
            { show, hide },
            [r.label, `${r.value} ${unit}`, `${Math.round((r.value / total) * 100)}% of total`, ...(r.note ? [r.note] : [])],
            onSelect && r.value ? () => onSelect(i) : undefined,
          );
          return (
            <button
              key={r.label}
              {...p}
              aria-pressed={selected == null ? undefined : selected === i}
              className={`${p.className} flex h-full flex-1 flex-col justify-end border-none bg-transparent p-0 hover:bg-[rgba(255,255,255,0.04)]`}
            >
              <span className="mb-1 text-center font-mono text-[11px] text-body">{r.value}</span>
              <span
                className="rounded-t-[4px] transition-opacity"
                style={{ background: r.color, height: `${(r.value / max) * (height - 22)}px`, opacity: selected == null || selected === i ? 1 : 0.35 }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 text-center font-mono text-[10.5px] text-muted-2">{r.label}</span>
        ))}
      </div>
      {tipNode}
    </div>
  );
}

// ── Weekday × daypart heatmap ────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display, JS weekday values
const PARTS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

export type HeatMetric = "median" | "under" | "games" | "cancelled";

type HeatCell = {
  weekday: number; daypart: string; games: number; completed: number; judged: number; filled: number;
  underCount: number; underPct: number | null; medianFillPct: number | null;
  cancelled: number; autoCancelled: number; fullGames: number; waitlistEntries: number;
};

/** The Cancelled view reads "cancelled/games"; its colour stays the count. */
const cancelledOf = (c: HeatCell) => `${c.cancelled || 0}/${c.games}`;

export function SlotHeatmap({
  cells, minGames, metric, onSelect,
}: {
  cells: HeatCell[];
  minGames: number;
  metric: HeatMetric;
  onSelect?: (weekday: number, daypart: string) => void;
}) {
  const { ref: tipRef, show, hide, node: tipNode } = useTip();
  const at = (w: number, p: string) => cells.find((c) => c.weekday === w && c.daypart === p);
  const maxGames = Math.max(1, ...cells.map((c) => c.games));
  const maxCancelled = Math.max(1, ...cells.map((c) => c.cancelled || 0));
  if (!cells.length) return <Empty />;

  const counts = metric === "games" || metric === "cancelled";
  const ramp = metric === "under" || metric === "cancelled" ? RAMP_ORANGE : RAMP_BLUE;
  const valueOf = (c: HeatCell): number | null =>
    metric === "games" ? c.games
      : metric === "cancelled" ? (c.cancelled || 0)
      : metric === "under" ? (c.judged ? c.underPct : null) : (c.judged ? c.medianFillPct : null);
  const scale = (v: number) => (metric === "games" ? v / maxGames : metric === "cancelled" ? v / maxCancelled : v / 100);
  const text = (v: number, c: HeatCell) => (metric === "cancelled" ? cancelledOf(c) : counts ? String(v) : pctText(v));
  const legend = metric === "games"
    ? ["Fewer games", "More games"]
    : metric === "cancelled" ? ["Fewer cancelled", "More cancelled"]
    : metric === "under" ? ["0% struggled", "100%"] : ["Typical fill 0%", "100%"];
  /* A share needs enough games under it: played or cancelled for "% struggled",
     played (or auto-cancelled) for the typical fill. */
  const base = (c: HeatCell) => (metric === "median" ? c.filled : c.judged);

  return (
    <div ref={tipRef} className="relative overflow-x-auto">
      <div className="grid min-w-[420px] gap-[2px]" style={{ gridTemplateColumns: "88px repeat(7, minmax(0, 1fr))" }}>
        <span />
        {DAYS.map((d) => <span key={d} className="pb-1 text-center font-mono text-[10.5px] text-muted">{d}</span>)}
        {PARTS.map((p) => (
          <div key={p.key} className="contents">
            <span className="flex items-center font-mono text-[10.5px] text-muted">{p.label}</span>
            {DAY_INDEX.map((w, i) => {
              const c = at(w, p.key);
              const v = c ? valueOf(c) : null;
              // A count of zero is "none", not the faintest shade of something.
              const painted = v != null && !(metric === "cancelled" && v === 0);
              const step = !painted || v == null ? -1 : Math.min(ramp.length - 1, Math.floor(scale(v) * ramp.length));
              const light = step >= 5;
              const thin = !!c && !counts && base(c) > 0 && base(c) < minGames;
              const name = `${DAYS[i]} ${p.label.toLowerCase()}`;
              const lines = c
                ? [name, `${c.games} games · ${c.judged} played or cancelled`,
                   `${c.underCount} of ${c.judged} struggled (${pctText(c.underPct)})`,
                   `Typical fill: ${pctText(c.medianFillPct)} (of ${c.filled} played)`,
                   `${cancelledOf(c)} cancelled (${pctText(c.games ? ((c.cancelled || 0) / c.games) * 100 : null)})${c.autoCancelled ? ` · ${c.autoCancelled} auto` : ""}`,
                   ...(c.waitlistEntries ? [`${c.waitlistEntries} waitlist joins`] : []),
                   ...(thin ? [`Under ${minGames} games behind this number — not judged`] : [])]
                : [name, "No games"];
              const mp = markProps({ show, hide }, lines, c && onSelect ? () => onSelect(w, p.key) : undefined);
              return (
                <button
                  key={w}
                  {...mp}
                  className={`${mp.className} flex h-10 items-center justify-center rounded-[3px] border-none p-0 font-mono text-[11.5px] ${
                    painted ? (light ? "text-[#0b1114]" : "text-white") : "text-muted-2"
                  } ${thin ? "opacity-55" : ""} ${c && onSelect ? "hover:outline hover:outline-2 hover:outline-fg" : ""}`}
                  style={{ background: painted ? ramp[step] : "var(--surface2)" }}
                >
                  {v != null && c ? text(v, c) : c ? c.games : "·"}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-muted">
        <span>{legend[0]}</span>
        <span className="flex h-2 w-32 overflow-hidden rounded-[2px]">
          {ramp.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
        </span>
        <span>{legend[1]}</span>
        {!counts ? <span className="ml-3 text-muted-2">Faded = under {minGames} {metric === "median" ? "games played" : "games played or cancelled"}</span> : null}
      </div>
      {tipNode}
    </div>
  );
}

// ── Inline meter for tables ──────────────────────────────────────────────────

export function Meter({ value, color = SERIES.healthy }: { value: number | null; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative h-[6px] w-20 overflow-hidden rounded-[3px] bg-surface-2">
        <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }} />
      </span>
      <span className="w-10 font-mono text-[12px] text-body">{pctText(value)}</span>
    </div>
  );
}

export function Empty({ text = "No data in this view." }: { text?: string }) {
  return <div className="py-8 text-center font-mono text-[12px] text-muted">{text}</div>;
}
