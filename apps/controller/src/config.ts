import { DEFAULT_STUN_URL } from "@hubbub/protocol";

// Mirrors apps/screen/src/config-resolve.ts's injected-config precedence, so the merged
// apps/web app can drive both roles from one resolved config (see apps/web/src/config-resolve.ts).
declare global {
  interface Window {
    __HUBBUB__?: { serverUrl?: string; controllerUrl?: string; stunUrl?: string };
  }
}

export const SERVER_URL =
  (typeof window !== "undefined" ? window.__HUBBUB__?.serverUrl : undefined) ??
  import.meta.env.VITE_SERVER_URL ??
  `ws://${location.hostname}:7787`;

export const STUN_URL =
  (typeof window !== "undefined" ? window.__HUBBUB__?.stunUrl : undefined) ??
  import.meta.env.VITE_STUN_URL ??
  DEFAULT_STUN_URL;
