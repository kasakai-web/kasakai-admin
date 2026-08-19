"use client";

/* The one pager every admin list renders.
   First / Prev / numbered pages with ellipsis jumps / Next / Last, a
   rows-per-page picker capped at 100, a "go to page" box, and the
   "showing X–Y of Z" line. Page state comes from the URL (see usePagination),
   so every control here just writes a number back to the query string. */

import { useEffect, useState } from "react";
import { PAGE_SIZE_OPTIONS, MAX_PAGE_SIZE } from "./usePagination";

/** How far the … buttons skip. Big enough to be worth clicking on a long list. */
const ELLIPSIS_JUMP = 5;

const stepBtn = (disabled: boolean) =>
  `whitespace-nowrap rounded-md border px-[11px] py-[6px] font-mono text-[12px] font-bold tracking-[0.04em] transition-[background,border-color] duration-150 ${
    disabled
      ? "cursor-not-allowed border-border bg-transparent text-muted-2 opacity-50"
      : "cursor-pointer border-info bg-[rgba(59,130,246,0.14)] text-fg hover:bg-[rgba(59,130,246,0.24)]"
  }`;

const numBtn = (active: boolean) =>
  `min-w-[32px] rounded-md border px-[9px] py-[6px] text-center font-mono text-[12.5px] font-bold transition-[background,border-color] duration-150 ${
    active
      ? "cursor-default border-[#facc15] bg-[#facc15] text-[#0b1114]"
      : "cursor-pointer border-border-2 bg-surface text-body hover:border-info hover:text-fg"
  }`;

const gapBtn =
  "min-w-[28px] cursor-pointer rounded-md border border-transparent px-1 py-[6px] text-center font-mono text-[12.5px] text-muted transition-colors duration-150 hover:border-border-2 hover:text-fg";

/**
 * Page numbers to render, with "gap" markers where pages are skipped.
 * Keeps first and last always visible plus `siblings` either side of current,
 * so the control never changes width as the admin walks through the pages.
 */
function pageItems(current: number, totalPages: number, siblings = 1): (number | "gap-left" | "gap-right")[] {
  const slots = siblings * 2 + 5; // first + last + current + siblings + 2 gaps
  if (totalPages <= slots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const left  = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, totalPages);
  const gapLeft  = left > 2;
  const gapRight = right < totalPages - 1;
  const run = 3 + siblings * 2;

  if (!gapLeft && gapRight) {
    return [...Array.from({ length: run }, (_, i) => i + 1), "gap-right", totalPages];
  }
  if (gapLeft && !gapRight) {
    return [1, "gap-left", ...Array.from({ length: run }, (_, i) => totalPages - run + 1 + i)];
  }
  return [1, "gap-left", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "gap-right", totalPages];
}

