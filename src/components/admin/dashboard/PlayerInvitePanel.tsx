"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "./shared/api";

/* Player-to-player invites — the admin controls.
 *
 * Every other way into a game starts with the organiser. This one doesn't: a
 * seated player pulls their friends in, which spends the organiser's slots,
 * sends WhatsApp on the platform's account, and — with directory search on —
 * lets one player look another up. That is why it gets a kill switch of its own
 * rather than riding on the game's visibility.
 *
 * The rules are the server's (utils/playerInvites.js): the invite path evaluates
 * the same module, so anything this form permits is exactly what the gate allows.
 * The form only sends the draft and renders what comes back.
 */

const TOPBAR_BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
const FORM_ERROR =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
const FIELD_LABEL = "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";

type InviteSettings = {
  enabled: boolean;
  allowPlayerSearch: boolean;
  allowOnPublicGames: boolean;
  maxInvitesPerGame: number;
  cutoffMinutesBeforeKickoff: number;
  whatsappEnabled: boolean;
  limits: { maxInvitesCeiling: number; maxCutoffMinutes: number };
  search: { minNameChars: number; minPhoneDigits: number; limit: number };
  stats: {
    total: number; accepted: number; pending: number;
    rejected: number; inviterCount: number; gameCount: number;
  };
  updatedAt?: string;
};

/* The cutoff is stored in minutes because that is what the gate compares against,
   but no admin thinks in "1440 minutes". These are the only values worth
   offering — anything finer is false precision on a game that kicks off once. */
const CUTOFF_CHOICES: { mins: number; label: string }[] = [
  { mins: 0,    label: "No cutoff" },
  { mins: 60,   label: "1 hour before" },
  { mins: 180,  label: "3 hours before" },
  { mins: 360,  label: "6 hours before" },
  { mins: 720,  label: "12 hours before" },
  { mins: 1440, label: "1 day before" },
  { mins: 2880, label: "2 days before" },
];

type Toggle = {
  key: "enabled" | "allowPlayerSearch" | "allowOnPublicGames" | "whatsappEnabled";
  label: string;
  hint: string;
};

const TOGGLES: Toggle[] = [
  {
    key: "allowPlayerSearch",
    label: "Player directory search",
    hint: "Players can find an existing account to invite instead of typing a number. Results carry a masked phone and no email, a name needs 3+ characters and a number must be complete — so it confirms someone you already know rather than listing the member base.",
  },
  {
    key: "allowOnPublicGames",
    label: "Allow on public games",
    hint: "Off, invites are private-games-only. On, a seated player can also pull friends into a browsable game — they still land as requests the organiser approves.",
  },
  {
    key: "whatsappEnabled",
    label: "Send the WhatsApp invite",
    hint: "Off, invitations are still created and the link still works — only the outbound message is skipped. Use this to stop the spend without losing the feature.",
  },
];

