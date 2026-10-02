"use client";

/* Discounts & coupons — offers on a game's entry price.
 *
 * Three screens: the campaigns an admin composes, the ledger of every seat an
 * offer was applied to, and a tester that answers "what would this player pay
 * for this game, and why" with the same engine the booking runs.
 *
 * Nothing is decided here. Whether an offer applies, what it takes off and what
 * may be saved are the server's answers (utils/discountRules.js); these screens
 * send drafts and render what comes back. */

import { useState } from "react";
import { useAdminFetch } from "../shared/useAdminFetch";
import { Campaign } from "./shared";
import { CampaignList } from "./CampaignList";
import { CampaignEditor } from "./CampaignEditor";
import { CampaignDetail } from "./CampaignDetail";
import { RedemptionsTable } from "./RedemptionsTable";
import { BookingPreview } from "./BookingPreview";

const TABS = [
  { key: "campaigns",   label: "Campaigns" },
  { key: "redemptions", label: "Redemptions" },
  { key: "test",        label: "Test a booking" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type ListResponse = {
  success: boolean;
  data: { campaigns: Campaign[]; canManage: boolean; enabled: boolean };
};

export function DiscountsPage() {
  const [tab, setTab] = useState<TabKey>("campaigns");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, error, refresh } = useAdminFetch<ListResponse>(
    "/admin/discounts",
    { errorMessage: "Could not load discount campaigns." },
  );
  const campaigns = data?.data?.campaigns ?? [];
  const canManage = Boolean(data?.data?.canManage);
  const enabled = data?.data?.enabled !== false;

  const changed = (message: string) => { setMsg(message); refresh(); };

  return (
    <div>
      <div className="mb-6 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`mb-[-1px] cursor-pointer border-none border-b-2 bg-transparent px-5 py-3 text-[13px] font-semibold transition-[color,border-color] duration-150 ${
              tab === t.key ? "border-b-accent text-fg" : "border-b-transparent text-muted hover:text-body"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 text-[12px] text-[#4ade80]">{msg}</div>}

      {tab === "campaigns" && (
        <CampaignList
          campaigns={campaigns}
          loading={loading}
          error={error}
          canManage={canManage}
          enabled={enabled}
          onOpen={(c) => setOpenId(c._id)}
          onCreate={() => setCreating(true)}
          onChanged={changed}
        />
      )}
      {tab === "redemptions" && <RedemptionsTable campaigns={campaigns} />}
      {tab === "test" && <BookingPreview />}

      {openId && !editing && (
        <CampaignDetail
          campaignId={openId}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onEdit={(c) => setEditing(c)}
          onChanged={changed}
        />
      )}

      {(creating || editing) && (
        <CampaignEditor
          initial={editing}
          canManage={canManage}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(m) => { setCreating(false); setEditing(null); changed(m); }}
        />
      )}
    </div>
  );
}
