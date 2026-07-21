"use client";
import React, { useState, useCallback } from "react";
import { SCR_CARD, SCR_GRID2, SCR_GRID_POC } from "../ui";
import { backBtnStyle, inp } from "./types";
import { scrApi } from "@/lib/screening-api";
import type { CreateScrEventPayload } from "@/lib/screening-api";

/* ── static data ── */
const CATEGORIES = [
  "TV Screenings","Music","Nightlife","Social Mixers","Performances",
  "Open Mics","Comedy","Sports","Food & Drinks","Esports",
  "Games & Quizzes","Fitness Activities","Kids","Art Exhibitions",
  "Fests & Fairs","Conferences & Talks","Workshops","Adventure",
];
const SUB_CATS: Record<string,string[]> = {
  "TV Screenings":     ["Football Screenings","Cricket Screenings","F1 Screenings","Movie Screenings","Olympics Screenings","Concert Screenings"],
  Sports:              ["Football","Cricket","Tennis","Badminton","Running","Cycling"],
  Music:               ["Live Music","DJ Night","Open Mic","Classical"],
  "Food & Drinks":     ["Dining Experience","Bar Night","Wine Tasting","Food Festival"],
  Comedy:              ["Stand-up","Improv","Sketch","Other"],
  Esports:             ["PC Gaming","Console","Mobile","Other"],
  "Games & Quizzes":   ["Trivia","Board Games","Pub Quiz","Other"],
  "Fitness Activities":["Yoga","Workout","Dance","Other"],
  Workshops:           ["Art","Music","Tech","Cooking","Other"],
};
const LANGUAGES  = ["English","Hindi","Hinglish","Bengali","Telugu","Tamil","Tanglish","Marathi","Gujarati","Kannada","Punjabi","Malayalam","French","Spanish","German"];
const EXTRA_SECS = ["Event Instructions","Youtube Video","Prohibited Items","FAQs"];

const STEPS = [
  { num:1, label:"Basic Info" },
  { num:2, label:"Schedule"   },
  { num:3, label:"Tickets"    },
  { num:4, label:"Media"      },
  { num:5, label:"Publish"    },
];

/* ── types ── */
type Poc  = { name:string; email:string; phone:string };
type Show = { id:string; date:string; startTime:string; endTime:string };
type Tier = { id:string; name:string; price:string; capacity:string; desc:string };

type Draft = {
  name:string; description:string;
  categories:string[]; subCategory:string;
  gstin:string; accountNumber:string; ifsc:string; accountType:"savings"|"current";
  pocs:Poc[];
  showOrganiser:boolean;
  venueLocation:string; venueCity:string; venueMapUrl:string; ownRestaurant:boolean|null; instagramLink:string;
  shows:Show[]; gatesOpenBefore:string;
  tiers:Tier[];
  languages:string[]; minAgeEntry:string; minAgePaid:string;
  isIndoor:boolean|null; isSeated:boolean|null;
  kidFriendly:boolean|null; petFriendly:boolean|null;
  extraSections:string[];
  image:string; poster:string; videoUrl:string; galleryImages:string[];
};

const INIT: Draft = {
  name:"", description:"",
  categories:[], subCategory:"",
  gstin:"", accountNumber:"", ifsc:"", accountType:"savings",
  pocs:[{ name:"", email:"", phone:"" }],
  showOrganiser: false,
  venueLocation:"", venueCity:"", venueMapUrl:"", ownRestaurant:null, instagramLink:"",
  shows:[], gatesOpenBefore:"",
  tiers:[],
  languages:[], minAgeEntry:"", minAgePaid:"",
  isIndoor:null, isSeated:null, kidFriendly:null, petFriendly:null,
  extraSections:[],
  image:"", poster:"", videoUrl:"", galleryImages:[],
};

/* ── shared styles ── */
const LBL = "mb-[6px] block text-[11px] font-bold uppercase tracking-[0.1em] text-muted";
const SEC = "mb-5 text-[14px] font-extrabold text-fg";

/* ── uid counter ── */
let _n = 0;
const uid = () => `c${++_n}`;

/* ── Required asterisk ── */
const Req = () => <span className="ml-[2px] text-danger">*</span>;

/* ── reusable atoms ── */
function Chip({ label, active, onToggle }: { label:string; active:boolean; onToggle:()=>void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`cursor-pointer rounded-full border-[1.5px] px-[14px] py-[6px] text-[12px] font-semibold transition-all duration-150 ${active ? "border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.12)] text-accent" : "border-border bg-[#0b1114] text-muted"}`}>
      {label}
    </button>
  );
}

