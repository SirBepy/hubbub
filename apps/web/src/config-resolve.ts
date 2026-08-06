export interface WebConfig {
  serverUrl: string;
  controllerUrl: string;
}

// Single origin: controllerUrl is just this origin, so QR/join links become
// <origin>/?room=CODE instead of apps/screen's standalone :5174 default.
export function resolveWebConfig(
  env: { VITE_SERVER_URL?: string },
  loc: { hostname: string; origin: string },
): WebConfig {
  return {
    serverUrl: env.VITE_SERVER_URL ?? `ws://${loc.hostname}:7787`,
    controllerUrl: loc.origin,
  };
}

// Same window.__HUBBUB__ slot apps/screen's resolveConfig (and now apps/controller's
// SERVER_URL) read with top precedence - see apps/screen/src/config-resolve.ts.
export function injectHubbubConfig(cfg: WebConfig): void {
  (window as Window & { __HUBBUB__?: WebConfig }).__HUBBUB__ = cfg;
}
