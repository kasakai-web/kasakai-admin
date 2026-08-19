"use client";

/* URL-backed pagination state.
   The page number lives in the query string (`?page=3&limit=50`), never in
   component state — so a page is linkable, survives a refresh, and Back/Forward
   step through the pages the admin actually visited. Writes go through the
   native History API, which Next.js patches to feed `useSearchParams`; that
   keeps a page change on the client with no RSC round trip. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";

/** Rows-per-page choices. 100 is the ceiling everywhere: the admin API clamps
 *  `limit` to 100 as well, so a hand-edited URL can never ask for more. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export type PaginationOptions = {
  /** Namespace for pages that hold more than one list — `key: "wallets"` reads
   *  and writes `?walletsPage` / `?walletsLimit`. Omit for the page's main list. */
  key?: string;
  defaultLimit?: number;
};

export type Pager = {
  /** Page from the URL, un-clamped — `<Pagination>` corrects an out-of-range one. */
  page: number;
  limit: number;
  /** Jump to a page. Pushes history, so Back returns to the previous page. */
  setPage: (page: number) => void;
  /** Change rows-per-page, keeping the first visible row on screen. */
  setLimit: (limit: number) => void;
  /** Back to page 1 — call whenever a filter or the search term changes. */
  resetPage: () => void;
};

function toInt(raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Patch the query string in place. `null` removes a key, so a URL only ever
 *  carries the values that differ from the defaults. */
function writeParams(patch: Record<string, string | null>, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  const qs  = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function usePagination({ key, defaultLimit = DEFAULT_PAGE_SIZE }: PaginationOptions = {}): Pager {
  const searchParams = useSearchParams();

  const pageKey  = key ? `${key}Page`  : "page";
  const limitKey = key ? `${key}Limit` : "limit";

  const page  = toInt(searchParams.get(pageKey), 1);
  const limit = toInt(searchParams.get(limitKey), defaultLimit, MAX_PAGE_SIZE);

  const setPage = useCallback(
    (next: number) => {
      const target = Math.max(1, Math.floor(next));
      writeParams({ [pageKey]: target <= 1 ? null : String(target) }, "push");
    },
    [pageKey],
  );

  /* setLimit and resetPage read the live query string rather than closing over
     `page`/`limit`. That keeps their identity stable for the whole mount, so a
     caller can safely list them in an effect's dependencies — a resetPage that
     changed identity on every page change would rewind the pager it just moved. */

  const setLimit = useCallback(
    (nextLimit: number) => {
      if (typeof window === "undefined") return;
      const params   = new URLSearchParams(window.location.search);
      const curPage  = toInt(params.get(pageKey), 1);
      const curLimit = toInt(params.get(limitKey), defaultLimit, MAX_PAGE_SIZE);
      const target   = Math.min(Math.max(1, Math.floor(nextLimit)), MAX_PAGE_SIZE);
      // Keep the first row that was on screen on screen: viewing rows 51–75 at
      // 25/page should land on the page that still holds row 51 at 50/page.
      const nextPage = Math.floor(((curPage - 1) * curLimit) / target) + 1;
      writeParams(
        {
          [limitKey]: target === defaultLimit ? null : String(target),
          [pageKey]:  nextPage <= 1 ? null : String(nextPage),
        },
        "push",
      );
    },
    [pageKey, limitKey, defaultLimit],
  );

  const resetPage = useCallback(() => {
    if (typeof window === "undefined") return;
    // Absent means page 1 already — nothing to rewind, and no history entry.
    if (!new URLSearchParams(window.location.search).has(pageKey)) return;
    // Replace, not push: a filter change should not leave a stale page in history.
    writeParams({ [pageKey]: null }, "replace");
  }, [pageKey]);

  return { page, limit, setPage, setLimit, resetPage };
}

export type ClientPager<T> = Pager & {
  /** The slice to render. */
  rows: T[];
  total: number;
  totalPages: number;
};

/**
 * Pagination for a list the component already holds in full — the endpoint
 * returns everything, so the slicing happens here. Same URL contract as
 * `usePagination`, so the pager UI and deep links behave identically.
 */
export function useClientPagination<T>(items: T[], options: PaginationOptions = {}): ClientPager<T> {
  const pager = usePagination(options);
  const { page, limit } = pager;

  const total      = items.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  // Rows are sliced from the clamped page so an out-of-range `?page=` shows the
  // last page rather than a blank table while the URL corrects itself.
  const current = Math.min(Math.max(page, 1), totalPages);

  const rows = useMemo(
    () => items.slice((current - 1) * limit, current * limit),
    [items, current, limit],
  );

  return { ...pager, rows, total, totalPages };
}

/**
 * Reset to page 1 whenever the filters change. Pass anything that narrows the
 * list (search text, dropdown values); the mounting render is ignored so a deep
 * link like `?page=4` survives, and only a later change rewinds the pager.
 */
export function useResetPageOnFilterChange(resetPage: () => void, deps: unknown[]) {
  const signature = JSON.stringify(deps);
  const seen = useRef(signature);
  useEffect(() => {
    if (seen.current === signature) return;
    seen.current = signature;
    resetPage();
  }, [signature, resetPage]);
}
