/* API base + the cross-section fetch cache and pagination button classes.
   Each dashboard section is its own route now, so this module is what keeps a
   Users → Organisers → Users round trip from re-fetching: the cache lives at
   module scope and survives the client-side transition. */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1";

// Module-level cache: avoids re-fetching Users / Organisers on every tab switch
const _adminCache = new Map<string, { data: unknown; ts: number }>();
const ADMIN_CACHE_TTL = 60_000; // 60 s

export function adminCacheGet<T>(key: string): T | null {
  const hit = _adminCache.get(key);
  if (hit && Date.now() - hit.ts < ADMIN_CACHE_TTL) return hit.data as T;
  return null;
}

export function adminCacheSet(key: string, data: unknown) {
  _adminCache.set(key, { data, ts: Date.now() });
}

// Shared class for pagination (Prev/Next/First/Last) buttons
export function pagerBtnCls(disabled: boolean): string {
  return `whitespace-nowrap rounded-md border px-[13px] py-[7px] text-[13px] font-bold transition-[background] duration-150 ${
    disabled
      ? "cursor-not-allowed border-border bg-transparent text-muted-2 opacity-50"
      : "cursor-pointer border-info bg-[rgba(59,130,246,0.14)] text-fg opacity-100"
  }`;
}

// Shared class for the bright "Page X / Y" indicator pill
export const pagerPillCls = "mx-[2px] whitespace-nowrap rounded-md bg-[#facc15] px-3 py-[6px] text-[13px] font-extrabold text-[#0b1114]";
