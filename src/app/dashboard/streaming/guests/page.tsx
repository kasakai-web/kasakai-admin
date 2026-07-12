import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest List | Kasa Kai Admin",
};

export default function GuestListPage() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:"16px", textAlign:"center", padding:"40px" }}>
      <div style={{ width:56, height:56, borderRadius:"16px", background:"rgba(59,130,246,0.1)", border:"1.5px solid rgba(59,130,246,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      </div>
      <div>
        <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:800, color:"#3b82f6", letterSpacing:"0.18em", textTransform:"uppercase" }}>Streaming</p>
        <h2 style={{ margin:"0 0 10px", fontSize:"22px", fontWeight:800, color:"var(--white)" }}>Guest List</h2>
        <p style={{ margin:0, fontSize:"13px", color:"var(--muted)", maxWidth:"360px", lineHeight:1.7 }}>Per-event door verification table. Manage walk-in guests, verify ticket codes, and track entry in real time.</p>
      </div>
      <div style={{ marginTop:"8px", padding:"6px 16px", background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.18)", borderRadius:"999px" }}>
        <span style={{ fontSize:"10px", fontWeight:800, color:"#3b82f6", letterSpacing:"0.16em", textTransform:"uppercase" }}>Coming Soon</span>
      </div>
    </div>
  );
}
