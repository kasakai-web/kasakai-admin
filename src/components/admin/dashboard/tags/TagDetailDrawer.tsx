"use client";

/* One tag, opened from the Explorer: what it means in full, how many hold it,
   and everyone who does, a page at a time — without leaving the Explorer. The table and its filters
   stay underneath. ✕, Escape or the browser's Back closes it, because the open
   tag lives in the URL (useTagsUrl).

   "Build a segment" hands the count already made here to the segment builder,
   so nothing is counted twice. */

import { useEffect, useState } from "react";
import { BADGE, BADGE_AMBER, BADGE_BLUE, BADGE_GRAY, BADGE_VIOLET, LOADING_STATE, FORM_ERROR, TOPBAR_BTN, TOPBAR_BTN_PRIMARY } from "../shared/styles";
import { HOLDERS_PAGE_SIZE, Pager, previewSegment, SampleTable } from "./Segments";
import { RuleExplain } from "./RuleExplain";
import {
  ENTITY_LABEL, definitionFor, explainFor, pct,
  type Definitions, type EntityType, type ExplorerTableRow, type SegmentPreview,
} from "./shared";

type Holders = { loading: boolean; preview: SegmentPreview | null; error: string };

function Count({ label, value, sub, tone = "text-fg" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`font-mono text-[20px] ${tone}`}>{value}</div>
      {sub && <div className="mt-[2px] font-mono text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function TagDetailDrawer({ entityType, tagKey, row, defs, layerOpen, onClose, onBuildSegment, onOpenEntity }: {
  entityType: EntityType;
  tagKey: string;
  /** The Explorer's row for this key, when there is one (a shared link may name a key nobody holds). */
  row: ExplorerTableRow | null;
  defs: Definitions | null;
  /** A player/game window is open on top: Escape is that window's, not ours. */
  layerOpen: boolean;
  onClose: () => void;
  onBuildSegment: (preview: SegmentPreview | null, error: string) => void;
  onOpenEntity: (entityType: EntityType, id: string, name: string) => void;
}) {
  const [holders, setHolders] = useState<Holders>({ loading: true, preview: null, error: "" });
  const [paging, setPaging] = useState(false);

  useEffect(() => {
    let live = true;
    previewSegment({ entityType, all: [tagKey], any: [], none: [] }).then((res) => {
      if (!live) return;
      setHolders(res.ok && res.data
        ? { loading: false, preview: res.data, error: "" }
        : { loading: false, preview: null, error: res.message || "Could not count who holds it." });
    });
    return () => { live = false; };
  }, [entityType, tagKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !layerOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layerOpen, onClose]);

  const definition = row?.definition ?? definitionFor(entityType, tagKey, defs);
  const explain = explainFor(definition, entityType);
  const manual = defs?.manualTags.find((m) => m.key === tagKey) ?? null;
  const isManual = row?.source === "manual" || !!manual || tagKey.startsWith("manual:");
  const sensitive = row?.sensitive ?? definition?.sensitive ?? false;
  const informational = row?.informational ?? definition?.informational ?? false;
  const nsLabel = defs?.namespaceLabels?.[tagKey.split(":")[0]];
  const title = manual?.label ?? explain?.title ?? null;

  const p = holders.preview;
  const n = (x: number) => x.toLocaleString("en-IN");

  const turnPage = async (page: number) => {
    setPaging(true);
    const res = await previewSegment({ entityType, all: [tagKey], any: [], none: [] }, page);
    setPaging(false);
    setHolders((h) => (res.ok && res.data
      ? { loading: false, preview: res.data, error: "" }
      : { ...h, error: res.message || "Could not load that page." }));
  };

  return (
    <>
      <div className="fixed inset-0 z-[900] bg-[rgba(0,0,0,0.55)]" onClick={onClose} role="presentation" />
      <aside
        className="fixed inset-y-0 right-0 z-[901] flex w-[min(720px,100vw)] flex-col border-l border-border-2 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Tag ${tagKey}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Tag on {ENTITY_LABEL[entityType].toLowerCase()}{nsLabel ? ` · ${nsLabel}` : ""}
            </div>
            <div className="mt-1 break-all font-mono text-[16px] text-fg">{tagKey}</div>
            {title && <div className="mt-[2px] text-[14px] font-semibold text-body">{title}</div>}
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`${BADGE} ${BADGE_BLUE}`}>{ENTITY_LABEL[entityType]}</span>
              {isManual && <span className={`${BADGE} ${BADGE_VIOLET}`}>manual</span>}
              {sensitive && <span className={`${BADGE} ${BADGE_AMBER}`}>sensitive</span>}
              {informational && <span className={`${BADGE} ${BADGE_GRAY}`}>informational</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button type="button" className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} disabled={holders.loading}
              onClick={() => onBuildSegment(holders.preview, holders.error)}>
              Build a segment →
            </button>
            <button type="button" className={TOPBAR_BTN} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {row && (
            <div className="mb-5 grid grid-cols-4 gap-px border border-border bg-border max-[640px]:grid-cols-2">
              <Count label="Live now" value={n(row.count)} />
              <Count label="Gained 30d" value={row.gained30d ? `+${n(row.gained30d)}` : "—"} tone={row.gained30d ? "text-success" : "text-muted"} />
              <Count label="Lost 30d" value={row.lost30d ? `−${n(row.lost30d)}` : "—"} tone={row.lost30d ? "text-danger" : "text-muted"} />
              <Count label="Last run" value={row.lastRun == null ? "—" : n(row.lastRun)}
                sub={row.lastRunShare == null ? undefined : `${pct(row.lastRunShare)} of all ${ENTITY_LABEL[entityType].toLowerCase()}`} />
            </div>
          )}

          <section className="mb-6">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">The rule</div>
            {isManual ? (
              <div className="text-[13.5px] text-body">
                A manual tag{manual ? ` (“${manual.label}”)` : ""}. An admin adds it from a fixed list, on a player’s,
                organiser’s, game’s or venue’s own drawer, with an optional note and expiry. The nightly run never adds or
                removes it.
              </div>
            ) : explain ? (
              <RuleExplain explain={explain} />
            ) : (
              <div className="text-[13.5px] text-body">
                {definition?.rule || "No definition matches this key. It may come from an older version of the rules."}
              </div>
            )}
            {definition && (
              <div className="mt-3 font-mono text-[11px] text-muted-2">
                {definition.def} · key pattern {definition.key}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Who holds it</div>
              {p && <div className="font-mono text-[12px] text-muted">{n(p.count)} {ENTITY_LABEL[entityType].toLowerCase()}</div>}
            </div>
            {holders.loading ? (
              <div className={LOADING_STATE}>Counting…</div>
            ) : holders.error ? (
              <div className={FORM_ERROR}>{holders.error}</div>
            ) : !p || p.sample.length === 0 ? (
              <div className="border border-border px-4 py-3 text-[13px] text-muted">
                Nobody holds it right now.
                {defs?.live === false && (
                  <>
                    {" "}Tagging is in dry-run mode, so nothing has been written yet
                    {row?.lastRun ? `. The last run would have tagged ${n(row.lastRun)}.` : "."}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="mb-2 text-[12px] text-muted">
                  Everyone who holds it{(p.pages ?? 1) > 1 ? `, ${HOLDERS_PAGE_SIZE} per page` : ""}, with their other tags.
                  Click a name to open it.
                </div>
                <SampleTable entityType={entityType} rows={p.sample} onOpen={(r) => onOpenEntity(entityType, r.id, r.name)} />
                <Pager preview={p} busy={paging} onPage={turnPage} />
              </>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
