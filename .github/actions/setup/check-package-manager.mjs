// Fails a game repo's CI when its `packageManager` drifts from the platform's. CI installs with
// the platform's pnpm, but a local `corepack pnpm` in a game repo resolves whatever the game pins,
// and an unpinned repo got pnpm 12, which rewrote the lockfile and dropped its `pnpm.overrides`.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** @returns {string | null} an error message, or null when the two pins agree. */
export function comparePackageManager(platformPkg, gamePkg) {
  const platform = platformPkg.packageManager;
  const game = gamePkg.packageManager;
  if (!platform) return "the platform's package.json carries no packageManager to compare against";
  if (!game) return `the game's package.json has no packageManager; add "packageManager": "${platform}"`;
  if (game !== platform) return `packageManager drift: game pins "${game}", platform pins "${platform}"`;
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [platformPath, gamePath] = process.argv.slice(2);
  const read = (p) => JSON.parse(readFileSync(p, "utf8"));
  const error = comparePackageManager(read(platformPath), read(gamePath));
  if (error) {
    console.error(`::error file=${gamePath}::${error}`);
    process.exit(1);
  }
  console.log(`packageManager matches the platform: ${read(gamePath).packageManager}`);
}
