// Mirrors apps/screen/src/config-resolve.ts's injected-config precedence, so the merged
// apps/web app can drive both roles from one resolved config (see apps/web/src/config-resolve.ts).
declare global {
  interface Window {
    __HUBBUB__?: { serverUrl?: string; controllerUrl?: string };
  }
}

export const SERVER_URL =
  (typeof window !== "undefined" ? window.__HUBBUB__?.serverUrl : undefined) ??
  import.meta.env.VITE_SERVER_URL ??
  `ws://${location.hostname}:7787`;
