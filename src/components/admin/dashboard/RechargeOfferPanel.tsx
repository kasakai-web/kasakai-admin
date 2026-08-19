"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";

/* Wallet recharge offers — the admin editor.
 *
 * One campaign made of tiers the admin defines: any recharge range, paying
 * either a flat amount or a percentage (with a cap). The campaign carries the
 * guard rails — validity window, per-player limit, total budget, first-recharge
 * only — because an offer without them is just a permanent discount.
 *
 * All validation is the server's (utils/rechargeOffers.js): the same rules have
 * to hold for the credit path, so duplicating them here would only let the two
 * drift. This form sends the draft and shows what comes back. "Preview" posts
 * the UNSAVED draft to the same engine that credits, which makes it a dry run
 * of the save as much as a calculator. */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1";

const TOPBAR_BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
const FORM_ERROR =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
const FIELD_LABEL = "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";

type TierMode = "flat" | "percent";

type ApiTier = {
  key: string;
  minPaise: number;
  maxPaise: number | null;
  mode: TierMode;
  bonusPaise: number;
  percent: number;
  maxBonusPaise: number;
  rangeLabel: string;
  rewardLabel: string;
  exampleMinBonusPaise: number;
  exampleMaxBonusPaise: number;
};

type OfferConfig = {
  enabled: boolean;
  active: boolean;
  statusReason: string;
  campaignId: string;
  startsAtIST: string | null;
  endsAtIST: string | null;
  firstRechargeOnly: boolean;
  perPlayerLimit: number;
  maxTotalBonusPaise: number;
  spentBonusPaise: number;
  remainingBudgetPaise: number | null;
  tiers: ApiTier[];
  limits: { maxTiers: number; maxPercent: number; maxBonusPaise: number };
  stats: { totalBonusPaise: number; bonusCount: number; playerCount: number; avgBonusPaise: number };
};

type DraftTier = {
  id: string;
  minRs: string;
  maxRs: string; // "" = open-ended
  mode: TierMode;
  bonusRs: string;
  percent: string;
  capRs: string; // "" or 0 = uncapped
};

type Preview = {
  bonusPaise: number;
  totalPaise: number;
  reason: string;
  tierLabel: string | null;
  upsell: { addPaise: number; bonusPaise: number; atPaise: number } | null;
};

// Why the campaign is not paying out. Anything not listed is a live campaign.
const STATUS_LABEL: Record<string, string> = {
  disabled: "Off",
  not_started: "Scheduled — not started yet",
  expired: "Ended",
  budget_exhausted: "Budget spent",
};

const fmt = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const toPaise = (rs: string) => Math.round(Number(rs || 0) * 100);
const toRs = (paise: number) => String(paise / 100);

let tierSeq = 0;
const newTierId = () => `t${++tierSeq}`;

function toDraft(t: ApiTier): DraftTier {
  return {
    id: newTierId(),
    minRs: toRs(t.minPaise),
    maxRs: t.maxPaise == null ? "" : toRs(t.maxPaise),
    mode: t.mode,
    bonusRs: t.mode === "flat" ? toRs(t.bonusPaise) : "",
    percent: t.mode === "percent" ? String(t.percent) : "",
    capRs: t.mode === "percent" && t.maxBonusPaise > 0 ? toRs(t.maxBonusPaise) : "",
  };
}

