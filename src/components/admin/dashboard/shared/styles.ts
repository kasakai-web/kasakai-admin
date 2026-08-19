/* Shared Tailwind atoms for the admin dashboard sections.
   Migrated 1:1 from dashboard.module.css — values match the original module
   exactly (see globals.css @theme for the colour tokens). One-off styles stay
   inlined on their elements; only repeated design-system groups live here. */

// Section chrome
export const SECTION_HEAD = "mb-[18px] flex items-center justify-between max-[900px]:flex-wrap max-[900px]:gap-[10px]";
export const SECTION_TITLE = "font-mono text-[14px] font-medium uppercase tracking-[0.08em]";
export const SECTION_SUB = "mt-[3px] text-[13.5px] text-muted";
// Stat / summary grids (1px gap over the border-coloured bg draws the cell separators)
export const STATS_GRID = "mb-6 grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
export const QUICK_STATS = "grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
export const SUMMARY_FOUR = "grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-1";
export const PAYMENT_SUMMARY = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1";
export const SUMMARY_THREE = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1";
export const STAT_CARD = "bg-surface px-[22px] py-5";
export const SUMMARY_ITEM = "bg-surface p-4";
export const PAY_CARD = "bg-surface p-4";
export const STAT_LABEL = "mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-muted";
export const STAT_VALUE = "mb-[6px] font-mono text-[36px] font-medium text-fg";
export const SUMMARY_VALUE = "font-mono text-[24px] font-medium text-fg";
export const PAY_VALUE = "font-mono text-[24px] font-medium text-fg";
export const STAT_DELTA = "font-mono text-[12px]";
export const UP = "text-success";
export const DOWN = "text-danger";
export const NEUTRAL = "text-muted";
export const PAY_SUB = "mt-1 font-mono text-[11px] text-muted";
// Panels
export const TWO_COL = "mb-6 grid grid-cols-2 gap-5 max-[900px]:grid-cols-1";
export const PANEL = "border border-border bg-surface px-5 py-[18px]";
export const PANEL_WARN = "border-[rgba(245,158,11,0.25)]!";
export const PANEL_TITLE = "mb-[6px] text-[15px] font-semibold text-fg";
export const PANEL_SUB = "mb-3 text-[13.5px] text-muted";
export const FEED = "flex flex-col gap-[10px]";
export const FEED_ROW = "flex items-center justify-between gap-[10px]";
export const FEED_TITLE = "text-[13.5px] text-body";
export const FEED_SUB = "mt-[3px] font-mono text-[11px] text-muted";
// Badges (BADGE is always paired with a colour variant, so it carries no colour itself)
export const BADGE = "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[3px] border px-2 py-[3px] font-mono text-[11px] tracking-[0.08em]";
export const BADGE_GREEN = "border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] text-success";
export const BADGE_AMBER = "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] text-warning";
export const BADGE_RED = "border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] text-danger";
export const BADGE_BLUE = "border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)] text-info";
export const BADGE_VIOLET = "border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] text-violet";
export const BADGE_GRAY = "border-border-2 bg-[rgba(255,255,255,0.05)] text-muted";
// Toolbar + inputs
export const TOOLBAR = "mb-[18px] flex flex-wrap gap-[10px]";
export const SEARCH_INPUT = "min-w-[260px] flex-1 border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";
export const FILTER_SELECT = "border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg";
// Tables (cell rules applied via descendant variants; per-cell overrides use `!`)
export const TABLE_WRAP = "overflow-x-auto border border-border";
export const TABLE = "w-full min-w-[760px] border-collapse max-[900px]:min-w-[1000px] [&_th]:sticky [&_th]:top-0 [&_th]:z-[2] [&_th]:whitespace-nowrap [&_th]:border-b-2 [&_th]:border-b-info [&_th]:bg-[image:linear-gradient(180deg,#1a252d_0%,#121a1f_100%)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10.5px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-fg [&_td]:border-b [&_td]:border-b-border-2 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td]:text-[14px] [&_td]:text-body [&_tbody_tr:hover]:bg-[rgba(255,255,255,0.025)]";
// Buttons
export const ACTION_BTN = "cursor-pointer border border-border-2 bg-transparent px-[10px] py-1 font-mono text-[11px] tracking-[0.06em] text-muted hover:border-[#555] hover:text-fg";
export const ACTIONS = "flex gap-[6px]";
export const TOPBAR_BTN = "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
export const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
// Feedback / status
export const FORM_ERROR = "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
export const LOADING_STATE = "px-6 py-12 text-center text-[14px] text-muted";
// Modals
export const MODAL_OVERLAY = "fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[rgba(0,0,0,0.65)] px-4 py-10 backdrop-blur-[4px]";
export const MODAL = "w-full max-w-[720px] rounded-xl border border-border-2 bg-surface p-7 max-[640px]:px-4 max-[640px]:py-5";
export const MODAL_LARGE = "max-w-[900px]!";
export const MODAL_HEAD = "mb-6 flex items-center justify-between";
export const MODAL_CLOSE = "cursor-pointer rounded-md border-none bg-transparent px-2 py-1 text-[18px] text-muted transition-[background] duration-150 hover:bg-surface-2 hover:text-fg";
export const MODAL_FORM = "flex flex-col gap-5";
export const MODAL_ACTIONS = "flex justify-end gap-[10px] border-t border-border pt-2";
export const FORM_GRID = "grid grid-cols-2 gap-[14px] max-[640px]:grid-cols-1";
export const FORM_LABEL = "flex flex-col gap-[6px] text-[12px] uppercase tracking-[0.05em] text-muted [&_input]:mt-[2px] [&_select]:mt-[2px]";
export const CHECKBOX_ROW = "flex flex-wrap gap-4";
export const CHECK_LABEL = "flex cursor-pointer items-center gap-2 text-[13px] text-body";
// Game detail
export const GAME_INFO_GRID = "mb-5 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-2";
export const GAME_INFO_CELL = "bg-surface px-4 py-[14px] text-[13px] text-body";
export const BLOCK_TITLE = "mt-4 mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-warning";
export const BLOCK_TITLE_SUCCESS = "mt-4 mb-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-success";
// Notifications feed
export const NOTIF_FEED = "flex flex-col overflow-hidden border border-border";
export const NOTIF_ITEM = "flex items-start justify-between gap-[14px] border-b border-border-2 px-4 py-[14px]";
export const NOTIF_MSG = "text-[14px] leading-[1.45] text-body";
export const NOTIF_TIME = "mt-1 font-mono text-[11px] text-muted";
// Tab bar
export const TAB_BAR = "mb-5 flex border-b border-border";
export const TAB = "mb-[-1px] cursor-pointer border-none border-b-2 border-b-transparent bg-transparent px-[18px] py-[10px] font-mono text-[12px] uppercase tracking-[0.06em] text-muted transition-[color,border-color] duration-150 hover:text-body";
export const TAB_ACTIVE = "text-fg! border-b-fg!";
