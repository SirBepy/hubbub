import { resolveConfig, type HubbubConfig } from "./config-resolve";

// Electron's preload injects window.__HUBBUB__ in local host mode.
declare global {
  interface Window {
    __HUBBUB__?: Partial<HubbubConfig>;
  }
}

const cfg = resolveConfig(
  typeof window !== "undefined" ? window.__HUBBUB__ : undefined,
  import.meta.env as { VITE_SERVER_URL?: string; VITE_CONTROLLER_URL?: string; VITE_STUN_URL?: string; VITE_SANDBOX_URL?: string },
  typeof location !== "undefined" ? location.hostname : "localhost",
);

export const SERVER_URL = cfg.serverUrl;
export const CONTROLLER_URL = cfg.controllerUrl;
export const STUN_URL = cfg.stunUrl;
export const SANDBOX_URL = cfg.sandboxUrl;
