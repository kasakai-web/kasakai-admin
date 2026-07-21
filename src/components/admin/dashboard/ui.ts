/* Shared Tailwind atoms migrated 1:1 from dashboard.module.css.
   Repeated design-system class groups as utility-string constants — values match
   the original module exactly (see globals.css @theme for the colour tokens). */

// Toolbar + inputs (shared with the football dashboard)
export const TOOLBAR = "mb-[18px] flex flex-wrap gap-[10px]";
export const SEARCH_INPUT =
  "min-w-[260px] flex-1 border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";
export const FILTER_SELECT =
  "border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";

// Screening: event cards
export const SCR_EVENT_CARD =
  "mb-[14px] flex overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color] duration-150 hover:border-border-2 max-[640px]:flex-col";
export const SCR_EVENT_CARD_IMG =
  "h-[200px] w-[150px] min-w-[150px] shrink-0 overflow-hidden bg-surface-2 max-[640px]:h-[180px] max-[640px]:w-full max-[640px]:min-w-[unset]";
export const SCR_EVENT_CARD_CONTENT =
  "flex min-w-0 flex-1 flex-col px-6 py-5 max-[640px]:p-4";

// Screening: cards + form grids
export const SCR_CARD =
  "mb-4 rounded-[14px] border border-border bg-surface p-6 max-[640px]:p-4";
export const SCR_GRID2 = "grid grid-cols-2 gap-4 max-[900px]:grid-cols-1";
export const SCR_GRID_POC =
  "grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1";

// Screening: manage / view layouts + tabs
export const SCR_MANAGE_LAYOUT =
  "grid grid-cols-[1fr_260px] items-start gap-6 max-[900px]:grid-cols-1 max-[700px]:grid-cols-1";
export const SCR_MANAGE_SIDEBAR = "flex flex-col gap-3 max-[900px]:order-[-1]";
export const SCR_MANAGE_TAB_BAR = "mb-6 flex border-b border-border";
export const SCR_MANAGE_TAB =
  "mb-[-1px] flex-1 cursor-pointer border-none border-b-2 border-b-transparent bg-transparent px-4 py-3 text-center text-[13px] font-semibold text-muted transition-[color,border-color] duration-150 hover:text-body";
export const SCR_MANAGE_TAB_ACTIVE = "text-fg! border-b-accent!";
export const SCR_VIEW_LAYOUT =
  "grid grid-cols-[1fr_300px] items-start gap-6 max-[900px]:grid-cols-1";
