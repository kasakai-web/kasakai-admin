"use client";

/* The verdict pieces every Analytics topic renders with — the headline, one card
   per area, the ranked findings — plus the KPI tile and evidence block beneath
   them. One copy, so Games and Players state their conclusions the same way.
   The verdicts themselves come from the backend engines; nothing here judges.
   Every evidence block can carry its own Excel export. */

import { useState } from "react";
import {
  STAT_CARD, STAT_LABEL, STAT_VALUE, STAT_DELTA, NEUTRAL, PANEL, PANEL_TITLE, PANEL_SUB,
  BADGE, BADGE_GREEN, BADGE_AMBER, BADGE_RED, BADGE_GRAY, BADGE_BLUE, ACTION_BTN,
} from "../shared/styles";
import { Empty, pctText } from "./charts";
import type { Area, AreaStatus, Conclusions, Finding, Severity } from "./types";

// ── Status presentation (icon + label, never colour alone) ───────────────────

export const STATUS_UI: Record<AreaStatus | Severity, { label: string; icon: string; badge: string; edge: string }> = {
  good:         { label: "Good",            icon: "✓", badge: BADGE_GREEN, edge: "border-l-success" },
  watch:        { label: "Watch",           icon: "!", badge: BADGE_AMBER, edge: "border-l-warning" },
  concern:      { label: "Concern",         icon: "✕", badge: BADGE_RED,   edge: "border-l-danger" },
  insufficient: { label: "Not enough data", icon: "…", badge: BADGE_GRAY,  edge: "border-l-border-2" },
  info:         { label: "Insight",         icon: "i", badge: BADGE_BLUE,  edge: "border-l-info" },
};

export function StatusChip({ status }: { status: AreaStatus | Severity }) {
  const ui = STATUS_UI[status];
  return (
    <span className={`${BADGE} ${ui.badge}`}>
      <span aria-hidden>{ui.icon}</span>
      {ui.label}
    </span>
  );
}

/** ▲/▼ coloured by whether the move is good — a rise in underperformance is red. */
export function ChangeTag({ change }: { change: Area["change"] }) {
  if (!change) return null;
  const v = Math.round(change.value);
  const good = change.better === "lower" ? v < 0 : v > 0;
  const tone = v === 0 ? "text-muted" : good ? "text-success" : "text-danger";
  return (
    <span className={`font-mono text-[12px] ${tone}`}>
      {v === 0 ? "■" : v > 0 ? "▲" : "▼"} {v > 0 ? "+" : ""}{v}{change.unit} <span className="text-muted">vs {change.against}</span>
    </span>
  );
}

/** With `onClick` the tile is a button — `hint` says what clicking it shows. */
export function Kpi({ label, value, sub, onClick, hint }: {
  label: string; value: React.ReactNode; sub?: string; onClick?: () => void; hint?: string;
}) {
  const body = (
    <>
      <span className={`${STAT_LABEL} block`}>{label}</span>
      <span className={`${STAT_VALUE} block text-[30px]!`}>{value}</span>
      {sub ? <span className={`${STAT_DELTA} ${NEUTRAL} block`}>{sub}</span> : null}
      {onClick && hint ? <span className="mt-2 block font-mono text-[11px] text-muted-2 group-hover/kpi:text-fg">{hint} →</span> : null}
    </>
  );
  // A named group: the Analytics topic around it is a `group` too.
  return onClick ? (
    <button type="button" onClick={onClick} className={`${STAT_CARD} group/kpi cursor-pointer border-none text-left hover:bg-surface-2`}>
      {body}
    </button>
  ) : (
    <div className={STAT_CARD}>{body}</div>
  );
}

/** Runs an export in place: "Exporting…" while it works, the reason on hover if it fails. */
export function ExportButton({ onExport, label = "Excel ↓", className = ACTION_BTN, disabled = false }: {
  onExport: () => Promise<void>; label?: string; className?: string; disabled?: boolean;
}) {
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const run = async () => {
    setState({ busy: true, error: "" });
    try {
      await onExport();
      setState({ busy: false, error: "" });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : "Export failed." });
    }
  };
  return (
    <button
      type="button"
      className={className}
      onClick={run}
      disabled={disabled || state.busy}
      title={state.error || "Download as an Excel file"}
    >
      {state.busy ? "Exporting…" : state.error ? "Export failed — retry" : label}
    </button>
  );
}

