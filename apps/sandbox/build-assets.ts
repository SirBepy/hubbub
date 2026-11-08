import { FRAME_SECURITY_HEADERS, frameCsp } from "../../packages/sandbox/src/csp";

/** Dev-loop defaults. A build that falls back to these ships a CSP that only works on localhost,
 * so the build warns, and the deploy workflow asserts the real shell origin made it into
 * `_headers`. */
export const DEFAULT_SHELL_ORIGIN = "http://localhost:5175";
export const DEFAULT_RELAY_ORIGIN = "http://localhost:7787";

/** The version segment the shell asks for (`version="dev"` in the screen and controller apps).
 * It is not content-addressed, which is why the bundle rule below must not be cached forever. */
export const BUNDLE_VERSION = "dev";

/** The relay is reached over both fetch (http) and its websocket upgrade (ws), and a CSP
 * `connect-src` host source does not cover the other scheme. `new URL().origin` also drops a
 * stray path or trailing slash, which would otherwise silently never match. */
export function relayConnectOrigins(relayOrigin: string): string[] {
  const origin = new URL(relayOrigin).origin;
  return [origin, origin.replace(/^http/, "ws")];
}

/** The frame CSP for both the dev server and the built `_headers`, so a malformed or trailing-slash
 * origin is normalised in exactly one place. `extraConnect` is for dev-only sockets (Vite's HMR). */
export function frameCspFor(o: { shellOrigin: string; relayOrigin: string; extraConnect?: string[] }): string {
  return frameCsp({
    shellOrigin: new URL(o.shellOrigin).origin,
    connectOrigins: [...relayConnectOrigins(o.relayOrigin), ...(o.extraConnect ?? [])],
  });
}

type HeaderRule = { path: string; headers: Record<string, string> };

/** Cloudflare Workers static-assets `_headers`: a path line, then indented `Name: value` lines.
 * Rules whose paths both match a request are merged, so `/frame.html` gets the `/*` rule and
 * its own. */
export function renderHeadersFile(rules: HeaderRule[]): string {
  return (
    rules
      .map((r) => [r.path, ...Object.entries(r.headers).map(([k, v]) => `  ${k}: ${v}`)].join("\n"))
      .join("\n\n") + "\n"
  );
}

export function sandboxHeadersFile(o: { shellOrigin: string; relayOrigin: string }): string {
  return renderHeadersFile([
    {
      path: "/*",
      headers: {
        ...FRAME_SECURITY_HEADERS,
        // The frame is opaque-origin (no allow-same-origin), so every module, stylesheet and
        // bundle it loads is a CORS request carrying `Origin: null`.
        "Access-Control-Allow-Origin": "*",
        "Content-Security-Policy": frameCspFor(o),
      },
    },
    {
      path: "/games/*",
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        // Not BUNDLE_HEADERS' immutable cache: the `dev` segment is not a content hash, so a
        // redeploy would otherwise be shadowed by a year-long cached copy.
        "Cache-Control": "no-cache",
      },
    },
    // The entry document names the hashed chunks, so it must revalidate on every deploy.
    { path: "/frame.html", headers: { "Cache-Control": "no-cache" } },
  ]);
}

export interface BundleSelection {
  found: { id: string; src: string; dest: string }[];
  missing: string[];
}

/** Splits the manifest's id -> bundle path map into what can be copied and what cannot. The core
 * games have a path in the manifest but no bundler, so "missing" is an expected outcome. */
export function selectBundles(
  paths: Record<string, string>,
  exists: (file: string) => boolean,
): BundleSelection {
  const found: BundleSelection["found"] = [];
  const missing: string[] = [];
  for (const [id, src] of Object.entries(paths)) {
    if (exists(src)) found.push({ id, src, dest: `games/${id}/${BUNDLE_VERSION}.js` });
    else missing.push(id);
  }
  return { found, missing };
}
