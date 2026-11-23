"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "./shared/api";

/* Automatic SOS — the admin controls (backend services/sosAutoService.js).
 *
 * Organisers switch Automatic SOS on per game; this panel owns what applies to
 * every game at once: the Off / Dry run / Live switch (no WhatsApp is sent until
 * an admin picks Live — Dry run does everything else; there is no server variable), the limits that keep the
 * platform's WhatsApp number healthy, and the pause the delivery breaker sets
 * when too many sends fail. A paused SOS stays paused until resumed here.
 *
 * The numbers are the server's: it bounds whatever is sent and returns what it
 * stored, which is what this form then shows.
 */

const TOPBAR_BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
const FORM_ERROR =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
const FIELD_LABEL = "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";

type Mode = "off" | "dry_run" | "live";
type Settings = {
  mode: Mode;
  paused: boolean;
  pausedReason: string | null;
  pausedAt: string | null;
  minGapMins: number;
  maxWavesPerGamePerDay: number;
  maxRecipientsPerGame: number;
  maxWaveSize: number;
  dailyPlatformCap: number;
  perPlayer: { perDay: number; perWeek: number; ignoredStreak: number };
  quietHours: { fromHour: number; toHour: number };
};
type SourceStats = {
  messages: number; inApp: number; whatsapp: number; failed: number;
  heldBack: number; optedOut: number; tapped: number; booked: number; games: number;
  // Newer servers: the WhatsApp count split by AiSensy campaign, and why the
  // other rows never went to WhatsApp.
  viaLink?: number; viaLegacy?: number; dryRun?: number; noNumber?: number;
  alertsOff?: number; queued?: number; stopped?: number;
};

// Every SOS row is an in-app notification; only some of them went to WhatsApp.
function notOnWhatsApp(r: SourceStats): { total: number; parts: string } {
  const parts: [string, number][] = [
    ["dry run", r.dryRun ?? 0], ["held back", r.heldBack], ["WhatsApp off", r.optedOut],
    ["no number", r.noNumber ?? 0], ["alerts off", r.alertsOff ?? 0],
    ["not sent, game filled", r.stopped ?? 0], ["still queued", r.queued ?? 0],
  ];
  const shown = parts.filter(([, n]) => n > 0);
  return {
    total: Math.max(0, r.messages - r.whatsapp - r.failed),
    parts: shown.map(([k, n]) => `${n} ${k}`).join(" · "),
  };
}
type Stats = { days: number; manual: SourceStats; auto: SourceStats; alertsOff: number };
type Payload = { settings: Settings; stats: Stats };

type NumberField = {
  label: string;
  hint: string;
  get: (s: Settings) => number;
  set: (s: Settings, v: number) => Settings;
};

