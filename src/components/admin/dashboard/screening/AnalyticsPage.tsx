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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", flex: 1, minWidth: 130, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color, borderRadius: "14px 14px 0 0" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
        <p style={{ margin: 0, fontSize: "10px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: "8px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      </div>
      <p style={{ margin: "0 0 3px", fontSize: "24px", fontWeight: 800, color: "var(--white)", lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>{sub}</p>}
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────────── */
function Section({ title, sub, children, accent }: { title: string; sub?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", marginBottom: "16px" }}>
      {accent && <div style={{ height: "3px", background: accent }} />}
      <div style={{ padding: "20px 22px" }}>
        <div style={{ marginBottom: "18px" }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--white)" }}>{title}</p>
          {sub && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>{sub}</p>}
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
          <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--white)", lineHeight: 1 }}>{Math.round(pct * 100)}%</span>
          <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600, marginTop: "3px" }}>filled</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontWeight: 700 }}>
        <span style={{ color }}>{sold} sold</span>
        <span style={{ color: "var(--muted)" }}>{capacity - sold} left</span>
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: height + 40, paddingBottom: "32px", position: "relative" }}>
      {/* Y-axis guide lines */}
      {[0, 50, 100].map(pct => (
        <div key={pct} style={{ position: "absolute", left: 0, right: 0, bottom: 32 + (pct / 100) * height,
          borderTop: "1px dashed rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      ))}
      {bars.map((b, i) => {
        const barH   = maxVal > 0 ? Math.max(4, Math.round((b.value / maxVal) * height)) : 4;
        const c      = typeof color === "function" ? color(i) : color;
        return (
          <div key={`${b.label}-${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--white)" }}>{b.value > 0 ? b.value : ""}</span>
            <div style={{ width: "100%", height: barH, background: c, borderRadius: "4px 4px 0 0", opacity: b.value === 0 ? 0.15 : 1, transition: "height 0.4s ease" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center" }} />
            <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--muted)", textAlign: "center", maxWidth: "60px", lineHeight: 1.2, marginTop: "4px" }}>{b.label}</span>
            {b.sub && <span style={{ fontSize: "9px", color: "var(--muted2)", textAlign: "center", maxWidth: "60px", lineHeight: 1.2 }}>{b.sub}</span>}
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
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--white)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color }}>{value}</span>
          {valueSub && <span style={{ fontSize: "10px", color: "var(--muted)" }}>{valueSub}</span>}
        </div>
      </div>
      <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.5s ease" }} />
      </div>
      <div style={{ marginTop: "4px", fontSize: "10px", color: "var(--muted)", textAlign: "right" }}>{pct}%</div>
    </div>
  );
}

/* ── Quick action button ────────────────────────────────────────────────── */
function ActionBtn({ label, sub, color, icon, onClick }: {
  label: string; sub?: string; color: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px",
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer",
        textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.background = `${color}0a`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)"; }}>
      <div style={{ width: 36, height: 36, borderRadius: "9px", background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--white)" }}>{label}</div>
        {sub && <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "1px" }}>{sub}</div>}
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
    <div style={{ paddingBottom: 48 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#a78bfa", letterSpacing: "0.15em", textTransform: "uppercase" }}>Event Analytics</p>
          <h2 style={{ margin: "0 0 2px", fontSize: "20px", fontWeight: 800, color: "var(--white)" }}>Analytics Dashboard</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginTop: "2px", flexWrap: "wrap" }}>
          <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
          {onRefresh && (
            <button type="button" onClick={handleRefresh} disabled={refreshing}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "11px", fontWeight: 600, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={refreshing ? "animate-spin" : ""}>
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button type="button" onClick={handleExport} disabled={exporting}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", background: "rgba(91,230,178,0.1)", border: "1px solid rgba(91,230,178,0.3)", borderRadius: "8px", color: "#5be6b2", fontSize: "11px", fontWeight: 700, cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.7 : 1 }}>
            {exporting
              ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10"/></svg>
              : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }
            {exporting ? "Exporting…" : "Export .xlsx"}
          </button>
        </div>
      </div>

      <div style={{ height: "1px", background: "var(--border)", margin: "16px 0 20px" }} />

      {/* ── STAT CARDS ── */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
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
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "14px", padding: "40px 24px", textAlign: "center", marginBottom: "16px" }}>
          <div style={{ width: 52, height: 52, borderRadius: "12px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "var(--white)" }}>No Tickets Sold Yet</p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>Sales data will appear here once users start booking.</p>
        </div>
      )}

      {/* ── TWO-COLUMN: Capacity ring + Booking status ── */}
      {hasSales && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

          {/* Capacity ring */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: 800, color: "var(--white)" }}>Capacity Fill</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <CapacityRing sold={analytics.totalTicketsSold} capacity={analytics.totalCapacity} color={ringColor} />
            </div>
          </div>

          {/* Booking status histogram */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: 800, color: "var(--white)" }}>Booking Status</p>
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
            <div key={t.tierId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: "12px" }}>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>{t.tierName}</span>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ color: "#5be6b2", fontWeight: 700 }}>{t.sold} sold</span>
                <span style={{ color: "var(--muted)" }}>{t.capacity - t.sold} left</span>
                <span style={{ color: "var(--muted2)", minWidth: "30px", textAlign: "right" }}>
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
            <div key={t.tierId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: "12px" }}>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>{t.tierName} · ₹{Math.round(t.pricePaise / 100).toLocaleString("en-IN")} / ticket</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>₹{(t.revenuePaise / 100).toLocaleString("en-IN")}</span>
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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "520px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Ticket Type","Price","Capacity","Sold","Available","Revenue","Fill %"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.tierStats.map(t => {
                const fp   = t.capacity > 0 ? Math.round((t.sold / t.capacity) * 100) : 0;
                const col  = fp >= 90 ? "#f87171" : fp >= 60 ? "#fbbf24" : "#5be6b2";
                return (
                  <tr key={t.tierId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "11px 14px", color: "var(--white)", fontWeight: 600 }}>{t.tierName}</td>
                    <td style={{ padding: "11px 14px", color: "var(--muted)" }}>₹{Math.round(t.pricePaise / 100).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text)" }}>{t.capacity}</td>
                    <td style={{ padding: "11px 14px", color: t.sold > 0 ? "#5be6b2" : "var(--muted)", fontWeight: t.sold > 0 ? 700 : 400 }}>{t.sold > 0 ? t.sold : "—"}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text)" }}>{t.capacity - t.sold}</td>
                    <td style={{ padding: "11px 14px", color: "var(--text)" }}>{t.revenuePaise > 0 ? `₹${(t.revenuePaise / 100).toLocaleString("en-IN")}` : "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: col }}>{fp}%</span>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: "rgba(91,230,178,0.03)" }}>
                <td style={{ padding: "11px 14px", color: "#5be6b2", fontWeight: 800 }}>Totals</td>
                <td style={{ padding: "11px 14px", color: "var(--muted)" }}>—</td>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--white)" }}>{analytics.totalCapacity}</td>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: hasSales ? "#5be6b2" : "var(--muted)" }}>{hasSales ? analytics.totalTicketsSold : "—"}</td>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--white)" }}>{analytics.totalCapacity - analytics.totalTicketsSold}</td>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--white)" }}>{analytics.totalRevenuePaise > 0 ? `₹${(analytics.totalRevenuePaise / 100).toLocaleString("en-IN")}` : "—"}</td>
                <td style={{ padding: "11px 14px", fontWeight: 800, color: ringColor }}>{fillPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px", marginBottom: "16px" }}>
        <p style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 800, color: "var(--white)" }}>Quick Actions</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
