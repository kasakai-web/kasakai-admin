"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import { API_BASE } from "./shared/api";

/* Test tools — the admin box. TEST server only (Test_Speedups_Plan.md).
 *
 * The production backend does not mount /test-tools at all, so the status call
 * answers 404 there and this panel renders nothing. On the test server it holds:
 *   - the defaults the organiser create form's "Test timings" tab starts from
 *     (they only pre-fill the form; a game keeps the timings it was made with)
 *   - how often the lifecycle job runs
 *   - which server switches are on (read-only)
 *   - the "D" test accounts: how many exist, and a button to make the rest
 *
 * The rules are the server's (utils/testTimings.js): the form sends the draft and
 * shows what comes back.
 */

const TOPBAR_BTN =
  "flex cursor-pointer items-center gap-[6px] border border-border-2 bg-transparent px-[14px] py-[6px] font-mono text-[12px] tracking-[0.06em] text-body hover:border-[#555] hover:text-fg disabled:cursor-not-allowed disabled:opacity-50";
const TOPBAR_BTN_PRIMARY = "border-fg! bg-fg! text-black!";
const FORM_ERROR =
  "rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-[14px] py-[10px] text-[13px] text-danger";
const FIELD =
  "w-full rounded-md border border-border-2 bg-surface-2 px-2 py-[6px] font-mono text-[13px] text-fg";
const FIELD_LABEL = "mb-[5px] block text-[11px] uppercase tracking-[0.08em] text-muted";

type Settings = {
  kickoffInMins: number;
  firstCheckInMins: number;
  secondCheckInMins: number;
  reportingMins: number;
  durationMins: number;
  lastCallMins: number;
  reminderMins: number;
  autoCompleteMins: number;
  videoWaitMins: number;
  tickSeconds: number;
};

type Status = {
  enabled: boolean;
  database?: string | null;
  flags: { name: string; on: boolean }[];
  settings: Settings;
  tickChoices: number[];
  testAccounts: number;
  testAccountTarget: number;
  testCode: string;
};

const FIELDS: { key: Exclude<keyof Settings, "tickSeconds">; label: string; hint: string }[] = [
  { key: "kickoffInMins",     label: "Kick-off in",        hint: "min from now" },
  { key: "firstCheckInMins",  label: "Check-in 1 in",      hint: "min from now" },
  { key: "secondCheckInMins", label: "Check-in 2 in",      hint: "min from now" },
  { key: "reportingMins",     label: "Players report",     hint: "min before kick-off" },
  { key: "durationMins",      label: "Game duration",      hint: "min" },
  { key: "lastCallMins",      label: "Last call",          hint: "min before reporting (prod 60)" },
  { key: "reminderMins",      label: "Reminder",           hint: "min before check-in 2 (prod 30)" },
  { key: "autoCompleteMins",  label: "Auto-complete",      hint: "min after the end (prod 30)" },
  { key: "videoWaitMins",     label: "Video WhatsApp wait", hint: "min (prod 120)" },
];

