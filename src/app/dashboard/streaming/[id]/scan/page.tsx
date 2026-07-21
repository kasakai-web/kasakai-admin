"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { scrApi, ApiError, type ScrScanResult } from "@/lib/screening-api";
import { backBtnStyle } from "@/components/admin/dashboard/screening/types";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "granted"; ticket: ScrScanResult }
  | { status: "already_used"; ticket?: ScrScanResult }
  | { status: "error"; message: string };

export default function ScanPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);

  const [code,  setCode]  = useState("");
  const [state, setState] = useState<ScanState>({ status: "idle" });

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setState({ status: "scanning" });
    try {
      const ticket = await scrApi.scanTicket(trimmed, id);
      setState({ status: "granted", ticket });
      setCode("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      if (msg.toLowerCase().includes("already scanned")) {
        const ticket = err instanceof ApiError
          ? (err.details as { ticket?: ScrScanResult } | undefined)?.ticket
          : undefined;
        setState({ status: "already_used", ticket });
      } else {
        setState({ status: "error", message: msg });
      }
      setCode("");
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function reset() { setState({ status: "idle" }); setCode(""); inputRef.current?.focus(); }

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => router.push(`/dashboard/streaming/${id}/manage`)} className={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.15em", textTransform: "uppercase" }}>Door Scanning</p>
          <h2 style={{ margin: "0 0 2px", fontSize: "20px", fontWeight: 800, color: "var(--white)" }}>Scan Entry Code</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>Scan or type the attendee&apos;s entry code to grant access.</p>
        </div>
      </div>

      <div style={{ height: "1px", background: "var(--border)", margin: "16px 0 28px" }} />

      <div style={{ maxWidth: "480px" }}>
        {/* Input form */}
        <form onSubmit={handleScan} style={{ marginBottom: "28px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
            Entry Code
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              ref={inputRef}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="EVT-XXXXX"
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: 1, padding: "12px 16px",
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px",
                color: "var(--white)", fontSize: "18px", fontWeight: 800,
                letterSpacing: "0.18em", outline: "none", fontFamily: "monospace",
              }}
            />
            <button
              type="submit"
              disabled={state.status === "scanning" || !code.trim()}
              style={{
                padding: "12px 24px", background: "#5be6b2", border: "none", borderRadius: "10px",
                color: "#000", fontSize: "13px", fontWeight: 800, cursor: "pointer",
                opacity: state.status === "scanning" || !code.trim() ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {state.status === "scanning" ? (
                <svg className="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#000" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M17 17h3M17 14h3" />
                </svg>
              )}
              {state.status === "scanning" ? "Scanning…" : "Scan"}
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "var(--muted2)" }}>
            Use a barcode scanner or type the code manually. Press Enter to scan.
          </p>
        </form>

        {/* Result */}
        {state.status === "granted" && (
          <ResultCard
            type="granted"
            title="Entry Granted"
            subtitle="Valid ticket — welcome in!"
            ticket={state.ticket}
            onReset={reset}
          />
        )}
        {state.status === "already_used" && (
          <ResultCard
            type="already_used"
            title="Already Scanned"
            subtitle="This ticket was already used."
            ticket={state.ticket}
            onReset={reset}
          />
        )}
        {state.status === "error" && (
          <div style={{
            padding: "20px", borderRadius: "14px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#ef4444" }}>Entry Denied</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(239,68,68,0.7)" }}>{state.message}</p>
              </div>
            </div>
            <button onClick={reset} style={{ width: "100%", padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ type, title, subtitle, ticket, onReset }: {
  type: "granted" | "already_used";
  title: string;
  subtitle: string;
  ticket?: ScrScanResult;
  onReset: () => void;
}) {
  const isGranted = type === "granted";
  const color     = isGranted ? "#5be6b2" : "#f59e0b";
  const bg        = isGranted ? "rgba(91,230,178,0.08)" : "rgba(245,158,11,0.08)";
  const border    = isGranted ? "rgba(91,230,178,0.25)" : "rgba(245,158,11,0.25)";

  return (
    <div style={{ padding: "20px", borderRadius: "14px", background: bg, border: `1px solid ${border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${bg}`, border: `2px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isGranted ? (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
          )}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: `${color}99` }}>{subtitle}</p>
        </div>
      </div>

      {ticket && (
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "14px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Row label="Entry Code"  value={ticket.entryCode} mono />
          {ticket.event?.title && <Row label="Event"  value={ticket.event.title} />}
          <Row label="Tickets" value={ticket.lineItems?.map(li => `${li.quantity}× ${li.tierName}`).join(", ") ?? "—"} />
          <Row label="Total Paid" value={`₹${Math.round((ticket.totalPaise ?? 0) / 100).toLocaleString("en-IN")}`} />
          {ticket.usedAt && <Row label="Scanned At" value={new Date(ticket.usedAt).toLocaleString("en-IN")} />}
        </div>
      )}

      <button onClick={onReset} style={{ width: "100%", padding: "10px", background: `${bg}`, border: `1px solid ${border}`, borderRadius: "8px", color, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
        Scan Next
      </button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
      <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: mono ? "14px" : "12px", color: "var(--white)", fontWeight: mono ? 800 : 600, letterSpacing: mono ? "0.16em" : 0, fontFamily: mono ? "monospace" : "inherit", textAlign: "right" }}>{value}</span>
    </div>
  );
}
