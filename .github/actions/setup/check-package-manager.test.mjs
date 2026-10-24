import { execFileSync } from "node:child_process";
import { mkdtempSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { comparePackageManager } from "./check-package-manager.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-package-manager.mjs");
const PIN = "pnpm@10.33.4";

describe("comparePackageManager", () => {
  it("passes when the game pins the platform's version", () => {
    expect(comparePackageManager({ packageManager: PIN }, { packageManager: PIN })).toBeNull();
  });

  it("fails an unpinned game repo, naming the pin to add", () => {
    expect(comparePackageManager({ packageManager: PIN }, {})).toContain(`"packageManager": "${PIN}"`);
  });

  it("fails a game pinned to a different version", () => {
    expect(comparePackageManager({ packageManager: PIN }, { packageManager: "pnpm@12.4.2" })).toMatch(/drift/);
  });

  it("fails when the platform itself has no pin", () => {
    expect(comparePackageManager({}, { packageManager: PIN })).not.toBeNull();
  });
});

describe("check-package-manager CLI", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-check-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const run = (game, script = SCRIPT) => {
    const platformPath = join(dir, "platform.json");
    const gamePath = join(dir, "game.json");
    writeFileSync(platformPath, JSON.stringify({ packageManager: PIN }));
    writeFileSync(gamePath, JSON.stringify(game));
    try {
      execFileSync(process.execPath, [script, platformPath, gamePath], { stdio: "pipe" });
      return 0;
    } catch (e) {
      return e.status;
    }
  };

  it("exits 0 on a match and 1 on drift, so the CI step actually fails", () => {
    expect(run({ packageManager: PIN })).toBe(0);
    expect(run({ packageManager: "pnpm@12.4.2" })).toBe(1);
  });

  it("still fails on drift when invoked through a linked directory", () => {
    // A junction needs no admin rights on Windows and is a plain dir symlink elsewhere.
    const link = join(dir, "linked-setup");
    symlinkSync(dirname(SCRIPT), link, "junction");
    try {
      expect(run({ packageManager: "pnpm@12.4.2" }, join(link, "check-package-manager.mjs"))).toBe(1);
    } finally {
      // The link goes here, never through afterAll's recursive rm, which must not get a chance to
      // walk into the real setup directory. rmdir is non-recursive, so it cannot empty the target.
      try {
        unlinkSync(link);
      } catch {
        rmdirSync(link);
      }
    }
  });
});
