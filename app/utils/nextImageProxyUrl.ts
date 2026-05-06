/**
 * Build URLs for Next.js image optimization (`/_next/image`), used by WebGL loaders
 * (e.g. carousel card thumbnails) to match ProgressiveImage-style low→high loading.
 *
 * Respects `NEXT_PUBLIC_BASE_PATH` for GitHub Pages. On static export hosts where
 * the optimizer is unavailable, TextureLoader error handlers should fall back to the raw `src`.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function nextImageOptimizedUrl(
  src: string,
  width: number,
  quality: number
): string {
  if (!src?.trim()) return src;
  if (src.startsWith("data:")) return src;
  const q = encodeURIComponent(src);
  return `${BASE}/_next/image?url=${q}&w=${width}&q=${quality}`;
}
