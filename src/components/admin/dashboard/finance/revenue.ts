/* Finance → revenue: the shapes GET /admin/revenue and /admin/revenue/summary
   return, the labels both the box and the tab print, and the tab's Excel sheet.

   What counts as money received is decided on the server
   (backend/src/utils/revenueReport.js): what players paid for seats still held,
   plus cancellation fees kept, on COMPLETED games, by IST kick-off day. Wallet
   top-ups are not revenue. Nothing here re-derives any of it. */

import { formatCurrency } from "../shared/format";
import { dayDate } from "../analytics/range";
import type { Sheet } from "../analytics/exportExcel";

export type RevenueFigures = {
  completedGames: number;
  cancelledGames: number;
  /** Games in the period not completed yet — their money is still open to refunds. */
  pendingGames: number;
  pendingPaise: number;
  seatPaise: number;
  feePaise: number;
  paidSeats: number;
  passSeats: number;
  passCoveredPaise: number;
  offerSeats: number;
  offerDiscountPaise: number;
  receivedPaise: number;
  /** Over completed games only; null when there were none. */
  avgPerGamePaise: number | null;
};

export type RevenuePeriod = "today" | "this_week" | "this_month" | "last_month";

export const REVENUE_PERIODS: { key: RevenuePeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

export type RevenueSummary = RevenueFigures & {
  period: RevenuePeriod;
  from: string;
  to: string;
  generatedAt: string;
  comparison: null | {
    from: string;
    to: string;
    label: string;
    receivedPaise: number;
    completedGames: number;
    avgPerGamePaise: number | null;
    pct: number | null;
    reason: "not_enough_data" | "nothing_before" | null;
  };
  minCompareGames: number;
};

export type Grouping = "day" | "week" | "month";

export type RevenueRow = RevenueFigures & {
  /** The first day of the day / week / month. */
  key: string;
  /** The days of it inside the range — narrower than the period when `partial`. */
  from: string;
  to: string;
  partial: boolean;
  /** Holds today: its figures are "so far". */
  current: boolean;
};

export type RevenueReport = {
  generatedAt: string;
  today: string;
  filters: {
    by: Grouping;
    from: string | null;
    to: string | null;
    metro: string | null;
    metroLabel: string | null;
    organiser: string | null;
    organiserName: string | null;
  };
  capped: boolean;
  maxDays: number;
  periods: RevenueRow[];
  totals: RevenueFigures;
  organisers: { id: string; name: string; games: number }[];
};

/** Whole rupees — an average of ₹2,858.23 reads as ₹2,858. */
export const formatRupees = (paise: number | null | undefined) =>
  paise == null ? "—" : formatCurrency(Math.round(paise / 100) * 100);

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(dayDate(ymd));

/** "1 – 30 Oct 2026", "29 Sep – 5 Oct 2026", "30 Oct 2026". */
export function rangeText(from: string, to: string) {
  if (from === to) return fmt(from, { day: "numeric", month: "short", year: "numeric" });
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(0, 7) === to.slice(0, 7);
  const start = sameMonth ? fmt(from, { day: "numeric" }) : fmt(from, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  return `${start} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** The table's name for a row: "Thu, 30 Oct", "27 Oct – 2 Nov", "Oct 2026". */
export function periodLabel(row: Pick<RevenueRow, "key" | "from" | "to">, by: Grouping, withYear = false) {
  const year = withYear ? { year: "numeric" as const } : {};
  if (by === "day") return fmt(row.key, { weekday: "short", day: "numeric", month: "short", ...year });
  if (by === "week") return `${fmt(row.from, { day: "numeric", month: "short" })} – ${fmt(row.to, { day: "numeric", month: "short", ...year })}`;
  return fmt(row.key, { month: "short", year: "numeric" });
}

/** The chart's shorter name for a column. */
export function columnLabel(row: Pick<RevenueRow, "key">, by: Grouping, withYear = false) {
  if (by === "month") return fmt(row.key, withYear ? { month: "short", year: "2-digit" } : { month: "short" });
  return fmt(row.key, { day: "numeric", month: "short" });
}

/** Do the rows span more than one calendar year? Labels then carry the year. */
export const spansYears = (rows: RevenueRow[]) =>
  rows.length > 0 && rows[0].key.slice(0, 4) !== rows[rows.length - 1].to.slice(0, 4);

const GROUP_NAME: Record<Grouping, string> = { day: "Day", week: "Week (Mon–Sun)", month: "Month" };

const rs = (paise: number | null) => (paise == null ? null : Math.round(paise) / 100);

/** The tab's table as one worksheet, newest first, with its totals row. */
export function revenueSheet(report: RevenueReport, view: string): Sheet {
  const by = report.filters.by;
  const withYear = spansYears(report.periods);
  const line = (name: string, f: RevenueFigures, extra: Record<string, unknown> = {}) => ({
    period: name,
    ...extra,
    games: f.completedGames,
    cancelled: f.cancelledGames,
    paidSeats: f.paidSeats,
    seat: rs(f.seatPaise),
    fees: rs(f.feePaise),
    received: rs(f.receivedPaise),
    avg: rs(f.avgPerGamePaise),
    passSeats: f.passSeats,
    pass: rs(f.passCoveredPaise),
    offerSeats: f.offerSeats,
    offer: rs(f.offerDiscountPaise),
    pendingGames: f.pendingGames,
    pending: rs(f.pendingPaise),
  });
  return {
    name: "Revenue",
    notes: [
      `Revenue received per ${GROUP_NAME[by].toLowerCase()} — ${view}`,
      "Money players paid for seats they kept, plus cancellation fees kept, on completed games, by kick-off day (IST). Amounts in ₹.",
      "Wallet top-ups are not revenue. Cancelled games bring in ₹0 and are not in the average. Pass cover and offer discounts are shown beside the total, not taken off it.",
      ...(report.capped ? [`Daily view cut to the latest ${report.maxDays} days.`] : []),
    ],
    columns: [
      { header: GROUP_NAME[by], key: "period", width: 20 },
      { header: "From", key: "from", width: 12 },
      { header: "To", key: "to", width: 12 },
      { header: "Games played", key: "games" },
      { header: "Cancelled", key: "cancelled" },
      { header: "Paid seats", key: "paidSeats" },
      { header: "Seat payments ₹", key: "seat", width: 16 },
      { header: "Fees kept ₹", key: "fees" },
      { header: "Total received ₹", key: "received", width: 16 },
      { header: "Avg per game ₹", key: "avg", width: 15 },
      { header: "Pass-covered seats", key: "passSeats", width: 17 },
      { header: "Pass-covered ₹", key: "pass", width: 15 },
      { header: "Offer seats", key: "offerSeats" },
      { header: "Offer discounts ₹", key: "offer", width: 16 },
      { header: "Not yet completed (games)", key: "pendingGames", width: 22 },
      { header: "Not yet completed ₹", key: "pending", width: 18 },
    ],
    rows: [
      ...[...report.periods].reverse().map((p) =>
        line(`${periodLabel(p, by, withYear)}${p.current ? " (so far)" : ""}`, p, { from: p.from, to: p.to })),
      line("Total", report.totals, { from: report.filters.from, to: report.filters.to }),
    ],
  };
}
