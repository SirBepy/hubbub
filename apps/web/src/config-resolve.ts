import { DEFAULT_STUN_URL } from "@hubbub/protocol";

export interface WebConfig {
  serverUrl: string;
  controllerUrl: string;
  stunUrl: string;
  sandboxUrl: string;
}

// Prod serves assets and relay from one Worker origin; dev splits them across the
// Vite server and the Node relay on 7787. `mode.dev` is injected to keep this pure.
export function resolveWebConfig(
  env: { VITE_SERVER_URL?: string; VITE_STUN_URL?: string; VITE_SANDBOX_URL?: string },
  loc: { hostname: string; origin: string; protocol: string },
  mode: { dev: boolean },
): WebConfig {
  const sameOriginWs = `${loc.protocol === "https:" ? "wss:" : "ws:"}${loc.origin.replace(/^https?:/, "")}`;
  return {
    serverUrl: env.VITE_SERVER_URL ?? (mode.dev ? `ws://${loc.hostname}:7787` : sameOriginWs),
    controllerUrl: loc.origin,
    stunUrl: env.VITE_STUN_URL ?? DEFAULT_STUN_URL,
    // Falls back to the shell's own origin, which the shell then REFUSES to mount games from.
    // A deploy that forgets VITE_SANDBOX_URL fails loudly instead of quietly serving untrusted
    // bundles on the origin holding the room tokens.
    sandboxUrl: env.VITE_SANDBOX_URL ?? (mode.dev ? `http://${loc.hostname}:5176` : loc.origin),
  };
}

// Same window.__HUBBUB__ slot apps/screen's resolveConfig (and now apps/controller's
// SERVER_URL) read with top precedence - see apps/screen/src/config-resolve.ts.
export function injectHubbubConfig(cfg: WebConfig): void {
  (window as Window & { __HUBBUB__?: WebConfig }).__HUBBUB__ = cfg;
}
