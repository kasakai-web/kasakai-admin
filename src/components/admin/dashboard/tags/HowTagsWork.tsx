"use client";

/* "How tags work" — the rules every tag follows, from the Auto-Tagging PRD's
   rule-engine section, said once at the top of the Explorer so each tag's own
   explanation does not have to repeat them. Numbers come from the thresholds the
   server sends, never typed here. It describes what the engine DOES; where that
   differs from the PRD (habit tags read the last 20 games, not 90 days), the code
   wins.

   Open the first time, then remembered per browser. */

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CARD, CHIP, BAND_TONE, SENSITIVE_TONE, MANUAL_TONE, SUPPRESSED_TONE, type Definitions } from "./shared";

const STORE_KEY = "kk.tags.guide.open";

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORE_KEY) !== "0";
  } catch {
    return true;
  }
}

// Another tab closing the guide is the only outside change worth hearing about.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-border bg-[rgba(255,255,255,0.015)] px-4 py-3">
      <div className="mb-[6px] text-[13px] font-semibold text-fg">{title}</div>
      <div className="flex flex-col gap-[6px] text-[12.5px] leading-[1.55] text-body">{children}</div>
    </div>
  );
}

const K = ({ children }: { children: ReactNode }) => <span className="font-mono text-[12px] text-fg">{children}</span>;

