import { DEFAULT_STUN_URL } from "@hubbub/protocol";

// Cast instead of `declare global`: apps/web's TS program also pulls in apps/screen's config,
// whose Window.__HUBBUB__ type carries controllerUrl too - a shared ambient declaration would
// force this app's type to match that one exactly, even though it never reads that field.
type InjectedConfig = { serverUrl?: string; stunUrl?: string; sandboxUrl?: string };
const injected =
  typeof window !== "undefined" ? (window as unknown as { __HUBBUB__?: InjectedConfig }).__HUBBUB__ : undefined;

export const SERVER_URL =
  injected?.serverUrl ?? import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:7787`;

export const STUN_URL =
  injected?.stunUrl ?? import.meta.env.VITE_STUN_URL ?? DEFAULT_STUN_URL;

// A phone frames the controller view from the same second origin the TV frames the screen view
// from; see apps/screen/src/config-resolve.ts for why a port alone is a real origin.
export const SANDBOX_URL =
  injected?.sandboxUrl ?? import.meta.env.VITE_SANDBOX_URL ?? `http://${location.hostname}:5176`;
