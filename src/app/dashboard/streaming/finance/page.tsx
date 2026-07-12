import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Streaming Finance | Kasa Kai Admin",
};

export default function StreamingFinancePage() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:"16px", textAlign:"center", padding:"40px" }}>
      <div style={{ width:56, height:56, borderRadius:"16px", background:"rgba(91,230,178,0.08)", border:"1.5px solid rgba(91,230,178,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
      </div>
      <div>
        <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:800, color:"#5be6b2", letterSpacing:"0.18em", textTransform:"uppercase" }}>Streaming</p>
        <h2 style={{ margin:"0 0 10px", fontSize:"22px", fontWeight:800, color:"var(--white)" }}>Streaming Finance</h2>
        <p style={{ margin:0, fontSize:"13px", color:"var(--muted)", maxWidth:"360px", lineHeight:1.7 }}>Revenue analytics for screening events. Track ticket sales, payout breakdowns, and venue-level financial performance.</p>
      </div>
      <div style={{ marginTop:"8px", padding:"6px 16px", background:"rgba(91,230,178,0.08)", border:"1px solid rgba(91,230,178,0.2)", borderRadius:"999px" }}>
        <span style={{ fontSize:"10px", fontWeight:800, color:"#5be6b2", letterSpacing:"0.16em", textTransform:"uppercase" }}>Coming Soon</span>
      </div>
    </div>
  );
}
