"use client";

/* Every campaign, with the numbers that say whether it is working (PRD §4):
 * state, scope, window, uses, the discount it has given and the budget it has
 * left. "Exhausted", "Scheduled" and "Expired" are not stored — the server
 * derives them on every read — so this list cannot show a campaign as running
 * after its last use or its last day. */

import { useMemo, useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import {
  adminFetch, rupees, shortDate, BTN, BTN_PRIMARY, ERROR_BOX, WARN_BOX,
  Campaign, DisplayState, STATE_TONE, TYPE_LABEL,
} from "./shared";

type CityOptions = { success: boolean; data: { metros: { slug: string; label: string }[] } };
type TurfList = { success: boolean; data: { _id: string; name: string; citySlug?: string | null }[] };

/**
 * Can this campaign reach `value` on one scope dimension? An exclusion says no;
 * an inclusion list says only what it names; no list at all reaches everything —
 * which is why an "every game" campaign shows under every city.
 */
function reaches(include: string[] | undefined, exclude: string[] | undefined, value: string): boolean {
  if (exclude?.includes(value)) return false;
  return !include?.length || include.includes(value);
}

const STATES: { key: "" | DisplayState; label: string }[] = [
  { key: "", label: "Every state" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "paused", label: "Paused" },
  { key: "exhausted", label: "Exhausted" },
  { key: "expired", label: "Expired" },
  { key: "archived", label: "Archived" },
];

function scopeText(c: Campaign): string {
  const s = c.scope || {};
  const parts: string[] = [];
  if (s.metros?.length) parts.push(s.metros.join(", "));
  if (s.turfs?.length) parts.push(`${s.turfs.length} venue${s.turfs.length === 1 ? "" : "s"}`);
  if (s.organisers?.length) parts.push(`${s.organisers.length} organiser${s.organisers.length === 1 ? "" : "s"}`);
  if (s.games?.length) parts.push(`${s.games.length} game${s.games.length === 1 ? "" : "s"}`);
  const excluded = (s.metrosExclude?.length || 0) + (s.turfsExclude?.length || 0)
    + (s.organisersExclude?.length || 0) + (s.gamesExclude?.length || 0) + (s.citySlugsExclude?.length || 0);
  if (!parts.length && !excluded) return "Every game";
  return `${parts.join(" · ") || "Everywhere"}${excluded ? ` (−${excluded} excluded)` : ""}`;
}

export function CampaignList({
  campaigns, loading, error, canManage, enabled, onOpen, onCreate, onChanged,
}: {
  campaigns: Campaign[];
  loading: boolean;
  error: string;
  canManage: boolean;
  enabled: boolean;
  onOpen: (c: Campaign) => void;
  onCreate: () => void;
  onChanged: (message: string) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"" | DisplayState>("");
  const [metro, setMetro] = useState("");
  const [turf, setTurf] = useState("");
  const [actionErr, setActionErr] = useState("");

  // The same registries the scope pickers use, so a filter can only name a
  // city or venue a campaign could actually be scoped to.
  const { data: cityData } = useAdminFetch<CityOptions>("/turfs/city-options", { cache: true });
  const { data: turfData } = useAdminFetch<TurfList>("/turfs/admin/all", { cache: true });
  const metros = cityData?.data?.metros || [];
  const turfs = useMemo(() => (turfData?.data || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [turfData]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return campaigns.filter((c) =>
      (!state || c.state === state)
      && (!metro || reaches(c.scope?.metros, c.scope?.metrosExclude, metro))
      && (!turf || reaches(c.scope?.turfs, c.scope?.turfsExclude, turf))
      && (!needle || `${c.name} ${c.title} ${c.code || ""}`.toLowerCase().includes(needle)));
  }, [campaigns, q, state, metro, turf]);

  const setStatus = async (c: Campaign, status: Campaign["status"]) => {
    const res = await adminFetch<Campaign>(`/admin/discounts/${c._id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { setActionErr([res.message, ...(res.details || [])].filter(Boolean).join(" ")); return; }
    setActionErr("");
    onChanged(`"${c.title}" is now ${res.data?.state || status}.`);
  };

  return (
    <div>
      {!enabled && (
        <div className={`${WARN_BOX} mb-4`}>
          Discounts are switched off for the whole platform (<code>DISCOUNTS_ENABLED=false</code> on the server).
          Campaigns can be prepared, but none will apply until it is switched back on.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-[10px]">
        <input
          className="min-w-[240px] flex-1 border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          placeholder="Search by name, title or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={state} onChange={(e) => setState(e.target.value as "" | DisplayState)}>
          {STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={metro} onChange={(e) => setMetro(e.target.value)} title="Campaigns that can apply in this city">
          <option value="">Every city</option>
          {metros.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
        <select className="max-w-[220px] border border-border-2 bg-surface px-3 py-2 font-mono text-[13px] text-fg"
          value={turf} onChange={(e) => setTurf(e.target.value)} title="Campaigns that can apply at this venue">
          <option value="">Every venue</option>
          {turfs.map((t) => <option key={t._id} value={t._id}>{t.name}{t.citySlug ? ` · ${t.citySlug}` : ""}</option>)}
        </select>
        {canManage && (
          <button type="button" className={`${BTN} ${BTN_PRIMARY}`} onClick={onCreate}>+ Create discount</button>
        )}
      </div>

      {(error || actionErr) && <div className={`${ERROR_BOX} mb-4`}>{actionErr || error}</div>}
      {loading && !campaigns.length && <div className="text-[13px] text-muted">Loading…</div>}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <table className="w-full min-w-[980px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-surface text-[10px] uppercase tracking-[0.08em] text-muted">
                <th className="px-3 py-[10px]">Offer</th>
                <th>Type</th>
                <th>Applied</th>
                <th>Scope</th>
                <th>State</th>
                <th>Window</th>
                <th className="text-right">Uses</th>
                <th className="text-right">Given</th>
                <th className="text-right">Budget</th>
                <th className="px-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c._id} className="cursor-pointer border-b border-border text-body hover:bg-[rgba(255,255,255,0.025)]"
                  onClick={() => onOpen(c)}>
                  <td className="px-3 py-[10px]">
                    <div className="max-w-[260px] truncate font-semibold text-fg">{c.title}</div>
                    <div className="max-w-[260px] truncate text-[11px] text-muted">{c.name} · {c.described?.savingText}</div>
                  </td>
                  <td>{TYPE_LABEL[c.type]}</td>
                  <td className="font-mono text-[11.5px]">
                    {c.trigger === "auto" ? "auto" : c.code || "—"}
                    {c.trigger === "code" && c.codeMode === "unique" && <span className="ml-1 text-[10px] text-muted">unique</span>}
                  </td>
                  <td className="max-w-[180px] truncate text-[11.5px]" title={scopeText(c)}>{scopeText(c)}</td>
                  <td>
                    <span className={`rounded-full border px-[8px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] ${STATE_TONE[c.state || "draft"]}`}>
                      {c.state}
                    </span>
                    {c.archiveReason === "uses_spent" && (
                      <span className="ml-1 font-mono text-[10px] text-muted" title="Archived itself when every use was spent">used up</span>
                    )}
                  </td>
                  <td className="font-mono text-[11px] text-muted">
                    {c.timing.startsAt ? shortDate(c.timing.startsAt) : "now"} → {c.timing.endsAt ? shortDate(c.timing.endsAt) : "open"}
                  </td>
                  <td className="text-right font-mono">
                    {c.stats?.consumed || 0}
                    {c.limits.totalUses ? <span className="text-muted">/{c.limits.totalUses}</span> : null}
                  </td>
                  <td className="text-right font-mono text-accent">{rupees(c.stats?.discountGivenPaise)}</td>
                  <td className="text-right font-mono text-muted">
                    {c.limits.budgetPaise ? `${rupees(c.usage?.spentPaise)} / ${rupees(c.limits.budgetPaise)}` : "—"}
                  </td>
                  <td className="px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <span className="inline-flex gap-[6px]">
                        {(c.status === "draft" || c.status === "paused") && (
                          <button type="button" className={`${BTN} px-[10px]! py-[3px]! text-[11px]!`} onClick={() => setStatus(c, "live")}>
                            {c.status === "draft" ? "Publish" : "Resume"}
                          </button>
                        )}
                        {c.status === "live" && (
                          <button type="button" className={`${BTN} px-[10px]! py-[3px]! text-[11px]!`} onClick={() => setStatus(c, "paused")}>
                            Pause
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border-2 p-10 text-center text-[13px] text-muted">
          No discounts yet. Every campaign starts as a draft — nothing reaches a player until it is published.
        </div>
      )}
      {!loading && campaigns.length > 0 && shown.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border-2 p-8 text-center text-[13px] text-muted">
          No campaign matches that.
        </div>
      )}
    </div>
  );
}
