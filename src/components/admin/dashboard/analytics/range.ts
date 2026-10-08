/* Date presets shared by the Analytics topics — IST calendar days, sent to the
   backend as from/to (inclusive YMD). Weeks run Monday to Sunday. */

export type Preset =
  | "all" | "today" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth"
  | "30" | "90" | "year" | "next30" | "upcoming" | "custom";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "lastWeek", label: "Last week (Mon–Sun)" },
  { key: "lastMonth", label: "Last month" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "next30", label: "Next 30 days" },
  { key: "upcoming", label: "All upcoming" },
  { key: "custom", label: "Custom range" },
];

/** Players have nothing to show for a game not yet played. */
export const PAST_PRESETS = PRESETS.filter((p) => p.key !== "next30" && p.key !== "upcoming");

export const istYMD = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const shiftDays = (n: number) => istYMD(new Date(Date.now() + n * 86_400_000));

/* A calendar day, read at noon IST so no timezone can move it to a neighbour. */
export const dayDate = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`);

/** "2026-08" → the first and last IST day of that month. */
export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

export function presetRange(p: Preset, custom: { from: string; to: string } = { from: "", to: "" }) {
  const today = istYMD(new Date());
  const sinceMonday = (dayDate(today).getUTCDay() + 6) % 7;
  if (p === "today") return { from: today, to: today };
  if (p === "thisWeek") return { from: shiftDays(-sinceMonday), to: today };
  if (p === "lastWeek") return { from: shiftDays(-sinceMonday - 7), to: shiftDays(-sinceMonday - 1) };
  if (p === "thisMonth") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (p === "lastMonth") {
    const [y, m] = today.split("-").map(Number);
    return monthRange(new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7));
  }
  if (p === "30") return { from: shiftDays(-29), to: today };
  if (p === "90") return { from: shiftDays(-89), to: today };
  if (p === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (p === "next30") return { from: today, to: shiftDays(29) };
  if (p === "upcoming") return { from: today, to: "" };
  if (p === "custom") return custom;
  return { from: "", to: "" };
}

/** from/to as query params; empty ends are left off. */
export function rangeQuery({ from, to }: { from: string; to: string }) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return q;
}
