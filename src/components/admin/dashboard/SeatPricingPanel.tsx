"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "./shared/api";

/* Early-bird pricing — the platform guard rails (seat_pricing_settings).
 *
 * Organisers set their own ladders; this panel is the kill switch over all of
 * them, plus the two limits every ladder is validated against. The rules are the
 * server's (utils/seatPricing.js validateLadder): this form sends the values and
 * renders what comes back.
 *
 * Off stops new early-bird sales on the spot. Seats already sold keep their
 * price, held requests keep their held price, and the lifecycle job re-works the
 * price browse shows on every upcoming laddered game over the next few minutes.
 * The feature also needs SEAT_PRICING_ENABLED=true on the server; without it the
 * switch here can only keep it off, and the panel says so.
 */

const TOPBAR_BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
const FORM_ERROR =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
const FIELD_LABEL = "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";

type Settings = {
  enabled: boolean;
  maxTiers: number;
  minSharePct: number;
  envEnabled: boolean;
  updatedAt?: string;
};

export function SeatPricingPanel() {
  const [config, setConfig] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const apply = useCallback((data: Settings) => {
    setConfig((prev) => ({ ...data, updatedAt: data.updatedAt ?? prev?.updatedAt }));
    setDraft(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAdminToken();
        if (!token) { if (!cancelled) setErr("Admin session missing."); return; }
        const res = await fetch(`${API_BASE}/admin/seat-pricing-settings`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) { setErr(data.message || "Failed to load early-bird settings."); return; }
        apply(data.data);
      } catch {
        if (!cancelled) setErr("Cannot reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apply]);

  const save = async (override?: Partial<Settings>) => {
    if (!draft) return;
    setSaving(true);
    setErr("");
    setMsg(null);
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const body = { ...draft, ...override };
      const res = await fetch(`${API_BASE}/admin/seat-pricing-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: body.enabled, maxTiers: Number(body.maxTiers), minSharePct: Number(body.minSharePct) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Save failed."); return; }
      apply({ ...data.data, updatedAt: new Date().toISOString() });
      setMsg(data.message || "Saved ✓");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  /* A kill switch saves on the spot — the moment an admin reaches for it is not
     the moment to need a second click. */
  const toggleMaster = (next: boolean) => {
    setDraft((d) => (d ? { ...d, enabled: next } : d));
    save({ enabled: next });
  };
  const patch = (p: Partial<Settings>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const dirty = !!config && !!draft
    && (Number(config.maxTiers) !== Number(draft.maxTiers) || Number(config.minSharePct) !== Number(draft.minSharePct));
  const live = !!config?.enabled && !!config?.envEnabled;

  return (
    <div className="mb-4 rounded-xl border border-border-2 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-bold text-fg">🐦 Early-bird Pricing</span>
            {config && (
              <span className={`rounded-full px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] ${
                live ? "bg-[rgba(34,197,94,0.12)] text-success" : "bg-[rgba(255,255,255,0.06)] text-muted"
              }`}>
                {live ? "Live" : "Off"}
              </span>
            )}
          </div>
          <div className="mt-[3px] max-w-[600px] text-[12px] leading-[1.45] text-muted">
            Organisers can sell a game&apos;s first seats cheaper. Off stops every new early-bird sale at once;
            seats already sold keep their price and pending requests keep the price they were promised.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-[7px] whitespace-nowrap text-[13px] text-fg">
            <input
              type="checkbox"
              disabled={loading || saving || !draft}
              checked={!!draft?.enabled}
              onChange={(e) => toggleMaster(e.target.checked)}
            />
            {draft?.enabled ? "Early-bird Enabled" : "Early-bird Disabled"}
          </label>
          <button className={TOPBAR_BTN} type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide setup ▲" : "Set up ▼"}
          </button>
        </div>
      </div>

      {err && <div className={`${FORM_ERROR} mt-[10px]`}>{err}</div>}
      {loading && <div className="mt-3 text-[12px] text-muted">Loading…</div>}
      {config && !config.envEnabled && (
        <div className="mt-3 rounded-md border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-[14px] py-[10px] text-[12.5px] text-warning">
          The server flag SEAT_PRICING_ENABLED is not on, so early-bird stays off whatever this switch says.
        </div>
      )}

      {!expanded && config && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            `Up to ${config.maxTiers} tier${config.maxTiers === 1 ? "" : "s"} per game`,
            `No tier below ${config.minSharePct}% of the fee`,
          ].map((chip) => (
            <div key={chip} className="rounded-[10px] border border-border-2 px-3 py-[7px] text-[12px] text-muted">{chip}</div>
          ))}
        </div>
      )}

      {expanded && draft && config && (
        <>
          <div className="mt-4 mb-[6px] text-[13px] font-bold text-fg">Guard rails</div>
          <div className="flex flex-wrap gap-3">
            <div className="w-[220px]">
              <label className={FIELD_LABEL}>Max tiers per game</label>
              <input className={FIELD} type="number" min={1} max={5} value={draft.maxTiers}
                onChange={(e) => patch({ maxTiers: Number(e.target.value) })} />
              <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">1 to 5. Ladders already saved keep their tiers.</div>
            </div>
            <div className="w-[220px]">
              <label className={FIELD_LABEL}>Lowest tier, % of the fee</label>
              <input className={FIELD} type="number" min={10} max={95} value={draft.minSharePct}
                onChange={(e) => patch({ minSharePct: Number(e.target.value) })} />
              <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">
                10 to 95. A typo guard — stops ₹25 on a ₹250 game. Checked when a ladder is saved.
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button className={`${TOPBAR_BTN} ${dirty ? TOPBAR_BTN_PRIMARY : ""}`} type="button" disabled={saving || !dirty} onClick={() => save()}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className={TOPBAR_BTN} type="button" disabled={saving || !dirty} onClick={() => setDraft(config)}>Discard</button>
            {msg && <span className="font-mono text-[12px] text-success">{msg}</span>}
            {!dirty && !msg && config.updatedAt && (
              <span className="font-mono text-[11px] text-muted">Last changed {new Date(config.updatedAt).toLocaleString("en-IN")}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