async function call(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin session missing.");
  const res = await fetch(`${API_BASE}/test-tools${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

export function TestToolsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"save" | "accounts" | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const { res, data } = await call("/status");
      // 404 = production (or a test server on the live database): show nothing.
      if (!res.ok || !data?.success || !data.data?.enabled) { setStatus(null); return; }
      setStatus(data.data);
      setDraft(data.data.settings);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);

  if (!status || !draft) return null;

  const patch = (key: keyof Settings, raw: string) =>
    setDraft((d) => (d ? { ...d, [key]: raw === "" ? 0 : Math.floor(Number(raw) || 0) } : d));

  const save = async () => {
    setBusy("save"); setErr(""); setMsg(null); setWarnings([]);
    try {
      const { res, data } = await call("/settings", { method: "PUT", body: JSON.stringify(draft) });
      if (!res.ok || !data?.success) { setErr(data?.message || "Save failed."); return; }
      setWarnings(data.data?.warnings || []);
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 2500);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally { setBusy(null); }
  };

  const createAccounts = async () => {
    setBusy("accounts"); setErr(""); setMsg(null);
    try {
      const { res, data } = await call("/accounts", { method: "POST", body: JSON.stringify({}) });
      if (!res.ok || !data?.success) { setErr(data?.message || "Could not create test players."); return; }
      setMsg(data.message);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally { setBusy(null); }
  };

  const offFlags = status.flags.filter((f) => !f.on);
  const dirty = JSON.stringify(draft) !== JSON.stringify(status.settings);

  return (
    <div className="mb-4 rounded-xl border border-[rgba(96,165,250,0.35)] bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[15px] font-bold text-fg">🧪 Test tools</span>
            <span className="rounded-full bg-[rgba(96,165,250,0.12)] px-[9px] py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] text-[#93c5fd]">
              Test server · {status.database || "?"}
            </span>
          </div>
          <div className="mt-[3px] max-w-[640px] text-[12px] leading-[1.45] text-muted">
            Only on the test server — production never shows this. Defaults for the organiser create form&apos;s
            &quot;Test timings&quot; tab, how often the lifecycle job runs, and the &quot;D&quot; test players. A game keeps
            the timings it was created with, so changing these never changes an existing game.
          </div>
        </div>
        <button className={TOPBAR_BTN} type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide ▲" : "Set up ▼"}
        </button>
      </div>

      {err && <div className={`${FORM_ERROR} mt-[10px]`}>{err}</div>}

      <div className="mt-3 grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1">
        <div className="bg-surface px-3 py-[10px]">
          <div className="mb-[4px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Test players</div>
          <div className="font-mono text-[18px] text-fg">{status.testAccounts} / {status.testAccountTarget}</div>
          <div className="text-[11px] text-muted">sign in with code {status.testCode}</div>
        </div>
        <div className="bg-surface px-3 py-[10px]">
          <div className="mb-[4px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Job runs every</div>
          <div className="font-mono text-[18px] text-fg">{status.settings.tickSeconds}s</div>
          <div className="text-[11px] text-muted">production: 60s</div>
        </div>
        <div className="bg-surface px-3 py-[10px]">
          <div className="mb-[4px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Server switches</div>
          <div className="flex flex-wrap gap-[6px]">
            {status.flags.map((f) => (
              <span
                key={f.name}
                className={`rounded px-[6px] py-[1px] font-mono text-[10px] ${f.on ? "bg-[rgba(34,197,94,0.12)] text-success" : "bg-[rgba(239,68,68,0.12)] text-danger"}`}
              >
                {f.on ? "✓" : "✗"} {f.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {offFlags.length > 0 && (
        <div className="mt-2 text-[12px] text-danger">
          {offFlags.map((f) => f.name).join(", ")} {offFlags.length === 1 ? "is" : "are"} off on this server — those
          steps only log DRY-RUN lines, so testing them does nothing. Set them to true in the Azure test app&apos;s settings.
        </div>
      )}
      {msg && <div className="mt-2 text-[12px] text-success">{msg}</div>}

      {expanded && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            {FIELDS.map((f) => (
              <label key={f.key}>
                <span className={FIELD_LABEL}>{f.label}</span>
                <input
                  className={FIELD}
                  type="number"
                  min={0}
                  step={1}
                  value={String(draft[f.key])}
                  onChange={(e) => patch(f.key, e.target.value)}
                />
                <span className="mt-[3px] block text-[11px] text-muted">{f.hint}</span>
              </label>
            ))}
            <label>
              <span className={FIELD_LABEL}>Job runs every</span>
              <select className={FIELD} value={draft.tickSeconds} onChange={(e) => patch("tickSeconds", e.target.value)}>
                {status.tickChoices.map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
              <span className="mt-[3px] block text-[11px] text-muted">takes effect within a minute</span>
            </label>
          </div>

          {warnings.map((w) => (
            <div key={w} className="mt-2 text-[12px] text-[#f0b429]">⚠️ {w}</div>
          ))}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button" disabled={!dirty || busy !== null} onClick={save}>
              {busy === "save" ? "Saving…" : "Save defaults"}
            </button>
            <button className={TOPBAR_BTN} type="button" disabled={busy !== null} onClick={createAccounts}>
              {busy === "accounts" ? "Creating…" : `Create test players (${status.testAccountTarget})`}
            </button>
            <span className="text-[11px] text-muted">
              Makes only the missing ones — names ending in &quot;D&quot;, fake numbers that are never sent a WhatsApp, ₹10,000 test credit each.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
