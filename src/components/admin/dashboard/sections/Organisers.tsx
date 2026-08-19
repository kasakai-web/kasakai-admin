"use client";

import { useMemo, useState } from "react";
import { getAdminToken } from "@/lib/admin-session";
import {
  SECTION_TITLE, BADGE, TOOLBAR, SEARCH_INPUT, TABLE_WRAP, TABLE, ACTION_BTN, ACTIONS, FORM_ERROR,
  LOADING_STATE, MODAL_OVERLAY, MODAL, MODAL_HEAD, MODAL_CLOSE, MODAL_ACTIONS, FORM_LABEL,
  BLOCK_TITLE, BLOCK_TITLE_SUCCESS,
} from "../shared/styles";
import { API_BASE } from "../shared/api";
import { useAdminFetch } from "../shared/useAdminFetch";
import { useClientPagination, useResetPageOnFilterChange } from "../shared/usePagination";
import { Pagination } from "../shared/Pagination";
import {
  formatDate, formatCurrency, formatStatusLabel, badgeClassForStatus,
} from "../shared/format";
import { Head, Avatar } from "../shared/components";

type AdminOrganiserRow = {
  id: string; name: string; phone: string; email?: string | null;
  profileImage?: string | null;
  whatsappNumber?: string | null; isVerified?: boolean; isActive?: boolean;
  approvalStatus?: string; status: string;
  gamesHosted?: number; totalPlayersManaged?: number;
  rating?: number; totalRatingsReceived?: number; cancellationRate?: number;
  earningsPaise?: number; pendingPayoutPaise?: number;
  joinedAt?: string | null; location?: string | null; suspendReason?: string | null;
};

/* ORow and OTable live at module scope on purpose. Declared inside Organisers
   they would be a fresh function identity on every render, and React tears down
   and rebuilds a subtree whose component type changed — which reset each table's
   horizontal scroll and every Avatar's state on each keystroke in the search box. */
type OrganiserActions = {
  actionBusy: string | null;
  doAction: (id: string, action: "approve" | "reject" | "reactivate") => void;
  onSuspend: (o: AdminOrganiserRow) => void;
};