export type PaginationProps = {
  /** Page as it stands in the URL. An out-of-range value corrects itself. */
  page: number;
  limit: number;
  /** Rows matching the current filters, across every page. */
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  /** Plural noun for the summary line — "users", "games", "transactions". */
  label?: string;
  /** Drop the rows-per-page picker (lists whose page size is fixed). */
  hideLimit?: boolean;
  className?: string;
};

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  label = "rows",
  hideLimit = false,
  className = "",
}: PaginationProps) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const current    = Math.min(Math.max(page, 1), totalPages);
  const [jump, setJump] = useState("");

  // A hand-typed `?page=999` (or a page that emptied out after a delete) is
  // pulled back to the last real page rather than showing an empty table.
  useEffect(() => {
    if (total > 0 && page !== current) onPageChange(current);
  }, [total, page, current, onPageChange]);

  if (total === 0) return null;

  const firstRow = (current - 1) * limit + 1;
  const lastRow  = Math.min(current * limit, total);

  const go = (target: number) => {
    const next = Math.min(Math.max(Math.round(target), 1), totalPages);
    if (next !== current) onPageChange(next);
  };

  const submitJump = () => {
    const n = Number.parseInt(jump, 10);
    if (Number.isFinite(n)) go(n);
    setJump("");
  };

  const sizeOptions = PAGE_SIZE_OPTIONS.includes(limit as (typeof PAGE_SIZE_OPTIONS)[number])
    ? [...PAGE_SIZE_OPTIONS]
    : [...PAGE_SIZE_OPTIONS, limit].sort((a, b) => a - b);

  return (
    <nav
      aria-label="Pagination"
      className={`mt-[14px] flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${className}`}
    >
      {/* Left: what you are looking at, and how much of it fits on a page */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-[12px] text-muted" aria-live="polite">
          Showing <strong className="text-fg">{firstRow.toLocaleString("en-IN")}</strong>–
          <strong className="text-fg">{lastRow.toLocaleString("en-IN")}</strong> of{" "}
          <strong className="text-fg">{total.toLocaleString("en-IN")}</strong> {label}
        </div>

        {!hideLimit && onLimitChange && (
          <label className="flex items-center gap-[6px] text-[11px] uppercase tracking-[0.1em] text-muted">
            Rows
            <select
              aria-label="Rows per page"
              className="cursor-pointer rounded-md border border-border-2 bg-surface px-2 py-[5px] font-mono text-[12px] normal-case tracking-normal text-fg"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              {sizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right: the pager itself — only worth drawing past a single page */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-[6px]">
          <button className={stepBtn(current <= 1)} type="button" disabled={current <= 1}
            aria-label="First page" title="First page" onClick={() => go(1)}>« First</button>
          <button className={stepBtn(current <= 1)} type="button" disabled={current <= 1}
            aria-label="Previous page" title="Previous page" onClick={() => go(current - 1)}>‹ Prev</button>

          {pageItems(current, totalPages).map((item, i) =>
            typeof item === "number" ? (
              <button
                key={item}
                type="button"
                className={numBtn(item === current)}
                aria-current={item === current ? "page" : undefined}
                aria-label={`Page ${item}`}
                onClick={() => go(item)}
              >
                {item}
              </button>
            ) : (
              <button
                key={`${item}-${i}`}
                type="button"
                className={gapBtn}
                title={item === "gap-left" ? `Back ${ELLIPSIS_JUMP} pages` : `Forward ${ELLIPSIS_JUMP} pages`}
                aria-label={item === "gap-left" ? `Back ${ELLIPSIS_JUMP} pages` : `Forward ${ELLIPSIS_JUMP} pages`}
                onClick={() => go(item === "gap-left" ? current - ELLIPSIS_JUMP : current + ELLIPSIS_JUMP)}
              >
                …
              </button>
            ),
          )}

          <button className={stepBtn(current >= totalPages)} type="button" disabled={current >= totalPages}
            aria-label="Next page" title="Next page" onClick={() => go(current + 1)}>Next ›</button>
          <button className={stepBtn(current >= totalPages)} type="button" disabled={current >= totalPages}
            aria-label="Last page" title="Last page" onClick={() => go(totalPages)}>Last »</button>

          {/* Straight to a page — the only sane control once a list runs long */}
          {totalPages > 5 && (
            <span className="ml-1 flex items-center gap-[5px] text-[11px] uppercase tracking-[0.1em] text-muted">
              Go to
              <input
                type="number"
                min={1}
                max={totalPages}
                inputMode="numeric"
                placeholder={String(current)}
                aria-label={`Go to page (1 to ${totalPages})`}
                className="w-[62px] rounded-md border border-border-2 bg-surface px-2 py-[5px] font-mono text-[12px] normal-case tracking-normal text-fg"
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitJump(); } }}
              />
              <button
                type="button"
                className={stepBtn(jump.trim() === "")}
                disabled={jump.trim() === ""}
                onClick={submitJump}
              >
                Go
              </button>
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

export { MAX_PAGE_SIZE };