export function PlayerInvitePanel() {
  const [config, setConfig] = useState<InviteSettings | null>(null);
  const [draft, setDraft] = useState<InviteSettings | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const apply = useCallback((data: InviteSettings) => {
    setConfig(data);
    setDraft(data);
  }, []);

  /* The initial load owns `loading`/`err` through their initial state rather than
     setting them on the way in, so nothing here writes state synchronously during
     the effect — every setState lands after the await. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAdminToken();
        if (!token) { if (!cancelled) setErr("Admin session missing."); return; }
        const res = await fetch(`${API_BASE}/admin/invite-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) { setErr(data.message || "Failed to load invite settings."); return; }
        apply(data.data);
      } catch {
        if (!cancelled) setErr("Cannot reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apply]);

  const save = async (override?: Partial<InviteSettings>) => {
    if (!draft) return;
    setSaving(true);
    setErr("");
    setMsg(null);
    try {
      const token = getAdminToken();
      if (!token) { setErr("Admin session missing."); return; }
      const body = { ...draft, ...override };
      const res = await fetch(`${API_BASE}/admin/invite-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enabled:                    body.enabled,
          allowPlayerSearch:          body.allowPlayerSearch,
          allowOnPublicGames:         body.allowOnPublicGames,
          whatsappEnabled:            body.whatsappEnabled,
          maxInvitesPerGame:          Number(body.maxInvitesPerGame) || 0,
          cutoffMinutesBeforeKickoff: Number(body.cutoffMinutesBeforeKickoff) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErr(data.message || "Save failed."); return; }
      apply(data.data);
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  /* The master switch saves on the spot instead of waiting for a Save click.
     It is the control an admin reaches for when something is going wrong, and a
     kill switch that needs a second click to take effect isn't one. */
  const toggleMaster = (next: boolean) => {
    setDraft((d) => (d ? { ...d, enabled: next } : d));
    save({ enabled: next });
  };

  const patch = (p: Partial<InviteSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const dirty = !!config && !!draft && (
    config.enabled !== draft.enabled ||
    config.allowPlayerSearch !== draft.allowPlayerSearch ||
    config.allowOnPublicGames !== draft.allowOnPublicGames ||
    config.whatsappEnabled !== draft.whatsappEnabled ||
    Number(config.maxInvitesPerGame) !== Number(draft.maxInvitesPerGame) ||
    Number(config.cutoffMinutesBeforeKickoff) !== Number(draft.cutoffMinutesBeforeKickoff)
  );

  const stats = config?.stats;
  const acceptRate = stats && stats.total > 0
    ? `${Math.round((stats.accepted / stats.total) * 100)}%`
    : "—";

  return (
    <div className="mb-4 rounded-xl border border-border-2 bg-surface p-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-bold text-fg">👥 Player-to-Player Invites</span>
            {config && (
              <span
                className={`rounded-full px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] ${
                  config.enabled
                    ? "bg-[rgba(34,197,94,0.12)] text-success"
                    : "bg-[rgba(255,255,255,0.06)] text-muted"
                }`}
              >
                {config.enabled ? "Live" : "Off"}
              </span>
            )}
          </div>
          <div className="mt-[3px] max-w-[600px] text-[12px] leading-[1.45] text-muted">
            A seated player invites their friends. Every invite still lands as a request the
            organiser approves — this panel controls whether players may ask, and how often.
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
            {draft?.enabled ? "Invites Enabled" : "Invites Disabled"}
          </label>
          <button className={TOPBAR_BTN} type="button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide setup ▲" : "Set up ▼"}
          </button>
        </div>
      </div>

      {err && <div className={`${FORM_ERROR} mt-[10px]`}>{err}</div>}
      {loading && <div className="mt-3 text-[12px] text-muted">Loading…</div>}

      {/* ── Usage — always visible ── */}
      {stats && (
        <div className="mt-3 grid grid-cols-4 gap-px border border-border bg-border max-[900px]:grid-cols-2">
          {[
            { label: "Invites sent",  value: String(stats.total) },
            { label: "Approved",      value: `${stats.accepted} · ${acceptRate}` },
            { label: "Awaiting organiser", value: String(stats.pending) },
            { label: "Players inviting",   value: String(stats.inviterCount) },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-3 py-[10px]">
              <div className="mb-[4px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{s.label}</div>
              <div className="font-mono text-[18px] text-fg">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Collapsed summary ── */}
      {!expanded && config && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            config.maxInvitesPerGame === 0
              ? "Unlimited invites per player"
              : `${config.maxInvitesPerGame} invites per player, per game`,
            config.allowOnPublicGames ? "Private + public games" : "Private games only",
            config.allowPlayerSearch ? "Directory search on" : "Phone number only",
            config.whatsappEnabled ? "WhatsApp on" : "WhatsApp off",
            CUTOFF_CHOICES.find((c) => c.mins === config.cutoffMinutesBeforeKickoff)?.label
              ?? `Closes ${config.cutoffMinutesBeforeKickoff} min before`,
          ].map((chip) => (
            <div key={chip} className="rounded-[10px] border border-border-2 px-3 py-[7px] text-[12px] text-muted">
              {chip}
            </div>
          ))}
        </div>
      )}

      {expanded && draft && config && (
        <>
          <div className="mt-4 mb-[6px] text-[13px] font-bold text-fg">Guard rails</div>

          <div className="flex flex-wrap gap-3">
            <div className="w-[220px]">
              <label className={FIELD_LABEL}>Max invites per player, per game</label>
              <input
                className={FIELD}
                type="number"
                min={0}
                max={config.limits.maxInvitesCeiling}
                value={draft.maxInvitesPerGame}
                onChange={(e) => patch({ maxInvitesPerGame: Number(e.target.value) })}
              />
              <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">
                0 = unlimited. Counts live invites only — a rejected or expired one
                gives the slot back. Ceiling {config.limits.maxInvitesCeiling}.
              </div>
            </div>

            <div className="w-[220px]">
              <label className={FIELD_LABEL}>Invites close</label>
              <select
                className={FIELD}
                value={draft.cutoffMinutesBeforeKickoff}
                onChange={(e) => patch({ cutoffMinutesBeforeKickoff: Number(e.target.value) })}
              >
                {CUTOFF_CHOICES.map((c) => (
                  <option key={c.mins} value={c.mins}>{c.label}</option>
                ))}
              </select>
              <div className="mt-[5px] text-[11px] leading-[1.4] text-muted">
                An invite the organiser has no time to approve is just a
                notification — this is where it stops being offered.
              </div>
            </div>
          </div>

          <div className="mt-4 mb-[6px] text-[13px] font-bold text-fg">What players can do</div>

          <div className="flex flex-col gap-2">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex cursor-pointer items-start gap-[10px] rounded-[10px] border border-border-2 px-3 py-[10px]"
              >
                <input
                  type="checkbox"
                  className="mt-[3px]"
                  checked={!!draft[t.key]}
                  onChange={(e) => patch({ [t.key]: e.target.checked } as Partial<InviteSettings>)}
                />
                <span>
                  <span className="block text-[13px] font-semibold text-fg">{t.label}</span>
                  <span className="mt-[2px] block max-w-[620px] text-[11.5px] leading-[1.45] text-muted">{t.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className={`${TOPBAR_BTN} ${dirty ? TOPBAR_BTN_PRIMARY : ""}`}
              type="button"
              disabled={saving || !dirty}
              onClick={() => save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className={TOPBAR_BTN}
              type="button"
              disabled={saving || !dirty}
              onClick={() => setDraft(config)}
            >
              Discard
            </button>
            {msg && <span className="font-mono text-[12px] text-success">{msg}</span>}
            {!dirty && !msg && config.updatedAt && (
              <span className="font-mono text-[11px] text-muted">
                Last changed {new Date(config.updatedAt).toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