function ORow({ o, actions }: { o: AdminOrganiserRow; actions: OrganiserActions }) {
  const { actionBusy, doAction, onSuspend } = actions;
  const busy = actionBusy !== null;
  return (
    <tr>
      <td>
        <div className="flex items-center gap-[10px]">
          <Avatar name={o.name} src={o.profileImage} size={36} />
          <div>
            <div className="font-medium">{o.name}</div>
            {o.suspendReason && <div className="text-[11px] text-danger">{o.suspendReason}</div>}
          </div>
        </div>
      </td>
      <td>
        <div>{o.phone}</div>
        {o.whatsappNumber && o.whatsappNumber !== o.phone && (
          <div className="text-[11px] text-muted">WA: {o.whatsappNumber}</div>
        )}
      </td>
      <td>{o.email || "—"}</td>
      <td>{o.location || "—"}</td>
      <td>{formatDate(o.joinedAt)}</td>
      <td>
        <div>{o.gamesHosted ?? 0} hosted</div>
        <div className="text-[11px] text-muted">{o.totalPlayersManaged ?? 0} players</div>
      </td>
      <td>
        {o.rating != null && o.rating > 0
          ? <div className="font-semibold text-warning!">★ {o.rating.toFixed(1)}<span className="ml-[4px] text-[11px] font-normal text-muted">({o.totalRatingsReceived ?? 0})</span></div>
          : <div className="text-[12px] text-muted">No ratings yet</div>
        }
      </td>
      <td>
        {o.cancellationRate != null && o.cancellationRate > 0
          ? <span className={o.cancellationRate > 20 ? "text-danger" : "text-warning"}>{o.cancellationRate.toFixed(1)}%</span>
          : <span className="text-muted">0%</span>
        }
      </td>
      <td>
        <div className="font-semibold text-success!">{formatCurrency(o.earningsPaise)}</div>
        {(o.pendingPayoutPaise ?? 0) > 0 && (
          <div className="text-[11px] text-warning">Pending: {formatCurrency(o.pendingPayoutPaise)}</div>
        )}
      </td>
      <td>
        <span className={`${BADGE} ${badgeClassForStatus(o.status)}`}>{formatStatusLabel(o.status)}</span>
      </td>
      <td>
        <div className={ACTIONS}>
          {o.approvalStatus === "pending" && (
            <>
              <button
                className={`${ACTION_BTN} border-[rgba(34,197,94,0.4)]! text-success!`}
                disabled={busy}
                onClick={() => doAction(o.id, "approve")}
              >
                {actionBusy === o.id + "approve" ? "…" : "Approve"}
              </button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.4)]! text-danger!`}
                disabled={busy}
                onClick={() => doAction(o.id, "reject")}
              >
                {actionBusy === o.id + "reject" ? "…" : "Reject"}
              </button>
            </>
          )}
          {o.approvalStatus === "approved" && o.isActive && (
            <button
              className={`${ACTION_BTN} border-[rgba(245,158,11,0.4)]! text-warning!`}
              disabled={busy}
              onClick={() => onSuspend(o)}
            >
              Suspend
            </button>
          )}
          {!o.isActive && o.approvalStatus !== "pending" && o.approvalStatus !== "rejected" && (
            <button
              className={`${ACTION_BTN} border-[rgba(34,197,94,0.4)]! text-success!`}
              disabled={busy}
              onClick={() => doAction(o.id, "reactivate")}
            >
              {actionBusy === o.id + "reactivate" ? "…" : "Reactivate"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function OTable({ rows, emptyMsg, actions }: {
  rows: AdminOrganiserRow[]; emptyMsg: string; actions: OrganiserActions;
}) {
  return (
    <div className={`${TABLE_WRAP} mb-5`}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th>Name</th><th>Phone / WhatsApp</th><th>Email</th><th>Location</th>
            <th>Joined</th><th>Games</th><th>Rating</th><th>Cancel Rate</th>
            <th>Earnings</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={11} className="p-6! text-center text-muted!">{emptyMsg}</td></tr>
          )}
          {rows.map((o) => <ORow key={o.id} o={o} actions={actions} />)}
        </tbody>
      </table>
    </div>
  );
}

export function Organisers() {
  const [search, setSearch]             = useState("");
  const [actionBusy, setActionBusy]     = useState<string | null>(null);
  const [actionError, setActionError]   = useState("");
  const [suspendTarget, setSuspendTarget] = useState<AdminOrganiserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Aliased: `doAction` below has its own local `data` for the mutation response.
  const { data: listBody, loading, error, refresh } = useAdminFetch<{ data?: AdminOrganiserRow[] }>(
    "/admin/organisers",
    { cache: true, errorMessage: "Failed to load organisers." },
  );
  // Stable identity, so the grouping memo below re-runs only on a new response.
  const organisers = useMemo(() => listBody?.data ?? [], [listBody]);

  async function doAction(id: string, action: "approve" | "reject" | "reactivate", body?: object) {
    setActionBusy(id + action); setActionError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/organisers/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || "Action failed."); return; }
      refresh();
    } catch { setActionError("Cannot reach the server."); }
    finally { setActionBusy(null); }
  }

  async function doSuspend() {
    if (!suspendTarget) return;
    setActionBusy(suspendTarget.id + "suspend"); setActionError("");
    try {
      const token = getAdminToken();
      const res   = await fetch(`${API_BASE}/admin/organisers/${suspendTarget.id}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: suspendReason.trim() || "Suspended by admin." }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || "Suspend failed."); return; }
      setSuspendTarget(null); setSuspendReason("");
      refresh();
    } catch { setActionError("Cannot reach the server."); }
    finally { setActionBusy(null); }
  }

  const q = search.trim().toLowerCase();

  /* Memoised so the three pagers below re-slice only when the data or the
     search term actually changes, not on every keystroke-driven re-render. */
  const groups = useMemo(() => {
    // Fix: approved-but-suspended organisers were falling through all three filters
    const pending  = organisers.filter((o) => o.approvalStatus === "pending");
    const approved = organisers.filter((o) => o.approvalStatus === "approved" && o.isActive !== false);
    const other    = organisers.filter((o) => !pending.includes(o) && !approved.includes(o));
    const applySearch = (list: AdminOrganiserRow[]) =>
      q ? list.filter((o) => [o.name, o.phone, o.email || "", o.whatsappNumber || "", o.location || ""].join(" ").toLowerCase().includes(q)) : list;
    return {
      pending:  applySearch(pending),
      approved: applySearch(approved),
      other:    applySearch(other),
    };
  }, [organisers, q]);

  /* One pager per group — each addresses its own URL key, so
     ?pendingPage=2&approvedPage=5 restores both tables at once. */
  const pendingPager  = useClientPagination(groups.pending,  { key: "pending",  defaultLimit: 10 });
  const approvedPager = useClientPagination(groups.approved, { key: "approved", defaultLimit: 25 });
  const otherPager    = useClientPagination(groups.other,    { key: "other",    defaultLimit: 10 });

  useResetPageOnFilterChange(pendingPager.resetPage,  [q]);
  useResetPageOnFilterChange(approvedPager.resetPage, [q]);
  useResetPageOnFilterChange(otherPager.resetPage,    [q]);

  const rowActions: OrganiserActions = {
    actionBusy,
    doAction,
    onSuspend: (o) => { setSuspendTarget(o); setSuspendReason(""); },
  };

  return (
    <>
      <Head title="Organisers" sub={loading ? "Loading…" : `${organisers.length} total organisers`} />
      {error && <div className={FORM_ERROR}>{error}</div>}
      <div className={TOOLBAR}>
        <input className={SEARCH_INPUT} placeholder="Search by name, phone, WhatsApp, email, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={ACTION_BTN} type="button" onClick={refresh}>Refresh</button>
      </div>
      {loading && <div className={LOADING_STATE}>Loading organisers…</div>}
      <div className={BLOCK_TITLE}>Pending Verification ({pendingPager.total})</div>
      <OTable rows={pendingPager.rows} emptyMsg="No pending organisers." actions={rowActions} />
      <Pagination
        page={pendingPager.page} limit={pendingPager.limit} total={pendingPager.total}
        onPageChange={pendingPager.setPage} onLimitChange={pendingPager.setLimit}
        label="pending organisers" className="mt-[-6px] mb-5"
      />

      <div className={BLOCK_TITLE_SUCCESS}>Approved &amp; Active ({approvedPager.total})</div>
      <OTable rows={approvedPager.rows} emptyMsg="No approved organisers." actions={rowActions} />
      <Pagination
        page={approvedPager.page} limit={approvedPager.limit} total={approvedPager.total}
        onPageChange={approvedPager.setPage} onLimitChange={approvedPager.setLimit}
        label="approved organisers" className="mt-[-6px] mb-5"
      />

      <div className={BLOCK_TITLE}>Rejected / Suspended ({otherPager.total})</div>
      <OTable rows={otherPager.rows} emptyMsg="None." actions={rowActions} />
      <Pagination
        page={otherPager.page} limit={otherPager.limit} total={otherPager.total}
        onPageChange={otherPager.setPage} onLimitChange={otherPager.setLimit}
        label="organisers" className="mt-[-6px] mb-5"
      />

      {/* Suspend reason modal */}
      {suspendTarget && (
        <div className={MODAL_OVERLAY} onClick={() => setSuspendTarget(null)}>
          <div className={`${MODAL} max-w-[440px]!`} onClick={(e) => e.stopPropagation()}>
            <div className={MODAL_HEAD}>
              <div className={SECTION_TITLE}>Suspend Organiser</div>
              <button className={MODAL_CLOSE} type="button" onClick={() => setSuspendTarget(null)}>✕</button>
            </div>
            <div className="mb-[14px] text-[14px] text-body">
              Suspending <strong>{suspendTarget.name}</strong>. They will not be able to create or manage games.
            </div>
            <label className={FORM_LABEL}>
              Reason (shown to admin log)
              <input
                className={`${SEARCH_INPUT} mt-[6px]! w-full`}
                placeholder="e.g. Multiple complaints from players"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </label>
            {actionError && <div className={`${FORM_ERROR} mt-[10px]`}>{actionError}</div>}
            <div className={`${MODAL_ACTIONS} mt-[18px]`}>
              <button className={ACTION_BTN} type="button" onClick={() => setSuspendTarget(null)}>Cancel</button>
              <button
                className={`${ACTION_BTN} border-[rgba(239,68,68,0.5)]! bg-[rgba(239,68,68,0.08)]! text-danger!`}
                type="button"
                disabled={actionBusy !== null}
                onClick={doSuspend}
              >
                {actionBusy !== null ? "Suspending…" : "Confirm Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
