"use client";

/* Create or edit one discount — the "Create discount" wizard (PRD §4).
 *
 *   1 Identity   2 Benefit   3 Audience   4 Game scope
 *   5 Timing     6 Limits & funding       7 Preview & publish
 *
 * The steps are a reading order, not a gate: any step can be opened at any
 * time, and the whole draft is validated by the SERVER on every change — the
 * same check the save runs — so what the form refuses is exactly what the
 * server would refuse.
 *
 * Editing a campaign that has been live saves a new VERSION. Nothing here can
 * reach a booking already made: what a seat was given is frozen on the seat and
 * in the ledger. The banner says so. */

import { useEffect, useMemo, useState } from "react";
import {
  adminFetch, toPaise, toRs, rupees,
  BTN, BTN_PRIMARY, FIELD, FIELD_LABEL, CARD, ERROR_BOX, WARN_BOX,
  Campaign, Validation, emptyCampaign, payloadOf, toLocalInput, fromLocalInput, generateCode,
} from "./shared";
import { MetroCityPicker, TurfPicker } from "../passes/v2/RulePickers";
import { EntityScopePicker } from "./Pickers";
import { ScopePreview } from "./ScopePreview";
import { BookingPreview } from "./BookingPreview";

const STEPS = [
  "Identity",
  "Benefit",
  "Audience",
  "Game scope",
  "Timing",
  "Limits & funding",
  "Preview & publish",
] as const;

const ROW = "grid grid-cols-2 gap-3 max-[640px]:grid-cols-1";
const HINT = "mt-[5px] text-[11px] leading-[1.5] text-muted";

