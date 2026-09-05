import { DEFAULT_STUN_URL } from "@hubbub/protocol";

export interface HubbubConfig {
  serverUrl: string;
  controllerUrl: string;
  stunUrl: string;
  /** Second origin games are framed from. A distinct PORT is a distinct origin (RFC 6454), which
   * is what makes the LAN default satisfy the isolation rule with no operator setup. */
  sandboxUrl: string;
}

/**
 * Resolves the screen's transport config. Precedence:
 *   injected host config (Electron preload window.__HUBBUB__)
 *   > Vite env vars
 *   > hostname-derived local defaults.
 */
export function resolveConfig(
  injected: Partial<HubbubConfig> | undefined,
  env: { VITE_SERVER_URL?: string; VITE_CONTROLLER_URL?: string; VITE_STUN_URL?: string; VITE_SANDBOX_URL?: string },
  hostname: string,
): HubbubConfig {
  return {
    serverUrl: injected?.serverUrl ?? env.VITE_SERVER_URL ?? `ws://${hostname}:7787`,
    controllerUrl:
      injected?.controllerUrl ?? env.VITE_CONTROLLER_URL ?? `http://${hostname}:5174`,
    stunUrl: injected?.stunUrl ?? env.VITE_STUN_URL ?? DEFAULT_STUN_URL,
    sandboxUrl: injected?.sandboxUrl ?? env.VITE_SANDBOX_URL ?? `http://${hostname}:5176`,
  };
}
