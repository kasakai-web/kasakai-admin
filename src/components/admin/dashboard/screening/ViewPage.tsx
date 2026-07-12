"use client";
import React, { useState } from "react";
import styles from "../dashboard.module.css";
import { scrStatusBadge, backBtnStyle } from "./types";
import type { ApiScrEvent } from "@/lib/screening-api";

function buildThingsToKnow(ev: ApiScrEvent): { label: string; warn?: boolean; icon: React.ReactNode }[] {
  const items: { label: string; warn?: boolean; icon: React.ReactNode }[] = [];

  if (ev.languages?.length) {
    items.push({
      label: ev.languages.join(" & "),
      icon: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c-2.5 4-4 8-4 10s1.5 6 4 10M12 2c2.5 4 4 8 4 10s-1.5 6-4 10"/></>,
    });
  }

  if (ev.minAgeEntry > 0) {
    items.push({
      label: `${ev.minAgeEntry}+ entry only`,
      warn: true,
      icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="11" r="4"/></>,
    });
  } else {
    items.push({
      label: "Entry for all ages",
      icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="11" r="4"/></>,
    });
  }

  if (ev.minAgePaid > 0) {
    items.push({
      label: `Ticket required for ${ev.minAgePaid}+`,
      icon: <><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></>,
    });
  }

  if (ev.isIndoor === true) {
    items.push({ label: "Indoor venue", icon: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></> });
  } else if (ev.isIndoor === false) {
    items.push({ label: "Outdoor venue", icon: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></> });
  }

  if (ev.isSeated === true) {
    items.push({ label: "Seated", icon: <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></> });
  } else if (ev.isSeated === false) {
    items.push({ label: "Standing", icon: <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></> });
  }

  if (ev.kidFriendly === true) {
    items.push({ label: "Kids welcome", icon: <><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></> });
  } else if (ev.kidFriendly === false) {
    items.push({ label: "No kids", warn: true, icon: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></> });
  }

  if (ev.petFriendly === true) {
    items.push({ label: "Pets welcome", icon: <><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.96-1.45-2.344-2.5"/></> });
  } else if (ev.petFriendly === false) {
    items.push({ label: "No pets", warn: true, icon: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></> });
  }

  if (ev.gatesOpenBefore > 0) {
    items.push({
      label: `Gates open ${ev.gatesOpenBefore} min early`,
      icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    });
  }

  return items;
}

interface Props {
  ev: ApiScrEvent;
  onBack: () => void;
  onManage?: () => void;
  onViewAnalytics?: () => void;
  onViewAttendees?: () => void;
}

export function ScrViewEventPage({ ev, onBack, onManage, onViewAnalytics, onViewAttendees }: Props) {
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [heroImgErr, setHeroImgErr] = useState(false);
  const badge = scrStatusBadge(ev.status);

  const firstShow = ev.shows?.[0];
  const dateLabel = firstShow
    ? new Date(firstShow.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";
  const timeLabel = firstShow?.startTime ?? "";

  const venueParts = [ev.venueName, ev.location].filter(Boolean);
  const venueName  = ev.venueName || ev.location || "—";
  const venueCity  = ev.location || "";

  const thingsToKnow = buildThingsToKnow(ev);
  const minPrice = ev.tiers.length > 0 ? Math.min(...ev.tiers.map(t => t.pricePaise)) : 0;

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.15em", textTransform: "uppercase" }}>Screening Events</p>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--white)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</h2>
        </div>
        <span style={{ flexShrink: 0, marginTop: "4px", padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
      </div>

      {/* Hero image */}
      <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", height: "340px", marginBottom: "24px", background: "#090910" }}>
        {!heroImgErr && ev.image ? (
          <>
            <img src={ev.image} alt={ev.title}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(10px)", transform: "scale(1.1)", opacity: 0.5 }}
              onError={() => setHeroImgErr(true)} />
            <img src={ev.image} alt={ev.title}
              style={{ position: "relative", display: "block", width: "100%", height: "100%", objectFit: "contain" }}
              onError={() => setHeroImgErr(true)} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "linear-gradient(160deg, #0d0d1a 0%, #090910 100%)" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="22" height="15" rx="2" stroke="#1e2240" strokeWidth="1.5" fill="#0c0c1a"/>
              <path d="M12 16v3" stroke="#1e2240" strokeWidth="1.5"/>
              <path d="M8 21h8" stroke="#1e2240" strokeWidth="1.5"/>
              <line x1="3" y1="7" x2="21" y2="7" stroke="#12122a" strokeWidth="0.75"/>
              <line x1="3" y1="11" x2="21" y2="11" stroke="#12122a" strokeWidth="0.75"/>
              <circle cx="12" cy="8.5" r="4" stroke="#1e2240" strokeWidth="1" fill="#10102a"/>
              <polygon points="10.5,6.5 10.5,10.5 14.5,8.5" fill="#1e2240"/>
            </svg>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#1e2240", letterSpacing: "0.18em", textTransform: "uppercase" }}>No Preview Available</span>
          </div>
        )}
      </div>

      {/* Title block */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: "var(--white)", lineHeight: 1.3 }}>{ev.title}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#5be6b2" }}>{dateLabel}</span>
          {timeLabel && <><span style={{ color: "var(--muted)", fontSize: "13px" }}>|</span><span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{timeLabel}</span></>}
          {venueParts.length > 0 && (
            <>
              <span style={{ color: "var(--muted)", fontSize: "13px" }}>|</span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{venueParts.join(", ")}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.scrViewLayout}>

        {/* ── LEFT COLUMN ── */}
        <div>
          {/* About */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>About</h3>
            {ev.description ? (
              <>
                <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.8, overflow: "hidden", ...(aboutExpanded ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const }) }}>
                  {ev.description.split("\n\n").map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{para}</p>
                  ))}
                </div>
                <button type="button" onClick={() => setAboutExpanded(v => !v)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "12px", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--white)", fontSize: "13px", fontWeight: 600 }}>
                  {aboutExpanded ? "Read less" : "Read more"}
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: aboutExpanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M7.5 9.75l4.5 4.5 4.5-4.5"/></svg>
                </button>
              </>
            ) : (
              <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>No description provided.</p>
            )}
          </div>

          {/* Things to know */}
          {thingsToKnow.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 18px", fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>Things to Know</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                {thingsToKnow.map((item, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "8px", background: item.warn ? "rgba(239,68,68,0.08)" : "rgba(91,230,178,0.08)", border: `1px solid ${item.warn ? "rgba(239,68,68,0.15)" : "rgba(91,230,178,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={item.warn ? "#ef4444" : "#5be6b2"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                      </div>
                      <span style={{ fontSize: "13px", color: item.warn ? "#ef4444" : "var(--text)", lineHeight: 1.4 }}>{item.label}</span>
                    </div>
                    {i < thingsToKnow.length - 2 && (
                      <div style={{ height: "1px", background: "var(--border)", marginLeft: "42px" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra sections */}
          {ev.extraSections?.map((sec, i) => sec.content && (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>{sec.type || "More Info"}</h3>
              <p style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.8, margin: 0 }}>{sec.content}</p>
            </div>
          ))}

          {/* More / T&C */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "17px", fontWeight: 800, color: "var(--white)" }}>More</h3>
            <button type="button" onClick={() => setTermsExpanded(v => !v)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>Terms and Conditions</span>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: termsExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}><path d="M7.5 9.75l4.5 4.5 4.5-4.5"/></svg>
            </button>
            {termsExpanded && (
              <div style={{ marginTop: "12px", padding: "14px 16px", background: "var(--bg)", borderRadius: "8px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.8 }}>
                <ul style={{ margin: 0, paddingLeft: "16px" }}>
                  <li>All sales are final. No refunds unless the event is cancelled by the organiser.</li>
                  <li>Valid ID required at entry for age verification.</li>
                  <li>Entry is subject to availability and venue capacity.</li>
                  <li>The organiser reserves the right to refuse entry without explanation.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "sticky", top: "24px" }}>
          {/* Venue card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.14em", textTransform: "uppercase" }}>Venue</p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "var(--white)" }}>{venueName}</p>
                  {venueCity && venueName !== venueCity && <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{venueCity}</p>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: "rgba(91,230,178,0.08)", border: "1px solid rgba(91,230,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#5be6b2" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "var(--white)" }}>
                    {timeLabel ? `Gates open at ${timeLabel}` : "Time TBD"}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{dateLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket / status card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
            <p style={{ margin: "0 0 14px", fontSize: "12px", fontWeight: 800, color: "#5be6b2", letterSpacing: "0.14em", textTransform: "uppercase" }}>Ticket Status</p>
            {ev.status === "published" && ev.tiers.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {ev.tiers.map(t => (
                  <div key={t._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 10px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "13px", color: "var(--muted)" }}>{t.name}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--white)" }}>{t.pricePaise === 0 ? "Free" : `₹${Math.round(t.pricePaise / 100)}`}</span>
                      <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>{t.sold}/{t.capacity} sold</span>
                    </div>
                  </div>
                ))}
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                  from ₹{Math.round(minPrice / 100)} · inclusive of all taxes
                </p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <span style={{ display: "inline-block", padding: "8px 20px", borderRadius: "999px", fontSize: "13px", fontWeight: 700, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>{badge.label}</span>
                <p style={{ margin: "12px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  {ev.status === "cancelled" ? "This event has been cancelled." : "This event is not yet published."}
                </p>
              </div>
            )}
          </div>

          {/* Contacts card */}
          {ev.contacts?.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Contacts</p>
              {ev.contacts.map((c, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < ev.contacts.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 700, color: "var(--white)" }}>{c.name}</p>
                  {c.phone && <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{c.phone}</p>}
                  {c.email && <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{c.email}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Admin actions card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Admin Actions</p>
            {[
              { label: "Edit Event Details",   icon: <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>,                                                                                                        onClick: onManage },
              { label: "View Attendees",        icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,                              onClick: onViewAttendees },
              { label: "View Analytics",        icon: <><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></>,                                                                                                              onClick: onViewAnalytics },
            ].map(({ label, icon, onClick }) => (
              <button key={label} type="button" onClick={onClick}
                disabled={!onClick}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 0", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: onClick ? "pointer" : "default", color: "var(--muted)", fontSize: "12px", fontWeight: 500, transition: "color 0.15s", opacity: onClick ? 1 : 0.4 }}
                onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLButtonElement).style.color = "var(--white)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{icon}</svg>
                  {label}
                </div>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
