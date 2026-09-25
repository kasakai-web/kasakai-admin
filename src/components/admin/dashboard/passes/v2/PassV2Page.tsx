"use client";

/* Pass management.
 *
 * Four screens where v1 had one list: the catalogue an admin composes passes in,
 * the passes actually issued, the redemption ledger, and — until the cut-over —
 * the legacy screen that still writes `Player.pass`.
 *
 * That last tab is not decoration. `Player.pass` remains the DECIDING engine
 * until PASS_V2_ENABLED is flipped; both engines answer every booking and any
 * disagreement is logged. Removing the old screen before the flag flips would
 * leave live passes with nowhere to be managed from. */

import { useState } from "react";
import { PassCatalogue } from "./PassCatalogue";
import { IssuedPasses } from "./IssuedPasses";
import { RedemptionLedger } from "./RedemptionLedger";
import { PassPage } from "../PassPage";

const TABS = [
  { key: "catalogue",   label: "Catalogue" },
  { key: "issued",      label: "Issued passes" },
  { key: "redemptions", label: "Redemptions" },
  { key: "legacy",      label: "Legacy (v1)" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PassV2Page() {
  const [tab, setTab] = useState<TabKey>("catalogue");

  return (
    <div>
      <div className="mb-6 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`mb-[-1px] cursor-pointer border-none border-b-2 bg-transparent px-5 py-3 text-[13px] font-semibold transition-[color,border-color] duration-150 ${
              tab === t.key
                ? "border-b-accent text-fg"
                : "border-b-transparent text-muted hover:text-body"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "catalogue"   && <PassCatalogue />}
      {tab === "issued"      && <IssuedPasses />}
      {tab === "redemptions" && <RedemptionLedger />}
      {tab === "legacy"      && <PassPage />}
    </div>
  );
}
