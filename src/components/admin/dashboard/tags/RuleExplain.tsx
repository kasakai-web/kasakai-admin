"use client";

/* A rule in full: what the tag means, when it is earned and lost, what it looks
   at, the minimum, what it cannot sit beside, an example. The words are the
   server's (tagRules.js EXPLAIN, built from the same thresholds the engine
   reads); this only lays them out. Used by the hover card on every Rule cell and
   by the tag drawer, so the two always say the same thing. */

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ExplainView } from "./shared";

const FIELDS: [keyof ExplainView, string][] = [
  ["earned", "Earned when"],
  ["kept", "Lost when"],
  ["looksAt", "Looks at"],
  ["needs", "Needs"],
  ["onlyOne", "One at a time"],
  ["example", "Example"],
  ["note", "Worth knowing"],
];

const KEY_LEAD = /^([a-z]+:[a-z0-9-]+(?::[a-z0-9-]+)?)([\s\S]*)$/;

/** "a:b — x; c:d — y" reads as a list, with each tag in mono. Anything else stays prose. */
function Value({ text }: { text: string }) {
  const parts = text.split("; ");
  if (parts.length < 2 || parts.filter((p) => KEY_LEAD.test(p)).length < 2) return <>{text}</>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {parts.map((p) => {
        const m = p.match(KEY_LEAD);
        return (
          <li key={p}>
            {m ? <><span className="font-mono text-fg">{m[1]}</span>{m[2]}</> : p}
          </li>
        );
      })}
    </ul>
  );
}

export function RuleExplain({ explain, size = "md" }: { explain: ExplainView; size?: "sm" | "md" }) {
  const text = size === "sm" ? "text-[12.5px]" : "text-[13.5px]";
  return (
    <div>
      <div className={`${text} mb-3 text-body`}>{explain.meaning}</div>
      <dl className={`m-0 grid grid-cols-[104px_1fr] gap-x-3 gap-y-[10px] ${text} max-[520px]:grid-cols-1 max-[520px]:gap-y-1`}>
        {FIELDS.filter(([k]) => explain[k]).map(([k, label]) => (
          <Fragment key={k}>
            <dt className="pt-[2px] font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{label}</dt>
            <dd className="m-0 text-body max-[520px]:mb-2">
              <Value text={String(explain[k])} />
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

/**
 * Shows `card` beside its trigger while the pointer is over it or it has focus.
 * Fixed-position in a portal, because the tables scroll sideways and would clip
 * an absolutely-placed popover. It hides on scroll rather than drifting off its
 * row.
 */
export function HoverCard({ card, children, width = 440, className = "" }: {
  card: ReactNode;
  children: ReactNode;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<CSSProperties | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - w - 8);
    const below = vh - r.bottom - 14;
    const above = r.top - 14;
    setAt(below >= 320 || below >= above
      ? { top: r.bottom + 6, left, width: w, maxHeight: below }
      : { bottom: vh - r.top + 6, left, width: w, maxHeight: above });
  };
  const hide = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    const off = () => setAt(null);
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
    };
  }, [at]);

  return (
    <span
      ref={ref}
      tabIndex={0}
      className={`cursor-help outline-none focus-visible:ring-1 focus-visible:ring-info ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {at && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", ...at }}
          className="pointer-events-none z-[950] overflow-hidden rounded-lg border border-border-2 bg-surface-2 p-4 normal-case tracking-normal shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        >
          {card}
        </div>,
        document.body,
      )}
    </span>
  );
}

/** The card a Rule cell shows on hover: the tag's name, its key pattern, the rule in full. */
export function RuleCard({ explain, keyPattern, fallback }: {
  explain: ExplainView | null;
  keyPattern?: string | null;
  /** The one-line rule, for a key with no long form. */
  fallback?: string | null;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-fg">{explain?.title ?? "Rule"}</span>
        {keyPattern && <span className="font-mono text-[11px] text-muted">{keyPattern}</span>}
      </div>
      {explain ? <RuleExplain explain={explain} size="sm" /> : <div className="text-[12.5px] text-body">{fallback || "No rule text."}</div>}
    </div>
  );
}

/** The dotted-underline cue that a piece of text has more behind it. */
export const HOVER_CUE = "underline decoration-dotted decoration-muted-2 underline-offset-4";