export function HowTagsWork({ defs }: { defs: Definitions | null }) {
  const stored = useSyncExternalStore(subscribe, readOpen, () => true);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? stored;

  const toggle = () => {
    const next = !open;
    setChosen(next);
    try { window.localStorage.setItem(STORE_KEY, next ? "1" : "0"); } catch { /* per-browser convenience only */ }
  };

  const T = defs?.thresholds;
  const pc = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className={`${CARD} mb-5`}>
      <button type="button" onClick={toggle} aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent p-0 text-left">
        <span>
          <span className="block text-[15px] font-semibold text-fg">How tags work</span>
          <span className="mt-[2px] block text-[12.5px] text-muted">
            The rules every tag follows. Hover a tag’s rule for its own details; click a tag to see who holds it.
          </span>
        </span>
        <span className="shrink-0 font-mono text-[12px] text-muted">{open ? "Hide ▴" : "Show ▾"}</span>
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          <Block title="What a tag is">
            <div>
              A label like <K>venue:loyal:kickoff-arena-hsr</K> on a player, game, organiser or venue. The first part is the{" "}
              <b>namespace</b>, the question it answers (venue, day, time…). Then comes the answer, and sometimes which one
              (which venue).
            </div>
            <div>Worked out every night at 03:00 IST from what actually happened. Admins see tags; players never do.</div>
          </Block>

          <Block title="Which games it looks at">
            {T ? (
              <>
                <div>
                  <b>Habits</b> (venue, area, day, time, format, position, social) use a player’s <b>last {T.HABIT_GAMES} games</b>{" "}
                  within {T.HABIT_DAYS} days. A regular who goes quiet keeps “Whitefield weekday regular”, so you can still find them.
                </div>
                <div>
                  <b>Activity</b> (frequency, spend, booking, feedback) uses the <b>last {T.WINDOW_DAYS} days</b>. Reliability
                  uses {T.RELIABILITY_DAYS}. Organisers and venues use {T.WINDOW_DAYS}.
                </div>
              </>
            ) : <div>Loading…</div>}
            <div>
              <b>Played</b> means the player’s own seat in a completed game, not marked absent or no-show. A +1 they bring is
              not a second game for them.
            </div>
          </Block>

          <Block title="Too few games → no tag">
            <div>
              Every tag has a minimum. Below it, the tag is simply <b>absent</b>. It does not mean “none”, and it is not a
              guess. Two games are a coincidence, not a pattern.
            </div>
            <div>
              So a player with 2 games gets a frequency and a lifecycle tag, but <b>no</b> venue, day or time tag.
            </div>
          </Block>

          <Block title="Why a rule has two numbers">
            {T ? (
              <div>
                A tag is <b>earned</b> at one line and <b>lost</b> only below a lower one. For example,{" "}
                <K>venue:loyal</K> is earned at {pc(T.venueLoyal.in)} and lost below {pc(T.venueLoyal.out)}.
              </div>
            ) : null}
            <div>
              With one line, a player sitting right at it would gain and lose the tag every night, and the history
              would be noise.
            </div>
          </Block>

          <Block title="One at a time">
            <div>
              Some groups hold one value only: frequency, lifecycle stage, weekend / weekday / mixed, favourite day, home
              metro and city, loyal venue, spend band, booking lead, skill.
            </div>
            <div>A tie goes to the value they already hold, then to their most recent game, so ties never flip between nights.</div>
          </Block>

          <Block title="Compared with everyone">
            <div>
              <K>spend:*</K>, <K>price:*</K> and <K>org:size:*</K> are relative. Each night, everyone is split into three equal
              groups (thirds). The two cut-off amounts are saved on that night’s run in the Run log.
            </div>
            <div>A value exactly on a cut-off goes to the lower group.</div>
          </Block>

          <Block title="Time bands (IST, by kick-off)">
            {defs?.timeBands?.length ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-[2px]">
                {defs.timeBands.map((b) => (
                  <div key={b.key} className="flex justify-between gap-2">
                    <K>{b.key}</K>
                    <span className="font-mono text-[11.5px] text-muted">
                      {String(b.fromHour).padStart(2, "0")}–{String(b.toHour).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            ) : <div>Loading…</div>}
            <div className="text-muted">Days and times are always the IST kick-off, never when the seat was booked.</div>
          </Block>

          <Block title="Confidence and colours">
            <div>
              How sure the tag is: more games and a wider margin past the line mean higher confidence. It is shown on a
              player’s or game’s tag chips as{" "}
              <span className={`${CHIP} ${BAND_TONE.high}`}>high</span>{" "}
              <span className={`${CHIP} ${BAND_TONE.medium}`}>medium</span>{" "}
              <span className={`${CHIP} ${BAND_TONE.low}`}>low</span>.
            </div>
            <div>
              <span className={`${CHIP} ${SENSITIVE_TONE}`}>sensitive</span> is a risk-flavoured tag (no-show risk, lapsing,
              low satisfaction…). It is left out of CSV exports unless you tick the box. <b>Informational</b> tags describe
              someone and are never used to target them.
            </div>
          </Block>

          <Block title="Manual and suppressed">
            <div>
              <span className={`${CHIP} ${MANUAL_TONE}`}>manual</span> tags are added by an admin from a fixed list (VIP,
              potential host…). The nightly run never touches them.
            </div>
            <div>
              If a rule tag is wrong for one person, you can{" "}
              <span className={`${CHIP} ${SUPPRESSED_TONE}`}>suppress</span> it there. The run then skips it until the
              suppression is lifted. Both are done from the entity’s drawer.
            </div>
          </Block>

          <Block title="Never a gate">
            <div>
              A tag may decide who <b>gets</b> an offer, but never who is refused or charged more. Nothing on booking, joining,
              inviting or pricing reads a tag, and a test enforces this.
            </div>
          </Block>

          <Block title="Dry run vs live">
            <div>
              In a <b>dry run</b>, the nightly run only counts what it would tag and writes nothing else. “Live” stays at 0,
              so the <b>Last run</b> column is the number to check.
            </div>
            <div>
              Once <span className="font-mono text-[12px]">TAGGING_LIVE=true</span> is set, tags are written and keep their
              history. An expired tag is kept, never deleted.
            </div>
          </Block>

          <Block title="Reading the table">
            <div><b>Live</b>: how many hold the tag now.</div>
            <div><b>+30d / −30d</b>: how many gained or lost it in the last 30 days.</div>
            <div>
              <b>Last run</b>: what the latest run counted (in a dry run, what it would have written), with its share of
              everything that run looked at.
            </div>
          </Block>
        </div>
      )}
    </div>
  );
}