/** `onExport` adds an Excel button that downloads this block's own data. */
export function Block({ id, title, sub, action, onExport, children }: {
  id?: string; title: string; sub?: string; action?: React.ReactNode; onExport?: () => Promise<void>; children: React.ReactNode;
}) {
  return (
    <div id={id} className={`${PANEL} scroll-mt-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={PANEL_TITLE}>{title}</div>
          {sub ? <div className={PANEL_SUB}>{sub}</div> : null}
        </div>
        {action || onExport ? (
          <div className="flex flex-wrap items-center gap-2">
            {action}
            {onExport ? <ExportButton onExport={onExport} /> : null}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const RANK = { concern: 3, watch: 2, good: 1, insufficient: 0 };

/**
 * Headline → area cards → ranked findings. `findingsSub` turns the findings
 * panel on; `actions` adds buttons per finding, and a finding that names players
 * lists them as chips that call `onPlayer`. `onArea` makes each card a button
 * (the topic decides what that opens — its evidence, or its players).
 */
export function Verdict<S extends string>({ label, conclusions, footnote, findingsSub, actions, onPlayer, onArea, areaHint = "See the evidence ↓" }: {
  label: string;
  conclusions: Conclusions<S>;
  footnote?: React.ReactNode;
  findingsSub?: string;
  actions?: (f: Finding<S>) => React.ReactNode;
  onPlayer?: (id: string) => void;
  onArea?: (key: string) => void;
  /** What clicking a card does, in words. */
  areaHint?: string;
}) {
  const { headline, areas, insights } = conclusions;
  const worst = areas.reduce<AreaStatus>((w, a) => (RANK[a.status] > RANK[w] ? a.status : w), "insufficient");

  return (
    <section aria-label={label} className="mb-6">
      <div className={`${PANEL} mb-px border-l-4 ${STATUS_UI[worst].edge}`}>
        <div className={STAT_LABEL}>{label}</div>
        <p className="m-0 text-[19px] font-semibold leading-[1.45] text-fg max-[640px]:text-[16px]">{headline}</p>
        {footnote ? <p className="mt-2 mb-0 font-mono text-[11.5px] text-muted">{footnote}</p> : null}
      </div>

      <div className={`grid gap-px border border-t-0 border-border bg-border ${findingsSub ? "mb-5" : ""}`} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {areas.map((a) => {
          // Spans, not divs: the card may be a button, which only takes phrasing content.
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className={STAT_LABEL + " mb-0!"}>{a.title}</span>
                <StatusChip status={a.status} />
              </span>
              <span className="block font-mono text-[28px] font-medium text-fg">
                {a.figure == null ? "—" : a.figureUnit === "%" ? pctText(a.figure) : a.figure}
                {a.figureLabel ? <span className="ml-2 text-[12px] font-normal text-muted">{a.figureLabel}</span> : null}
              </span>
              <ChangeTag change={a.change} />
              <span className="block text-[13px] leading-[1.5] text-body">{a.summary}</span>
              {onArea ? <span className="mt-auto block font-mono text-[11px] text-muted-2 group-hover/card:text-fg">{areaHint}</span> : null}
            </>
          );
          return onArea ? (
            <button
              key={a.key}
              type="button"
              onClick={() => onArea(a.key)}
              className="group/card flex cursor-pointer flex-col gap-2 border-none bg-surface px-5 py-[18px] text-left hover:bg-surface-2"
            >
              {body}
            </button>
          ) : (
            <div key={a.key} className="flex flex-col gap-2 bg-surface px-5 py-[18px]">{body}</div>
          );
        })}
      </div>

      {findingsSub ? (
        <div className={PANEL}>
          <div className={PANEL_TITLE}>Key findings</div>
          <div className={PANEL_SUB}>{findingsSub}</div>
          {insights.length === 0 ? (
            <Empty text="Nothing stands out in this view — no rule crossed its threshold." />
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {insights.map((i, n) => (
                <li key={n} className="flex items-start gap-3 border-t border-border-2 py-3 first:border-t-0 max-[640px]:flex-col max-[640px]:gap-2">
                  <span className="w-[120px] shrink-0"><StatusChip status={i.severity} /></span>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-fg">{i.title}</div>
                    <div className="mt-[2px] text-[13px] text-muted">{i.detail}</div>
                    {i.players?.length && onPlayer ? (
                      <div className="mt-2 flex flex-wrap gap-[6px]">
                        {i.players.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onPlayer(p.id)}
                            className="cursor-pointer rounded-full border border-border-2 bg-surface-2 px-3 py-[2px] font-mono text-[12px] text-body hover:border-fg hover:text-fg"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {actions ? <div className="flex shrink-0 gap-2">{actions(i)}</div> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