const NUMBER_FIELDS: NumberField[] = [
  {
    label: "SOS per player, per day",
    hint: "From every organiser together — manual sends are not limited by this, automatic ones are.",
    get: (s) => s.perPlayer.perDay,
    set: (s, v) => ({ ...s, perPlayer: { ...s.perPlayer, perDay: v } }),
  },
  {
    label: "SOS per player, per week",
    hint: "The rolling 7 days.",
    get: (s) => s.perPlayer.perWeek,
    set: (s, v) => ({ ...s, perPlayer: { ...s.perPlayer, perWeek: v } }),
  },
  {
    label: "Unanswered before in-app only",
    hint: "After this many SOS in a row with no tap and no booking, WhatsApp is held back for that player.",
    get: (s) => s.perPlayer.ignoredStreak,
    set: (s, v) => ({ ...s, perPlayer: { ...s.perPlayer, ignoredStreak: v } }),
  },
  {
    label: "Largest wave",
    hint: "Players messaged in one go for one game.",
    get: (s) => s.maxWaveSize,
    set: (s, v) => ({ ...s, maxWaveSize: v }),
  },
  {
    label: "Most players per game",
    hint: "Every automatic wave for one game together.",
    get: (s) => s.maxRecipientsPerGame,
    set: (s, v) => ({ ...s, maxRecipientsPerGame: v }),
  },
  {
    label: "Minutes between waves",
    hint: "The shortest gap between two waves of one game.",
    get: (s) => s.minGapMins,
    set: (s, v) => ({ ...s, minGapMins: v }),
  },
  {
    label: "Waves per game, per day",
    hint: "In one IST day.",
    get: (s) => s.maxWavesPerGamePerDay,
    set: (s, v) => ({ ...s, maxWavesPerGamePerDay: v }),
  },
  {
    label: "Platform total per day",
    hint: "Automatic SOS messages across all games, from IST midnight.",
    get: (s) => s.dailyPlatformCap,
    set: (s, v) => ({ ...s, dailyPlatformCap: v }),
  },
];

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "off",     label: "Off",     hint: "Nothing runs. Organisers' own SOS still works." },
  { mode: "dry_run", label: "Dry run", hint: "Runs every wave for real — in-app notifications, Book links, SOS logs — but skips WhatsApp." },
  { mode: "live",    label: "Live",    hint: "Sends automatic SOS to the games whose organisers switched it on." },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export function SosAutoPanel() {
  const [config, setConfig] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // Going Live sends real WhatsApp messages, so it takes a second, deliberate click.
  const [confirmLive, setConfirmLive] = useState(false);

  const apply = useCallback((data: Payload) => {
    setConfig(data);
    setDraft(data.settings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAdminToken();
        if (!token) { if (!cancelled) setErr("Admin session missing."); return; }
        const res = await fetch(`${API_BASE}/admin/sos-settings`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) { setErr(data.message || "Failed to load SOS settings."); return; }
        apply(data.data);
      } catch {
        if (!cancelled) setErr("Cannot reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apply]);

  const save = async (body: Partial<Settings>) => {
    setSaving(true);
    setErr("");
    setMsg(null);
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const res = await fetch(`${API_BASE}/admin/sos-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Save failed."); return; }
      apply(data.data);
      setMsg(data.message || "Saved ✓");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const s = config?.settings;
  const stats = config?.stats;
  const dirty = !!s && !!draft && JSON.stringify({ ...s, paused: 0, pausedReason: 0, pausedAt: 0, mode: 0 })
    !== JSON.stringify({ ...draft, paused: 0, pausedReason: 0, pausedAt: 0, mode: 0 });

  const state = !s ? null : s.mode === "off" ? "Off" : s.paused ? "Paused" : s.mode === "live" ? "Live" : "Dry run";

  const pickMode = (mode: Mode) => {
    if (!s || mode === s.mode) { setConfirmLive(false); return; }
    if (mode === "live" && !confirmLive) { setConfirmLive(true); return; }
    setConfirmLive(false);
    save({ mode });
  };
  const badge = state === "Live"
    ? "bg-[rgba(34,197,94,0.12)] text-success"
    : state === "Paused"
      ? "bg-[rgba(239,68,68,0.12)] text-danger"
      : "bg-[rgba(255,255,255,0.06)] text-muted";

  return (
    <div className="mb-4 rounded-xl border border-border-2 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-bold text-fg">🆘 Automatic SOS</span>
            {state && (
              <span className={`rounded-full px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] ${badge}`}>
                {state}
              </span>
            )}
          </div>
          <div className="mt-[3px] max-w-[640px] text-[12px] leading-[1.45] text-muted">
            While a game whose organiser switched it on is below its minimum, an SOS goes out before each
            check-in and after anyone drops out — to players who play at that venue around that time.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div role="radiogroup" aria-label="Automatic SOS" className="flex border border-border-2">
            {MODES.map((m) => {
              const on = s?.mode === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={m.hint}
                  disabled={loading || saving || !s}
                  onClick={() => pickMode(m.mode)}
                  className={`cursor-pointer px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] ${
                    on
                      ? m.mode === "live" ? "bg-success text-black" : "bg-fg text-black"
                      : "bg-transparent text-body hover:text-fg"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {s && s.mode !== "off" && (
            <button className={TOPBAR_BTN} type="button" disabled={saving} onClick={() => save({ paused: !s.paused })}>
              {s.paused ? "Resume" : "Pause"}
            </button>
          )}
          <button className={TOPBAR_BTN} type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide limits ▲" : "Limits ▼"}
          </button>
        </div>
      </div>

      {confirmLive && (
        <div className="mt-[10px] flex flex-wrap items-center gap-3 rounded-md border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-[14px] py-[10px] text-[13px] text-fg">
          <span>Going live sends real SOS on WhatsApp for every game whose organiser switched Automatic SOS on.</span>
          <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button" disabled={saving} onClick={() => pickMode("live")}>
            Go live
          </button>
          <button className={TOPBAR_BTN} type="button" onClick={() => setConfirmLive(false)}>Cancel</button>
        </div>
      )}
      {s && !confirmLive && (
        <div className="mt-[8px] text-[11.5px] text-muted">{MODES.find((m) => m.mode === s.mode)?.hint}</div>
      )}
      {err && <div className={`${FORM_ERROR} mt-[10px]`}>{err}</div>}
      {loading && <div className="mt-3 text-[12px] text-muted">Loading…</div>}
      {s?.paused && (
        <div className={`${FORM_ERROR} mt-[10px]`}>
          Paused{s.pausedAt ? ` ${new Date(s.pausedAt).toLocaleString("en-IN")}` : ""}: {s.pausedReason || "no reason recorded."}
          {" "}Check the number in AiSensy before resuming.
        </div>
      )}

      {stats && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-[6px] pr-3 font-normal">Last {stats.days} days</th>
                <th className="py-[6px] pr-3 font-normal" title="Every SOS row: each one is an in-app notification. Not a WhatsApp count.">SOS (in-app)</th>
                <th className="py-[6px] pr-3 font-normal" title="Accepted by AiSensy. Meta can still hold a message back after this.">WA accepted</th>
                <th className="py-[6px] pr-3 font-normal" title="In-app only: never sent to AiSensy">Not on WA</th>
                <th className="py-[6px] pr-3 font-normal">WA failed</th>
                <th className="py-[6px] pr-3 font-normal">Tapped</th>
                <th className="py-[6px] pr-3 font-normal">Booked</th>
                <th className="py-[6px] pr-3 font-normal">Games</th>
              </tr>
            </thead>
            <tbody>
              {([["Automatic", stats.auto], ["Sent by organisers", stats.manual]] as const).map(([label, r]) => {
                const off = notOnWhatsApp(r);
                const split = r.viaLink != null && r.whatsapp > 0
                  ? `${r.viaLink} "kasakai sos book spot" · ${r.viaLegacy ?? 0} "sos to regular player"`
                  : "";
                return (
                <tr key={label} className="border-t border-border font-mono text-fg">
                  <td className="py-[7px] pr-3 font-sans text-body">{label}</td>
                  <td className="py-[7px] pr-3">{r.messages}</td>
                  <td className="py-[7px] pr-3" title={split}>
                    {r.whatsapp}
                    {split && <div className="text-[10px] text-muted">{r.viaLink} link · {r.viaLegacy ?? 0} text-only</div>}
                  </td>
                  <td className="py-[7px] pr-3" title={off.parts}>
                    {off.total}
                    {off.parts && <div className="text-[10px] text-muted">{off.parts}</div>}
                  </td>
                  <td className="py-[7px] pr-3">{r.failed} <span className="text-muted">{pct(r.failed, r.whatsapp + r.failed)}</span></td>
                  <td className="py-[7px] pr-3">{r.tapped} <span className="text-muted">{pct(r.tapped, r.messages)}</span></td>
                  <td className="py-[7px] pr-3">{r.booked} <span className="text-muted">{pct(r.booked, r.messages)}</span></td>
                  <td className="py-[7px] pr-3">{r.games}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-[6px] text-[11px] text-muted">
            {"SOS (in-app) counts every SOS a player was sent; only \u201cWA accepted\u201d reached AiSensy, split across "
              + "two AiSensy campaigns (the link one and its text-only fallback), which AiSensy reports separately. "}
            {stats.alertsOff} player{stats.alertsOff === 1 ? " has" : "s have"} turned spot alerts off.
            A booking counts once the player takes a seat in the game they were sent an SOS for, through the link or not.
          </div>
        </div>
      )}

      {expanded && draft && (
        <>
          <div className="mt-4 mb-[6px] text-[13px] font-bold text-fg">Limits</div>
          <div className="flex flex-wrap gap-3">
            {NUMBER_FIELDS.map((f) => (
              <div key={f.label} className="w-[210px]">
                <label className={FIELD_LABEL}>{f.label}</label>
                <input
                  className={FIELD}
                  type="number"
                  min={1}
                  value={f.get(draft)}
                  onChange={(e) => setDraft((d) => (d ? f.set(d, Number(e.target.value)) : d))}
                />
                <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">{f.hint}</div>
              </div>
            ))}
            <div className="w-[210px]">
              <label className={FIELD_LABEL}>Quiet hours (IST)</label>
              <div className="flex items-center gap-2">
                <select
                  className={FIELD}
                  value={draft.quietHours.fromHour}
                  onChange={(e) => setDraft((d) => (d ? { ...d, quietHours: { ...d.quietHours, fromHour: Number(e.target.value) } } : d))}
                >
                  {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
                <span className="text-muted">to</span>
                <select
                  className={FIELD}
                  value={draft.quietHours.toHour}
                  onChange={(e) => setDraft((d) => (d ? { ...d, quietHours: { ...d.quietHours, toHour: Number(e.target.value) } } : d))}
                >
                  {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </div>
              <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">No automatic SOS in this window.</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className={`${TOPBAR_BTN} ${dirty ? TOPBAR_BTN_PRIMARY : ""}`}
              type="button"
              disabled={saving || !dirty}
              onClick={() => draft && save({
                minGapMins: draft.minGapMins,
                maxWavesPerGamePerDay: draft.maxWavesPerGamePerDay,
                maxRecipientsPerGame: draft.maxRecipientsPerGame,
                maxWaveSize: draft.maxWaveSize,
                dailyPlatformCap: draft.dailyPlatformCap,
                perPlayer: draft.perPlayer,
                quietHours: draft.quietHours,
              })}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className={TOPBAR_BTN} type="button" disabled={saving || !dirty} onClick={() => s && setDraft(s)}>
              Discard
            </button>
          </div>
        </>
      )}
      {msg && <div className="mt-2 font-mono text-[12px] text-success">{msg}</div>}
    </div>
  );
}