export function CampaignEditor({
  initial,
  canManage,
  onClose,
  onSaved,
}: {
  initial: Campaign | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Campaign>(() => (initial ? structuredClone(initial) : emptyCampaign()));
  const [step, setStep] = useState(0);
  const [check, setCheck] = useState<Validation | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const editing = Boolean(initial?._id);
  const wasPublished = Boolean(initial?.publishedAt);
  // Players may already hold a unique code that has gone live — the server
  // refuses to change it, so the form does not offer to.
  const codeLocked = wasPublished && initial?.trigger === "code" && initial?.codeMode === "unique";
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<Campaign>) => setDraft((d) => ({ ...d, ...patch }));

  /** Fill the code from the server: the admin's first name + five characters. */
  const fillCode = async (patch: Partial<Campaign> = {}) => {
    setCodeBusy(true);
    setCodeErr("");
    const r = await generateCode();
    setCodeBusy(false);
    if (!r.ok) { setCodeErr(r.message); set(patch); return; }
    set({ ...patch, code: r.code });
  };

  const chooseUnique = () => {
    // A unique code is generated, never typed — make one unless this campaign
    // already has its own.
    const keep = draft.codeMode === "unique" && draft.trigger === "code" && Boolean(draft.code);
    if (keep) set({ trigger: "code", codeMode: "unique" });
    else fillCode({ trigger: "code", codeMode: "unique" });
  };

  const copyCode = async () => {
    if (!draft.code) return;
    try {
      await navigator.clipboard.writeText(draft.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCodeErr("Could not copy — select the code and copy it by hand.");
    }
  };
  const setBenefit = (patch: Partial<Campaign["benefit"]>) => set({ benefit: { ...draft.benefit, ...patch } });
  const setLimits = (patch: Partial<Campaign["limits"]>) => set({ limits: { ...draft.limits, ...patch } });
  const setTiming = (patch: Partial<Campaign["timing"]>) => set({ timing: { ...draft.timing, ...patch } });
  const setScope = (patch: Record<string, string[] | undefined>) => {
    const next = { ...draft.scope, ...patch } as Record<string, string[] | undefined>;
    // An emptied clause is dropped, never sent as [] — "no constraint" and
    // "constrained to nothing" must not look alike.
    for (const k of Object.keys(next)) if (!next[k] || !next[k]!.length) delete next[k];
    set({ scope: next });
  };

  const payload = useMemo(() => payloadOf(draft), [draft]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await adminFetch<Validation>("/admin/discounts/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) setCheck(res.data || null);
    }, 350);
    return () => clearTimeout(t);
  }, [payload]);

  const save = async (publish: boolean) => {
    setSaving(true);
    setErr("");
    const res = editing
      ? await adminFetch<{ campaign: Campaign }>(`/admin/discounts/${initial!._id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await adminFetch<{ campaign: Campaign }>("/admin/discounts", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok || !res.data) {
      setSaving(false);
      setErr([res.message, ...(res.details || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" "));
      return;
    }
    const saved = res.data.campaign;
    if (publish && saved.status !== "live") {
      const pub = await adminFetch(`/admin/discounts/${saved._id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "live" }),
      });
      setSaving(false);
      if (!pub.ok) {
        setErr(`Saved as a draft, but it could not be published: ${pub.message || "unknown error"}`);
        return;
      }
      onSaved(`"${saved.title}" is live.`);
      return;
    }
    setSaving(false);
    onSaved(editing
      ? wasPublished ? `"${saved.title}" saved as version ${saved.version} — bookings already made keep their price.` : `"${saved.title}" saved.`
      : `"${saved.title}" saved as a draft.`);
  };

  const isPercent = draft.benefit.mode === "percent";
  const isCode = draft.trigger === "code";
  const isFirst = draft.type === "first_game";
  const valid = check ? check.valid : false;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(0,0,0,0.75)] p-6 max-[640px]:p-2">
      <div className="mx-auto max-w-[1180px] rounded-[16px] border border-border bg-[#0b1114] p-6 max-[640px]:p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold text-fg">
            {editing ? `Edit ${initial!.title}` : "Create discount"}
            {editing && <span className="ml-2 font-mono text-[11px] text-muted">v{initial!.version}</span>}
          </h2>
          <button type="button" className={BTN} onClick={onClose}>Close</button>
        </div>

        {editing && wasPublished && (
          <div className={`${WARN_BOX} mb-4`}>
            This offer has been live. Saving creates <b>version {initial!.version + 1}</b> and affects
            <b> new bookings only</b> — every seat already booked keeps the price it was charged.
          </div>
        )}
        {!canManage && (
          <div className={`${WARN_BOX} mb-4`}>
            You can look, but only a super admin or an admin with the payments permission can save discounts.
          </div>
        )}
        {err && <div className={`${ERROR_BOX} mb-4`}>{err}</div>}

        {/* ── The steps ── */}
        <div className="mb-5 flex flex-wrap gap-[6px]">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`cursor-pointer rounded-full border px-[12px] py-[5px] font-mono text-[11px] tracking-[0.04em] ${
                i === step ? "border-fg bg-fg text-black" : "border-border-2 bg-transparent text-muted hover:text-fg"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_380px] items-start gap-5 max-[1000px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            {/* ── 1. Identity ── */}
            {step === 0 && (
              <div className={CARD}>
                <div className={ROW}>
                  <div>
                    <label className={FIELD_LABEL}>Campaign name (internal)</label>
                    <input className={FIELD} value={draft.name} onChange={(e) => set({ name: e.target.value })}
                      placeholder="FIRST50 — Gurugram & Mumbai, Oct" />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Player-facing title (the badge)</label>
                    <input className={FIELD} value={draft.title} maxLength={60} onChange={(e) => set({ title: e.target.value })}
                      placeholder="₹50 off your first game" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={FIELD_LABEL}>Internal description</label>
                  <textarea className={`${FIELD} min-h-[60px]`} value={draft.description || ""}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder="Why this exists, who owns it, what it is measured against." />
                </div>
                <div className="mt-3">
                  <label className={FIELD_LABEL}>Short terms (player-facing, under &quot;Offer details&quot;)</label>
                  <input className={FIELD} value={draft.terms || ""} maxLength={300} onChange={(e) => set({ terms: e.target.value })}
                    placeholder="Valid on your first paid game at selected venues." />
                  <div className={HINT}>
                    The conditions themselves — dates, venues, one use, no stacking — are printed from the settings
                    below, so nothing typed here can contradict what the offer actually does.
                  </div>
                </div>

                <div className="mt-4">
                  <label className={FIELD_LABEL}>How it is applied</label>
                  <div className="flex flex-wrap gap-2">
                    <Choice on={!isCode} onClick={() => !codeLocked && set({ trigger: "auto" })}
                      title="Automatically" sub="Shown and applied at checkout to everyone it fits" />
                    <Choice on={isCode && draft.codeMode === "shared"}
                      onClick={() => !codeLocked && set({ trigger: "code", codeMode: "shared" })}
                      title="One shared code" sub="A code you choose, like FIRST50 — or generate one" />
                    <Choice on={isCode && draft.codeMode === "unique"} onClick={() => !codeLocked && chooseUnique()}
                      title="Unique code" sub="Made from your name, e.g. UJJWAL3R4EW — expires after a set number of uses" />
                  </div>
                </div>
                {isCode && draft.codeMode === "shared" && (
                  <div className="mt-3 max-w-[420px]">
                    <label className={FIELD_LABEL}>The code</label>
                    <div className="flex gap-2">
                      <input className={`${FIELD} uppercase`} value={draft.code || ""} maxLength={24}
                        onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                        placeholder="FIRST50" />
                      <button type="button" className={BTN} disabled={codeBusy} onClick={() => fillCode()}>
                        {codeBusy ? "…" : "Generate"}
                      </button>
                    </div>
                    <div className={HINT}>Letters and numbers only. Anyone who has it can use it.</div>
                  </div>
                )}
                {isCode && draft.codeMode === "unique" && (
                  <div className="mt-3 grid max-w-[560px] grid-cols-[1fr_160px] gap-3 max-[640px]:grid-cols-1">
                    <div>
                      <label className={FIELD_LABEL}>The code</label>
                      <div className="flex gap-2">
                        <div className={`${FIELD} select-all font-mono tracking-[0.06em] text-fg`}>
                          {codeBusy ? "Generating…" : draft.code || "—"}
                        </div>
                        <button type="button" className={BTN} disabled={!draft.code} onClick={copyCode}>
                          {copied ? "Copied" : "Copy"}
                        </button>
                        {!codeLocked && (
                          <button type="button" className={BTN} disabled={codeBusy} onClick={() => fillCode()}>
                            Regenerate
                          </button>
                        )}
                      </div>
                    </div>
                    <NumField label="Number of uses" value={draft.limits.totalUses}
                      onChange={(v) => setLimits({ totalUses: v })} />
                    <div className={`${HINT} col-span-full`}>
                      {codeLocked
                        ? "This code has gone live, so it cannot change — players may already have it. For a new code, create a new campaign."
                        : `It works ${draft.limits.totalUses || "N"} time${draft.limits.totalUses === 1 ? "" : "s"} in all${draft.limits.perPlayer === 1 ? ", once per player" : ""}. When every use is spent, the campaign archives itself.`}
                    </div>
                  </div>
                )}
                {codeErr && <div className={`${ERROR_BOX} mt-3`}>{codeErr}</div>}
              </div>
            )}

            {/* ── 2. Benefit ── */}
            {step === 1 && (
              <div className={CARD}>
                <label className={FIELD_LABEL}>What it takes off the entry price</label>
                <div className="flex flex-wrap gap-2">
                  <Choice on={!isPercent} onClick={() => setBenefit({ mode: "flat" })} title="Flat amount" sub="₹50 off" />
                  <Choice on={isPercent} onClick={() => setBenefit({ mode: "percent" })} title="Percentage" sub="10% off, up to ₹50" />
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {!isPercent ? (
                    <div>
                      <label className={FIELD_LABEL}>Amount off (₹)</label>
                      <input className={`${FIELD} w-[140px]`} value={toRs(draft.benefit.flatPaise)}
                        onChange={(e) => setBenefit({ flatPaise: toPaise(e.target.value) })} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className={FIELD_LABEL}>Percent</label>
                        <input className={`${FIELD} w-[100px]`} value={draft.benefit.percent || ""}
                          onChange={(e) => setBenefit({ percent: Number(e.target.value || 0) })} />
                      </div>
                      <div>
                        {/* Required — an uncapped percentage on a premium game is
                            how an offer costs ten times its budget. */}
                        <label className={FIELD_LABEL}>Maximum saving (₹) — required</label>
                        <input className={`${FIELD} w-[160px]`} value={toRs(draft.benefit.capPaise)}
                          onChange={(e) => setBenefit({ capPaise: toPaise(e.target.value) })} />
                      </div>
                    </>
                  )}
                </div>

                {check?.example && (
                  <div className="mt-4 rounded-md border border-border-2 bg-surface-2 p-3 font-mono text-[12.5px]">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted">On a ₹350 game</div>
                    <div className="flex justify-between"><span className="text-muted">Game entry</span><span>{rupees(check.example.feePaise)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">{draft.title || "Offer"}</span><span className="text-accent">−{rupees(check.example.savingPaise)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="text-fg">Entry after discount</span><b className="text-fg">{rupees(check.example.payablePaise)}</b></div>
                  </div>
                )}
                <div className={HINT}>
                  It applies to the booking player&apos;s own spot only — guests pay the full fee. It never makes a
                  game cheaper than free, never combines with a pass, and on a host spot it only applies if it saves
                  more than the host discount, which it then replaces.
                </div>
              </div>
            )}

            {/* ── 3. Audience ── */}
            {step === 2 && (
              <div className={CARD}>
                <label className={FIELD_LABEL}>Who it is for</label>
                <div className="flex flex-wrap gap-2">
                  <Choice on={!isFirst} onClick={() => set({ type: "general" })}
                    title="Every signed-in player" sub="Anyone booking a game in scope" />
                  <Choice on={isFirst} onClick={() => set({ type: "first_game", limits: { ...draft.limits, perPlayer: 1 } })}
                    title="First-time players" sub="Their first paid game only" />
                </div>
                <div className={HINT}>
                  {isFirst ? (
                    <>
                      A first-time player is one who has never held a seat in a game that went ahead. A player can
                      spend <b>one</b> first-game offer, ever, whichever campaign it comes from — enforced by the
                      database, so two bookings at the same moment cannot both get it. If the game is cancelled or the
                      organiser removes them, it comes back; if they cancel it themselves, it is spent.
                    </>
                  ) : (
                    <>Every signed-in player booking a game in scope, up to the per-player limit set in step 6.</>
                  )}
                </div>
                <div className={HINT}>
                  A signed-out visitor never sees a personal price — the offer is only applied once we know who is booking.
                </div>
              </div>
            )}

            {/* ── 4. Game scope ── */}
            {step === 3 && (
              <div className={`${CARD} flex flex-col gap-5`}>
                <MetroCityPicker
                  metros={draft.scope.metros}
                  metrosExclude={draft.scope.metrosExclude}
                  citySlugs={draft.scope.citySlugs}
                  citySlugsExclude={draft.scope.citySlugsExclude}
                  onChange={setScope}
                />
                <TurfPicker turfs={draft.scope.turfs} turfsExclude={draft.scope.turfsExclude} onChange={setScope} />
                <EntityScopePicker
                  kind="organisers"
                  title="Organisers"
                  include={draft.scope.organisers}
                  exclude={draft.scope.organisersExclude}
                  onChange={(n) => setScope({ organisers: n.include, organisersExclude: n.exclude })}
                />
                <EntityScopePicker
                  kind="games"
                  title="Specific games"
                  include={draft.scope.games}
                  exclude={draft.scope.gamesExclude}
                  onChange={(n) => setScope({ games: n.include, gamesExclude: n.exclude })}
                />
                <div className={HINT}>
                  Every clause must hold, and an exclusion always wins. Pass-covered seats are never discounted.
                </div>
              </div>
            )}

            {/* ── 5. Timing ── */}
            {step === 4 && (
              <div className={CARD}>
                <label className={FIELD_LABEL}>When players can book with it (IST)</label>
                <div className={ROW}>
                  <div>
                    <label className={FIELD_LABEL}>From</label>
                    <input type="datetime-local" className={FIELD} value={toLocalInput(draft.timing.startsAt)}
                      onChange={(e) => setTiming({ startsAt: fromLocalInput(e.target.value) })} />
                    <div className={HINT}>Empty = as soon as it is published.</div>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Until</label>
                    <input type="datetime-local" className={FIELD} value={toLocalInput(draft.timing.endsAt)}
                      onChange={(e) => setTiming({ endsAt: fromLocalInput(e.target.value) })} />
                    <div className={HINT}>Empty = until you pause or archive it.</div>
                  </div>
                </div>

                <label className={`${FIELD_LABEL} mt-5`}>Which games it covers, by kickoff (IST)</label>
                <div className={ROW}>
                  <div>
                    <label className={FIELD_LABEL}>Games from</label>
                    <input type="datetime-local" className={FIELD} value={toLocalInput(draft.timing.gameFrom)}
                      onChange={(e) => setTiming({ gameFrom: fromLocalInput(e.target.value) })} />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Games until</label>
                    <input type="datetime-local" className={FIELD} value={toLocalInput(draft.timing.gameTo)}
                      onChange={(e) => setTiming({ gameTo: fromLocalInput(e.target.value) })} />
                  </div>
                </div>
                <div className={HINT}>
                  Kept apart on purpose: &quot;book by Sunday, for any game this month&quot; needs both. Leave the game
                  window empty to cover every game the booking window allows.
                </div>
              </div>
            )}

            {/* ── 6. Limits & funding ── */}
            {step === 5 && (
              <div className={CARD}>
                <label className={FIELD_LABEL}>Limits — 0 is unlimited. The campaign stops the moment any one is reached.</label>
                <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
                  <NumField label="Uses per player" value={draft.limits.perPlayer} disabled={isFirst}
                    onChange={(v) => setLimits({ perPlayer: v })} />
                  <NumField label="Discounted spots per game" value={draft.limits.perGame}
                    onChange={(v) => setLimits({ perGame: v })} />
                  <NumField label={isCode && draft.codeMode === "unique" ? "Total uses (the code's uses)" : "Total uses"}
                    value={draft.limits.totalUses}
                    onChange={(v) => setLimits({ totalUses: v })} />
                  <div>
                    <label className={FIELD_LABEL}>Budget (₹)</label>
                    <input className={FIELD} value={toRs(draft.limits.budgetPaise)}
                      onChange={(e) => setLimits({ budgetPaise: toPaise(e.target.value) })} />
                  </div>
                </div>
                {isFirst && <div className={HINT}>A first-game offer is always one use per player.</div>}
                <div className={HINT}>
                  With a total-use limit, the campaign archives itself once every use has been spent on a booking. A use
                  given back later (a cancelled game) does not reopen it — restore it and raise the limit instead.
                </div>

                <div className={`${ROW} mt-5`}>
                  <div>
                    <label className={FIELD_LABEL}>Who funds the saving</label>
                    <div className={`${FIELD} text-muted`}>KasaKai</div>
                    <div className={HINT}>
                      Every discount is KasaKai&apos;s offer — no organiser has to approve it. A discounted seat collects
                      less, so the organiser&apos;s financial summary lists it as owed back to them.
                    </div>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Funding note / budget owner</label>
                    <input className={FIELD} value={draft.funding.note || ""}
                      onChange={(e) => set({ funding: { ...draft.funding, note: e.target.value } })}
                      placeholder="Growth — Q4 acquisition budget" />
                  </div>
                </div>

                <div className="mt-5 max-w-[260px]">
                  <NumField label="Priority (tie-break, higher wins)" value={draft.priority} allowNegative
                    onChange={(v) => set({ priority: v })} />
                  <div className={HINT}>
                    When two offers save the same, a code the player typed wins, then the higher priority.
                  </div>
                </div>
              </div>
            )}

            {/* ── 7. Preview & publish ── */}
            {step === 6 && (
              <>
                <div className={CARD}>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">What players will see</div>
                  <div className="rounded-md border border-[rgba(200,255,62,0.25)] bg-[rgba(200,255,62,0.05)] p-3">
                    <div className="text-[14px] font-bold text-[#c8ff3e]">{draft.title || "Untitled offer"}</div>
                    <div className="mt-[2px] text-[12.5px] text-body">{check?.described.savingText}</div>
                    {draft.terms && <div className="mt-2 text-[12px] text-muted">{draft.terms}</div>}
                    <ul className="mt-2 list-disc pl-5 text-[12px] leading-[1.6] text-muted">
                      {(check?.described.conditions || []).map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
                <BookingPreview draft={draft} />
              </>
            )}
          </div>

          {/* ── The panel beside it ── */}
          <div className="flex flex-col gap-4">
            {check && (
              <div className={CARD}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">In words</div>
                <div className="text-[13.5px] leading-[1.55] text-fg">
                  <b>{draft.title || "Untitled"}</b> — {check.described.savingText}
                  {isCode ? ` with code ${draft.code || "…"}` : ", applied automatically"}
                  {isCode && draft.codeMode === "unique" && draft.limits.totalUses > 0
                    ? `, ${draft.limits.totalUses} use${draft.limits.totalUses === 1 ? "" : "s"} in all`
                    : ""}
                  {isFirst ? ", first paid game only" : ""}.
                </div>
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
            {(step === 3 || step === 4 || step === 6) && <ScopePreview draft={draft} />}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" className={BTN} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← Back
            </button>
            <button type="button" className={BTN} disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next →
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" className={BTN} onClick={onClose}>Cancel</button>
            {canManage && (
              <>
                <button
                  type="button"
                  className={`${BTN} ${!valid ? "opacity-50" : ""}`}
                  disabled={saving || !valid}
                  onClick={() => save(false)}
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Save draft"}
                </button>
                {(!editing || initial!.status === "draft" || initial!.status === "paused") && (
                  <button
                    type="button"
                    className={`${BTN} ${BTN_PRIMARY} ${!valid ? "opacity-50" : ""}`}
                    disabled={saving || !valid}
                    onClick={() => save(true)}
                  >
                    {saving ? "Saving…" : "Save & publish"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[180px] cursor-pointer rounded-md border px-3 py-2 text-left ${
        on ? "border-fg bg-[rgba(255,255,255,0.06)]" : "border-border-2 bg-transparent hover:border-[#555]"
      }`}
    >
      <div className={`text-[13px] font-semibold ${on ? "text-fg" : "text-body"}`}>{title}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </button>
  );
}

function NumField({
  label, value, onChange, disabled = false, allowNegative = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  allowNegative?: boolean;
}) {
  return (
    <div>
      <label className={FIELD_LABEL}>{label}</label>
      <input
        className={`${FIELD} ${disabled ? "opacity-50" : ""}`}
        value={Number.isFinite(value) ? String(value) : "0"}
        disabled={disabled}
        inputMode="numeric"
        onChange={(e) => {
          const raw = e.target.value.replace(allowNegative ? /[^\d-]/g : /[^\d]/g, "");
          const n = parseInt(raw, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}
