"use client";

import { useDashboard } from "@/context/dashboard-context";
import {
  SECTION_HEAD, SECTION_TITLE, SECTION_SUB, BADGE, BADGE_GREEN, BADGE_AMBER, TABLE_WRAP, TABLE,
  ACTION_BTN, TOPBAR_BTN, TOPBAR_BTN_PRIMARY,
} from "../shared/styles";

export function Communities() {
  const { onOpenDetail } = useDashboard();
  return (
    <>
      <div className={SECTION_HEAD}>
        <div>
          <div className={SECTION_TITLE}>Communities</div>
          <div className={SECTION_SUB}>Active communities across India</div>
        </div>
        <button className={`${TOPBAR_BTN} ${TOPBAR_BTN_PRIMARY}`} type="button">+ Add Community</button>
      </div>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead><tr><th>Community</th><th>City</th><th>Organiser</th><th>Members</th><th>Games (MTD)</th><th>WhatsApp</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr><td>FC Bengaluru Sundays</td><td>Bengaluru</td><td>Vikram Rao</td><td>84</td><td>18</td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Linked</span></td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Active</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("FC Bengaluru Sundays")}>View</button></td></tr>
            <tr><td>Weekend Warriors Mumbai</td><td>Mumbai</td><td>Neha Kapoor</td><td>62</td><td>12</td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Linked</span></td><td><span className={`${BADGE} ${BADGE_GREEN}`}>Active</span></td><td><button className={ACTION_BTN} onClick={() => onOpenDetail("Weekend Warriors Mumbai")}>View</button></td></tr>
            <tr><td>Delhi Football Club</td><td>Delhi</td><td>Pending</td><td>0</td><td>0</td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Pending</span></td><td><span className={`${BADGE} ${BADGE_AMBER}`}>Setup</span></td><td><button className={ACTION_BTN}>Activate</button></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
