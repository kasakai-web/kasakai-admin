"use client";

/* Every tag key: how many entities hold it now, how many gained and lost it in
   30 days, and what the last nightly run counted — which during the dry-run
   weeks is the ONLY count there is, since nothing is written yet. That column is
   what "is 38% of Bengaluru really weekend-only?" gets checked against, so it
   shows the share of everything that run evaluated too.

   Hovering a rule shows it in full; clicking a key opens its drawer (who holds
   it, and the way into a segment). The filters live in the URL (useTagsUrl), so
   they are still set when the admin comes back. */

import { useMemo, useState } from "react";
import {
  TOOLBAR, SEARCH_INPUT, FILTER_SELECT, TABLE_WRAP, TABLE, FORM_ERROR, LOADING_STATE,
  BADGE, BADGE_AMBER, BADGE_GRAY, BADGE_VIOLET, BADGE_BLUE, TAB_BAR, TAB, TAB_ACTIVE,
} from "../shared/styles";
import { HowTagsWork } from "./HowTagsWork";
import { HoverCard, RuleCard, HOVER_CUE } from "./RuleExplain";
import type { TypeFilter } from "./useTagsUrl";
import {
  ENTITY_LABEL, explainFor, pct, shortDateTime,
  type Definition, type Definitions, type EntityType, type ExplorerTableRow, type TagRun,
} from "./shared";

const MANUAL_RULE = "Added by an admin from the curated list. The nightly run never touches it.";

/** A column header that explains itself on hover. */
function Th({ label, tip }: { label: string; tip: string }) {
  return (
    <th>
      <HoverCard width={300} card={<div className="text-[12.5px] leading-[1.5] text-body">{tip}</div>}>
        <span className={HOVER_CUE}>{label}</span>
      </HoverCard>
    </th>
  );
}

/** A rule cell: the one-liner, and the whole rule on hover. */
function RuleCell({ row }: { row: ExplorerTableRow }) {
  if (row.source === "manual") return <span>{MANUAL_RULE}</span>;
  const explain = explainFor(row.definition, row.entityType);
  if (!row.rule && !explain) return <span>—</span>;
  return (
    <HoverCard card={<RuleCard explain={explain} keyPattern={row.definition?.key} fallback={row.rule} />}>
      <span className={explain ? HOVER_CUE : ""}>{row.rule || explain?.meaning}</span>
    </HoverCard>
  );
}

function DefinitionRule({ d, type }: { d: Definition; type: EntityType | "all" }) {
  // On "All", a shared definition explains itself as it applies to its first kind.
  const explain = explainFor(d, type === "all" ? d.entities[0] : type);
  return (
    <HoverCard card={<RuleCard explain={explain} keyPattern={d.key} fallback={d.rule} />}>
      <span className={explain ? HOVER_CUE : ""}>{d.rule}</span>
    </HoverCard>
  );
}

