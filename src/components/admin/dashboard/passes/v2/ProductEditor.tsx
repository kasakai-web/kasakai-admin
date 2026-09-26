"use client";

/* Create or edit one pass product.
 *
 * Editing a LIVE product affects new issues only: an issued pass carries a
 * frozen copy of these terms, and nothing here can re-price or re-scope a pass
 * somebody already holds. The banner says so, with the number of holders on the
 * old terms beside it — the warning means nothing without that number.
 *
 * Validation is the server's, so what it refuses here is exactly what it would
 * refuse on save. */

import { useEffect, useMemo, useState } from "react";
import {
  adminFetch, Product, Rule, emptyProduct, emptyRule,
  BTN, BTN_PRIMARY, FIELD, FIELD_LABEL, CARD, ERROR_BOX, WARN_BOX,
  toPaise, toRs,
} from "./shared";
import { RuleBuilder } from "./RuleBuilder";
import { RulePreview } from "./RulePreview";

type Validation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  described: { summary: string };
};

export function ProductEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Product | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Product>(initial ? { ...initial } : emptyProduct());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [check, setCheck] = useState<Validation | null>(null);
  const editing = Boolean(initial?._id);

  const set = (patch: Partial<Product>) => setDraft((d) => ({ ...d, ...patch }));

  // Exactly the body the save posts, so the live check is a dry run of it.
  const payload = useMemo(() => ({
    code: draft.code,
    name: draft.name,
    subtitle: draft.subtitle,
    description: draft.description,
    highlights: draft.highlights,
    status: draft.status,
    pricePaise: draft.pricePaise,
    purchasable: draft.purchasable,
    grantable: draft.grantable,
    validity: draft.validity,
    benefit: draft.benefit,
    limits: draft.limits,
    rules: draft.rules,
    funding: draft.funding,
  }), [draft]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await adminFetch<Validation>("/admin/pass-products/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) setCheck(res.data || null);
    }, 350);
    return () => clearTimeout(t);
  }, [payload]);

  const save = async () => {
    setSaving(true);
    setErr("");
    const res = editing
      ? await adminFetch(`/admin/pass-products/${initial!._id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await adminFetch("/admin/pass-products", { method: "POST", body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { setErr([res.message, ...(res.details || [])].filter(Boolean).join(" ")); return; }
    onSaved(editing ? `"${draft.name}" updated — new issues only.` : `"${draft.name}" created.`);
  };

  const setRule = (i: number, next: Rule) =>
    set({ rules: draft.rules.map((r, idx) => (idx === i ? next : r)) });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(0,0,0,0.75)] p-6 max-[640px]:p-2">
      <div className="mx-auto max-w-[1100px] rounded-[16px] border border-border bg-bg p-6 max-[640px]:p-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold text-fg">
            {editing ? `Edit ${initial!.name}` : "New pass product"}
          </h2>
          <button type="button" className={BTN} onClick={onClose}>Close</button>
        </div>

        {editing && (
          <div className={`${WARN_BOX} mb-4`}>
            Editing affects <b>new issues only</b>. Every pass already issued carries its own
            frozen copy of these terms and is untouched by anything you change here.
            {typeof initial?.stats?.live === "number" && (
              <> {initial.stats.live} live pass{initial.stats.live === 1 ? "" : "es"} on the old terms.</>
            )}
          </div>
        )}

        {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}

        <div className="grid grid-cols-[1fr_380px] items-start gap-5 max-[1000px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            {/* ── Identity ── */}
            <div className={CARD}>
              <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                <div>
                  <label className={FIELD_LABEL}>Name</label>
                  <input className={FIELD} value={draft.name}
                    onChange={(e) => set({ name: e.target.value })} placeholder="Weekend Warrior" />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Code (stable, appears in the ledger)</label>
                  <input className={FIELD} value={draft.code} disabled={editing}
                    onChange={(e) => set({ code: e.target.value.toLowerCase() })}
                    placeholder="weekend-ncr-oct-2026" />
                </div>
              </div>
              <div className="mt-3">
                <label className={FIELD_LABEL}>Subtitle (player-facing)</label>
                <input className={FIELD} value={draft.subtitle || ""}
                  onChange={(e) => set({ subtitle: e.target.value })}
                  placeholder="Free football every Saturday and Sunday in Delhi NCR" />
              </div>
              <div className="mt-3">
                {/* Marketing copy, not terms. What the pass DOES is derived from
                    the rules below and printed by the engine, so nothing typed
                    here can contradict what it will actually do. */}
                <label className={FIELD_LABEL}>
                  Selling points for the public passes page — one per line, up to 8
                </label>
                <textarea
                  className={`${FIELD} min-h-[96px]`}
                  value={(draft.highlights || []).join("\n")}
                  onChange={(e) => set({
                    highlights: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                  })}
                  placeholder={"Book unlimited weekend games for 30 days\nNo separate match fee on eligible games"}
                />
              </div>
            </div>

            {/* ── Rules ── */}
            <div className={CARD}>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                  What it covers
                </span>
                <button type="button" className={BTN}
                  onClick={() => set({ rules: [...draft.rules, emptyRule()] })}>
                  + Add an OR rule
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {draft.rules.map((rule, i) => (
                  <RuleBuilder
                    key={i}
                    rule={rule}
                    index={i}
                    total={draft.rules.length}
                    onChange={(next) => setRule(i, next)}
                    onRemove={() => set({ rules: draft.rules.filter((_, idx) => idx !== i) })}
                  />
                ))}
              </div>
            </div>

            {/* ── Benefit ── */}
            <div className={CARD}>
              <label className={FIELD_LABEL}>What coverage is worth</label>
              <div className="flex flex-wrap items-end gap-3">
                <select
                  className={`${FIELD} w-[180px]`}
                  value={draft.benefit.mode}
                  onChange={(e) => set({ benefit: { ...draft.benefit, mode: e.target.value as Product["benefit"]["mode"] } })}
                >
                  <option value="free">Free</option>
                  <option value="flat">Flat amount off</option>
                  <option value="percent">Percentage off</option>
                  <option value="capped_free">Free up to a cap</option>
                </select>

                {draft.benefit.mode === "flat" && (
                  <div>
                    <label className={FIELD_LABEL}>Amount off (₹)</label>
                    <input className={`${FIELD} w-[120px]`} value={toRs(draft.benefit.amountPaise)}
                      onChange={(e) => set({ benefit: { ...draft.benefit, amountPaise: toPaise(e.target.value) } })} />
                  </div>
                )}
                {draft.benefit.mode === "percent" && (
                  <>
                    <div>
                      <label className={FIELD_LABEL}>Percent</label>
                      <input className={`${FIELD} w-[90px]`} value={draft.benefit.percent ?? ""}
                        onChange={(e) => set({ benefit: { ...draft.benefit, percent: Number(e.target.value || 0) } })} />
                    </div>
                    <div>
                      {/* Uncapped only if the admin explicitly leaves it so — and
                          the server warns about exactly that. */}
                      <label className={FIELD_LABEL}>Cap per game (₹)</label>
                      <input className={`${FIELD} w-[120px]`} value={toRs(draft.benefit.maxBenefitPaise)}
                        onChange={(e) => set({ benefit: { ...draft.benefit, maxBenefitPaise: toPaise(e.target.value) } })} />
                    </div>
                  </>
                )}
                {draft.benefit.mode === "capped_free" && (
                  <div>
                    <label className={FIELD_LABEL}>Covers up to (₹)</label>
                    <input className={`${FIELD} w-[120px]`} value={toRs(draft.benefit.coverUptoPaise)}
                      onChange={(e) => set({ benefit: { ...draft.benefit, coverUptoPaise: toPaise(e.target.value) } })} />
                  </div>
                )}
                <div>
                  <label className={FIELD_LABEL}>Guests covered</label>
                  <input className={`${FIELD} w-[90px]`} value={draft.benefit.coversGuests ?? 0}
                    onChange={(e) => set({ benefit: { ...draft.benefit, coversGuests: Number(e.target.value || 0) } })} />
                </div>
              </div>
            </div>

            {/* ── Limits ── */}
            <div className={CARD}>
              <label className={FIELD_LABEL}>
                Limits — 0 is unlimited. maxBenefitPaise is the one that actually controls cost.
              </label>
              <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
                {([
                  ["maxRedemptions", "Total games"],
                  ["maxPerDay", "Per day"],
                  ["maxPerWeek", "Per week"],
                  ["maxPerMonth", "Per month"],
                  ["maxPerTurf", "Per venue"],
                  ["maxPerOrganiser", "Per organiser"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className={FIELD_LABEL}>{label}</label>
                    <input className={FIELD} value={draft.limits[key]}
                      onChange={(e) => set({ limits: { ...draft.limits, [key]: Number(e.target.value || 0) } })} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className={FIELD_LABEL}>Total value cap (₹)</label>
                  <input className={FIELD} value={toRs(draft.limits.maxBenefitPaise)}
                    onChange={(e) => set({ limits: { ...draft.limits, maxBenefitPaise: toPaise(e.target.value) } })} />
                </div>
              </div>
            </div>

            {/* ── Validity, price, funding ── */}
            <div className={CARD}>
              <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
                <div>
                  <label className={FIELD_LABEL}>Runs for</label>
                  <select className={FIELD} value={draft.validity.mode}
                    onChange={(e) => set({ validity: { ...draft.validity, mode: e.target.value as Product["validity"]["mode"] } })}>
                    <option value="fixed_days">A fixed number of days</option>
                    <option value="calendar_month">A calendar month</option>
                    <option value="half_month">Half a month</option>
                    <option value="absolute">Fixed dates</option>
                  </select>
                </div>
                {draft.validity.mode === "fixed_days" && (
                  <div>
                    <label className={FIELD_LABEL}>Days</label>
                    <input className={FIELD} value={draft.validity.days ?? 30}
                      onChange={(e) => set({ validity: { ...draft.validity, days: Number(e.target.value || 0) } })} />
                  </div>
                )}
                {(draft.validity.mode === "calendar_month" || draft.validity.mode === "half_month") && (
                  <div>
                    <label className={FIELD_LABEL}>Month</label>
                    <select className={FIELD} value={draft.validity.monthAnchor || "current"}
                      onChange={(e) => set({ validity: { ...draft.validity, monthAnchor: e.target.value as "current" | "next" } })}>
                      <option value="current">This month</option>
                      <option value="next">Next month</option>
                    </select>
                  </div>
                )}
                {draft.validity.mode === "half_month" && (
                  <div>
                    <label className={FIELD_LABEL}>Half</label>
                    <select className={FIELD} value={draft.validity.half || 1}
                      onChange={(e) => set({ validity: { ...draft.validity, half: Number(e.target.value) as 1 | 2 } })}>
                      <option value={1}>1st – 15th</option>
                      <option value={2}>16th – end</option>
                    </select>
                  </div>
                )}
                <div>
                  {/* A player who buys a weekend pass on Wednesday should not
                      lose two days of it. */}
                  <label className={FIELD_LABEL}>Clock starts</label>
                  <select className={FIELD} value={draft.validity.activationMode}
                    onChange={(e) => set({ validity: { ...draft.validity, activationMode: e.target.value as Product["validity"]["activationMode"] } })}>
                    <option value="on_issue">On issue</option>
                    <option value="on_first_use">On first use</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
                <div>
                  <label className={FIELD_LABEL}>Price (₹) — 0 is grant-only</label>
                  <input className={FIELD} value={toRs(draft.pricePaise)}
                    onChange={(e) => set({ pricePaise: toPaise(e.target.value) })} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Who bears a covered seat</label>
                  <select className={FIELD} value={draft.funding.model}
                    onChange={(e) => set({ funding: { ...draft.funding, model: e.target.value as Product["funding"]["model"] } })}>
                    <option value="organiser">Organiser</option>
                    <option value="platform">Platform (reimbursed in full)</option>
                    <option value="shared">Shared</option>
                  </select>
                </div>
                {draft.funding.model === "shared" && (
                  <div>
                    <label className={FIELD_LABEL}>Organiser share (%)</label>
                    <input className={FIELD} value={draft.funding.organiserSharePercent}
                      onChange={(e) => set({ funding: { ...draft.funding, organiserSharePercent: Number(e.target.value || 0) } })} />
                  </div>
                )}
              </div>

              {/* The organiser's opt-out, and the one case for overriding it.
                  Only offered on a platform-funded product, because only there
                  is the organiser paid in full — the server refuses it on the
                  other two rather than relying on this being hidden. */}
              {draft.funding.model === "platform" && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-body">
                  <input type="checkbox" className="mt-[3px]"
                    checked={!!draft.funding.overridesConsent}
                    onChange={(e) => set({ funding: { ...draft.funding, overridesConsent: e.target.checked } })} />
                  <span>
                    Seat holders even on games whose organiser turned passes off
                    <span className="mt-[2px] block text-[11px] text-muted">
                      They are reimbursed in full, so the seat costs them nothing — but it is still their
                      pitch, and this takes their exit away. Off unless you mean it. A block on THIS
                      product still stands.
                    </span>
                  </span>
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-body">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={draft.purchasable}
                    onChange={(e) => set({ purchasable: e.target.checked })} />
                  Players can buy it
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={draft.grantable}
                    onChange={(e) => set({ grantable: e.target.checked })} />
                  Admins can grant it
                </label>
              </div>
            </div>
          </div>

          {/* ── The panel beside it ── */}
          <div className="flex flex-col gap-4">
            {check && (
              <div className={CARD}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                  In words
                </div>
                <div className="text-[13.5px] leading-[1.55] text-fg">{check.described.summary}</div>
                {check.errors.length > 0 && (
                  <div className={`${ERROR_BOX} mt-3`}>
                    {check.errors.map((e) => <div key={e}>{e}</div>)}
                  </div>
                )}
                {check.warnings.length > 0 && (
                  <div className={`${WARN_BOX} mt-3`}>
                    {check.warnings.map((w) => <div key={w}>{w}</div>)}
                  </div>
                )}
              </div>
            )}

            <RulePreview rules={draft.rules} benefit={draft.benefit} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={BTN} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`${BTN} ${BTN_PRIMARY} ${check && !check.valid ? "opacity-50" : ""}`}
            disabled={saving || (check ? !check.valid : false)}
            onClick={save}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create pass"}
          </button>
        </div>
      </div>
    </div>
  );
}
