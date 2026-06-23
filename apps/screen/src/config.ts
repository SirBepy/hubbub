// One flag flips local vs cloud. In dev, point at the local server.
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:7787`;

// The controller app's base URL (where phones join). LAN IP in local mode.
export const CONTROLLER_URL =
  import.meta.env.VITE_CONTROLLER_URL ?? `http://${location.hostname}:5174`;
