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
