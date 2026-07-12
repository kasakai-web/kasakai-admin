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
    <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: "nowrap" }}>
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
      style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 16px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.25)", borderRadius: "9px", color: "#5be6b2", fontSize: "12px", fontWeight: 700, cursor: (total === 0 || exporting) ? "not-allowed" : "pointer", opacity: (total === 0 || exporting) ? 0.5 : 1, whiteSpace: "nowrap" }}>
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
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#a78bfa", letterSpacing: "0.15em", textTransform: "uppercase" }}>Attendees</p>
          <h2 style={{ margin: "0 0 2px", fontSize: "20px", fontWeight: 800, color: "var(--white)" }}>Ticket Holders</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</p>
        </div>
        <span style={{ flexShrink: 0, marginTop: "4px", padding: "5px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
      </div>

      <div style={{ height: "1px", background: "var(--border)", margin: "16px 0 20px" }} />

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, entry code…"
            style={{ width: "100%", padding: "9px 12px 9px 34px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "9px", color: "var(--white)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <ExportCsvBtn event={event} statusFilter={statusFilter} search={debouncedSearch} total={total} />
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
        {STATUS_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => { setStatusFilter(t.key); setPage(1); }}
            style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, cursor: "pointer", border: "1px solid", transition: "all 0.15s",
              background:   statusFilter === t.key ? "rgba(167,139,250,0.12)" : "none",
              borderColor:  statusFilter === t.key ? "rgba(167,139,250,0.4)"  : "var(--border)",
              color:        statusFilter === t.key ? "#a78bfa"                : "var(--muted)",
            }}>
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)", alignSelf: "center", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : `${total} ticket${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Table */}
      {error ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>{error}</div>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <svg className="animate-spin" width="26" height="26" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="3" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.2" strokeLinecap="round" style={{ display: "block", margin: "0 auto 12px" }}>
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-.01c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 4.81 17 6 19 6a1 1 0 011 1z"/>
          </svg>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>No tickets found</p>
          {(search || statusFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} style={{ marginTop: "12px", padding: "7px 16px", background: "none", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "12px", cursor: "pointer" }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 130px 80px 110px", gap: "0", padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
              {["Entry Code","Attendee","Tickets","Total","Status","Booked"].map(h => (
                <span key={h} style={{ fontSize: "10px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {tickets.map((t, i) => (
              <div key={t._id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 130px 80px 110px", gap: "0", padding: "14px 18px", borderBottom: i < tickets.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--white)", letterSpacing: "0.14em", fontFamily: "monospace" }}>{t.entryCode}</span>
                <div>
                  <p style={{ margin: "0 0 1px", fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>{t.player?.name ?? <span style={{ color: "var(--muted2)" }}>Unknown</span>}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{t.player?.email ?? "—"}</p>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
                  {(t.lineItems ?? []).map((li, j) => (
                    <span key={j}>{j > 0 && ", "}{li.quantity}× {li.tierName}</span>
                  ))}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>
                  ₹{Math.round((t.totalPaise ?? 0) / 100).toLocaleString("en-IN")}
                </span>
                <StatusBadge status={t.status} />
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {t.bookedAt ? new Date(t.bookedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "20px" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ padding: "7px 16px", background: "none", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "12px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                Prev
              </button>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: "7px 16px", background: "none", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--muted)", fontSize: "12px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
