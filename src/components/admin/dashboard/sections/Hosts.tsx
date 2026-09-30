"use client";

/* Hosts — players an organiser recommended to run their games on the ground.
   The organiser recommends; this page is where KasaKai approves or rejects, and
   where an approved host can be revoked. An approval is PER ORGANISER: the same
   player recommended by two organisers is two rows, decided separately.

   What a host gets once approved: host spots in that organiser's games at the
   organiser's discount, and the host tools (roster, attendance, teams, wrap-up)
   on the player portal for the games they run. Revoking takes the tools away at
   once; seats they already booked stay theirs. */

import { useEffect, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  SECTION_TITLE, BADGE, TOOLBAR, SEARCH_INPUT, TABLE_WRAP, TABLE, ACTION_BTN, ACTIONS, FORM_ERROR,
  LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL,
  TAB_BAR, TAB, TAB_ACTIVE,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { usePagination, useResetPageOnFilterChange } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import { UserDetailModal } from "../shared/UserDetailModal";
import { formatDate, formatStatusLabel, badgeClassForStatus } from "../shared/format";
import { Head, Avatar } from "../shared/components";

type HostStatus = "pending" | "approved" | "rejected" | "ended";

type HostRow = {
  _id: string;
  status: HostStatus;
  recommendedNote?: string | null;
  recommendedAt?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  decidedBy?: { name?: string } | null;
  endedAt?: string | null;
  endedByRole?: "admin" | "organiser" | "player" | null;
  endedReason?: string | null;
  gamesWithOrganiser?: number;
  player?: {
    _id: string; name: string; phone?: string; email?: string; profileImage?: string | null;
    totalGamesPlayed?: number; noShowCount?: number; backoutCount?: number; rating?: number; isVerified?: boolean;
  } | null;
  organiser?: { _id: string; name: string; phone?: string } | null;
};

type HostList = {
  data?: {
    rows: HostRow[];
    total: number;
    counts: Record<HostStatus, number>;
  };
};

type Decision = { row: HostRow; action: "approve" | "reject" | "revoke" };

const TABS: { key: HostStatus; label: string }[] = [
  { key: "pending",  label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "ended",    label: "Ended" },
];

const DECISION_COPY: Record<Decision["action"], { title: string; verb: string; noteLabel: string; tone: string }> = {
  approve: {
    title: "Approve host",
    verb: "Approve",
    noteLabel: "Note (optional, kept on the record)",
    tone: "border-[rgba(34,197,94,0.5)]! bg-[rgba(34,197,94,0.08)]! text-success!",
  },
  reject: {
    title: "Reject recommendation",
    verb: "Reject",
    noteLabel: "Reason (shown to the organiser)",
    tone: "border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!",
  },
  revoke: {
    title: "Revoke host",
    verb: "Revoke",
    noteLabel: "Reason (shown to the player and the organiser)",
    tone: "border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!",
  },
};

const endedByLabel = (role?: string | null) =>
  role === "admin" ? "Revoked by admin" : role === "player" ? "Stepped down" : role === "organiser" ? "Ended by organiser" : "Ended";

export function Hosts() {
  const [status, setStatus]   = useState<HostStatus>("pending");
  const [search, setSearch]   = useState("");
  const [debounced, setDebounced] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [actionError, setActionError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { page, limit, setPage, setLimit, resetPage } = usePagination({ defaultLimit: 25 });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useResetPageOnFilterChange(resetPage, [status, debounced]);

  const params = new URLSearchParams({ status, page: String(page), limit: String(limit) });
  if (debounced.trim().length >= 2) params.set("q", debounced.trim());

  const { data, loading, error, refresh } = useAdminFetch<HostList>(
    `/admin/hosts?${params.toString()}`,
    { errorMessage: "Failed to load hosts." },
  );
  const rows   = data?.data?.rows ?? [];
  const total  = data?.data?.total ?? 0;
  const counts = data?.data?.counts ?? { pending: 0, approved: 0, rejected: 0, ended: 0 };

  function openDecision(row: HostRow, action: Decision["action"]) {
    setDecision({ row, action });
    setNote("");
    setActionError("");
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    setActionError("");
    try {
      const token = getAdminToken();
      const body = decision.action === "revoke" ? { reason: note.trim() || undefined } : { note: note.trim() || undefined };
      const res = await fetch(`${API_BASE}/admin/hosts/${decision.row._id}/${decision.action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) { setActionError(out.message || "Action failed."); return; }
      setDecision(null);
      refresh();
    } catch {
      setActionError("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head
        title="Hosts"
        sub={loading ? "Loading…" : `${counts.pending} waiting for approval · ${counts.approved} approved`}
      />
      {error && <div className={FORM_ERROR}>{error}</div>}

      <div className={TAB_BAR}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${TAB} ${status === t.key ? TAB_ACTIVE : ""}`}
            onClick={() => setStatus(t.key)}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      <div className={TOOLBAR}>
        <input
          className={SEARCH_INPUT}
          placeholder="Search by player name, phone or organiser…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={ACTION_BTN} type="button" onClick={refresh}>Refresh</button>
      </div>

      {loading && rows.length === 0 && <div className={LOADING_STATE}>Loading hosts…</div>}

      <div className={`${TABLE_WRAP} mb-5`}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th>Player</th>
              <th>Record</th>
              <th>Recommended by</th>
              <th>With them</th>
              <th>Organiser&apos;s note</th>
              <th>Recommended</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6! text-center text-muted!">
                  {status === "pending" ? "No recommendations waiting." : `No ${status} hosts.`}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r._id}>
                <td>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-[10px] border-none bg-transparent p-0 text-left text-inherit"
                    onClick={() => r.player && setDetailId(r.player._id)}
                  >
                    <Avatar name={r.player?.name || "?"} src={r.player?.profileImage} size={34} />
                    <div>
                      <div className="font-medium">{r.player?.name || "Deleted player"}</div>
                      <div className="text-[11px] text-muted">{r.player?.phone || "—"}</div>
                    </div>
                  </button>
                </td>
                <td>
                  <div>{r.player?.totalGamesPlayed ?? 0} games</div>
                  <div className="text-[11px] text-muted">
                    {r.player?.noShowCount ?? 0} no-shows · {r.player?.backoutCount ?? 0} backouts
                  </div>
                </td>
                <td>
                  <div className="font-medium">{r.organiser?.name || "—"}</div>
                  <div className="text-[11px] text-muted">{r.organiser?.phone || ""}</div>
                </td>
                <td>
                  <span className={(r.gamesWithOrganiser ?? 0) === 0 ? "text-warning" : ""}>
                    {r.gamesWithOrganiser ?? 0} played
                  </span>
                </td>
                <td className="max-w-[260px]">
                  <div className="text-[13px] text-body">{r.recommendedNote || <span className="text-muted">—</span>}</div>
                </td>
                <td>{formatDate(r.recommendedAt)}</td>
                <td>
                  <span className={`${BADGE} ${badgeClassForStatus(r.status === "ended" ? "inactive" : r.status)}`}>
                    {r.status === "ended" ? endedByLabel(r.endedByRole) : formatStatusLabel(r.status)}
                  </span>
                  {(r.decisionNote || r.endedReason) && (
                    <div className="mt-1 max-w-[220px] text-[11px] text-muted">{r.endedReason || r.decisionNote}</div>
                  )}
                  {r.decidedAt && r.status !== "pending" && (
                    <div className="mt-1 text-[11px] text-muted">
                      {formatDate(r.status === "ended" ? r.endedAt : r.decidedAt)}
                      {r.decidedBy?.name && r.status !== "ended" ? ` · ${r.decidedBy.name}` : ""}
                    </div>
                  )}
                </td>
                <td>
                  <div className={ACTIONS}>
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className={`${ACTION_BTN} border-[rgba(34,197,94,0.4)]! text-success!`}
                          onClick={() => openDecision(r, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                          onClick={() => openDecision(r, "reject")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        type="button"
                        className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                        onClick={() => openDecision(r, "revoke")}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page} limit={limit} total={total}
        onPageChange={setPage} onLimitChange={setLimit}
        label="hosts" className="mt-[-6px] mb-5"
      />

      {decision && (
        <div className={MODAL_OVERLAY} onClick={() => !busy && setDecision(null)}>
          <div className={`${MODAL} max-w-[460px]!`} onClick={(e) => e.stopPropagation()}>
            <div className={MODAL_HEAD}>
              <div className={SECTION_TITLE}>{DECISION_COPY[decision.action].title}</div>
              <button className={MODAL_CLOSE} type="button" onClick={() => setDecision(null)} disabled={busy}>✕</button>
            </div>
            <div className="mb-[14px] text-[14px] leading-[1.5] text-body">
              {decision.action === "approve" && (
                <>
                  <strong>{decision.row.player?.name}</strong> becomes a host for{" "}
                  <strong>{decision.row.organiser?.name}</strong> — they can book host spots in that organiser&apos;s
                  games and use the host tools for the games they run.
                </>
              )}
              {decision.action === "reject" && (
                <>
                  <strong>{decision.row.organiser?.name}</strong> is told the recommendation was not approved.
                  The player was never told they were recommended, and won&apos;t be.
                </>
              )}
              {decision.action === "revoke" && (
                <>
                  <strong>{decision.row.player?.name}</strong> loses the host tools straight away and any
                  facilitator slots they accepted. Host spots they already booked stay theirs — the organiser is told
                  which, and can remove them with a full refund.
                </>
              )}
            </div>
            <label className={FORM_LABEL}>
              {DECISION_COPY[decision.action].noteLabel}
              <textarea
                className={`${SEARCH_INPUT} mt-[6px]! min-h-[80px] w-full`}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {actionError && <div className={`${FORM_ERROR} mt-[10px]`}>{actionError}</div>}
            <div className={`${MODAL_ACTIONS} mt-[18px]`}>
              <button className={ACTION_BTN} type="button" onClick={() => setDecision(null)} disabled={busy}>Cancel</button>
              <button
                className={`${ACTION_BTN} ${DECISION_COPY[decision.action].tone}`}
                type="button"
                disabled={busy}
                onClick={submitDecision}
              >
                {busy ? "Saving…" : DECISION_COPY[decision.action].verb}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && <UserDetailModal userId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}