export function RechargeOfferPanel() {
  const [config, setConfig] = useState<OfferConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [tiers, setTiers] = useState<DraftTier[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [firstOnly, setFirstOnly] = useState(false);
  const [perPlayerLimit, setPerPlayerLimit] = useState("0");
  const [budgetRs, setBudgetRs] = useState("0");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [previewRs, setPreviewRs] = useState("500");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewErr, setPreviewErr] = useState("");

  // The exact body both save and preview post, so the dry run is honest.
  const payload = useMemo(
    () => ({
      enabled,
      startsAtIST: startsAt || null,
      endsAtIST: endsAt || null,
      firstRechargeOnly: firstOnly,
      perPlayerLimit: Math.round(Number(perPlayerLimit || 0)),
      maxTotalBonusPaise: toPaise(budgetRs),
      tiers: tiers.map((t) => ({
        minPaise: toPaise(t.minRs),
        maxPaise: t.maxRs.trim() === "" ? null : toPaise(t.maxRs),
        mode: t.mode,
        ...(t.mode === "percent"
          ? { percent: Number(t.percent || 0), maxBonusPaise: toPaise(t.capRs) }
          : { bonusPaise: toPaise(t.bonusRs) }),
      })),
    }),
    [enabled, startsAt, endsAt, firstOnly, perPlayerLimit, budgetRs, tiers]
  );

  const applyConfig = useCallback((data: OfferConfig) => {
    setConfig(data);
    setEnabled(!!data.enabled);
    setTiers((data.tiers || []).map(toDraft));
    setStartsAt(data.startsAtIST || "");
    setEndsAt(data.endsAtIST || "");
    setFirstOnly(!!data.firstRechargeOnly);
    setPerPlayerLimit(String(data.perPlayerLimit || 0));
    setBudgetRs(toRs(data.maxTotalBonusPaise || 0));
  }, []);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const res = await fetch(`${API_BASE}/admin/wallet-offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Failed to load offers."); return; }
      applyConfig(data.data);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const save = async () => {
    setSaving(true);
    setErr("");
    setMsg(null);
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const res = await fetch(`${API_BASE}/admin/wallet-offers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Save failed."); return; }
      applyConfig(data.data);
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const resetCampaign = async () => {
    const spent = config ? fmt(config.spentBonusPaise) : "₹0";
    if (!window.confirm(
      `Start a new campaign?\n\nThe tiers stay exactly as they are. The payout counter (${spent}) resets to zero and every player's per-player limit starts again.\n\nBonuses already paid stay attributed to the old campaign.`
    )) return;

    setSaving(true);
    setErr("");
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const res = await fetch(`${API_BASE}/admin/wallet-offers/reset-campaign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Could not start a new campaign."); return; }
      applyConfig(data.data);
      setMsg("New campaign started ✓");
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  // Preview runs against the unsaved draft, debounced so it does not fire on
  // every keystroke. Its errors stay out of the save error line — a half-typed
  // tier is not a failure, it is just not previewable yet.
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!expanded) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);

    previewTimer.current = setTimeout(async () => {
      const amountPaise = toPaise(previewRs);
      if (!amountPaise || amountPaise <= 0 || !tiers.length) {
        setPreview(null);
        setPreviewErr("");
        return;
      }
      try {
        const token = getAdminToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/admin/wallet-offers/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...payload, amountPaise }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setPreview(null);
          setPreviewErr(data.message || "Cannot preview this configuration.");
          return;
        }
        setPreviewErr("");
        setPreview(data.data);
      } catch {
        setPreviewErr("Cannot reach the server.");
      }
    }, 500);

    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [previewRs, payload, tiers.length, expanded]);

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    // Start the new tier where the previous one ends — the common case, and it
    // keeps the ranges non-overlapping without the admin doing the arithmetic.
    const suggestedMin = last
      ? last.maxRs.trim() !== "" ? last.maxRs : String(Number(last.minRs || 0) * 2 || 500)
      : "500";
    setTiers((p) => [
      ...p,
      { id: newTierId(), minRs: suggestedMin, maxRs: "", mode: "flat", bonusRs: "", percent: "", capRs: "" },
    ]);
  };

  const patchTier = (id: string, patch: Partial<DraftTier>) =>
    setTiers((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTier = (id: string) => setTiers((p) => p.filter((t) => t.id !== id));

  const statusLabel = config && !config.active ? STATUS_LABEL[config.statusReason] ?? "Off" : null;

  return (
    <div className="mb-4 rounded-xl border border-border-2 bg-surface p-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-bold text-fg">💸 Wallet Recharge Offers</span>
            {config && (
              <span
                className={`rounded-full px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] ${
                  config.active
                    ? "bg-[rgba(34,197,94,0.12)] text-success"
                    : "bg-[rgba(255,255,255,0.06)] text-muted"
                }`}
              >
                {config.active ? "Live" : statusLabel}
              </span>
            )}
          </div>
          <div className="mt-[3px] max-w-[560px] text-[12px] leading-[1.45] text-muted">
            Bonus wallet credit on qualifying recharges. You set the ranges and what each
            one pays — a flat amount, or a percentage of the recharge.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-[7px] whitespace-nowrap text-[13px] text-fg">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {enabled ? "Offers Enabled" : "Offers Disabled"}
          </label>
          <button className={TOPBAR_BTN} type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide setup ▲" : "Set up ▼"}
          </button>
        </div>
      </div>

      {err && <div className={`${FORM_ERROR} mt-[10px]`}>{err}</div>}

      {/* ── Payout summary — always visible ── */}
      {config && (
        <div className="mt-3 grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-2">
          {[
            { label: "Paid out", value: fmt(config.stats.totalBonusPaise) },
            { label: "Bonuses given", value: String(config.stats.bonusCount) },
            { label: "Players", value: String(config.stats.playerCount) },
            {
              label: "Budget left",
              value: config.remainingBudgetPaise == null ? "No cap" : fmt(config.remainingBudgetPaise),
            },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-3 py-[10px]">
              <div className="mb-[4px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{s.label}</div>
              <div className="font-mono text-[18px] text-fg">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Read-only tier summary when collapsed ── */}
      {!expanded && config && config.tiers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {config.tiers.map((t) => (
            <div key={t.key} className="rounded-[10px] border border-border-2 px-3 py-[7px] text-[12px] text-muted">
              {t.rangeLabel} → <strong className="text-success">{t.rewardLabel}</strong>
            </div>
          ))}
        </div>
      )}
      {!expanded && config && config.tiers.length === 0 && (
        <div className="mt-3 text-[12px] text-muted">
          No tiers yet — open setup to add one.
        </div>
      )}

      {expanded && (
        <>
          {/* ── Tiers ── */}
          <div className="mt-4 mb-[6px] flex items-center justify-between">
            <div className="text-[13px] font-bold text-fg">Recharge tiers</div>
            <div className="font-mono text-[11px] text-muted">
              min inclusive · max exclusive · gaps allowed, overlaps not
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {tiers.map((t, i) => (
              <div
                key={t.id}
                className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border-2 px-3 py-[10px]"
              >
                <div className="w-[26px] shrink-0 pb-[7px] font-mono text-[12px] text-muted">{i + 1}</div>

                <div className="w-[110px]">
                  <label className={FIELD_LABEL}>From ₹</label>
                  <input
                    className={FIELD} type="number" min={10} step={1} value={t.minRs}
                    onChange={(e) => patchTier(t.id, { minRs: e.target.value })}
                  />
                </div>

                <div className="w-[130px]">
                  <label className={FIELD_LABEL}>Up to ₹</label>
                  <input
                    className={FIELD} type="number" min={0} step={1} value={t.maxRs}
                    placeholder="no limit"
                    onChange={(e) => patchTier(t.id, { maxRs: e.target.value })}
                  />
                </div>

                <div className="w-[120px]">
                  <label className={FIELD_LABEL}>Bonus type</label>
                  <select
                    className={FIELD} value={t.mode}
                    onChange={(e) => patchTier(t.id, { mode: e.target.value as TierMode })}
                  >
                    <option value="flat">Flat ₹</option>
                    <option value="percent">Percent %</option>
                  </select>
                </div>

                {t.mode === "flat" ? (
                  <div className="w-[110px]">
                    <label className={FIELD_LABEL}>Bonus ₹</label>
                    <input
                      className={FIELD} type="number" min={0} step={1} value={t.bonusRs}
                      onChange={(e) => patchTier(t.id, { bonusRs: e.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-[90px]">
                      <label className={FIELD_LABEL}>Percent</label>
                      <input
                        className={FIELD} type="number" min={0} max={100} step={0.5} value={t.percent}
                        onChange={(e) => patchTier(t.id, { percent: e.target.value })}
                      />
                    </div>
                    <div className="w-[120px]">
                      <label className={FIELD_LABEL}>Max bonus ₹</label>
                      <input
                        className={FIELD} type="number" min={0} step={1} value={t.capRs}
                        placeholder={t.maxRs.trim() === "" ? "required" : "no cap"}
                        onChange={(e) => patchTier(t.id, { capRs: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => removeTier(t.id)}
                  className="ml-auto cursor-pointer border border-border-2 bg-transparent px-[10px] py-[5px] font-mono text-[11px] text-muted hover:border-danger hover:text-danger"
                >
                  Remove
                </button>
              </div>
            ))}

            {tiers.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-border-2 px-3 py-4 text-center text-[12px] text-muted">
                No tiers. Add one to start paying a bonus.
              </div>
            )}
          </div>

          <button
            className={`${TOPBAR_BTN} mt-[10px]`}
            type="button"
            onClick={addTier}
            disabled={!!config && tiers.length >= config.limits.maxTiers}
          >
            + Add tier
          </button>

          {/* ── Campaign rules ── */}
          <div className="mt-5 mb-[6px] text-[13px] font-bold text-fg">Campaign rules</div>
          <div className="flex flex-wrap gap-3">
            <div className="w-[190px]">
              <label className={FIELD_LABEL}>Starts (IST)</label>
              <input
                className={FIELD} type="datetime-local" value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="w-[190px]">
              <label className={FIELD_LABEL}>Ends (IST)</label>
              <input
                className={FIELD} type="datetime-local" value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <div className="w-[150px]">
              <label className={FIELD_LABEL}>Per player limit</label>
              <input
                className={FIELD} type="number" min={0} step={1} value={perPlayerLimit}
                onChange={(e) => setPerPlayerLimit(e.target.value)}
              />
              <div className="mt-[4px] text-[11px] text-muted">0 = unlimited</div>
            </div>
            <div className="w-[170px]">
              <label className={FIELD_LABEL}>Total budget ₹</label>
              <input
                className={FIELD} type="number" min={0} step={1} value={budgetRs}
                onChange={(e) => setBudgetRs(e.target.value)}
              />
              <div className="mt-[4px] text-[11px] text-muted">0 = unlimited</div>
            </div>
            <label className="flex cursor-pointer items-center gap-[7px] self-end pb-[7px] text-[12.5px] text-fg">
              <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
              First recharge only
            </label>
          </div>

          {/* ── Dry run ── */}
          <div className="mt-5 rounded-[10px] border border-border-2 bg-surface-2 px-3 py-[12px]">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[150px]">
                <label className={FIELD_LABEL}>If a player adds ₹</label>
                <input
                  className={FIELD} type="number" min={0} step={1} value={previewRs}
                  onChange={(e) => setPreviewRs(e.target.value)}
                />
              </div>
              <div className="flex-1 pb-[2px] text-[13px]">
                {previewErr ? (
                  <span className="text-danger">{previewErr}</span>
                ) : preview ? (
                  preview.bonusPaise > 0 ? (
                    <>
                      <span className="text-success font-bold">
                        they get {fmt(preview.bonusPaise)} bonus
                      </span>
                      <span className="text-muted">
                        {" "}— {fmt(preview.totalPaise)} lands in their wallet
                        {preview.tierLabel ? ` (tier ${preview.tierLabel})` : ""}
                      </span>
                      {preview.upsell && (
                        <div className="mt-[3px] text-[12px] text-muted">
                          Nudge shown to them: add {fmt(preview.upsell.addPaise)} more → {fmt(preview.upsell.bonusPaise)} bonus
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">
                      no bonus at this amount
                      {preview.upsell
                        ? ` — nudge shown: add ${fmt(preview.upsell.addPaise)} more for ${fmt(preview.upsell.bonusPaise)}`
                        : ""}
                    </span>
                  )
                ) : (
                  <span className="text-muted">Enter an amount to dry-run the tiers above.</span>
                )}
              </div>
            </div>
          </div>

          {config && (
            <div className="mt-3 font-mono text-[11px] text-muted">
              Campaign {config.campaignId} · paid out {fmt(config.spentBonusPaise)}
              {config.stats.bonusCount > 0 && ` across ${config.stats.bonusCount} bonuses (avg ${fmt(config.stats.avgBonusPaise)})`}
            </div>
          )}
        </>
      )}

      {/* ── Actions ── */}
      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <button
          className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`}
          onClick={save}
          disabled={saving || loading}
          type="button"
        >
          {saving ? "Saving…" : "Save Offers"}
        </button>
        {expanded && (
          <button className={TOPBAR_BTN} onClick={resetCampaign} disabled={saving || loading} type="button">
            Start new campaign
          </button>
        )}
        {msg && <span className="text-[13px] font-semibold text-success">{msg}</span>}
        {loading && <span className="text-[13px] text-muted">Loading…</span>}
      </div>
    </div>
  );
}
