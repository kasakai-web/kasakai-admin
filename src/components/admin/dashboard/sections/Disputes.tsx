"use client";

import { useDashboard } from "@/context/dashboard-context";
import {
  BADGE, BADGE_AMBER, BADGE_RED, BADGE_BLUE, TABLE_WRAP, TABLE, ACTION_BTN,
} from "../shared/styles";
import { Head } from "../shared/components";

export function Disputes() {
  const { onOpenDetail } = useDashboard();
  return (
    <>
      <Head title="Disputes & Refunds" sub="Open disputes requiring admin resolution" />
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Raised By</th><th>Type</th><th>Game</th><th>Description</th><th>Raised</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>Arjun Mehta</td><td><span className={`${BADGE} ${BADGE_RED}`}>Refund request</span></td><td>Monday 6v6</td><td>Says refund not received after cancellation</td><td>14 min ago</td><td><span className={`${BADGE} ${BADGE_RED}`}>Open</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Refund Request — Arjun Mehta")}>Resolve</button></td></tr>
            <tr><td>Rohit Sinha</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Backout fee</span></td><td>Saturday 7v7</td><td>Claims family emergency, requesting fee waiver</td><td>3 hr ago</td><td><span className={`${BADGE} ${BADGE_RED}`}>Open</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Backout Fee — Rohit Sinha")}>Resolve</button></td></tr>
            <tr><td>Priya Nair</td><td><span className={`${BADGE} ${BADGE_BLUE}`}>Team fairness</span></td><td>Friday 5v5</td><td>Teams were unbalanced — all high rated on one side</td><td>1 day ago</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>In review</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Team Fairness — Priya Nair")}>Resolve</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
