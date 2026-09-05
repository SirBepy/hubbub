// Verified live 2026-09-04 by fetching api.deezer.com and itunes.apple.com and reading the
// returned URLs; the 2026-08-08 record listed the Deezer preview host as UNVERIFIED.
// Previews come from cdnt-preview.dzcdn.net, album art from cdn-images.dzcdn.net.
const MEDIA_HOSTS = ["https://cdnt-preview.dzcdn.net", "https://audio-ssl.itunes.apple.com"];
const IMAGE_HOSTS = ["https://cdn-images.dzcdn.net"];

export interface CspOrigins {
  /** The shell allowed to frame this document. Pins `frame-ancestors`. */
  shellOrigin: string;
  connectOrigins: string[];
}

/** The full directive list from the 2026-08-08 record, section 2.3. `img-src`, `media-src` and
 * `form-action` are load-bearing, not belt-and-braces: without them CSP misses the exfiltration
 * and phishing channels that never touch fetch, an `<img src>` beacon and a `<form action>`
 * submit. `sandbox allow-scripts` as a RESPONSE header re-applies it when loaded top-level. */
export function frameCsp(o: CspOrigins): string {
  const connect = ["'self'", ...o.connectOrigins].join(" ");
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_HOSTS.join(" ")}`,
    `media-src 'self' blob: ${MEDIA_HOSTS.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connect}`,
    "frame-src 'none'",
    "child-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    `frame-ancestors ${o.shellOrigin}`,
    "sandbox allow-scripts",
  ].join("; ");
}

/** `nosniff` plus a fixed JS content type is what stops a bundle being reinterpreted. */
export const BUNDLE_HEADERS: Record<string, string> = {
  "Content-Type": "text/javascript; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  // The frame has an opaque origin (no `allow-same-origin`), so its module imports are CORS
  // requests sending `Origin: null` and fail without this. Safe to open: approved bundles are
  // world-readable by design and carry nothing user-specific.
  "Access-Control-Allow-Origin": "*",
  // Content-addressed keys: the bytes at a hash never change, so nothing here goes stale.
  "Cache-Control": "public, max-age=31536000, immutable",
};

// Policy headers only, no Content-Type: the dev server applies this to every response on the
// origin (JS, CSS, assets), not just the frame document, so a fixed Content-Type here would
// mislabel everything else Vite serves.
export const FRAME_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export const FRAME_DOC_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  ...FRAME_SECURITY_HEADERS,
};
