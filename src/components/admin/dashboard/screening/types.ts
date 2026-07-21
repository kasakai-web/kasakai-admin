export type ScrEvent = {
  id: string;
  title: string;
  venue: string;
  date: string;
  status: "published" | "cancelled" | "draft" | "completed";
  image: string;
  capacity?: number;
  sold?: number;
  pricePaise?: number;
  contacts: { name: string; email: string; phone: string }[];
  showOrganiser?: boolean;
};


export function scrStatusBadge(status: ScrEvent["status"]) {
  if (status === "published")  return { label: "Published",  color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)" };
  if (status === "cancelled")  return { label: "Cancelled",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" };
  if (status === "completed")  return { label: "Completed",  color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.25)" };
  return                               { label: "Draft",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
}

export type ScrShowTicket = { id: string; name: string; qty: number; sold: number; pricePaise: number };
export type ScrShow = {
  id: string; dateLabel: string; timeLabel: string;
  status: "active" | "expired"; expanded: boolean;
  tickets: ScrShowTicket[];
};

export function mockShowsForEvent(ev: ScrEvent): ScrShow[] {
  const parts = ev.date.split("|");
  return [{
    id: "show-1",
    dateLabel: parts[0]?.trim() ?? "TBD",
    timeLabel: parts[1]?.trim() ?? "8:00 PM",
    status: "expired", expanded: false,
    tickets: [{ id: "t1", name: "Cover Charge", qty: ev.capacity ?? 100, sold: ev.sold ?? 0, pricePaise: ev.pricePaise ?? 49900 }],
  }];
}

// shared back-button style (Tailwind utility string)
export const backBtnStyle =
  "mt-[2px] inline-flex shrink-0 cursor-pointer items-center gap-[6px] rounded-lg border border-border bg-surface px-[14px] py-2 text-[12px] font-semibold text-muted";

// shared form-input style (Tailwind utility string)
export const inp =
  "box-border w-full rounded-lg border border-border bg-[#0b1114] px-3 py-[10px] text-[13px] text-fg outline-none";
