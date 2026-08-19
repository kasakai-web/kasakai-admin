"use client";

/* The three presentational atoms every dashboard section reuses. Kept here so a
   section route pulls them in without dragging any sibling section's code. */

import { useState } from "react";
import Image from "next/image";
import { resolveImageUrl, isOptimizableImageUrl } from "@/lib/resolve-image";
import { SECTION_HEAD, SECTION_TITLE, SECTION_SUB, GAME_INFO_CELL, STAT_LABEL } from "./styles";

export function Head({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className={SECTION_HEAD}>
      <div>
        <div className={SECTION_TITLE}>{title}</div>
        <div className={SECTION_SUB}>{sub}</div>
      </div>
      {action}
    </div>
  );
}

// ── Shared Avatar component ───────────────────────────────────────────────────

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [imgFailed, setImgFailed]     = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const initial    = name ? name.charAt(0).toUpperCase() : "?";
  const hue        = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const resolvedSrc = imgFailed ? null : resolveImageUrl(src);
  const rawSrc      = resolvedSrc || "";

  const fallback = (
    <div
      className="flex shrink-0 select-none items-center justify-center rounded-full border-[1.5px] border-[rgba(255,255,255,0.12)] font-bold tracking-normal text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${hue}, 50%, 32%)` }}
    >
      {initial}
    </div>
  );

  if (!resolvedSrc) return fallback;

  return (
    <>
      <Image
        src={resolvedSrc}
        alt={name}
        width={size}
        height={size}
        unoptimized={!isOptimizableImageUrl(rawSrc)}
        title={`View photo of ${name}`}
        onClick={() => setLightboxOpen(true)}
        className="block shrink-0 cursor-pointer rounded-full border-[1.5px] border-[rgba(255,255,255,0.12)] object-cover transition-[opacity,transform] duration-150"
        /* Inline, not the width/height props alone: Tailwind preflight sets
           `img { height: auto }`, which beats the HTML height attribute and lets
           a portrait photo render as a tall ellipse. Forcing a square box is what
           gives `object-cover` something to crop against. */
        style={{ width: size, height: size }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "0.82"; e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1";    e.currentTarget.style.transform = "scale(1)"; }}
        onError={() => setImgFailed(true)}
      />

      {/* ── Photo lightbox ── */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="animate-lb-fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.85)] p-6 backdrop-blur-[10px]"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-lb-pop-in relative flex flex-col items-center gap-[14px]"
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              title="Close"
              className="absolute -right-[14px] -top-[14px] z-[1] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[rgba(255,255,255,0.18)] bg-[#1e2030] text-[16px] font-bold leading-none text-[#e0e8f8] transition-[background,border-color,color] duration-150"
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#2e3248"; b.style.borderColor = "rgba(255,255,255,0.35)"; b.style.color = "#fff"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#1e2030"; b.style.borderColor = "rgba(255,255,255,0.18)"; b.style.color = "#e0e8f8"; }}
            >
              ✕
            </button>

            {/* Enlarged photo — 320 is the CSS cap, so it is the largest useful fetch */}
            <Image
              src={resolvedSrc}
              alt={name}
              width={320}
              height={320}
              unoptimized={!isOptimizableImageUrl(rawSrc)}
              className="block h-[min(320px,80vw)] w-[min(320px,80vw)] rounded-2xl border-2 border-[rgba(255,255,255,0.14)] object-cover shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
            />

            {/* Name label */}
            <div className="text-center text-[15px] font-bold tracking-[0.02em] text-[#e8eef8] [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
              {name}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function InfoCell({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={GAME_INFO_CELL}>
      <div className={STAT_LABEL}>{label}</div>
      <div className={tone}>{value}</div>
    </div>
  );
}