export function Explorer({ defs, lastRun, rows, hasData, loading, error, type, ns, q, onType, onNs, onQ, onOpenKey }: {
  defs: Definitions | null;
  lastRun: TagRun | null;
  /** Live keys joined with the last run's counts — built by the page, which also needs them for the drawer. */
  rows: ExplorerTableRow[];
  /** The explorer endpoint has answered. */
  hasData: boolean;
  loading: boolean;
  error: string;
  type: TypeFilter;
  ns: string;
  q: string;
  onType: (t: TypeFilter) => void;
  onNs: (ns: string) => void;
  onQ: (q: string) => void;
  onOpenKey: (entityType: EntityType, key: string) => void;
}) {
  const [showDefs, setShowDefs] = useState(false);
  const labels = defs?.namespaceLabels ?? {};

  const namespaces = useMemo(
    () => [...new Set(rows.filter((r) => type === "all" || r.entityType === type).map((r) => r.namespace))].sort(),
    [rows, type],
  );

  const search = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => type === "all" || r.entityType === type)
    .filter((r) => !ns || r.namespace === ns)
    .filter((r) => !search || r.key.includes(search) || (explainFor(r.definition, r.entityType)?.title ?? "").toLowerCase().includes(search))
    .sort((a, b) => b.count - a.count || (b.lastRun ?? 0) - (a.lastRun ?? 0) || a.key.localeCompare(b.key));

  // Definitions grouped by namespace, in the registry's own namespace order.
  const groups = useMemo(() => {
    const list = (defs?.definitions ?? []).filter((d) => type === "all" || d.entities.includes(type));
    const by = new Map<string, Definition[]>();
    for (const d of list) {
      const n = d.key.split(":")[0];
      by.set(n, [...(by.get(n) ?? []), d]);
    }
    const order = defs?.namespaces ?? [];
    return [...by.entries()].sort(([a], [b]) => (order.indexOf(a) - order.indexOf(b)) || a.localeCompare(b));
  }, [defs, type]);
  const defCount = groups.reduce((s, [, l]) => s + l.length, 0);

  return (
    <div>
      <HowTagsWork defs={defs} />

      <div className={TAB_BAR}>
        {(["player", "game", "organiser", "turf", "all"] as const).map((t) => (
          <button key={t} type="button" className={`${TAB} ${type === t ? TAB_ACTIVE : ""}`} onClick={() => onType(t)}>
            {t === "all" ? "All" : ENTITY_LABEL[t]}
          </button>
        ))}
      </div>

      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search tags, e.g. venue:loyal or “weekend”" value={q} onChange={(e) => onQ(e.target.value)} />
        <select className={FILTER_SELECT} value={ns} onChange={(e) => onNs(e.target.value)}>
          <option value="">All namespaces</option>
          {namespaces.map((n) => <option key={n} value={n}>{labels[n] ? `${n} · ${labels[n]}` : n}</option>)}
        </select>
      </div>

      {lastRun && (
        <div className="mb-3 text-[12px] text-muted">
          “Last run” is the {lastRun.dryRun ? "dry run" : "run"} of {shortDateTime(lastRun.finishedAt || lastRun.startedAt)}
          {lastRun.dryRun ? " — what it would have written; nothing was saved." : "."}{" "}
          Hover a rule to read it in full; click a tag to see who holds it.
        </div>
      )}

      {error && <div className={FORM_ERROR}>{error}</div>}
      {loading && !hasData ? (
        <div className={LOADING_STATE}>Loading tags…</div>
      ) : shown.length === 0 ? (
        <div className={LOADING_STATE}>
          {rows.length === 0
            ? "No tags yet, and no finished run to count from. Start a dry run from the Run log tab."
            : "No tag matches these filters."}
        </div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr>
                <Th label="Tag" tip="The tag key — namespace, then value. Click one to see what it means in full and who holds it." />
                {type === "all" && <th>On</th>}
                <Th label="Live" tip="How many hold this tag right now. Zero for everything while tagging is in dry-run mode." />
                <Th label="+30d" tip="How many gained this tag in the last 30 days." />
                <Th label="−30d" tip="How many lost it in the last 30 days — the rule stopped matching, or an admin removed it." />
                <Th label="Last run" tip="What the latest nightly run counted (in a dry run, what it would have written), and that as a share of everything it looked at." />
                <Th label="Rule" tip="When the tag is earned. Hover a rule for the full version: when it is lost, which games it looks at, the minimum, and an example." />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const title = explainFor(r.definition, r.entityType)?.title;
                return (
                  <tr key={`${r.entityType}|${r.key}`}>
                    <td>
                      <button type="button" onClick={() => onOpenKey(r.entityType, r.key)}
                        className="cursor-pointer border-none bg-transparent p-0 text-left font-mono text-[13px] text-info hover:underline">
                        {r.key}
                      </button>
                      {title && <div className="mt-[2px] text-[12px] text-muted">{title}</div>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.source === "manual" && <span className={`${BADGE} ${BADGE_VIOLET}`}>manual</span>}
                        {r.sensitive && <span className={`${BADGE} ${BADGE_AMBER}`}>sensitive</span>}
                        {r.informational && <span className={`${BADGE} ${BADGE_GRAY}`}>informational</span>}
                      </div>
                    </td>
                    {type === "all" && <td><span className={`${BADGE} ${BADGE_BLUE}`}>{ENTITY_LABEL[r.entityType]}</span></td>}
                    <td className="font-mono">{r.count.toLocaleString("en-IN")}</td>
                    <td className={`font-mono ${r.gained30d ? "text-success!" : "text-muted!"}`}>{r.gained30d ? `+${r.gained30d}` : "—"}</td>
                    <td className={`font-mono ${r.lost30d ? "text-danger!" : "text-muted!"}`}>{r.lost30d ? `−${r.lost30d}` : "—"}</td>
                    <td className="font-mono">
                      {r.lastRun == null ? <span className="text-muted">—</span> : (
                        <>
                          {r.lastRun.toLocaleString("en-IN")}
                          <span className="ml-2 text-[11px] text-muted">{pct(r.lastRunShare)}</span>
                        </>
                      )}
                    </td>
                    <td className="max-w-[420px] text-[12.5px]! text-muted!"><RuleCell row={r} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-[12px] text-muted underline hover:text-fg"
          onClick={() => setShowDefs((s) => !s)}>
          {showDefs ? "Hide" : "Show"} every definition ({defCount}) — version {defs?.defsVersion || "…"}
        </button>
        {showDefs && (
          <div className="mt-3 flex flex-col gap-4">
            {groups.map(([n, list]) => (
              <div key={n}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-mono text-[12px] text-fg">{n}</span>
                  {labels[n] && <span className="text-[12.5px] text-muted">{labels[n].split(" — ")[1] ?? labels[n]}</span>}
                </div>
                <div className={TABLE_WRAP}>
                  <table className={TABLE}>
                    <thead><tr><th>Tag</th><th>Keys</th><th>On</th><th>Rule — hover for the full version</th></tr></thead>
                    <tbody>
                      {list.map((d) => (
                        <tr key={d.id}>
                          <td className="text-[13px]!">
                            <div className="text-fg">{explainFor(d, type === "all" ? d.entities[0] : type)?.title ?? d.id}</div>
                            <div className="mt-[2px] font-mono text-[11px] text-muted-2">{d.def}</div>
                          </td>
                          <td className="font-mono text-[12.5px]!">{d.key}</td>
                          <td className="text-[12px]!">{d.entities.map((e) => ENTITY_LABEL[e]).join(", ")}</td>
                          <td className="max-w-[420px] text-[12.5px]! text-muted!">
                            <DefinitionRule d={d} type={type} />
                            {d.sensitive && <span className={`${BADGE} ${BADGE_AMBER} ml-2`}>sensitive</span>}
                            {d.informational && <span className={`${BADGE} ${BADGE_GRAY} ml-2`}>informational</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
