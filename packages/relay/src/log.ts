export type LogLevel = "info" | "debug";

/** Injected sink so this package stays runtime-agnostic (no node:, no console assumed).
 * apps/server writes lines to stdout; apps/worker writes via console.* for `wrangler tail`. */
export interface RelayLogger {
  level: LogLevel;
  info(line: string): void;
  /** Only invoked when level is "debug" - the noisy per-message tier (e.g. a gameStatePush from
   * a 60fps game). Callers pass a thunk so the line is never built when the tier is off. */
  debug(build: () => string): void;
}

export const noopLogger: RelayLogger = { level: "info", info() {}, debug() {} };

export function createLogger(level: LogLevel, sink: (line: string) => void): RelayLogger {
  return {
    level,
    info: sink,
    debug: (build) => {
      if (level === "debug") sink(build());
    },
  };
}
