"use client";

/* Shared bits of the game control panels: the game shape the detail endpoint
   sends, the one helper every admin action goes through, and the confirm dialog.

   Every action is the organiser's own endpoint, mounted again under
   /admin/games/:id/act/* and run AS the game's owner (backend
   modules/admin/actAsGameOwner.js). Players never see that an admin acted; the
   organisers get an in-app note. Only a superadmin may act (`canControl`). */

import { useState } from "react";
import {
  SECTION_TITLE, SEARCH_INPUT, ACTION_BTN, FORM_ERROR, MODAL_OVERLAY, MODAL,
  MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL,
} from "../styles";
import { adminFetch } from "../../passes/v2/shared";

export type Person = { _id?: string; name?: string; phone?: string; email?: string } | null;

export type GameRegistration = {
  _id: string;
  player?: Person;
  plusOneName?: string | null; preferredPosition?: string; teamPreference?: string;
  paymentStatus?: string; amountPaidPaise?: number; attended?: string;
  signedUpAt?: string; assignedTeam?: string;
  backedOutAt?: string | null; removedAt?: string | null; optedOut?: boolean;
};

export type GameWaitlistEntry = {
  _id: string; player?: Person; joinedAt?: string; status?: string; preferredPosition?: string;
};

export type GameInvitation = {
  _id: string; player?: Person; inviteeName?: string | null; inviteePhone?: string | null;
  status?: string; via?: string; isGuest?: boolean; plusOneName?: string | null; invitedByName?: string | null;
};

export type LadderTier = {
  label?: string | null; pricePaise: number; seats: number;
  closesHoursBefore?: number | null; sold?: number; held?: number;
};

export type GameFull = {
  _id: string; title?: string; format?: string; status?: string;
  scheduledAt?: string; durationMins?: number; feeInPaise?: number;
  totalSlots?: number; minPlayers?: number; organiserIsPlaying?: boolean;
  cutoffAt?: string | null; teamsPublished?: boolean; inviteLinkEnabled?: boolean;
  organiser?: (Person & { isActive?: boolean; approvalStatus?: string }) | null;
  turf?: { _id?: string; name?: string; address?: { area?: string; city?: string } } | null;
  lifecycle?: { firstCheckAt?: string | null; secondCheckAt?: string | null; firstCheckDoneAt?: string | null; secondCheckDoneAt?: string | null };
  registrations: GameRegistration[];
  waitlist: GameWaitlistEntry[];
  invitations?: GameInvitation[];
  coOrganisers?: { _id: string; organiser?: Person; permission?: string }[];
  pricing?: { tiers?: LadderTier[]; highWaterPaise?: number; currentPricePaise?: number | null } | null;
  canControl?: boolean;
};

// Same rule as backend utils/registration.js isActiveRegistration.
export const isActiveReg = (r: GameRegistration) =>
  !r.backedOutAt && !r.removedAt && !r.optedOut && !["refunded", "forfeited"].includes(r.paymentStatus || "");

export const regName = (r: GameRegistration) =>
  r.plusOneName ? `${r.plusOneName} (guest)` : r.player?.name || "Unknown";

/** One admin game action. `path` is relative to /admin/games/:id/act/. */
export function act<T = unknown>(gameId: string, path: string, method: string, body?: object) {
  return adminFetch<T>(`/admin/games/${gameId}/act/${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export const PRIMARY_BTN = `${ACTION_BTN} border-fg! text-fg!`;
export const DANGER_BTN  = `${ACTION_BTN} border-[rgba(239,68,68,0.5)]! text-danger!`;
export const INPUT       = `${SEARCH_INPUT} min-w-0! w-full`;

/* A confirm dialog. `run` gets the typed reason and returns the action result;
   the dialog stays open on a refusal and shows the server's message. */
export function ActionDialog({
  title, children, confirmLabel = "Confirm", danger, needsReason, reasonHint,
  disabled, run, onClose, onDone,
}: {
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  needsReason?: boolean;
  reasonHint?: string;
  disabled?: boolean;
  run: (reason: string) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  async function submit() {
    if (needsReason && !reason.trim()) { setError("A reason is required."); return; }
    setBusy(true); setError("");
    const r = await run(reason.trim());
    setBusy(false);
    if (!r.ok) { setError(r.message || "Action failed."); return; }
    onDone(r.message);
  }

  return (
    <div className={MODAL_OVERLAY} onClick={busy ? undefined : onClose}>
      <div className={`${MODAL} max-w-[520px]!`} onClick={(e) => e.stopPropagation()}>
        <div className={MODAL_HEAD}>
          <div className={SECTION_TITLE}>{title}</div>
          <button className={MODAL_CLOSE} type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex flex-col gap-[14px] text-[14px] text-body">
          {children}
          {needsReason !== undefined && (
            <label className={FORM_LABEL}>
              Reason{needsReason ? "" : " (optional)"}
              <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={reasonHint || "Why — the organisers see this in their note"} />
            </label>
          )}
        </div>
        {error && <div className={`${FORM_ERROR} mt-[10px]`}>{error}</div>}
        <div className={`${MODAL_ACTIONS} mt-[18px]`}>
          <button className={ACTION_BTN} type="button" onClick={onClose} disabled={busy}>Back</button>
          <button className={danger ? DANGER_BTN : PRIMARY_BTN} type="button" onClick={submit} disabled={busy || disabled}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// datetime-local value in IST for an ISO instant, and back.
export function toIstInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}
export function fromIstInput(v: string) {
  return v ? new Date(`${v}:00+05:30`).toISOString() : null;
}
