import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";

/** Linked game repos are siblings, so their node_modules sit outside the workspace and vite's
 * fs guard 403s them - Music Guesser's Permanent Marker fell back to Comic Sans (2026-08-22). */
export function gameRepoFsAllow(): string[] {
  const siblings = fileURLToPath(new URL("..", import.meta.url));
  let gameRepos: string[] = [];
  try {
    gameRepos = readdirSync(siblings, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("hubbub-game-"))
      .map((e) => join(siblings, e.name));
  } catch {
    // CI or a fresh clone has no siblings; the workspace root alone is correct.
  }
  return [searchForWorkspaceRoot(process.cwd()), ...gameRepos];
}
