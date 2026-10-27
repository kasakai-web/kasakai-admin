"use client";

/* Where the admin is on the Tags page, in the query string:
   ?tab=segments · ?type=game&ns=fill&q=sold · ?on=player&tag=venue:loyal:x

   It used to be component state, so a clicked tag was a one-way door: Back left
   the page, and returning to the Explorer reset its filters. In the URL, Back and
   Forward walk through what the admin actually did, a tag's drawer is linkable,
   and the filters survive a trip to the segment builder. Writes go through the
   same History-API helper as the pagers (shared/usePagination), so nothing makes
   a server round trip. */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { writeParams } from "../shared/usePagination";
import { ENTITY_TYPES, type EntityType } from "./shared";

export const TAB_KEYS = ["explorer", "segments", "runs"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
export type TypeFilter = EntityType | "all";

export type TagsView = {
  tab: TabKey;
  /** Which kind the Explorer lists. */
  type: TypeFilter;
  /** Explorer namespace filter; "" = all. */
  ns: string;
  /** Explorer search text. */
  q: string;
  /** The tag whose drawer is open. */
  open: { entityType: EntityType; key: string } | null;
};

export type TagsPatch = Partial<{
  tab: TabKey;
  type: TypeFilter;
  ns: string;
  q: string;
  open: { entityType: EntityType; key: string } | null;
}>;

const DEFAULT_TAB: TabKey = "explorer";
const DEFAULT_TYPE: TypeFilter = "player";

const isEntity = (v: string | null): v is EntityType => !!v && (ENTITY_TYPES as string[]).includes(v);
const isTab = (v: string | null): v is TabKey => !!v && (TAB_KEYS as readonly string[]).includes(v);

export function useTagsUrl() {
  const sp = useSearchParams();

  const view = useMemo<TagsView>(() => {
    const tab = sp.get("tab");
    const type = sp.get("type");
    const on = sp.get("on");
    const key = sp.get("tag");
    return {
      tab: isTab(tab) ? tab : DEFAULT_TAB,
      type: type === "all" || isEntity(type) ? type : DEFAULT_TYPE,
      ns: sp.get("ns") ?? "",
      q: sp.get("q") ?? "",
      open: key && isEntity(on) ? { entityType: on, key } : null,
    };
  }, [sp]);

  /** Push by default, so Back undoes it; "replace" for keystrokes. Defaults leave the URL. */
  const go = useCallback((patch: TagsPatch, mode: "push" | "replace" = "push") => {
    const out: Record<string, string | null> = {};
    if ("tab" in patch) out.tab = patch.tab && patch.tab !== DEFAULT_TAB ? patch.tab : null;
    if ("type" in patch) out.type = patch.type && patch.type !== DEFAULT_TYPE ? patch.type : null;
    if ("ns" in patch) out.ns = patch.ns || null;
    if ("q" in patch) out.q = patch.q || null;
    if ("open" in patch) {
      out.on = patch.open?.entityType ?? null;
      out.tag = patch.open?.key ?? null;
    }
    writeParams(out, mode);
  }, []);

  return { view, go };
}
