"use client";

/* Every run of the tag engine: when, dry or live, how long, and what it added,
   kept and expired per kind of entity. Open a run for the biggest tags it
   counted, the cut-offs behind the relative tags (spend tertiles, price
   tertiles per metro, organiser size), what it skipped and any errors.

   "Dry run now" counts what tonight's run would do and writes only this log —
   the way to sanity-check a change without waiting for 03:00. */

import { Fragment, useState } from "react";
import {
  TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE, BADGE, BADGE_GREEN, BADGE_AMBER, BADGE_RED,
  BADGE_GRAY, BADGE_BLUE,
} from "../shared/styles";
import {
  BTN, BTN_PRIMARY, CARD, ENTITY_LABEL, ENTITY_TYPES, shortDateTime,
  type RunCounts, type TagRun,
} from "./shared";

const STATUS_TONE: Record<TagRun["status"], string> = {
  running: BADGE_BLUE,
  done: BADGE_GREEN,
  failed: BADGE_RED,
  abandoned: BADGE_AMBER,
};

const rs = (paise: unknown) => (typeof paise === "number" ? `₹${Math.round(paise / 100).toLocaleString("en-IN")}` : "—");
const duration = (msec?: number | null) => {
  if (msec == null) return "—";
  const s = Math.round(msec / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function CountsCell({ c }: { c?: RunCounts }) {
  if (!c) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap font-mono text-[12.5px]">
      <span className="text-success">+{c.added}</span>{" "}
      <span className="text-muted">={c.kept}</span>{" "}
      <span className="text-danger">−{c.expired}</span>
      {c.failed > 0 && <span className="ml-1 text-warning">!{c.failed}</span>}
      <div className="text-[11px] text-muted-2">{c.entities.toLocaleString("en-IN")} checked</div>
    </span>
  );
}

function Cuts({ cuts }: { cuts: Record<string, unknown> }) {
  const lines: string[] = [];
  const spend = cuts.spendCuts as number[] | null | undefined;
  if (spend) lines.push(`Player spend (90 days): low ≤ ${rs(spend[0])}, mid ≤ ${rs(spend[1])}, high above`);
  const skill = cuts.skill as { q1: number; q3: number; n: number } | null | undefined;
  if (skill) lines.push(`Skill: bottom quarter ≤ ${skill.q1}, top quarter ≥ ${skill.q3} (${skill.n} rated players)`);
  const org = cuts.orgSizeCuts as number[] | null | undefined;
  if (org) lines.push(`Organiser size (games in 90 days): small ≤ ${org[0]}, mid ≤ ${org[1]}, large above`);
  const price = (cuts.priceCuts || {}) as Record<string, number[]>;
  for (const [metro, c] of Object.entries(price)) lines.push(`Game price, ${metro}: budget ≤ ${rs(c[0])}, standard ≤ ${rs(c[1])}, premium above`);
  const q3 = (cuts.metroFeeQ3 || {}) as Record<string, number>;
  for (const [metro, v] of Object.entries(q3)) lines.push(`Premium-games line, ${metro}: median fee ≥ ${rs(v)}`);
  if (!lines.length) return <div className="text-[12.5px] text-muted">Too few entities for any relative cut-off.</div>;
  return <ul className="m-0 list-disc pl-5 text-[12.5px] text-body">{lines.map((l) => <li key={l}>{l}</li>)}</ul>;
}

function RunDetail({ run }: { run: TagRun }) {
  return (
    <div className="grid gap-4 py-2 text-[13px] md:grid-cols-2">
      {ENTITY_TYPES.map((t) => {
        const c = run.counts?.[t];
        const top = Object.entries(c?.byKey || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
        return (
          <div key={t}>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              {ENTITY_LABEL[t]} — top tags {run.dryRun ? "it would hold" : "held"} after the run
            </div>
            {top.length === 0 ? <div className="text-muted">None.</div> : (
              <div className="flex flex-col gap-[2px]">
                {top.map(([k, n]) => (
                  <div key={k} className="flex justify-between gap-3 font-mono text-[12px]">
                    <span className="text-body">{k}</span>
                    <span className="text-muted">
                      {n.toLocaleString("en-IN")}
                      {c?.entities ? ` · ${Math.round((n / c.entities) * 100)}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="md:col-span-2">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Cut-offs this run drew</div>
        <Cuts cuts={run.cohortCuts || {}} />
      </div>
      <div className="md:col-span-2 text-[12.5px] text-muted">
        Definitions version {run.defsVersion || "—"}
        {run.skipped?.turfsWithoutSlug ? ` · ${run.skipped.turfsWithoutSlug} venue(s) with games but no slug yet — no venue tags for them until the slug backfill runs` : ""}
        {run.manualExpired ? ` · ${run.manualExpired} manual tag(s) past their end date ${run.dryRun ? "would be" : "were"} ended` : ""}
      </div>
      {(run.errorLog?.length ?? 0) > 0 && (
        <div className="md:col-span-2">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-danger">Errors ({run.errorLog!.length})</div>
          <pre className="m-0 max-h-[220px] overflow-auto whitespace-pre-wrap border border-border bg-surface-2 p-3 text-[12px] text-body">
            {run.errorLog!.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

export function RunLog({ runs, loading, error, live, canManage, starting, onStart }: {
  runs: TagRun[];
  loading: boolean;
  error: string;
  live: boolean | undefined;
  canManage: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const running = runs.some((r) => r.status === "running");

  return (
    <div>
      <div className={`${CARD} mb-5 flex flex-wrap items-center justify-between gap-3`}>
        <div className="text-[13px] text-body">
          The nightly run starts after 03:00 IST.{" "}
          {live
            ? "Tagging is LIVE — scheduled runs write tags."
            : "Tagging is in dry-run mode (TAGGING_LIVE is off) — every run only counts what it would do."}
          <div className="mt-1 text-[12px] text-muted">
            Each tag is shown as <span className="text-success">+added</span> <span>=kept</span> <span className="text-danger">−expired</span>.
          </div>
        </div>
        {canManage && (
          <button type="button" className={`${BTN} ${BTN_PRIMARY}`} disabled={starting || running} onClick={onStart}>
            {running ? "A run is in progress…" : starting ? "Starting…" : "Dry run now"}
          </button>
        )}
      </div>

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && runs.length === 0 ? (
        <div className={LOADING_STATE}>Loading runs…</div>
      ) : runs.length === 0 ? (
        <div className={LOADING_STATE}>No run yet. The first one happens after 03:00 IST{canManage ? ", or start a dry run now" : ""}.</div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th>Started</th><th>Kind</th><th>Status</th><th>Took</th>
                {ENTITY_TYPES.map((t) => <th key={t}>{ENTITY_LABEL[t]}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <Fragment key={r._id}>
                  <tr>
                    <td className="whitespace-nowrap">{shortDateTime(r.startedAt)}</td>
                    <td>
                      <span className={`${BADGE} ${r.dryRun ? BADGE_GRAY : BADGE_GREEN}`}>{r.dryRun ? "dry" : "live"}</span>
                      <div className="mt-1 text-[11px] text-muted">
                        {r.trigger === "manual" ? `by ${r.startedBy?.name || "an admin"}` : "nightly"}
                      </div>
                    </td>
                    <td><span className={`${BADGE} ${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                    <td className="font-mono">{duration(r.durationMs)}</td>
                    {ENTITY_TYPES.map((t) => <td key={t}><CountsCell c={r.counts?.[t]} /></td>)}
                    <td>
                      {r.status !== "running" && (
                        <button type="button" className={BTN} onClick={() => setOpenId(openId === r._id ? null : r._id)}>
                          {openId === r._id ? "Close" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openId === r._id && (
                    <tr>
                      <td colSpan={5 + ENTITY_TYPES.length} className="bg-surface-2!">
                        <RunDetail run={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
