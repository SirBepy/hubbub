import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const marker = resolve(repoRoot, "packages/games-manifest/.dev-games");

/** The generator's three outputs plus the dev-games marker are gitignored, so turbo cannot see
 * them from git and hashes every build identically across roster changes unless they are named
 * here. Confirmed against turbo 2.9.18: an explicitly-listed gitignored path IS honoured. */
const GENERATED = [
  "packages/games-manifest/src/logics.ts",
  "packages/games-manifest/src/lazy.ts",
  "packages/games-manifest/src/settings.ts",
  "packages/games-manifest/.dev-games",
];

function webBuildHash(): string {
  const out = execFileSync(
    "pnpm",
    ["exec", "turbo", "run", "build", "--filter=@hubbub/web", "--dry=json"],
    { cwd: repoRoot, encoding: "utf8", shell: process.platform === "win32" },
  );
  const task = JSON.parse(out).tasks.find((t: { taskId: string }) => t.taskId === "@hubbub/web#build");
  if (!task) throw new Error("no @hubbub/web#build task in turbo dry run");
  return task.hash as string;
}

describe("turbo cache key covers the games manifest", () => {
  it("declares every gitignored generated path as a global dependency", () => {
    const turbo = JSON.parse(readFileSync(resolve(repoRoot, "turbo.json"), "utf8"));
    for (const path of GENERATED) expect(turbo.globalDependencies).toContain(path);
  });

  it("changes the build hash when the game roster changes", () => {
    const had = existsSync(marker);
    try {
      rmSync(marker, { force: true });
      const off = webBuildHash();
      writeFileSync(marker, "");
      const on = webBuildHash();
      expect(on).not.toBe(off);
    } finally {
      if (had) writeFileSync(marker, "");
      else rmSync(marker, { force: true });
    }
  }, 60_000);
});
