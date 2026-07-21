"use client";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type ExcelJS from "exceljs";
import { ScrEvent, backBtnStyle } from "./types";
import type { ScrAnalyticsData, ScrExportRow } from "@/lib/screening-api";
import { scrApi } from "@/lib/screening-api";

/* ── Export helpers ─────────────────────────────────────────────────────── */

type BadgeStyle = { label: string; color: string; bg: string; border: string };

// Brand colours
const C = {
  green:      "1B8C5A",  // Kasa Kai lime-green (dark)
  greenLight: "5BE6B2",  // accent teal
  headerBg:   "0D1F17",  // near-black green
  rowAlt:     "F0FAF6",  // very light green tint
  white:      "FFFFFF",
  black:      "0A0A0A",
  muted:      "6B7280",
  border:     "D1D5DB",
  redBg:      "FFF1F2",
  redText:    "B91C1C",
  amberBg:    "FFFBEB",
  amberText:  "92400E",
  blueBg:     "EFF6FF",
  blueText:   "1E40AF",
};

async function generateExcelAndDownload(rows: ScrExportRow[], eventTitle: string, analytics: ScrAnalyticsData) {
  // Dynamic import — exceljs is large, only load on demand
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Kasa Kai Admin";
  wb.created  = new Date();

  // ── Shared style helpers ────────────────────────────────────────────────
  const hdrFont  = { name: "Calibri", bold: true,  size: 11, color: { argb: "FF" + C.white } };
  const bodyFont = { name: "Calibri", bold: false, size: 10, color: { argb: "FF" + C.black } };
  const mutedFont = { name: "Calibri", bold: false, size: 10, color: { argb: "FF" + C.muted } };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top:    { style: "thin" as const, color: { argb: "FF" + C.border } },
    left:   { style: "thin" as const, color: { argb: "FF" + C.border } },
    bottom: { style: "thin" as const, color: { argb: "FF" + C.border } },
    right:  { style: "thin" as const, color: { argb: "FF" + C.border } },
  };

  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };
  const leftAlign:   Partial<ExcelJS.Alignment> = { horizontal: "left",   vertical: "middle" };
  const rightAlign:  Partial<ExcelJS.Alignment> = { horizontal: "right",  vertical: "middle" };

  // ── SHEET 1: Attendees ──────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Attendees", {
    views: [{ state: "frozen", ySplit: 3 }],   // freeze rows 1+2 (title + header)
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws1.columns = [
    { key: "no",        width: 5  },
    { key: "name",      width: 24 },
    { key: "email",     width: 30 },
    { key: "phone",     width: 16 },
    { key: "ticket",    width: 20 },
    { key: "qty",       width: 6  },
    { key: "amount",    width: 14 },
    { key: "code",      width: 14 },
    { key: "status",    width: 14 },
    { key: "bookedAt",  width: 20 },
    { key: "checkedIn", width: 20 },
    { key: "txnId",     width: 28 },
  ];

  // Row 1 — Title banner
  ws1.mergeCells("A1:L1");
  const titleCell1 = ws1.getCell("A1");
  titleCell1.value          = `${eventTitle}  —  Attendees Export`;
  titleCell1.font           = { name: "Calibri", bold: true, size: 14, color: { argb: "FF" + C.greenLight } };
  titleCell1.fill           = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
  titleCell1.alignment      = leftAlign;
  ws1.getRow(1).height      = 32;

  // Row 2 — export meta right-aligned
  ws1.mergeCells("A2:H2");
  const metaLeft = ws1.getCell("A2");
  metaLeft.value     = `Exported on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}   ·   ${rows.length} ticket record(s)`;
  metaLeft.font      = mutedFont;
  metaLeft.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
  metaLeft.alignment = leftAlign;

  ws1.mergeCells("I2:L2");
  const metaRight = ws1.getCell("I2");
  metaRight.value     = `Total Revenue: ₹${(analytics.totalRevenuePaise / 100).toLocaleString("en-IN")}`;
  metaRight.font      = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.greenLight } };
  metaRight.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
  metaRight.alignment = rightAlign;
  ws1.getRow(2).height = 20;

  // Row 3 — Column headers
  const hdrs1 = ["#", "Name", "Email", "Phone", "Ticket Type", "Qty", "Amount (₹)", "Entry Code", "Status", "Booked At", "Checked In At", "Transaction ID"];
  const hdrRow1 = ws1.getRow(3);
  hdrRow1.height = 24;
  hdrs1.forEach((h, i) => {
    const cell = hdrRow1.getCell(i + 1);
    cell.value     = h;
    cell.font      = hdrFont;
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.green } };
    cell.alignment = i === 0 ? centerAlign : leftAlign;
    cell.border    = thinBorder;
  });

  // Data rows
  const totalRevCheck = rows.reduce((s, r) => s + r.grossAmount, 0);
  rows.forEach((r, i) => {
    const isCheckedIn = r.redeemedStatus === "Yes";
    const rowNum      = i + 4;
    const isAlt       = i % 2 === 1;
    const fillColor   = isAlt ? "FF" + C.rowAlt : "FFFFFFFF";
    const dataRow     = ws1.getRow(rowNum);
    dataRow.height    = 20;

    const vals = [
      i + 1,
      r.name     || "",
      r.email    || "",
      r.phone    || "",
      r.ticketName || "",
      r.numberOfTickets,
      r.grossAmount,
      r.shortcode || "",
      isCheckedIn ? "✓ Checked In" : "Confirmed",
      r.transactionTime || "",
      isCheckedIn ? (r.transactionLastModifiedTime || "") : "",
      r.transactionId || "",
    ];

    vals.forEach((v, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value     = v;
      cell.font      = bodyFont;
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.border    = thinBorder;
      cell.alignment = (ci === 0 || ci === 5) ? centerAlign : leftAlign;

      // Format amount as number
      if (ci === 6 && typeof v === "number") {
        cell.numFmt = "#,##0";
      }

      // Status cell — colour-coded
      if (ci === 8) {
        cell.font = {
          name: "Calibri", size: 10, bold: true,
          color: { argb: isCheckedIn ? "FF" + C.green : "FF" + C.blueText },
        };
      }
    });
  });

  // Totals row
  const totRow     = ws1.getRow(rows.length + 4);
  totRow.height    = 22;
  const totLabels  = ["", "TOTAL", "", "", "", rows.reduce((s, r) => s + r.numberOfTickets, 0), totalRevCheck, "", "", "", "", ""];
  totLabels.forEach((v, ci) => {
    const cell = totRow.getCell(ci + 1);
    cell.value  = v;
    cell.font   = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.white } };
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.green } };
    cell.border = thinBorder;
    cell.alignment = (ci === 5 || ci === 6) ? centerAlign : leftAlign;
    if (ci === 6) cell.numFmt = "#,##0";
  });

  // Auto-filter on header row
  ws1.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 12 } };

  // ── SHEET 2: Summary ────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });

  ws2.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 20 },
    { key: "pad",   width: 4  },
    { key: "l2",    width: 18 },
    { key: "v2",    width: 14 },
  ];

  const totalSold = analytics.totalTicketsSold;
  const totalRev  = analytics.totalRevenuePaise / 100;
  const fillPct   = analytics.totalCapacity > 0 ? Math.round((totalSold / analytics.totalCapacity) * 100) : 0;

  function addSectionHeader(ws: ExcelJS.Worksheet, row: number, label: string, cols: number) {
    ws.mergeCells(row, 1, row, cols);
    const cell = ws.getCell(row, 1);
    cell.value     = label;
    cell.font      = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.greenLight } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
    cell.alignment = leftAlign;
    cell.border    = thinBorder;
    ws.getRow(row).height = 22;
  }

  function addKV(ws: ExcelJS.Worksheet, row: number, label: string, value: string | number, bold = false, highlight = false) {
    const lc = ws.getCell(row, 1);
    lc.value     = label;
    lc.font      = mutedFont;
    lc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
    lc.border    = thinBorder;
    lc.alignment = leftAlign;

    const vc = ws.getCell(row, 2);
    vc.value     = value;
    vc.font      = { name: "Calibri", bold, size: 11, color: { argb: highlight ? "FF" + C.green : "FF" + C.black } };
    vc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
    vc.border    = thinBorder;
    vc.alignment = leftAlign;
    if (typeof value === "number") vc.numFmt = "#,##0";
    ws.getRow(row).height = 20;
  }

  let r = 1;

  // Title
  ws2.mergeCells(r, 1, r, 5);
  const t2 = ws2.getCell(r, 1);
  t2.value     = `${eventTitle}  —  Event Summary`;
  t2.font      = { name: "Calibri", bold: true, size: 15, color: { argb: "FF" + C.greenLight } };
  t2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
  t2.alignment = leftAlign;
  ws2.getRow(r).height = 36;
  r++;

  ws2.mergeCells(r, 1, r, 5);
  const sub2 = ws2.getCell(r, 1);
  sub2.value     = `Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", weekday: "long" })}`;
  sub2.font      = mutedFont;
  sub2.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.headerBg } };
  sub2.alignment = leftAlign;
  ws2.getRow(r).height = 20;
  r++; r++;

  // — Overview —
  addSectionHeader(ws2, r, "  OVERVIEW", 2); r++;
  addKV(ws2, r, "Total Capacity",     analytics.totalCapacity);              r++;
  addKV(ws2, r, "Tickets Sold",       totalSold,  true, true);               r++;
  addKV(ws2, r, "Remaining Slots",    analytics.totalCapacity - totalSold);  r++;
  addKV(ws2, r, "Fill Rate",          `${fillPct}%`, true);                  r++;
  r++;

  // — Booking Status —
  addSectionHeader(ws2, r, "  BOOKING STATUS", 2); r++;
  addKV(ws2, r, "Confirmed",          analytics.confirmedCount); r++;
  addKV(ws2, r, "Checked In",         analytics.usedCount, true, true); r++;
  addKV(ws2, r, "Cancelled",          analytics.cancelledCount); r++;
  addKV(ws2, r, "Check-In Rate",      `${analytics.checkInRate}%`, true); r++;
  r++;

  // — Revenue —
  addSectionHeader(ws2, r, "  REVENUE", 2); r++;
  addKV(ws2, r, "Gross Revenue",      totalRev, true, true); r++;
  r++; r++;

  // — Tier Breakdown table —
  addSectionHeader(ws2, r, "  TIER BREAKDOWN", 7); r++;

  // Tier table headers
  const tierHdrs = ["Ticket Type", "Price (₹)", "Capacity", "Sold", "Available", "Fill %", "Revenue (₹)"];
  const thRow    = ws2.getRow(r);
  thRow.height   = 22;
  tierHdrs.forEach((h, ci) => {
    const cell = thRow.getCell(ci + 1);
    cell.value     = h;
    cell.font      = hdrFont;
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.green } };
    cell.alignment = ci === 0 ? leftAlign : centerAlign;
    cell.border    = thinBorder;
  });
  r++;

  analytics.tierStats.forEach((t, ti) => {
    const fp      = t.capacity > 0 ? Math.round((t.sold / t.capacity) * 100) : 0;
    const isAlt   = ti % 2 === 1;
    const fgColor = isAlt ? "FF" + C.rowAlt : "FFFFFFFF";
    const tr      = ws2.getRow(r);
    tr.height     = 20;

    const vals = [
      t.tierName,
      Math.round(t.pricePaise / 100),
      t.capacity,
      t.sold,
      t.capacity - t.sold,
      `${fp}%`,
      Math.round(t.revenuePaise / 100),
    ];
    vals.forEach((v, ci) => {
      const cell = tr.getCell(ci + 1);
      cell.value     = v;
      cell.font      = bodyFont;
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: fgColor } };
      cell.alignment = ci === 0 ? leftAlign : centerAlign;
      cell.border    = thinBorder;
      if (ci === 1 || ci === 6) cell.numFmt = "#,##0";
    });
    r++;
  });

  // Totals row for tier table
  const totals2Row = ws2.getRow(r);
  totals2Row.height = 22;
  const totals2Vals = [
    "TOTAL",
    "",
    analytics.totalCapacity,
    totalSold,
    analytics.totalCapacity - totalSold,
    `${fillPct}%`,
    Math.round(totalRev),
  ];
  totals2Vals.forEach((v, ci) => {
    const cell = totals2Row.getCell(ci + 1);
    cell.value     = v;
    cell.font      = { name: "Calibri", bold: true, size: 10, color: { argb: "FF" + C.white } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + C.green } };
    cell.alignment = ci === 0 ? leftAlign : centerAlign;
    cell.border    = thinBorder;
    if (ci === 2 || ci === 3 || ci === 4 || ci === 6) cell.numFmt = "#,##0";
  });

  // ── Download ────────────────────────────────────────────────────────────
  const safeName = eventTitle.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  const fileName = `${safeName}_tickets_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative min-w-[130px] flex-1 overflow-hidden rounded-[14px] border border-border bg-surface px-5 py-[18px]">
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px]" style={{ background: color }} />
      <div className="mb-[10px] flex items-start justify-between">
        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>{icon}</div>
      </div>
      <p className="mb-[3px] text-[24px] font-extrabold leading-[1.1] text-fg">{value}</p>
      {sub && <p className="m-0 text-[11px] leading-[1.4] text-muted">{sub}</p>}
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────────── */
function Section({ title, sub, children, accent }: { title: string; sub?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="mb-4 overflow-hidden rounded-[14px] border border-border bg-surface">
      {accent && <div className="h-[3px]" style={{ background: accent }} />}
      <div className="px-[22px] py-5">
        <div className="mb-[18px]">
          <p className="m-0 text-[14px] font-extrabold text-fg">{title}</p>
          {sub && <p className="mt-[2px] text-[11px] text-muted">{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Capacity ring (SVG donut) ──────────────────────────────────────────── */
function CapacityRing({ sold, capacity, color }: { sold: number; capacity: number; color: string }) {
  const pct  = capacity > 0 ? Math.min(1, sold / capacity) : 0;
  const R    = 54;
  const circ = 2 * Math.PI * R;
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[140px] w-[140px]">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
          <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            className="transition-[stroke-dasharray] duration-[600ms] ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-extrabold leading-none text-fg">{Math.round(pct * 100)}%</span>
          <span className="mt-[3px] text-[10px] font-semibold text-muted">filled</span>
        </div>
      </div>
      <div className="flex gap-4 text-[11px] font-bold">
        <span style={{ color }}>{sold} sold</span>
        <span className="text-muted">{capacity - sold} left</span>
      </div>
    </div>
  );
}

/* ── Vertical bar chart ─────────────────────────────────────────────────── */
function VerticalBars({ bars, height = 120, color }: {
  bars: { label: string; value: number; sub?: string }[];
  height?: number;
  color: string | ((i: number) => string);
}) {
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="relative flex items-end gap-[10px] pb-8" style={{ height: height + 40 }}>
      {/* Y-axis guide lines */}
      {[0, 50, 100].map(pct => (
        <div key={pct} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[rgba(255,255,255,0.04)]" style={{ bottom: 32 + (pct / 100) * height }} />
      ))}
      {bars.map((b, i) => {
        const barH   = maxVal > 0 ? Math.max(4, Math.round((b.value / maxVal) * height)) : 4;
        const c      = typeof color === "function" ? color(i) : color;
        return (
          <div key={`${b.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-extrabold text-fg">{b.value > 0 ? b.value : ""}</span>
            <div className={`w-full rounded-t-[4px] transition-[height] duration-[400ms] ease-out ${b.value === 0 ? "opacity-15" : "opacity-100"}`} style={{ height: barH, background: c }} />
            <div className="absolute inset-x-0 bottom-0 text-center" />
            <span className="mt-1 max-w-[60px] text-center text-[9px] font-bold leading-[1.2] text-muted">{b.label}</span>
            {b.sub && <span className="max-w-[60px] text-center text-[9px] leading-[1.2] text-muted-2">{b.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Horizontal bar row ─────────────────────────────────────────────────── */
function HBar({ label, value, total, valueSub, color }: {
  label: string; value: number; total: number; valueSub?: string; color: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="mb-4">
      <div className="mb-[6px] flex items-baseline justify-between">
        <span className="text-[12px] font-bold text-fg">{label}</span>
        <div className="flex items-baseline gap-[6px]">
          <span className="text-[14px] font-extrabold" style={{ color }}>{value}</span>
          {valueSub && <span className="text-[10px] text-muted">{valueSub}</span>}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-[4px] bg-[rgba(255,255,255,0.05)]">
        <div className="h-full rounded-[4px] transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted">{pct}%</div>
    </div>
  );
}

/* ── Quick action button ────────────────────────────────────────────────── */
function ActionBtn({ label, sub, color, icon, onClick }: {
  label: string; sub?: string; color: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-border bg-[#0b1114] px-[14px] py-3 text-left transition-[border-color,background] duration-150"
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.background = `${color}0a`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)"; }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border" style={{ background: `${color}18`, borderColor: `${color}30` }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-fg">{label}</div>
        {sub && <div className="mt-px text-[10px] text-muted">{sub}</div>}
      </div>
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--muted2)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export function ScrAnalyticsPage({ ev, eventId, analytics, badge, onBack, onRefresh }: {
  ev: ScrEvent;
  eventId: string;
  analytics: ScrAnalyticsData;
  badge: BadgeStyle;
  onBack: () => void;
  onRefresh?: () => void;
}) {
  const router                    = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh, refreshing]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await scrApi.exportTickets(eventId);
      if (!data.rows.length) { alert("No confirmed ticket data to export."); return; }
      await generateExcelAndDownload(data.rows, data.eventTitle, analytics);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [eventId, exporting]);

  const hasSales  = analytics.totalTicketsSold > 0;
  const fillPct   = analytics.totalCapacity > 0
    ? Math.round((analytics.totalTicketsSold / analytics.totalCapacity) * 100) : 0;
  const ringColor = fillPct >= 90 ? "#f87171" : fillPct >= 60 ? "#fbbf24" : "#5be6b2";

  // Tier bar data
  const tierBars = analytics.tierStats.map(t => ({
    label: t.tierName,
    value: t.sold,
    sub:   `/ ${t.capacity}`,
  }));

  // Revenue bar data
  const maxRev   = Math.max(...analytics.tierStats.map(t => t.revenuePaise), 1);
  const revBars  = analytics.tierStats.map(t => ({
    label: t.tierName,
    value: t.revenuePaise > 0 ? Math.round(t.revenuePaise / 100) : 0,
    sub:   t.revenuePaise > 0 ? `₹${Math.round(t.revenuePaise / 100).toLocaleString("en-IN")}` : "₹0",
  }));

  const statusItems = [
    { label: "Confirmed",   value: analytics.confirmedCount,  color: "#60a5fa" },
    { label: "Checked In",  value: analytics.usedCount,       color: "#5be6b2" },
    { label: "Cancelled",   value: analytics.cancelledCount,  color: "#f87171" },
  ];
  const maxStatus = Math.max(...statusItems.map(s => s.value), 1);

  return (
    <div className="pb-12">

      {/* ── Header ── */}
      <div className="mb-2 flex flex-wrap items-start gap-[14px]">
        <button type="button" onClick={onBack} className={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a78bfa]">Event Analytics</p>
          <h2 className="mb-[2px] text-[20px] font-extrabold text-fg">Analytics Dashboard</h2>
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted">{ev.title}</p>
        </div>
        <div className="mt-[2px] flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-[11px] font-bold" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>{badge.label}</span>
          {onRefresh && (
            <button type="button" onClick={handleRefresh} disabled={refreshing}
              className={`inline-flex items-center gap-[5px] rounded-lg border border-border bg-surface px-[13px] py-[7px] text-[11px] font-semibold text-muted ${refreshing ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={refreshing ? "animate-spin" : ""}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button type="button" onClick={handleExport} disabled={exporting}
            className={`inline-flex items-center gap-[5px] rounded-lg border border-[rgba(91,230,178,0.3)] bg-[rgba(91,230,178,0.1)] px-[14px] py-[7px] text-[11px] font-bold text-accent ${exporting ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}>
            {exporting
              ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/></svg>
              : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }
            {exporting ? "Exporting…" : "Export .xlsx"}
          </button>
        </div>
      </div>

      <div className="mx-0 mb-5 mt-4 h-px bg-border" />

      {/* ── STAT CARDS ── */}
      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Tickets Sold" value={String(analytics.totalTicketsSold)}
          sub={`of ${analytics.totalCapacity} capacity · ${fillPct}% full`} color="#5be6b2"
          icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>} />
        <StatCard label="Gross Revenue"
          value={analytics.totalRevenuePaise > 0 ? `₹${(analytics.totalRevenuePaise / 100).toLocaleString("en-IN")}` : "₹0"}
          sub={hasSales ? "from confirmed + used tickets" : "No sales yet"} color="#a78bfa"
          icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <StatCard label="Check-In Rate" value={`${analytics.checkInRate}%`}
          sub={`${analytics.usedCount} scanned of ${analytics.confirmedCount + analytics.usedCount} confirmed`} color="#60a5fa"
          icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>} />
        <StatCard label="Remaining" value={String(analytics.totalCapacity - analytics.totalTicketsSold)}
          sub={`${analytics.cancelledCount} cancelled`} color="#f59e0b"
          icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
      </div>

      {/* ── NO SALES PLACEHOLDER ── */}
      {!hasSales && (
        <div className="mb-4 rounded-[14px] border border-dashed border-border bg-surface px-6 py-10 text-center">
          <div className="mx-auto mb-[14px] flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-[rgba(91,230,178,0.2)] bg-[rgba(91,230,178,0.08)]">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
          </div>
          <p className="mb-1 text-[15px] font-extrabold text-fg">No Tickets Sold Yet</p>
          <p className="m-0 text-[12px] leading-[1.6] text-muted">Sales data will appear here once users start booking.</p>
        </div>
      )}

      {/* ── TWO-COLUMN: Capacity ring + Booking status ── */}
      {hasSales && (
        <div className="mb-4 grid grid-cols-2 gap-4">

          {/* Capacity ring */}
          <div className="rounded-[14px] border border-border bg-surface px-[22px] py-5">
            <p className="mb-[18px] text-[14px] font-extrabold text-fg">Capacity Fill</p>
            <div className="flex justify-center">
              <CapacityRing sold={analytics.totalTicketsSold} capacity={analytics.totalCapacity} color={ringColor} />
            </div>
          </div>

          {/* Booking status histogram */}
          <div className="rounded-[14px] border border-border bg-surface px-[22px] py-5">
            <p className="mb-[18px] text-[14px] font-extrabold text-fg">Booking Status</p>
            <VerticalBars
              bars={statusItems.map(s => ({ label: s.label, value: s.value }))}
              color={i => statusItems[i].color}
              height={110}
            />
          </div>
        </div>
      )}

      {/* ── TIER SALES HISTOGRAM ── */}
      {analytics.tierStats.length > 0 && (
        <Section title="Tickets Sold by Tier" sub="Confirmed + used tickets per tier vs capacity" accent="#5be6b2">
          {analytics.tierStats.length === 1 ? (
            <HBar
              label={analytics.tierStats[0].tierName}
              value={analytics.tierStats[0].sold}
              total={analytics.tierStats[0].capacity}
              valueSub={`of ${analytics.tierStats[0].capacity}`}
              color="#5be6b2"
            />
          ) : (
            <VerticalBars bars={tierBars} color="#5be6b2" height={130} />
          )}
          {analytics.tierStats.map(t => (
            <div key={t.tierId} className="flex items-center justify-between border-t border-border py-[9px] text-[12px]">
              <span className="font-semibold text-muted">{t.tierName}</span>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent">{t.sold} sold</span>
                <span className="text-muted">{t.capacity - t.sold} left</span>
                <span className="min-w-[30px] text-right text-muted-2">
                  {t.capacity > 0 ? `${Math.round((t.sold / t.capacity) * 100)}%` : "—"}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* ── REVENUE HISTOGRAM ── */}
      {hasSales && analytics.tierStats.some(t => t.revenuePaise > 0) && (
        <Section title="Revenue by Tier" sub="Total revenue from confirmed + used tickets" accent="#a78bfa">
          {analytics.tierStats.length === 1 ? (
            <HBar
              label={analytics.tierStats[0].tierName}
              value={Math.round(analytics.tierStats[0].revenuePaise / 100)}
              total={Math.max(...analytics.tierStats.map(t => t.revenuePaise), 1) / 100}
              valueSub={`₹${Math.round(analytics.tierStats[0].revenuePaise / 100).toLocaleString("en-IN")}`}
              color="#a78bfa"
            />
          ) : (
            <VerticalBars
              bars={revBars.map(b => ({ label: b.label, value: b.value }))}
              color="#a78bfa"
              height={130}
            />
          )}
          {analytics.tierStats.filter(t => t.revenuePaise > 0).map(t => (
            <div key={t.tierId} className="flex items-center justify-between border-t border-border py-[9px] text-[12px]">
              <span className="font-semibold text-muted">{t.tierName} · ₹{Math.round(t.pricePaise / 100).toLocaleString("en-IN")} / ticket</span>
              <span className="font-bold text-[#a78bfa]">₹{(t.revenuePaise / 100).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </Section>
      )}

      {/* ── CHECK-IN RATE BAR ── */}
      {hasSales && (analytics.confirmedCount + analytics.usedCount) > 0 && (
        <Section title="Check-In Rate" sub="Percentage of confirmed ticket holders who have scanned in" accent="#60a5fa">
          <HBar
            label="Checked In"
            value={analytics.usedCount}
            total={analytics.confirmedCount + analytics.usedCount}
            valueSub={`of ${analytics.confirmedCount + analytics.usedCount} confirmed`}
            color="#60a5fa"
          />
        </Section>
      )}

      {/* ── TIER BREAKDOWN TABLE ── */}
      <Section title="Full Tier Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border">
                {["Ticket Type","Price","Capacity","Sold","Available","Revenue","Fill %"].map(h => (
                  <th key={h} className="whitespace-nowrap px-[14px] py-[10px] text-left font-bold text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.tierStats.map(t => {
                const fp   = t.capacity > 0 ? Math.round((t.sold / t.capacity) * 100) : 0;
                const col  = fp >= 90 ? "#f87171" : fp >= 60 ? "#fbbf24" : "#5be6b2";
                return (
                  <tr key={t.tierId} className="border-b border-border">
                    <td className="px-[14px] py-[11px] font-semibold text-fg">{t.tierName}</td>
                    <td className="px-[14px] py-[11px] text-muted">₹{Math.round(t.pricePaise / 100).toLocaleString("en-IN")}</td>
                    <td className="px-[14px] py-[11px] text-body">{t.capacity}</td>
                    <td className={`px-[14px] py-[11px] ${t.sold > 0 ? "font-bold text-accent" : "font-normal text-muted"}`}>{t.sold > 0 ? t.sold : "—"}</td>
                    <td className="px-[14px] py-[11px] text-body">{t.capacity - t.sold}</td>
                    <td className="px-[14px] py-[11px] text-body">{t.revenuePaise > 0 ? `₹${(t.revenuePaise / 100).toLocaleString("en-IN")}` : "—"}</td>
                    <td className="px-[14px] py-[11px]">
                      <span className="text-[11px] font-extrabold" style={{ color: col }}>{fp}%</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[rgba(91,230,178,0.03)]">
                <td className="px-[14px] py-[11px] font-extrabold text-accent">Totals</td>
                <td className="px-[14px] py-[11px] text-muted">—</td>
                <td className="px-[14px] py-[11px] font-bold text-fg">{analytics.totalCapacity}</td>
                <td className={`px-[14px] py-[11px] font-bold ${hasSales ? "text-accent" : "text-muted"}`}>{hasSales ? analytics.totalTicketsSold : "—"}</td>
                <td className="px-[14px] py-[11px] font-bold text-fg">{analytics.totalCapacity - analytics.totalTicketsSold}</td>
                <td className="px-[14px] py-[11px] font-bold text-fg">{analytics.totalRevenuePaise > 0 ? `₹${(analytics.totalRevenuePaise / 100).toLocaleString("en-IN")}` : "—"}</td>
                <td className="px-[14px] py-[11px] font-extrabold" style={{ color: ringColor }}>{fillPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── QUICK ACTIONS ── */}
      <div className="mb-4 rounded-[14px] border border-border bg-surface px-[22px] py-5">
        <p className="mb-[14px] text-[14px] font-extrabold text-fg">Quick Actions</p>
        <div className="grid grid-cols-2 gap-[10px]">
          <ActionBtn label="Manage Event" sub="Edit details, shows, tickets"
            color="#5be6b2"
            onClick={() => router.push(`/dashboard/streaming/${eventId}/manage`)}
            icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>} />
          <ActionBtn label="Attendees" sub="View all ticket holders"
            color="#a78bfa"
            onClick={() => router.push(`/dashboard/streaming/${eventId}/attendees`)}
            icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
          <ActionBtn label="Door Scan" sub="Scan entry codes at venue"
            color="#60a5fa"
            onClick={() => router.push(`/dashboard/streaming/${eventId}/scan`)}
            icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M17 17h3M17 14h3"/></svg>} />
          <ActionBtn label="Export Tickets" sub="Download .xlsx with all bookings"
            color="#f59e0b"
            onClick={handleExport}
            icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} />
        </div>
      </div>

    </div>
  );
}
