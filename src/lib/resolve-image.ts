// Resolve a stored image reference to a loadable URL.
// New uploads are absolute R2 URLs (https://pub-….r2.dev/…) — returned as-is.
// Legacy "/uploads/…" values are prefixed with the backend origin.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000/api/v1";
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

export function resolveImageUrl(img?: string | null): string {
  if (!img) return "";
  if (/^(https?:|data:|blob:)/i.test(img)) return img;
  return img.startsWith("/") ? `${BACKEND_ORIGIN}${img}` : `${BACKEND_ORIGIN}/${img}`;
}

/**
 * Can `next/image` run this URL through /_next/image?
 *
 * Only the R2 bucket is declared in `next.config.ts` → `images.remotePatterns`,
 * and two kinds of URL can never be optimized whatever the config says:
 *
 *  - `blob:` / `data:` — they exist only in this browser tab, so the optimizer
 *    (which fetches server-side) has nothing to resolve. Upload widgets show a
 *    `blob:` preview while the file is still uploading.
 *  - the backend origin — legacy "/uploads/…" refs still in the DB. The backend
 *    302s them to R2, but the *initial* host has to pass remotePatterns, and in
 *    development it is localhost, which Next 16 blocks unless you opt in with
 *    `dangerouslyAllowLocalIP`.
 *
 * Anything else is R2 and gets optimized. Pass the negation as `unoptimized`:
 * those images still render through `<Image>` — sized, lazy-loaded and free of
 * layout shift — just served as-is instead of re-encoded.
 */
export function isOptimizableImageUrl(url: string): boolean {
  if (!url) return false;
  if (/^(data:|blob:)/i.test(url)) return false;
  if (url.startsWith(BACKEND_ORIGIN)) return false;
  return true;
}
