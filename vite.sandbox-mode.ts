import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A file, not an env var, for the same reason `.dev-games` is one: an env var set for a single
// `pnpm dev` silently reverts on the next run.
const marker = fileURLToPath(new URL("./packages/games-manifest/.sandbox", import.meta.url));

export function sandboxModeOn(): boolean {
  return existsSync(marker);
}

/** S1. A bundler `define`, never a runtime NODE_ENV read, so the direct-import loader is
 * dead-code-eliminated out of production rather than merely skipped: an operator setting
 * NODE_ENV=development cannot re-enable the unapproved-bundle path, those bytes are not there. */
export function sandboxDefines(mode: string): Record<string, string> {
  return { __HUBBUB_DEV_LOADER__: JSON.stringify(mode !== "production" && !sandboxModeOn()) };
}