function TriToggle({ label, value, onChange, yesText="Yes", noText="No" }: {
  label:string; value:boolean|null; onChange:(v:boolean)=>void; yesText?:string; noText?:string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={LBL}>{label}</span>
      <div className="flex gap-2">
        {([true,false] as const).map(v => (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={`cursor-pointer rounded-lg border-[1.5px] px-[18px] py-[7px] text-[12px] font-bold transition-all duration-150 ${value===v ? (v ? "border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.15)] text-accent" : "border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.1)] text-danger") : "border-border bg-[#0b1114] text-muted"}`}>
            {v ? yesText : noText}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadBox({ label, hint, value, onChange }: {
  label:string; hint:string; value:string; onChange:(url:string)=>void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string|null>(null);

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setUploadErr('File is too large. Maximum size is 2 MB.');
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const url = await scrApi.uploadImage(file);
      onChange(url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className={LBL}>{label}</span>
      <label
        className={`block rounded-[10px] border-[1.5px] border-dashed border-border-2 bg-[#0b1114] px-4 py-8 text-center transition-[border-color] duration-150 ${uploading ? "cursor-wait" : "cursor-pointer"}`}
        onMouseEnter={e => (e.currentTarget.style.borderColor="rgba(91,230,178,0.4)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor="var(--border2)")}>
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
        {value
          ? <img src={value} alt="" className="max-h-[120px] max-w-full rounded-md object-cover" />
          : uploading
          ? <p className="m-0 text-[13px] text-muted">Uploading…</p>
          : <>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-[10px] block">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <p className="mb-1 text-[13px] font-semibold text-muted">Drag &amp; drop or click</p>
              <p className="m-0 text-[11px] text-muted opacity-60">{hint}</p>
            </>
        }
      </label>
      {uploadErr && <p className="mt-[6px] text-[11px] text-danger">{uploadErr}</p>}
    </div>
  );
}

/* ── Step 1: Basic Info ── */
function S1({ form, set }: { form:Draft; set:React.Dispatch<React.SetStateAction<Draft>> }) {
  const subOpts = [...new Set(form.categories.flatMap(c => SUB_CATS[c] ?? []))];
  return (
    <div className="flex flex-col gap-5">

      <div className={SCR_CARD}>
        <p className={SEC}>Event Name</p>
        <div className="flex flex-col gap-4">
          <div>
            <span className={LBL}>Event Title <Req /></span>
            <input className={inp} placeholder="e.g. UCL Final Big Screening"
              value={form.name} onChange={e => set(f => ({ ...f, name:e.target.value }))} />
          </div>
          <div>
            <span className={LBL}>Description</span>
            <textarea className={`${inp} min-h-[100px] resize-y leading-[1.6]`}
              placeholder="Tell attendees what to expect…"
              value={form.description} onChange={e => set(f => ({ ...f, description:e.target.value }))} />
          </div>
        </div>
      </div>

      <div className={SCR_CARD}>
        <p className={SEC}>Event Type</p>
        <div className="flex flex-col gap-5">
          <div>
            <span className={LBL}>Category — choose up to 2 <Req /></span>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <Chip key={cat} label={cat} active={form.categories.includes(cat)} onToggle={() => set(f => {
                  if (f.categories.includes(cat)) return { ...f, categories:f.categories.filter(c => c!==cat), subCategory:"" };
                  if (f.categories.length >= 2) return f;
                  return { ...f, categories:[...f.categories, cat], subCategory:"" };
                })} />
              ))}
            </div>
          </div>
          {subOpts.length > 0 && (
            <div>
              <span className={LBL}>Sub-category</span>
              <select className={inp} value={form.subCategory} onChange={e => set(f => ({ ...f, subCategory:e.target.value }))}>
                <option value="">Select sub-category</option>
                {subOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className={SCR_CARD}>
        <p className={SEC}>Payout Details</p>
        <div className={SCR_GRID2}>
          <div>
            <span className={LBL}>GSTIN (optional)</span>
            <input className={inp} placeholder="22AAAAA0000A1Z5"
              value={form.gstin} onChange={e => set(f => ({ ...f, gstin:e.target.value }))} />
          </div>
          <div>
            <span className={LBL}>Bank Account Number</span>
            <input className={inp} placeholder="Account number"
              value={form.accountNumber} onChange={e => set(f => ({ ...f, accountNumber:e.target.value }))} />
          </div>
          <div>
            <span className={LBL}>IFSC Code</span>
            <input className={inp} placeholder="e.g. HDFC0001234"
              value={form.ifsc} onChange={e => set(f => ({ ...f, ifsc:e.target.value }))} />
          </div>
          <div>
            <span className={LBL}>Account Type</span>
            <select className={inp} value={form.accountType} onChange={e => set(f => ({ ...f, accountType:e.target.value as "savings"|"current" }))}>
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>
        </div>
      </div>

      <div className={SCR_CARD}>
        <div className="mb-5 flex items-center justify-between">
          <p className="m-0 text-[14px] font-extrabold text-fg">Point of Contact</p>
          <button type="button" onClick={() => set(f => ({ ...f, pocs:[...f.pocs, { name:"", email:"", phone:"" }] }))}
            className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-[14px] py-[7px] text-[12px] font-bold text-accent">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Contact
          </button>
        </div>
        {form.pocs.map((poc, i) => (
          <div key={i} className={`${SCR_GRID_POC} ${i < form.pocs.length-1 ? "mb-[14px]" : ""}`}>
            <div>
              <span className={LBL}>Name {i === 0 && <Req />}</span>
              <input className={inp} placeholder="Full name" value={poc.name}
                onChange={e => { const p=[...form.pocs]; p[i]={...p[i],name:e.target.value}; set(f=>({...f,pocs:p})); }} />
            </div>
            <div>
              <span className={LBL}>Email</span>
              <input className={inp} type="email" placeholder="name@example.com" value={poc.email}
                onChange={e => { const p=[...form.pocs]; p[i]={...p[i],email:e.target.value}; set(f=>({...f,pocs:p})); }} />
            </div>
            <div>
              <span className={LBL}>Phone {i === 0 && <Req />}</span>
              <input className={inp} type="tel" placeholder="+91 98765 43210" value={poc.phone}
                onChange={e => { const p=[...form.pocs]; p[i]={...p[i],phone:e.target.value}; set(f=>({...f,pocs:p})); }} />
            </div>
            {form.pocs.length > 1
              ? <button type="button" onClick={() => set(f => ({ ...f, pocs:f.pocs.filter((_,idx) => idx!==i) }))}
                  className="cursor-pointer self-end rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-3 py-[10px] leading-none text-danger">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              : <div />
            }
          </div>
        ))}

        {/* Show organiser on user side toggle */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[rgba(91,230,178,0.15)] bg-[rgba(91,230,178,0.04)] px-4 py-[14px]">
          <div>
            <p className="mb-[3px] text-[13px] font-bold text-fg">Show organiser details to customers</p>
            <p className="m-0 text-[11px] text-muted">If ON, name, email &amp; phone will be visible on the event page</p>
          </div>
          <button type="button" onClick={() => set(f => ({ ...f, showOrganiser: !f.showOrganiser }))}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0">
            <div className={`relative h-[22px] w-10 rounded-full border-[1.5px] transition-[background] duration-200 ${form.showOrganiser ? "border-[#5be6b2] bg-accent" : "border-border bg-surface-2"}`}>
              <div className={`absolute top-[2px] h-4 w-4 rounded-full transition-[left] duration-200 ${form.showOrganiser ? "left-[20px] bg-black" : "left-[2px] bg-muted"}`} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Schedule ── */
function S2({ form, set }: { form:Draft; set:React.Dispatch<React.SetStateAction<Draft>> }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newShow, setNewShow] = useState({ date:"", startTime:"", endTime:"" });

  function saveShow() {
    if (!newShow.date || !newShow.startTime || !newShow.endTime) return;
    set(f => ({ ...f, shows:[...f.shows, { id:uid(), ...newShow }] }));
    setNewShow({ date:"", startTime:"", endTime:"" });
    setAddOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">

      <div className={SCR_CARD}>
        <p className={SEC}>Venue</p>
        <div className="flex flex-col gap-[18px]">
          <div className={SCR_GRID2}>
            <div>
              <span className={LBL}>Venue Name <Req /></span>
              <input className={inp} placeholder="e.g. The Local Cafe"
                value={form.venueLocation} onChange={e => set(f => ({ ...f, venueLocation:e.target.value }))} />
            </div>
            <div>
              <span className={LBL}>City / Area <Req /></span>
              <input className={inp} placeholder="e.g. Koramangala, Bangalore"
                value={form.venueCity} onChange={e => set(f => ({ ...f, venueCity:e.target.value }))} />
            </div>
          </div>
          <TriToggle label="Hosting at own restaurant?" value={form.ownRestaurant} onChange={v => set(f => ({ ...f, ownRestaurant:v }))} />
          <div>
            <span className={LBL}>Google Maps URL (optional)</span>
            <input className={inp} type="url" placeholder="https://maps.google.com/?q=..."
              value={form.venueMapUrl} onChange={e => set(f => ({ ...f, venueMapUrl:e.target.value }))} />
            <p className="mt-1 text-[11px] text-muted-2">Customers can tap this to navigate to the venue</p>
          </div>
          <div>
            <span className={LBL}>Venue Instagram (optional)</span>
            <input className={inp} placeholder="https://instagram.com/venuename"
              value={form.instagramLink} onChange={e => set(f => ({ ...f, instagramLink:e.target.value }))} />
          </div>
          <div>
            <span className={LBL}>Gates Open Before Event (mins)</span>
            <input className={inp} type="number" placeholder="e.g. 30" min="0"
              value={form.gatesOpenBefore} onChange={e => set(f => ({ ...f, gatesOpenBefore:e.target.value }))} />
          </div>
        </div>
      </div>

      <div className={SCR_CARD}>
        <div className="mb-5 flex items-center justify-between">
          <p className="m-0 text-[14px] font-extrabold text-fg">Shows <Req /></p>
          {!addOpen && (
            <button type="button" onClick={() => setAddOpen(true)}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-[14px] py-[7px] text-[12px] font-bold text-accent">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add Show
            </button>
          )}
        </div>

        {addOpen && (
          <div className="mb-4 rounded-[10px] border border-border bg-[#0b1114] p-4">
            <div className={SCR_GRID2}>
              <div className="col-span-full">
                <span className={LBL}>Date <Req /></span>
                <input className={inp} type="date" value={newShow.date}
                  onChange={e => setNewShow(s => ({ ...s, date:e.target.value }))} />
              </div>
              <div>
                <span className={LBL}>Start Time <Req /></span>
                <input className={inp} type="time" value={newShow.startTime}
                  onChange={e => setNewShow(s => ({ ...s, startTime:e.target.value }))} />
              </div>
              <div>
                <span className={LBL}>End Time <Req /></span>
                <input className={inp} type="time" value={newShow.endTime}
                  onChange={e => setNewShow(s => ({ ...s, endTime:e.target.value }))} />
              </div>
            </div>
            <div className="mt-[14px] flex justify-end gap-2">
              <button type="button" onClick={() => { setAddOpen(false); setNewShow({ date:"", startTime:"", endTime:"" }); }}
                className="cursor-pointer rounded-lg border border-border bg-[#0b1114] px-4 py-2 text-[12px] font-bold text-muted">
                Cancel
              </button>
              <button type="button" onClick={saveShow}
                className="cursor-pointer rounded-lg border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.12)] px-[18px] py-2 text-[12px] font-bold text-accent">
                Add
              </button>
            </div>
          </div>
        )}

        {form.shows.length === 0 && !addOpen && (
          <div className="px-0 py-10 text-center text-[13px] text-muted">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round"
              className="mx-auto mb-3 block">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            No shows yet. Click "Add Show" to schedule one.
          </div>
        )}

        {form.shows.map(sh => (
          <div key={sh.id} className="mb-2 flex items-center justify-between rounded-lg border border-border bg-[#0b1114] px-[14px] py-3">
            <div>
              <span className="text-[13px] font-bold text-fg">
                {new Date(sh.date + "T12:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" })}
              </span>
              <span className="ml-3 text-[12px] text-muted">
                {sh.startTime} – {sh.endTime}
              </span>
            </div>
            <button type="button" onClick={() => set(f => ({ ...f, shows:f.shows.filter(s => s.id!==sh.id) }))}
              className="cursor-pointer rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.07)] px-[10px] py-[6px] leading-none text-danger">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: Tickets ── */
function S3({ form, set }: { form:Draft; set:React.Dispatch<React.SetStateAction<Draft>> }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newTier, setNewTier] = useState({ name:"", price:"", capacity:"", desc:"" });

  function saveTier() {
    if (!newTier.name.trim()) return;
    if (newTier.price === '' || Number(newTier.price) < 0) return;
    if (!newTier.capacity || Number(newTier.capacity) < 1) return;
    set(f => ({ ...f, tiers:[...f.tiers, { id:uid(), ...newTier }] }));
    setNewTier({ name:"", price:"", capacity:"", desc:"" });
    setAddOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={SCR_CARD}>
        <div className="mb-5 flex items-center justify-between">
          <p className="m-0 text-[14px] font-extrabold text-fg">Ticket Tiers <Req /></p>
          {!addOpen && (
            <button type="button" onClick={() => setAddOpen(true)}
              className="inline-flex cursor-pointer items-center gap-[6px] rounded-lg border border-[rgba(91,230,178,0.25)] bg-[rgba(91,230,178,0.08)] px-[14px] py-[7px] text-[12px] font-bold text-accent">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add Tier
            </button>
          )}
        </div>

        {addOpen && (
          <div className="mb-4 rounded-[10px] border border-border bg-[#0b1114] p-4">
            <div className={SCR_GRID2}>
              <div>
                <span className={LBL}>Tier Name <Req /></span>
                <input className={inp} placeholder="e.g. General, VIP" value={newTier.name}
                  onChange={e => setNewTier(t => ({ ...t, name:e.target.value }))} />
              </div>
              <div>
                <span className={LBL}>Price (₹) <Req /></span>
                <input className={inp} type="number" placeholder="0 for free" min="0" value={newTier.price}
                  onChange={e => setNewTier(t => ({ ...t, price:e.target.value }))} />
              </div>
              <div>
                <span className={LBL}>Capacity <Req /></span>
                <input className={inp} type="number" placeholder="Max slots" min="1" value={newTier.capacity}
                  onChange={e => setNewTier(t => ({ ...t, capacity:e.target.value }))} />
              </div>
              <div>
                <span className={LBL}>Description (optional)</span>
                <input className={inp} placeholder="e.g. Includes free drinks" value={newTier.desc}
                  onChange={e => setNewTier(t => ({ ...t, desc:e.target.value }))} />
              </div>
            </div>
            <div className="mt-[14px] flex justify-end gap-2">
              <button type="button" onClick={() => { setAddOpen(false); setNewTier({ name:"", price:"", capacity:"", desc:"" }); }}
                className="cursor-pointer rounded-lg border border-border bg-[#0b1114] px-4 py-2 text-[12px] font-bold text-muted">
                Cancel
              </button>
              <button type="button" onClick={saveTier}
                className="cursor-pointer rounded-lg border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.12)] px-[18px] py-2 text-[12px] font-bold text-accent">
                Add Tier
              </button>
            </div>
          </div>
        )}

        {form.tiers.length === 0 && !addOpen && (
          <div className="px-0 py-10 text-center text-[13px] text-muted">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round"
              className="mx-auto mb-3 block">
              <rect x="2" y="7" width="20" height="10" rx="1"/>
              <circle cx="7.5" cy="12" r="1.5" fill="var(--border2)" stroke="none"/>
            </svg>
            No ticket tiers yet.
          </div>
        )}

        {form.tiers.map(tier => (
          <div key={tier.id} className="mb-2 flex items-center justify-between rounded-lg border border-border bg-[#0b1114] px-4 py-[14px]">
            <div>
              <span className="text-[13px] font-extrabold text-fg">{tier.name}</span>
              {tier.desc && <span className="ml-[10px] text-[11px] text-muted">{tier.desc}</span>}
              <div className="mt-1 flex gap-3">
                <span className="text-[12px] font-bold text-accent">₹{Number(tier.price).toLocaleString()}</span>
                <span className="text-[12px] text-muted">{tier.capacity} slots</span>
              </div>
            </div>
            <button type="button" onClick={() => set(f => ({ ...f, tiers:f.tiers.filter(t => t.id!==tier.id) }))}
              className="cursor-pointer rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.07)] px-[10px] py-[6px] leading-none text-danger">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 4: Media ── */
function S4({ form, set }: { form:Draft; set:React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div className="flex flex-col gap-5">

      <div className={SCR_CARD}>
        <p className={SEC}>Creatives</p>
        <div className={SCR_GRID2}>
          <UploadBox label="Landscape Banner (16:9) ★" hint="PNG / JPG / WebP · max 2 MB · Required"
            value={form.image}  onChange={url => set(f => ({ ...f, image: url }))} />
          <UploadBox label="Portrait Poster (3:4)"   hint="PNG / JPG / WebP · max 2 MB"
            value={form.poster} onChange={url => set(f => ({ ...f, poster: url }))} />
        </div>
      </div>

      <div className={SCR_CARD}>
        <p className={SEC}>Video Sneak Peek</p>
        <div>
          <span className={LBL}>Paste YouTube / Vimeo URL</span>
          <input className={inp} placeholder="https://youtube.com/watch?v=…"
            value={form.videoUrl} onChange={e => set(f => ({ ...f, videoUrl: e.target.value }))} />
        </div>
      </div>

      <div className={SCR_CARD}>
        <p className={SEC}>Gallery</p>
        <p className="mb-4 mt-[-12px] text-[12px] text-muted">Up to 8 images</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
          {Array.from({ length:8 }).map((_, i) => (
            <GallerySlot key={i} value={form.galleryImages[i] || ""}
              onChange={url => set(f => {
                const imgs = [...f.galleryImages];
                imgs[i] = url;
                return { ...f, galleryImages: imgs.filter(Boolean) };
              })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GallerySlot({ value, onChange }: { value:string; onChange:(url:string)=>void }) {
  const [uploading, setUploading] = useState(false);
  const [tooBig,    setTooBig]    = useState(false);

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) { setTooBig(true); setTimeout(() => setTooBig(false), 2500); return; }
    setTooBig(false);
    setUploading(true);
    try {
      const url = await scrApi.uploadImage(file);
      onChange(url);
    } catch { /* slot stays empty */ }
    finally { setUploading(false); }
  }

  return (
    <label className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg border-[1.5px] border-dashed transition-[border-color,background] duration-150 ${tooBig ? "border-[rgba(239,68,68,0.6)] bg-[rgba(239,68,68,0.05)]" : "border-border-2 bg-[#0b1114]"} ${uploading ? "cursor-wait" : "cursor-pointer"}`}
      onMouseEnter={e => { if (!tooBig) e.currentTarget.style.borderColor="rgba(91,230,178,0.4)"; }}
      onMouseLeave={e => { if (!tooBig) e.currentTarget.style.borderColor="var(--border2)"; }}>
      <input type="file" accept="image/*" className="hidden" disabled={uploading}
        onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
      {value
        ? <img src={value} alt="" className="h-full w-full object-cover" />
        : uploading
        ? <span className="text-[10px] text-muted">…</span>
        : tooBig
        ? <span className="p-1 text-center text-[9px] leading-[1.3] text-danger">Max 2 MB</span>
        : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      }
    </label>
  );
}

/* ── Step 5: Publish ── */
function S5({ form, set }: { form:Draft; set:React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <div className="flex flex-col gap-5">

      <div className={SCR_CARD}>
        <p className={SEC}>Event Guide</p>
        <div className="flex flex-col gap-[22px]">
          <div>
            <span className={LBL}>Languages Supported</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <Chip key={lang} label={lang} active={form.languages.includes(lang)} onToggle={() =>
                  set(f => ({ ...f, languages:f.languages.includes(lang)
                    ? f.languages.filter(l => l!==lang)
                    : [...f.languages, lang] }))
                } />
              ))}
            </div>
          </div>
          <div className={SCR_GRID2}>
            <div>
              <span className={LBL}>Minimum Age (Entry)</span>
              <input className={inp} type="number" placeholder="0 = no restriction" min="0"
                value={form.minAgeEntry} onChange={e => set(f => ({ ...f, minAgeEntry:e.target.value }))} />
            </div>
            <div>
              <span className={LBL}>Minimum Age (Paid Ticket)</span>
              <input className={inp} type="number" placeholder="0 = no restriction" min="0"
                value={form.minAgePaid} onChange={e => set(f => ({ ...f, minAgePaid:e.target.value }))} />
            </div>
            <TriToggle label="Indoor or Outdoor?"  value={form.isIndoor}    onChange={v => set(f => ({ ...f, isIndoor:v }))}    yesText="Indoor"  noText="Outdoor"  />
            <TriToggle label="Seated or Standing?" value={form.isSeated}    onChange={v => set(f => ({ ...f, isSeated:v }))}    yesText="Seated"  noText="Standing" />
            <TriToggle label="Kid Friendly?"        value={form.kidFriendly} onChange={v => set(f => ({ ...f, kidFriendly:v }))} />
            <TriToggle label="Pet Friendly?"        value={form.petFriendly} onChange={v => set(f => ({ ...f, petFriendly:v }))} />
          </div>
        </div>
      </div>

      <div className={SCR_CARD}>
        <p className={SEC}>Add More Sections</p>
        <div className="flex flex-wrap gap-[10px]">
          {EXTRA_SECS.map(sec => {
            const active = form.extraSections.includes(sec);
            return (
              <button key={sec} type="button"
                onClick={() => set(f => ({ ...f, extraSections:active
                  ? f.extraSections.filter(s => s!==sec)
                  : [...f.extraSections, sec] }))}
                className={`inline-flex cursor-pointer items-center gap-[6px] rounded-full border-[1.5px] px-4 py-2 text-[12px] font-bold transition-all duration-150 ${active ? "border-[rgba(91,230,178,0.5)] bg-[rgba(91,230,178,0.12)] text-accent" : "border-border bg-[#0b1114] text-muted"}`}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  {active ? <path d="M5 13l4 4L19 7"/> : <path d="M12 5v14M5 12h14"/>}
                </svg>
                {sec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review summary */}
      <div className={`${SCR_CARD} border-[rgba(91,230,178,0.15)]! bg-[rgba(91,230,178,0.03)]!`}>
        <p className={SEC}>Review</p>
        <div className="flex flex-col gap-[10px]">
          {[
            { label:"Event",        value:form.name || "—" },
            { label:"Categories",   value:form.categories.join(", ") || "—" },
            { label:"Venue",        value:form.venueLocation ? [form.venueLocation, form.venueCity].filter(Boolean).join(", ") : "—" },
            { label:"Shows",        value:form.shows.length ? `${form.shows.length} show(s)` : "None" },
            { label:"Ticket tiers", value:form.tiers.length
              ? form.tiers.map(t => `${t.name} (₹${Number(t.price).toLocaleString()})`).join(", ")
              : "None" },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-4">
              <span className="w-[110px] shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</span>
              <span className="text-[13px] font-semibold text-fg">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function validateStep(step: number, form: Draft): string | null {
  if (step === 1) {
    if (!form.name.trim())            return 'Event title is required.';
    if (form.categories.length === 0) return 'Select at least one category.';
    const hasContact = form.pocs.some(p => p.name.trim() && p.phone.trim());
    if (!hasContact) return 'Add at least one contact with name and phone number.';
  }
  if (step === 2) {
    if (!form.venueLocation.trim())   return 'Venue name is required.';
    if (!form.venueCity.trim())       return 'City / area is required.';
    if (form.shows.length === 0)      return 'Add at least one show date and time.';
  }
  if (step === 3) {
    if (form.tiers.length === 0)      return 'Add at least one ticket tier.';
  }
  if (step === 4) {
    if (!form.image)                  return 'Upload a landscape banner image.';
  }
  return null;
}

function fmtTime(t: string): string {
  if (!t || t.includes("AM") || t.includes("PM")) return t;
  const [h, m] = t.split(":").map(Number);
  return `${((h % 12) || 12).toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function buildPayload(form: Draft): CreateScrEventPayload {
  return {
    title:           form.name,
    description:     form.description,
    categories:      form.categories,
    subCategories:   form.subCategory ? [form.subCategory] : [],
    languages:       form.languages,
    venueName:       form.venueLocation,
    location:        form.venueCity,
    locationUrl:     form.venueMapUrl || '',
    ownRestaurant:   form.ownRestaurant ?? false,
    venueInstagram:  form.instagramLink,
    gatesOpenBefore: Number(form.gatesOpenBefore) || 0,
    isIndoor:        form.isIndoor,
    isSeated:        form.isSeated,
    kidFriendly:     form.kidFriendly,
    petFriendly:     form.petFriendly,
    minAgeEntry:     Number(form.minAgeEntry) || 0,
    minAgePaid:      Number(form.minAgePaid) || 0,
    shows:           form.shows.map(s => ({ date: s.date, startTime: fmtTime(s.startTime), endTime: fmtTime(s.endTime) })),
    tiers:           form.tiers.map(t => ({
      name:        t.name,
      pricePaise:  Math.round(Number(t.price) * 100),
      capacity:    Number(t.capacity) || 1,
      description: t.desc,
    })),
    contacts:       form.pocs,
    showOrganiser:  form.showOrganiser,
    payout: {
      gstin:         form.gstin,
      accountNumber: form.accountNumber,
      ifsc:          form.ifsc,
      accountType:   form.accountType,
    },
    extraSections:  form.extraSections.map(type => ({ type, content: '' })),
    image:          form.image,
    poster:         form.poster,
    videoUrl:       form.videoUrl,
    galleryImages:  form.galleryImages,
  };
}

/* ── Main component ── */
export function ScrCreateEventForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit?: (payload: CreateScrEventPayload, status: 'draft' | 'published') => Promise<void>;
}) {
  const [step, setStep]             = useState(1);
  const [form, setForm]             = useState<Draft>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError]   = useState<string|null>(null);

  const goNext = useCallback(() => {
    const err = validateStep(step, form);
    if (err) { setStepError(err); return; }
    setStepError(null);
    setStep(s => Math.min(s + 1, 5));
  }, [step, form]);

  const goPrev = useCallback(() => {
    setStepError(null);
    setStep(s => Math.max(s - 1, 1));
  }, []);

  const handlePublish = useCallback(async (status: 'draft' | 'published') => {
    if (!onSubmit || submitting) return;
    // Validate every step before submitting — catches any skip
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s, form);
      if (err) {
        setStep(s);
        setStepError(err);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit(buildPayload(form), status);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, submitting, form]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-[14px]">
        <button type="button" onClick={step === 1 ? onBack : goPrev} className={backBtnStyle}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          {step === 1 ? "Back" : `← ${STEPS[step - 2].label}`}
        </button>
        <div>
          <p className="mb-[2px] text-[10px] font-extrabold uppercase tracking-[0.15em] text-accent">Streaming Events</p>
          <h2 className="m-0 text-[20px] font-extrabold text-fg">Create New Event</h2>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-6 rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="relative flex items-center">
          {STEPS.map((s, i) => {
            const isDone   = s.num < step;
            const isActive = s.num === step;
            return (
              <React.Fragment key={s.num}>
                <div className={`relative z-[1] flex flex-col items-center gap-2 ${i === STEPS.length-1 ? "flex-[0_0_auto]" : "flex-1"}`}>
                  <button type="button"
                    onClick={() => { if (s.num <= step) { setStep(s.num); setStepError(null); } }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-extrabold transition-all duration-200 ${s.num <= step ? "cursor-pointer" : "cursor-default"} ${isActive ? "border-[#5be6b2] bg-[rgba(91,230,178,0.15)] text-accent" : isDone ? "border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.08)] text-[rgba(91,230,178,0.7)]" : "border-border bg-[#0b1114] text-muted-2"}`}>
                    {isDone
                      ? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                      : s.num
                    }
                  </button>
                  <span className={`whitespace-nowrap text-[11px] ${isActive ? "font-bold text-accent" : "font-medium text-muted"}`}>{s.label}</span>
                </div>
                {i < STEPS.length-1 && (
                  <div className={`mx-1 mb-5 h-[2px] flex-1 rounded-full transition-[background] duration-200 ${isDone ? "bg-[rgba(91,230,178,0.4)]" : "bg-border"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {step === 1 && <S1 form={form} set={setForm} />}
      {step === 2 && <S2 form={form} set={setForm} />}
      {step === 3 && <S3 form={form} set={setForm} />}
      {step === 4 && <S4 form={form} set={setForm} />}
      {step === 5 && <S5 form={form} set={setForm} />}

      {/* Step error */}
      {stepError && (
        <div className="mt-4 flex items-center gap-[10px] rounded-[10px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span className="text-[13px] font-semibold text-danger">{stepError}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-6 pb-12">
        <button type="button" onClick={step === 1 ? onBack : goPrev}
          className="cursor-pointer rounded-[10px] border border-border bg-surface px-6 py-[11px] text-[13px] font-bold text-muted">
          {step === 1 ? "Cancel" : "← Back"}
        </button>
        {step < 5 ? (
          <button type="button" onClick={goNext}
            className="cursor-pointer rounded-[10px] border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.12)] px-7 py-[11px] text-[13px] font-extrabold tracking-[0.03em] text-accent">
            Next →
          </button>
        ) : (
          <div className="flex gap-[10px]">
            <button type="button" disabled={submitting} onClick={() => handlePublish('draft')}
              className={`rounded-[10px] border border-border bg-surface px-6 py-[11px] text-[13px] font-bold text-muted ${submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}>
              {submitting ? "Saving…" : "Save as Draft"}
            </button>
            <button type="button" disabled={submitting} onClick={() => handlePublish('published')}
              className={`rounded-[10px] border-[1.5px] border-[rgba(91,230,178,0.4)] bg-[rgba(91,230,178,0.12)] px-7 py-[11px] text-[13px] font-extrabold tracking-[0.03em] text-accent ${submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}>
              {submitting ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
