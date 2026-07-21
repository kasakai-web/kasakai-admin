"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { scrApi, type ScrAdminTicket, type ApiScrEvent } from "@/lib/screening-api";
import { backBtnStyle, scrStatusBadge } from "./types";

type StatusFilter = "all" | "confirmed" | "used" | "pending" | "cancelled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "All"        },
  { key: "confirmed", label: "Confirmed"  },
  { key: "used",      label: "Checked In" },
  { key: "pending",   label: "Pending"    },
  { key: "cancelled", label: "Cancelled"  },
];

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string; label: string }> = {
  confirmed: { color: "#5be6b2", bg: "rgba(91,230,178,0.1)",  border: "rgba(91,230,178,0.25)",  label: "Confirmed"   },
  used:       { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)", label: "Checked In"  },
  pending:    { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)",  label: "Pending"     },
  cancelled:  { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   label: "Cancelled"   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { color: "var(--muted)", bg: "var(--surface2)", border: "var(--border)", label: status };
  return (
    <span className="whitespace-nowrap rounded-full border px-[10px] py-[3px] text-[11px] font-bold" style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      {s.label}
    </span>
  );
}

function exportCsv(tickets: ScrAdminTicket[], eventTitle: string) {
  const rows = [
    ["Entry Code", "Name", "Email", "Phone", "Tickets", "Total (₹)", "Status", "Booked At", "Scanned At"],
    ...tickets.map(t => [
      t.entryCode,
      t.player?.name ?? "—",
      t.player?.email ?? "—",
      t.player?.phone ?? "—",
      (t.lineItems ?? []).map(li => `${li.quantity}x ${li.tierName}`).join("; "),
      String(Math.round((t.totalPaise ?? 0) / 100)),
      t.status,
      t.bookedAt ? new Date(t.bookedAt).toLocaleString("en-IN") : "—",
      t.usedAt   ? new Date(t.usedAt).toLocaleString("en-IN")   : "—",
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `attendees-${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportCsvBtn({ event, statusFilter, search, total }: {
  event: ApiScrEvent;
  statusFilter: StatusFilter;
  search: string;
  total: number;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting || total === 0) return;
    setExporting(true);
    try {
      // Fetch all matching tickets in one shot — no page cap on backend when limit is explicit
      const result = await scrApi.getEventTickets(event._id, {
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
        page: 1,
        limit: 9999,
      });
      exportCsv(result.tickets, event.title);
    } catch {
      alert("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={total === 0 || exporting}
      className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-4 py-[9px] text-[12px] font-bold text-accent ${(total === 0 || exporting) ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100"}`}>
      {exporting ? (
        <svg className="animate-spin" width="13" height="13" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#5be6b2" strokeWidth="3" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0110 10" stroke="#5be6b2" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      )}
      {exporting ? "Exporting…" : `Export CSV${total > 0 ? ` (${total})` : ""}`}
    </button>
  );
}

export function ScrAttendeesPage({ event, onBack }: { event: ApiScrEvent; onBack: () => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search,       setSearch]       = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [tickets,  setTickets]  = useState<ScrAdminTicket[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const badge = scrStatusBadge(event.status);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    scrApi.getEventTickets(event._id, {
      status: statusFilter === "all" ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      page,
    })
      .then(d => { setTickets(d.tickets); setTotal(d.total); })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [event._id, statusFilter, debouncedSearch, page]);

  const LIMIT = 50;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-start gap-[14px]">
        <button type="button" onClick={onBack} className={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a78bfa]">Attendees</p>
          <h2 className="mb-[2px] text-[20px] font-extrabold text-fg">Ticket Holders</h2>
          <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted">{event.title}</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border px-[14px] py-[5px] text-[11px] font-bold" style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}>{badge.label}</span>
      </div>

      <div className="mx-0 mb-5 mt-4 h-px bg-border" />

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, entry code…"
            className="box-border w-full rounded-[9px] border border-border bg-[#0b1114] py-[9px] pl-[34px] pr-3 text-[13px] text-fg outline-none"
          />
        </div>
        <ExportCsvBtn event={event} statusFilter={statusFilter} search={debouncedSearch} total={total} />
      </div>

      {/* Status tabs */}
      <div className="mb-5 flex flex-wrap gap-[6px]">
        {STATUS_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => { setStatusFilter(t.key); setPage(1); }}
            className={`cursor-pointer rounded-full border px-[14px] py-[6px] text-[12px] font-bold transition-all duration-150 ${statusFilter === t.key ? "border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.12)] text-[#a78bfa]" : "border-border bg-transparent text-muted"}`}>
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center whitespace-nowrap text-[12px] text-muted">
          {loading ? "Loading…" : `${total} ticket${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Table */}
      {error ? (
        <div className="p-8 text-center text-[13px] text-danger">{error}</div>
      ) : loading ? (
        <div className="flex justify-center px-0 py-[60px]">
          <svg className="animate-spin" width="26" height="26" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="3" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : tickets.length === 0 ? (
        <div className="px-0 py-[60px] text-center">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.2" strokeLinecap="round" className="mx-auto mb-3 block">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-.01c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 4.81 17 6 19 6a1 1 0 011 1z"/>
          </svg>
          <p className="m-0 text-[14px] text-muted">No tickets found</p>
          {(search || statusFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-3 cursor-pointer rounded-lg border border-border bg-transparent px-4 py-[7px] text-[12px] text-muted">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* Table header */}
            <div className="grid grid-cols-[160px_1fr_1fr_130px_80px_110px] gap-0 border-b border-border bg-[rgba(0,0,0,0.2)] px-[18px] py-[10px]">
              {["Entry Code","Attendee","Tickets","Total","Status","Booked"].map(h => (
                <span key={h} className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{h}</span>
              ))}
            </div>
            {/* Rows */}
            {tickets.map((t, i) => (
              <div key={t._id} className={`grid grid-cols-[160px_1fr_1fr_130px_80px_110px] items-center gap-0 px-[18px] py-[14px] ${i < tickets.length - 1 ? "border-b border-border" : ""}`}>
                <span className="font-mono text-[13px] font-extrabold tracking-[0.14em] text-fg">{t.entryCode}</span>
                <div>
                  <p className="mb-px text-[13px] font-semibold text-fg">{t.player?.name ?? <span className="text-muted-2">Unknown</span>}</p>
                  <p className="m-0 text-[11px] text-muted">{t.player?.email ?? "—"}</p>
                </div>
                <div className="text-[12px] leading-[1.6] text-muted">
                  {(t.lineItems ?? []).map((li, j) => (
                    <span key={j}>{j > 0 && ", "}{li.quantity}× {li.tierName}</span>
                  ))}
                </div>
                <span className="text-[13px] font-bold text-fg">
                  ₹{Math.round((t.totalPaise ?? 0) / 100).toLocaleString("en-IN")}
                </span>
                <StatusBadge status={t.status} />
                <span className="text-[11px] text-muted">
                  {t.bookedAt ? new Date(t.bookedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className={`rounded-lg border border-border bg-transparent px-4 py-[7px] text-[12px] text-muted ${page <= 1 ? "cursor-not-allowed opacity-40" : "cursor-pointer opacity-100"}`}>
                Prev
              </button>
              <span className="text-[12px] text-muted">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={`rounded-lg border border-border bg-transparent px-4 py-[7px] text-[12px] text-muted ${page >= totalPages ? "cursor-not-allowed opacity-40" : "cursor-pointer opacity-100"}`}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
