"use client";

/* Behaviour tags — derived labels on players, games, organisers and venues
   (venue:loyal:<venue>, day:weekend-only, life:lapsing), recomputed nightly from
   what people actually did.

   Three screens: the Explorer (every tag and how many hold it), Segments (who
   holds a combination of tags — count, sample, CSV, save) and the Run log. One
   entity's tags, with their evidence and history, live in its own drawer: the
   Players, Organisers and Games detail drawers, and the venue Tags button.

   Where the admin is — tab, Explorer filters, the open tag — is in the URL
   (useTagsUrl), so Back walks back through it: a clicked tag opens a drawer over
   the Explorer, and Back or ✕ closes it with the filters still set.

   Nothing is decided here. What a tag means, why it was earned and whether a
   segment is allowed are the server's answers (utils/tagRules.js). Players
   never see a tag. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import { TAB_BAR, TAB, TAB_ACTIVE } from "../shared/styles";
import { UserDetailModal } from "../shared/UserDetailModal";
import { GameDetailModal } from "../shared/GameDetailModal";
import { EntityTagsModal } from "./EntityTagsModal";
import { Explorer } from "./Explorer";
import { Segments, type SegmentSeed } from "./Segments";
import { RunLog } from "./RunLog";
import { TagDetailDrawer } from "./TagDetailDrawer";
import { useTagsUrl, type TabKey } from "./useTagsUrl";
import {
  adminFetch, WARN_BOX, ENTITY_TYPES, explorerRows,
  type Definitions, type EntityType, type ExplorerRow, type SegmentPreview, type TagRun,
} from "./shared";

const TABS: { key: TabKey; label: string }[] = [
  { key: "explorer", label: "Explorer" },
  { key: "segments", label: "Find holders" },
  { key: "runs", label: "Run log" },
];

const RUN_POLL_MS = 5000;

export function TagsPage() {
  const { view, go } = useTagsUrl();
  const tab = view.tab;
  const [seed, setSeed] = useState<{ value: SegmentSeed | null; nonce: number }>({ value: null, nonce: 0 });
  // The drawer was opened by a click here, so closing it is a step Back rather
  // than a new history entry — the entry that opened it is the one undone.
  const openedHere = useRef(false);
  const [openEntity, setOpenEntity] = useState<{ type: EntityType; id: string; name: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState("");

  const defsRes = useAdminFetch<{ data: Definitions }>("/admin/tags/definitions", { errorMessage: "Could not load tag definitions." });
  const explorerRes = useAdminFetch<{ data: ExplorerRow[] }>("/admin/tags/explorer", { errorMessage: "Could not load the tag explorer." });
  const runsRes = useAdminFetch<{ data: TagRun[] }>("/admin/tags/runs?limit=30", { errorMessage: "Could not load the run log." });

  const defs = defsRes.data?.data ?? null;
  const runs = useMemo(() => runsRes.data?.data ?? [], [runsRes.data]);
  const lastRun = runs.find((r) => r.status === "done") ?? null;
  const running = runs.some((r) => r.status === "running");

  // While a run is going, keep the log current; stop as soon as it finishes.
  const refreshRuns = runsRes.refresh;
  const refreshExplorer = explorerRes.refresh;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(refreshRuns, RUN_POLL_MS);
    return () => {
      clearInterval(id);
      // The run that just finished may have written tags.
      refreshExplorer();
    };
  }, [running, refreshRuns, refreshExplorer]);

  // Keys seen live or in the last run, per kind — the segment builder's suggestions.
  const seenKeys = useMemo(() => {
    const out = Object.fromEntries(ENTITY_TYPES.map((t) => [t, new Set<string>()])) as Record<EntityType, Set<string>>;
    for (const r of explorerRes.data?.data ?? []) out[r.entityType]?.add(r.key);
    for (const t of ENTITY_TYPES) for (const k of Object.keys(lastRun?.counts?.[t]?.byKey ?? {})) out[t].add(k);
    return Object.fromEntries(ENTITY_TYPES.map((t) => [t, [...out[t]]])) as Record<EntityType, string[]>;
  }, [explorerRes.data, lastRun]);

  const rows = useMemo(() => explorerRows(explorerRes.data?.data ?? null, lastRun, defs), [explorerRes.data, lastRun, defs]);

  const switchTab = (t: TabKey) => {
    openedHere.current = false;
    go({ tab: t, open: null });
  };

  // A key clicked in the explorer opens its drawer; the table stays underneath.
  const openKey = (entityType: EntityType, key: string) => {
    openedHere.current = true;
    go({ open: { entityType, key } });
  };

  const closeKey = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else {
      // Arrived by a link or by Forward: there is no entry of ours to step back over.
      go({ open: null }, "replace");
    }
  }, [go]);

  // From the drawer into the builder, with the count the drawer already made.
  const buildSegment = (entityType: EntityType, key: string, preview: SegmentPreview | null, error: string) => {
    setSeed((s) => ({
      value: { segment: { entityType, all: [key], any: [], none: [] }, preview, error, from: { entityType, key } },
      nonce: s.nonce + 1,
    }));
    switchTab("segments");
  };

  const openRow = view.open
    ? rows.find((r) => r.entityType === view.open?.entityType && r.key === view.open?.key) ?? null
    : null;
  const from = seed.value?.from ?? null;

  const startRun = async () => {
    setStarting(true);
    setMsg("");
    const res = await adminFetch<TagRun>("/admin/tags/runs", { method: "POST" });
    setStarting(false);
    setMsg(res.ok ? "Dry run started — it writes only the run log. This page updates when it finishes." : res.message || "Could not start a run.");
    runsRes.refresh();
  };

  return (
    <div>
      {defs && !defs.live && (
        <div className={`${WARN_BOX} mb-4`}>
          Tagging is in <b>dry-run mode</b>: the nightly run counts what it would tag and writes only the run log.
          Until <span className="font-mono">TAGGING_LIVE=true</span> is set, “Live” counts stay at zero and the
          “Last run” column is what to check.
        </div>
      )}
      {defsRes.error && <div className={`${WARN_BOX} mb-4`}>{defsRes.error}</div>}

      <div className={TAB_BAR}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`${TAB} ${tab === t.key ? TAB_ACTIVE : ""}`} onClick={() => switchTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 text-[12px] text-[#4ade80]">{msg}</div>}

      {tab === "explorer" && (
        <Explorer
          defs={defs}
          lastRun={lastRun}
          rows={rows}
          hasData={Boolean(explorerRes.data)}
          loading={explorerRes.loading}
          error={explorerRes.error}
          type={view.type}
          ns={view.ns}
          q={view.q}
          onType={(t) => go({ type: t, ns: "" })}
          onNs={(ns) => go({ ns })}
          onQ={(q) => go({ q }, "replace")}
          onOpenKey={openKey}
        />
      )}
      {tab === "explorer" && view.open && (
        <TagDetailDrawer
          key={`${view.open.entityType}|${view.open.key}`}
          entityType={view.open.entityType}
          tagKey={view.open.key}
          row={openRow}
          defs={defs}
          layerOpen={openEntity !== null}
          onClose={closeKey}
          onBuildSegment={(preview, error) => view.open && buildSegment(view.open.entityType, view.open.key, preview, error)}
          onOpenEntity={(type, id, name) => setOpenEntity({ type, id, name })}
        />
      )}
      {tab === "segments" && from && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-border bg-surface px-4 py-[10px] text-[12.5px] text-muted">
          <button type="button" onClick={() => { openedHere.current = false; go({ tab: "explorer", open: from }); }}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[12.5px] text-info hover:underline">
            ← Back to {from.key} in the Explorer
          </button>
          <span>Built from that tag. Add more tags below to narrow it.</span>
        </div>
      )}
      {tab === "segments" && (
        <Segments
          key={seed.nonce}
          defs={defs}
          seenKeys={seenKeys}
          seed={seed.value}
          onOpenEntity={(type, id, name) => setOpenEntity({ type, id, name })}
        />
      )}
      {tab === "runs" && (
        <RunLog
          runs={runs}
          loading={runsRes.loading}
          error={runsRes.error}
          live={defs?.live}
          canManage={Boolean(defs?.canManage)}
          starting={starting}
          onStart={startRun}
        />
      )}

      {openEntity && (openEntity.type === "player" || openEntity.type === "organiser") && (
        <UserDetailModal userId={openEntity.id} onClose={() => setOpenEntity(null)} />
      )}
      {openEntity?.type === "game" && <GameDetailModal gameId={openEntity.id} onClose={() => setOpenEntity(null)} />}
      {openEntity?.type === "turf" && (
        <EntityTagsModal entityType="turf" entityId={openEntity.id} title={openEntity.name} onClose={() => setOpenEntity(null)} />
      )}
    </div>
  );
}
