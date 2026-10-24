import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  const run = (game) => {
    const platformPath = join(dir, "platform.json");
    const gamePath = join(dir, "game.json");
    writeFileSync(platformPath, JSON.stringify({ packageManager: PIN }));
    writeFileSync(gamePath, JSON.stringify(game));
    try {
      execFileSync(process.execPath, [SCRIPT, platformPath, gamePath], { stdio: "pipe" });
      return 0;
    } catch (e) {
      return e.status;
    }
  };

  it("exits 0 on a match and 1 on drift, so the CI step actually fails", () => {
    expect(run({ packageManager: PIN })).toBe(0);
    expect(run({ packageManager: "pnpm@12.4.2" })).toBe(1);
  });
});
